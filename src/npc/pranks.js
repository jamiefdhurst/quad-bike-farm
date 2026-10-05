// Pranks. While you're away from the quads, Jess sneaks over and turns a fuel tap
// off or puts the choke on a warm engine, and Amy hides the jerry can or the
// toolbox. Nothing tells you: you find out when the quad won't run properly or
// the thing isn't where you left it, and the culprit can't keep a straight face.
// A favoured girl never pranks you; a neglected one does it more. Pure logic;
// the game says what's where, sends the girl, and does the deed.

export const DEFAULT_PRANK_PARAMS = {
  firstDelay: 240, // seconds into a game before the first prank can happen
  cooldown: 600, // seconds between pranks, at the soonest
  checkEvery: 5, // seconds between each look for a chance
  chance: 0.12, // chance per look, once the cooldown is up and you're away from something
  awayDistance: 30, // metres you must be from a quad (or a hidden item's place) for it to be fair game
  hideDistance: 40, // how far from its place a hidden item can go, at the most
  hideRestoreAfter: 600, // seconds before she puts a hidden thing back herself
  foundRange: 6, // metres from where the item should be before you notice it's gone
  foundAfter: 3, // seconds on a pranked quad before the culprit gives herself away
  neglectedBoost: 2, // a neglected girl pranks this much more often
  sneakGiveUp: 90, // seconds she gets to reach the thing before the prank lapses
  warmAbove: 0.5, // engine temperature (0..1) above which the choke counts as a prank on a warm engine
};

export const PRANK_PARAM_RANGES = {
  firstDelay: [0, 1200, 10],
  cooldown: [0, 1800, 10],
  checkEvery: [1, 30, 1],
  chance: [0, 1, 0.01],
  awayDistance: [5, 100, 1],
  hideDistance: [10, 100, 1],
  hideRestoreAfter: [30, 1800, 10],
  foundRange: [2, 20, 0.5],
  foundAfter: [0, 15, 0.5],
  neglectedBoost: [1, 5, 0.1],
  sneakGiveUp: [10, 300, 5],
  warmAbove: [0, 1, 0.05],
};

/** Who does what: Jess meddles with the engines, Amy hides things. */
export const PRANKSTERS = {
  jess: ['tap', 'choke'],
  amy: ['hideCan', 'hideToolbox'],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Pranks {
  constructor(params = { ...DEFAULT_PRANK_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.nextCheck = params.checkEvery;
    this.lastPrank = -Infinity;
    this.active = []; // { kind, girl, quad?, item?, spot?, since, found, confessed }
  }

  /** Is this prank still in force (and so not to be repeated)? */
  has(kind, target) {
    return this.active.some((a) => a.kind === kind && (a.quad ?? a.item) === target);
  }

  /** The one thing this girl has done that you've found out about and she hasn't owned up to. */
  unconfessed(girl) {
    return this.active.find((a) => a.girl === girl && a.found && !a.confessed) ?? null;
  }

  /**
   * One step. `ctx`:
   *   you: { x, z, riding }                       riding is the quad id or null
   *   girls: [{ id, free, mood }]                  free: stood about, nothing on
   *   quads: [{ id, x, z, taken, running, tap, choke, temperature }]   taken: someone on it or going to it
   *   items: { can: { x, z, held, home }, toolbox: { ... } }          home: the place she'd put it back
   *   spots: [{ x, z }]                            places to hide things
   * Returns the events: { type: 'start', prank }, { type: 'found', prank }, { type: 'restore', prank }, { type: 'resolved', prank }.
   */
  update(dt, ctx) {
    const events = [];
    this.clock += dt;
    this.watch(dt, ctx, events);
    if (this.clock < this.nextCheck) return events;
    this.nextCheck = this.clock + this.p.checkEvery;
    if (this.clock < this.p.firstDelay || this.clock - this.lastPrank < this.p.cooldown) return events;
    const prank = this.choose(ctx);
    if (prank) {
      this.lastPrank = this.clock;
      this.active.push(prank);
      events.push({ type: 'start', prank });
    }
    return events;
  }

  /** What she could do, if anything, and whether the dice say she does. */
  choose(ctx) {
    const options = [];
    for (const g of ctx.girls) {
      if (!g.free || g.mood === 'favoured') continue;
      const weight = g.mood === 'neglected' ? this.p.neglectedBoost : 1;
      for (const kind of PRANKSTERS[g.id] ?? []) {
        for (const target of this.targets(kind, ctx)) options.push({ girl: g.id, kind, weight, ...target });
      }
    }
    if (!options.length) return null;
    const weight = options.reduce((s, o) => s + o.weight, 0) / options.length;
    if (this.random() >= Math.min(1, this.p.chance * weight)) return null;
    let r = this.random() * options.reduce((s, o) => s + o.weight, 0);
    const o = options.find((x) => (r -= x.weight) <= 0) ?? options[options.length - 1];
    return { kind: o.kind, girl: o.girl, quad: o.quad, item: o.item, spot: o.spot, since: this.clock, applied: false, found: false, confessed: false, riddenFor: 0 };
  }

  /** Quads or things this kind of prank could be played on right now. */
  targets(kind, ctx) {
    const far = (o) => dist(ctx.you, o) > this.p.awayDistance;
    if (kind === 'tap' || kind === 'choke') {
      return ctx.quads
        .filter((q) => !q.taken && !q.running && far(q) && !this.has(kind, q.id))
        .filter((q) => (kind === 'tap' ? q.tap !== 'off' : q.choke < 0.5 && q.temperature > this.p.warmAbove))
        .map((q) => ({ quad: q.id }));
    }
    const item = kind === 'hideCan' ? 'can' : 'toolbox';
    const it = ctx.items[item];
    if (!it || it.held || this.has(kind, item) || !far(it) || ctx.you.riding) return [];
    // Somewhere near enough to find, and not right where you are.
    const spots = ctx.spots.filter((s) => dist(s, it) > 8 && dist(s, it) <= this.p.hideDistance && dist(s, ctx.you) > 12);
    if (!spots.length) return [];
    return [{ item, spot: spots[Math.floor(this.random() * spots.length)] }];
  }

  /** Finding out, putting right, and things coming back. */
  watch(dt, ctx, events) {
    for (const a of [...this.active]) {
      const done = () => {
        this.active.splice(this.active.indexOf(a), 1);
        events.push({ type: 'resolved', prank: a });
      };
      // She's still sneaking over; if she never gets there (you turned up, she was called off) it lapses.
      if (!a.applied) {
        if (this.clock - a.since > this.p.sneakGiveUp) done();
        continue;
      }
      if (a.quad !== undefined) {
        const q = ctx.quads.find((x) => x.id === a.quad);
        if (!q) { done(); continue; }
        const stillSo = a.kind === 'tap' ? q.tap === 'off' : q.choke >= 0.5;
        if (ctx.you.riding === a.quad) a.riddenFor += dt;
        // You've sat on it a while, or you've put it right: either way you know.
        if (!a.found && (a.riddenFor >= this.p.foundAfter || (!stillSo && ctx.you.riding === a.quad))) {
          a.found = true;
          events.push({ type: 'found', prank: a });
        }
        if (!stillSo) done();
      } else {
        const it = ctx.items[a.item];
        if (it.held) { done(); continue; }
        if (!a.found && dist(ctx.you, it.home) < this.p.foundRange) {
          a.found = true;
          events.push({ type: 'found', prank: a });
        }
        if (this.clock - a.since > this.p.hideRestoreAfter) {
          events.push({ type: 'restore', prank: a });
          done();
        }
      }
    }
  }

  /** She's done it: from now on the prank is in force and you can find out. Restore time counts from here. */
  apply(prank) {
    prank.applied = true;
    prank.since = this.clock;
  }

  /** She was called off before she got there. */
  cancel(prank) {
    const i = this.active.indexOf(prank);
    if (i >= 0) this.active.splice(i, 1);
  }

  /** She's owned up (or been caught out); she doesn't do it twice. */
  confess(prank) {
    prank.confessed = true;
  }
}
