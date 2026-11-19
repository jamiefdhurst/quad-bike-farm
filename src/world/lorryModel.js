// A box-bodied rigid lorry for the A-road's traffic (#687): drawn only, never driven, so it has the four named wheels trafficView.js sets turning and a
// body built on the ground (y 0 is the road). A 7.5 tonne delivery lorry as the lane's farm traffic is not: a cab with a windscreen, grille, lamps and mirrors
// on a chassis with a fuel tank and a side underrun bar, and a ribbed box body 2.5 m wide and 2.9 m tall with rear doors, handles and marker lamps.
// +z is forward and +x the driver's left (the driver sits on the right, as in the farm's cabs).

import * as THREE from 'three';
import { canvasTexture, worldBox } from './outbuildingProps.js';

export const LORRY_GROUND_OFFSET = 0;
export const LORRY_R = 0.5; // m: the tyres' radius
export const LORRY_WHEELBASE = 4.2;
export const LORRY_TRACK = 2.0;
export const LORRY_LAYOUT = {
  spawnSag: 0,
  wheels: [
    { name: 'wheel_fl', x: LORRY_TRACK / 2, z: LORRY_WHEELBASE / 2 + 0.6, front: true, radius: LORRY_R },
    { name: 'wheel_fr', x: -LORRY_TRACK / 2, z: LORRY_WHEELBASE / 2 + 0.6, front: true, radius: LORRY_R },
    { name: 'wheel_rl', x: LORRY_TRACK / 2, z: -LORRY_WHEELBASE / 2 + 0.6, front: false, radius: LORRY_R },
    { name: 'wheel_rr', x: -LORRY_TRACK / 2, z: -LORRY_WHEELBASE / 2 + 0.6, front: false, radius: LORRY_R },
  ],
};
export const LORRY_SEAT = { x: -0.5, y: 1.9, z: 3.0 };

const paintTexture = (colour) => canvasTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect((i * 41) % w, (i * 67) % h, 2, 1);
  }
  const g = ctx.createLinearGradient(0, h * 0.75, 0, h); // road dirt along the foot
  g.addColorStop(0, 'rgba(70,60,40,0)');
  g.addColorStop(1, 'rgba(70,60,40,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
});

/** The box body's side: vertical ribs every 0.35 m in a slightly different tone, panel seams and a lower dirt band. */
const boxTexture = (colour) => canvasTexture(256, 128, (ctx, w, h) => {
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(x, 0, 2, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 2, 0, 1, h);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, h * 0.5 - 1, w, 2); // a horizontal seam
  const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
  g.addColorStop(0, 'rgba(60,52,38,0)');
  g.addColorStop(1, 'rgba(60,52,38,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
});

/** One wheel: a dark tyre with a tread rim and a steel hub, in a `spin` group the traffic view turns. Named `name`, standing at the origin. */
function wheel(name, side) {
  const g = new THREE.Group();
  g.name = name;
  const spin = new THREE.Group();
  spin.name = 'spin';
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(LORRY_R, LORRY_R, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0x1a1a1b, roughness: 0.95 }));
  tyre.rotation.z = Math.PI / 2;
  spin.add(tyre);
  for (const dx of [-0.152, 0.152]) { // the tread's shoulder rings
    const ring = new THREE.Mesh(new THREE.TorusGeometry(LORRY_R - 0.02, 0.025, 6, 20), new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 1 }));
    ring.rotation.y = Math.PI / 2;
    ring.position.x = dx;
    spin.add(ring);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.32, 14), new THREE.MeshStandardMaterial({ color: 0x9a9fa3, roughness: 0.45, metalness: 0.6 }));
  hub.rotation.z = Math.PI / 2;
  hub.position.x = side * 0.01;
  spin.add(hub);
  for (let i = 0; i < 8; i++) { // wheel nuts
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.5, metalness: 0.6 }));
    nut.rotation.z = Math.PI / 2;
    const a = (i / 8) * Math.PI * 2;
    nut.position.set(side * 0.17, Math.sin(a) * 0.18, Math.cos(a) * 0.18);
    spin.add(nut);
  }
  g.add(spin);
  return g;
}

/**
 * The lorry, standing on the ground at the origin: `bodyColor` is the box and the cab's paint. The wheels are named as the farm's vehicles' are, with
 * a `spin` child each, and set by trafficView.js from `LORRY_LAYOUT`; `userData.lensMaterial` and `tailMaterial` are the lamps it lights after dark.
 */
export function buildLorryModel({ bodyColor = 0xe8e8e4 } = {}) {
  const object = new THREE.Group();
  object.name = 'lorry';
  const colour = `#${new THREE.Color(bodyColor).getHexString()}`;
  const paint = new THREE.MeshStandardMaterial({ map: paintTexture(colour), roughness: 0.5, metalness: 0.15 });
  const box = new THREE.MeshStandardMaterial({ map: boxTexture(colour), roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2630, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.85 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xf4f0dc, roughness: 0.2, emissive: 0x000000 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x9c1410, roughness: 0.3, emissive: 0x000000 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xd88a14, roughness: 0.3 });
  const add = (geo, mat, x, y, z, parent = object) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const wz = (n) => LORRY_LAYOUT.wheels[n].z;
  // The chassis: two rails and cross-members, a fuel tank on the left, and a side underrun bar either side.
  for (const x of [-0.45, 0.45]) add(worldBox(0.12, 0.2, 7.4, 1), dark, x, 0.78, 0.2);
  add(worldBox(1.1, 0.15, 0.15, 1), dark, 0, 0.78, 2.3);
  add(worldBox(1.1, 0.15, 0.15, 1), dark, 0, 0.78, -1.2);
  const tank = add(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 14), steel, 1.0, 0.75, 0.9);
  tank.rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) {
    add(worldBox(0.05, 0.16, 3.4, 1), steel, sx * 1.1, 0.62, -0.9);
    for (const z of [-2.3, 0.3]) add(worldBox(0.06, 0.2, 0.06, 1), steel, sx * 1.07, 0.7, z);
  }
  // The cab: a box with a stepped roof, windscreen, side windows, doors with handles, a grille with a badge plate, bumper, lamps, mirrors and a step.
  const cab = new THREE.Group();
  cab.position.set(0, 0, 3.1);
  object.add(cab);
  add(worldBox(2.3, 1.2, 1.9, 1), paint, 0, 1.55, 0, cab); // the lower cab
  add(worldBox(2.3, 1.1, 1.5, 1), paint, 0, 2.7, -0.2, cab); // the upper cab and its roof
  add(worldBox(2.3, 0.1, 1.9, 1), paint, 0, 2.15, 0.0, cab);
  add(new THREE.BoxGeometry(2.06, 0.82, 0.04), glass, 0, 2.62, 0.56, cab); // windscreen
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.75, 1.0), glass, sx * 1.16, 2.62, -0.25, cab); // side windows
    add(new THREE.BoxGeometry(0.03, 1.05, 1.05), paint, sx * 1.16, 1.55, -0.1, cab); // a door panel proud of the wall
    add(new THREE.BoxGeometry(0.06, 0.04, 0.2), dark, sx * 1.2, 1.7, 0.3, cab); // its handle
    add(worldBox(0.1, 0.05, 0.45, 1), steel, sx * 1.12, 0.62, 0.25, cab); // the step
  }
  add(worldBox(2.3, 0.45, 0.15, 1), dark, 0, 1.0, 1.0, cab); // the grille and its slats
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(1.9, 0.03, 0.04), steel, 0, 0.85 + i * 0.09, 1.08, cab);
  add(worldBox(0.6, 0.18, 0.06, 1), steel, 0, 1.2, 1.04, cab); // the badge plate
  add(worldBox(2.4, 0.3, 0.3, 1), dark, 0, 0.55, 1.0, cab); // the bumper
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.4, 0.2, 0.06), lens, sx * 0.82, 1.35, 1.02, cab);
    add(new THREE.BoxGeometry(0.16, 0.1, 0.06), amber, sx * 1.07, 1.35, 1.02, cab);
    add(worldBox(0.05, 0.5, 0.2, 1), dark, sx * 1.35, 2.3, 0.6, cab); // a wing mirror on its arm
    add(worldBox(0.04, 0.32, 0.2, 1), steel, sx * 1.4, 2.3, 0.6, cab);
  }
  add(worldBox(0.5, 0.18, 0.2, 1), dark, 0, 3.32, 0.4, cab); // the sun visor
  // The box body: ribbed sides, a roof, a rear frame with a pair of doors, bars, handles and marker lamps.
  const body = new THREE.Group();
  body.position.set(0, 0, -1.3);
  object.add(body);
  // The body is a shell of thin panels (sides, roof, floor and a front wall), not a solid block: the rear doors would open on a hollow.
  for (const sx of [-1, 1]) add(worldBox(0.07, 2.9, 5.9, 1.2), box, sx * 1.215, 2.3, 0, body);
  add(worldBox(2.5, 0.07, 5.9, 1.2), box, 0, 3.715, 0, body);
  add(worldBox(2.4, 0.1, 5.9, 1.2), dark, 0, 0.9, 0, body);
  add(worldBox(2.4, 2.8, 0.07, 1.2), box, 0, 2.3, 2.915, body);
  add(worldBox(2.4, 2.8, 0.04, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.9 }), 0, 2.3, -2.9, body); // the dark inside seen between the doors
  add(worldBox(2.54, 0.1, 5.96, 1), paint, 0, 3.78, 0, body); // the roof cap
  for (const sx of [-1, 1]) add(worldBox(0.1, 0.16, 5.96, 1), dark, sx * 1.22, 0.9, 0, body); // the bottom rails
  for (const sx of [-1, 1]) { // the corner posts
    for (const z of [-2.95, 2.95]) add(worldBox(0.08, 2.9, 0.08, 1), steel, sx * 1.26, 2.3, z, body);
  }
  for (const sx of [-1, 0, 1]) { // the rear doors: two leaves, hinges, cam bars and handles
    if (sx === 0) continue;
    add(new THREE.BoxGeometry(1.2, 2.6, 0.05), box, sx * 0.62, 2.3, -2.97, body);
    add(new THREE.BoxGeometry(0.05, 2.5, 0.06), steel, sx * 0.9, 2.3, -3.0, body);
    add(new THREE.BoxGeometry(0.14, 0.04, 0.06), steel, sx * 0.2, 2.2, -3.0, body);
  }
  add(new THREE.BoxGeometry(2.1, 0.1, 0.1), dark, 0, 1.0, -3.0, body); // the rear underrun bar
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.22, 0.14, 0.06), tail, sx * 1.1, 1.3, -3.0, body);
    add(new THREE.BoxGeometry(0.1, 0.08, 0.08), amber, sx * 1.24, 3.6, 2.9, body); // marker lamps at the top corners
    const reg = add(new THREE.BoxGeometry(0.5, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: 0xe6c01a, roughness: 0.5 }), sx * 0.4, 0.9 - 0.0, -3.02, body);
    void reg;
  }
  object.userData.lensMaterial = lens;
  object.userData.tailMaterial = tail;
  // The wheels: set by the traffic view from LORRY_LAYOUT.
  for (const w of LORRY_LAYOUT.wheels) object.add(wheel(w.name, w.x > 0 ? 1 : -1));
  void wz;
  return object;
}
