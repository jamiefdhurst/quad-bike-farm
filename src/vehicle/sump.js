// The engine oil in a four-stroke's sump. Each game one quad burns oil (blue smoke on the overrun), the rest lose a trickle, and a
// low sump ticks, then knocks, then seizes: the engine's own scuffing (see engine/lubrication.js) does the knocking and seizing, this
// is the level it reads. A dipstick tells you where it is; a bottle tops it up. Pure logic, no Three.js.

export const DEFAULT_SUMP_PARAMS = {
  burnerLow: 0.45, // the oil burner starts the game with its sump somewhere in this range (1 is the top mark)...
  burnerHigh: 0.8,
  normalLow: 0.55, // ...and the others from this range, so now and then one is low without being the burner
  normalHigh: 1,
  burnPerWork: 0.0012, // level the burner loses a second at full work (half the sump in about fourteen minutes of riding)
  trickle: 0.00002, // and the others (a few hours of riding to go from the top mark to the bottom one)
  minMark: 0.3, // the bottom mark on the dipstick
  lampFrom: 0.18, // the OIL lamp lights while it's running under this level (it flickers at idle, where the pressure is lowest)
  burnSmokeFrom: 0.02, // overrun throttle at which a burner's blue smoke shows
  pourRate: 0.06, // level a second added from a bottle (about fifteen seconds from the bottom mark to the top)
  readNoise: 0.04, // how closely you can read a stick: it reads to about this much either way, never more than the real level
  bottleRange: 8, // metres a quad can be from the oil bottle for you to top it up from it
  amyTopUpMargin: 0.15, // Amy tops it up if it's under the bottom mark by this much or less above it (she likes it well up)
  amyChecks: 0.9, // chance Amy checks the dipstick before she rides a quad (Jess never does)
};

export const SUMP_PARAM_RANGES = {
  burnerLow: [0.1, 1, 0.05],
  burnerHigh: [0.1, 1, 0.05],
  normalLow: [0.1, 1, 0.05],
  normalHigh: [0.1, 1, 0.05],
  burnPerWork: [0, 0.01, 0.0001],
  trickle: [0, 0.001, 0.00001],
  minMark: [0.05, 0.6, 0.01],
  lampFrom: [0.02, 0.5, 0.01],
  burnSmokeFrom: [0, 0.3, 0.01],
  pourRate: [0.005, 0.5, 0.005],
  readNoise: [0, 0.2, 0.01],
  bottleRange: [1, 30, 0.5],
  amyTopUpMargin: [0, 0.5, 0.01],
  amyChecks: [0, 1, 0.05],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Whether a vehicle has a sump to speak of: every four-stroke, petrol or diesel (the two-strokes mix theirs in the petrol). */
export function hasSump({ strokes = 4 }) {
  return strokes !== 2;
}

/** Which of the quads with a sump burns oil this game: one, picked from the seed's random. Returns the id, or null if there are none. */
export function pickBurner(ids, random) {
  return ids.length ? ids[Math.floor(random() * ids.length)] : null;
}

/** One sump's starting level. */
export function startLevel(burner, random, P = DEFAULT_SUMP_PARAMS) {
  return burner ? lerp(P.burnerLow, P.burnerHigh, random()) : lerp(P.normalLow, P.normalHigh, random());
}

export class Sump {
  /** `burner`: this is the quad that burns oil. */
  constructor({ level = 1, burner = false, params = DEFAULT_SUMP_PARAMS } = {}) {
    this.level = clamp(level, 0, 1);
    this.burner = burner;
    this.params = params;
    this.checked = false; // somebody has had the stick out since the engine last ran
  }

  /** Burns oil for a step. `work` is how hard the engine's going, 0..1, as the engine's lubrication reckons it. */
  step(dt, { running, work }) {
    if (!running) return;
    const P = this.params;
    this.level = Math.max(0, this.level - dt * (this.burner ? P.burnPerWork * work : P.trickle * (0.3 + work)));
    this.checked = false;
  }

  /** Oil from a bottle. Returns the level taken (0 when it's already at the top mark). */
  pour(dt) {
    const added = Math.min(1 - this.level, this.params.pourRate * dt);
    this.level += added;
    return added;
  }

  /** Straight to the top mark: Amy topping it up, or a finished bench job. */
  fill() {
    this.level = 1;
  }

  /** Below the bottom mark, where Amy would top it up. */
  get low() {
    return this.level < this.params.minMark;
  }

  /** The blue smoke on the overrun: only the burner's, with the throttle shut and the wheels turning the engine over, and more as it gets low. */
  burnSmoke(throttle, rpmAboveIdle) {
    if (!this.burner || this.level <= 0.02 || throttle > this.params.burnSmokeFrom) return 0;
    return clamp(rpmAboveIdle / 2000, 0, 1) * clamp(0.4 + (1 - this.level), 0, 1);
  }
}

/**
 * The oil pressure lamp: lit with the ignition on and the engine not running (no pressure yet), and while it's running with the sump
 * low. Pressure is lowest at idle, so there it flickers, and once it's revved the lamp goes out unless the sump is very low.
 * `t` is the time in seconds, for the flicker. The dash adds the ignition: it's dark with the key off.
 */
export function oilPressureLamp({ running, level, rpm, idleRpm, t }, P = DEFAULT_SUMP_PARAMS) {
  if (!running) return true;
  if (level >= P.lampFrom) return false;
  if (rpm > idleRpm * 1.6) return level < P.lampFrom * 0.6;
  return Math.sin(t * 9) + Math.sin(t * 5.3) > -0.6;
}

/**
 * What the dipstick shows, from the real level and a little noise (`noise` is -1..1, so a reading is never a lie by more than readNoise).
 * Returns { reading: 0..1 (what you make of it), text }.
 */
export function readStick(level, noise = 0, P = DEFAULT_SUMP_PARAMS) {
  const reading = clamp(level + noise * P.readNoise, 0, 1);
  let text;
  if (reading < 0.03) text = 'Nothing on the stick at all';
  else if (reading < P.minMark - 0.08) text = 'Well below the bottom mark';
  else if (reading < P.minMark) text = 'Just below the bottom mark';
  else if (reading < P.minMark + 0.15) text = 'On the bottom mark: it wants some';
  else if (reading < 0.85) text = 'Between the marks';
  else text = 'Up to the top mark';
  return { reading, text };
}
