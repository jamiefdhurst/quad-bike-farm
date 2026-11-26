import * as THREE from 'three';
import { UNSPRAYED, SPRAY_CELL } from './spraying.js';
import { fieldChunks, cellsByChunk, runsOf, chunkWorked } from './fieldChunks.js';
import { nozzlePositions } from '../vehicle/sprayerModel.js';

// What the spraying job looks like: the field as a skin of cells over the stubble, in chunks (clear until sprayed, a damp darker tint once sprayed, darker
// still where two passes overlap), and a fine mist falling from the boom's nozzles while it sprays. The ground is an ordinary lit material, so
// the daylight dims it with everything else; the mist has its own colour, so `setLight` dims it with the day. Rules are in spraying.js.

const LIFT = 0.05; // metres the skin sits above the ground
const DROPS = 220;
const FLOATS = 16; // numbers of colour to a cell: red, green, blue and alpha at each of its four corners
const MAX_RANGES = 32; // runs of changed cells a chunk waits with before all of it is sent instead
const TINT = [null, [0.18, 0.3, 0.12, 0.34], [0.1, 0.2, 0.08, 0.55]]; // r, g, b, alpha by state: a wet dark green over the stubble

export class SprayView {
  constructor({ scene, spraying, heightAt }) {
    this.scene = scene;
    this.sp = spraying;
    this.heightAt = heightAt;
    this.buildGround();
    this.buildMist();
    this.light = 1;
  }

  /**
   * The skin, in chunks of the field (fieldChunks.js, #1072): one mesh for the lot was 65,000 triangles over Lane Field's middle whether or not
   * any of it was sprayed, and its 2.1 MB of colours went to the graphics card whole each time a cell changed. A chunk is built when something
   * in it is first sprayed, of the field's own cells only.
   */
  buildGround() {
    const sp = this.sp;
    this.grid = fieldChunks(sp.cols, sp.rows, sp.live);
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.ground = new THREE.Group();
    this.ground.name = 'sprayedField';
    this.parts = new Array(this.grid.chunks.length).fill(null); // each chunk's mesh, once something in it is sprayed
    // The shaders are built behind the start screen from what is in the scene (core/shaderPrep.js), and a fresh field has no chunk in it: one
    // cell that is never shown stands in, so the first pass of the boom doesn't stop the game to build one.
    this.primer = new THREE.Mesh(this.chunkGeometry([0]), this.material);
    this.primer.name = 'sprayedFieldPrimer';
    this.primer.visible = false;
    this.ground.add(this.primer);
    this.scene.add(this.ground);
    this.refresh();
  }

  /** The quads of `cells` (indices into the grid), four corners each of their own, lying on the ground and clear until painted. */
  chunkGeometry(cells) {
    const sp = this.sp;
    const n = cells.length;
    const pos = new Float32Array(n * 4 * 3);
    const col = new Float32Array(n * FLOATS);
    const idx = new Uint16Array(n * 6); // a chunk is 256 cells at most, 1,024 corners
    for (let s = 0; s < n; s++) {
      const c = cells[s] % sp.cols;
      const r = Math.floor(cells[s] / sp.cols);
      const x0 = sp.rect.minX + c * SPRAY_CELL;
      const z0 = sp.rect.minZ + r * SPRAY_CELL;
      [[x0, z0], [x0 + SPRAY_CELL, z0], [x0 + SPRAY_CELL, z0 + SPRAY_CELL], [x0, z0 + SPRAY_CELL]].forEach(([x, z], k) => pos.set([x, this.heightAt(x, z) + LIFT, z], (s * 4 + k) * 3));
      idx.set([s * 4, s * 4 + 2, s * 4 + 1, s * 4, s * 4 + 3, s * 4 + 2], s * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    return geo;
  }

  /** A chunk's mesh, built the first time it is asked for. */
  part(chunk) {
    let mesh = this.parts[chunk.k];
    if (mesh) return mesh;
    mesh = new THREE.Mesh(this.chunkGeometry(chunk.cells), this.material);
    mesh.name = 'sprayedChunk';
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    // All of a new chunk's colours go to the graphics card the first time it is drawn; until they have, a changed cell needs no range of its own.
    mesh.userData.whole = true;
    mesh.geometry.attributes.color.onUpload(() => (mesh.userData.whole = false));
    this.parts[chunk.k] = mesh;
    this.ground.add(mesh);
    return mesh;
  }

  /** Takes a chunk with nothing sprayed in it out again (the field cleared, or the spray worn off). */
  drop(k) {
    const mesh = this.parts[k];
    if (!mesh) return;
    this.ground.remove(mesh);
    mesh.geometry.dispose();
    this.parts[k] = null;
  }

  /** Marks all of a chunk's colours to be sent. */
  sendWhole(mesh) {
    const col = mesh.geometry.attributes.color;
    col.clearUpdateRanges();
    mesh.userData.whole = true;
    col.needsUpdate = true;
  }

  /** Recolours every cell from the state (a load, the panel's buttons): the chunks with spray in them, and none of the others. */
  refresh() {
    const sp = this.sp;
    for (const chunk of this.grid.chunks) {
      if (!chunk) continue;
      if (!chunkWorked(chunk, sp.state, UNSPRAYED)) {
        this.drop(chunk.k);
        continue;
      }
      const mesh = this.part(chunk);
      const col = mesh.geometry.attributes.color;
      for (let s = 0; s < chunk.cells.length; s++) this.paint(col, s, sp.state[chunk.cells[s]]);
      this.sendWhole(mesh);
    }
  }

  /**
   * These cells have changed (a pass of the boom): each is recoloured in its own chunk, and only those colours are sent, as runs of cells that
   * follow on from each other. A chunk that is out of sight sends nothing until it is seen, so its runs are folded into the whole chunk
   * (16 KB) once there are `MAX_RANGES` of them.
   */
  repaint(cells) {
    const { grid, sp } = this;
    for (const [k, list] of cellsByChunk(grid, cells)) {
      const mesh = this.part(grid.chunks[k]);
      const col = mesh.geometry.attributes.color;
      const slots = list.map((cell) => grid.slotOf[cell]);
      list.forEach((cell, n) => this.paint(col, slots[n], sp.state[cell]));
      if (!mesh.userData.whole) {
        for (const [from, count] of runsOf(slots)) col.addUpdateRange(from * FLOATS, count * FLOATS);
        if (col.updateRanges.length > MAX_RANGES) this.sendWhole(mesh);
      }
      col.needsUpdate = true;
    }
  }

  /** Colours the cell at `slot` of a chunk's colours. */
  paint(col, slot, state) {
    const t = TINT[state] ?? [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) col.setXYZW(slot * 4 + k, t[0], t[1], t[2], state === UNSPRAYED ? 0 : t[3]);
  }

  buildMist() {
    this.pos = new Float32Array(DROPS * 3);
    this.drops = Array.from({ length: DROPS }, () => ({ life: 0, vx: 0, vy: 0, vz: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({ color: 0xdfe9ee, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false });
    this.mist = new THREE.Points(geo, this.mat);
    this.mist.frustumCulled = false;
    this.mist.visible = false;
    this.scene.add(this.mist);
    this.nozzles = [];
    this.next = 0;
    this.acc = 0;
    this.pos.fill(-1000);
  }

  /** Dims the mist with the day (1 full light, 0 dark). */
  setLight(k) {
    this.light = k;
    this.mat.color.setRGB(0.87 * k + 0.04, 0.91 * k + 0.04, 0.93 * k + 0.05);
  }

  /** `model` is the sprayer's; `on` whether it is laying spray now. */
  update(dt, { model, on }) {
    this.mist.visible = on || this.drops.some((d) => d.life > 0);
    if (on && model) {
      nozzlePositions(model, this.nozzles);
      this.acc += dt * 600; // drops a second from all the nozzles
      while (this.acc >= 1 && this.nozzles.length) {
        this.acc -= 1;
        const d = this.drops[this.next];
        this.next = (this.next + 1) % DROPS;
        const n = this.nozzles[Math.floor(Math.random() * this.nozzles.length)];
        d.life = 0.35 + Math.random() * 0.25;
        d.vx = (Math.random() - 0.5) * 0.5;
        d.vy = -1.2 - Math.random() * 0.8;
        d.vz = (Math.random() - 0.5) * 0.5; // a fan under the boom
        this.pos.set([n.x, n.y - 0.05, n.z], (this.next === 0 ? DROPS - 1 : this.next - 1) * 3);
      }
    } else this.acc = 0;
    for (let i = 0; i < DROPS; i++) {
      const d = this.drops[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        this.pos.set([0, -1000, 0], i * 3);
        continue;
      }
      this.pos[i * 3] += d.vx * dt;
      this.pos[i * 3 + 1] += d.vy * dt;
      this.pos[i * 3 + 2] += d.vz * dt;
    }
    this.mist.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.ground, this.mist);
  }
}
