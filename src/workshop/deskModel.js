import * as THREE from 'three';
import { woodTexture, paintedTexture } from '../world/neighbourTextures.js';

// The farm desk and the stool at it, in the barn (layout.desk, #818): where the farm's paperwork is done, an old painted desk with two drawers, a pen pot, a mug, a
// ledger and a clip lamp, and a round-seated stool with rungs. Props only, built from a few dozen primitives. Local axes: +x is the front of the desk (where you
// sit), +y up, the desk's back at x -0.35; the stool is `STOOL_AT` in front of it. Real sizes: a top 0.75 m high, a stool seat 0.46 m.

export const DESK = { length: 1.5, depth: 0.7, height: 0.75 }; // the top's footprint along z and x, and its height
const steelPen = new THREE.MeshStandardMaterial({ color: 0x1d3f75, roughness: 0.4 });
export const STOOL_AT = { x: 0.75, z: 0.1 }; // the stool's middle from the desk's, in the desk's own axes

/** The desk with its stool and what lies on it, a group named `barn-desk`. */
export function buildDesk(random = Math.random) {
  const g = new THREE.Group();
  g.name = 'barn-desk';
  const paint = new THREE.MeshStandardMaterial({ map: paintedTexture(random, '#4d6a56'), roughness: 0.75 }); // a tired green
  const top = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 88, 58]), roughness: 0.8 });
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [96, 70, 46]), roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2d2e, roughness: 0.5, metalness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.4, metalness: 0.8 });
  const part = (geo, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const { length: L, depth: D, height: H } = DESK;
  // The top: a plank slab overhanging the carcase, with a rounded front edge strip.
  part(box(D + 0.05, 0.035, L + 0.06), top, 0, H - 0.0175, 0);
  part(new THREE.CylinderGeometry(0.0175, 0.0175, L + 0.04, 8).rotateX(Math.PI / 2), top, (D + 0.05) / 2, H - 0.0175, 0);
  // Two pedestals of drawers, a knee hole between, and a modesty back.
  for (const side of [-1, 1]) {
    const z = side * (L / 2 - 0.2);
    part(box(D - 0.06, H - 0.07, 0.4), paint, 0, (H - 0.07) / 2 + 0.01, z); // the carcase
    part(box(D - 0.02, 0.07, 0.42), timber, 0, 0.035, z); // a plinth
    for (const [y, h] of [[0.5, 0.2], [0.27, 0.22]]) {
      part(box(0.02, h, 0.36), timber, D / 2 - 0.03 + 0.012, y, z); // the drawer front, standing proud
      part(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 10).rotateZ(Math.PI / 2), brass, D / 2 - 0.03 + 0.03, y + h / 2 - 0.045, z); // a knob
      part(box(0.004, 0.035, 0.07), brass, D / 2 - 0.03 + 0.024, y + h / 2 - 0.095, z); // and its label holder
    }
  }
  part(box(0.02, H - 0.35, L - 0.8), paint, -D / 2 + 0.06, H / 2 + 0.1, 0); // the back panel
  // On the desk: a ledger with a ribbon, a pen pot, a mug, a few papers and a clip lamp on an arm.
  part(box(0.3, 0.03, 0.22), new THREE.MeshStandardMaterial({ color: 0x5a2a22, roughness: 0.85 }), 0.05, H + 0.015, -0.3, 0.2);
  part(box(0.28, 0.015, 0.2), new THREE.MeshStandardMaterial({ color: 0xe8e1c8, roughness: 0.9 }), 0.05, H + 0.0375, -0.3, 0.2); // its pages
  part(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12), iron, -0.15, H + 0.045, 0.45);
  for (const [dx, dz, tilt] of [[0.012, 0.005, 0.2], [-0.01, 0.01, -0.15], [0, -0.012, 0.05]]) {
    const pen = part(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6), steelPen, -0.15 + dx, H + 0.14, 0.45 + dz);
    pen.rotation.z = tilt;
  }
  part(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 14), new THREE.MeshStandardMaterial({ color: 0xd9d3c2, roughness: 0.4 }), 0.2, H + 0.0475, 0.5); // the mug
  part(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9d3c2, roughness: 0.4 }), 0.2, H + 0.0475, 0.54);
  part(box(0.21, 0.004, 0.3), new THREE.MeshStandardMaterial({ color: 0xece8da, roughness: 0.9 }), 0.12, H + 0.002 + 0.0175 * 0 + 0.002, 0.05, -0.3); // loose papers
  part(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 14), iron, -0.28, H + 0.0125, -0.55); // the lamp's weighted foot
  part(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 6), iron, -0.28, H + 0.25, -0.55);
  const shade = part(new THREE.ConeGeometry(0.09, 0.1, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c4a37, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), -0.2, H + 0.5, -0.55);
  shade.rotation.z = -0.5;
  // The stool: a round plank seat on four splayed legs with two rungs.
  const sx = STOOL_AT.x;
  const sz = STOOL_AT.z;
  part(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 18), top, sx, 0.4425, sz);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = part(new THREE.CylinderGeometry(0.016, 0.021, 0.44, 8), timber, sx + Math.cos(a) * 0.13, 0.22, sz + Math.sin(a) * 0.13);
    leg.rotation.set(-Math.sin(a) * 0.09, 0, Math.cos(a) * 0.09);
  }
  for (const y of [0.15, 0.27]) part(new THREE.TorusGeometry(y === 0.15 ? 0.15 : 0.135, 0.009, 6, 18).rotateX(Math.PI / 2), timber, sx, y, sz);
  return g;
}
