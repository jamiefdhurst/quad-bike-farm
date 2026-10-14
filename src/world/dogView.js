// The farm dog's body (world/dog.js): a black and white border collie built in parts so it can be posed: a body with a white chest and
// ruff, a head with prick ears, a white blaze, eyes and a tongue, a tail of four segments with a white tip, and four legs with white
// socks. It walks, trots and gallops on diagonal legs, stands wagging, sits up, puts its nose down to sniff, sits upright on a rack, hops
// and barks. All procedural.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fur, stalk } from './wildlifeView.js';

const BLACK = 0x1b1b1e;
const WHITE = 0xece8de;
const NOSE = 0x0c0c0d;
const TONGUE = 0xd8707c;

const LEG = 0.37; // m from the hip's pivot to the sole
const HIP = -0.04; // the pivots' height in the body
const STAND_Y = LEG - HIP; // the body's height standing
const SIT_PITCH = -1.0; // sat up, the body tilts back this much

function part(parts) {
  return new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
}

/** A group at `at` holding one merged mesh built around its own origin. */
function limb(at, parts) {
  const g = new THREE.Group();
  g.position.set(...at);
  const m = part(parts);
  m.castShadow = true;
  g.add(m);
  return g;
}

function bodyParts() {
  return [
    fur(0.12, 0.92, 1, 2.0, [0, 0, 0], BLACK, 1, 0.05, 2, 0.1), // the barrel
    fur(0.115, 0.95, 1, 1.0, [0, 0.0, -0.19], BLACK, 2, 0.05, 2, 0.1), // the haunches
    fur(0.1, 0.9, 1.05, 1.15, [0, 0.005, 0.15], BLACK, 3, 0.05, 2, 0.1), // the shoulders
    fur(0.1, 0.85, 1.0, 1.15, [0, -0.045, 0.19], WHITE, 4, 0.04, 2, 0.05), // the white chest
    fur(0.075, 0.9, 0.55, 1.9, [0, -0.085, 0.0], WHITE, 5, 0.04, 2, 0.05), // the pale belly
    fur(0.085, 1.0, 1.15, 1.3, [0, 0.07, 0.26], BLACK, 6, 0.04, 2, 0.08), // the neck
    fur(0.1, 1.05, 1.0, 0.85, [0, 0.0, 0.27], WHITE, 7, 0.08, 2, 0.04), // the white ruff
  ];
}

function headParts() {
  const parts = [
    fur(0.075, 0.95, 0.95, 1.05, [0, 0, 0.03], BLACK, 8, 0.03, 2, 0.08), // the skull
    fur(0.04, 0.85, 0.8, 1.8, [0, -0.028, 0.125], BLACK, 9, 0.02, 1, 0.05), // the muzzle
    fur(0.016, 0.8, 1, 3.4, [0, 0.045, 0.085], WHITE, 10, 0.02, 1, 0.03), // the white blaze down the face
    fur(0.028, 0.9, 0.7, 1.7, [0, -0.052, 0.14], WHITE, 11, 0.02, 1, 0.03), // the white chin
    fur(0.017, 1.1, 0.9, 0.9, [0, -0.015, 0.21], NOSE, 12, 0, 1, 0), // the nose
    fur(0.014, 1, 1, 0.6, [-0.042, 0.025, 0.095], 0x7a4a1a, 13, 0, 1, 0), // amber eyes
    fur(0.014, 1, 1, 0.6, [0.042, 0.025, 0.095], 0x7a4a1a, 14, 0, 1, 0),
    fur(0.007, 1, 1, 0.6, [-0.043, 0.025, 0.104], 0x080808, 15, 0, 1, 0), // pupils
    fur(0.007, 1, 1, 0.6, [0.043, 0.025, 0.104], 0x080808, 16, 0, 1, 0),
    fur(0.034, 1.0, 0.7, 0.8, [-0.062, -0.02, 0.05], BLACK, 17, 0.02, 1, 0.05), // cheeks
    fur(0.034, 1.0, 0.7, 0.8, [0.062, -0.02, 0.05], BLACK, 18, 0.02, 1, 0.05),
  ];
  for (const side of [-1, 1]) {
    // Ears: up from the skull, the top third folding forward.
    parts.push(stalk(0.034, 0.016, [side * 0.045, 0.06, 0.02], [side * 0.07, 0.135, 0.03], BLACK, 19, 4));
    parts.push(stalk(0.017, 0.006, [side * 0.07, 0.135, 0.03], [side * 0.085, 0.14, 0.085], BLACK, 20, 4));
  }
  return parts;
}

function tongueParts() {
  return [fur(0.014, 1, 0.35, 2.6, [0, 0, 0.03], TONGUE, 21, 0, 1, 0.02)];
}

function tailParts(i) {
  const r = 0.04 - i * 0.003;
  return [fur(r, 0.95, 0.95, 2.0, [0, 0, -0.05], i === 3 ? WHITE : BLACK, 22 + i, 0.04, 1, 0.08)];
}

function legParts(front) {
  const parts = [
    stalk(front ? 0.036 : 0.042, 0.026, [0, 0, 0], [0, -0.2, 0], BLACK, 30, 6),
    stalk(0.026, 0.019, [0, -0.2, 0], [0, -LEG + 0.02, 0], WHITE, 31, 6), // the white sock
    fur(0.026, 1, 0.55, 1.7, [0, -LEG + 0.012, 0.02], WHITE, 32, 0.02, 1, 0.03), // the paw
  ];
  if (!front) parts.push(fur(0.06, 0.95, 1.5, 1.3, [0, -0.07, -0.01], BLACK, 33, 0.04, 1, 0.08)); // the thigh
  else parts.push(fur(0.03, 0.7, 1.4, 0.9, [0, -0.06, -0.02], BLACK, 34, 0.03, 1, 0.06)); // the shoulder blade's bulge
  return parts;
}

export class DogView {
  /** `ground(x, z)` is the drawn ground's height. */
  constructor(scene, dog, ground) {
    this.dog = dog;
    this.ground = ground;
    this.time = 0;
    this.barkT = 0;
    this.root = new THREE.Group();
    this.root.name = 'dog';
    this.body = limb([0, STAND_Y, 0], bodyParts()); // the trunk, which every other part hangs off
    this.root.add(this.body);
    this.head = limb([0, 0.1, 0.3], headParts());
    this.body.add(this.head);
    this.tongue = limb([0, -0.05, 0.17], tongueParts());
    this.head.add(this.tongue);
    this.legs = [
      limb([-0.065, HIP, 0.19], legParts(true)), // front left
      limb([0.065, HIP, 0.19], legParts(true)), // front right
      limb([-0.07, HIP, -0.2], legParts(false)), // hind left
      limb([0.07, HIP, -0.2], legParts(false)), // hind right
    ];
    for (const l of this.legs) this.body.add(l);
    this.tail = [];
    let parent = this.body;
    for (let i = 0; i < 4; i++) {
      const seg = limb(i === 0 ? [0, 0.03, -0.29] : [0, 0, -0.085], tailParts(i));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    scene.add(this.root);
    this.update(0);
  }

  /** A bark: her head goes up and back for an instant. */
  bark() {
    this.barkT = 0.22;
  }

  update(dt) {
    this.time += dt;
    this.barkT = Math.max(0, this.barkT - dt);
    const d = this.dog;
    this.root.position.set(d.x, d.y, d.z);
    this.root.rotation.y = d.yaw;
    const tgt = this.targets(d.pose, d.phase, d);
    this.pose ??= tgt; // the first frame goes straight to the pose
    const ease = 1 - Math.exp(-dt * 12);
    for (const k of Object.keys(tgt)) {
      const to = tgt[k];
      this.pose[k] = typeof to === 'number' ? (this.pose[k] === undefined ? to : this.pose[k] + (to - this.pose[k]) * (dt === 0 ? 1 : ease)) : to;
    }
    this.apply(this.pose, this.time);
  }

  /** The joint angles each pose wants this instant (they are eased toward in `update`). Angles in radians, heights in metres. */
  targets(pose, phase, dog) {
    const gait = pose === 'run' ? 13 : pose === 'trot' ? 9.5 : 6;
    const swing = pose === 'run' ? 0.95 : pose === 'trot' ? 0.6 : 0.42;
    const s = Math.sin(phase * gait);
    const o = {
      bodyY: STAND_Y, bodyPitch: 0, headPitch: 0, headYaw: 0, headY: 0.1, headZ: 0.3, headRoll: 0,
      fl: 0, fr: 0, hl: 0, hr: 0, frontLong: 1, hindLong: 1, tongue: 0,
      tail0: -0.3, tail1: 0.15, tail2: 0.15, tail3: 0.3, tailYaw: 0,
    };
    if (pose === 'walk' || pose === 'trot' || pose === 'run') {
      o.fl = s * swing;
      o.hr = s * swing;
      o.fr = -s * swing;
      o.hl = -s * swing;
      if (pose === 'run') {
        // A gallop's roll: front and back pairs reaching together, the spine arching.
        const g = Math.sin(phase * gait);
        o.fl = o.fr = g * swing;
        o.hl = o.hr = -g * swing * 0.9;
        o.bodyPitch = -0.1 * Math.cos(phase * gait);
        o.bodyY = STAND_Y - 0.03 + Math.abs(g) * 0.05;
        o.headPitch = 0.12;
        o.tongue = 1;
      } else {
        o.bodyY = STAND_Y + Math.abs(s) * (pose === 'trot' ? 0.012 : 0.006);
        o.headPitch = pose === 'trot' ? 0.05 : 0.18;
        o.tongue = pose === 'trot' ? 0.6 : 0;
      }
      o.headY = 0.1;
      // Tail low with a lift at the tip walking, streaming out behind her running.
      o.tail0 = pose === 'run' ? 0.05 : -0.3;
      o.tail1 = pose === 'run' ? 0 : 0.15;
      o.tail2 = pose === 'run' ? 0 : 0.15;
      o.tail3 = pose === 'run' ? 0 : 0.4;
      o.tailYaw = Math.sin(phase * gait * 0.5) * 0.1;
    } else if (pose === 'sit' || pose === 'ride') {
      // Sat up on her haunches, forelegs straight down, hind legs folded forward along the ground, head up and looking about.
      o.bodyPitch = SIT_PITCH;
      o.bodyY = 0.115 - 0.19 * Math.sin(SIT_PITCH); // the haunch's underside on the ground
      const shoulder = HIP * Math.cos(SIT_PITCH) - 0.19 * Math.sin(SIT_PITCH);
      o.frontLong = (o.bodyY + shoulder) / LEG;
      o.fl = o.fr = -SIT_PITCH;
      o.hl = o.hr = -Math.PI / 2 - SIT_PITCH;
      o.hindLong = 0.62;
      o.headPitch = 0.08 + 0.05 * Math.sin(phase * 0.8);
      o.headYaw = Math.sin(phase * 0.5) * 0.55 * Math.max(0, Math.sin(phase * 0.21));
      o.tail0 = -0.1;
      o.tail1 = 0;
      o.tail3 = 0;
      o.tailYaw = 0.5;
      if (pose === 'ride') {
        // On a moving quad the head goes into the wind, a tongue lolling.
        o.headYaw = Math.sin(phase * 0.6) * 0.25;
        o.tongue = 1;
        o.tail0 = 0.1;
      }
    } else if (pose === 'sniff') {
      o.bodyPitch = 0.12;
      o.headPitch = 1.0;
      o.headY = 0.04;
      o.headZ = 0.34;
      o.headYaw = Math.sin(phase * 1.7) * 0.25;
      o.fl = o.fr = -0.1;
      o.tail0 = 0;
      o.tailYaw = Math.sin(phase * 4) * 0.35;
    } else if (pose === 'jump') {
      const up = dog.jump?.up !== false;
      o.bodyPitch = up ? -0.45 : 0.15;
      o.fl = o.fr = -1.0;
      o.hl = o.hr = 1.0;
      o.headPitch = up ? 0.3 : -0.1;
      o.tail0 = 0.1;
      o.tongue = 1;
    } else {
      // Stood about: head turning to look, tail swinging slowly.
      o.headYaw = Math.sin(phase * 0.6) * 0.45 * Math.max(0, Math.sin(phase * 0.23));
      o.headPitch = 0.05;
      o.tailYaw = Math.sin(phase * 2.2) * 0.3;
    }
    if (this.barkT > 0) {
      const k = Math.sin((1 - this.barkT / 0.22) * Math.PI);
      o.headPitch -= 0.35 * k;
      o.headY += 0.02 * k;
      o.bodyPitch -= 0.06 * k;
      o.tongue = 0;
    }
    return o;
  }

  apply(o, t) {
    const body = this.body;
    body.position.y = o.bodyY;
    body.rotation.set(o.bodyPitch, 0, 0);
    const head = this.head;
    head.position.set(0, o.headY, o.headZ);
    head.rotation.set(o.headPitch - (o.bodyPitch || 0), o.headYaw, o.headRoll);
    this.tongue.scale.setScalar(Math.max(0.0001, o.tongue));
    const [fl, fr, hl, hr] = this.legs;
    fl.rotation.x = o.fl;
    fr.rotation.x = o.fr;
    hl.rotation.x = o.hl;
    hr.rotation.x = o.hr;
    for (const l of this.legs) l.scale.set(1, 1, 1);
    fl.scale.y = fr.scale.y = o.frontLong;
    hl.scale.y = hr.scale.y = o.hindLong;
    const wag = Math.sin(t * 1.1) * 0.08;
    this.tail[0].rotation.set(o.tail0, o.tailYaw + wag * 0.3, 0);
    this.tail[1].rotation.set(o.tail1, o.tailYaw * 0.6 + wag, 0);
    this.tail[2].rotation.set(o.tail2, o.tailYaw * 0.4 + wag * 1.4, 0);
    this.tail[3].rotation.set(o.tail3, wag * 1.2, 0);
  }

  dispose(scene) {
    scene.remove(this.root);
  }
}
