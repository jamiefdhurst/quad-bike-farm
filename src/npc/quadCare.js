// Getting attached to a quad (issue 23, TODO 128). Each girl keeps a care score for the quad that is hers (ownership.js):
// she minds when someone runs it dry or thrashes it, and is proud when it is washed. Pure logic: the game says what each
// quad is doing and who is at its controls, this says who speaks up and how the score moves.

export const DEFAULT_CARE_PARAMS = {
  startCare: 0.4, // how much she cares about her quad at the start of a game, 0 to 1
  lowFuel: 0.06, // a share of the tank: under this and the quad being used counts as running dry
  dryDelay: 4, // seconds a quad in use has been this low before she says so
  thrashRevs: 0.92, // a share of the redline: the revs held above this, or the throttle above thrashThrottle, is thrashing
  thrashThrottle: 0.95, // the throttle (0 to 1) that counts as flat out
  thrashFor: 6, // seconds of flat out, without a real break, before she objects
  thrashEase: 2, // thrash seconds lost for each second eased off
  noticeRange: 45, // metres: she sees and hears it from this far
  speakCooldown: 120, // seconds between her complaining about her quad
  minCare: 0.12, // below this she can't be bothered to object
  careLostDry: 0.06, // care lost each time she complains about the fuel (she cares less if she is always let down)
  careLostThrash: 0.04, // and each time about the thrashing
  careWash: 0.01, // care gained for each second you hose her quad
  proudAfter: 5, // seconds of washing before she is proud of it
  proudCooldown: 240, // seconds between her being proud
  favourThrash: 1.2, // favour you lose when you thrash her quad and she says so, scaled by how much she cares
  favourWashPerSecond: 0.1, // extra favour a second of washing earns, scaled by how much she cares
};

export const CARE_PARAM_RANGES = {
  startCare: [0, 1, 0.05],
  lowFuel: [0, 0.3, 0.01],
  dryDelay: [0, 30, 0.5],
  thrashRevs: [0.5, 1.2, 0.01],
  thrashThrottle: [0.5, 1, 0.01],
  thrashFor: [1, 30, 0.5],
  thrashEase: [0, 10, 0.5],
  noticeRange: [5, 120, 1],
  speakCooldown: [0, 600, 5],
  minCare: [0, 0.5, 0.01],
  careLostDry: [0, 0.3, 0.01],
  careLostThrash: [0, 0.3, 0.01],
  careWash: [0, 0.1, 0.002],
  proudAfter: [0, 30, 0.5],
  proudCooldown: [0, 900, 10],
  favourThrash: [0, 5, 0.1],
  favourWashPerSecond: [0, 1, 0.01],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class QuadCare {
  /** @param {string[]} ids  The girls, by character id. */
  constructor(ids, params = { ...DEFAULT_CARE_PARAMS }) {
    this.p = params;
    this.ids = ids;
    this.care = Object.fromEntries(ids.map((id) => [id, params.startCare]));
    this.clock = 0;
    this.dry = {}; // spec id -> seconds it has been used on almost nothing
    this.thrash = {}; // spec id -> seconds of flat out
    this.washed = {}; // girl id -> seconds you have been hosing her quad in this go
    this.lastSpoke = {}; // girl id -> time of her last complaint
    this.lastProud = {}; // girl id -> time she was last proud
  }

  /** Hosing her quad for `dt`. Returns true the moment she is proud of it. */
  wash(girl, dt) {
    if (!(girl in this.care)) return false;
    this.care[girl] = clamp01(this.care[girl] + this.p.careWash * dt);
    this.washed[girl] = (this.washed[girl] ?? 0) + dt;
    if (this.washed[girl] < this.p.proudAfter || this.clock - (this.lastProud[girl] ?? -Infinity) < this.p.proudCooldown) return false;
    this.lastProud[girl] = this.clock;
    this.washed[girl] = 0;
    return true;
  }

  /** You stopped washing: the next go starts from nothing. */
  stopWash() {
    this.washed = {};
  }

  /** The favour a second of washing earns the girl whose quad it is. */
  washFavour(girl, dt) {
    return this.p.favourWashPerSecond * this.care[girl] * dt;
  }

  /** The favour you lose for thrashing it. */
  thrashFavour(girl) {
    return -this.p.favourThrash * this.care[girl];
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, x, z }]
   *   owners: { specId: girl id }                       ownership.claims, turned round
   *   quads: [{ id, x, z, user, running, throttle, revs, fuel }]   user: 'you', a girl's id or null; revs: share of the redline; fuel: share of the tank
   * Returns events: { type: 'dry' | 'thrashed', girl, spec, by }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const q of ctx.quads) {
      const owner = ctx.owners[q.id];
      const girl = owner && ctx.girls.find((g) => g.id === owner);
      const used = !!q.user && q.running;
      const low = used && q.fuel < p.lowFuel;
      this.dry[q.id] = low ? (this.dry[q.id] ?? 0) + dt : 0;
      const flat = used && (q.throttle >= p.thrashThrottle || q.revs >= p.thrashRevs);
      this.thrash[q.id] = flat ? (this.thrash[q.id] ?? 0) + dt : Math.max(0, (this.thrash[q.id] ?? 0) - p.thrashEase * dt);
      if (!girl || q.user === owner || this.care[owner] < p.minCare || dist(girl, q) > p.noticeRange) continue;
      if (this.clock - (this.lastSpoke[owner] ?? -Infinity) < p.speakCooldown) continue;
      let type = null;
      if (this.dry[q.id] >= p.dryDelay) type = 'dry';
      else if (this.thrash[q.id] >= p.thrashFor) type = 'thrashed';
      if (!type) continue;
      this.lastSpoke[owner] = this.clock;
      this.dry[q.id] = 0;
      this.thrash[q.id] = 0;
      this.care[owner] = clamp01(this.care[owner] - (type === 'dry' ? p.careLostDry : p.careLostThrash));
      events.push({ type, girl: owner, spec: q.id, by: q.user });
    }
    return events;
  }

  capture() {
    return { ...this.care };
  }

  restore(saved) {
    for (const id of this.ids) if (Number.isFinite(saved?.[id])) this.care[id] = clamp01(saved[id]);
  }
}
