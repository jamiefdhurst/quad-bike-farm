// The girls on the tarmac. On the farm road they ride faster, and say so: Jess egging you on, Amy telling you off for squealing the tyres.
// Pure logic: whether a point is on the road, how much faster she'll go, and who says what (herDriving.js uses the first two, game.js the watch).

export const DEFAULT_TARMAC_PARAMS = {
  speedBoost: 1.7, // times her cruising speed on the tarmac
  scareBoost: 1.6, // times the speed that frightens her, since the road is smooth and straight
  boostRate: 0.6, // how fast (per second) she settles into the new pace on and off the road
  eggRange: 45, // metres: Jess egging you on needs you this close, both of you on the road
  eggSpeed: 7, // m/s you have to be doing before Jess on your back eggs you on
  eggGap: 40, // seconds between her egging you on
  squealLevel: 0.35, // how hard your tyres squeal (0..1) to count
  squealFor: 0.5, // seconds of it before Amy says anything
  scoldGap: 30, // seconds between Amy's telling-offs
  scoldRange: 25, // metres: Amy hears it from this far, if she isn't on your back
};

export const TARMAC_PARAM_RANGES = {
  speedBoost: [1, 3, 0.05],
  scareBoost: [1, 3, 0.05],
  boostRate: [0.1, 3, 0.05],
  eggRange: [5, 150, 1],
  eggSpeed: [2, 20, 0.5],
  eggGap: [5, 300, 5],
  squealLevel: [0.05, 1, 0.05],
  squealFor: [0, 5, 0.1],
  scoldGap: [5, 300, 5],
  scoldRange: [5, 100, 1],
};

/** Whether (x, z) is on the tarmac of the farm road (layout.road), not its verge. False if there is no road. */
export function onTarmac(road, x, z) {
  if (!road) return false;
  return x >= road.fromX && x <= road.toX && Math.abs(z - road.z) <= road.halfWidth;
}

/** One step of how settled into the road's pace she is: 0 off it, 1 on it. */
export function settleBoost(current, on, dt, p) {
  const target = on ? 1 : 0;
  const step = p.boostRate * dt;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}

/** The multiplier on her speeds at this settledness (1 off the road). */
export const boostFactor = (settled, boost) => 1 + (boost - 1) * settled;

/** Jess egging you on and Amy scolding you for squealing, once each in a while. */
export class TarmacWatch {
  constructor(params = { ...DEFAULT_TARMAC_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.last = {};
    this.squealing = 0;
  }

  /**
   * One step. `ctx`: { you: { onRoad, speed, squeal } (null if you are on foot), girls: [{ id, free, onRoad, distance, role }] } where
   * `role` is 'driving', 'pillion' (on your quad) or null. Returns events { type: 'egg' | 'scold', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const you = ctx.you;
    this.squealing = you && you.onRoad && you.squeal >= p.squealLevel ? this.squealing + dt : 0;
    if (!you) return events;
    const ready = (id, gap) => this.clock - (this.last[id] ?? -Infinity) >= gap;
    for (const g of ctx.girls) {
      if (g.id === 'jess' && you.onRoad && ready('egg' + g.id, p.eggGap)) {
        const driving = g.role === 'driving' && g.onRoad && g.distance <= p.eggRange;
        const pillion = g.role === 'pillion' && you.speed >= p.eggSpeed;
        if (driving || pillion) {
          this.last['egg' + g.id] = this.clock;
          events.push({ type: 'egg', girl: g.id });
        }
      }
      if (g.id === 'amy' && this.squealing >= p.squealFor && ready('scold' + g.id, p.scoldGap)) {
        if (g.role === 'pillion' || (g.role !== 'driving' && g.free && g.distance <= p.scoldRange)) {
          this.last['scold' + g.id] = this.clock;
          this.squealing = 0;
          events.push({ type: 'scold', girl: g.id });
        }
      }
    }
    return events;
  }
}
