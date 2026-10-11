// The flock's bodies (world/flock.js): three instanced meshes, all procedural. Lumpy cream wool, a dark face with ears that dips to
// graze, and dark legs. Each sheep sits on the drawn ground, tilted to its slope, and rocks a little as she walks.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const NECK = new THREE.Vector3(0, 0.52, 0.42); // where the head hangs from, in the sheep's own frame

/** Paints a whole geometry one colour, with a little lightness varying from vertex to vertex so a flat colour doesn't look like plastic. */
function paint(geo, hex, vary = 0.08, seed = 1) {
  const base = new THREE.Color(hex);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = Math.sin(pos.getX(i) * 91 + pos.getY(i) * 57 + pos.getZ(i) * 33 + seed) * 0.5 + 0.5;
    const k = 1 - vary + vary * 2 * n;
    col[i * 3] = base.r * k;
    col[i * 3 + 1] = base.g * k;
    col[i * 3 + 2] = base.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Moves a geometry's vertices by a deterministic lumpy noise, for wool. */
function lump(geo, amount) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + amount * (Math.sin(x * 23 + z * 17) * Math.sin(y * 19 + x * 11) + 0.6 * Math.sin(z * 31 - y * 13));
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function ellipsoid(r, sx, sy, sz, at, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  g.translate(at[0], at[1], at[2]);
  return g;
}

function woolGeometry() {
  const parts = [
    ellipsoid(0.34, 0.95, 0.95, 1.4, [0, 0.62, 0], 2),
    ellipsoid(0.25, 1, 0.9, 1, [0, 0.66, 0.3], 1), // shoulders, fuller up front
    ellipsoid(0.25, 1.05, 0.9, 1, [0, 0.64, -0.3], 1), // rump
    ellipsoid(0.12, 1.2, 1.1, 1, [0, 0.7, 0.5], 1), // the wool up to the poll
  ].map((g) => g.toNonIndexed());
  const wool = mergeGeometries(parts.map((g) => lump(g, 0.07)));
  wool.translate(0, -0.1, 0);
  return paint(wool, 0xcdc4ad, 0.14, 3);
}

/** The head, with its ears, relative to the neck so it can be dipped to graze. */
function headGeometry() {
  const face = paint(ellipsoid(0.1, 0.8, 0.95, 1.5, [0, -0.04, 0.2]).toNonIndexed(), 0x2c2723, 0.1, 5);
  const ears = [-1, 1].map((side) => {
    const e = ellipsoid(0.05, 1.6, 0.3, 0.8, [side * 0.12, 0.02, 0.1]).toNonIndexed();
    e.rotateZ(side * -0.25);
    return paint(e, 0x241f1c, 0.1, 7);
  });
  const neck = paint(ellipsoid(0.1, 1, 1, 1.6, [0, 0, 0.04]).toNonIndexed(), 0xcfc8b6, 0.1, 9);
  return mergeGeometries([face, ...ears, neck]);
}

function legsGeometry() {
  const legs = [];
  for (const [x, z] of [[-0.14, 0.38], [0.14, 0.38], [-0.14, -0.36], [0.14, -0.36]]) {
    const g = new THREE.CylinderGeometry(0.04, 0.03, 0.38, 6).toNonIndexed();
    g.translate(x, 0.19, z);
    legs.push(paint(g, 0x2c2723, 0.08, 11));
  }
  return mergeGeometries(legs);
}

export class FlockView {
  constructor(scene, flock, ground) {
    this.flock = flock;
    this.ground = ground; // (x, z) => height of the drawn ground
    const n = flock.sheep.length;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    this.meshes = [woolGeometry(), headGeometry(), legsGeometry()].map((g) => {
      const m = new THREE.InstancedMesh(g, mat, n);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false; // the flock moves; the bounding sphere made at the start would be wrong
      m.name = 'flock';
      scene.add(m);
      return m;
    });
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), n: new THREE.Vector3(), e: new THREE.Euler() };
    this.update();
  }

  /** Lays every sheep on the ground and poses her. */
  update() {
    const { m, q, q2, p, s, n, e } = this.tmp;
    const [wool, head, legs] = this.meshes;
    this.flock.sheep.forEach((sh, i) => {
      const y = this.ground(sh.x, sh.z);
      // The slope under her, from the ground a step either side.
      const dzdx = (this.ground(sh.x + 0.5, sh.z) - this.ground(sh.x - 0.5, sh.z)) / 1;
      const dzdz = (this.ground(sh.x, sh.z + 0.5) - this.ground(sh.x, sh.z - 0.5)) / 1;
      n.set(-dzdx, 1, -dzdz).normalize();
      q.setFromUnitVectors(UP, n);
      q2.setFromAxisAngle(UP, sh.yaw);
      q.multiply(q2);
      // Rock from side to side and bob as she steps; faster and bigger at a run.
      const moving = sh.speed > 0.05;
      const run = sh.mode === 'run' ? 1 : 0.5;
      const rock = moving ? Math.sin(sh.phase) * 0.05 * run : 0;
      const bob = moving ? Math.abs(Math.sin(sh.phase)) * 0.03 * run : 0;
      q2.setFromEuler(e.set(0, 0, rock));
      q.multiply(q2);
      p.set(sh.x, y + bob, sh.z);
      s.setScalar(sh.size);
      m.compose(p, q, s);
      wool.setMatrixAt(i, m);
      legs.setMatrixAt(i, m);
      // The head: hung from the neck, down to the grass when she's grazing, up and a little forward otherwise.
      const pitch = 0.1 + sh.head * 0.85;
      const hm = new THREE.Matrix4().compose(NECK, new THREE.Quaternion().setFromEuler(e.set(pitch, 0, 0)), new THREE.Vector3(1, 1, 1));
      head.setMatrixAt(i, m.clone().multiply(hm));
    });
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}
