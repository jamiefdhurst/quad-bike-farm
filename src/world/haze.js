// Smoke hanging in still air. Engines running in the yard feed a haze over it; wind (and rain) clear it. On a calm or foggy day
// a lot of idling leaves a blue-grey haze that drifts slowly and takes minutes to go, and the girls cough and wave it away.
// Pure logic: the game says what is running where and how windy it is; this keeps the haze level and says who has breathed it.

export const DEFAULT_HAZE_PARAMS = {
  area: 30, // metres from the yard's middle that an engine feeds the haze, and that the girls breathe it
  idleOutput: 0.3, // how much an idling engine adds (1 is flat out); the throttle adds the rest
  twoStrokeOutput: 1.5, // a two-stroke makes this many times as much
  dieselOutput: 1.4, // and the tractor's diesel this many
  fillRate: 0.03, // haze a second from an output of 1
  clearBase: 0.002, // a second, even in dead air
  clearWind: 0.05, // a second, times the wind squared (weather wind: 0.3 foggy, 1 overcast)
  clearRain: 0.04, // a second at full rain: it washes the air
  showAt: 0.08, // haze you can see from here
  coughAt: 0.35, // haze that makes a girl cough
  reactAfter: 4, // seconds in it before she coughs
  coughGap: 75, // seconds before the same girl coughs again
  waveFor: 2.6, // seconds she waves it away
};

export const HAZE_PARAM_RANGES = {
  area: [5, 80, 1],
  idleOutput: [0, 1, 0.01],
  twoStrokeOutput: [0.5, 4, 0.1],
  dieselOutput: [0.5, 4, 0.1],
  fillRate: [0, 0.2, 0.001],
  clearBase: [0, 0.05, 0.0005],
  clearWind: [0, 0.3, 0.005],
  clearRain: [0, 0.3, 0.005],
  showAt: [0, 0.5, 0.01],
  coughAt: [0.05, 1, 0.01],
  reactAfter: [0, 30, 0.5],
  coughGap: [0, 300, 5],
  waveFor: [0.5, 10, 0.1],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** What one engine adds to the haze: nothing if it is off or out of the yard, else more with throttle, two-stroke oil or diesel. */
export function hazeOutput(e, yard, p) {
  if (!e.running || Math.hypot(e.x - yard.x, e.z - yard.z) > p.area) return 0;
  return (p.idleOutput + (1 - p.idleOutput) * clamp01(e.throttle)) * (e.twoStroke ? p.twoStrokeOutput : 1) * (e.diesel ? p.dieselOutput : 1);
}

export class Haze {
  constructor(yard, params = { ...DEFAULT_HAZE_PARAMS }) {
    this.yard = yard;
    this.p = params;
    this.level = 0; // 0..1
    this.clock = 0;
    this.exposed = {}; // girl id -> seconds in it
    this.last = {}; // girl id -> when she last coughed
  }

  get visible() {
    return this.level >= this.p.showAt;
  }

  /** How fast the air clears: faster with wind (squared) and rain. */
  clearRate(wind, rain) {
    const p = this.p;
    return p.clearBase + p.clearWind * wind * wind + p.clearRain * clamp01(rain);
  }

  /**
   * One step. `ctx`:
   *   wind, rain: the weather's (wind is its multiplier, 0.3 foggy to 2 in a gale)
   *   engines: [{ x, z, running, throttle, twoStroke, diesel }]
   *   girls: [{ id, x, z, free }]       free: stood about, so she can stand there coughing
   * Returns events: { type: 'cough', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    let fill = 0;
    for (const e of ctx.engines) fill += hazeOutput(e, this.yard, p);
    this.level = clamp01(this.level + (fill * p.fillRate - this.clearRate(ctx.wind, ctx.rain) * this.level) * dt);
    const events = [];
    for (const g of ctx.girls) {
      const breathing = g.free && this.level >= p.coughAt && Math.hypot(g.x - this.yard.x, g.z - this.yard.z) <= p.area;
      this.exposed[g.id] = breathing ? (this.exposed[g.id] ?? 0) + dt : 0;
      if (!breathing || this.exposed[g.id] < p.reactAfter) continue;
      if (this.clock - (this.last[g.id] ?? -Infinity) < p.coughGap) continue;
      this.last[g.id] = this.clock;
      events.push({ type: 'cough', girl: g.id });
    }
    return events;
  }
}
