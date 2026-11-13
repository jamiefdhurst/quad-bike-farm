import * as THREE from 'three';
import { UNSPRAYED, SPRAY_CELL } from './spraying.js';
import { nozzlePositions } from '../vehicle/sprayerModel.js';

// What the spraying job looks like: the field as a skin of cells over the stubble (clear until sprayed, a damp darker tint once sprayed, darker
// still where two passes overlap), and a fine mist falling from the boom's nozzles while it sprays. The ground is an ordinary lit material, so
// the daylight dims it with everything else; the mist has its own colour, so `setLight` dims it with the day. Rules are in spraying.js.

const LIFT = 0.05; // metres the skin sits above the ground
const DROPS = 220;
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

  buildGround() {
    const sp = this.sp;
    const n = sp.cells;
    const pos = new Float32Array(n * 4 * 3);
    const col = new Float32Array(n * 4 * 4);
    const idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const c = i % sp.cols;
      const r = Math.floor(i / sp.cols);
      const x0 = sp.rect.minX + c * SPRAY_CELL;
      const z0 = sp.rect.minZ + r * SPRAY_CELL;
      [[x0, z0], [x0 + SPRAY_CELL, z0], [x0 + SPRAY_CELL, z0 + SPRAY_CELL], [x0, z0 + SPRAY_CELL]].forEach(([x, z], k) => pos.set([x, this.heightAt(x, z) + LIFT, z], (i * 4 + k) * 3));
      idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    this.ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.ground.name = 'sprayedField';
    this.ground.receiveShadow = true;
    this.ground.renderOrder = 1;
    this.scene.add(this.ground);
    this.refresh();
  }

  /** Recolours every cell from the state. */
  refresh() {
    const col = this.ground.geometry.attributes.color;
    for (let i = 0; i < this.sp.cells; i++) this.paint(col, i, this.sp.state[i]);
    col.needsUpdate = true;
  }

  repaint(cells) {
    const col = this.ground.geometry.attributes.color;
    for (const i of cells) this.paint(col, i, this.sp.state[i]);
    col.needsUpdate = true;
  }

  paint(col, i, state) {
    const t = TINT[state] ?? [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) col.setXYZW(i * 4 + k, t[0], t[1], t[2], state === UNSPRAYED ? 0 : t[3]);
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
