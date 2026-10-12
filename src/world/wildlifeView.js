// The wildlife's bodies (world/wildlife.js), all procedural and instanced: rabbits (brown, with a white scut and long ears, sitting up
// or hopping, and a pair of eyes that shine when one is caught in a headlight) and pheasants (a copper body, a dark green head, a long
// tail, and wings that beat when one is flushed). Each sits on the drawn ground.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

function paint(geo, hex, vary = 0.1, seed = 1) {
  const base = new THREE.Color(hex);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = Math.sin(pos.getX(i) * 71 + pos.getY(i) * 47 + pos.getZ(i) * 29 + seed) * 0.5 + 0.5;
    const k = 1 - vary + vary * 2 * n;
    col[i * 3] = base.r * k;
    col[i * 3 + 1] = base.g * k;
    col[i * 3 + 2] = base.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function blob(r, sx, sy, sz, at, hex, seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  g.translate(at[0], at[1], at[2]);
  return paint(g.toNonIndexed(), hex, 0.1, seed);
}

/** A rabbit facing +z, haunches at the back, about 0.4 m long. */
function rabbitGeometry() {
  const parts = [
    blob(0.11, 0.9, 1, 1.35, [0, 0.13, -0.02], 0x8a6d4b, 1),
    blob(0.09, 1, 1, 1, [0, 0.14, -0.13], 0x806445, 2), // haunches
    blob(0.075, 0.9, 0.9, 1.1, [0, 0.24, 0.13], 0x8f7452, 3), // head
    blob(0.03, 0.5, 2.6, 0.6, [-0.035, 0.34, 0.1], 0x7a5f40, 4),
    blob(0.03, 0.5, 2.6, 0.6, [0.035, 0.34, 0.1], 0x7a5f40, 5),
    blob(0.04, 1, 1, 1, [0, 0.16, -0.22], 0xeeeadc, 6), // the white scut
  ];
  return mergeGeometries(parts);
}

/** A cock pheasant facing +z, standing: about 0.35 m tall with a long tail trailing behind. */
function pheasantGeometry() {
  const tail = new THREE.ConeGeometry(0.05, 0.5, 5);
  tail.rotateX(-Math.PI / 2 - 0.15); // pointing back, a little down
  tail.translate(0, 0.26, -0.38);
  const parts = [
    blob(0.13, 0.9, 1, 1.5, [0, 0.27, 0], 0x9a5a2a, 1),
    blob(0.07, 1, 1.5, 1, [0, 0.4, 0.17], 0x1f4a3a, 2), // neck and head, glossy green
    blob(0.035, 1, 1, 1, [0, 0.38, 0.17], 0xf0f0e8, 3), // the white ring at the neck
    blob(0.04, 0.8, 0.8, 1.2, [0, 0.5, 0.21], 0x234f40, 4),
    blob(0.025, 1, 0.6, 1, [0, 0.5, 0.26], 0xb3342a, 5), // the red wattle round the eye
    paint(tail.toNonIndexed(), 0x8b6a3a, 0.14, 6),
  ];
  for (const x of [-0.05, 0.05]) {
    const leg = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4);
    leg.translate(x, 0.09, 0.02);
    parts.push(paint(leg.toNonIndexed(), 0x8c8570, 0.05, 7));
  }
  return mergeGeometries(parts);
}

/** One wing, hinged at its root on the x axis and spread out along +x (the other is mirrored). */
function wingGeometry() {
  const g = new THREE.IcosahedronGeometry(0.12, 1);
  g.scale(3, 0.18, 1.7);
  g.translate(0.34, 0, 0);
  return paint(g.toNonIndexed(), 0x865228, 0.14, 8);
}

export class WildlifeView {
  /** `ground(x, z)` is the height of the drawn ground. */
  constructor(scene, rabbits, pheasants, ground) {
    this.rabbits = rabbits;
    this.pheasants = pheasants;
    this.ground = ground;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const make = (geo, n, name, shine = false) => {
      const m = new THREE.InstancedMesh(geo, shine ? new THREE.MeshBasicMaterial({ color: 0xe8ffb0 }) : mat, Math.max(1, n));
      m.castShadow = !shine;
      m.frustumCulled = false; // they move; the bounding sphere made at the start would be wrong
      m.name = name;
      m.count = n;
      scene.add(m);
      return m;
    };
    const nr = rabbits.rabbits.length;
    const np = pheasants.birds.length;
    this.rabbitMesh = make(rabbitGeometry(), nr, 'rabbits');
    this.eyes = make(new THREE.SphereGeometry(0.014, 6, 4), nr * 2, 'rabbitEyes', true);
    this.pheasantMesh = make(pheasantGeometry(), np, 'pheasants');
    this.wings = make(wingGeometry(), np * 2, 'pheasantWings');
    this.t = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), n: new THREE.Vector3(), e: new THREE.Euler() };
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.time = 0;
    this.update(0, 0);
  }

  slope(x, z, n) {
    const g = this.ground;
    n.set(-(g(x + 0.4, z) - g(x - 0.4, z)) / 0.8, 1, -(g(x, z + 0.4) - g(x, z - 0.4)) / 0.8).normalize();
  }

  /** Lays every animal on the ground and poses it. `dark` (0..1) is how dark it is: the eyes only shine at night. */
  update(dt, dark = 0) {
    this.time += dt;
    const { m, q, q2, p, s, n, e } = this.t;
    this.rabbits.rabbits.forEach((r, i) => {
      if (r.mode === 'down') {
        this.rabbitMesh.setMatrixAt(i, this.zero);
        this.eyes.setMatrixAt(i * 2, this.zero);
        this.eyes.setMatrixAt(i * 2 + 1, this.zero);
        return;
      }
      const y = this.ground(r.x, r.z);
      this.slope(r.x, r.z, n);
      q.setFromUnitVectors(UP, n);
      q2.setFromAxisAngle(UP, r.yaw);
      q.multiply(q2);
      const moving = r.speed > 0.05;
      const hop = moving ? Math.abs(Math.sin(r.phase)) : 0;
      // Sat up and looking about, or stretched out on a hop or a run; upright and rigid when caught in a beam.
      const sit = r.mode === 'caught' ? 0.55 : r.mode === 'sit' ? 0.3 + 0.1 * Math.sin(this.time * 0.9 + r.phase * 3) : 0;
      const pitch = moving ? -0.25 + Math.cos(r.phase) * 0.3 : -sit;
      q2.setFromEuler(e.set(pitch, 0, 0));
      q.multiply(q2);
      p.set(r.x, y + hop * (r.mode === 'run' ? 0.22 : 0.12), r.z);
      s.setScalar(r.size);
      m.compose(p, q, s);
      this.rabbitMesh.setMatrixAt(i, m);
      // Two points of eyeshine on the head, where the head is for the pose; only while it is caught and it is dark.
      const glow = r.mode === 'caught' ? Math.min(1, dark * 1.6) : 0;
      for (const side of [-1, 1]) {
        if (!glow) {
          this.eyes.setMatrixAt(i * 2 + (side + 1) / 2, this.zero);
          continue;
        }
        const at = new THREE.Vector3(side * 0.04, 0.25, 0.19).applyMatrix4(m);
        this.eyes.setMatrixAt(i * 2 + (side + 1) / 2, new THREE.Matrix4().compose(at, q, s.clone().multiplyScalar(0.6 + glow * 0.8)));
      }
    });
    this.pheasants.birds.forEach((b, i) => {
      const hideWing = (k) => this.wings.setMatrixAt(i * 2 + k, this.zero);
      if (b.mode === 'gone') {
        this.pheasantMesh.setMatrixAt(i, this.zero);
        hideWing(0);
        hideWing(1);
        return;
      }
      const flying = b.mode === 'fly';
      const y = this.ground(b.x, b.z) + (flying ? b.y : 0);
      q.setFromAxisAngle(UP, b.yaw);
      // Climbing with the nose up, then levelling out into a glide; the tail is left trailing.
      const nose = flying ? -0.6 * (1 - b.u) + 0.15 * b.u : 0;
      q2.setFromEuler(e.set(nose, 0, 0));
      q.multiply(q2);
      p.set(b.x, y, b.z);
      s.setScalar(1);
      m.compose(p, q, s);
      this.pheasantMesh.setMatrixAt(i, m);
      for (const side of [-1, 1]) {
        const k = (side + 1) / 2;
        if (!flying) {
          hideWing(k);
          continue;
        }
        // The far wing is the near one turned half a circle about the body, so nothing is mirrored (a negative scale would turn it inside out).
        const wq = new THREE.Quaternion().setFromEuler(e.set(0, side < 0 ? Math.PI : 0, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.sin(b.phase) * 0.9)));
        const wm = m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(side * 0.08, 0.32, 0.02), wq, new THREE.Vector3(1, 1, 1)));
        this.wings.setMatrixAt(i * 2 + k, wm);
      }
    });
    for (const mesh of [this.rabbitMesh, this.eyes, this.pheasantMesh, this.wings]) mesh.instanceMatrix.needsUpdate = true;
  }
}
