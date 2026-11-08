// A girl tidies up after you. Amy shuts a gate you left open, puts a jerry can back where it lives and hangs a helmet left on the ground back
// on the hooks; Jess leaves things where she drops them (her weight is 0, and she says so: tidyUpLines.js). Each is a thing out of place that
// has stayed that way a while with nobody about, so she never snatches the can you have just put down. Going is an offer (the chooser,
// chooser.js); only the debug panel's forced one starts here. Pure logic: the game says what is out of place and who is free, and does the
// walking, the gate, the carrying and the hooks.

export const KINDS = ['gate', 'can', 'helmet'];

export const DEFAULT_TIDY_UP_PARAMS = {
  startAfter: 180, // seconds into the game before she thinks of it
  cooldown: 240, // seconds after one tidy before anyone might do another
  range: 90, // metres: she is this close to the thing
  gateAfter: 25, // seconds a gate has stood open, with nobody near it, before it counts as left
  canAfter: 90, // seconds a can has lain away from its place before it counts as left
  helmetAfter: 40, // seconds a helmet has lain on the ground before it counts as left
  canHome: 8, // metres: a can this close to its own place is where it lives
  gateShare: 1, // of her keenness when it is a gate (it matters once sheep can get out)
  canShare: 0.8, // and a jerry can
  helmetShare: 0.9, // and a helmet
  jobTimeout: 100, // seconds she has to get there and finish before it is forgotten
};

export const TIDY_UP_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  cooldown: [0, 1800, 30],
  range: [10, 300, 5],
  gateAfter: [0, 300, 5],
  canAfter: [0, 600, 10],
  helmetAfter: [0, 600, 10],
  canHome: [1, 30, 1],
  gateShare: [0, 1, 0.05],
  canShare: [0, 1, 0.05],
  helmetShare: [0, 1, 0.05],
  jobTimeout: [20, 240, 5],
};

export class TidyUp {
  constructor(params = { ...DEFAULT_TIDY_UP_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.out = new Map(); // id -> { kind, x, z, since }: what is out of place now, and since when
    this.job = null; // { girl, kind, id, until }: she is on her way, or at it
    this.cooldownUntil = 0;
  }

  /** Whether a can lying here is out of place: further than `canHome` from its own spot. */
  canOutOfPlace(at, home) {
    return Math.hypot(at.x - home.x, at.z - home.z) > this.p.canHome;
  }

  /**
   * One step. `things` is everything out of place and free to be put right now: [{ id, kind, x, z }] (a gate open with nobody near, a can
   * lying on the ground away from its place, a helmet on the ground). Anything that drops off the list starts its wait again.
   */
  update(dt, things = []) {
    this.clock += dt;
    const now = new Set();
    for (const t of things) {
      now.add(t.id);
      const known = this.out.get(t.id);
      this.out.set(t.id, { kind: t.kind, x: t.x, z: t.z, since: known?.since ?? this.clock });
    }
    for (const id of [...this.out.keys()]) if (!now.has(id)) this.out.delete(id);
    if (this.job && this.clock > this.job.until) this.finished();
  }

  /** What has been left long enough to tidy, nearest `at` first. */
  left(at = null) {
    const after = { gate: this.p.gateAfter, can: this.p.canAfter, helmet: this.p.helmetAfter };
    const list = [...this.out.entries()].filter(([, t]) => this.clock - t.since >= after[t.kind]).map(([id, t]) => ({ id, ...t }));
    if (at) list.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
    return list;
  }

  /** Going, as offers for the chooser: [{ key: 'tidyUp', girl, kind, thing, weight }], the nearest thing for each free girl, or none. */
  offers(ctx) {
    if (this.job || this.clock < this.p.startAfter || this.clock < this.cooldownUntil) return [];
    const share = { gate: this.p.gateShare, can: this.p.canShare, helmet: this.p.helmetShare };
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || g.weight <= 0) continue;
      const t = this.left(g).find((x) => Math.hypot(g.x - x.x, g.z - x.z) <= this.p.range);
      if (t) out.push({ key: 'tidyUp', girl: g.id, kind: t.kind, thing: t.id, weight: g.weight * share[t.kind] });
    }
    return out;
  }

  /** For the debug panel: this girl tidies the nearest thing now, left long enough or not. Null if nothing is out of place. */
  force(ctx, girlId, kind = null) {
    const g = ctx.girls.find((o) => o.id === girlId && o.free);
    if (!g || this.job) return null;
    const t = [...this.out.entries()].map(([id, x]) => ({ id, ...x })).filter((x) => !kind || x.kind === kind)
      .sort((a, b) => Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z))[0];
    return t ? this.take({ girl: g.id, kind: t.kind, thing: t.id }) : null;
  }

  /** She chose to: books the job and returns the event the game acts on, { type: 'go', girl, kind, thing }. */
  take(offer) {
    this.job = { girl: offer.girl, kind: offer.kind, thing: offer.thing, until: this.clock + this.p.jobTimeout };
    return { type: 'go', girl: offer.girl, kind: offer.kind, thing: offer.thing };
  }

  /** The job is done, or has been given up. */
  finished() {
    if (this.job) this.out.delete(this.job.thing);
    this.job = null;
    this.cooldownUntil = this.clock + this.p.cooldown;
  }

  /** The job could not start or was not needed: no cooldown. */
  cancel() {
    this.job = null;
  }

  describe() {
    if (this.job) return `${this.job.girl} is tidying ${this.job.thing}`;
    const left = this.cooldownUntil - this.clock;
    if (left > 0) return `resting for ${Math.round(left)} s`;
    if (this.clock < this.p.startAfter) return 'not yet';
    const n = this.left().length;
    return n ? `${n} thing${n === 1 ? '' : 's'} left lying` : `nothing left out (${this.out.size} out of place, not long enough yet)`;
  }
}
