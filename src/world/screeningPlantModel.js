// The pit's screening plant, as a small aggregate plant really stands: a hardcore pad, a feed hopper on legs over a jaw crusher, a conveyor climbing
// to a screen box on springs, a second conveyor from the screen that climbs on trestles to end over the top of a heap, and beside them a diesel
// generator on its skid. Rusted and left, but standing: every part meets the next. Built in a local frame (+x from the hopper to the heap, +z to the
// right, y = 0 the pad's top) and merged per material. The site cabin and the excavator are placed beside it by quarryProps.js.

import * as THREE from 'three';
import { Parts } from './parts.js';
import { PLANT } from './plantSite.js';
import { hardcoreTexture, paintedSteelTexture, rustTexture } from './quarryTextures.js';

/** The plant's materials, made once. */
export function plantMaterials(random) {
  const lit = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const hardcore = hardcoreTexture(random);
  const m = {
    hardcore: lit({ map: hardcore, roughness: 1 }),
    rust: lit({ map: rustTexture(random), roughness: 0.9 }),
    rustDark: lit({ map: rustTexture(random, '#5b3a2a'), roughness: 0.9 }),
    frame: lit({ map: paintedSteelTexture(random, '#55646a', 0.8), roughness: 0.8 }),
    crusher: lit({ map: paintedSteelTexture(random, '#a8622c', 0.9), roughness: 0.8 }),
    canopy: lit({ map: paintedSteelTexture(random, '#46604b', 0.6), roughness: 0.75 }),
    belt: lit({ color: 0x1f1f1d, roughness: 0.95 }),
    dark: lit({ color: 0x252422, roughness: 0.9 }),
    concrete: lit({ color: 0x8a867d, roughness: 1 }),
    red: lit({ color: 0x9a2a1e, roughness: 0.6 }),
  };
  for (const [k, v] of Object.entries(m)) v.name = k;
  return m;
}

const rad = (deg) => (deg * Math.PI) / 180;
const lineY = (a, b, x) => a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
const BELT_W = 0.84;

/**
 * A conveyor from `a` to `b` ([x, y], the top of its belt): a belt on two side channels with a drum at each end, a return run, troughing idlers
 * every metre, and trestles at each x in `legs`, standing on `ground(x, z)`. Returns the trestles' colliders.
 */
function conveyor(p, m, a, b, legs, ground) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  p.beam(m.belt, a[0], a[1] - 0.03, b[0], b[1] - 0.03, 0.05, BELT_W, 0, 1);
  p.beam(m.belt, a[0], a[1] - 0.44, b[0], b[1] - 0.44, 0.03, BELT_W - 0.04, 0, 1);
  for (const sz of [-1, 1]) p.beam(m.frame, a[0], a[1] - 0.1, b[0], b[1] - 0.1, 0.32, 0.06, sz * 0.48, 2);
  for (const e of [a, b]) {
    p.wheel(m.rustDark, 0.22, BELT_W + 0.04, e[0], e[1] - 0.22, 0, 14);
    for (const sz of [-1, 1]) p.box(m.rustDark, 0.2, 0.18, 0.14, e[0], e[1] - 0.22, sz * 0.58, 0, 1); // the bearings, bolted to the channels
  }
  // Troughing idlers: a flat roller between two that tilt up at the belt's edges, under it, from channel to channel.
  for (let s = 0.9; s < len - 0.5; s += 1.0) {
    const x = a[0] + Math.cos(ang) * s;
    const y = a[1] + Math.sin(ang) * s - 0.1;
    const roller = (r, length, z, tilt) => p.add(m.dark, new THREE.CylinderGeometry(r, r, length, 8).rotateX(Math.PI / 2).rotateX(tilt), x - Math.sin(ang) * 0.0, y, z, 0, 0, ang);
    roller(0.045, 0.4, 0, 0);
    for (const sz of [-1, 1]) roller(0.045, 0.36, sz * 0.3, sz * rad(20));
  }
  // Trestles: an A of two legs on footings, joined by a cross beam under the channels that hangs from them on short posts, with a knee brace.
  const boxes = [];
  for (const x of legs) {
    const top = lineY(a, b, x) - 0.55;
    const feet = [-1, 1].map((sz) => ground(x, sz * 0.95) - 0.1);
    p.box(m.frame, 0.12, 0.14, 1.28, x, top, 0, 0, 2);
    for (const [i, sz] of [-1, 1].entries()) {
      p.rod(m.frame, [x, feet[i], sz * 0.95], [x, top, sz * 0.55], 0.06, 0.06, 6);
      p.box(m.concrete, 0.4, 0.14, 0.4, x, feet[i] + 0.04, sz * 0.95, 0, 1);
      p.box(m.frame, 0.1, 0.3, 0.07, x, top + 0.17, sz * 0.5, 0, 1);
      boxes.push([x, (feet[i] + top) / 2, sz * 0.75, 0.2, (top - feet[i]) / 2, 0.22]);
    }
    const f = 0.4;
    const kneeY = feet.map((y) => y + (top - y) * f);
    p.rod(m.frame, [x, kneeY[0], -0.95 + 0.4 * f], [x, kneeY[1], 0.95 - 0.4 * f], 0.035, 0.035, 4);
    p.rod(m.frame, [x, feet[0] + (top - feet[0]) * 0.12, -0.95 + 0.4 * 0.12], [x, kneeY[1] + 0.2, 0.95 - 0.4 * f], 0.03, 0.03, 4);
  }
  return boxes;
}

/** A lit steel plate lying on the slope from [x1, y1] to [x2, y2], `d` wide across, with side boards `board` tall: a chute. */
function chute(p, m, [x1, y1], [x2, y2], d, board) {
  p.beam(m.rust, x1, y1, x2, y2, 0.05, d, 0, 2);
  for (const sz of [-1, 1]) p.beam(m.rust, x1, y1 + board / 2, x2, y2 + board / 2, board, 0.04, sz * (d / 2 + 0.01), 2);
}

/**
 * The plant: `{ group, boxes, parts }`. `headX` and `headY` say where the second conveyor's head hangs (its belt's top, in the plant's frame) and
 * `ground(x, z)` the ground's height there above the pad's top, so the second conveyor's trestles stand on the floor and the heap's foot where they
 * are. `side` (+1 or -1 along z) is the side the generator stands and the ladder goes up, the side the excavator stands (the cabin takes the other).
 * `boxes` are the colliders ([x, y, z, half x, half y, half z] in the frame); `parts` names the pieces a test holds to.
 */
export function buildScreeningPlant(m, { headX, headY, ground, side = -1 }) {
  const p = new Parts();
  const boxes = [];
  const { padX0: x0, padX1: x1, padHz: hz } = PLANT;

  // The pad: hardcore with a skirt of it spreading out round, sunk into the ground and standing a hand's width proud.
  p.box(m.hardcore, x1 - x0, 0.6, hz * 2, (x0 + x1) / 2, -0.3, 0, 0, 3);
  p.box(m.hardcore, x1 - x0 + 1.4, 0.6, hz * 2 + 1.4, (x0 + x1) / 2, -0.63, 0, 0, 3);
  boxes.push([(x0 + x1) / 2, -0.25, 0, (x1 - x0) / 2, 0.25, hz]);

  // The feed hopper: four legs under bearers, braced, the hopper a funnel of four plates (the corners overlapped so nothing shows through) with a rim,
  // a grizzly of bars across its mouth, stiffener ribs and a ladder.
  const L = { x: 1.12, z: 1.75, top: 2.95 };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.box(m.frame, 0.2, L.top, 0.2, sx * L.x, L.top / 2, sz * L.z, 0, 2);
    p.box(m.concrete, 0.46, 0.12, 0.46, sx * L.x, 0.03, sz * L.z, 0, 1);
    p.box(m.frame, 0.3, 0.025, 0.3, sx * L.x, 0.1, sz * L.z, 0, 1);
  }
  for (const sx of [-1, 1]) p.box(m.frame, 0.14, 0.2, 3.5, sx * 1.12, L.top - 0.05, 0, 0, 2); // the bearers the hopper sits on, along z
  for (const sz of [-1, 1]) {
    p.box(m.frame, 2.0, 0.14, 0.14, 0, 0.72, sz * L.z, 0, 2);
    p.box(m.frame, 2.0, 0.14, 0.14, 0, 2.5, sz * L.z, 0, 2);
    p.rod(m.rustDark, [-L.x, 0.2, sz * L.z], [L.x, 2.5, sz * L.z], 0.04, 0.04, 4);
    p.rod(m.rustDark, [L.x, 0.2, sz * L.z], [-L.x, 2.5, sz * L.z], 0.04, 0.04, 4);
  }
  p.box(m.frame, 0.14, 0.14, 3.4, -L.x, 0.72, 0, 0, 2); // across the back, which the belt does not pass
  for (const sx of [-1, 1]) p.box(m.frame, 0.14, 0.14, 3.4, sx * L.x, 2.5, 0, 0, 2);
  p.rod(m.rustDark, [-L.x, 0.2, -L.z], [-L.x, 2.5, L.z], 0.04, 0.04, 4);
  const lo = { y: 2.2, x: 0.6, z: 0.5 };
  const hi = { y: 3.9, x: 1.75, z: 1.45 };
  const slant = Math.hypot(hi.y - lo.y, hi.x - lo.x);
  const lean = Math.atan2(hi.x - lo.x, hi.y - lo.y);
  const mid = (lo.y + hi.y) / 2;
  const slantZ = Math.hypot(hi.y - lo.y, hi.z - lo.z);
  const leanZ = Math.atan2(hi.z - lo.z, hi.y - lo.y);
  for (const sx of [-1, 1]) p.add(m.rust, new THREE.BoxGeometry(0.06, slant, 2 * hi.z + 0.12), sx * (lo.x + hi.x) / 2, mid, 0, 0, 0, -sx * lean);
  for (const sz of [-1, 1]) {
    p.add(m.rust, new THREE.BoxGeometry(2 * lo.x + 1.0, slantZ, 0.06), 0, mid, sz * (lo.z + hi.z) / 2, sz * leanZ, 0, 0);
    p.box(m.rustDark, 0.12, 1.5, 0.08, 0.5, mid, sz * (lo.z + hi.z) / 2 + sz * 0.1, 0, 2); // stiffener ribs, standing off the plate
    p.box(m.rustDark, 0.12, 1.5, 0.08, -0.5, mid, sz * (lo.z + hi.z) / 2 + sz * 0.1, 0, 2);
  }
  // The rim and the grizzly: four angle bars round the top, and bars across the mouth that a lump lands on.
  for (const sz of [-1, 1]) p.box(m.frame, 2 * hi.x + 0.1, 0.16, 0.12, 0, hi.y + 0.02, sz * (hi.z + 0.06), 0, 2);
  for (const sx of [-1, 1]) p.box(m.frame, 0.12, 0.18, 2 * hi.z + 0.2, sx * (hi.x + 0.06), hi.y + 0.05, 0, 0, 2);
  for (let i = -5; i <= 5; i++) p.box(m.rustDark, 0.07, 0.07, 2 * hi.z, i * 0.3, hi.y - 0.03, 0, 0, 1);
  p.box(m.rustDark, 2 * hi.x, 0.06, 0.08, 0, hi.y - 0.09, 0, 0, 1); // the bar under them that holds them up
  // A ladder up the generator's side from the pad to the rim.
  for (const dx of [-0.2, 0.2]) p.box(m.frame, 0.05, 4.1, 0.05, -0.6 + dx, 2.05, side * (L.z + 0.34), 0, 1);
  for (let y = 0.35; y < 3.9; y += 0.3) p.box(m.frame, 0.42, 0.04, 0.04, -0.6, y, side * (L.z + 0.34), 0, 1);
  boxes.push([0, 1.95, 0, 1.3, 1.95, 1.85]);

  // The jaw crusher under the hopper's throat: a heavy body, two flywheels with spokes and a hub, a guard over one, a motor on a bracket.
  p.box(m.crusher, 1.6, 1.2, 1.24, 0, 1.6, 0, 0, 1.5);
  p.box(m.rustDark, 1.7, 0.16, 1.1, 0, 2.2, 0, 0, 1.5); // the feed plate on top
  p.box(m.rustDark, 1.3, 0.1, 1.5, 0, 1.0, 0, 0, 1.5); // the toggle plate and discharge frame under it
  for (const sz of [-1, 1]) {
    p.wheel(m.rust, 0.55, 0.1, 0, 1.6, sz * 0.72, 18);
    p.wheel(m.dark, 0.17, 0.2, 0, 1.6, sz * 0.78, 10);
    for (let i = 0; i < 3; i++) p.add(m.rustDark, new THREE.BoxGeometry(1.0, 0.07, 0.06), 0, 1.6, sz * 0.72, 0, 0, (i * Math.PI) / 3 + 0.2);
  }
  p.box(m.rustDark, 1.3, 1.1, 0.07, 0, 1.6, 0.97, 0, 1.5); // the guard on the right wheel
  p.box(m.rustDark, 0.7, 0.08, 0.9, -0.2, 1.0, 1.1, 0, 1.5); // the motor's bracket, off the body's side
  p.wheel(m.crusher, 0.22, 0.75, -0.2, 1.3, 1.15, 10); // the motor
  p.box(m.dark, 0.18, 0.14, 0.2, -0.2, 1.57, 1.15, 0, 1);
  // Rubber skirts and a drop plate to the belt's tail.
  p.box(m.belt, 1.2, 0.2, 0.05, 0.1, 0.88, 0.53, 0, 1);
  p.box(m.belt, 1.2, 0.2, 0.05, 0.1, 0.88, -0.53, 0, 1);

  // The first conveyor, from under the crusher up to the feed box on the screen, and the second from the screen up to the heap.
  const tail1 = [0.3, 0.75];
  const head1 = [5.4, 2.55];
  const floorAt = (x, z) => (x < x1 && Math.abs(z) < hz ? 0 : ground(x, z));
  boxes.push(...conveyor(p, m, tail1, head1, [2.7, 4.0], floorAt));
  for (const sz of [-1, 1]) p.box(m.rustDark, 0.1, tail1[1] - 0.22, 0.1, tail1[0], (tail1[1] - 0.22) / 2, sz * 0.58, 0, 1); // the tail's posts
  const tail2 = [PLANT.tailX, PLANT.tailY];
  const head2 = [headX, headY];
  const legs2 = [];
  for (let x = 10.7; x < headX - 3.8; x += 3.6) legs2.push(x);
  boxes.push(...conveyor(p, m, tail2, head2, legs2, floorAt));

  // The screen: a box on four springs on cross beams and posts, a lid with a feed box on it, a motor, a chute out to the second belt.
  for (const sx of [4.7, 8.1]) {
    for (const sz of [-1, 1]) {
      p.box(m.frame, 0.16, 0.95, 0.16, sx, 0.475, sz * 1.0, 0, 2);
      p.box(m.concrete, 0.4, 0.12, 0.4, sx, 0.03, sz * 1.0, 0, 1);
      boxes.push([sx, 0.5, sz * 1.0, 0.12, 0.5, 0.12]);
    }
    p.box(m.frame, 0.14, 0.12, 2.1, sx, 0.9, 0, 0, 2);
    for (const sz of [-1, 1]) p.rod(m.frame, [sx, 1.02, sz * 0.7], [sx, 1.2, sz * 0.7], 0.07, 0.07, 8); // the springs
    p.rod(m.rustDark, [sx, 0.15, -1.0], [sx, 0.85, 1.0], 0.03, 0.03, 4);
  }
  p.box(m.crusher, 4.0, 0.7, 1.6, 6.4, 1.5, 0, 0, 1.5); // the body
  p.box(m.rustDark, 4.3, 0.1, 1.8, 6.4, 1.9, 0, 0, 1.5); // the lid, standing proud of it
  p.box(m.rust, 0.06, 0.5, 1.3, 4.67, 2.19, 0, 0, 1.5); // the feed box on it, open at the top
  p.box(m.rust, 0.06, 0.5, 1.3, 5.99, 2.19, 0, 0, 1.5);
  for (const sz of [-1, 1]) p.box(m.rust, 1.32, 0.46, 0.06, 5.33, 2.17, sz * 0.66, 0, 1.5);
  p.box(m.rustDark, 4.0, 0.1, 0.1, 6.4, 1.2, 0.85, 0, 1.5); // the vibrator's beam across the body
  p.wheel(m.dark, 0.2, 0.35, 6.4, 2.1, -0.4, 10); // the motor on the lid
  for (let i = 0; i < 3; i++) p.box(m.frame, 0.06, 0.4, 0.5, 5.2 + i * 1.3, 1.5, 0.82, 0, 1.5); // the guard on the long side
  chute(p, m, [8.35, 1.55], [9.05, 0.95], 1.3, 0.3);
  p.box(m.rustDark, 0.12, 0.14, 1.2, 8.2, 1.55, 0, 0, 1.5);
  boxes.push([6.4, 1.5, 0, 2.2, 0.5, 0.9]);

  // A diesel generator set beside the screen, on its skid: a tank, a canopy with louvres and a door, an exhaust with a rain cap.
  const g = { x: 6.4, z: side * 2.45 };
  const near = -side; // the way from the generator to the plant's middle, which its louvres and door face
  for (const sz of [-0.55, 0.55]) p.box(m.frame, 2.9, 0.14, 0.16, g.x, 0.07, g.z + sz, 0, 2);
  for (const dx of [-1.2, 0, 1.2]) p.box(m.frame, 0.12, 0.12, 1.2, g.x + dx, 0.2, g.z, 0, 2);
  p.box(m.rustDark, 2.5, 0.28, 1.0, g.x, 0.34, g.z, 0, 1.5); // the tank under it
  p.box(m.canopy, 2.5, 1.2, 1.1, g.x, 1.18, g.z, 0, 1.5);
  p.box(m.canopy, 2.64, 0.06, 1.24, g.x, 1.81, g.z, 0, 1.5); // the roof, overhanging
  for (let i = 0; i < 6; i++) p.box(m.dark, 0.9, 0.04, 0.04, g.x - 0.6, 0.85 + i * 0.1, g.z + near * 0.56, 0, 1); // the louvres on the near side
  p.box(m.dark, 0.96, 0.62, 0.02, g.x - 0.6, 1.07, g.z + near * 0.545, 0, 1);
  p.box(m.rust, 0.9, 1.0, 0.04, g.x + 0.65, 1.15, g.z + near * 0.57, 0, 1.5); // the door
  p.box(m.dark, 0.08, 0.14, 0.05, g.x + 0.3, 1.1, g.z + near * 0.62, 0, 1);
  p.box(m.red, 0.1, 0.1, 0.05, g.x + 1.0, 1.55, g.z + near * 0.6, 0, 1); // the stop button
  p.rod(m.dark, [g.x + 1.0, 1.8, g.z - near * 0.2], [g.x + 1.0, 2.7, g.z - near * 0.2], 0.055, 0.055, 8);
  p.add(m.dark, new THREE.CylinderGeometry(0, 0.18, 0.1, 8), g.x + 1.0, 2.75, g.z - near * 0.2);
  p.box(m.rustDark, 0.08, 0.1, 0.08, g.x + 1.0, 2.69, g.z - near * 0.2, 0, 1);
  // The cable from it along the pad, in under the hopper's back and up to a junction box on the crusher.
  const cable = [[g.x - 1.4, 0.05, g.z], [g.x - 1.4, 0.05, side * 2.45], [-2.6, 0.05, side * 2.45], [-2.6, 0.05, 0], [-0.88, 0.05, 0], [-0.88, 1.1, 0]];
  for (let i = 0; i + 1 < cable.length; i++) {
    p.rod(m.dark, cable[i], cable[i + 1], 0.025, 0.025, 5);
    p.box(m.dark, 0.06, 0.06, 0.06, ...cable[i + 1], 0, 1);
  }
  p.box(m.rustDark, 0.14, 0.24, 0.32, -0.88, 1.2, 0, 0, 1.5);
  boxes.push([g.x, 0.95, g.z, 1.4, 0.95, 0.65]);

  const group = p.build();
  group.name = 'screeningPlant';
  return { group, boxes, parts: { head1, tail2, head2, screen: { x: 6.4, y: 1.5, hx: 2.0, hy: 0.35 }, legs2, generator: g } };
}
