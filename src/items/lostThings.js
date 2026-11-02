// Small things put down in the field and left. The jump leads and the three bottles lie where you set them (G); in long grass they sink
// into it, so only part shows and you have to come close to see them. The farm remembers where each one lies, and a girl who comes
// across one may carry it back to its place, or, if it's Jess, keep it until you ask. Pure logic: the game says what is lying where and
// who is free, and does the carrying. The offer is the chooser's (npc/chooser.js), as for every choice a girl makes.

export const DEFAULT_LOST_PARAMS = {
  clearSight: 45, // metres you can see one lying on open ground (tarmac, a yard, the barn floor)
  grassSight: 2.5, // metres you can see one lying in long grass: you have to nearly tread on it
  stubbleCover: 0.35, // how much of the way to long grass the stubble is (0..1)
  sink: 0.7, // how much of a thing's height goes into the grass at full cover
  noticeRange: 14, // metres a girl notices one at, on open ground (long grass cuts it down the same way as it does your sight)
  cooldown: 120, // seconds after a girl has been to fetch one before either goes again
  firstDelay: 90, // seconds into a game before one of them looks about
  weightAmy: 1.1, // how keen Amy is to bring a lost thing back
  weightJess: 0.7, // how keen Jess is
  keepChance: 0.6, // the chance Jess keeps it and makes you ask, rather than putting it back
  keepFor: 600, // seconds Jess keeps it before she gives in and puts it back
  jobTimeout: 90, // seconds a girl has to reach it and carry it back before the job lapses
};

export const LOST_PARAM_RANGES = {
  clearSight: [10, 100, 1],
  grassSight: [0.5, 10, 0.1],
  stubbleCover: [0, 1, 0.05],
  sink: [0, 1, 0.05],
  noticeRange: [3, 50, 1],
  cooldown: [0, 600, 10],
  firstDelay: [0, 900, 10],
  weightAmy: [0, 3, 0.05],
  weightJess: [0, 3, 0.05],
  keepChance: [0, 1, 0.05],
  keepFor: [30, 1800, 10],
  jobTimeout: [20, 300, 5],
};

/** The things that can be lost, with how tall each is lying down (to sink it) and the sentence for the girl and the wheel. */
export const LOSABLE = {
  leads: { name: 'jump leads', height: 0.1 },
  oilBottle: { name: 'oil bottle', height: 0.33 },
  coolantBottle: { name: 'coolant bottle', height: 0.3 },
  antiGelBottle: { name: 'diesel anti-gel', height: 0.3 },
};

/** How much long grass is over a spot, 0..1, from what the ground is there (fields.areaOf and the tarmac and stubble amounts). */
export function coverAt(area, tarmac, stubble, p = DEFAULT_LOST_PARAMS) {
  if (tarmac > 0.5) return 0;
  if (stubble > 0.5) return p.stubbleCover;
  return area === 'grass' || area === 'meadow' || area === 'sheep' || area === 'hill' || area === 'north' || area === 'south' ? 1 : area === 'lane' ? 0.5 : 0;
}

/** How far away you can see one lying under `cover`. */
export function sightRange(cover, p = DEFAULT_LOST_PARAMS) {
  return p.clearSight + (p.grassSight - p.clearSight) * cover;
}

/** Metres of it that go into the ground under `cover`. */
export function sinkFor(kind, cover, p = DEFAULT_LOST_PARAMS) {
  return (LOSABLE[kind]?.height ?? 0.2) * p.sink * cover;
}

/** Whether a thing at `distance` metres shows at all. */
export function seen(cover, distance, p = DEFAULT_LOST_PARAMS) {
  return distance <= sightRange(cover, p);
}

/** How far off a girl notices one: the same cut by long grass as your own sight is, and never beyond it. */
export function noticeFrom(cover, p = DEFAULT_LOST_PARAMS) {
  return Math.min(p.noticeRange, sightRange(cover, p));
}

export class LostThings {
  constructor(params = { ...DEFAULT_LOST_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.lying = {}; // kind -> { x, z, yaw }: set down out in the field
    this.kept = {}; // kind -> girl id: Jess has it and is waiting to be asked
    this.job = null; // { girl, kind, keep, until }
    this.cooldownUntil = 0;
  }

  /** One step. Returns the things Jess has kept long enough: [{ type: 'giveIn', kind, girl }], for the game to put back. */
  update(dt) {
    this.clock += dt;
    if (this.job && this.clock > this.job.until) this.finish();
    const events = [];
    for (const [kind, k] of Object.entries(this.kept)) {
      if (this.clock <= k.until) continue;
      delete this.kept[kind];
      events.push({ type: 'giveIn', kind, girl: k.girl });
    }
    return events;
  }

  /** Records where each thing lies: `things` is [{ kind, x, z, yaw, out }], `out` true when it is on the ground away from its place. */
  sync(things) {
    for (const t of things) {
      if (t.out) this.lying[t.kind] = { x: t.x, z: t.z, yaw: t.yaw };
      else delete this.lying[t.kind];
    }
  }

  /** It is back in its place, or in your hands. */
  recovered(kind) {
    delete this.lying[kind];
  }

  /** What she could go and fetch: `ctx.girls` [{ id, free, x, z, weight }], `ctx.cover(x, z)`. One offer per girl, for the nearest thing she notices. */
  offers(ctx) {
    if (this.job || this.clock < this.p.firstDelay || this.clock < this.cooldownUntil) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || g.weight <= 0) continue;
      let best = null;
      for (const [kind, at] of Object.entries(this.lying)) {
        const d = Math.hypot(g.x - at.x, g.z - at.z);
        if (d > noticeFrom(ctx.cover(at.x, at.z), this.p) || (best && d >= best.d)) continue;
        best = { kind, d };
      }
      if (best) out.push({ key: 'fetchLost', girl: g.id, kind: best.kind, weight: g.weight });
    }
    return out;
  }

  /** The weight for each girl: Amy brings it back more eagerly than Jess. */
  weightFor(girl) {
    return girl === 'jess' ? this.p.weightJess : girl === 'amy' ? this.p.weightAmy : 0;
  }

  /** She chose to: { type: 'fetch', girl, kind, keep }. Jess may keep it; nobody else does. */
  take(offer) {
    const keep = offer.girl === 'jess' && this.random() < this.p.keepChance;
    this.job = { girl: offer.girl, kind: offer.kind, keep, until: this.clock + this.p.jobTimeout };
    return { type: 'fetch', girl: offer.girl, kind: offer.kind, keep };
  }

  /** For the debug panel: she goes for the first thing lying out now, whether or not she'd notice it. Returns the event or null. */
  force(girl, keep = false) {
    const kind = Object.keys(this.lying)[0];
    if (!kind || this.job) return null;
    this.job = { girl, kind, keep, until: this.clock + this.p.jobTimeout };
    return { type: 'fetch', girl, kind, keep };
  }

  /** The job is over, done or lapsed. */
  finish() {
    this.job = null;
    this.cooldownUntil = this.clock + this.p.cooldown;
  }

  /** She has picked it up and is going to keep it. */
  keep(kind, girl) {
    delete this.lying[kind];
    this.kept[kind] = { girl, until: this.clock + this.p.keepFor };
  }

  /** What this girl is keeping, as kinds. */
  keeping(girl) {
    return Object.entries(this.kept).filter(([, k]) => k.girl === girl).map(([kind]) => kind);
  }

  /** You asked for it: she hands it over. True if she had it. */
  askFor(kind, girl) {
    if (this.kept[kind]?.girl !== girl) return false;
    delete this.kept[kind];
    return true;
  }

  toJSON() {
    return { lying: { ...this.lying } };
  }

  /** Back from a save: unknown kinds and bad numbers are dropped, so an old save or a hand-edited one loads. */
  restore(data) {
    this.lying = {};
    for (const [kind, at] of Object.entries(data?.lying ?? {})) {
      if (LOSABLE[kind] && Number.isFinite(at?.x) && Number.isFinite(at?.z)) this.lying[kind] = { x: at.x, z: at.z, yaw: Number.isFinite(at.yaw) ? at.yaw : 0 };
    }
  }

  describe() {
    const lost = Object.keys(this.lying).map((k) => LOSABLE[k].name);
    const kept = Object.entries(this.kept).map(([k, v]) => `${LOSABLE[k].name} (${v.girl})`);
    return `${lost.length ? `lying out: ${lost.join(', ')}` : 'nothing lying out'}${kept.length ? `; kept: ${kept.join(', ')}` : ''}${this.job ? `; ${this.job.girl} fetching the ${LOSABLE[this.job.kind].name}` : ''}`;
  }
}
