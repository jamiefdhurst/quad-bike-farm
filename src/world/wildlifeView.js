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

/** Moves a geometry's vertices by a deterministic lumpy noise, for fur and feathers (as the sheep's wool is). */
function lump(geo, amount) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + amount * (Math.sin(x * 61 + z * 43) * Math.sin(y * 53 + x * 29) + 0.6 * Math.sin(z * 79 - y * 37));
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A lumpy blob: an icosphere stretched, moved and roughened. */
function fur(r, sx, sy, sz, at, hex, seed, amount = 0.07, detail = 2, vary = 0.14) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  g.translate(at[0], at[1], at[2]);
  return paint(lump(g.toNonIndexed(), amount), hex, vary, seed);
}

/** A tapered stalk from (x, y0, z0) to (x, y1, z1): legs, ears, toes. */
function stalk(r0, r1, from, to, hex, seed, sides = 5) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const g = new THREE.CylinderGeometry(r1, r0, len, sides);
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
  g.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
  return paint(g.toNonIndexed(), hex, 0.06, seed);
}

/** A rabbit facing +z, haunches at the back, about 0.45 m long: brown agouti fur on the back, pale belly and cheeks, white scut. */
function rabbitGeometry() {
  const parts = [
    fur(0.12, 0.92, 0.95, 1.4, [0, 0.14, -0.02], 0x8a6d4b, 1, 0.08), // body
    fur(0.1, 0.8, 0.5, 1.2, [0, 0.07, 0.02], 0xd2c3a6, 2, 0.05), // pale belly
    fur(0.1, 1.05, 1, 1.05, [-0.075, 0.15, -0.13], 0x7d6244, 3, 0.08), // haunches
    fur(0.1, 1.05, 1, 1.05, [0.075, 0.15, -0.13], 0x7d6244, 4, 0.08),
    fur(0.085, 0.9, 0.9, 1.1, [0, 0.25, 0.14], 0x91765a, 5, 0.05), // head
    fur(0.04, 1, 0.8, 1, [-0.05, 0.225, 0.2], 0xcdbd9f, 6, 0.04, 1), // cheeks
    fur(0.04, 1, 0.8, 1, [0.05, 0.225, 0.2], 0xcdbd9f, 7, 0.04, 1),
    fur(0.022, 1.1, 0.8, 0.9, [0, 0.235, 0.255], 0xc9a08a, 8, 0, 1), // nose
    fur(0.016, 1, 1, 0.5, [-0.058, 0.275, 0.18], 0x15110e, 9, 0, 1), // eyes, dark and shiny
    fur(0.016, 1, 1, 0.5, [0.058, 0.275, 0.18], 0x15110e, 10, 0, 1),
    fur(0.05, 1, 1, 1, [0, 0.17, -0.25], 0xf1eee2, 11, 0.1, 1), // the white scut
  ];
  for (const x of [-0.045, 0.045]) {
    parts.push(fur(0.035, 0.8, 1.9, 1, [x, 0.075, 0.1], 0x86694a, 17, 0.05, 1)); // a short thick foreleg under the chest
    parts.push(fur(0.025, 0.9, 0.6, 1.8, [x, 0.012, 0.135], 0xc4b392, 18, 0.04, 1)); // the paw, pale, on the ground
  }
  for (const x of [-0.075, 0.075]) parts.push(fur(0.04, 0.55, 0.4, 1.9, [x, 0.03, -0.1], 0x6e5638, 14, 0.04, 1)); // long hind feet
  for (const x of [-1, 1]) {
    // Ears: long, tapered, tilted back and out, with a dark tip and a pink inside.
    const ear = fur(0.03, 0.6, 3.2, 0.35, [0, 0, 0], 0x7a5f40, 15, 0.03, 1);
    ear.rotateZ(x * -0.18);
    ear.rotateX(-0.25);
    ear.translate(x * 0.04, 0.36, 0.2);
    parts.push(ear);
    const tip = fur(0.022, 0.6, 1.2, 0.3, [0, 0, 0], 0x2a2018, 16, 0, 1);
    tip.rotateZ(x * -0.2);
    tip.rotateX(-0.3);
    tip.translate(x * 0.05, 0.435, 0.185);
    parts.push(tip);
  }
  return mergeGeometries(parts);
}

/** A cock pheasant facing +z, standing: about 0.4 m tall, copper breast spotted dark, green head with a white collar and a red face, a barred tail 0.5 m long. */
function pheasantGeometry() {
  const parts = [
    fur(0.14, 0.9, 1, 1.5, [0, 0.27, 0], 0xa55a26, 1, 0.07, 2, 0.22), // body, speckled by the vertex variation
    fur(0.1, 0.85, 0.7, 1.2, [0, 0.31, 0.1], 0xb4642c, 2, 0.06, 1, 0.18), // breast
    fur(0.08, 0.9, 0.8, 1.2, [0, 0.22, -0.16], 0x7d4a22, 3, 0.06, 1, 0.14), // rump
    fur(0.05, 1, 1.9, 1, [0, 0.42, 0.16], 0x1f4a3a, 4, 0.04, 1), // neck, glossy green
    fur(0.052, 1.05, 0.5, 1.05, [0, 0.38, 0.16], 0xf0f0e8, 5, 0.03, 1), // the white collar
    fur(0.052, 0.95, 0.95, 1.2, [0, 0.52, 0.2], 0x234f40, 6, 0.03, 1), // head
    fur(0.03, 1.2, 0.9, 0.9, [-0.04, 0.515, 0.215], 0xc43a2e, 7, 0, 1), // the red face patch round each eye
    fur(0.03, 1.2, 0.9, 0.9, [0.04, 0.515, 0.215], 0xc43a2e, 8, 0, 1),
    fur(0.012, 1, 1, 0.6, [-0.05, 0.525, 0.23], 0x12100d, 9, 0, 1), // eyes
    fur(0.012, 1, 1, 0.6, [0.05, 0.525, 0.23], 0x12100d, 10, 0, 1),
    fur(0.014, 0.8, 0.7, 2, [0, 0.505, 0.27], 0xd8cfa0, 11, 0, 1), // beak
    // The folded wings along the body, buff and brown, with a darker edge.
    fur(0.09, 0.4, 0.55, 1.7, [-0.115, 0.29, -0.01], 0x8d5e30, 12, 0.06, 1, 0.2),
    fur(0.09, 0.4, 0.55, 1.7, [0.115, 0.29, -0.01], 0x8d5e30, 13, 0.06, 1, 0.2),
  ];
  // A long barred tail: a flat tapering fan of three plates trailing back and down.
  for (const [x, yaw, c] of [[0, 0, 0x8a6a38], [-0.025, 0.1, 0x7a5c30], [0.025, -0.1, 0x7a5c30]]) {
    const t = fur(0.04, 0.45, 0.12, 7.5, [0, 0, 0], c, 14, 0.1, 1, 0.22);
    t.rotateX(0.12);
    t.rotateY(yaw);
    t.translate(x, 0.27, -0.46);
    parts.push(t);
  }
  for (const x of [-0.05, 0.05]) {
    parts.push(stalk(0.014, 0.011, [x, 0.16, 0.03], [x, 0.01, 0.03], 0x8c8570, 15)); // legs
    for (const dx of [-0.02, 0, 0.02]) parts.push(stalk(0.007, 0.005, [x, 0.012, 0.03], [x + dx, 0.004, 0.08], 0x8c8570, 16, 4)); // toes
  }
  return mergeGeometries(parts);
}

/** One wing, hinged at its root on the x axis and spread out along +x: a fan of overlapping flight feathers, banded brown and buff, under a pad of coverts. */
function wingGeometry() {
  const parts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1); // 0 the leading primaries, 1 the trailing secondaries
    const len = 0.5 - 0.14 * k + (i === 0 ? -0.04 : 0);
    const f = fur(0.04, len / 0.04 / 2, 0.1, 1.5, [len / 2, 0, 0], i % 2 ? 0x7a4a24 : 0xa8763a, 20 + i, 0.05, 1, 0.12);
    f.rotateY(-0.12 + k * 0.85); // fanned out, the trailing ones swept back
    f.rotateZ(-0.05 * k); // the trailing edge droops a little
    f.translate(0.04, -0.004 * i, 0.07 * (1 - k) - 0.03 * k);
    parts.push(f);
  }
  parts.push(fur(0.09, 1.7, 0.2, 1.2, [0.17, 0.016, 0.0], 0xb88a4a, 40, 0.05, 1, 0.14)); // the coverts over the feathers' roots
  parts.push(fur(0.05, 1.5, 0.3, 1, [0.1, 0.03, -0.01], 0x8d5e30, 41, 0.05, 1, 0.14));
  return mergeGeometries(parts);
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
    this.eyes = make(new THREE.SphereGeometry(0.02, 6, 4), nr * 2, 'rabbitEyes', true);
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
        const at = new THREE.Vector3(side * 0.05, 0.285, 0.225).applyMatrix4(m);
        this.eyes.setMatrixAt(i * 2 + (side + 1) / 2, new THREE.Matrix4().compose(at, q, s.clone().multiplyScalar(0.5 + glow * 0.7)));
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
