import * as THREE from 'three';
import { buildDash } from './dash.js';
import { addHeadlightBeams, addSignalLamps, addSignalStalk, addHazardSwitch, faceAlong } from './quadModel.js';
import { bentTube, mergeStatic } from './quadGeometry.js';
import { add, rbox, label, plate, fitText, canvasTexture, seeded, tube, axleCyl, gearLeverPose, SEAT_TIP } from './landRoverModel.js';
import { buildLPlate } from './lPlateModel.js';
import { treadTyre } from './detail/tread.js';

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
const TYRE_W = 0.16;
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
  fiesta: {
    R: 0.27, // 145 x 12
    wheelbase: 2.29,
    track: 1.33,
    width: 1.57,
    nose: 1.8,
    tail: -1.64,
    sill: 0.2,
    upper: [[1.8, 0.7], [1.66, 0.75], [0.7, 0.86], [-1.38, 0.92], [-1.52, 0.92], [-1.64, 0.84]],
    screenBase: [0.7, 0.88],
    screenTop: [0.22, 1.36], // raked 45 degrees: the glass about as far from your eye as the Land Rovers' (a test keeps it so)
    roofRear: [-1.08, 1.36],
    hatchBottom: [-1.5, 0.93],
    tumble: 0.16, // how far the glasshouse leans in, metres a metre up
    bPillar: -0.58,
    wheelOut: 0.28, // the steering wheel along its column from the dash face
    columnY: 0.71, // and how high the column comes out of the face
    // (Jamie: the windscreen should be as far from your eye as in the Land Rovers, and the mirror ahead of you, not over your head.)
    seats: { driver: { x: -0.36, y: 0.5, z: -0.4 }, left: { x: 0.36, y: 0.5, z: -0.4 } },
    rear: { rearLeft: { x: 0.33, y: 0.52, z: -1.1, door: 'left' }, rearRight: { x: -0.33, y: 0.52, z: -1.1, door: 'driver' } },
    plate: 'KPB 412V', // a V, 1979 to 1980
  },
  corsa: {
    R: 0.274, // 155/70 x 13
    wheelbase: 2.44,
    track: 1.39,
    width: 1.61,
    nose: 1.88,
    tail: -1.68,
    sill: 0.19,
    upper: [[1.88, 0.56], [1.86, 0.65], [1.78, 0.73], [1.55, 0.8], [0.8, 0.9], [-1.36, 1.0], [-1.5, 0.99], [-1.6, 0.93], [-1.68, 0.82]],
    round: true, // the upper line is a smooth curve through its points, not straight lines: the Corsa B is all curves
    screenBase: [0.8, 0.9],
    screenTop: [0.2, 1.42], // raked 49 degrees
    roofRear: [-1.2, 1.4],
    hatchBottom: [-1.56, 0.98],
    tumble: 0.26,
    bPillar: -0.62,
    wheelOut: 0.32,
    columnY: 0.71, // the dials and their lamps show through the top of Jess's small wheel, above its boss, as the Fiesta's do (a test measures it)
    seats: { driver: { x: -0.37, y: 0.5, z: -0.34 }, left: { x: 0.37, y: 0.5, z: -0.34 } },
    rear: { rearLeft: { x: 0.34, y: 0.52, z: -1.14, door: 'left' }, rearRight: { x: -0.34, y: 0.52, z: -1.14, door: 'driver' } },
    plate: 'L238 FKR', // an L, 1993 to 1994
  },
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

const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1a19, roughness: 0.95 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.7 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.25, metalness: 0.85 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  under: new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fb3b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  amber: new THREE.MeshStandardMaterial({ color: 0xd88a18, roughness: 0.3 }),
  clear: new THREE.MeshStandardMaterial({ color: 0xdfe4e6, roughness: 0.2 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.35 }),
  primer: new THREE.MeshStandardMaterial({ color: 0x8d9092, roughness: 0.85 }), // the Corsa's grey wing
  handle: new THREE.MeshStandardMaterial({ color: 0x3a3b3d, roughness: 0.5 }), // the Corsa's door handles
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
};

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

/** A shape in (z, y), extruded `depth` along x and centred on `x`. */
function extrudeZY(shape, depth, x, mat, parent, bevel = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 14 });
  geo.rotateY(-Math.PI / 2); // shape x (the car's z) stays z; the extrusion runs along -x
  geo.translate(x + depth / 2, 0, 0);
  return add(geo, mat, parent);
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

/** A strip of skin `t` thick under the upper line from z0 back to z1 (the bonnet, the deck below the hatch), extruded across `width`. */
function skin(c, z0, z1, t, width, mat, parent) {
  const s = new THREE.Shape();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    if (i === 0) s.moveTo(z, upperAt(c, z));
    else s.lineTo(z, upperAt(c, z));
  }
  for (let i = n; i >= 0; i--) {
    const z = z0 + ((z1 - z0) * i) / n;
    s.lineTo(z, upperAt(c, z) - t);
  }
  s.closePath();
  return extrudeZY(s, width, 0, mat, parent);
}

/** A flat quad through four points (a window, the roof), facing whichever way its corners wind. */
function quadMesh(a, b, c2, d, mat, parent) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c2, ...a, ...c2, ...d], 3));
  g.computeVertexNormals();
  return add(g, mat, parent);
}

// The glasshouse --------------------------------------------------------------------------

/** Its half width at height y: the body's at the waist, drawn in (tumblehome) towards the roof. */
function halfAt(c, y) {
  const waist = c.screenBase[1];
  return c.width / 2 - 0.05 - (y - waist) * c.tumble;
}

/** A flat side piece in (z, y) on side `s`, leaning in from the waist as the glasshouse does, `inset` inside the pillars' line. */
function sidePiece(c, shape, s, inset, mat, root) {
  const ys = c.screenBase[1];
  const g = new THREE.Group();
  g.position.set(s * (halfAt(c, ys) - inset), ys, 0);
  g.rotation.z = s * Math.atan(c.tumble); // the top in, as halfAt draws it
  add(new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2).translate(0, -ys, 0), mat, g);
  root.add(g);
}

function glasshouse(c, paint, trim, root) {
  const [zs, ys] = c.screenBase;
  const [zt, yt] = c.screenTop;
  const [zr, yr] = c.roofRear;
  const [zh, yh] = c.hatchBottom;
  const P = (x, z, y) => [x, y, z];
  // The windscreen and the hatch's glass, the roof over them, and the frames round the glass.
  for (const s of [-1, 1]) {
    // Each side: the pillars (A along the screen, B behind the door, C to the hatch), the rail over the windows, and the glass.
    const ax0 = s * halfAt(c, ys);
    const ax1 = s * halfAt(c, yt);
    const pr = c.round ? 0.045 : 0.035; // the pillars and rails: fatter and softer on the Corsa
    tube([ax0, ys, zs], [ax1, yt, zt], pr, paint, root, 8); // the A pillar
    tube([s * halfAt(c, ys), ys, c.bPillar], [s * halfAt(c, yt), yt - 0.01, c.bPillar], 0.04, paint, root, 6); // the B pillar
    tube([ax1, yt, zt], [s * halfAt(c, yr), yr, zr], pr, paint, root, 8); // the rail over the windows
    tube([s * halfAt(c, yr), yr, zr], [s * halfAt(c, yh), yh, zh], pr + 0.005, paint, root, 8); // the hatch's edge
    // The C pillar: a panel from the back of the quarter window to the hatch's edge.
    const cz0 = c.bPillar - (c.bPillar - zr) * 0.62; // the quarter window's back edge, at the roof
    const cpanel = new THREE.Shape();
    cpanel.moveTo(cz0, yr);
    cpanel.lineTo(zr, yr);
    cpanel.lineTo(zh, yh);
    cpanel.lineTo(zh + 0.25, ys);
    cpanel.lineTo(cz0 - 0.12, ys);
    cpanel.closePath();
    sidePiece(c, cpanel, s, -0.004, paint, root);
    // The side glass, a little inside the pillars: the door's window and the rear quarter's.
    const side = new THREE.Shape();
    side.moveTo(zs, ys);
    side.lineTo(zt, yt);
    side.lineTo(zr, yr);
    side.lineTo(zh + 0.25, ys);
    side.closePath();
    sidePiece(c, side, s, 0.01, MAT.glass, root);
    // The door's window frame and the rubber seal along the bottom of the glass.
    rbox(0.03, 0.025, zs - (zh + 0.25), 0.01, MAT.black, s * (halfAt(c, ys) + 0.005), ys + 0.01, (zs + zh + 0.25) / 2, root);
  }
  // The windscreen, the roof and the hatch glass.
  quadMesh(P(-halfAt(c, ys), zs, ys), P(halfAt(c, ys), zs, ys), P(halfAt(c, yt), zt, yt), P(-halfAt(c, yt), zt, yt), MAT.glass, root);
  quadMesh(P(-halfAt(c, yr), zr, yr), P(halfAt(c, yr), zr, yr), P(halfAt(c, yh), zh, yh), P(-halfAt(c, yh), zh, yh), MAT.glass, root);
  // The roof: a panel crowned across (more on the round Corsa), rounding down to the rails at its sides.
  const roofW = 2 * halfAt(c, yt) + 0.06;
  const roofLen = Math.hypot(zt - zr, yt - yr);
  const crown = c.round ? 0.07 : 0.025;
  const arc = new THREE.Shape();
  arc.moveTo(-roofW / 2, 0);
  arc.quadraticCurveTo(0, crown * 2, roofW / 2, 0);
  arc.lineTo(roofW / 2, -0.03);
  arc.quadraticCurveTo(0, crown * 2 - 0.03, -roofW / 2, -0.03);
  arc.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(arc, { depth: roofLen + 0.06, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -(roofLen + 0.06) / 2);
  const roof = add(roofGeo, paint, root);
  roof.position.set(0, (yt + yr) / 2 + 0.015, (zt + zr) / 2);
  roof.rotation.x = Math.atan2(yt - yr, zt - zr) * -1;
  const lining = rbox(roofW - 0.12, 0.012, roofLen - 0.1, 0.005, trim.lining, 0, (yt + yr) / 2 - 0.012, (zt + zr) / 2, root); // the headlining
  lining.rotation.x = roof.rotation.x;
  tube([-halfAt(c, ys), ys, zs], [halfAt(c, ys), ys, zs], 0.03, MAT.black, root, 6); // the screen's bottom seal
  tube([-halfAt(c, yt), yt, zt], [halfAt(c, yt), yt, zt], 0.03, paint, root, 6); // and its top rail
  tube([-halfAt(c, yh), yh, zh], [halfAt(c, yh), yh, zh], 0.035, paint, root, 6); // the hatch's bottom edge
  // The wipers, lying on the screen at its foot, and the rear one on the hatch glass.
  for (const x of [-0.42, 0.08]) tube([x, ys + 0.02, zs - 0.02], [x + 0.42, ys + 0.06, zs - 0.08], 0.006, MAT.black, root, 4);
  tube([0, yh + 0.03, zh + 0.02], [0.3, yh + 0.1, zh + 0.12], 0.006, MAT.black, root, 4);
  // A rear-view mirror at the top of the screen, in the middle.
  rbox(0.2, 0.06, 0.02, 0.01, MAT.black, 0, yt - 0.15, zt - 0.06, root);
  tube([0, yt - 0.01, zt - 0.03], [0, yt - 0.12, zt - 0.06], 0.008, MAT.black, root, 5); // on its stem from the header
}

// The trim --------------------------------------------------------------------------------

function trimMaterials(kind) {
  const fiesta = kind === 'fiesta';
  // Cloth: Amy's is a beige check, Jess's a grey fleck with a coloured thread through it.
  const cloth = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(fiesta ? 21 : 33);
    g.fillStyle = fiesta ? '#b8a68a' : '#55585c';
    g.fillRect(0, 0, w, h);
    if (fiesta) {
      g.strokeStyle = 'rgba(90,70,50,0.25)';
      g.lineWidth = 2;
      for (let i = 0; i < w; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, h);
        g.moveTo(0, i);
        g.lineTo(w, i);
        g.stroke();
      }
    }
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = fiesta ? (rand() > 0.5 ? 'rgba(255,250,235,0.12)' : 'rgba(60,45,30,0.15)') : rand() > 0.9 ? 'rgba(200,60,60,0.35)' : rand() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)';
      g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
  }, { repeat: [2, 2] });
  const carpet = canvasTexture(64, 64, (g, w, h) => {
    const rand = seeded(5);
    g.fillStyle = fiesta ? '#6e5e48' : '#2c2d2f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)';
      g.fillRect(rand() * w, rand() * h, 1, 1);
    }
  }, { repeat: [4, 4] });
  // Jess's bucket seats: black cloth with lurid zigzags of purple and green through it.
  const loud = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(47);
    g.fillStyle = '#1a1a1e';
    g.fillRect(0, 0, w, h);
    g.lineWidth = 5;
    for (const [col, y0] of [['#b23cff', 24], ['#2fe08a', 64], ['#b23cff', 104]]) {
      g.strokeStyle = col;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + (x / 16) % 2 * 14 - 7);
      g.stroke();
    }
    for (let i = 0; i < 800; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.25)';
      g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
  }, { repeat: [1, 2] });
  return {
    bucket: new THREE.MeshStandardMaterial({ map: loud, roughness: 0.95 }),
    seat: new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }),
    plastic: new THREE.MeshStandardMaterial({ color: fiesta ? 0x8c7b62 : 0x3a3b3d, roughness: 0.75 }), // the dash and door cards
    dash: new THREE.MeshStandardMaterial({ color: fiesta ? 0x4a3426 : 0x2c2d2f, roughness: 0.8 }), // Amy's brown, as a 70s Ford's
    lining: new THREE.MeshStandardMaterial({ color: fiesta ? 0xcfc4ae : 0x9a9b98, roughness: 0.95, side: THREE.DoubleSide }),
  };
}

/**
 * A front seat: a cushion, and a backrest on a pivot at the back of the cushion named `seatBack_<name>` (tipped forward by
 * poseCarSeats), leaning back inside it, with a headrest on the Corsa's.
 */
function frontSeat(name, seat, trim, bucket, root) {
  const mat = bucket ? trim.bucket : trim.seat;
  rbox(0.46, 0.12, 0.46, 0.05, mat, seat.x, seat.y - 0.07, seat.z + 0.12, root); // the cushion, the hips at its back
  rbox(0.4, 0.2, 0.36, 0.02, MAT.under, seat.x, seat.y - 0.24, seat.z + 0.1, root); // its frame and runners
  const pivot = new THREE.Group();
  pivot.name = `seatBack_${name}`;
  pivot.userData.keep = true;
  pivot.position.set(seat.x, seat.y - 0.04, seat.z - 0.13);
  const lean = new THREE.Group();
  lean.rotation.x = -0.22; // reclined a little
  if (bucket) {
    // Jess's: aftermarket buckets, tall with the headrest built in and a slot through it for a harness, big side bolsters on the back and
    // the cushion, in a loud cloth.
    rbox(0.46, 0.84, 0.1, 0.05, mat, 0, 0.42, -0.03, lean);
    for (const sx of [-1, 1]) {
      const wing = rbox(0.08, 0.5, 0.16, 0.04, mat, sx * 0.24, 0.32, 0.03, lean); // the bolster, standing forward
      wing.rotation.y = sx * -0.25;
    }
    rbox(0.16, 0.05, 0.11, 0.02, MAT.black, 0, 0.66, -0.03, lean); // the harness slot
  } else {
    rbox(0.46, 0.6, 0.1, 0.05, mat, 0, 0.3, -0.03, lean);
  }
  pivot.add(lean);
  root.add(pivot);
  if (bucket) for (const sx of [-1, 1]) rbox(0.07, 0.1, 0.42, 0.03, mat, seat.x + sx * 0.23, seat.y - 0.02, seat.z + 0.12, root); // the cushion's bolsters
}

/**
 * One seat's belt, named `belt_<seat>` with a `stowed` and a `worn` child as poseUtvBelts expects: a diagonal and lap belt from the body
 * side (`out`, the pillar's x) to a buckle on the inner side (`inn`). Laid out round the seat's hip point.
 */
function addBelt(root, name, seat, out, inn, post, outTop) {
  const group = new THREE.Group();
  group.name = `belt_${name}`;
  group.userData.keep = true;
  const { y, z } = seat;
  const stowed = new THREE.Group();
  stowed.name = 'stowed';
  // `post`: the z of the door post it hangs from (the B pillar for the front seats, the C pillar's foot for the back).
  // `outTop`: the top mounting's x, inside the glass where the post leans in towards the roof.
  tube([outTop, y + 0.62, post], [out, y + 0.18, post], 0.012, MAT.belt, stowed, 4); // hanging down the door post
  rbox(0.02, 0.06, 0.05, 0.006, MAT.steel, out, y + 0.14, post, stowed); // the tongue, loose
  rbox(0.03, 0.05, 0.05, 0.01, MAT.black, outTop, y + 0.66, post, root); // the top mounting, bolted to the post
  const worn = new THREE.Group();
  worn.name = 'worn';
  worn.visible = false;
  const at = (t, dy, dz) => [out + (inn - out) * t, y + dy, z + dz];
  add(bentTube([[outTop, y + 0.64, post], at(0.18, 0.6, -0.08), at(0.36, 0.48, 0.1), at(0.62, 0.3, 0.14), at(0.88, 0.1, 0.06), [inn, 0.04 + y, -0.08 + z]], 0.016, { bend: 0.05, radial: 6 }), MAT.belt, worn);
  add(bentTube([[out, y + 0.04, post], at(0.25, 0.1, 0.1), at(0.7, 0.1, 0.12), [inn, y + 0.04, z - 0.08]], 0.016, { bend: 0.05, radial: 6 }), MAT.belt, worn);
  group.add(stowed, worn);
  root.add(group);
  rbox(0.034, 0.08, 0.03, 0.008, MAT.steel, inn, y + 0.0, z - 0.12, root); // the buckle on its stalk
  rbox(0.026, 0.02, 0.022, 0.006, MAT.red, inn, y + 0.05, z - 0.12, root);
}

/** The stereo in the console: a period cassette radio in Amy's, a black one with an orange display that Jess fitted in hers. */
function stereo(kind, parent, at) {
  const fiesta = kind === 'fiesta';
  const m = label(0.18, 0.05, 1600, (g, W, H) => {
    g.fillStyle = fiesta ? '#9a9c9e' : '#141516';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#0a0a0a';
    g.fillRect(W * 0.3, H * 0.18, W * 0.4, H * 0.36); // the cassette door
    if (fiesta) {
      g.fillStyle = '#e8e2c8';
      g.fillRect(W * 0.32, H * 0.62, W * 0.36, H * 0.22); // the tuning scale
      g.fillStyle = '#c03020';
      g.fillRect(W * 0.46, H * 0.6, W * 0.008, H * 0.26); // its needle
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#d8d8d8';
        g.fillRect(W * (0.74 + i * 0.045), H * 0.3, W * 0.035, H * 0.4); // the push buttons
      }
    } else {
      g.fillStyle = '#ff8a2a';
      fitText(g, '98.4', W * 0.5, H * 0.72, H * 0.24, W * 0.3); // its display, a station tuned
      for (let i = 0; i < 6; i++) {
        g.fillStyle = '#3a3b3d';
        g.fillRect(W * (0.73 + i * 0.04), H * 0.62, W * 0.03, H * 0.22);
      }
    }
    for (const x of [0.12, 0.88]) {
      g.fillStyle = fiesta ? '#202020' : '#3a3b3d';
      g.beginPath();
      g.arc(W * x, H * 0.5, H * 0.28, 0, Math.PI * 2); // the volume and tuning knobs
      g.fill();
    }
  }, parent);
  m.position.set(at.x, at.y, at.z);
  m.rotation.y = Math.PI; // facing back at the seats, in the dash's face
  return m;
}

// Wheels -------------------------------------------------------------------------------

/** A road tyre: a drum with rounded shoulders and two grooves round it. */
function tyre(R, rimR) {
  return treadTyre('road', { radius: R, width: TYRE_W, rimR, segments: 36 });
}

function buildWheel(w, kind, R, missingTrim) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  const rimR = kind === 'fiesta' ? 0.152 : 0.165;
  add(tyre(R, rimR), MAT.rubber, spin);
  axleCyl(rimR, TYRE_W - 0.02, MAT.steel, 0, 0, 0, spin);
  if (kind === 'fiesta') {
    // Silver steel wheels with a small chrome hub cap.
    axleCyl(rimR - 0.01, 0.02, new THREE.MeshStandardMaterial({ color: 0xb4b8bb, roughness: 0.4, metalness: 0.5 }), side * (TYRE_W / 2 - 0.005), 0, 0, spin);
    axleCyl(0.07, 0.04, MAT.chrome, side * (TYRE_W / 2 + 0.01), 0, 0, spin);
  } else if (missingTrim) {
    // The trim lost off this one: the bare black steel wheel and its nuts show.
    axleCyl(rimR - 0.01, 0.02, MAT.black, side * (TYRE_W / 2 - 0.005), 0, 0, spin);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const n = add(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 6).rotateZ(Math.PI / 2), MAT.steel, spin);
      n.position.set(side * (TYRE_W / 2 + 0.005), Math.sin(a) * 0.05, Math.cos(a) * 0.05);
    }
  } else {
    // A grey plastic wheel trim with its slots.
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.5 });
    axleCyl(rimR + 0.005, 0.025, trimMat, side * (TYRE_W / 2), 0, 0, spin);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const slot = rbox(0.008, 0.05, 0.02, 0.003, MAT.black, side * (TYRE_W / 2 + 0.014), Math.sin(a) * 0.11, Math.cos(a) * 0.11, spin);
      slot.rotation.x = -a;
    }
  }
  mergeStatic(wheel);
  return wheel;
}

// The car ------------------------------------------------------------------------------

export function buildCarModel({ kind = 'fiesta', bodyColor = 0x9fb8cc, dashStyle = kind, reg = null } = {}) {
  const c = CARS[kind];
  const fiesta = kind === 'fiesta';
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: fiesta ? 0.45 : 0.6, side: THREE.DoubleSide });
  // The Corsa's roof and bonnet have faded in the sun: a paler, chalkier red.
  const faded = fiesta ? paint : new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor).lerp(new THREE.Color(0xe8b0a8), 0.35), roughness: 0.8, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3c0b08, roughness: 0.25, emissive: 0x000000 });
  const trim = trimMaterials(kind);
  const layout = carLayout(kind);
  const W = c.width;
  const zF = c.wheelbase / 2;
  const [zs, ys] = c.screenBase;

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = trim.seat;
  quad.userData.steerGain = 6; // about three and a half turns lock to lock
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'bodyRoot';
  body.add(bodyRoot);
  const root = new THREE.Group(); // everything but the wheels, raised on them (RIDE_LIFT)
  root.position.y = RIDE_LIFT;
  bodyRoot.add(root);

  // The body sides, with the wheel arches cut in them, and the shut lines of the door and the handle.
  for (const s of [-1, 1]) {
    // The Corsa's left front wing is a replacement in grey primer, never painted: a separate panel over the side's front.
    const bevel = c.round ? 0.02 : 0.012;
    extrudeZY(sideShape(c), 0.035, s * (W / 2 - 0.02), paint, root, bevel);
    const face = W / 2 - 0.0025 + bevel; // the side's outer face (its middle, half its thickness and its bevel out): details stand on it
    // The indicator repeater on the front wing.
    rbox(0.012, 0.025, 0.06, 0.008, MAT.amber, s * (face + 0.004), upperAt(c, zs + 0.45) - 0.12, zs + 0.45, root);
    const doorFront = zs - 0.02;
    const doorBack = c.bPillar + 0.02;
    for (const z of [doorFront, doorBack]) rbox(0.004, ys - c.sill - 0.08, 0.006, 0.002, MAT.black, s * (face + 0.001), (ys + c.sill) / 2 + 0.02, z, root);
    // The door handle at the back of the door: chrome on the Fiesta, a dark grey pull in a recess on the Corsa.
    rbox(0.014, 0.026, 0.12, 0.007, fiesta ? MAT.chrome : MAT.handle, s * (face + 0.007), ys - 0.08, doorBack + 0.14, root);
    if (!fiesta) rbox(0.004, 0.05, 0.16, 0.002, MAT.black, s * (face + 0.001), ys - 0.08, doorBack + 0.14, root); // its recess
    // A rubbing strip along the doors.
    rbox(0.012, 0.035, zs - c.bPillar, 0.006, MAT.black, s * (face + 0.004), c.sill + 0.24, (zs + c.bPillar) / 2, root);
    // The door mirror on its arm, at the front of the door window.
    rbox(0.07, 0.03, 0.05, 0.01, MAT.black, s * (face + 0.025), ys + 0.04, zs - 0.14, root);
    rbox(0.13, 0.09, 0.05, 0.02, MAT.black, s * (face + 0.09), ys + 0.08, zs - 0.15, root);
  }
  if (!fiesta) {
    // The primer wing: from the door's front edge to where the nose starts rounding, round the arch along the sill (it once closed
    // across the arch and ran into the nose, which showed as a grey line on the front).
    const wing = new THREE.Shape();
    const a = archOf(c);
    const front = c.nose - 0.26;
    const dy = c.sill - a.y;
    const dz = Math.sqrt(Math.max(0, a.r * a.r - dy * dy));
    const start = Math.atan2(dy, dz);
    wing.moveTo(zs + 0.02, c.sill);
    wing.lineTo(zs + 0.02, upperAt(c, zs + 0.02) - 0.01);
    for (let z = zs + 0.1; z < front; z += 0.1) wing.lineTo(z, upperAt(c, z) - 0.01);
    wing.lineTo(front, upperAt(c, front) - 0.01);
    wing.lineTo(front, c.sill);
    wing.lineTo(zF + dz, c.sill);
    wing.absarc(zF, a.y, a.r + 0.002, start, Math.PI - start, false);
    wing.lineTo(zs + 0.02, c.sill);
    const bevel = 0.02;
    extrudeZY(wing, 0.004, W / 2 - 0.0025 + bevel + 0.003, MAT.primer, root); // on the paint's outer face on the left (+x) side
  }
  // Inside the arches and under the bonnet: the inner wings and the engine, so you can't see through the wheel arches.
  for (const s of [-1, 1]) {
    rbox(0.03, 0.5, 1.0, 0.01, MAT.under, s * (c.track / 2 - TYRE_W / 2 - 0.05), 0.48, (zs + c.nose) / 2 - 0.05, root);
    rbox(0.03, 0.4, 0.75, 0.01, MAT.under, s * (c.track / 2 - TYRE_W / 2 - 0.05), 0.5, -zF, root);
    rbox(0.26, 0.04, 0.75, 0.01, MAT.under, s * (W / 2 - 0.15), archOf(c).y + archOf(c).r + 0.01, zF, root); // the arch's roof
    rbox(0.26, 0.04, 0.75, 0.01, MAT.under, s * (W / 2 - 0.15), archOf(c).y + archOf(c).r + 0.01, -zF, root);
  }
  rbox(0.55, 0.4, 0.5, 0.05, MAT.steel, 0, 0.5, zF - 0.05, root); // the engine, across the car
  // Arch liners: a black half tube over each wheel inside the body side, so nothing inside the car shows through the arches.
  const archMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, side: THREE.DoubleSide });
  const a0 = archOf(c);
  for (const s of [-1, 1]) {
    for (const zc of [zF, -zF]) {
      const liner = add(new THREE.CylinderGeometry(a0.r - 0.008, a0.r - 0.008, 0.24, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), archMat, root);
      liner.position.set(s * (W / 2 - 0.15), a0.y, zc);
    }
  }

  // The bonnet, the front panel, the bumpers and the lamps.
  skin(c, c.nose, zs, 0.035, W - 0.06, faded, root);
  rbox(W - 0.06, 0.03, 0.03, 0.01, MAT.under, 0, ys - 0.04, zs + 0.02, root); // the scuttle panel at the foot of the screen
  const noseTop = upperAt(c, c.nose);
  if (fiesta) rbox(W - 0.04, noseTop - c.sill, 0.04, 0.02, paint, 0, (noseTop + c.sill) / 2, c.nose - 0.02, root); // the front panel
  else rbox(W - 0.02, noseTop - c.sill + 0.02, 0.24, 0.1, faded, 0, (noseTop + c.sill) / 2, c.nose - 0.12, root); // the Corsa's rounded nose
  if (fiesta) {
    // Square headlamps either side of a black slatted grille, a black bumper with a chrome strip, the indicators round the corners.
    rbox(0.74, 0.18, 0.03, 0.01, MAT.black, 0, 0.58, c.nose + 0.005, root); // the grille
    for (let i = 0; i < 5; i++) rbox(0.7, 0.012, 0.02, 0.004, MAT.chrome, 0, 0.51 + i * 0.035, c.nose + 0.02, root);
    for (const s of [-1, 1]) {
      rbox(0.28, 0.16, 0.03, 0.01, MAT.chrome, s * 0.55, 0.58, c.nose + 0.005, root); // the headlamp's surround
      add(new THREE.PlaneGeometry(0.25, 0.13), lensMat, root).position.set(s * 0.55, 0.58, c.nose + 0.022);
      rbox(0.08, 0.06, 0.12, 0.02, MAT.amber, s * (W / 2 - 0.03), 0.42, c.nose - 0.04, root); // the indicator, round the corner
    }
    rbox(W + 0.04, 0.12, 0.12, 0.03, MAT.black, 0, 0.36, c.nose + 0.04, root); // the bumper
    rbox(W + 0.02, 0.02, 0.02, 0.005, MAT.chrome, 0, 0.38, c.nose + 0.1, root); // its chrome strip
  } else {
    // Oval lamps swept back into the wings, a slim grille slot with a plain badge, a body-coloured bumper with the indicators in it.
    rbox(0.5, 0.05, 0.03, 0.02, MAT.black, 0, 0.62, c.nose + 0.005, root);
    add(new THREE.CircleGeometry(0.04, 20), MAT.chrome, root).position.set(0, 0.62, c.nose + 0.022); // a plain oval badge, no maker's mark
    for (const s of [-1, 1]) {
      const lamp = add(new THREE.SphereGeometry(0.5, 20, 12).scale(0.36, 0.14, 0.1), lensMat, root);
      lamp.position.set(s * 0.5, 0.62, c.nose - 0.05);
      lamp.rotation.y = s * 0.35;
      // The indicator: an amber lens at the outer end of the lamp unit, wrapping round the corner.
      const ind = add(new THREE.SphereGeometry(0.5, 14, 10).scale(0.1, 0.1, 0.1), MAT.amber, root);
      ind.position.set(s * 0.66, 0.6, c.nose - 0.075);
      ind.rotation.y = s * 0.7;
      ind.scale.setScalar(1.3);
    }
    rbox(W + 0.02, 0.24, 0.16, 0.08, paint, 0, 0.36, c.nose - 0.07, root); // the bumper, tucked in under the nose
    rbox(0.7, 0.05, 0.02, 0.02, MAT.black, 0, 0.27, c.nose + 0.008, root); // its intake
  }
  plate(reg ?? c.plate, '#ece9de', root, { x: 0, y: fiesta ? 0.36 : 0.38, z: c.nose + (fiesta ? 0.125 : 0.015), facing: 1 }); // proud of the bumper and its strip

  // The tail: the deck below the hatch glass, the tail panel, the lamps, the plate and the bumper.
  const [zh, yh] = c.hatchBottom;
  skin(c, zh + 0.02, c.tail, 0.03, W - 0.06, paint, root);
  const tailTop = upperAt(c, c.tail);
  rbox(W - 0.04, tailTop - c.sill, 0.04, 0.02, paint, 0, (tailTop + c.sill) / 2, c.tail + 0.02, root);
  if (fiesta) {
    for (const s of [-1, 1]) {
      rbox(0.26, 0.16, 0.03, 0.01, MAT.black, s * 0.56, 0.68, c.tail - 0.005, root); // the lamp's frame
      rbox(0.24, 0.07, 0.03, 0.01, tailMat, s * 0.56, 0.715, c.tail - 0.012, root); // stop and tail
      rbox(0.11, 0.06, 0.03, 0.01, MAT.amber, s * 0.615, 0.64, c.tail - 0.012, root); // the indicator
      rbox(0.11, 0.06, 0.03, 0.01, s > 0 ? MAT.clear : tailMat, s * 0.505, 0.64, c.tail - 0.012, root); // reverse on the left, fog on the right
    }
    rbox(W + 0.04, 0.12, 0.12, 0.03, MAT.black, 0, 0.36, c.tail - 0.04, root);
    plate(reg ?? c.plate, '#e8c51c', root, { x: 0, y: 0.6, z: c.tail - 0.01, facing: -1 });
  } else {
    for (const s of [-1, 1]) {
      // The Corsa's tall lamps in the tailgate's corners, all on the tailgate below the glass.
      rbox(0.13, 0.3, 0.04, 0.02, MAT.black, s * 0.64, 0.66, c.tail + 0.015, root);
      rbox(0.11, 0.12, 0.03, 0.015, tailMat, s * 0.64, 0.74, c.tail + 0.002, root);
      rbox(0.11, 0.07, 0.03, 0.015, MAT.amber, s * 0.64, 0.63, c.tail + 0.002, root);
      rbox(0.11, 0.06, 0.03, 0.015, s > 0 ? MAT.clear : tailMat, s * 0.64, 0.55, c.tail + 0.002, root);
    }
    // Jess's additions: a black boot spoiler over the hatch glass, and a bass box in the boot you can see through it.
    const spoiler = rbox(halfAt(c, c.roofRear[1]) * 2 - 0.04, 0.03, 0.2, 0.012, MAT.black, 0, c.roofRear[1] + 0.03, c.roofRear[0] - 0.08, root);
    spoiler.rotation.x = 0.18;
    rbox(0.7, 0.32, 0.24, 0.02, new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.9 }), 0.1, 0.62, c.tail + 0.22, root);
    for (const [r, m, dz] of [[0.12, MAT.black, 0.099], [0.035, MAT.chrome, 0.098]]) {
      const cone = add(new THREE.CircleGeometry(r, 18), m, root); // its speaker, facing back out of the hatch
      cone.position.set(0.1, 0.63, c.tail + dz);
      cone.rotation.y = Math.PI;
    }
    rbox(W + 0.02, 0.24, 0.14, 0.08, MAT.black, 0, 0.36, c.tail - 0.02, root); // the unpainted bumper
    plate(reg ?? c.plate, '#e8c51c', root, { x: 0, y: 0.62, z: c.tail - 0.002, facing: -1 });
    // A sticker in the back window: a silhouette of a bike over a stripe, nothing anyone makes.
    const sticker = label(0.3, 0.07, 800, (g, Wd, H) => {
      g.fillStyle = '#f2f2f2';
      g.fillRect(0, H * 0.7, Wd, H * 0.18);
      g.fillStyle = '#ff6a1a';
      fitText(g, 'BRAP', Wd / 2, H * 0.38, H * 0.6, Wd * 0.6);
    }, root);
    const lean = Math.atan2(c.roofRear[0] - zh, c.roofRear[1] - yh); // the hatch glass's lean from upright
    sticker.position.set(0, yh + 0.15 * Math.cos(lean) + 0.008 * Math.sin(lean), zh + 0.15 * Math.sin(lean) - 0.008 * Math.cos(lean));
    sticker.rotation.set(lean, Math.PI, 0);
  }

  // The tailgate's shut lines: across the tail just over the bumper, and up each side to the glass, with its lock in the middle.
  const gateFoot = fiesta ? 0.45 : 0.5;
  const tailTopY = upperAt(c, c.tail);
  rbox(W - 0.16, 0.012, 0.006, 0.003, MAT.black, 0, gateFoot, c.tail - 0.003, root);
  for (const sx of [-1, 1]) {
    rbox(0.012, tailTopY - gateFoot, 0.006, 0.003, MAT.black, sx * (W / 2 - 0.08), (tailTopY + gateFoot) / 2, c.tail - 0.003, root);
    rbox(0.012, 0.006, zh - c.tail, 0.003, MAT.black, sx * (W / 2 - 0.08), upperAt(c, (zh + c.tail) / 2) + 0.003, (zh + c.tail) / 2, root);
  }
  rbox(0.05, 0.03, 0.012, 0.006, MAT.chrome, 0, fiesta ? 0.77 : 0.78, c.tail - 0.005, root); // the lock

  glasshouse(c, fiesta ? paint : faded, trim, root);

  // Amy's L plates, taped on front and back.
  if (fiesta) {
    // On the bumpers, beside the number plates.
    for (const [z, ry, x] of [[c.nose + 0.13, 0, -0.42], [c.tail - 0.13, Math.PI, 0.42]]) {
      const lp = buildLPlate();
      lp.visible = true;
      lp.position.set(x, 0.38, z);
      lp.rotation.y = ry;
      lp.userData.keep = true;
      root.add(lp);
    }
  }

  // Inside: the floor, the bulkhead, the arch humps, the door cards, the dash, the seats.
  rbox(W - 0.1, 0.03, zs - c.tail - 0.1, 0.01, trim.floor, 0, 0.26, (zs + c.tail) / 2, root);
  rbox(W - 0.1, 0.5, 0.04, 0.01, MAT.under, 0, 0.5, zs - 0.06, root); // the bulkhead
  rbox(0.16, 0.12, zs - 0.1 - (c.seats.driver.z - 0.2), 0.04, trim.floor, 0, 0.32, (zs - 0.1 + c.seats.driver.z - 0.2) / 2, root); // the low tunnel
  for (const s of [-1, 1]) {
    rbox(0.08, 0.3, 0.7, 0.03, trim.plastic, s * 0.52, 0.42, -zF, root); // the rear arch inside, beside the back seat (inboard of the tyre)
    rbox(0.03, 0.5, zs - c.bPillar - 0.1, 0.01, trim.plastic, s * (W / 2 - 0.06), 0.6, (zs + c.bPillar) / 2, root); // the door card
    rbox(0.06, 0.04, 0.3, 0.02, trim.plastic, s * (W / 2 - 0.09), 0.72, (zs + c.bPillar) / 2 - 0.1, root); // its arm rest
    rbox(0.03, 0.45, c.bPillar - zh - 0.2, 0.01, trim.plastic, s * (W / 2 - 0.06), 0.62, (c.bPillar + zh) / 2 - 0.05, root); // the rear quarter
  }
  // The dash: a moulding across under the screen, its face, the binnacle standing out of the face in front of the driver (seen through
  // the top of the wheel) under its hood, the stereo in the middle of the face and the hazard switch over it (on the Corsa; the Fiesta's is
  // on top of the column, as the Series III's). Amy's is brown, as a 70s Ford's was.
  const dashTop = ys - 0.02;
  const face = zs - 0.32; // the dash face's z: a deep dash, so the wheel reaches back to the driver without sticking far out of it
  rbox(W - 0.12, 0.08, 0.32, 0.03, trim.dash, 0, dashTop, zs - 0.17, root);
  rbox(W - 0.12, 0.3, 0.04, 0.02, trim.dash, 0, dashTop - 0.17, face, root); // its face
  rbox(0.34, 0.04, 0.12, 0.02, trim.dash, c.seats.driver.x, dashTop + 0.07, face - 0.05, root); // the binnacle's hood
  rbox(0.34, 0.2, 0.04, 0.02, trim.dash, c.seats.driver.x, dashTop - 0.03, face - 0.01, root); // its back, round the dials
  const dash = buildDash(dashStyle);
  dash.group.position.set(c.seats.driver.x, dashTop - 0.03, face - 0.04);
  dash.group.rotation.x = 0.3;
  dash.group.scale.setScalar(1.35); // the binnacle's about 0.3 m wide
  dash.group.userData.keep = true;
  root.add(dash.group);
  quad.userData.dash = dash;
  quad.userData.metalBody = true; // painted steel (or aluminium) panels, not plastic: they chip and rust rather than fade (effects/wearLayer.js)
  quad.userData.podMount = null;
  rbox(0.24, 0.22, 0.24, 0.02, trim.dash, 0, 0.45, face - 0.1, root); // the console under the middle of the dash
  stereo(kind, root, { x: 0, y: dashTop - 0.17, z: face - 0.021 });
  for (const s of [-1, 1]) rbox(0.12, 0.05, 0.02, 0.01, MAT.black, s * 0.5, dashTop - 0.06, face - 0.025, root); // the vents
  if (!fiesta) addHazardSwitch(root, 0, dashTop - 0.08, face - 0.021, { plate: false, w: 0.03, h: 0.024 }).rotation.y = Math.PI;
  if (!fiesta) {
    // Jess's max-power bits: fluffy dice and an air freshener off the mirror, a sun strip with her name across the top of the screen,
    // drilled alloy pedals (below) and a small sports wheel (the steering wheel) and a billet gear knob (the gear lever).
    const [zt, yt] = c.screenTop;
    tube([0, yt - 0.13, zt - 0.07], [0, yt - 0.26, zt - 0.08], 0.002, MAT.black, root, 3);
    const fluff = new THREE.MeshStandardMaterial({ color: 0xff7ac8, roughness: 1 });
    for (const [x, dy, r] of [[-0.025, 0.28, 0.3], [0.03, 0.3, -0.4]]) {
      const die = rbox(0.045, 0.045, 0.045, 0.012, fluff, x, yt - dy, zt - 0.08, root);
      die.rotation.set(r, r * 0.7, 0.2);
    }
    add(new THREE.ConeGeometry(0.03, 0.07, 3).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0x3fae4a, roughness: 0.8 }), root).position.set(0.06, yt - 0.22, zt - 0.075);
    const [zs0, ys0] = c.screenBase;
    const t = 0.88; // the strip runs along the top of the glass
    const strip = label(1.2, 0.1, 600, (g, Wd, H) => {
      g.fillStyle = 'rgba(20,40,110,0.82)';
      g.fillRect(0, 0, Wd, H);
      g.fillStyle = '#f4f4f4';
      fitText(g, 'JESS', Wd / 2, H * 0.55, H * 0.7, Wd * 0.3);
    }, root);
    // Lying on the outside of the glass, read from in front, as a sun strip is.
    const along = new THREE.Vector3(0, yt - ys0, zt - zs0).normalize();
    const out = new THREE.Vector3(0, zs0 - zt, yt - ys0).normalize(); // square to the glass, outwards (forward and up)
    strip.position.set(0, ys0 + (yt - ys0) * t, zs0 + (zt - zs0) * t).addScaledVector(out, 0.006);
    faceAlong(strip, out, along);
  } else {
    // Amy's road atlas on the parcel shelf.
    rbox(0.24, 0.02, 0.3, 0.004, new THREE.MeshStandardMaterial({ color: 0x2a5aa8, roughness: 0.7 }), 0.3, upperAt(c, -1.3) + 0.02, -1.38, root);
  }

  // The front seats, the back seat and the parcel shelf.
  for (const [name, seat] of Object.entries(c.seats)) frontSeat(name, seat, trim, !fiesta, root);
  const rz = c.rear.rearLeft.z;
  rbox(1.1, 0.12, 0.46, 0.05, trim.seat, 0, c.rear.rearLeft.y - 0.07, rz + 0.12, root);
  rbox(1.1, 0.26, 0.4, 0.02, MAT.under, 0, 0.37, rz + 0.1, root);
  rbox(1.1, 0.55, 0.1, 0.05, trim.seat, 0, c.rear.rearLeft.y + 0.24, rz - 0.2, root).rotation.x = -0.18;
  rbox(W - 0.12, 0.02, 0.36, 0.005, trim.plastic, 0, upperAt(c, rz - 0.4), rz - 0.45, root); // the parcel shelf

  // The belts: a diagonal and lap belt for each of the four seats.
  // The front belts hang from the B pillars, the back ones from the rear quarters ahead of the hatch; the tops sit inside the glass.
  const outer = W / 2 - 0.1;
  const top = (seat) => halfAt(c, seat.y + 0.66) - 0.07;
  const post = c.bPillar + 0.04;
  addBelt(root, 'driver', c.seats.driver, -outer, -0.12, post, -top(c.seats.driver));
  addBelt(root, 'left', c.seats.left, outer, 0.12, post, top(c.seats.left));
  addBelt(root, 'rearLeft', c.rear.rearLeft, outer, 0.1, c.rear.rearLeft.z - 0.12, top(c.rear.rearLeft));
  addBelt(root, 'rearRight', c.rear.rearRight, -outer, -0.1, c.rear.rearRight.z - 0.12, -top(c.rear.rearRight));

  // The steering wheel on its column, raked well over: two spokes on the Fiesta, three on the Corsa.
  const column = new THREE.Group();
  column.name = 'steeringColumn';
  column.userData.keep = true;
  column.position.set(c.seats.driver.x, c.columnY, face); // out of the dash face, so the wheel stands clear in front of the binnacle
  column.rotation.x = -1.12;
  tube([0, -0.02, 0], [0, c.wheelOut - 0.02, 0], 0.03, MAT.black, column);
  rbox(0.08, 0.06, 0.1, 0.025, MAT.black, 0, 0.05, 0, column); // the shroud by the dash, with the key in its side (low, so the dials show over it)
  root.add(column);
  addSignalStalk(column, c.wheelOut - 0.06, MAT.black, { modern: !fiesta });
  if (fiesta) {
    // The Fiesta's hazard switch on top of the column in front of the wheel, tipped up to face the driver, as the Series III's.
    // On a pod standing up off the top of the column just ahead of the wheel: the column points almost at your eye, so it has to stand
    // well up off it to show over the wheel's boss, and near the wheel, since "up" off this raked column also leans into the binnacle.
    rbox(0.06, 0.05, 0.065, 0.015, MAT.black, 0, c.wheelOut - 0.05, 0.036, column);
    const top = new THREE.Vector3(0, c.wheelOut - 0.05, 0.07).applyEuler(column.rotation).add(column.position);
    const hazard = addHazardSwitch(root, top.x, top.y, top.z, { plate: false, w: 0.04, h: 0.03 });
    faceAlong(hazard, new THREE.Vector3(0, 0.75, -0.66), new THREE.Vector3(0, 0.66, 0.75));
  }
  const wheel = new THREE.Group();
  wheel.name = 'handlebars';
  wheel.userData.keep = true;
  wheel.position.set(0, c.wheelOut, 0); // its middle about 0.5 m ahead of the driver's hips, about 0.3 m out from the deep dash
  column.add(wheel);
  const rimR = fiesta ? 0.19 : 0.17; // Jess's is a small sports wheel, with a red mark at the top
  add(new THREE.TorusGeometry(rimR, fiesta ? 0.014 : 0.02, 8, 32).rotateX(Math.PI / 2), MAT.black, wheel);
  if (!fiesta) rbox(0.03, 0.044, 0.044, 0.01, MAT.red, 0, 0, rimR, wheel);
  rbox(fiesta ? 0.11 : 0.09, 0.04, fiesta ? 0.06 : 0.07, 0.02, MAT.black, 0, 0, 0, wheel); // the boss
  const spokes = fiesta ? [Math.PI / 2, -Math.PI / 2] : [Math.PI / 2, -Math.PI / 2, Math.PI];
  for (const a of spokes) tube([0, 0, 0], [Math.sin(a) * rimR, 0, Math.cos(a) * rimR], 0.012, MAT.black, wheel, 5);
  for (const side of [1, -1]) {
    const grip = new THREE.Object3D();
    grip.name = side > 0 ? 'gripLeft' : 'gripRight';
    grip.userData.keep = true;
    grip.position.set(side * rimR, 0, 0);
    wheel.add(grip);
  }
  const hands = new THREE.Group(); // your own arms aren't drawn: Quad just expects the group
  hands.name = 'riderHands';
  hands.userData.keep = true;
  hands.visible = false;
  wheel.add(hands);

  // The gear lever on the floor between the seats, the handbrake behind it, the pedals.
  const gear = new THREE.Group();
  gear.name = 'gearLever';
  gear.userData.keep = true;
  gear.position.set(0, 0.36, zs - 0.62);
  tube([0, 0, 0], [0, 0.26, 0], 0.008, MAT.steel, gear, 5);
  if (fiesta) add(new THREE.SphereGeometry(0.026, 12, 10), MAT.black, gear).position.set(0, 0.27, 0);
  else {
    // Jess's billet knob: a polished alloy barrel with a red top.
    add(new THREE.CylinderGeometry(0.022, 0.02, 0.06, 16), MAT.chrome, gear).position.set(0, 0.28, 0);
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16), MAT.red, gear).position.set(0, 0.314, 0);
  }
  root.add(gear);
  add(new THREE.CylinderGeometry(0.03, 0.06, 0.06, 12), MAT.rubber, root).position.set(0, 0.38, zs - 0.62); // its gaiter
  const hb = new THREE.Group();
  hb.name = 'parkBrakeLever';
  hb.userData.keep = true;
  hb.position.set(0, 0.405, c.seats.driver.z - 0.1); // pivoting at the back on top of the tunnel, the grip forward between the seats
  rbox(0.035, 0.03, 0.26, 0.012, MAT.black, 0, 0, 0.13, hb);
  rbox(0.014, 0.014, 0.02, 0.004, MAT.chrome, 0, 0.005, 0.27, hb); // the release button
  hb.rotation.x = HANDBRAKE_OFF;
  root.add(hb);
  const pedal = fiesta ? MAT.black : MAT.chrome; // Jess's are drilled alloy
  for (const [x, w] of [[-0.5, 0.06], [-0.38, 0.07], [-0.24, 0.04]]) rbox(w, 0.015, 0.1, 0.005, pedal, x, 0.36, zs - 0.18, root).rotation.x = -0.9; // clutch, brake, accelerator
  // The Fiesta's choke: a pull knob in the dash face on the inside of the column, below the binnacle, out on its cable towards you.
  const choke = new THREE.Group();
  choke.name = 'chokeKnob';
  choke.userData.keep = true;
  choke.position.set(c.seats.driver.x + 0.27, dashTop - 0.12, face - 0.02); // just inside the wheel's rim, where you see it
  choke.userData.baseZ = choke.position.z;
  if (fiesta) {
    tube([0, 0, 0.1], [0, 0, -0.03], 0.004, MAT.steel, choke, 6);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.022, 14).rotateX(Math.PI / 2), MAT.black, choke).position.set(0, 0, -0.04);
    add(new THREE.CircleGeometry(0.01, 12), new THREE.MeshBasicMaterial({ color: 0xe8e2c8 }), choke).position.set(0, 0, -0.0515); // its pale face
    choke.children[2].rotation.y = Math.PI;
  } else {
    choke.visible = false; // injected: no choke
  }
  root.add(choke);
  // Quad poses these on a quad; a car has neither a tap nor a thumb choke.
  for (const name of ['fuelTap', 'chokeLever']) {
    const g = new THREE.Group();
    g.name = name;
    g.userData.keep = true;
    g.visible = false;
    root.add(g);
  }

  // The exhaust: Amy's a plain pipe under the back, Jess's a big chrome can sticking out on the right.
  const tipAt = fiesta ? { x: -0.45, y: 0.22, z: c.tail - 0.06 } : { x: -0.5, y: 0.22, z: c.tail - 0.14 };
  if (fiesta) {
    tube([-0.4, 0.22, -0.6], [tipAt.x, tipAt.y, tipAt.z], 0.022, MAT.rust, root, 6);
  } else {
    tube([-0.4, 0.22, -0.6], [tipAt.x, tipAt.y, tipAt.z + 0.2], 0.03, MAT.rust, root, 6);
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 18, 1, true).rotateX(Math.PI / 2), MAT.chrome, root).position.set(tipAt.x, tipAt.y, tipAt.z + 0.08);
    add(new THREE.CircleGeometry(0.05, 18), MAT.black, root).position.set(tipAt.x, tipAt.y, tipAt.z - 0.02);
  }
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(tipAt.x, tipAt.y, tipAt.z);
  root.add(tip);

  // The seats' anchors: hips on the cushions, and where your eyes are in each.
  const cap = (n) => n[0].toUpperCase() + n.slice(1);
  const EYE = EYE_UP;
  for (const [name, seat] of [['riderAnchor', c.seats.driver], ['seatLeft', c.seats.left], ...Object.entries(c.rear).map(([n, s]) => [`seat${cap(n)}`, s])]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(seat.x, seat.y, seat.z);
    root.add(a);
  }
  for (const [name, seat] of [['cameraAnchor', c.seats.driver], ['cameraLeft', c.seats.left], ...Object.entries(c.rear).map(([n, s]) => [`camera${cap(n)}`, s])]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(seat.x, seat.y + EYE, seat.z + 0.02);
    root.add(a);
  }

  for (const w of layout.wheels) {
    const wheelModel = buildWheel(w, kind, c.R, !fiesta && w.name === 'wheel_rr');
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }

  addHeadlightBeams(quad);
  addSignalLamps(quad, MAT.amber, MAT.clear);
  quad.userData.tailMaterial = tailMat;
  quad.userData.tailHaloMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
  quad.userData.tailHalos = [];
  mergeStatic(root);
  // The inside never gets muddy (vehicle mud coat, effects/mudCoat.js): only what's outside does.
  quad.userData.cleanMaterials = [trim.seat, trim.bucket, trim.floor, trim.plastic, trim.dash, trim.lining, MAT.belt];
  // Painted inside surfaces too (door skins, pillars, the roof's underside): inside this box, faces toward its middle stay clean.
  quad.userData.cabin = { min: [-c.width / 2, c.sill, c.hatchBottom[0]], max: [c.width / 2, c.screenTop[1] + 0.1, c.screenBase[0]] };
  // Only the outside casts a shadow (the inside is in the body's shadow anyway): half the shadow pass's draw calls and triangles.
  const casts = new Set([paint, faded, MAT.rubber, MAT.black, MAT.primer, MAT.under, MAT.chrome]);
  quad.traverse((o) => {
    if (!o.isMesh || o.material === MAT.glass) return;
    o.castShadow = casts.has(o.material);
    o.receiveShadow = true;
  });
  return quad;
}

/** The front backrests tipped forward, 0 (upright) to 1 (right forward), by seat name ({ left, driver }). */
export function poseCarSeats(model, tips) {
  for (const name of CAR_TIPPING_SEATS) {
    const back = model.getObjectByName(`seatBack_${name}`);
    if (back) back.rotation.x = SEAT_TIP * Math.min(1, Math.max(0, tips[name] ?? 0));
  }
}

/** The gear lever in its H (four gears or five, as the Land Rovers'), the choke knob pulled out, the handbrake up or down. */
export function poseCarControls(model, { gear = 0, gears = 4, choke = 0, park = false }) {
  const g = model.getObjectByName('gearLever');
  if (!g) return;
  const pose = gearLeverPose(gear, gears);
  g.rotation.set(pose.along, 0, pose.across);
  const knob = model.getObjectByName('chokeKnob');
  knob.position.z = knob.userData.baseZ - KNOB_TRAVEL * choke;
  const hb = model.getObjectByName('parkBrakeLever');
  hb.rotation.x += ((park ? HANDBRAKE_ON : HANDBRAKE_OFF) - hb.rotation.x) * 0.3;
}
