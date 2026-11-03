// Loose things walk on a shaking vehicle: the mug on a rack creeps towards the edge, the toolbox shuffles in the bed, a can tips over.
// The shake is the vehicle's own (`vibration.intensity`, the smoothed 0..1-ish level), so a rough cold single does it standing still and a
// smooth warm one does not. Pure logic, no Three.js: game.js moves the models to what this says. (Not creep.js: that is the tractor
// walking off on its own.)

export const DEFAULT_LOOSE_PARAMS = {
  shakeFrom: 0.3, // shake level under which nothing moves
  rate: 0.025, // metres a second a loose thing creeps at one shake level above shakeFrom
  wander: 1.2, // radians a second its heading drifts by, so it does not walk straight
  rackX: 0.24, // half the width of the rack a mug stands on, metres: past it the mug is off
  rackZ: 0.2, // half its depth
  bedSlack: 0.04, // metres a thing in a bed can shuffle from its spot
  bedTwist: 0.25, // radians it can turn from the way it was stood
  tipFrom: 0.9, // shake level that tips a can over, if it lasts
  tipSeconds: 12, // seconds of that to do it
  slideFriction: 0.35, // of gravity: a load in a tub or load space slides when the corner, the brakes or a slope push it harder than this
  slideTipSpeed: 0.45, // m/s: a can that hits the wall at this speed goes over
  edgeBalance: 0.07, // metres: a load with its middle this close to an open tailgate's edge goes over it on a bump
  edgeShake: 0.8, // shake level that does it
};

export const LOOSE_PARAM_RANGES = {
  shakeFrom: [0, 2, 0.05],
  rate: [0, 0.3, 0.005],
  wander: [0, 5, 0.1],
  rackX: [0.05, 0.6, 0.01],
  rackZ: [0.05, 0.6, 0.01],
  bedSlack: [0, 0.15, 0.005],
  bedTwist: [0, 1, 0.05],
  tipFrom: [0, 3, 0.05],
  tipSeconds: [1, 120, 1],
  slideFriction: [0.05, 1.5, 0.01],
  slideTipSpeed: [0.1, 3, 0.05],
  edgeBalance: [0, 0.3, 0.01],
  edgeShake: [0, 3, 0.05],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A loose thing at rest on its spot: offset from the spot in metres, the way it is heading, its twist and how far it has been tipping. */
export function newLoose(random = Math.random) {
  return { x: 0, z: 0, dir: random() * Math.PI * 2, twist: 0, tip: 0, tipped: false, sx: 0, sz: 0, vx: 0, vz: 0 };
}

/** How hard the shake is pushing: 0 under the threshold. */
export const looseDrive = (shake, p = DEFAULT_LOOSE_PARAMS) => Math.max(0, shake - p.shakeFrom);

/** One step: it creeps along its heading, which wanders. Moves `s` and returns it. */
export function creepStep(s, dt, shake, p = DEFAULT_LOOSE_PARAMS, random = Math.random) {
  const drive = looseDrive(shake, p);
  if (drive <= 0) return s;
  s.dir += (random() - 0.5) * 2 * p.wander * dt;
  s.x += Math.cos(s.dir) * p.rate * drive * dt;
  s.z += Math.sin(s.dir) * p.rate * drive * dt;
  return s;
}

/** Whether a mug that has crept this far is off the edge of the rack. */
export const offRack = (s, p = DEFAULT_LOOSE_PARAMS) => Math.abs(s.x) > p.rackX || Math.abs(s.z) > p.rackZ;

/** In a bed it shuffles about its spot and turns a little, but is held in: it heads back when it reaches the slack. */
export function shuffleStep(s, dt, shake, p = DEFAULT_LOOSE_PARAMS, random = Math.random) {
  const drive = looseDrive(shake, p);
  if (drive <= 0) return s;
  creepStep(s, dt, shake, p, random);
  if (Math.abs(s.x) > p.bedSlack || Math.abs(s.z) > p.bedSlack) s.dir += Math.PI;
  s.x = clamp(s.x, -p.bedSlack, p.bedSlack);
  s.z = clamp(s.z, -p.bedSlack, p.bedSlack);
  s.twist = clamp(s.twist + (random() - 0.5) * 2 * drive * dt, -p.bedTwist, p.bedTwist);
  return s;
}

/** A can shaken hard for long enough goes over. A lull eases the count back, but once over it stays over until it is picked up. */
export function tipStep(s, dt, shake, p = DEFAULT_LOOSE_PARAMS) {
  if (s.tipped) return s;
  s.tip = shake >= p.tipFrom ? s.tip + dt : Math.max(0, s.tip - dt * 0.5);
  if (s.tip >= p.tipSeconds) s.tipped = true;
  return s;
}

const G = 9.81;

/**
 * What pushes a load across a floor, in the vehicle's own frame (x to its left, z forward), metres a second squared: the opposite of how
 * the vehicle itself is accelerating (a corner throws things outwards, braking throws them forward), plus the slope's share of gravity.
 * `accel` is the vehicle's acceleration in that frame, `gravity` the world's down in that frame (nothing on the level).
 */
export function floorPush(accel, gravity = { x: 0, z: 0 }) {
  return { x: gravity.x - accel.x, z: gravity.z - accel.z };
}

/**
 * One step of a load sliding on the floor it stands on. `s.sx`, `s.sz` is how far it has moved from its spot, `s.vx`, `s.vz` how fast;
 * `limits` is how far it can go each way (`minX`, `maxX`, `minZ`, `maxZ`, offsets from the spot). It stays put until the push beats
 * friction, slides while it does, and stops at a wall. Returns the speed it hit a wall at (0 if it did not).
 */
export function slideStep(s, dt, push, limits, p = DEFAULT_LOOSE_PARAMS) {
  const mu = p.slideFriction * G;
  const mag = Math.hypot(push.x, push.z);
  const speed = Math.hypot(s.vx, s.vz);
  if (speed < 1e-4 && mag <= mu) return 0;
  const ox = s.vx;
  const oz = s.vz;
  let ax = push.x;
  let az = push.z;
  const fx = speed > 1e-4 ? s.vx / speed : push.x / mag;
  const fz = speed > 1e-4 ? s.vz / speed : push.z / mag;
  ax -= mu * fx;
  az -= mu * fz;
  s.vx += ax * dt;
  s.vz += az * dt;
  if (mag <= mu && s.vx * ox + s.vz * oz <= 0) s.vx = s.vz = 0; // friction brought it to rest rather than turning it round
  s.sx += s.vx * dt;
  s.sz += s.vz * dt;
  let hit = 0;
  if (s.sx > limits.maxX || s.sx < limits.minX) {
    hit = Math.max(hit, Math.abs(s.vx));
    s.sx = clamp(s.sx, limits.minX, limits.maxX);
    s.vx = 0;
  }
  if (s.sz > limits.maxZ || s.sz < limits.minZ) {
    hit = Math.max(hit, Math.abs(s.vz));
    s.sz = clamp(s.sz, limits.minZ, limits.maxZ);
    s.vz = 0;
  }
  return hit;
}

/** A can that slides into a wall hard enough goes over, and stays over until it is picked up. */
export function slideTip(s, hitSpeed, p = DEFAULT_LOOSE_PARAMS) {
  if (hitSpeed >= p.slideTipSpeed) s.tipped = true;
  return s;
}

/**
 * Whether a load falls out of the open back. `past` is how far its middle is over the edge in metres (negative: still inside): over it
 * goes at once, and one sat right on it goes on a bump.
 */
export function fallsOut(past, shake, p = DEFAULT_LOOSE_PARAMS) {
  if (past >= 0) return true;
  return -past < p.edgeBalance && shake >= p.edgeShake;
}
