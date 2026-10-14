// The barn cat's body (world/cat.js): a tabby with white paws, chest and muzzle, built in parts so it can be posed: a body, a head with
// ears, nose, eyes and whiskers, a tail of four segments, and four legs with paws. It walks, trots and runs on diagonal legs, sits up
// with its tail round its feet and its head turning, lies curled in a ring asleep, and stretches out in a jump. All procedural.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fur, stalk } from './wildlifeView.js';

const TABBY = 0x8b6a47;
const STRIPE = 0x3b2c1e;
const WHITE = 0xe9e4d6;
const PINK = 0xc98f86;

/** Darkens the faces of `geo` in bands across it, as a tabby's stripes run down its sides: a stripe wherever the wave across z is high. */
function stripes(geo, { freq = 70, around = 14, strength = 0.85, seed = 0 } = {}) {
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  const dark = new THREE.Color(STRIPE);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const wave = Math.sin(z * freq + Math.sin(y * around + seed) * 1.4 + seed);
    const k = Math.max(0, wave - 0.25) / 0.75 * strength * (y > -0.02 ? 1 : 0.35);
    col.setXYZ(i, col.getX(i) + (dark.r - col.getX(i)) * k, col.getY(i) + (dark.g - col.getY(i)) * k, col.getZ(i) + (dark.b - col.getZ(i)) * k);
  }
  return geo;
}

function part(parts) {
  return new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
}

/** A group at (x, y, z) holding one merged mesh built around its own origin. */
function limb(at, parts) {
  const g = new THREE.Group();
  g.position.set(...at);
  const m = part(parts);
  m.castShadow = true;
  g.add(m);
  return g;
}

function bodyParts() {
  // Dark bands round the barrel's back and sides, each a thin flattened shell a little proud of it (colour alone is too coarse to show a stripe).
  const bands = [];
  for (const z of [-0.17, -0.12, -0.07, -0.02, 0.03, 0.08, 0.13]) {
    const rc = 0.1 * Math.sqrt(Math.max(0.05, 1 - (z / 0.21) ** 2)) * 1.06;
    bands.push(fur(rc, 1, 0.78, 0.014 / rc, [0, 0.016, z], STRIPE, 40 + z * 100, 0.02, 1, 0.1));
  }
  return [
    ...bands,
    stripes(fur(0.1, 1, 0.95, 2.1, [0, 0, 0], TABBY, 1, 0.05, 2, 0.1), { seed: 1 }), // the barrel
    fur(0.085, 1, 0.7, 1.2, [0, -0.03, 0.12], WHITE, 2, 0.04, 2, 0.04), // white chest
    stripes(fur(0.095, 1, 1, 1.15, [0, 0.005, -0.15], TABBY, 3, 0.05, 2, 0.1), { seed: 3 }), // the haunches
    fur(0.07, 1.2, 0.55, 1.5, [0, -0.06, 0], WHITE, 4, 0.04, 1, 0.04), // pale belly
  ];
}

function headParts() {
  const parts = [
    fur(0.075, 1.05, 0.95, 1, [0, 0, 0], TABBY, 5, 0.03, 2, 0.08), // skull
    fur(0.04, 1.1, 0.8, 1, [0, -0.025, 0.065], WHITE, 6, 0.02, 1, 0.03), // muzzle
    fur(0.014, 1.3, 0.9, 0.9, [0, -0.005, 0.105], PINK, 7, 0, 1, 0), // nose
    fur(0.016, 1, 1.1, 0.5, [-0.038, 0.018, 0.062], 0x9cc24a, 8, 0, 1, 0), // eyes
    fur(0.016, 1, 1.1, 0.5, [0.038, 0.018, 0.062], 0x9cc24a, 9, 0, 1, 0),
    fur(0.007, 0.5, 2.2, 0.5, [-0.038, 0.018, 0.068], 0x111111, 10, 0, 1, 0), // slit pupils
    fur(0.007, 0.5, 2.2, 0.5, [0.038, 0.018, 0.068], 0x111111, 11, 0, 1, 0),
    fur(0.03, 1.2, 0.7, 0.7, [-0.068, -0.025, 0.03], TABBY, 12, 0.02, 1, 0.05), // cheek fluff
    fur(0.03, 1.2, 0.7, 0.7, [0.068, -0.025, 0.03], TABBY, 13, 0.02, 1, 0.05),
    fur(0.014, 1.6, 0.6, 0.7, [0, 0.062, 0.05], STRIPE, 14, 0, 1, 0), // the dark M on the brow
  ];
  for (const side of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.03, 0.065, 4);
    ear.scale(1, 1, 0.5);
    ear.rotateZ(side * -0.2);
    ear.translate(side * 0.048, 0.085, 0.005);
    const c = ear.toNonIndexed();
    const colours = new Float32Array(c.attributes.position.count * 3);
    const base = new THREE.Color(TABBY);
    for (let i = 0; i < c.attributes.position.count; i++) colours.set([base.r, base.g, base.b], i * 3);
    c.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    parts.push(c);
    parts.push(fur(0.012, 0.9, 1.5, 0.4, [side * 0.048, 0.08, 0.018], PINK, 15, 0, 1, 0)); // the inside of the ear
    for (const r of [-0.02, 0.0, 0.02]) parts.push(stalk(0.0015, 0.0008, [side * 0.03, -0.015, 0.085], [side * 0.11, -0.015 + r * 1.5, 0.095 + r], 0xf0ece0, 16 + r * 100, 3)); // whiskers
  }
  return parts;
}

function tailParts(i) {
  const r = 0.024 - i * 0.002;
  return [stripes(fur(r, 0.9, 0.9, 2.6, [0, 0, -0.045], i === 3 ? STRIPE : TABBY, 20 + i, 0.03, 1, 0.08), { seed: i * 2, freq: 110 })];
}

function legParts(front) {
  const parts = [stalk(front ? 0.026 : 0.033, 0.018, [0, 0, 0], [0, -0.14, 0], TABBY, 30, 6)];
  parts.push(fur(0.027, 1, 0.75, 1.4, [0, -0.152, 0.015], WHITE, 31, 0.02, 1, 0.03)); // the white paw
  if (!front) parts.push(fur(0.05, 0.9, 1.5, 1.3, [0, -0.045, 0], TABBY, 32, 0.04, 1, 0.08)); // the thigh
  return parts;
}

export class CatView {
  /** `ground(x, z)` is the drawn ground's height. */
  constructor(scene, cat, ground) {
    this.cat = cat;
    this.ground = ground;
    this.time = 0;
    this.root = new THREE.Group();
    this.root.name = 'cat';
    this.body = limb([0, 0.2, 0], bodyParts()); // the trunk, which every other part hangs off
    this.root.add(this.body);
    this.head = limb([0, 0.05, 0.2], headParts());
    this.body.add(this.head);
    this.legs = [
      limb([-0.05, -0.04, 0.14], legParts(true)), // front left
      limb([0.05, -0.04, 0.14], legParts(true)), // front right
      limb([-0.055, -0.01, -0.15], legParts(false)), // hind left
      limb([0.055, -0.01, -0.15], legParts(false)), // hind right
    ];
    for (const l of this.legs) this.body.add(l);
    // The tail: four segments each hung off the one before, so it can curve.
    this.tail = [];
    let parent = this.body;
    for (let i = 0; i < 4; i++) {
      const seg = limb(i === 0 ? [0, 0.01, -0.23] : [0, 0, -0.092], tailParts(i));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    // What E hits: an invisible box round the whole cat (it is a small thing to aim at).
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.85), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(0, 0.2, 0);
    this.root.add(this.proxy);
    scene.add(this.root);
    this.update(0, 0);
  }

  /** Lays the cat where it is and poses it. `dark` is unused for now (it is in the barn once it is dark). */
  update(dt) {
    this.time += dt;
    const c = this.cat;
    const t = this.time;
    this.root.visible = true;
    this.root.position.set(c.x, c.y, c.z);
    this.root.rotation.y = c.yaw;
    const pose = c.pose;
    const phase = c.phase;
    const ease = 1 - Math.exp(-dt * 12);
    const tgt = this.targets(pose, phase, c);
    this.pose ??= tgt; // the first frame goes straight to the pose
    const cur = this.pose;
    for (const k of Object.keys(tgt)) {
      const to = tgt[k];
      cur[k] = typeof to === 'number' ? (cur[k] === undefined ? to : cur[k] + (to - cur[k]) * (dt === 0 ? 1 : ease)) : to;
    }
    this.apply(cur, t);
  }

  /** The joint angles each pose wants this instant (they are eased toward in `update`). Angles in radians, heights in metres. */
  targets(pose, phase, c) {
    const gait = pose === 'run' ? 17 : pose === 'trot' ? 11 : 7.5;
    const swing = pose === 'run' ? 0.95 : pose === 'trot' ? 0.6 : 0.4;
    const s = Math.sin(phase * gait);
    const o = {
      bodyY: 0.2, bodyPitch: 0, bodyScaleY: 1, bodyRoll: 0, headPitch: 0, headYaw: 0, headX: 0, headY: 0.05, headZ: 0.2, headRoll: 0,
      fl: 0, fr: 0, hl: 0, hr: 0, legScale: 1, hindFold: 0, frontLong: 1,
      tail0: 0.7, tail1: -0.2, tail2: 0, tail3: 0, tailYaw: 0, tailYaw1: 0, tailYaw2: 0,
    };
    if (pose === 'walk' || pose === 'trot' || pose === 'run') {
      o.fl = s * swing;
      o.hr = s * swing;
      o.fr = -s * swing;
      o.hl = -s * swing;
      o.bodyY = 0.2 + Math.abs(Math.sin(phase * gait)) * (pose === 'run' ? 0.03 : 0.012);
      o.bodyPitch = pose === 'run' ? -0.12 * Math.cos(phase * gait) : 0;
      o.headPitch = pose === 'run' ? 0.15 : 0.05;
      o.headY = pose === 'run' ? 0.03 : 0.06;
      // Tail up and curled at the tip while it strolls, streaming out behind it when it runs.
      o.tail0 = pose === 'run' ? 0.15 : 0.9;
      o.tail1 = pose === 'run' ? 0 : 0.25;
      o.tail2 = pose === 'run' ? 0 : 0.25;
      o.tail3 = pose === 'run' ? 0 : 0.3;
      o.tailYaw = Math.sin(phase * gait * 0.5) * 0.15;
    } else if (pose === 'sit') {
      // Sat up on its haunches with the forelegs straight, tail round its feet, head turning to look about.
      o.bodyPitch = -0.95;
      o.bodyY = 0.23;
      o.fl = 0.95;
      o.fr = 0.95;
      o.frontLong = 1.35;
      o.hindFold = 1;
      o.hl = -1.2;
      o.hr = -1.2;
      o.headPitch = 0.1 + 0.1 * Math.sin(phase * 0.7);
      o.headYaw = Math.sin(phase * 0.43) * 0.7 * Math.max(0, Math.sin(phase * 0.17));
      o.headY = 0.06;
      o.headZ = 0.2;
      o.tail0 = 0.95;
      o.tail1 = 0;
      o.tail2 = 0;
      o.tail3 = 0.1;
      o.tailYaw = 0.9;
      o.tailYaw1 = 0.5;
      o.tailYaw2 = 0.4;
    } else if (pose === 'curl') {
      // Curled in a ring, nose tucked into its flank, tail laid round the front; breathing slowly.
      o.bodyY = 0.1;
      o.bodyScaleY = 0.8 + 0.035 * Math.sin(phase * 1.5);
      o.legScale = 0.0001;
      o.headX = 0.1;
      o.headY = -0.015;
      o.headZ = 0.12;
      o.headYaw = 2.4;
      o.headPitch = 0.5;
      o.headRoll = 0.3;
      o.bodyRoll = 0;
      o.tail0 = 0.1;
      o.tail1 = 0;
      o.tail2 = 0;
      o.tail3 = 0;
      o.tailYaw = 1.2;
      o.tailYaw1 = 0.55;
      o.tailYaw2 = 0.45;
    } else {
      // jump: stretched out, forelegs reaching and hind legs pushing
      const up = c.jump?.up !== false;
      o.bodyPitch = up ? -0.45 : 0.2;
      o.fl = o.fr = -1.0;
      o.hl = o.hr = 1.0;
      o.headPitch = up ? 0.3 : -0.1;
      o.tail0 = 0.4;
      o.tail1 = 0;
      o.tail2 = 0;
      o.tail3 = 0;
    }
    return o;
  }

  apply(o, t) {
    const body = this.body;
    body.position.y = o.bodyY;
    body.rotation.set(o.bodyPitch, 0, o.bodyRoll);
    body.scale.set(1, o.bodyScaleY, 1);
    const head = this.head;
    head.position.set(o.headX, o.headY, o.headZ);
    head.rotation.set(o.headPitch - (o.bodyPitch || 0), o.headYaw, o.headRoll);
    const [fl, fr, hl, hr] = this.legs;
    fl.rotation.x = o.fl;
    fr.rotation.x = o.fr;
    hl.rotation.x = o.hl;
    hr.rotation.x = o.hr;
    for (const l of this.legs) l.scale.setScalar(Math.max(0.0001, o.legScale));
    fl.scale.y *= o.frontLong;
    fr.scale.y *= o.frontLong;
    // Sat, the hind legs fold under the haunch and the thigh shows, not the lower leg.
    for (const l of [hl, hr]) l.scale.y = o.hindFold ? 0.55 : Math.max(0.0001, o.legScale);
    const wag = Math.sin(t * 1.3) * 0.12;
    this.tail[0].rotation.set(o.tail0, o.tailYaw + wag * 0.3, 0);
    this.tail[1].rotation.set(o.tail1, o.tailYaw1 + wag, 0);
    this.tail[2].rotation.set(o.tail2, o.tailYaw2 + wag * 1.5, 0);
    this.tail[3].rotation.set(o.tail3, wag * 1.2, 0);
  }

  dispose(scene) {
    scene.remove(this.root);
  }
}
