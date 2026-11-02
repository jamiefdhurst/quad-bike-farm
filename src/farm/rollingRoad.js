// The rolling road: a tuner's trailer with rollers that comes to the farm about once a week. You ride a quad onto it, pay for a run, and it
// holds the throttle and sweeps the revs while the real engine model says how much power it makes; the answer is a peak figure against the
// quad's stock one. Pure: no Three.js or DOM, the game feeds it the engine and draws what it says. Tested in tests/rollingRoad.test.js.
// docs/decisions/vehicles.md, "A rolling road day (#62, was TODO 167)".

import { createRandom } from '../core/random.js';

export const DEFAULT_ROAD_PARAMS = {
  everyDays: 7, // a rolling road day comes about once in this many farm days (0 turns it off); the first day of a new farm is one
  arriveHour: 9.5, // the hour the tuner turns up (a farm that starts later has her there within a minute)
  leaveHour: 17.5, // and the hour she packs up
  price: 15, // pounds from the tin for one run
  settleSeconds: 1.5, // the engine held at its starting revs before the sweep, so the first figure is steady
  sweepSeconds: 9, // the throttle opens from startThrottle to full over this long
  coolSeconds: 2.5, // and shuts again over this long afterwards
  startThrottle: 0.22, // the throttle at the bottom of the sweep (0 to 1)
  rollerLoad: 0.55, // the engine load the rollers put on it (0 to 1)
  sampleEvery: 0.25, // seconds between points on the curve
  peakAt: 0.775, // the share of full revs a stock engine makes its peak power at
  stockWithin: 0.5, // bhp: a result this close to stock reads as stock
  gainCheers: 1, // bhp over stock at which the girls cheer
  keptRuns: 6, // runs the farm keeps for each quad
  sheetRuns: 3, // and the wall sheet draws the latest of
};

export const ROAD_PARAM_RANGES = {
  everyDays: [0, 30, 1],
  arriveHour: [6, 14, 0.25],
  leaveHour: [14, 22, 0.25],
  price: [0, 100, 1],
  settleSeconds: [0.5, 5, 0.1],
  sweepSeconds: [4, 20, 0.5],
  coolSeconds: [0.5, 8, 0.1],
  startThrottle: [0.05, 0.6, 0.01],
  rollerLoad: [0.1, 1, 0.01],
  sampleEvery: [0.05, 1, 0.05],
  peakAt: [0.5, 0.95, 0.01],
  stockWithin: [0, 3, 0.1],
  gainCheers: [0, 10, 0.1],
  keptRuns: [1, 20, 1],
  sheetRuns: [1, 6, 1],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The revs a quad's engine makes at full throttle as dealt: the middle of its spec's range. */
export function stockRpm(spec) {
  const r = spec.topRpmRange;
  return r ? (r[0] + r[1]) / 2 : 6200;
}

/** A quad the tuner can strap down: it has a stock figure. */
export const canRun = (spec) => !!spec && Number.isFinite(spec.stockBhp);

// The shape of an engine's power across its revs, as a share of its peak: it climbs, tops out at `peakAt` of full revs and falls away
// (the torque dies at the top, so revs past stock gain nothing).
const shape = (x, peakAt) => {
  const k = 2 * peakAt; // x * (k - x) peaks at x = k / 2
  return Math.max(0, x * (k - x)) / (peakAt * peakAt);
};

/**
 * The power an engine makes at `rpm` in bhp. `power` is the engine model's own 0..1+ measure of its health and the day's air (cold, fouled,
 * lean, worn, iced and the rest all lower it), `stockBhp` and `fullRpm` what a healthy stock one makes and revs to.
 */
export function bhpAt({ rpm, power, stockBhp, fullRpm }, p = DEFAULT_ROAD_PARAMS) {
  return Math.max(0, stockBhp * power * shape(rpm / fullRpm, p.peakAt));
}

/** The torque in lb ft that goes with a power and the revs it is made at (the old sum: bhp x 5252 / rpm). */
export const torqueOf = (bhp, rpm) => (rpm > 100 ? (bhp * 5252) / rpm : 0);

/**
 * One run under way. The game calls `update(dt, { rpm, power, running })` each frame and applies the `throttle` and `load` it returns to the
 * engine (`quad.pto`); events come back: `{ type: 'sweep' }` as the throttle starts to open, `{ type: 'done', result }` and
 * `{ type: 'stalled' }` if the engine cuts out (the run is dropped).
 */
export class RollingRun {
  constructor({ spec, params = DEFAULT_ROAD_PARAMS }) {
    this.spec = spec;
    this.p = params;
    this.phase = 'settle'; // settle, sweep, cool, done, stalled
    this.t = 0;
    this.throttle = params.startThrottle;
    this.load = params.rollerLoad;
    this.rpm = 0;
    this.points = []; // [{ rpm, bhp }]
    this.sinceSample = 0;
    this.fullRpm = stockRpm(spec);
    this.result = null;
  }

  /** How far through the whole run, 0..1. */
  get progress() {
    const p = this.p;
    const total = p.settleSeconds + p.sweepSeconds + p.coolSeconds;
    const done = this.phase === 'settle' ? this.t : this.phase === 'sweep' ? p.settleSeconds + this.t : p.settleSeconds + p.sweepSeconds + this.t;
    return this.phase === 'done' ? 1 : clamp(done / total, 0, 1);
  }

  get active() {
    return this.phase === 'settle' || this.phase === 'sweep' || this.phase === 'cool';
  }

  update(dt, { rpm, power, running }) {
    const events = [];
    if (!this.active) return events;
    const p = this.p;
    if (!running) {
      this.phase = 'stalled';
      this.throttle = 0;
      this.load = 0;
      events.push({ type: 'stalled' });
      return events;
    }
    this.rpm = rpm;
    this.t += dt;
    if (this.phase === 'settle') {
      this.throttle = p.startThrottle;
      if (this.t >= p.settleSeconds) {
        this.phase = 'sweep';
        this.t = 0;
        events.push({ type: 'sweep' });
      }
    } else if (this.phase === 'sweep') {
      const k = clamp(this.t / p.sweepSeconds, 0, 1);
      this.throttle = p.startThrottle + (1 - p.startThrottle) * k;
      this.sinceSample += dt;
      if (this.sinceSample >= p.sampleEvery) {
        this.sinceSample = 0;
        this.points.push({ rpm, bhp: bhpAt({ rpm, power, stockBhp: this.spec.stockBhp, fullRpm: this.fullRpm }, p) });
      }
      if (this.t >= p.sweepSeconds) {
        this.phase = 'cool';
        this.t = 0;
        this.result = runResult(this.spec, this.points, p);
      }
    } else if (this.phase === 'cool') {
      const k = clamp(this.t / p.coolSeconds, 0, 1);
      this.throttle = (1 - k) * 0.5;
      this.load = p.rollerLoad * (1 - k);
      if (this.t >= p.coolSeconds) {
        this.phase = 'done';
        this.throttle = 0;
        this.load = 0;
        events.push({ type: 'done', result: this.result });
      }
    }
    return events;
  }
}

/**
 * What a run found. `points` are the sampled { rpm, bhp }. Returns the peak power and the revs it was at, the torque at the peak, the stock
 * figure, the difference, and a curve of up to `n` points for the sheet.
 */
export function runResult(spec, points, p = DEFAULT_ROAD_PARAMS, n = 16) {
  let peak = { rpm: 0, bhp: 0 };
  for (const pt of points) if (pt.bhp > peak.bhp) peak = pt;
  const bhp = round1(peak.bhp);
  const step = Math.max(1, Math.ceil(points.length / n));
  const curve = points.filter((_, i) => i % step === 0).map((pt) => ({ rpm: Math.round(pt.rpm / 10) * 10, bhp: round1(pt.bhp) }));
  const diff = round1(bhp - spec.stockBhp);
  return { bhp, rpm: Math.round(peak.rpm / 10) * 10, torque: Math.round(torqueOf(peak.bhp, peak.rpm)), stock: spec.stockBhp, diff, verdict: verdictOf(diff, p), curve };
}

const round1 = (v) => Math.round(v * 10) / 10;

/** How the figure stands against stock: 'up', 'down' or 'stock'. */
export function verdictOf(diff, p = DEFAULT_ROAD_PARAMS) {
  return diff > p.stockWithin ? 'up' : diff < -p.stockWithin ? 'down' : 'stock';
}

// The days ----------------------------------------------------------------

/** Whether farm day `day` (1 is the first) is a rolling road day: the first day, then one dealt day in each run of `everyDays`. */
export function isRoadDay(day, farmSeed, p = DEFAULT_ROAD_PARAMS) {
  const every = Math.round(p.everyDays);
  if (every <= 0) return false;
  if (day === 1) return true;
  const block = Math.floor((day - 1) / every);
  const pick = Math.floor(createRandom((farmSeed ^ 0x2d0a) + block * 7919)() * every);
  return (day - 1) % every === pick;
}

/** The days until the next one from `day` (0 if it is today), or null if there are none. */
export function daysToRoadDay(day, farmSeed, p = DEFAULT_ROAD_PARAMS) {
  if (Math.round(p.everyDays) <= 0) return null;
  for (let d = 0; d <= p.everyDays * 2 + 1; d++) if (isRoadDay(day + d, farmSeed, p)) return d;
  return null;
}

/** Whether the tuner should be at the farm at this hour of a road day. */
export const roadOpen = (hour, p = DEFAULT_ROAD_PARAMS) => hour >= p.arriveHour && hour < p.leaveHour;

/** What a run costs and whether the tin can pay for it: null if it can, or the reason if not. */
export function whyNotPay(purse, p = DEFAULT_ROAD_PARAMS) {
  return purse >= p.price ? null : `You are £${p.price - purse} short`;
}

// The cradle ----------------------------------------------------------------

/**
 * Whether a quad is sat on the rollers. `cradle` is { x, z, yaw, halfAcross, halfAlong } (the rollers' middle and the way the trailer
 * points; the quad faces along it either way), `quad` { x, z, yaw, speed }.
 */
export function onRollers(quad, cradle, p = { maxSpeed: 0.6, maxYaw: 0.35 }) {
  const dx = quad.x - cradle.x;
  const dz = quad.z - cradle.z;
  const along = dx * Math.sin(cradle.yaw) + dz * Math.cos(cradle.yaw);
  const across = dx * Math.cos(cradle.yaw) - dz * Math.sin(cradle.yaw);
  const d = (((quad.yaw - cradle.yaw) % Math.PI) + Math.PI) % Math.PI;
  const turn = Math.min(d, Math.PI - d); // 0 when square on, whichever way round it faces
  return { in: Math.abs(along) <= cradle.halfAlong && Math.abs(across) <= cradle.halfAcross, still: Math.abs(quad.speed) <= p.maxSpeed, square: turn <= p.maxYaw, along, across };
}

/** Why a run can't start, or null if it can. */
export function whyNotRun({ spec, onCradle, running, purse, busy }, p = DEFAULT_ROAD_PARAMS) {
  if (busy) return 'A run is on';
  if (!onCradle) return 'Ride a quad onto the rollers first';
  if (!canRun(spec)) return 'She can only strap down a quad';
  if (!running) return "Start the quad's engine first";
  return whyNotPay(purse, p);
}

// What the farm keeps -----------------------------------------------------

/** The runs the farm remembers for each quad, latest last. */
export class RoadLog {
  constructor(p = DEFAULT_ROAD_PARAMS) {
    this.p = p;
    this.runs = {}; // quad id -> [{ day, bhp, rpm, torque, diff, curve }]
  }

  add(id, day, result) {
    const list = (this.runs[id] ??= []);
    list.push({ day, bhp: result.bhp, rpm: result.rpm, torque: result.torque, diff: result.diff, curve: result.curve.map((pt) => ({ ...pt })) });
    this.runs[id] = list.slice(-this.p.keptRuns);
  }

  last(id) {
    return this.runs[id]?.[this.runs[id].length - 1] ?? null;
  }

  /** The run before the latest, to say "up on last time". */
  before(id) {
    const list = this.runs[id];
    return list && list.length > 1 ? list[list.length - 2] : null;
  }

  /** The quad ids with any run, in the order they were last run (latest last). */
  ids() {
    return Object.keys(this.runs)
      .filter((id) => this.runs[id].length)
      .sort((a, b) => this.last(a).day - this.last(b).day);
  }

  /** The id of the quad making the most power in its latest run, or null. */
  strongest() {
    let best = null;
    for (const id of this.ids()) if (!best || this.last(id).bhp > this.last(best).bhp) best = id;
    return best;
  }

  toJSON() {
    return Object.fromEntries(Object.entries(this.runs).map(([id, list]) => [id, list.map((r) => ({ ...r, curve: r.curve.map((pt) => ({ ...pt })) }))]));
  }

  restore(saved) {
    this.runs = {};
    if (!saved || typeof saved !== 'object') return;
    for (const [id, list] of Object.entries(saved)) {
      if (!Array.isArray(list)) continue;
      const ok = list
        .filter((r) => r && Number.isFinite(r.day) && Number.isFinite(r.bhp) && Number.isFinite(r.rpm))
        .map((r) => ({ day: r.day, bhp: r.bhp, rpm: r.rpm, torque: r.torque ?? 0, diff: r.diff ?? 0, curve: Array.isArray(r.curve) ? r.curve.filter((pt) => pt && Number.isFinite(pt.rpm) && Number.isFinite(pt.bhp)).map((pt) => ({ rpm: pt.rpm, bhp: pt.bhp })) : [] }));
      if (ok.length) this.runs[id] = ok.slice(-this.p.keptRuns);
    }
  }
}

/** The slip she hands you: the lines to print. `name` the quad's name. */
export function slipLines(name, result, previous = null) {
  const lines = [`${name}`, `${result.bhp.toFixed(1)} bhp at ${result.rpm.toLocaleString('en-GB')} rpm`, `${result.torque} lb ft at the peak`];
  const sign = result.diff > 0 ? '+' : '';
  lines.push(result.verdict === 'stock' ? `Stock is ${result.stock} bhp: right on it` : `Stock is ${result.stock} bhp: ${sign}${result.diff.toFixed(1)}`);
  if (previous) {
    const d = round1(result.bhp - previous.bhp);
    lines.push(Math.abs(d) < 0.05 ? 'The same as last time' : `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(1)} on last time`);
  }
  return lines;
}
