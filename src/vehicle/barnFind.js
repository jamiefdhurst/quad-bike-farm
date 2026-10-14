// The barn find: in some games an old brown quad stands under a tarp at the back of the barn, a copy of one of the regular quads, not run for
// years. It comes back to life at the bench: the tarp off first, then whichever of fuel, carb, plug, brake, tyres and battery this one needs
// (picked from the seed). It won't catch until every one is done. The battery is the ordinary one (items/battery.js): lift it out at the bench,
// charge it on the bench charger (which needs the generator), fit it back; the find only checks it is in and charged enough. Pure logic, no Three.js; the look is in rustyLook.js.

export const DEFAULT_BARN_FIND_PARAMS = {
  chance: 0.2, // chance a game has one
  minJobs: 3, // how many of the six jobs it needs, at least...
  maxJobs: 4, // ...and at most
  startBattery: 0.03, // charge it comes with: flat
  readyAt: 0.6, // charge its fitted battery needs before it will start (a jump from a running quad gets it there too)
  waterChance: 0.5, // chance its old tank has water in it, which the sediment bowl on the tap shows and a drain there clears
  tankWater: 0.06, // water fraction of what is in it
  smokeSeconds: 4, // how long the first start smokes
  wear: [0.55, 0.8], // engine wear it comes with: a lot of years
  hours: [1900, 2800], // hour meter
  odoMiles: [4200, 7800], // odometer
  bodyWear: 0.95, // how worn its body looks (the wear layer, effects/wearLayer.js): rust in every fold, the edges rubbed bare
};

export const BARN_FIND_RANGES = {
  chance: [0, 1, 0.05],
  minJobs: [1, 6, 1],
  maxJobs: [1, 6, 1],
  startBattery: [0, 0.2, 0.01],
  readyAt: [0.1, 1, 0.05],
  waterChance: [0, 1, 0.05],
  tankWater: [0, 0.3, 0.005],
  smokeSeconds: [0, 12, 0.5],
  bodyWear: [0, 1, 0.05],
};

/** The jobs it might need, in the order the bench lists them. 'tarp' always comes first and isn't one of these. */
export const RUSTY_JOBS = ['fuel', 'carb', 'plug', 'brake', 'tyre', 'battery'];

export const RUSTY_ID = 'rusty';

/** The jobs a given donor spec can need: a pull-start-only quad has no battery to charge. */
export function jobsFor(spec) {
  return RUSTY_JOBS.filter((k) => !(k === 'battery' && spec.engine?.noStarter));
}

/**
 * Whether this game has a barn find, which regular quad it copies and which jobs it needs: { donor, jobs } or null.
 * The same random numbers give the same plan.
 */
export function pickBarnFind(random, regulars, P = DEFAULT_BARN_FIND_PARAMS) {
  if (random() >= P.chance) return null;
  const donor = regulars[Math.floor(random() * regulars.length)];
  const options = jobsFor(donor);
  const want = Math.min(options.length, P.minJobs + Math.floor(random() * (Math.max(P.maxJobs, P.minJobs) - P.minJobs + 1)));
  const left = options.slice();
  while (left.length > want) left.splice(Math.floor(random() * left.length), 1);
  return { donor, jobs: RUSTY_JOBS.filter((k) => left.includes(k)) }; // listed in the bench's order
}

/** What the engine does when it won't catch yet, for a toast while you crank it. */
const BLOCKED_BY = {
  fuel: 'It cranks, but the old varnished fuel will not burn',
  carb: 'It cranks, but the carb is gummed solid',
  plug: 'It cranks, but there is no spark from that old plug',
  battery: 'The battery is flat or out: it only clicks. Charge it on the bench charger',
  brake: 'It cranks, but the seized brake is dragging it down',
  tyre: 'It cranks, but it is not safe to start it on a flat tyre',
};

export class BarnFind {
  constructor(plan, P = DEFAULT_BARN_FIND_PARAMS) {
    this.plan = plan;
    this.params = P;
    this.jobs = plan.jobs;
    this.tarpOff = false;
    this.finished = new Set();
    this.batteryOk = false; // its battery is fitted and charged enough (set each frame by setBattery)
    this.started = false; // it has had its first start
  }

  /** The kinds the bench lists for it: the tarp, then what it needs. The battery has no job of its own: the bench's charger rows (lift out, fit back) do it. */
  get kinds() {
    return ['tarp', ...this.jobs.filter((k) => k !== 'battery')];
  }

  /** Whether a job can be started now: nothing but the tarp until the tarp is off, and not what it doesn't need. */
  available(kind) {
    if (kind === 'tarp') return !this.tarpOff;
    return this.tarpOff && kind !== 'battery' && this.jobs.includes(kind) && !this.isDone(kind);
  }

  isDone(kind) {
    if (kind === 'tarp') return this.tarpOff;
    if (kind === 'battery') return this.batteryOk;
    return this.finished.has(kind);
  }

  /** A bench job was finished. */
  finish(kind) {
    if (kind === 'tarp') this.tarpOff = true;
    else if (kind !== 'battery' && this.jobs.includes(kind)) this.finished.add(kind);
  }

  /** Whether its battery is in the vehicle and holds enough charge to turn it over. Returns true on the step it becomes so. */
  setBattery(level, fitted) {
    const was = this.batteryOk;
    this.batteryOk = fitted && level >= this.params.readyAt;
    return this.batteryOk && !was;
  }

  /** Every job done: it can start. */
  get ready() {
    return this.tarpOff && this.jobs.every((k) => this.isDone(k));
  }

  /** It won't catch until it's ready. */
  get startBlocked() {
    return !this.ready;
  }

  /** The seized brake holds it on while it's still to do. */
  get brakeSeized() {
    return this.jobs.includes('brake') && !this.finished.has('brake');
  }

  get remaining() {
    return this.jobs.filter((k) => !this.isDone(k));
  }

  /** Its progress as plain data, for the farm's save. */
  toJSON() {
    return { tarpOff: this.tarpOff, finished: [...this.finished], started: this.started };
  }

  /** Puts saved progress back (see toJSON); jobs this plan doesn't have are ignored. */
  restore(s) {
    if (!s) return;
    this.tarpOff = !!s.tarpOff;
    this.finished = new Set((s.finished ?? []).filter((k) => this.jobs.includes(k)));
    this.started = !!s.started;
  }

  /** What stops it starting, said once the tarp is off. */
  blockedReason() {
    const first = this.remaining[0];
    return first ? BLOCKED_BY[first] : null;
  }
}
