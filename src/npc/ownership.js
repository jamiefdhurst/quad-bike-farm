// "That's my quad". Each girl claims one quad for the game, and gets cross when someone else rides it. Jess borrows
// Amy's now and then on purpose to wind her up. Pure logic: the game says who is on what, this says who objects.

export const DEFAULT_OWNERSHIP_PARAMS = {
  claimAfter: 20, // seconds into the game before a girl first says which one is hers
  claimRange: 9, // metres: she says so when you're on foot this close to both her and her quad
  noticeRange: 35, // metres: she sees someone else on her quad from this far
  upsetDelay: 1.5, // seconds someone else has been on it before she objects
  upsetCooldown: 80, // seconds between her objecting
  jessBorrowChance: 0.5, // Jess, picking a quad for a drive: the chance she takes Amy's if it's free
  amyBorrowChance: 0, // Amy never takes Jess's
  teaseChance: 0.7, // Jess, caught borrowing Amy's: the chance she gloats
};

export const OWNERSHIP_PARAM_RANGES = {
  claimAfter: [0, 300, 5],
  claimRange: [2, 40, 1],
  noticeRange: [5, 100, 1],
  upsetDelay: [0, 10, 0.1],
  upsetCooldown: [0, 600, 5],
  jessBorrowChance: [0, 1, 0.05],
  amyBorrowChance: [0, 1, 0.05],
  teaseChance: [0, 1, 0.05],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Ownership {
  constructor(params = { ...DEFAULT_OWNERSHIP_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.claims = {}; // girl id -> spec id
    this.clock = 0;
    this.said = new Set(); // girls who have announced theirs
    this.lastUpset = {}; // girl id -> time
    this.onSince = {}; // spec id -> { by, since }
  }

  /**
   * Each girl takes one quad of her own. `options` is { girlId: [spec ids she could take] }; no two take the same,
   * and a girl with nothing left to pick from goes without.
   */
  assign(options) {
    for (const [girl, list] of Object.entries(options)) {
      const free = list.filter((id) => !Object.values(this.claims).includes(id));
      if (free.length) this.claims[girl] = free[Math.floor(this.random() * free.length)];
    }
    return this.claims;
  }

  /** Whose it is, if anyone's. */
  ownerOf(specId) {
    return Object.keys(this.claims).find((g) => this.claims[g] === specId) ?? null;
  }

  /** The quad `girl` would rather borrow than pick for herself, from the spec ids she could drive now: her friend's, now and then. */
  borrowPick(girl, options) {
    const chance = this.p[`${girl}BorrowChance`] ?? 0;
    const theirs = Object.entries(this.claims).find(([g, id]) => g !== girl && options.includes(id));
    return theirs && this.random() < chance ? theirs[1] : null;
  }

  /**
   * One step. `ctx`:
   *   you: { x, z, onFoot }
   *   girls: [{ id, x, z, free }]                       free: stood about with nothing on
   *   quads: [{ id, x, z, user }]                       user: 'you', a girl's id, or null for who is at its controls
   * Returns events: { type: 'claim', girl, spec } and { type: 'upset', girl, spec, by }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const q of ctx.quads) {
      const owner = this.ownerOf(q.id);
      if (!q.user || q.user === owner) {
        delete this.onSince[q.id];
        continue;
      }
      if (this.onSince[q.id]?.by !== q.user) this.onSince[q.id] = { by: q.user, since: this.clock };
      const girl = ctx.girls.find((g) => g.id === owner);
      if (!girl || this.clock - this.onSince[q.id].since < p.upsetDelay || dist(girl, q) > p.noticeRange) continue;
      if (this.clock - (this.lastUpset[owner] ?? -Infinity) < p.upsetCooldown) continue;
      this.lastUpset[owner] = this.clock;
      events.push({ type: 'upset', girl: owner, spec: q.id, by: q.user });
    }
    if (this.clock < p.claimAfter || !ctx.you.onFoot) return events;
    for (const girl of ctx.girls) {
      const spec = this.claims[girl.id];
      const q = ctx.quads.find((x) => x.id === spec);
      if (!q || this.said.has(girl.id) || !girl.free || q.user) continue;
      if (dist(girl, ctx.you) > p.claimRange || dist(q, ctx.you) > p.claimRange) continue;
      this.said.add(girl.id);
      events.push({ type: 'claim', girl: girl.id, spec });
    }
    return events;
  }
}
