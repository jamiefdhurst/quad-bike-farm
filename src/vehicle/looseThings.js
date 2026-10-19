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
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A loose thing at rest on its spot: offset from the spot in metres, the way it is heading, its twist and how far it has been tipping. */
export function newLoose(random = Math.random) {
  return { x: 0, z: 0, dir: random() * Math.PI * 2, twist: 0, tip: 0, tipped: false };
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
