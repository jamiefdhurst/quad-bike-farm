// The site cabin by the pit's screening plant: a 3.6 by 2.4 m portable steel office on skids and blocks, with ribbed cladding, a door standing open
// on its steps, two barred windows (one with its shutter swung back), a roof that overhangs, a gutter and downpipe, an air-con box and the odds and
// ends left outside. Built in a local frame with its length along x, the door side towards +z, standing on y = 0.

import * as THREE from 'three';
import { Parts, placement } from './parts.js';
import { cladding, galvanisedTexture, paintedSteelTexture, rustTexture, plateTexture } from './quarryTextures.js';
import { woodTexture } from './neighbourTextures.js';

export const CABIN = { length: 3.6, width: 2.4, floor: 0.47, top: 2.65 };

/** The cabin's materials, made once. */
export function cabinMaterials(random) {
  const lit = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const m = {
    clad: lit({ map: cladding(random), roughness: 0.65, metalness: 0.15 }),
    trim: lit({ map: paintedSteelTexture(random, '#5d6a5e', 0.8), roughness: 0.7, metalness: 0.2 }),
    rust: lit({ map: rustTexture(random, '#6b4a38'), roughness: 0.9 }),
    dark: lit({ color: 0x242422, roughness: 0.9 }),
    bar: lit({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.6 }),
    concrete: lit({ color: 0x8c8b84, roughness: 1 }),
    wood: lit({ map: woodTexture(random, [118, 98, 74]), roughness: 0.95 }),
    plastic: lit({ color: 0xd2d2cc, roughness: 0.6 }),
    bucket: lit({ color: 0x2f5d8a, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x4a5c60, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }),
    sign: lit({ map: plateTexture(['SITE OFFICE', 'ALL VISITORS', 'REPORT HERE'], { bg: '#e8e4d4', fg: '#1d3a2a', w: 256, h: 160, size: 30 }), roughness: 0.5 }),
  };
  for (const [k, v] of Object.entries(m)) v.name = k;
  return m;
}

/** Cuts a wall of boxes round its openings: `openings` is a list of [from, to, bottom, top] along the wall, `box(from, to, bottom, top)` makes one. */
export function cutWall(len, y0, y1, openings, box) {
  const sorted = [...openings].sort((a, b) => a[0] - b[0]);
  let at = -len / 2;
  for (const [a, b, ya, yb] of sorted) {
    if (a > at) box(at, a, y0, y1);
    if (ya > y0) box(a, b, y0, ya);
    if (yb < y1) box(a, b, yb, y1);
    at = b;
  }
  if (at < len / 2) box(at, len / 2, y0, y1);
}

/** A window opening's parts in a frame where the opening is centred on the origin, the wall plane is z = 0 and outside is +z. */
function buildWindow(m, w, h, { shutter = false } = {}) {
  const p = new Parts();
  const jx = w / 2 + 0.02;
  const jy = h / 2 + 0.02;
  // The frame, a few millimetres into the opening, every bar's outer and inner face a different depth so none shares a plane with another.
  const zb = (bw, bh, x, y, outer, inner) => p.box(m.trim, bw, bh, outer - inner, x, y, (outer + inner) / 2, 0, 0.6);
  zb(0.05, h + 0.1, -jx, 0, 0.038, -0.004); // the jambs
  zb(0.05, h + 0.1, jx, 0, 0.034, -0.008);
  zb(w + 0.12, 0.05, 0, jy, 0.03, -0.012); // the head
  zb(w + 0.12, 0.04, 0, -h / 2 - 0.015, 0.046, -0.016); // the sill
  p.box(m.trim, w + 0.16, 0.03, 0.12, 0, -h / 2 - 0.05, 0.06, 0, 0.6); // its ledge
  p.box(m.trim, 0.03, h, 0.03, 0, 0, -0.03, 0, 0.6); // the mullion
  p.add(m.glass, new THREE.PlaneGeometry(w, h), 0, 0, -0.045);
  // The anti-vandal bars: flats top, middle and bottom with rods through them, standing off the frame on short legs.
  const barZ = 0.085;
  for (const [y, t] of [[jy - 0.06, 0.008], [0, 0.008], [-jy + 0.06, 0.008]]) p.box(m.bar, w + 0.12, 0.03, t, 0, y, barZ, 0, 0.5);
  const rods = Math.round(w / 0.11);
  for (let i = 0; i <= rods; i++) p.rod(m.bar, [-w / 2 - 0.02 + (i * (w + 0.04)) / rods, -jy - 0.01, barZ], [-w / 2 - 0.02 + (i * (w + 0.04)) / rods, jy + 0.01, barZ], 0.011, 0.011, 5);
  for (const x of [-jx, jx]) for (const y of [jy - 0.06, -jy + 0.06]) p.box(m.dark, 0.03, 0.03, 0.06, x, y, 0.055);
  if (shutter) {
    // The steel shutter, hinged on one jamb and swung right back against the wall.
    const sp = new Parts();
    const sw = w / 2 + 0.06;
    sp.box(m.trim, sw, h + 0.12, 0.03, sw / 2, 0, 0, 0, 0.6);
    sp.box(m.dark, sw - 0.1, 0.05, 0.036, sw / 2, 0.15, 0);
    sp.box(m.dark, sw - 0.1, 0.05, 0.036, sw / 2, -0.15, 0);
    sp.box(m.dark, 0.06, 0.12, 0.05, sw - 0.1, 0, 0);
    for (const y of [-h / 2, 0, h / 2]) sp.rod(m.dark, [0, y - 0.05, 0.0], [0, y + 0.05, 0.0], 0.018);
    p.merge(sp, placement(jx + 0.07, 0, 0.1, -0.3));
  }
  return p;
}

/** The door leaf's parts in its own frame: the hinge's axis up the y axis through the origin, the leaf running along +x, its face towards +z. */
function buildDoor(m) {
  const p = new Parts();
  const w = 0.88;
  const h = 1.98;
  p.box(m.clad, w, h, 0.045, w / 2, h / 2, 0, 0, 0.6, CABIN.top);
  p.box(m.trim, w - 0.08, 0.05, 0.05, w / 2, 1.5, 0.008, 0, 0.6); // a rail across it
  p.box(m.trim, w - 0.08, 0.05, 0.052, w / 2, 0.55, 0.009, 0, 0.6);
  p.box(m.dark, w - 0.04, 0.22, 0.056, w / 2, 0.14, 0.0); // the kick plate
  p.box(m.trim, 0.05, h - 0.1, 0.048, 0.04, h / 2, 0.006, 0, 0.6); // the stiles
  p.box(m.trim, 0.05, h - 0.1, 0.05, w - 0.04, h / 2, 0.007, 0, 0.6);
  p.add(m.sign, new THREE.PlaneGeometry(0.34, 0.2125), w / 2, 1.78, 0.0275 + 0.012);
  // The lever handle and lock plate on the free edge, a hasp swung back and a padlock hung from it.
  p.box(m.dark, 0.05, 0.2, 0.012, w - 0.1, 1.0, 0.035);
  p.rod(m.bar, [w - 0.1, 1.0, 0.04], [w - 0.1, 1.0, 0.085], 0.012);
  p.rod(m.bar, [w - 0.1, 1.0, 0.085], [w - 0.28, 1.0, 0.085], 0.012);
  p.box(m.rust, 0.06, 0.2, 0.014, w - 0.035, 1.3, 0.036);
  p.box(m.bar, 0.065, 0.08, 0.035, w - 0.035, 1.12, 0.065);
  p.add(m.bar, new THREE.TorusGeometry(0.022, 0.006, 5, 10, Math.PI), w - 0.035, 1.17, 0.065, 0, 0, 0);
  for (const y of [0.3, 1.0, 1.7]) {
    p.rod(m.dark, [0, y - 0.07, 0.0], [0, y + 0.07, 0.0], 0.022);
    p.box(m.dark, 0.14, 0.09, 0.008, 0.07, y, 0.026);
  }
  return p;
}

/** The skid-and-block base, the cladding walls round their openings, and everything fixed to them. */
function buildShell(p, m) {
  const { length: L, width: W, floor: FY, top } = CABIN;
  // Blocks, skids and the base frame.
  for (const x of [-1.4, 1.4]) for (const z of [-0.95, 0.95]) p.box(m.concrete, 0.45, 0.4, 0.22, x, 0.05, z, 0, 0.5);
  for (const z of [-0.95, 0.95]) p.box(m.rust, L + 0.2, 0.12, 0.12, 0, 0.31, z, 0, 1);
  p.box(m.trim, L, 0.1, W, 0, FY - 0.05, 0, 0, 1);
  p.box(m.concrete, L - 0.2, 0.03, W - 0.2, 0, FY + 0.015, 0);
  p.box(m.plastic, L - 0.2, 0.02, W - 0.2, 0, top - 0.01, 0);
  // The long walls, with the door and the front window in one and the back window in the other.
  const doorX = [0.55, 1.45];
  const front = [[doorX[0], doorX[1], FY, 2.5], [-1.45, -0.35, 1.35, 2.2]];
  const back = [[-0.5, 0.6, 1.35, 2.2]];
  cutWall(L, FY, top, front, (a, b, ya, yb) => p.wall(m.clad, b - a, yb - ya, 0.07, (a + b) / 2, (ya + yb) / 2, W / 2 - 0.035, 0.6, top));
  cutWall(L, FY, top, back, (a, b, ya, yb) => p.wall(m.clad, b - a, yb - ya, 0.07, (a + b) / 2, (ya + yb) / 2, -W / 2 + 0.035, 0.6, top));
  // The end walls, between them: the right one with a window, the left solid.
  const endLen = W - 0.14;
  cutWall(endLen, FY, top, [[-0.5, 0.3, 1.35, 2.2]], (a, b, ya, yb) => p.wall(m.clad, 0.07, yb - ya, b - a, L / 2 - 0.035, (ya + yb) / 2, (a + b) / 2, 0.6, top, true));
  p.wall(m.clad, 0.07, top - FY, endLen, -L / 2 + 0.035, (FY + top) / 2, 0, 0.6, top, true);
  // Corner posts a centimetre proud, and the roof: a slab with fascias, overhanging all round.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(m.trim, 0.1, top - FY, 0.1, sx * (L / 2 - 0.04), (FY + top) / 2, sz * (W / 2 - 0.04), 0, 0.6);
  p.box(m.rust, L + 0.24, 0.06, W + 0.24, 0, top + 0.03, 0, 0, 1.2);
  for (const s of [-1, 1]) {
    p.box(m.trim, L + 0.3, 0.12, 0.03, 0, top + 0.01, s * (W / 2 + 0.135), 0, 0.6);
    p.box(m.trim, 0.03, 0.12, W + 0.24, s * (L / 2 + 0.135), top + 0.01, 0, 0, 0.6);
  }
  // The gutter along the front and the downpipe at its end, clipped to the wall; a vent and a flue on the roof.
  p.rod(m.bar, [-L / 2 - 0.12, top - 0.075, W / 2 + 0.17], [L / 2 + 0.12, top - 0.075, W / 2 + 0.17], 0.045, 0.045, 8);
  for (const x of [-1.5, 0, 1.5]) p.box(m.dark, 0.02, 0.03, 0.09, x, top - 0.06, W / 2 + 0.12);
  p.rod(m.bar, [-L / 2 + 0.1, top - 0.1, W / 2 + 0.17], [-L / 2 + 0.1, 0.25, W / 2 + 0.17], 0.032, 0.032, 8);
  for (const y of [0.6, 1.3, 2.0]) p.box(m.dark, 0.06, 0.04, 0.1, -L / 2 + 0.1, y, W / 2 + 0.13);
  p.rod(m.bar, [-L / 2 + 0.1, 0.25, W / 2 + 0.17], [-L / 2 + 0.1, 0.1, W / 2 + 0.3], 0.032, 0.032, 8);
  p.box(m.trim, 0.5, 0.12, 0.4, -0.9, top + 0.12, -0.5, 0, 0.6);
  p.box(m.dark, 0.54, 0.03, 0.44, -0.9, top + 0.195, -0.5);
  p.rod(m.dark, [1.1, top + 0.06, -0.5], [1.1, top + 0.65, -0.5], 0.06);
  p.add(m.dark, new THREE.ConeGeometry(0.1, 0.1, 8), 1.1, top + 0.7, -0.5);
  // The air-con box on the left end, a meter box and a conduit on the back, and the notices by the door.
  p.box(m.plastic, 0.3, 0.5, 0.75, -L / 2 - 0.15, 1.65, 0.1, 0, 0.5);
  for (let i = 0; i < 6; i++) p.box(m.dark, 0.012, 0.03, 0.55, -L / 2 - 0.306, 1.5 + i * 0.07, 0.1);
  p.rod(m.dark, [-L / 2, 1.2, 0.4], [-L / 2 - 0.15, 1.35, 0.4], 0.02);
  p.box(m.plastic, 0.3, 0.4, 0.14, 1.0, 1.6, -W / 2 - 0.07, 0, 0.5);
  p.rod(m.dark, [1.0, 1.4, -W / 2 - 0.07], [1.0, FY + 0.05, -W / 2 - 0.07], 0.02);
  p.box(m.trim, 0.06, 2.04, 0.055, 0.515, (FY + 2.5) / 2 + 0.02, W / 2 + 0.0225, 0, 0.6); // the door's frame
  p.box(m.trim, 0.06, 2.04, 0.05, 1.485, (FY + 2.5) / 2 + 0.02, W / 2 + 0.02, 0, 0.6);
  p.box(m.trim, 1.0, 0.06, 0.065, 1.0, 2.535, W / 2 + 0.0225, 0, 0.6);
  p.add(m.sign, new THREE.PlaneGeometry(0.5, 0.3125), 0.05, 1.75, W / 2 + 0.0075);
}

/** The steel steps up to the door, with a rail on one side. */
function buildSteps(p, m) {
  const { width: W, floor: FY } = CABIN;
  const z0 = W / 2 + 0.05;
  const t1 = FY - 0.01; // the tread tops
  const t2 = 0.21;
  const profile = [[z0, 0.02], [z0 + 0.8, 0.02], [z0 + 0.8, t2 - 0.02], [z0 + 0.4, t2 - 0.02], [z0 + 0.4, t1 - 0.02], [z0, t1 - 0.02]];
  for (const x of [0.62, 1.38]) p.extrude(m.rust, profile, 0.05, x, 0, 0, -Math.PI / 2);
  p.box(m.bar, 0.9, 0.035, 0.44, 1.0, t1 - 0.0175, z0 + 0.19, 0, 0.5);
  p.box(m.bar, 0.9, 0.035, 0.44, 1.0, t2 - 0.0175, z0 + 0.6, 0, 0.5);
  p.rod(m.bar, [1.43, t1, z0 + 0.15], [1.43, FY + 0.9, z0 + 0.15], 0.02);
  p.rod(m.bar, [1.43, t2, z0 + 0.75], [1.43, 1.1, z0 + 0.75], 0.02);
  p.rod(m.bar, [1.43, FY + 0.9, z0 + 0.15], [1.43, 1.1, z0 + 0.75], 0.02);
}

/** What has been left outside: a bucket, a plastic chair, a few planks leaning on the end wall, and a pallet. */
function buildClutter(p, m) {
  const { length: L, width: W } = CABIN;
  p.add(m.bucket, new THREE.CylinderGeometry(0.15, 0.115, 0.3, 10), -0.7, 0.15, W / 2 + 0.55);
  p.add(m.dark, new THREE.TorusGeometry(0.15, 0.008, 4, 12), -0.7, 0.3, W / 2 + 0.55, Math.PI / 2, 0, 0);
  // The chair: seat, back and four legs, a bit askew.
  const chair = new Parts();
  chair.box(m.plastic, 0.42, 0.04, 0.42, 0, 0.45, 0, 0, 0.5);
  chair.box(m.plastic, 0.42, 0.4, 0.03, 0, 0.67, -0.2, 0, 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chair.box(m.plastic, 0.035, 0.45, 0.035, sx * 0.18, 0.225, sz * 0.18, 0, 0.5);
  p.merge(chair, placement(-1.2, 0, W / 2 + 0.7, 0.5));
  // Planks leaning on the right end wall.
  for (let i = 0; i < 4; i++) p.add(m.wood, new THREE.BoxGeometry(0.035, 1.9, 0.14 + (i % 2) * 0.03), L / 2 + 0.135 + i * 0.012, 0.95, -0.5 + i * 0.17, 0, 0, 0.12);
  // A pallet on the ground at the back.
  for (let i = 0; i < 5; i++) p.box(m.wood, 1.2, 0.022, 0.12, 0.2, 0.135, -W / 2 - 0.9 + i * 0.2, 0, 1);
  for (const z of [-W / 2 - 0.9, -W / 2 - 0.5, -W / 2 - 0.1]) p.box(m.wood, 1.2, 0.09, 0.09, 0.2, 0.06, z, 0, 1);
}

/** Inside, what shows through the door and the windows: a desk and a chair, a kettle and a mug. */
function buildInside(p, m) {
  const { width: W, floor: FY } = CABIN;
  p.box(m.wood, 1.2, 0.04, 0.6, 0.95, FY + 0.74, -W / 2 + 0.45, 0, 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(m.wood, 0.05, 0.72, 0.05, 0.95 + sx * 0.55, FY + 0.36, -W / 2 + 0.45 + sz * 0.25, 0, 0.5);
  p.box(m.plastic, 0.3, 0.006, 0.22, 0.7, FY + 0.763, -W / 2 + 0.45);
  p.add(m.plastic, new THREE.CylinderGeometry(0.09, 0.11, 0.2, 10), 1.3, FY + 0.86, -W / 2 + 0.3);
  p.add(m.bucket, new THREE.CylinderGeometry(0.04, 0.035, 0.09, 8), 1.05, FY + 0.81, -W / 2 + 0.5);
  p.box(m.plastic, 0.42, 0.04, 0.42, 0.95, FY + 0.45, -W / 2 + 0.95, 0, 0.5);
  p.box(m.plastic, 0.42, 0.4, 0.03, 0.95, FY + 0.67, -W / 2 + 1.14, 0, 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(m.dark, 0.03, 0.45, 0.03, 0.95 + sx * 0.18, FY + 0.225, -W / 2 + 0.95 + sz * 0.18);
}

/**
 * The cabin: `{ group, boxes }`. `boxes` are its colliders in its own frame ([x, y, z, half x, half y, half z]); `random` is unused here but kept so
 * every pit model is built the same way.
 */
export function buildCabin(m) {
  const { length: L, width: W, floor: FY, top } = CABIN;
  const p = new Parts();
  buildShell(p, m);
  buildSteps(p, m);
  buildClutter(p, m);
  buildInside(p, m);
  // Windows (the one on the end wall faces +x), and the door hung on its hinge, open.
  p.merge(buildWindow(m, 1.1, 0.85), placement(-0.9, 1.775, W / 2));
  p.merge(buildWindow(m, 1.1, 0.85, { shutter: true }), placement(0.05, 1.775, -W / 2, Math.PI));
  p.merge(buildWindow(m, 0.8, 0.85), placement(L / 2, 1.775, -0.1, Math.PI / 2));
  p.merge(buildDoor(m), placement(0.56, FY + 0.03, W / 2, -1.9)); // swung right out from the post on its left, clear of the steps
  const group = p.build();
  group.name = 'siteCabin';
  const boxes = [[0, top / 2 + 0.1, 0, L / 2 + 0.05, top / 2, W / 2 + 0.05]];
  return { group, boxes };
}
