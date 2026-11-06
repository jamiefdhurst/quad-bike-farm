// The girls working a vehicle's controls as you have to: indicators before a turn, brakes pumped dry after water, a quad put back in 2WD when
// she gets off, the lights off when she parks, and Amy opening the sediment bowl's drain. Pure logic, no Three.js: herDriving.js and game.js
// ask, and do the pressing.

export const DEFAULT_GIRL_CONTROLS_PARAMS = {
  signalTurn: 0.6, // radians: a turn at least this sharp coming up and she signals it (about 35 degrees)
  signalWithin: 16, // metres before the turn she puts the indicator on
  signalGive: 9, // seconds after which a stalk that has not cancelled itself (the turn never came) is put off by hand
  pumpWet: 0.35, // wetness (0..1) of her brakes before she pumps them dry
  pumpSpeed: 2, // m/s: she needs to be rolling for the pads to wipe
  pumpEvery: 0.9, // seconds from one dab of the brake to the next
  pumpHold: 0.35, // share of that she holds each dab
  pumpBrake: 0.4, // how hard she dabs it (0..1)
  remarkWet: 0.5, // wetness at which she says her brakes are wet
  bowlFrom: 0.25, // how full of water (0..1) the sediment bowl has to be before Amy opens the drain
  darkAbove: 0.5, // how dark before she puts the lights on to drive
};

export const GIRL_CONTROLS_PARAM_RANGES = {
  signalTurn: [0.2, 1.5, 0.05],
  signalWithin: [4, 40, 1],
  signalGive: [3, 30, 1],
  pumpWet: [0.05, 1, 0.05],
  pumpSpeed: [0.5, 8, 0.1],
  pumpEvery: [0.3, 3, 0.05],
  pumpHold: [0.1, 0.8, 0.05],
  pumpBrake: [0.1, 1, 0.05],
  remarkWet: [0.1, 1, 0.05],
  bowlFrom: [0.05, 1, 0.05],
  darkAbove: [0, 1, 0.05],
};

export const GIRL_CONTROLS_PARAMS = { ...DEFAULT_GIRL_CONTROLS_PARAMS }; // shared by the drivers and game.js, registered once

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Which way to signal for the corner at `wp`: `from` is where she is, `next` the point after. 'left' (positive heading change, as the bars),
 * 'right', or null if it is not a sharp enough turn or not near enough yet. Headings are as a quad's yaw: atan2(dx, dz).
 */
export function signalFor(from, wp, next, dist, P = GIRL_CONTROLS_PARAMS) {
  if (!next || dist > P.signalWithin) return null;
  const turn = wrap(Math.atan2(next.x - wp.x, next.z - wp.z) - Math.atan2(wp.x - from.x, wp.z - from.z));
  if (Math.abs(turn) < P.signalTurn) return null;
  return turn > 0 ? 'left' : 'right';
}

/**
 * The brake she dabs to wipe wet brakes dry (0 when she has no need): `t` is seconds into the drive, `wet` the brakes' wetness, `speed` m/s.
 * The pads wipe the discs only when braking at speed (brakeState.js), so she taps it now and then rather than holding it.
 */
export function pumpBrake(t, wet, speed, P = GIRL_CONTROLS_PARAMS) {
  if (wet < P.pumpWet || speed < P.pumpSpeed) return 0;
  return (t % P.pumpEvery) / P.pumpEvery < P.pumpHold ? P.pumpBrake : 0;
}

/** Whether to say the brakes are wet: they have crossed `remarkWet` upwards since the last look. Returns the new `said` along with it. */
export function wetRemark(said, wet, P = GIRL_CONTROLS_PARAMS) {
  if (wet < P.remarkWet * 0.5) return { say: false, said: false };
  if (said || wet < P.remarkWet) return { say: false, said };
  return { say: true, said: true };
}

/** Whether Amy opens a quad's sediment bowl drain: it has water in it, and the quad has a tap with a bowl to drain. */
export function bowlNeedsDraining(fuel, P = GIRL_CONTROLS_PARAMS) {
  return !!fuel && !fuel.params?.noTap && fuel.sediment >= P.bowlFrom;
}

/** A vehicle with a light switch she put on at dusk: on when she drives in the dark, off again once she has parked (not for the work light). */
export function lightsWanted(driving, dark, mode, keepOn, P = GIRL_CONTROLS_PARAMS) {
  if (driving) return dark >= P.darkAbove && mode === 'off' ? 'low' : null;
  return mode !== 'off' && !keepOn ? 'off' : null;
}
