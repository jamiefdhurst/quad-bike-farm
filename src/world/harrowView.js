import * as THREE from 'three';
import { UNTOUCHED, COMBED_ALONG_Z } from './harrowing.js';
import { fieldChunks, cellsByChunk, chunkWorked } from './fieldChunks.js';

// What the harrowing job looks like: the field as a skin over the grass, in chunks, that shows the combed lines (light and dark stripes a few
// centimetres across, along the way the mat went, the other way where it was gone over across), and the molehills dealt over it, which vanish
// as the mat spreads them. The skin is an ordinary lit material, so the daylight dims it with everything else. Rules are in harrowing.js.

const LIFT = 0.04; // metres the skin sits above the ground
const TEXELS = 8; // texels to the metre: a stripe of one texel is about the 12 cm between a few tines
const SEGMENTS = 2; // vertices a metre, so the skin follows the ground
const LIGHT = [196, 204, 120, 120]; // r, g, b, alpha of a pale, lifted stripe of turf
const DARK = [52, 60, 30, 135]; // and of a dark one where the tines turned the soil

export class HarrowView {
  constructor({ scene, harrowing, heightAt, molehills }) {
    this.scene = scene;
    this.h = harrowing;
    this.heightAt = heightAt;
    this.hills = molehills;
    this.buildSkin();
    this.buildMolehills();
  }

  /**
   * The skin, in chunks of the field (fieldChunks.js, #1072): one picture of Low Ley was 1,960 by 1,120 texels, 8.8 MB sent to the graphics card
   * whole each time a cell was combed, on a mesh of 274,000 triangles drawn whether or not any of it was. A chunk has a picture and a mesh of its
   * own (128 texels a side, 64 KB, and 2,048 triangles) and is built when something in it is first combed.
   */
  buildSkin() {
    const h = this.h;
    this.grid = fieldChunks(h.cols, h.rows, h.live);
    this.skin = new THREE.Group();
    this.skin.name = 'harrowedField';
    this.parts = new Array(this.grid.chunks.length).fill(null); // each chunk's { mesh, texture, data, w, chunk }, once something in it is combed
    // The shaders are built behind the start screen from what is in the scene (core/shaderPrep.js), and a fresh field has no chunk in it: one
    // cell that is never shown stands in, so the first pull of the harrows doesn't stop the game to build one.
    this.primer = this.buildChunk({ k: -1, c0: 0, r0: 0, cols: 1, rows: 1 });
    this.primer.mesh.name = 'harrowedFieldPrimer';
    this.primer.mesh.visible = false;
    this.scene.add(this.skin);
    this.refresh();
  }

  /** A chunk's picture, clear until painted, and its mesh lying on the ground. */
  buildChunk(chunk) {
    const { rect } = this.h;
    const w = chunk.cols * TEXELS;
    const d = chunk.rows * TEXELS;
    const data = new Uint8Array(w * d * 4);
    const texture = new THREE.DataTexture(data, w, d, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    const nx = chunk.cols * SEGMENTS;
    const nz = chunk.rows * SEGMENTS;
    const sx = (rect.maxX - rect.minX) / (this.h.cols * SEGMENTS); // metres between vertices: the field's width over the whole grid, as one skin had it
    const sz = (rect.maxZ - rect.minZ) / (this.h.rows * SEGMENTS);
    const x0 = rect.minX + chunk.c0 * SEGMENTS * sx;
    const z0 = rect.minZ + chunk.r0 * SEGMENTS * sz;
    // The ground's height at every vertex and one beyond each side, so a vertex on the chunk's edge leans the same way as its neighbour's there
    // and the light doesn't show the join.
    const across = nx + 3;
    const heights = new Float32Array(across * (nz + 3));
    for (let j = -1; j <= nz + 1; j++) for (let i = -1; i <= nx + 1; i++) heights[(j + 1) * across + i + 1] = this.heightAt(x0 + i * sx, z0 + j * sz);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    const normal = new Float32Array((nx + 1) * (nz + 1) * 3);
    const uv = new Float32Array((nx + 1) * (nz + 1) * 2);
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i;
        const at = (j + 1) * across + i + 1;
        pos.set([x0 + i * sx, heights[at] + LIFT, z0 + j * sz], k * 3);
        const slopeX = (heights[at + 1] - heights[at - 1]) / (2 * sx);
        const slopeZ = (heights[at + across] - heights[at - across]) / (2 * sz);
        const len = Math.hypot(slopeX, 1, slopeZ);
        normal.set([-slopeX / len, 1 / len, -slopeZ / len], k * 3);
        uv.set([i / nx, j / nz], k * 2);
      }
    }
    const idx = [];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.name = 'harrowedChunk';
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    this.skin.add(mesh);
    return { mesh, texture, data, w, chunk };
  }

  /** A chunk's picture and mesh, built the first time they are asked for. */
  part(chunk) {
    this.parts[chunk.k] ??= this.buildChunk(chunk);
    return this.parts[chunk.k];
  }

  /** Takes a chunk with nothing combed in it out again (the field cleared, or the combing grown out). */
  drop(k) {
    const part = this.parts[k];
    if (!part) return;
    this.skin.remove(part.mesh);
    part.mesh.geometry.dispose();
    part.mesh.material.dispose();
    part.texture.dispose();
    this.parts[k] = null;
  }

  /** Writes the stripes for one cell into its chunk's picture: along z the stripes run across x, along x they run across z. */
  paintCell(part, i) {
    const h = this.h;
    const c = (i % h.cols) - part.chunk.c0;
    const r = Math.floor(i / h.cols) - part.chunk.r0;
    const st = h.state[i];
    for (let ty = 0; ty < TEXELS; ty++) {
      for (let tx = 0; tx < TEXELS; tx++) {
        const px = c * TEXELS + tx;
        const py = r * TEXELS + ty;
        const o = (py * part.w + px) * 4;
        if (st === UNTOUCHED) {
          part.data[o + 3] = 0;
          continue;
        }
        // Alternate texel columns (or rows) light and dark. A chunk starts on an even texel of the field, so the stripes carry on across the join.
        const stripe = st === COMBED_ALONG_Z ? px : py;
        const col = stripe % 2 ? DARK : LIGHT;
        part.data[o] = col[0];
        part.data[o + 1] = col[1];
        part.data[o + 2] = col[2];
        part.data[o + 3] = col[3];
      }
    }
  }

  /** Redraws every cell from the state (a load, the panel's buttons): the chunks with combing in them and none of the others, and the molehills. */
  refresh() {
    for (const chunk of this.grid.chunks) {
      if (!chunk) continue;
      if (!chunkWorked(chunk, this.h.state, UNTOUCHED)) {
        this.drop(chunk.k);
        continue;
      }
      const part = this.part(chunk);
      for (const cell of chunk.cells) this.paintCell(part, cell);
      part.texture.needsUpdate = true;
    }
    this.showHills();
  }

  /** These cells have changed (a pull of the harrows): each is redrawn in its own chunk's picture, and only those pictures are sent. */
  repaint(cells) {
    for (const [k, list] of cellsByChunk(this.grid, cells)) {
      const part = this.part(this.grid.chunks[k]);
      for (const cell of list) this.paintCell(part, cell);
      part.texture.needsUpdate = true;
    }
    this.showHills();
  }

  buildMolehills() {
    const geo = new THREE.SphereGeometry(0.28, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.scale(1, 0.55, 1); // a low mound
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    this.hillMesh = new THREE.InstancedMesh(geo, mat, Math.max(1, this.hills.length));
    this.hillMesh.name = 'molehills';
    this.hillMesh.receiveShadow = true;
    this.hillMesh.castShadow = false;
    this.hillMesh.count = this.hills.length;
    this.scene.add(this.hillMesh);
    this.shown = new Array(this.hills.length).fill(null);
    this.showHills();
  }

  /** A molehill stands while the cell it is in is untouched; combing the cell spreads it. */
  showHills() {
    if (!this.hillMesh) return;
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const q = new THREE.Quaternion();
    let moved = false;
    this.hills.forEach((hill, k) => {
      const up = this.h.state[this.h.index(hill.x, hill.z)] === UNTOUCHED;
      if (this.shown[k] === up) return;
      this.shown[k] = up;
      moved = true;
      const size = up ? hill.size : 0.0001;
      m.compose(new THREE.Vector3(hill.x, this.heightAt(hill.x, hill.z) - 0.02, hill.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k), s.set(size, size, size));
      this.hillMesh.setMatrixAt(k, m);
    });
    if (moved) this.hillMesh.instanceMatrix.needsUpdate = true; // only when one has gone or come back, not on every cell combed
  }

  dispose() {
    this.scene.remove(this.skin, this.hillMesh);
  }
}
