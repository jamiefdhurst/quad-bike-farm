// Fumes in the barn. An engine left running indoors fills the barn with a haze that hangs under the roof and only clears slowly
// out of the open doors. Free girls inside cough and go out; Amy comes to the doorway and switches off whatever nobody is
// sat on, or tells you off if it is you. Pure logic: the game says what is running where and who is free; this keeps the level.

export const DEFAULT_FUMES_PARAMS = {
  idleOutput: 0.3, // how much an idling engine adds (1 is flat out); the throttle adds the rest
  twoStrokeOutput: 1.5, // a two-stroke makes this many times as much
  dieselOutput: 1.4, // and the tractor's diesel this many
  fillRate: 0.03, // fumes a second from an output of 1: a closed box fills fast
  clearBase: 0.012, // a second, out through the doors
  clearWind: 0.01, // a second, times the wind squared: the doors face one way, so wind helps little
  showAt: 0.06, // fumes you can see from here
  coughAt: 0.35, // fumes that make a girl cough and go out
  reactAfter: 3, // seconds in it before she coughs
  coughGap: 40, // seconds before the same girl is driven out again
  switchAt: 0.5, // fumes at which Amy comes to switch it off
  reachAfter: 3.5, // seconds from Amy setting off to her reaching in and switching it off
  tellGap: 60, // seconds between Amy telling you to turn yours off
};

export const FUMES_PARAM_RANGES = {
  idleOutput: [0, 1, 0.01],
  twoStrokeOutput: [0.5, 4, 0.1],
  dieselOutput: [0.5, 4, 0.1],
  fillRate: [0, 0.2, 0.001],
  clearBase: [0, 0.1, 0.0005],
  clearWind: [0, 0.1, 0.001],
  showAt: [0, 0.5, 0.01],
  coughAt: [0.05, 1, 0.01],
  reactAfter: [0, 20, 0.5],
  coughGap: [0, 300, 5],
  switchAt: [0.1, 1, 0.01],
  reachAfter: [0.5, 15, 0.5],
  tellGap: [0, 300, 5],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** What one engine adds: nothing unless it is running inside the barn, else more with throttle, two-stroke oil or diesel. */
export function fumesOutput(e, p) {
  if (!e.running || !e.inside) return 0;
  return (p.idleOutput + (1 - p.idleOutput) * clamp01(e.throttle)) * (e.twoStroke ? p.twoStrokeOutput : 1) * (e.diesel ? p.dieselOutput : 1);
}

export class BarnFumes {
  constructor(params = { ...DEFAULT_FUMES_PARAMS }) {
    this.p = params;
    this.level = 0; // 0..1
    this.clock = 0;
    this.exposed = {}; // girl id -> seconds in it
    this.last = {}; // girl id -> when she was last driven out
    this.going = null; // { engine, start }: Amy on her way to switch one off
    this.lastTell = -Infinity;
  }

  get visible() {
    return this.level >= this.p.showAt;
  }

  /**
   * One step. `ctx`:
   *   wind: the weather's multiplier
   *   engines: [{ id, running, throttle, twoStroke, diesel, inside, attended }]   attended: someone is on it or starting it
   *   girls: [{ id, free, inside }]       free: stood about, so she can walk out
   *   amyFree: Amy is on her feet and free to go to the doorway
   * Returns events: { type: 'cough', girl }, { type: 'amyGoes', engine }, { type: 'switchOff', engine }, { type: 'tell' }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    let fill = 0;
    for (const e of ctx.engines) fill += fumesOutput(e, p);
    this.level = clamp01(this.level + (fill * p.fillRate - (p.clearBase + p.clearWind * ctx.wind * ctx.wind) * this.level) * dt);
    const events = [];
    for (const g of ctx.girls) {
      const breathing = g.free && g.inside && this.level >= p.coughAt;
      this.exposed[g.id] = breathing ? (this.exposed[g.id] ?? 0) + dt : 0;
      if (!breathing || this.exposed[g.id] < p.reactAfter) continue;
      if (this.clock - (this.last[g.id] ?? -Infinity) < p.coughGap) continue;
      this.last[g.id] = this.clock;
      events.push({ type: 'cough', girl: g.id });
    }
    const unattended = ctx.engines.find((e) => e.running && e.inside && !e.attended);
    if (this.going) {
      const e = ctx.engines.find((o) => o.id === this.going.engine);
      if (!e || !e.running || e.attended) this.going = null; // it stalled or someone got on it: nothing to do
      else if (this.clock - this.going.start >= p.reachAfter) {
        events.push({ type: 'switchOff', engine: this.going.engine });
        this.going = null;
      }
    } else if (this.level >= p.switchAt && ctx.amyFree) {
      if (unattended) {
        this.going = { engine: unattended.id, start: this.clock };
        events.push({ type: 'amyGoes', engine: unattended.id });
      } else if (ctx.engines.some((e) => e.running && e.inside) && this.clock - this.lastTell >= p.tellGap) {
        this.lastTell = this.clock;
        events.push({ type: 'tell' });
      }
    }
    return events;
  }
}
