// The barn find: in some games an old brown quad stands under a tarp at the back of the barn, a copy of one of the regular quads, not run for
// years. It comes back to life at the bench: the tarp off first, then whichever of fuel, carb, plug, brake, tyres and battery this one needs
// (picked from the seed). It won't catch until every one is done. Pure logic, no Three.js; the look is in rustyLook.js.

export const DEFAULT_BARN_FIND_PARAMS = {
  chance: 0.2, // chance a game has one
  minJobs: 3, // how many of the six jobs it needs, at least...
  maxJobs: 4, // ...and at most
  chargeSeconds: 300, // how long the battery takes on the charger once it's clipped on (you can get on with other things)
  startBattery: 0.03, // charge it comes with: flat
  chargedTo: 0.95, // charge it has when the charger's done
  waterChance: 0.5, // chance its old tank has water in it, which the sediment bowl on the tap shows and a drain there clears
  tankWater: 0.06, // water fraction of what is in it
  smokeSeconds: 4, // how long the first start smokes
  wear: [0.55, 0.8], // engine wear it comes with: a lot of years
  hours: [1900, 2800], // hour meter
  odoMiles: [4200, 7800], // odometer
};

export const BARN_FIND_RANGES = {
  chance: [0, 1, 0.05],
  minJobs: [1, 6, 1],
  maxJobs: [1, 6, 1],
  chargeSeconds: [10, 900, 10],
  startBattery: [0, 0.2, 0.01],
  chargedTo: [0.5, 1, 0.01],
  waterChance: [0, 1, 0.05],
  tankWater: [0, 0.3, 0.005],
  smokeSeconds: [0, 12, 0.5],
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
  battery: 'The battery is flat: it only clicks',
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
    this.charging = false;
    this.charge = 0; // seconds on the charger
    this.started = false; // it has had its first start
  }

  /** The kinds the bench lists for it: the tarp, then what it needs. */
  get kinds() {
    return ['tarp', ...this.jobs];
  }

  /** Whether a job can be started now: nothing but the tarp until the tarp is off, and not what it doesn't need. */
  available(kind) {
    if (kind === 'tarp') return !this.tarpOff;
    return this.tarpOff && this.jobs.includes(kind) && !this.isDone(kind);
  }

  isDone(kind) {
    if (kind === 'tarp') return this.tarpOff;
    if (kind === 'battery') return this.charged;
    return this.finished.has(kind);
  }

  get charged() {
    return this.charge >= this.params.chargeSeconds;
  }

  /** A bench job was finished. The battery's only the clip-on: it counts once the charger has had its time. */
  finish(kind) {
    if (kind === 'tarp') this.tarpOff = true;
    else if (kind === 'battery') this.charging = true;
    else if (this.jobs.includes(kind)) this.finished.add(kind);
  }

  /** The charger working. Returns 'charged' on the step it completes. */
  update(dt) {
    if (!this.charging || this.charged) return null;
    this.charge = Math.min(this.params.chargeSeconds, this.charge + dt);
    return this.charged ? 'charged' : null;
  }

  /** The battery's charge now: flat until the charger goes on, then rising to `chargedTo`. */
  get batteryLevel() {
    const P = this.params;
    return P.startBattery + (P.chargedTo - P.startBattery) * Math.min(1, this.charge / P.chargeSeconds);
  }

  /** How far the charger is, 0 to 1. */
  get chargeProgress() {
    return Math.min(1, this.charge / this.params.chargeSeconds);
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

  /** What stops it starting, said once the tarp is off. */
  blockedReason() {
    const first = this.remaining[0];
    return first ? BLOCKED_BY[first] : null;
  }
}
