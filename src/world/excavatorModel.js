// The pit's old excavator: a 20 tonne tracked digger left on the floor. Built in a local frame with +x the way it looks (the boom side), +y up
// and +z to its right, standing on y = 0, so a caller can move it anywhere. Every moving part meets the next at a pin (the boom's foot, the elbow,
// the stick's end, the bucket and the rams' eyes), and `links` and `joints` say where, for a test to hold it to.

import * as THREE from 'three';
import { Parts } from './parts.js';
import { diggerTexture, rustTexture } from './quarryTextures.js';

/** The excavator's materials, made once. */
export function excavatorMaterials(random) {
  const lit = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  return named({
    yellow: lit({ map: diggerTexture(random, '#b69a34'), roughness: 0.8 }),
    orange: lit({ map: diggerTexture(random, '#a85a28'), roughness: 0.8 }),
    rustDark: lit({ map: rustTexture(random, '#5b3a2a'), roughness: 0.9 }),
    dark: lit({ color: 0x252422, roughness: 0.9 }),
    chrome: lit({ color: 0xa9adb0, metalness: 0.8, roughness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x31444a, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.4, depthWrite: false }),
    amber: lit({ color: 0xc9801a, roughness: 0.4 }),
  });
}

/** Names each material after its key, so a mesh in the scene says what it is made of. */
function named(materials) {
  for (const [k, v] of Object.entries(materials)) v.name = k;
  return materials;
}

// The tracks: a loop of shoes round a sprocket at the back and an idler at the front.
const LOOP_Y = 0.44; // the height of the wheels' middles
const LOOP_R = 0.4; // the loop's end radius (to the middle of a shoe)
const LOOP_HALF = 1.45; // the wheels' middles are this far either side of the machine's middle
const TRACK_Z = 1.0; // each track's middle, out from the machine's

function trackPath(s) {
  const run = LOOP_HALF * 2;
  const arc = Math.PI * LOOP_R;
  const total = 2 * run + 2 * arc;
  s = ((s % total) + total) % total;
  if (s < run) return { x: -LOOP_HALF + s, y: LOOP_Y - LOOP_R, a: 0 };
  s -= run;
  if (s < arc) {
    const t = s / LOOP_R - Math.PI / 2;
    return { x: LOOP_HALF + Math.cos(t) * LOOP_R, y: LOOP_Y + Math.sin(t) * LOOP_R, a: t + Math.PI / 2 };
  }
  s -= arc;
  if (s < run) return { x: LOOP_HALF - s, y: LOOP_Y + LOOP_R, a: Math.PI };
  s -= run;
  const t = s / LOOP_R + Math.PI / 2;
  return { x: -LOOP_HALF + Math.cos(t) * LOOP_R, y: LOOP_Y + Math.sin(t) * LOOP_R, a: t + Math.PI / 2 };
}

function buildTracks(p, m) {
  const total = 2 * LOOP_HALF * 2 + 2 * Math.PI * LOOP_R;
  const n = Math.round(total / 0.2);
  for (const side of [-1, 1]) {
    const z = TRACK_Z * side;
    for (let i = 0; i < n; i++) {
      const pt = trackPath((i * total) / n);
      p.add(m.rustDark, new THREE.BoxGeometry(0.185, 0.05, 0.62), pt.x, pt.y, z, 0, 0, pt.a); // a shoe
      const out = [Math.sin(pt.a), -Math.cos(pt.a)];
      p.add(m.dark, new THREE.BoxGeometry(0.05, 0.034, 0.6), pt.x + out[0] * 0.04, pt.y + out[1] * 0.04, z, 0, 0, pt.a); // its grouser
    }
    p.box(m.rustDark, 3.0, 0.24, 0.3, 0, LOOP_Y, z, 0, 1.5); // the track frame, inside the loop
    p.wheel(m.dark, 0.34, 0.5, -LOOP_HALF, LOOP_Y, z, 16); // the sprocket
    p.wheel(m.rustDark, 0.17, 0.56, -LOOP_HALF, LOOP_Y, z, 10);
    p.wheel(m.dark, 0.36, 0.46, LOOP_HALF, LOOP_Y, z, 16); // the idler
    p.wheel(m.rustDark, 0.15, 0.52, LOOP_HALF, LOOP_Y, z, 10);
    for (let i = 0; i < 5; i++) {
      p.wheel(m.dark, 0.11, 0.4, -0.95 + i * 0.475, 0.175, z, 12); // the bottom rollers
      p.wheel(m.rustDark, 0.05, 0.44, -0.95 + i * 0.475, 0.175, z, 8);
    }
    for (const x of [-0.45, 0.5]) {
      p.wheel(m.dark, 0.065, 0.38, x, 0.745, z, 10); // the top carriers
      p.wheel(m.rustDark, 0.03, 0.42, x, 0.745, z, 6);
    }
    p.box(m.dark, 1.6, 0.04, 0.72, -0.1, 0.99, z, 0, 1.5); // the guard over the top run
    for (const x of [-0.7, 0.5]) p.box(m.rustDark, 0.06, 0.1, 0.1, x, 0.93, z + 0.05 * side);
  }
}

function buildHouse(p, m) {
  p.box(m.rustDark, 2.2, 0.46, 1.8, -0.05, 0.78, 0, 0, 1.5); // the carbody
  p.add(m.dark, new THREE.CylinderGeometry(0.88, 0.88, 0.08, 20), 0, 1.05, 0); // the slew ring
  p.add(m.rustDark, new THREE.CylinderGeometry(0.84, 0.84, 0.08, 20), 0, 1.12, 0);
  p.box(m.yellow, 3.05, 0.12, 2.5, -0.175, 1.21, 0, 0, 1.5); // the deck
  // The curved counterweight at the back.
  p.extrude(m.orange, [[-2.25, 1.17], [-1.45, 1.17], [-1.45, 2.35], [-2.25, 2.35], [-2.5, 2.0], [-2.5, 1.4]], 2.46);
  p.add(m.dark, new THREE.TorusGeometry(0.07, 0.02, 6, 12), -2.0, 2.4, 0, Math.PI / 2, 0, 0); // its lifting eye
  p.box(m.rustDark, 0.12, 0.1, 0.3, -2.0, 2.36, 0);
  for (const z of [-0.95, 0.95]) p.box(m.amber, 0.03, 0.14, 0.2, -2.505, 1.55, z); // the tail lamps
  for (const z of [-0.95, 0.95]) p.box(m.dark, 0.05, 0.2, 0.28, -2.485, 1.55, z);
  // The engine hood, its door lines, handle and louvres.
  p.extrude(m.yellow, [[-1.45, 1.25], [-0.4, 1.25], [-0.4, 1.85], [-0.55, 2.05], [-1.45, 2.1]], 2.4);
  for (const side of [-1, 1]) {
    p.box(m.dark, 0.05, 0.6, 0.02, -0.82, 1.65, side * 1.205); // the door's edge
    p.box(m.dark, 0.1, 0.03, 0.04, -0.72, 1.6, side * 1.215); // its handle
    p.box(m.dark, 0.5, 0.3, 0.02, -1.18, 1.7, side * 1.205); // the louvres
    for (let i = 0; i < 5; i++) p.box(m.yellow, 0.46, 0.02, 0.02, -1.18, 1.6 + i * 0.055, side * 1.222);
  }
  p.box(m.dark, 0.7, 0.04, 0.5, -1.0, 2.1, -0.5); // the vent on top
  // Exhaust, air cleaner and a rain cap.
  p.rod(m.dark, [-1.2, 2.07, 0.85], [-1.2, 2.85, 0.85], 0.05);
  p.rod(m.rustDark, [-1.2, 2.04, 0.85], [-1.2, 2.2, 0.85], 0.075);
  p.add(m.dark, new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), -1.17, 2.88, 0.85, 0, 0, 0.35);
  p.rod(m.dark, [-0.8, 2.05, -0.8], [-0.8, 2.55, -0.8], 0.11);
  p.rod(m.rustDark, [-0.8, 2.55, -0.8], [-0.8, 2.62, -0.8], 0.06);
  // The oil tank down the right side, strapped.
  p.box(m.orange, 1.15, 0.6, 0.3, 0.275, 1.57, 1.07, 0, 1.5);
  for (const x of [-0.05, 0.6]) p.box(m.dark, 0.05, 0.64, 0.34, x, 1.57, 1.07);
  p.box(m.glass, 0.04, 0.3, 0.012, 0.3, 1.55, 1.228);
  p.rod(m.dark, [0.75, 1.87, 1.07], [0.75, 1.93, 1.07], 0.06);
  // A step up from the track, and a grab rail.
  p.box(m.rustDark, 0.5, 0.04, 0.3, 0.3, 0.97, -1.52, 0, 1.5);
  for (const x of [0.12, 0.48]) p.box(m.rustDark, 0.05, 0.44, 0.05, x, 1.15, -1.4);
  p.box(m.rustDark, 0.5, 0.04, 0.3, 0.3, 1.17, -1.52, 0, 1.5);
  p.rod(m.dark, [0.0, 1.27, -1.3], [0.0, 1.9, -1.3], 0.025);
}

/** A cab on the left of the house: a solid lower skirt, glass above between pillars, a roof, a door with its frame, handle and hinges, a seat and levers. */
function buildCab(p, m) {
  const x0 = -0.3;
  const x1 = 1.1;
  const z0 = -1.2;
  const z1 = -0.25;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  p.box(m.yellow, x1 - x0, 0.55, z1 - z0, cx, 1.525, cz, 0, 1.5); // the skirt, up to the sills
  for (const px of [x0 + 0.03, x1 - 0.03]) for (const pz of [z0 + 0.03, z1 - 0.03]) p.box(m.yellow, 0.07, 1.1, 0.07, px, 2.33, pz < cz ? pz - 0.005 : pz + 0.005, 0, 1.5);
  p.box(m.yellow, 1.56, 0.08, 1.14, cx, 2.89, cz, 0, 1.5); // the roof
  p.box(m.rustDark, 1.5, 0.03, 1.08, cx, 2.945, cz, 0, 1.5); // a worn plate on it
  // The glass: the windscreen, the back, the right side and the door's.
  p.box(m.glass, 0.012, 1.0, 0.82, x1 - 0.005, 2.325, cz, 0);
  p.box(m.glass, 0.012, 1.0, 0.82, x0 + 0.005, 2.325, cz, 0);
  p.box(m.glass, 1.2, 1.0, 0.012, cx, 2.325, z1 - 0.005, 0);
  p.box(m.glass, 0.86, 0.86, 0.012, 0.5, 2.35, z0 + 0.012, 0);
  p.box(m.glass, 0.3, 0.86, 0.012, x0 + 0.17, 2.35, z0 + 0.012, 0);
  p.box(m.yellow, 0.05, 1.0, 0.05, 0.47, 2.33, z1 - 0.03, 0, 1.5); // the right side's mullion
  // The door: its frame, a lower panel, a handle on stand-offs, two hinges.
  const zb = (w, h, x, y, outer, inner) => p.box(m.yellow, w, h, inner - outer, x, y, (outer + inner) / 2, 0, 1.5); // a bar of the frame from `outer` to `inner` in z
  zb(0.92, 0.04, 0.5, 2.8, z0 - 0.038, z0 + 0.004);
  zb(0.92, 0.04, 0.5, 1.34, z0 - 0.038, z0 + 0.004);
  zb(0.88, 0.03, 0.5, 1.9, z0 - 0.03, z0);
  for (const x of [0.07, 0.93]) zb(0.04, 1.5, x, 2.07, z0 - 0.045, z0 + 0.01);
  p.box(m.orange, 0.78, 0.4, 0.012, 0.5, 1.62, z0 - 0.006, 0, 1.5);
  p.box(m.dark, 0.16, 0.03, 0.03, 0.22, 1.78, z0 - 0.07);
  for (const x of [0.17, 0.27]) p.box(m.dark, 0.025, 0.02, 0.05, x, 1.78, z0 - 0.04);
  for (const y of [1.5, 2.6]) p.box(m.dark, 0.04, 0.1, 0.07, 0.95, y, z0 - 0.045);
  // The A pillar's grab handle, a mirror on an arm, the wiper, the roof lamps and the beacon.
  p.rod(m.dark, [x1 + 0.05, 1.95, z0 + 0.03], [x1 + 0.05, 2.7, z0 + 0.03], 0.02);
  for (const y of [1.95, 2.7]) p.rod(m.dark, [x1 + 0.05, y, z0 + 0.03], [x1 - 0.01, y, z0 + 0.03], 0.02);
  p.rod(m.dark, [x1 - 0.02, 2.6, z0 - 0.02], [x1 + 0.12, 2.62, z0 - 0.26], 0.015);
  p.box(m.dark, 0.03, 0.26, 0.14, x1 + 0.13, 2.6, z0 - 0.33);
  p.rod(m.dark, [x1 + 0.013, 2.7, cz - 0.3], [x1 + 0.013, 2.4, cz + 0.2], 0.008);
  for (const z of [cz - 0.35, cz + 0.35]) {
    p.box(m.dark, 0.12, 0.1, 0.14, x1 - 0.1, 3.0, z);
    p.box(m.amber, 0.02, 0.07, 0.1, x1 - 0.03, 3.0, z);
  }
  p.box(m.dark, 0.18, 0.04, 0.18, x0 + 0.3, 2.99, cz);
  p.add(m.amber, new THREE.CylinderGeometry(0.075, 0.075, 0.12, 10), x0 + 0.3, 3.07, cz);
  // The seat, the levers and the console inside.
  p.box(m.rustDark, 0.2, 0.35, 0.2, 0.05, 1.975, cz);
  p.box(m.dark, 0.45, 0.1, 0.45, 0.05, 2.2, cz);
  p.box(m.dark, 0.08, 0.6, 0.43, -0.18, 2.5, cz);
  p.box(m.dark, 0.06, 0.18, 0.28, -0.2, 2.88, cz);
  for (const z of [cz - 0.28, cz + 0.28]) {
    p.box(m.dark, 0.3, 0.06, 0.1, 0.1, 2.33, z);
    p.rod(m.dark, [0.45, 1.8, z], [0.45, 2.2, z], 0.02);
    p.add(m.dark, new THREE.SphereGeometry(0.04, 6, 5), 0.45, 2.22, z);
  }
  p.box(m.dark, 0.5, 0.34, 0.12, 0.62, 1.97, z1 - 0.1);
  p.box(m.rustDark, 0.06, 0.04, 0.22, 0.85, 1.82, cz);
}

/** The boom, stick and bucket, the rams that work them, and the hoses. Returns the joints and links for a test to hold the machine to. */
function buildArm(p, m) {
  const zc = 0.35;
  const P0 = [1.0, 1.5];
  const a1 = 0.95;
  const a2 = 0.3;
  const M = [P0[0] + 1.7 * Math.cos(a1), P0[1] + 1.7 * Math.sin(a1)];
  const E = [M[0] + 2.3 * Math.cos(a2), M[1] + 2.3 * Math.sin(a2)];
  const as = -1.15;
  const BUCKET_DROP = 1.25; // from the bucket pin down to the cutting edge
  const stickLen = (E[1] - (0.03 + BUCKET_DROP)) / -Math.sin(as);
  const d = [Math.cos(as), Math.sin(as)];
  const S = [E[0] + d[0] * stickLen, E[1] + d[1] * stickLen];
  const up = [-d[1], d[0]]; // the stick's upward normal
  const along = (A, B, t, off) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    return [A[0] + u[0] * t * L - u[1] * off, A[1] + u[1] * t * L + u[0] * off];
  };

  // The foot: two ears on a plate on the deck, a pin through them and the boom.
  p.box(m.yellow, 0.8, 0.06, 0.64, 1.0, 1.31, zc, 0, 1.5);
  for (const z of [0.065, 0.635]) p.extrude(m.yellow, [[0.6, 1.25], [1.45, 1.25], [1.45, 1.6], [1.2, 1.95], [0.9, 1.95], [0.7, 1.55]], 0.05, 0, 0, z);
  p.wheel(m.dark, 0.05, 0.74, P0[0], P0[1], zc, 10);
  p.wheel(m.rustDark, 0.09, 0.7, P0[0], P0[1], zc, 10);
  // The boom: two beams meeting at a bend, filled round with a boss, then the pins.
  p.beam(m.yellow, P0[0], P0[1], M[0], M[1], 0.55, 0.46, zc, 1.5);
  p.beam(m.yellow, M[0], M[1], E[0], E[1], 0.5, 0.44, zc, 1.5);
  p.wheel(m.yellow, 0.275, 0.42, P0[0], P0[1], zc, 14);
  p.wheel(m.yellow, 0.275, 0.4, M[0], M[1], zc, 14);
  p.wheel(m.yellow, 0.26, 0.5, E[0], E[1], zc, 14);
  p.wheel(m.dark, 0.06, 0.66, E[0], E[1], zc, 10);
  p.wheel(m.rustDark, 0.11, 0.6, E[0], E[1], zc, 10);
  // The stick, a taper from the elbow to the bucket pin, with a plate along each side, an ear behind the elbow for its ram, and the pin.
  const stickPts = (t0, t1, w0, w1) => {
    const A = along(E, S, t0, 0);
    const B = along(E, S, t1, 0);
    return [[A[0] + up[0] * w0, A[1] + up[1] * w0], [A[0] - up[0] * w0, A[1] - up[1] * w0], [B[0] - up[0] * w1, B[1] - up[1] * w1], [B[0] + up[0] * w1, B[1] + up[1] * w1]];
  };
  p.extrude(m.orange, stickPts(0, 1, 0.25, 0.14), 0.34, 0, 0, zc);
  for (const z of [zc - 0.18, zc + 0.18]) p.extrude(m.rustDark, stickPts(0.2, 0.7, 0.2, 0.15), 0.03, 0, 0, z);
  const ear = [E[0] - d[0] * 0.4, E[1] - d[1] * 0.4];
  p.beam(m.orange, E[0], E[1], ear[0], ear[1], 0.3, 0.28, zc, 1.5);
  p.wheel(m.orange, 0.15, 0.3, ear[0], ear[1], zc, 12);
  p.wheel(m.orange, 0.15, 0.32, S[0], S[1], zc, 12);
  p.wheel(m.dark, 0.055, 0.7, S[0], S[1], zc, 10);
  p.wheel(m.rustDark, 0.1, 0.62, S[0], S[1], zc, 10);

  // The bucket: two side plates, a curved belly of short plates, a cutting edge with teeth, ribs on its back, and the lugs for the linkage.
  const place = (u, v) => [S[0] + u, S[1] + v];
  const outline = [[-0.3, 0.05], [-0.15, 0.22], [0.28, 0.22], [0.55, -0.25], [0.78, -0.8], [1.0, -1.25], [0.55, -1.38], [0.05, -1.25], [-0.35, -0.85], [-0.45, -0.4]];
  for (const z of [zc - 0.52, zc + 0.52]) p.extrude(m.rustDark, outline.map(([u, v]) => place(u, v)), 0.04, 0, 0, z);
  const belly = [[1.0, -1.25], [0.55, -1.38], [0.05, -1.25], [-0.35, -0.85], [-0.45, -0.4], [-0.3, 0.05]];
  for (let i = 0; i < belly.length - 1; i++) {
    const A = place(...belly[i]);
    const B = place(...belly[i + 1]);
    p.beam(m.rustDark, A[0], A[1], B[0], B[1], 0.035, 1.04, zc, 1.5);
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const nrm = [(B[1] - A[1]) / len, -(B[0] - A[0]) / len];
    const away = nrm[1] > 0 || nrm[0] < 0 ? -1 : 1;
    const o = 0.04 * away;
    for (const z of [zc - 0.3, zc, zc + 0.3]) p.beam(m.dark, A[0] + nrm[0] * o, A[1] + nrm[1] * o, B[0] + nrm[0] * o, B[1] + nrm[1] * o, 0.03, 0.07, z + (z === zc ? 0 : 0.0), 1.5);
  }
  const edge = place(1.0, -1.25);
  const lip = Math.atan2(belly[0][1] - belly[1][1], belly[0][0] - belly[1][0]);
  p.add(m.dark, new THREE.BoxGeometry(0.07, 0.07, 1.02), edge[0], edge[1], zc, 0, 0, lip);
  for (let i = 0; i < 5; i++) p.add(m.dark, new THREE.BoxGeometry(0.2, 0.06, 0.09), edge[0] + Math.cos(lip) * 0.1, edge[1] + Math.sin(lip) * 0.1, zc - 0.4 + i * 0.2, 0, 0, lip - 0.04);
  p.wheel(m.rustDark, 0.09, 0.62, S[0], S[1], zc, 10);
  // The linkage: an H-link on the stick, a dog-bone to the bucket's top lug, and the bucket ram's pins.
  const lug = place(0.28, 0.22);
  const hk = along(E, S, 0.86, 0.28);
  const bucketRamBase = along(E, S, 0.2, 0.34);
  p.beam(m.rustDark, hk[0], hk[1], lug[0], lug[1], 0.1, 0.05, zc - 0.2, 1.5);
  p.beam(m.rustDark, hk[0], hk[1], lug[0], lug[1], 0.1, 0.06, zc + 0.2, 1.5);
  p.wheel(m.dark, 0.045, 0.5, lug[0], lug[1], zc, 8);
  p.wheel(m.dark, 0.045, 0.5, hk[0], hk[1], zc, 8);
  const strut = along(E, S, 0.86, 0.0);
  p.beam(m.orange, strut[0], strut[1], hk[0], hk[1], 0.1, 0.08, zc, 1.5); // the H-link's stem up from the stick
  p.beam(m.orange, bucketRamBase[0], bucketRamBase[1], along(E, S, 0.2, 0.0)[0], along(E, S, 0.2, 0.0)[1], 0.1, 0.1, zc, 1.5); // the ram's base lug on the stick

  // The rams: a black body, a chrome rod, and an eye at each end.
  const ram = (a, b, z, { r = 0.075, frac = 0.55 } = {}) => {
    const split = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
    p.rod(m.dark, [a[0], a[1], z], [split[0], split[1], z], r);
    p.rod(m.chrome, [split[0], split[1], z], [b[0], b[1], z], r * 0.55, r * 0.55, 8);
    p.rod(m.rustDark, [split[0] - (b[0] - a[0]) * 0.03, split[1] - (b[1] - a[1]) * 0.03, z], [split[0] + (b[0] - a[0]) * 0.03, split[1] + (b[1] - a[1]) * 0.03, z], r * 1.2);
    p.wheel(m.rustDark, 0.07, 0.13, a[0], a[1], z, 8);
    p.wheel(m.rustDark, 0.065, 0.17, b[0], b[1], z, 8);
  };
  // The two boom rams, from the deck at each side of the boom up to arms off its underside.
  const lugB = along(P0, M, 0.68, -0.33);
  for (const z of [-0.12, 0.82]) {
    const base = [0.82, 1.42];
    p.box(m.rustDark, 0.16, 0.3, 0.1, base[0], 1.42, z, 0, 1.5);
    ram(base, lugB, z);
    p.rod(m.rustDark, [lugB[0], lugB[1], zc + (z < zc ? -0.2 : 0.2)], [lugB[0], lugB[1], z], 0.035);
  }
  p.box(m.rustDark, 0.12, 0.16, 0.46, lugB[0], lugB[1], zc, 0, 1.5);
  // The stick ram, from a bracket on the boom's top to the stick's ear; the bucket ram along the stick's top to the H-link.
  const boomTop = along(M, E, 0.28, 0.27);
  const stickBase = along(M, E, 0.28, 0.42);
  p.box(m.rustDark, 0.12, 0.16, 0.2, (boomTop[0] + stickBase[0]) / 2, (boomTop[1] + stickBase[1]) / 2, zc, 0, 1.5);
  ram(stickBase, ear, zc, { r: 0.08, frac: 0.52 });
  const kTop = along(E, S, 0.2, 0.34);
  ram(kTop, hk, zc, { r: 0.07, frac: 0.55 });

  // The hoses: along each side of the boom's underside from the deck to the elbow, then down the stick's under side to the bucket ram.
  for (const z of [zc - 0.285, zc + 0.285]) {
    const pts = [[0.9, 1.3, z - 0.1 * Math.sign(z - zc)], [...along(P0, M, 0.35, -0.3), z], [...along(P0, M, 0.9, -0.3), z], [...along(M, E, 0.5, -0.27), z], [...along(M, E, 1.0, -0.27), z], [...along(E, S, 0.15, -0.28), z]];
    p.add(m.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), 24, 0.026, 6), 0, 0, 0);
  }
  return {
    joints: [{ name: 'boomFoot', at: P0 }, { name: 'boomBend', at: M }, { name: 'elbow', at: E }, { name: 'bucketPin', at: S }],
    links: [
      { name: 'boom1', a: P0, b: M, halfH: 0.275 },
      { name: 'boom2', a: M, b: E, halfH: 0.25 },
      { name: 'stick', a: E, b: S, halfH: 0.25 },
    ],
    bucketTip: place(1.0, -1.25),
    pin: S,
  };
}

/** The excavator: `{ group, boxes, joints, links, bucketTip }`. `boxes` are its colliders in its own frame ([x, y, z, half x, half y, half z]). */
export function buildExcavator(m) {
  const p = new Parts();
  buildTracks(p, m);
  buildHouse(p, m);
  buildCab(p, m);
  const arm = buildArm(p, m);
  const group = p.build();
  group.name = 'excavator';
  const pin = arm.pin;
  const boxes = [
    [-0.3, 0.7, 0, 2.2, 0.7, 1.31], // the tracks and the deck
    [-0.9, 2.1, 0, 1.6, 0.9, 1.2], // the counterweight, hood and cab
    [pin[0] + 0.3, 0.65, 0.35, 0.75, 0.65, 0.55], // the bucket hanging against the wall
  ];
  return { group, boxes, ...arm };
}
