import * as THREE from 'three';
import { gearLeverPose, SEAT_TIP, posePedals } from './landRoverModel.js';
import { buildFiestaModel } from './fiestaModel.js';
import { FIESTA_BODY } from './fiestaBody.js';
import { buildCorsaModel } from './corsaModel.js';
import { CORSA_BODY } from './corsaBody.js';

// The girls' cars, procedural like the Land Rovers: Amy's Mk1 Fiesta (1976 to 1983, boxy, a sloping hatch, square lamps, black
// bumpers) and Jess's Corsa B (1993, rounded, oval lamps, body-coloured bumpers, a big-bore exhaust). One builder, a table each
// (CARS): the side profile, the glasshouse, the seats and the details that differ. Same named parts as the Land Rovers', so Quad, the
// mount and the girls' seats work unchanged:
//
//   quad
//   ├── body                         rocked by vibration
//   │   └── bodyRoot                 ground-referenced: y = 0 is the ground at rest, so it sits at CAR_GROUND_OFFSET in the chassis
//   │       ├── steeringColumn > handlebars    the wheel (holds riderHands, gripLeft, gripRight)
//   │       ├── dash, gearLever, parkBrakeLever, chokeKnob     posed by poseCarControls
//   │       ├── seatBack_driver, seatBack_left                  the front backrests, tipped forward to let someone into the back
//   │       ├── riderAnchor, seatLeft, seatRearLeft, seatRearRight, cameraAnchor, cameraLeft, cameraRearLeft, cameraRearRight
//   │       └── exhaustTip
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child; the back two are not driven)
//
// +Z is forward and +X is the driver's left (right-hand drive: the driver sits at -X). Both are three-doors: the back is reached past a
// tipped front seat, the left one from the passenger's side and the driver's from the driver's, as the 200TDi's back bench is.

export const CAR_GROUND_OFFSET = -0.45; // chassis origin to the ground at rest, metres (in the model's own size)
const REST = 0.16; // suspension rest length: the spec's suspensionRestLength over its scale
const KNOB_TRAVEL = 0.06; // how far the Fiesta's choke knob pulls out
const HANDBRAKE_OFF = 0; // the lever's tilt when off (lying along the top of the tunnel), and pulled up
const HANDBRAKE_ON = -0.5;
// The body sits this much higher on its wheels than the arches' first cut (Jamie: it looked low, like a sports model): everything but
// the wheels hangs from a group raised by it, so the tyres show a gap under the arches as an ordinary car's do.
const RIDE_LIFT = 0.05;
const EYE_UP = 0.66; // your eyes over the hips

/**
 * Each car's shape. `upper` is the top of the body's side from the nose back, as (z, y) points; `sill` its bottom. The glasshouse is
 * `screenBase`, `screenTop`, `roofRear` and `hatchBottom` (z, y), with the B pillar at `bPillar`. Seats are hips on the cushions.
 */
export const CARS = {
  fiesta: FIESTA_BODY, // its numbers are in fiestaBody.js, with its own model (fiestaModel.js)
  corsa: CORSA_BODY, // its numbers are in corsaBody.js, with its own model (corsaModel.js)
};

/** The wheels and the physics box, per car. The back wheels are not driven (front-wheel drive, with the spec's fourWheelDrive on). */
export function carLayout(kind) {
  const c = CARS[kind];
  const wheelY = c.R + REST + CAR_GROUND_OFFSET;
  const zF = c.wheelbase / 2;
  return {
    spawnSag: 0.06, // how far the springs sink as it settles: a guess (not measured), small, so it doesn't drop in front of you
    wheels: [
      { name: 'wheel_fl', x: c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
      { name: 'wheel_fr', x: -c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
      { name: 'wheel_rl', x: c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
      { name: 'wheel_rr', x: -c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
    ],
    topY: wheelY,
    // The body from just above the sill to the waist, so a bump in the ground meets it: a road car grounds where a Land Rover wouldn't.
    chassis: { hx: c.width / 2 - 0.05, hy: 0.36, hz: (c.nose - c.tail) / 2 - 0.05, y: 0.56 + RIDE_LIFT + CAR_GROUND_OFFSET },
  };
}

/** The invisible box you look at to get in: ground to roof, a little wider than the body. */
export function carProxy(kind) {
  const c = CARS[kind];
  return { w: c.width + 0.15, h: c.screenTop[1] + RIDE_LIFT + 0.05, d: c.nose - c.tail + 0.05 };
}

/** Where a girl stands to get in each seat: by its door, front seats a little forward of the back ones (the mount's `stand`). */
export const CAR_STAND = {
  left: { x: 1.25, z: -0.15 },
  mid: { x: 1.25, z: -0.15 }, // no middle seat; kept so anything asking for one gets the passenger's door
  driver: { x: -1.25, z: -0.15 },
  rearLeft: { x: 1.25, z: -0.4 },
  rearRight: { x: -1.25, z: -0.4 },
};

/** How far ahead of the driver's eye the windscreen's glass is, at eye height, and the mirror: in the model's own size (a test holds the cars to the Land Rovers'). */
export function carEyeToGlass(kind) {
  const c = CARS[kind];
  const ey = c.seats.driver.y + EYE_UP;
  const ez = c.seats.driver.z + 0.02;
  const [zs, ys] = c.screenBase;
  const [zt, yt] = c.screenTop;
  return { glass: zs + ((zt - zs) * (ey - ys)) / (yt - ys) - ez, mirror: zt - 0.06 - ez, mirrorUp: yt - 0.15 - ey };
}

/**
 * Where the driver's sight line to the binnacle crosses the wheel's plane, as heights up the wheel from its middle (model units): `low` for
 * the bottom of the lamp strip, `high` for the top of the dials. The dials are meant to be seen through the hoop of the wheel above its boss
 * and below the rim (as the Fiesta's are), so `low` has to clear the boss and `high` the rim's inner edge. `boss` and `rimInner` give those.
 * (Jamie: the Corsa's dials were behind the wheel; then its column was too low, so the dash is seen through the wheel, as the Fiesta's.)
 */
export function carDashThroughWheel(kind) {
  const c = CARS[kind];
  const fiesta = kind === 'fiesta';
  const th = -1.12; // the column's rake, as buildCarModel sets it
  const face = c.screenBase[0] - 0.32;
  const rimR = fiesta ? 0.19 : 0.17;
  const wy = c.columnY + c.wheelOut * Math.cos(th);
  const wz = face + c.wheelOut * Math.sin(th);
  const ey = c.seats.driver.y + EYE_UP;
  const ez = c.seats.driver.z + 0.02;
  const centreY = c.screenBase[1] - 0.05;
  const at = (dy) => {
    const dY = centreY + dy - ey;
    const dZ = face - 0.04 - ez;
    const t = ((wy - ey) * Math.cos(th) + (wz - ez) * Math.sin(th)) / (dY * Math.cos(th) + dZ * Math.sin(th));
    return (ey + t * dY - wy) * -Math.sin(th) + (ez + t * dZ - wz) * Math.cos(th);
  };
  return { low: at(-0.05), high: at(0.06), boss: fiesta ? 0.03 : 0.035, rimInner: rimR - (fiesta ? 0.014 : 0.02) };
}

/** The backrests that tip forward to let someone into the back. */
export const CAR_TIPPING_SEATS = ['left', 'driver'];

/** The upper line as drawn: its points joined straight, or (`round`) a smooth curve through them, from the nose back. */
const lines = new WeakMap();
function lineOf(c) {
  if (!c.round) return c.upper;
  if (!lines.has(c)) lines.set(c, new THREE.SplineCurve(c.upper.map(([z, y]) => new THREE.Vector2(z, y))).getPoints(48).map((v) => [v.x, v.y]));
  return lines.get(c);
}

/** The upper line's height at z (the line is from the nose back, so z falls along it). */
function upperAt(c, z) {
  const u = lineOf(c);
  if (z >= u[0][0]) return u[0][1];
  for (let i = 1; i < u.length; i++) {
    const [z0, y0] = u[i - 1];
    const [z1, y1] = u[i];
    if (z >= z1) return y0 + ((y1 - y0) * (z0 - z)) / (z0 - z1 || 1);
  }
  return u[u.length - 1][1];
}

/** The arch's centre height and radius: a little above the tyre's centre at rest (it sinks on its springs), clear of the tyre. */
const archOf = (c) => ({ y: c.R + 0.03, r: c.R + 0.07 });

/**
 * A body side (the wing, the door and the rear quarter in one panel): the sill along the bottom with the two wheel arches cut up into
 * it, the upper line along the top. Exported for its test (no part of it may come inside a tyre).
 */
export function sideShape(c) {
  const a = archOf(c);
  const zF = c.wheelbase / 2;
  const s = new THREE.Shape();
  s.moveTo(c.nose, c.sill);
  // Along the bottom from the nose to the tail, up and over each arch on the way (arcs from front-low round the top to back-low).
  for (const zc of [zF, -zF]) {
    const dy = c.sill - a.y;
    const dz = Math.sqrt(Math.max(0, a.r * a.r - dy * dy));
    const start = Math.atan2(dy, dz); // a little below the front of the arch
    s.lineTo(zc + dz, c.sill);
    s.absarc(zc, a.y, a.r, start, Math.PI - start, false);
    s.lineTo(zc - dz, c.sill);
  }
  s.lineTo(c.tail, c.sill);
  const u = lineOf(c);
  for (let i = u.length - 1; i >= 0; i--) s.lineTo(u[i][0], u[i][1]);
  s.closePath();
  return s;
}

/** A car's model: each has its own file (fiestaModel.js, corsaModel.js) built from its own numbers. */
export function buildCarModel({ kind = 'fiesta', bodyColor = 0x9fb8cc, reg = null } = {}) {
  if (kind === 'corsa') return buildCorsaModel({ bodyColor, reg });
  return buildFiestaModel({ bodyColor, reg });
}

/** The front backrests tipped forward, 0 (upright) to 1 (right forward), by seat name ({ left, driver }). */
export function poseCarSeats(model, tips) {
  for (const name of CAR_TIPPING_SEATS) {
    const back = model.getObjectByName(`seatBack_${name}`);
    if (back) back.rotation.x = SEAT_TIP * Math.min(1, Math.max(0, tips[name] ?? 0));
  }
}

/** The gear lever in its H (four gears or five, as the Land Rovers'), the choke knob pulled out, the handbrake up or down. */
export function poseCarControls(model, { gear = 0, gears = 4, choke = 0, park = false, clutch = 0, brake = 0, throttle = 0 }) {
  const g = model.getObjectByName('gearLever');
  if (!g) return;
  posePedals(model, { clutch, brake, throttle });
  const pose = gearLeverPose(gear, gears);
  g.rotation.set(pose.along, 0, pose.across);
  const knob = model.getObjectByName('chokeKnob');
  knob.position.z = knob.userData.baseZ - KNOB_TRAVEL * choke;
  const hb = model.getObjectByName('parkBrakeLever');
  hb.rotation.x += ((park ? HANDBRAKE_ON : HANDBRAKE_OFF) - hb.rotation.x) * 0.3;
}
