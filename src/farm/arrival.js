// You arrive in your own car each morning (#229, was TODO 338): the day opens with you in the driver's seat of your 309, just pulled up on the
// pad by the Dutch barn with the engine running and warm. Some days you have given one or both girls a lift: they are sat in it with you, and get
// out after you do; their own car is not on the farm that day. The others are sat at the wheel of their own cars on the pad, engines running and
// warm, and get out within a minute, usually switching off as they go (Jess often doesn't). Pure: the game deals the day, seats everyone, and acts on the events
// (game.js arriveInCar, updateArrival). Driving their cars in down the lane is #99's; parking yours where you left it needs the save to keep places.

export const DEFAULT_ARRIVAL_PARAMS = {
  oneLiftChance: 0.25, // a day in four you've given one of them a lift
  bothLiftChance: 0.125, // and a day in eight, both of them
  sitMin: 12, // seconds a girl in her own car sits on in it, engine running, before she gets out...
  sitMax: 60, // ...up to a minute (Jamie)
  followMin: 1.5, // seconds after you get out that a girl you gave a lift gets out too...
  followMax: 4.5, // ...the second one a little after the first
  amyLeavesRunning: 0.15, // chance a girl gets out of her own car and leaves it ticking over (Jamie: they wouldn't always switch off): Amy hardly ever...
  jessLeavesRunning: 0.45, // ...Jess often
};

export const ARRIVAL_PARAM_RANGES = {
  oneLiftChance: [0, 1, 0.05],
  bothLiftChance: [0, 1, 0.025],
  sitMin: [0, 120, 1],
  sitMax: [0, 180, 1],
  followMin: [0, 10, 0.5],
  followMax: [0, 15, 0.5],
  amyLeavesRunning: [0, 1, 0.05],
  jessLeavesRunning: [0, 1, 0.05],
};

/**
 * Today's arrival, from today's random stream: `lift` the girls in your car (the first in the front, the second behind), `sit` how long each of
 * the others sits on in her own car, `follow` how long after you each one you gave a lift waits before she gets out, `running` the girls who'll
 * get out of their own cars and leave them running.
 */
export function dealArrival(random, girls, p = DEFAULT_ARRIVAL_PARAMS) {
  const r = random();
  const both = girls.length >= 2 && r < p.bothLiftChance;
  const one = !both && girls.length >= 1 && r < p.bothLiftChance + p.oneLiftChance;
  let lift = [];
  if (both) lift = random() < 0.5 ? [...girls] : [...girls].reverse(); // who has the front seat
  else if (one) lift = [girls[Math.min(girls.length - 1, Math.floor(random() * girls.length))]];
  const between = (a, b) => a + random() * Math.max(0, b - a);
  const sit = {};
  const follow = {};
  const running = [];
  let after = 0;
  for (const g of girls) {
    if (lift.includes(g)) continue;
    sit[g] = between(p.sitMin, p.sitMax);
    if (random() < (p[`${g}LeavesRunning`] ?? 0.3)) running.push(g);
  }
  for (const g of lift) {
    after += between(p.followMin, p.followMax);
    follow[g] = after;
  }
  return { lift, sit, follow, running };
}

/** Which seat each girl you gave a lift takes: the passenger's for the first, behind it for the second. */
export function liftSeats(lift) {
  return Object.fromEntries(lift.map((g, i) => [g, i === 0 ? 'left' : 'rearLeft']));
}

/** The girls' cars that stay at home today, by spec id: those of the girls you gave a lift (`carOf` maps a girl to her car's id). */
export function carsAway(deal, carOf) {
  return deal.lift.map(carOf).filter(Boolean);
}

/**
 * The save's vehicles with the cars that were away today carried over from the last save unchanged, so a girl's car keeps its wear, faults and
 * fuel on a day she came with you (it was not on the farm to be captured).
 */
export function keepAway(vehicles, saved = {}, away = []) {
  const out = { ...vehicles };
  for (const id of away) if (!(id in out) && saved?.[id]) out[id] = saved[id];
  return out;
}

/**
 * The morning as it plays out. Each frame the game says whether you are still in your car and which girls are still sat where they started;
 * `update` returns { type: 'out', girl, from: 'own' | 'lift', leaveRunning } when it is time for one to get out (`leaveRunning`: out of her own car without switching off). Done once everyone is out.
 */
export class Arrival {
  constructor(deal) {
    this.deal = deal;
    this.clock = 0;
    this.youOutAt = null; // the clock when you got out of your car
    this.out = new Set(); // girls who have got out (or were moved some other way)
    this.forced = new Set(); // the debug panel's "get out now", by girl
  }

  /** Everyone has got out. */
  get done() {
    return [...this.deal.lift, ...Object.keys(this.deal.sit)].every((g) => this.out.has(g));
  }

  /** The debug panel's and the console's "get out now" for a girl still sat in. */
  getOutNow(girl) {
    if (!this.out.has(girl)) this.forced.add(girl);
  }

  /** `ctx`: { youIn: you are still in your car, seated: Set of girl ids still sat where the morning put them }. */
  update(dt, { youIn, seated }) {
    this.clock += dt;
    if (!youIn && this.youOutAt === null) this.youOutAt = this.clock;
    const events = [];
    const go = (girl, from, leaveRunning = false) => {
      this.out.add(girl);
      this.forced.delete(girl);
      events.push({ type: 'out', girl, from, ...(from === 'own' && { leaveRunning }) });
    };
    for (const [girl, at] of Object.entries(this.deal.sit)) {
      if (this.out.has(girl)) continue;
      if (!seated.has(girl)) this.out.add(girl); // moved off it some other way (asked out, sent to a job): nothing more to do
      else if (this.clock >= at || this.forced.has(girl)) go(girl, 'own', (this.deal.running ?? []).includes(girl));
    }
    for (const girl of this.deal.lift) {
      if (this.out.has(girl)) continue;
      if (!seated.has(girl)) this.out.add(girl);
      else if (this.forced.has(girl) || (this.youOutAt !== null && this.clock - this.youOutAt >= this.deal.follow[girl])) go(girl, 'lift');
    }
    return events;
  }

  /** One line for the Girls tab and the console. */
  describe(names = {}) {
    const n = (g) => names[g] ?? g;
    const lift = this.deal.lift.length ? `came with you: ${this.deal.lift.map(n).join(' and ')}` : 'you came on your own';
    const sat = Object.entries(this.deal.sit).map(([g, at]) => `${n(g)} ${this.out.has(g) ? 'out of her car' : `in her car, out in ${Math.max(0, Math.round(at - this.clock))} s`}`);
    const waiting = this.deal.lift.filter((g) => !this.out.has(g));
    return [lift, ...sat, waiting.length ? `${waiting.map(n).join(' and ')} waiting for you to get out` : null].filter(Boolean).join('; ');
  }
}
