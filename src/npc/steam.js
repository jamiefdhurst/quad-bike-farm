// Hot tea in the hand and on the rack: how warm it is, how much it steams, and the moves of a girl holding a mug in both hands. Pure logic
// (items/mug.js draws the wisp, npc/companionCupping.js poses her): the game says how long ago it was poured and what the air is doing.

export const DEFAULT_STEAM_PARAMS = {
  teaStartC: 80, // °C a mug of tea is when it is poured
  coolHalfLife: 200, // seconds for the tea to lose half the heat it has over the air
  steamStopC: 48, // °C below which it no longer steams
  steamFullC: 70, // °C above which it steams as much as it will
  coldFullC: 2, // °C of air at which the wisp is at its thickest
  warmWeakC: 24, // °C of air at which it is at its thinnest (still there, if the tea is hot)
  warmFloor: 0.35, // how much of the full wisp a warm day still shows
  windBend: 0.09, // metres the wisp leans sideways per metre per second of wind, at the top
  windBendMax: 0.22, // the most it leans, in metres
  sipEvery: 11, // seconds she holds the mug at her chest between drinks
  sipLift: 0.9, // seconds to bring the mug up to her mouth
  sipHold: 1.6, // seconds she drinks
  sipLower: 0.9, // seconds to bring it down again
};

export const STEAM_PARAM_RANGES = {
  teaStartC: [50, 100, 1],
  coolHalfLife: [20, 1200, 10],
  steamStopC: [20, 70, 1],
  steamFullC: [30, 100, 1],
  coldFullC: [-10, 15, 1],
  warmWeakC: [10, 40, 1],
  warmFloor: [0, 1, 0.05],
  windBend: [0, 0.5, 0.01],
  windBendMax: [0, 0.6, 0.01],
  sipEvery: [2, 60, 1],
  sipLift: [0.2, 3, 0.1],
  sipHold: [0.2, 6, 0.1],
  sipLower: [0.2, 3, 0.1],
};

/** The live copy the debug panel tunes (the girls' poses read it each frame). */
export const steamParams = { ...DEFAULT_STEAM_PARAMS };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (t) => t * t * (3 - 2 * t);

/** °C of tea poured `age` seconds ago, cooling towards the air's. */
export function teaTemperature(age, airC, p = DEFAULT_STEAM_PARAMS) {
  return airC + (p.teaStartC - airC) * Math.pow(0.5, Math.max(0, age) / p.coolHalfLife);
}

/** 0..1, how thick the wisp is: none once the tea has cooled, more the hotter it is and the colder the day. */
export function steamAmount(teaC, airC, p = DEFAULT_STEAM_PARAMS) {
  const heat = smooth(clamp01((teaC - p.steamStopC) / Math.max(1e-6, p.steamFullC - p.steamStopC)));
  const cold = clamp01((p.warmWeakC - airC) / Math.max(1e-6, p.warmWeakC - p.coldFullC));
  return heat * (p.warmFloor + (1 - p.warmFloor) * cold);
}

/** How far the top of the wisp leans downwind, as a world offset { x, z } in metres, from the wind's velocity in m/s. */
export function steamLean(wind, p = DEFAULT_STEAM_PARAMS) {
  const speed = Math.hypot(wind.x, wind.z);
  if (speed < 1e-6) return { x: 0, z: 0 };
  const lean = Math.min(p.windBendMax, speed * p.windBend);
  return { x: (wind.x / speed) * lean, z: (wind.z / speed) * lean };
}

/**
 * Where a puff of steam is as it rises: `rise` 0 at the mug's lip to 1 at the top of the wisp, `phase` a number that makes each puff and each
 * mug a little different, `t` seconds. Weaves side to side in a thin wave and leans downwind more the higher it is. Offsets in metres from the
 * lip, `height` the wisp's full height.
 */
export function wispOffset(rise, phase, t, lean, height = 0.22) {
  const sway = Math.sin(rise * 7 + t * 2.2 + phase) * 0.012 * (0.3 + rise);
  const sway2 = Math.cos(rise * 5.5 + t * 1.7 + phase * 1.3) * 0.01 * (0.3 + rise);
  const bend = rise * rise;
  return { x: sway + lean.x * bend, y: rise * height, z: sway2 + lean.z * bend };
}

/**
 * Her mug held in both hands. `t` is seconds since she took it; returns `lift`, 0 with it at her chest to 1 at her mouth, and `drinking` while
 * it is up. She holds it for `sipEvery` seconds (starting a little way in, so she does not drink the moment it is poured), then lifts, drinks and lowers.
 */
export function cupLift(t, p = DEFAULT_STEAM_PARAMS) {
  const cycle = p.sipEvery + p.sipLift + p.sipHold + p.sipLower;
  const u = (((t + p.sipEvery * 0.5) % cycle) + cycle) % cycle;
  const a = p.sipEvery;
  if (u < a) return { lift: 0, drinking: false };
  if (u < a + p.sipLift) return { lift: smooth((u - a) / p.sipLift), drinking: false };
  if (u < a + p.sipLift + p.sipHold) return { lift: 1, drinking: true };
  return { lift: smooth(1 - (u - a - p.sipLift - p.sipHold) / p.sipLower), drinking: false };
}

/** A pat on the tank: the hand comes down flat, pats `pats` times and lifts away. `t` 0..1 through it; `press` 1 with the palm on the metal, 0 clear of it; `reach` how near the tank the hand is. */
export function patStroke(t, pats = 3) {
  if (t <= 0 || t >= 1) return { press: 0, reach: 0 };
  const reach = smooth(clamp01(t / 0.2)) * smooth(clamp01((1 - t) / 0.2));
  const beat = 0.5 - 0.5 * Math.cos(clamp01((t - 0.15) / 0.7) * pats * Math.PI * 2);
  return { press: reach * beat, reach };
}
