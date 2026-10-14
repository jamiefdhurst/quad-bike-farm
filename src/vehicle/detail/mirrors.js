import * as THREE from 'three';
import { cabMats, merge, mesh, rounded } from './parts.js';
import { sweepGeometry } from '../quadGeometry.js';

// Mirrors (TODO 340). The glass faces -Z (back, towards the driver) and the mount is at the group's origin. 'door' a housing on a
// short stalk off the door's front corner; 'arm' a flat rectangular glass on a bent rod (a Series' or a tractor's); 'wing' a
// round chrome mirror on a stalk on the front wing; 'interior' a rear-view mirror hanging from the top of the screen.

export const MIRROR_KINDS = ['door', 'arm', 'wing', 'interior'];

/** Where the glass sits from the mount, for a mirror of `kind`: [x, y, z] with `side` +1 out to +X. Pure, so the glass can be aimed. */
export function mirrorOffset(kind, side = 1) {
  switch (kind) {
    case 'door':
      return [side * 0.12, 0.04, -0.02];
    case 'arm':
      return [side * 0.26, 0.18, 0.02];
    case 'wing':
      return [0, 0.16, 0];
    case 'interior':
      return [0, -0.05, -0.02];
    default:
      throw new Error(`Unknown mirror: ${kind}`);
  }
}

/** A mirror of `kind` on the `side` (+1 the vehicle's left, +X). Returns a group with a 'mirrorGlass' mesh. */
export function buildMirror(kind = 'door', { side = 1, w = 0.16, h = 0.1, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = `mirror_${kind}`;
  const [ox, oy, oz] = mirrorOffset(kind, side);
  if (kind === 'door') {
    mesh(merge([rounded(0.04, 0.05, 0.05, 0.012).translate(side * 0.02, 0, 0), rounded(0.08, 0.02, 0.03, 0.008).translate(side * 0.07, 0.02, -0.01)]), mats.housing ?? m.plastic, g, 'mirrorStalk');
    mesh(rounded(w, h, 0.05, 0.02).translate(ox, oy, oz + 0.025), mats.housing ?? m.plastic, g, 'mirrorHousing');
    mesh(rounded(w - 0.014, h - 0.014, 0.004, 0.012).translate(ox, oy, oz - 0.001), m.mirror, g, 'mirrorGlass');
  } else if (kind === 'arm') {
    mesh(sweepGeometry([[0, 0, 0], [side * 0.12, 0.02, 0], [side * 0.22, 0.12, 0.02], [ox, oy - h / 2, oz]], 0.006, { radial: 6 }), m.steel, g, 'mirrorArm');
    mesh(rounded(w, h, 0.012, 0.004).translate(ox, oy, oz + 0.006), m.steel, g, 'mirrorHousing');
    mesh(new THREE.PlaneGeometry(w - 0.01, h - 0.01).rotateY(Math.PI).translate(ox, oy, oz - 0.001), m.mirror, g, 'mirrorGlass');
  } else if (kind === 'wing') {
    mesh(sweepGeometry([[0, 0, 0], [0, oy * 0.6, 0.02], [0, oy - 0.03, 0.01]], 0.005, { radial: 6 }), m.chrome, g, 'mirrorArm');
    mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.5).translate(ox, oy, oz + 0.001), m.chrome, g, 'mirrorHousing');
    mesh(new THREE.CircleGeometry(0.046, 20).rotateY(Math.PI).translate(ox, oy, oz), m.mirror, g, 'mirrorGlass');
  } else if (kind === 'interior') {
    mesh(merge([rounded(0.03, 0.012, 0.03, 0.005), new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6).translate(0, -0.02, -0.01)]), m.plastic, g, 'mirrorStalk');
    mesh(rounded(0.2, 0.06, 0.02, 0.012).translate(ox, oy, oz + 0.008), m.plastic, g, 'mirrorHousing');
    mesh(rounded(0.19, 0.05, 0.002, 0.01).translate(ox, oy, oz - 0.002), m.mirror, g, 'mirrorGlass');
  } else {
    throw new Error(`Unknown mirror: ${kind}`);
  }
  return g;
}
