// What every dash and pod reads, apart from the plain engine numbers. Pure, so it's tested without Three.js.

import { HOT_FROM, tempGaugeFraction } from './tempGauge.js';

const METRES_PER_MILE = 1609.34;

export const NEUTRAL_BELOW_MPS = 0.3; // stopped, for the N lamp

/** A random starting reading from a spec's [min, max] range (hoursRange, odoRange). */
export function pickReading(range, random) {
  const [lo, hi] = range;
  return lo + (hi - lo) * random();
}

/** Like `pickReading`, but pulled towards where a related reading sits in its own range (`t`, 0 low to 1 high), `weight` of the way. */
export function pickRelatedReading(range, t, random, weight = 0.7) {
  return pickReading(range, () => weight * t + (1 - weight) * random());
}

/** Running hours and odometer, advanced by one frame. Hours count only while the engine runs. */
export function advanceUsage(usage, { running, speedMps, dt }) {
  if (running) usage.hours += dt / 3600;
  usage.odoMiles += (Math.abs(speedMps) * dt) / METRES_PER_MILE;
  return usage;
}

/** On these automatics, neutral is "idling and going nowhere": ignition on, not in reverse, stopped, clutch not biting. */
export function isNeutral({ ignition, reverse, speedMps, rpm, clutchEngageRpm }) {
  return !!ignition && !reverse && Math.abs(speedMps) < NEUTRAL_BELOW_MPS && rpm < clutchEngageRpm;
}

/** The warning lamps. All dark with the ignition off or the battery flat. */
export function lampStates(s) {
  const on = !!s.ignition;
  return {
    r: on && !!s.reverse,
    n: on && !!s.neutral,
    temp: on && tempGaugeFraction(s.temperature, true, s.overheat) >= HOT_FROM,
    fuel: on && s.fuelLevel <= s.reserveLevel,
  };
}

/** A mechanical or LCD counter's digits: the whole number padded to `digits`, then tenths as a separate digit. */
export function counterDigits(value, digits) {
  const tenths = Math.floor(Math.max(0, value) * 10);
  const whole = Math.floor(tenths / 10) % 10 ** digits;
  return { whole: String(whole).padStart(digits, '0'), tenth: String(tenths % 10) };
}

/** "123.4" style text for the LCD lines. */
export function counterText(value, digits) {
  const { whole, tenth } = counterDigits(value, digits);
  return `${whole.replace(/^0+(?=\d)/, '')}.${tenth}`;
}

export const CLOCK_START_RANGE = [8 * 3600, 10.5 * 3600]; // seconds after midnight

/** The dashboard clock: starts at a random morning time and runs in real time. */
export class DashClock {
  constructor(startSeconds, now = () => Date.now() / 1000) {
    this.start = startSeconds;
    this.now = now;
    this.t0 = now();
  }

  seconds() {
    return (this.start + (this.now() - this.t0)) % 86400;
  }

  text() {
    const s = Math.floor(this.seconds());
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/** Which of `count` lines shows now when each gets `period` seconds in turn. */
export function cycleIndex(seconds, count, period = 4) {
  return Math.floor(seconds / period) % count;
}

// One clock for every dash and pod in the game, set at the start from the seed.
let shared = new DashClock(9 * 3600);
export const setDashClock = (clock) => {
  shared = clock;
};
export const dashClock = () => shared;

/** The gear a digital dash shows: the gear number on a manual quad (R, N, 1..4), otherwise R, N or D for an automatic's drive. */
export function gearShown(s) {
  return s.gear ?? (s.reverse ? 'R' : s.neutral ? 'N' : 'D');
}
