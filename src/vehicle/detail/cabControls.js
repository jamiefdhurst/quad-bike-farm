import * as THREE from 'three';
import { cabMats, merge, mesh, rounded, keepGroup } from './parts.js';
import { bootGeometry, lathe, sweepGeometry } from '../quadGeometry.js';

// Levers and pedals for the cabs (TODO 340): gear knobs, a lever in its gaiter, a transfer lever, handbrakes, pedals. A lever's
// pivot is its group's origin and it stands up +Y; a pedal hangs from its pivot down -Y with its pad facing +Z (towards the
// driver's foot is -Z... the pad faces back, -Z). The vehicle names them (gearLever, parkBrakeLever, clutchPedal) so the posers find them.

export const KNOB_KINDS = ['ball', 'pear', 'mushroom', 'tHandle', 'billet'];

/** A gear knob of `kind`, its bottom at y = 0 where it screws on. About `size` across. */
export function knobGeometry(kind = 'ball', size = 0.045) {
  const r = size / 2;
  switch (kind) {
    case 'ball':
      return new THREE.SphereGeometry(r, 14, 10).translate(0, r * 0.9, 0);
    case 'pear':
      return lathe([[0.004, 0], [r * 0.5, 0.004], [r * 0.7, r * 0.8], [r, r * 1.7], [r * 0.85, r * 2.4], [r * 0.4, r * 2.75], [0.001, r * 2.8]], 16);
    case 'mushroom':
      return lathe([[r * 0.35, 0], [r * 0.35, r * 0.9], [r, r * 1.1], [r * 0.95, r * 1.5], [r * 0.5, r * 1.75], [0.001, r * 1.8]], 16);
    case 'tHandle':
      return merge([new THREE.CylinderGeometry(r * 0.3, r * 0.35, r * 1.2, 10).translate(0, r * 0.6, 0), rounded(size * 1.8, r * 0.7, r * 0.7, r * 0.3).translate(0, r * 1.35, 0)]);
    case 'billet':
      return merge([new THREE.CylinderGeometry(r * 0.85, r * 0.75, r * 2.6, 16).translate(0, r * 1.3, 0), new THREE.CylinderGeometry(r * 0.85, r * 0.85, r * 0.2, 16).translate(0, r * 2.7, 0)]);
    default:
      throw new Error(`Unknown knob: ${kind}`);
  }
}

/**
 * A floor lever: a bent steel rod `length` long (cranked back towards the driver by `crank` metres at the top), a knob on top, and a
 * rubber gaiter round its foot (a ribbed boot, `gaiter` metres tall; 0 for none) with a trim ring. Returns { group, gaiter }: the
 * group swings (name it and pose it), the gaiter stays on the floor (add it beside the pivot).
 */
export function buildLever({ length = 0.26, crank = 0, knob = 'ball', knobSize = 0.045, gaiter = 0.06, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const group = keepGroup();
  const top = [0, length, -crank];
  const rod = sweepGeometry(crank ? [[0, 0, 0], [0, length * 0.6, 0], [0, length * 0.85, -crank * 0.6], top] : [[0, 0, 0], top], 0.0075, { radial: 6 });
  mesh(rod, mats.rod ?? m.steel, group, 'leverRod');
  const k = knobGeometry(knob, knobSize);
  k.translate(...top);
  mesh(k, mats.knob ?? (knob === 'billet' ? m.alloy : m.plastic), group, 'leverKnob');
  let boot = null;
  if (gaiter) {
    boot = new THREE.Group();
    boot.name = 'gaiter';
    mesh(bootGeometry(gaiter, 0.055, 0.014, 4), m.rubber, boot, 'gaiterBoot');
    mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 20).rotateX(Math.PI / 2), mats.trim ?? m.plastic, boot, 'gaiterRing');
  }
  return { group, gaiter: boot };
}

/**
 * A handbrake, pivoting at its group's origin, the lever running forward (+Z) and up, ready to be swung up by its poser about X.
 * 'centre' (a car's, between the seats: a grip and a release button at the end), 'pistol' (a Series': a T-grip on a rod under
 * the dash), 'ratchet' (a tractor's or UTV's: an upright lever over a toothed quadrant, with a pawl rod).
 */
export function buildHandbrake(kind = 'centre', { mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const group = keepGroup();
  if (kind === 'centre') {
    mesh(rounded(0.034, 0.03, 0.26, 0.012).translate(0, 0, 0.13), mats.lever ?? m.plastic, group, 'handbrakeLever');
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 10).rotateX(Math.PI / 2).translate(0, 0.004, 0.265), m.greyPlastic, group, 'handbrakeButton');
  } else if (kind === 'pistol') {
    mesh(sweepGeometry([[0, 0, 0], [0, 0, 0.22]], 0.007, { radial: 6 }), m.steel, group, 'handbrakeRod');
    mesh(merge([rounded(0.035, 0.09, 0.03, 0.012).translate(0, -0.03, 0.235), rounded(0.03, 0.02, 0.05, 0.008).translate(0, 0.012, 0.23)]), mats.lever ?? m.bakelite, group, 'handbrakeGrip');
  } else if (kind === 'ratchet') {
    mesh(sweepGeometry([[0, 0, 0], [0, 0.32, 0.05]], 0.011, { radial: 6 }), mats.lever ?? m.paintedSteel, group, 'handbrakeLever');
    mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 10).translate(0, 0.36, 0.055), m.rubber, group, 'handbrakeGrip');
    mesh(sweepGeometry([[0.014, 0.33, 0.06], [0.014, 0.05, 0.02]], 0.003, { radial: 4 }), m.steel, group, 'handbrakePawlRod');
    // The quadrant stays on the floor: the caller adds it beside the pivot (userData.quadrant).
    const q = new THREE.Group();
    q.name = 'handbrakeQuadrant';
    const teeth = [new THREE.CylinderGeometry(0.11, 0.11, 0.006, 24, 1, false, -0.2, 1.1).rotateZ(Math.PI / 2).translate(-0.016, 0, 0)];
    for (let i = 0; i < 9; i++) {
      const a = -0.2 + (i / 8) * 1.1;
      teeth.push(rounded(0.006, 0.012, 0.008, 0.001).translate(-0.016, Math.cos(a) * 0.115, Math.sin(a) * 0.115));
    }
    mesh(merge(teeth), m.steel, q, 'quadrantTeeth');
    group.userData.quadrant = q;
  } else {
    throw new Error(`Unknown handbrake: ${kind}`);
  }
  return group;
}

/**
 * A pedal hanging from its pivot (the group's origin): an arm down `drop` metres and a pad facing back (-Z) at its foot. 'pad' a
 * rubber pad with ribs (clutch and brake), 'organ' a long throttle hinged at its foot, 'tractor' a steel pad with a cast grid.
 */
export function buildPedal(kind = 'pad', { drop = 0.22, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const group = keepGroup();
  if (kind === 'organ') {
    // A throttle hinged at the floor: the pad stands up from its hinge, leaning forward.
    mesh(rounded(0.05, 0.16, 0.012, 0.005).translate(0, 0.08, 0).rotateX(0.35), m.rubber, group, 'pedalPad');
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8).rotateZ(Math.PI / 2), m.steel, group, 'pedalHinge');
    return group;
  }
  mesh(sweepGeometry([[0, 0, 0], [0, -drop * 0.7, -0.02], [0, -drop, -0.05]], 0.007, { radial: 6 }), m.steel, group, 'pedalArm');
  if (kind === 'tractor') {
    const parts = [rounded(0.08, 0.06, 0.012, 0.004)];
    for (let i = -1; i <= 1; i++) parts.push(rounded(0.07, 0.004, 0.006, 0.001).translate(0, i * 0.018, -0.008));
    const pedal = merge(parts);
    pedal.translate(0, -drop, -0.056);
    mesh(pedal, mats.pad ?? m.steel, group, 'pedalPad');
  } else {
    const parts = [rounded(0.06, 0.06, 0.014, 0.006)];
    for (let i = -2; i <= 2; i++) parts.push(rounded(0.05, 0.004, 0.004, 0.001).translate(0, i * 0.011, -0.008));
    const pedal = merge(parts);
    pedal.translate(0, -drop, -0.058);
    mesh(pedal, mats.pad ?? m.rubber, group, 'pedalPad');
  }
  return group;
}

/** Where the pedals go across the footwell, from the driver's left: `n` pedals `spacing` apart, centred on `x`. */
export function pedalLayout(n, { x = 0, spacing = 0.08 } = {}) {
  return Array.from({ length: n }, (_, i) => x + (i - (n - 1) / 2) * spacing);
}
