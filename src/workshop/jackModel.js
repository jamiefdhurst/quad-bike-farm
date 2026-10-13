import * as THREE from 'three';

// The trolley jack and axle stands that wait by the big bay in the barn (layout.jack, layout.axleStands). Props only, built from a few
// dozen primitives each; local axes: +x is the front of the jack (the lifting arm), +y up. Triangle count is small, as there are two stands.

const red = new THREE.MeshStandardMaterial({ color: 0xa81f19, roughness: 0.5, metalness: 0.35 });
const blue = new THREE.MeshStandardMaterial({ color: 0x1f4f8f, roughness: 0.5, metalness: 0.35 });
const steel = new THREE.MeshStandardMaterial({ color: 0x777b7f, roughness: 0.45, metalness: 0.8 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.2, metalness: 0.95 });
const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.85 });

function put(group, geo, mat, x, y, z, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

const cyl = (r, h, seg = 12) => new THREE.CylinderGeometry(r, r, h, seg);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

/**
 * A long-reach hydraulic trolley jack: two steel channels for a chassis, fixed wheels at the front and swivel castors at the back, the
 * red pump housing with its filler plug, a chrome ram, a lift arm with a rubber-padded saddle, and a handle with a grip. About 0.9 m long
 * without the handle, 0.3 m high.
 */
export function buildJack() {
  const g = new THREE.Group();
  g.name = 'trolley-jack';
  // Chassis: two side channels joined by cross plates, with a lip on the lower edge.
  for (const z of [-0.085, 0.085]) {
    put(g, box(0.78, 0.07, 0.022), red, 0, 0.1, z);
    put(g, box(0.78, 0.012, 0.045), red, 0, 0.068, z + Math.sign(z) * 0.012);
  }
  put(g, box(0.03, 0.06, 0.2), red, -0.36, 0.1, 0);
  put(g, box(0.03, 0.06, 0.2), red, 0.32, 0.1, 0);
  // Front wheels on an axle, rear castors on short forks.
  put(g, cyl(0.034, 0.03), black, 0.3, 0.034, 0.12, [Math.PI / 2, 0, 0]);
  put(g, cyl(0.034, 0.03), black, 0.3, 0.034, -0.12, [Math.PI / 2, 0, 0]);
  put(g, cyl(0.008, 0.28), steel, 0.3, 0.034, 0, [Math.PI / 2, 0, 0]);
  for (const z of [-0.115, 0.115]) {
    put(g, box(0.03, 0.05, 0.012), steel, -0.34, 0.075, z);
    put(g, cyl(0.026, 0.026), black, -0.34, 0.028, z, [Math.PI / 2, 0, 0]);
  }
  // The pump housing at the back: a red block with a filler plug and a steel handle socket.
  put(g, box(0.16, 0.13, 0.15), red, -0.22, 0.2, 0);
  put(g, cyl(0.014, 0.02, 8), black, -0.22, 0.275, 0.03);
  put(g, cyl(0.02, 0.07, 8), steel, -0.3, 0.2, 0, [0, 0, Math.PI / 2]);
  // The ram: a cylinder up from the housing with a chrome rod inside it, leaning towards the arm.
  const ram = new THREE.Group();
  put(ram, cyl(0.03, 0.15), red, 0, 0.075, 0);
  put(ram, cyl(0.016, 0.12), chrome, 0, 0.19, 0);
  ram.position.set(-0.04, 0.14, 0);
  ram.rotation.z = -0.35;
  g.add(ram);
  // The lift arm: a deep steel box section pivoting at the chassis and rising to the saddle, with a cross brace.
  const arm = new THREE.Group();
  put(arm, box(0.5, 0.07, 0.1), steel, 0.25, 0, 0);
  put(arm, box(0.4, 0.012, 0.11), red, 0.22, 0.04, 0);
  put(arm, cyl(0.012, 0.13, 8), steel, 0.02, 0, 0, [Math.PI / 2, 0, 0]);
  // Saddle: a rubber pad in a steel cup, with a raised lip round it.
  put(arm, cyl(0.05, 0.022, 16), steel, 0.5, 0.045, 0);
  put(arm, new THREE.TorusGeometry(0.047, 0.007, 6, 16), steel, 0.5, 0.058, 0, [Math.PI / 2, 0, 0]);
  put(arm, cyl(0.04, 0.012, 16), black, 0.5, 0.06, 0);
  arm.position.set(-0.08, 0.17, 0);
  arm.rotation.z = 0.12;
  g.add(arm);
  // The handle: a tube from the socket, angled up and back, with a rubber grip and a chrome cap.
  const handle = new THREE.Group();
  put(handle, cyl(0.011, 0.8, 8), steel, 0, 0.4, 0);
  put(handle, cyl(0.015, 0.16, 10), black, 0, 0.74, 0);
  put(handle, cyl(0.016, 0.012, 10), chrome, 0, 0.82, 0);
  handle.position.set(-0.33, 0.2, 0);
  handle.rotation.z = 1.05;
  g.add(handle);
  return g;
}

/**
 * A ratchet axle stand: a pyramid base of three flat legs, a square column with ratchet teeth up one face sliding in a red sleeve, a pawl
 * lever, and a saddle on top. About 0.4 m high, 0.28 m across.
 */
export function buildAxleStand() {
  const g = new THREE.Group();
  g.name = 'axle-stand';
  // Base: a hub ring with three legs splayed out, each a flat bar with a foot pad.
  put(g, cyl(0.05, 0.03, 12), blue, 0, 0.05, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const leg = new THREE.Group();
    put(leg, box(0.17, 0.025, 0.045), blue, 0.1, 0.03, 0, [0, 0, -0.18]);
    put(leg, box(0.04, 0.012, 0.06), black, 0.19, 0.006, 0);
    leg.rotation.y = a;
    g.add(leg);
  }
  // The sleeve over the bottom of the column, with a slot the teeth show through.
  put(g, box(0.07, 0.17, 0.07), blue, 0, 0.145, 0);
  put(g, box(0.02, 0.1, 0.012), black, 0, 0.15, 0.036);
  // The column, with ratchet teeth along its front face (one small wedge per notch).
  put(g, box(0.05, 0.3, 0.05), steel, 0, 0.3, 0);
  for (let i = 0; i < 7; i++) put(g, box(0.034, 0.012, 0.012), chrome, 0, 0.24 + i * 0.03, 0.03);
  // The pawl lever across the front of the sleeve, a bent rod with a ball end.
  put(g, cyl(0.005, 0.1, 6), steel, 0.04, 0.205, 0.042, [0, 0, Math.PI / 2 - 0.4]);
  put(g, new THREE.SphereGeometry(0.011, 8, 6), black, 0.08, 0.185, 0.042);
  // The saddle: a small steel cup with a V notch for the axle.
  put(g, box(0.1, 0.02, 0.08), steel, 0, 0.465, 0);
  put(g, box(0.1, 0.03, 0.012), steel, 0, 0.49, 0.034);
  put(g, box(0.1, 0.03, 0.012), steel, 0, 0.49, -0.034);
  return g;
}
