// Reading the dash for you. With the dash behind you and no HUD, the girl on the back sometimes reads it out: "Your
// fuel's on the red", "It's still cold, go easy". Amy does it helpfully, as it happens; Jess does it when it's too
// late (the tank's about empty, it's been pinking for ages, you've already thrashed it cold). Pure logic: the game says
// what the dash shows and who's on the back.

export const DEFAULT_READING_PARAMS = {
  gap: 45, // seconds between one girl reading something out and the next
  fuelLateLevel: 0.04, // Jess reads the fuel when the tank is down to this fraction (the red starts well before)
  coldBelow: 0.4, // engine temperature (0..1) under which Amy says it's still cold...
  coldPace: 5, // ...if you're going faster than this (m/s) or on more than this much throttle:
  coldThrottle: 0.6,
  coldFor: 2, // seconds of that before she says
  warmAbove: 0.65, // it counts as warm again above this
  hotLateFor: 6, // Jess reads the temperature when it has been hot this many seconds
  lateColdFor: 6, // Jess: seconds of going hard while cold, to have something to say once it's warm
};

export const READING_PARAM_RANGES = {
  gap: [0, 300, 5],
  fuelLateLevel: [0, 0.3, 0.01],
  coldBelow: [0, 1, 0.05],
  coldPace: [0, 20, 0.5],
  coldThrottle: [0, 1, 0.05],
  coldFor: [0, 20, 0.5],
  warmAbove: [0, 1, 0.05],
  hotLateFor: [0, 60, 1],
  lateColdFor: [0, 60, 1],
};

export class DashReader {
  constructor(params = { ...DEFAULT_READING_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.last = {}; // girl id -> when she last read something out
    this.said = {}; // `${girl}:${what}` -> true while that spell lasts
    this.coldTime = 0; // seconds going hard while cold
    this.hotTime = 0;
    this.thrashedCold = false;
  }

  /**
   * One step. `ctx`:
   *   riding: you at the controls of a running quad
   *   girls: [{ id, onBack }]
   *   dash: { fuelLamp, tempLamp, fuelLevel (fraction), temperature (0..1) }
   *   speed, throttle
   * Returns events: { girl, what: 'fuel' | 'cold' | 'hot', late }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const d = ctx.dash;
    if (!ctx.riding) {
      this.coldTime = 0;
      this.hotTime = 0;
      return events;
    }
    const hard = ctx.speed > p.coldPace || ctx.throttle > p.coldThrottle;
    const cold = d.temperature < p.coldBelow;
    this.coldTime = cold && hard ? this.coldTime + dt : cold ? this.coldTime : 0;
    if (this.coldTime > p.lateColdFor) this.thrashedCold = true;
    this.hotTime = d.tempLamp ? this.hotTime + dt : 0;

    // A spell ends when the thing does, so it can be said again next time.
    if (!d.fuelLamp) this.forget('fuel');
    if (!d.tempLamp) this.forget('hot');
    if (d.temperature > p.warmAbove) {
      this.forget('cold');
      if (this.thrashedCold) this.lateCold = true;
    }

    for (const g of ctx.girls) {
      if (!g.onBack || this.clock - (this.last[g.id] ?? -Infinity) < p.gap) continue;
      const say = (what, late) => {
        if (this.said[`${g.id}:${what}`]) return false;
        this.said[`${g.id}:${what}`] = true;
        this.last[g.id] = this.clock;
        events.push({ girl: g.id, what, late });
        return true;
      };
      if (g.id === 'amy') {
        if (d.fuelLamp && say('fuel', false)) break;
        if (d.tempLamp && say('hot', false)) break;
        if (this.coldTime > p.coldFor && say('cold', false)) break;
      } else {
        if (d.fuelLamp && d.fuelLevel <= p.fuelLateLevel && say('fuel', true)) break;
        if (this.hotTime > p.hotLateFor && say('hot', true)) break;
        if (this.lateCold && say('cold', true)) {
          this.lateCold = false;
          this.thrashedCold = false;
          break;
        }
      }
    }
    return events;
  }

  forget(what) {
    for (const key of Object.keys(this.said)) if (key.endsWith(`:${what}`)) delete this.said[key];
  }
}
