import * as THREE from 'three';
import { squareBaleGeometry, squareBaleMaterials } from './squareBale.js';
import { STANDING, CUT, BALED, STACK_CAPACITY, stackSpots } from './haymaking.js';
import { createRandom } from '../core/random.js';

// What the hay job looks like: the patch as a skin of cells over the stubble (green standing, pale cut, a little darker once baled), the loose
// bales on the ground, the ones stacked on the trailer, a bale in the air while it is thrown, and the stack in the Dutch barn. The materials are
// ordinary lit ones, so the daylight dims them with everything else. The rules are in haymaking.js.

const BALE = { w: 0.98, h: 0.38, d: 0.44 }; // the trailer's own bales
const LIFT = 0.06; // metres the skin sits above the ground
const COLOURS = {
  [STANDING]: new THREE.Color(0x869a46),
  [CUT]: new THREE.Color(0xcbb879),
  [BALED]: new THREE.Color(0xb7a36a),
};
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class HayView {
  constructor({ scene, hay, heightAt, random = createRandom(0x4a17) }) {
    this.scene = scene;
    this.hay = hay;
    this.heightAt = heightAt;
    this.geo = squareBaleGeometry(BALE.w, BALE.h, BALE.d);
    this.mats = squareBaleMaterials(random);
    this.meshes = new Map(); // bale id -> mesh
    this.flying = []; // { mesh, from, slot (trailer-local), body, t, seconds, onLand }
    this.stack = []; // the meshes in the barn
    this.loose = new THREE.Group(); // the bales lying about: what E aims at
    this.loose.name = 'hayBales';
    scene.add(this.loose);
    this.buildGround(random);
  }

  /** One quad per cell, its corners on the ground, with a vertex colour for what state it is in. */
  buildGround(random) {
    const h = this.hay;
    const n = h.cells;
    const pos = new Float32Array(n * 4 * 3);
    const col = new Float32Array(n * 4 * 3);
    const idx = new Uint32Array(n * 6);
    this.tint = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = i % h.cols;
      const r = Math.floor(i / h.cols);
      const x0 = h.rect.minX + c * h.cell;
      const z0 = h.rect.minZ + r * h.cell;
      const corners = [[x0, z0], [x0 + h.cell, z0], [x0 + h.cell, z0 + h.cell], [x0, z0 + h.cell]];
      corners.forEach(([x, z], k) => pos.set([x, this.heightAt(x, z) + LIFT, z], (i * 4 + k) * 3));
      idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
      this.tint[i] = 0.88 + random() * 0.24;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    this.ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    this.ground.receiveShadow = true;
    this.ground.name = 'hayPatch';
    this.scene.add(this.ground);
    this.refresh();
  }

  /** Recolours every cell from the state (after a restore, or a pass). */
  refresh() {
    const col = this.ground.geometry.attributes.color;
    const s = this.hay.state;
    for (let i = 0; i < s.length; i++) this.paint(col, i, s[i]);
    col.needsUpdate = true;
  }

  /** Recolours just these cells. */
  repaint(cells) {
    const col = this.ground.geometry.attributes.color;
    for (const i of cells) this.paint(col, i, this.hay.state[i]);
    col.needsUpdate = true;
  }

  paint(col, i, state) {
    const c = COLOURS[state];
    const t = this.tint[i];
    for (let k = 0; k < 4; k++) col.setXYZ(i * 4 + k, c.r * t, c.g * t, c.b * t);
  }

  // The bales ---------------------------------------------------------------

  makeMesh() {
    const m = new THREE.Mesh(this.geo, this.mats);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** A bale the baler has left, lying on the ground. */
  addLoose(bale) {
    const m = this.makeMesh();
    m.userData.baleId = bale.id;
    this.meshes.set(bale.id, m);
    this.putDown(bale, m);
    return m;
  }

  /** (Re)places a bale's mesh on the ground where the bale is. */
  putDown(bale, mesh = bale && this.meshes.get(bale.id)) {
    if (!bale || !mesh) return;
    this.loose.attach(mesh);
    mesh.position.set(bale.x, this.heightAt(bale.x, bale.z) + BALE.h / 2 - 0.02, bale.z);
    mesh.rotation.set(0, bale.yaw ?? 0, 0);
    mesh.scale.set(1, 1, 1);
  }

  meshOf(id) {
    return this.meshes.get(id) ?? null;
  }

  /** The bale in the air from `from` (world) to a slot (trailer-local) on `body`, then it sits there. `onLand` is called as it lands. */
  throwOnto(bale, body, slot, seconds, from, onLand) {
    const mesh = this.meshes.get(bale.id);
    if (!mesh) return;
    this.scene.attach(mesh);
    mesh.position.copy(from);
    this.flying.push({ mesh, from: from.clone(), slot, body, t: 0, seconds, onLand });
  }

  /** Sits a bale straight on the trailer (no throw: a restore, or the debug panel). */
  seat(bale, body, slot) {
    const mesh = this.meshes.get(bale.id);
    if (!mesh) return;
    body.add(mesh);
    mesh.position.set(slot.x, slot.y, slot.z);
    mesh.rotation.set(0, 0, 0);
  }

  update(dt) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.seconds);
      f.body.localToWorld(_b.set(f.slot.x, f.slot.y, f.slot.z));
      _a.lerpVectors(f.from, _b, k);
      _a.y += Math.sin(k * Math.PI) * 0.9; // the arc
      f.mesh.position.copy(_a);
      f.mesh.rotation.y += dt * 3.5 * (1 - k);
      if (k >= 1) {
        this.flying.splice(i, 1);
        f.body.add(f.mesh);
        f.mesh.position.set(f.slot.x, f.slot.y, f.slot.z);
        f.mesh.rotation.set(0, 0, 0);
        f.onLand?.();
      }
    }
  }

  /** Takes these bales' meshes away (unloaded at the barn, or a reset). */
  remove(ids) {
    const gone = new Set(ids.map((id) => this.meshes.get(id)).filter(Boolean));
    this.flying = this.flying.filter((f) => !gone.has(f.mesh));
    for (const m of gone) m.parent?.remove(m);
    for (const id of ids) this.meshes.delete(id);
  }

  /** The stack in the Dutch barn's open bay: `count` bales lying along its back wall. */
  setStack(open, count, floorAt = 0) {
    for (const m of this.stack) m.parent?.remove(m);
    this.stack = [];
    if (!open) return;
    for (const s of stackSpots(open, Math.min(count, STACK_CAPACITY), { floor: floorAt })) {
      const m = this.makeMesh();
      m.position.set(s.x, s.y, s.z);
      m.rotation.y = (s.x * 7.3) % 0.06; // a hand's turn off true, so the row is not a printout
      this.scene.add(m);
      this.stack.push(m);
    }
  }

  /** Clears the bales and recolours the patch (the debug panel's reset). */
  reset() {
    this.remove([...this.meshes.keys()]);
    this.flying = [];
    this.refresh();
  }
}
