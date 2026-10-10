// Sheltering in a cab. When it rains a girl who's stood about may climb into the UTV or a Land Rover (they have roofs) instead of running for
// the barn, and on a cold day she may go and get into a Land Rover, start it and sit with the heater of its engine going. When the weather
// turns, or she's had enough, she climbs out, and switches off an engine she started. Pure logic: the game says who and what is where, this
// says which cab she could go to (offers, weighed by her needs in chooser.js against the barn doorway and everything else), who comes out
// and what gets switched off. Tested in tests/cabShelter.test.js.

export const DEFAULT_CAB_SHELTER_PARAMS = {
  rainAbove: 0.25, // rain above which a girl thinks of getting into a cab
  dryBelow: 0.08, // rain below which she thinks of getting out again
  coldBelow: 0.5, // weather warmth under which a dry day is cold enough to sit in a running Land Rover
  cabRange: 45, // metres: she'll walk this far to a cab
  rainWeight: 1.1, // how much she'd rather a cab than the barn doorway out of the rain (the barn is 1; chooser.js weighs them)
  rainStartChance: 0.35, // chance she starts a Land Rover that isn't running when she gets in out of the rain
  coldWeight: 0.6, // how much she cares for sitting in a Land Rover with the heater on, on a cold dry day (twice that if it's running)
  coldStayMin: 60, // seconds she sits warming up before she gets out
  coldStayMax: 170,
  rainStayMin: 40, // and the least she stays in once the rain has stopped (she waits for it to be properly dry as well)
  rainStayMax: 120,
  dryDelayMin: 6, // seconds after the rain has stopped before she gets out
  dryDelayMax: 22,
  goTimeout: 90, // seconds she has to be in by (starting it can take a few goes) before she gives up and the cab is free
  startAfter: 30, // seconds into the game before anyone does
  cooldown: 150, // seconds after she's out before she thinks of it again
};

export const CAB_SHELTER_PARAM_RANGES = {
  rainAbove: [0.05, 1, 0.01],
  dryBelow: [0, 0.5, 0.01],
  coldBelow: [0, 1, 0.05],
  cabRange: [5, 150, 1],
  rainWeight: [0, 3, 0.05],
  rainStartChance: [0, 1, 0.05],
  coldWeight: [0, 3, 0.05],
  coldStayMin: [5, 600, 5],
  coldStayMax: [5, 900, 5],
  rainStayMin: [0, 600, 5],
  rainStayMax: [0, 900, 5],
  dryDelayMin: [0, 120, 1],
  dryDelayMax: [0, 240, 1],
  goTimeout: [10, 300, 5],
  startAfter: [0, 300, 5],
  cooldown: [0, 900, 10],
};

const between = (random, min, max) => min + random() * Math.max(0, max - min);

export class CabShelter {
  constructor(params = { ...DEFAULT_CAB_SHELTER_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.dryFor = {}; // girl id -> seconds it has been dry while she's in a cab
    this.delay = {}; // girl id -> how long after the weather turns before she gets out
    this.coolUntil = {}; // girl id -> time
    this.mine = new Map(); // girl id -> { cab, reason, state: 'going' | 'in', until, leaveAt, started }
    this.startedBy = new Map(); // cab id -> true while an engine she started is running for her
  }

  /** Whether a girl is sulking in this cab (or on her way to it), so nobody else gets in with her. */
  isSulkCab(cab) {
    return [...this.mine.values()].some((m) => m.reason === 'sulk' && m.cab === cab);
  }

  /** Where this girl is in it: null, or { cab, reason, state }. */
  of(id) {
    return this.mine.get(id) ?? null;
  }

  /**
   * Sends a girl to a cab at once (for the debug panel, and to sulk), without the weather or the dice. Returns the event, or null if there is nothing to go to.
   * `ctx` is the same as for `update`; `cab` picks one by id, or the nearest with room.
   */
  force(id, ctx, reason = 'rain', cab = null) {
    const g = ctx.girls.find((x) => x.id === id);
    if (!g || this.mine.has(id)) return null;
    const pick = this.nearest(g, ctx, cab ? (c) => c.id === cab : reason === 'cold' || reason === 'sulk' ? (c) => c.warm : () => true, reason === 'sulk' ? 400 : this.p.cabRange); // she'll storm off a long way
    return pick ? this.send(g, pick, reason, reason === 'cold' || reason === 'sulk' || !pick.running) : null;
  }

  nearest(g, ctx, ok = () => true, range = this.p.cabRange) {
    let best = null;
    let bestD = range;
    for (const c of ctx.cabs) {
      const going = [...this.mine.values()].filter((m) => m.cab === c.id).length;
      if (!c.open || c.seats - going <= 0 || !ok(c)) continue;
      const d = Math.hypot(c.x - g.x, c.z - g.z);
      if (d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  send(g, cab, reason, start) {
    const p = this.p;
    const startNow = start && !cab.running;
    this.mine.set(g.id, { cab: cab.id, reason, state: 'going', until: this.clock + (reason === 'sulk' ? p.goTimeout * 3 : p.goTimeout), leaveAt: Infinity, started: startNow });
    if (startNow) this.startedBy.set(cab.id, true);
    return { type: 'go', girl: g.id, cab: cab.id, reason, start: startNow };
  }

  /**
   * One step. `ctx`:
   *   rain: 0..1, warmth: 0..1
   *   girls: [{ id, x, z, free, cab }]   free: stood about; cab: the id of the cab she is in or walking to (by the game's own doing), or null
   *   cabs: [{ id, x, z, open, seats, running, warm }]   open: nobody driving, riding or going for it and it's still; seats: free seats;
   *       warm: it's a Land Rover (an engine to warm up by), not the UTV
   * Returns events: { type: 'in', girl, cab, reason } (she's aboard), { type: 'out', girl, cab },
   *   { type: 'switchOff', cab } (nobody left in a cab whose engine she started). Going is an offer (offers, take), not decided here.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const raining = ctx.rain > p.rainAbove;
    const dry = ctx.rain < p.dryBelow;
    const cold = !raining && ctx.warmth < p.coldBelow;

    for (const g of ctx.girls) {
      const m = this.mine.get(g.id);
      if (!m) continue;
      if (m.state === 'going') {
        if (g.cab === m.cab) {
          m.state = 'in';
          m.leaveAt = this.clock + between(this.random, ...(m.reason === 'cold' ? [p.coldStayMin, p.coldStayMax] : [p.rainStayMin, p.rainStayMax]));
          this.dryFor[g.id] = 0;
          events.push({ type: 'in', girl: g.id, cab: m.cab, reason: m.reason });
        } else if (this.clock >= m.until) this.drop(g.id, events);
        continue;
      }
      if (g.cab !== m.cab) {
        this.drop(g.id, events); // you drove off with her, she was asked out, or she got bored (the ride's own timer)
        continue;
      }
      if (m.reason === 'sulk') continue; // she leaves when sulking.js says (talked round, or time)
      const over = m.reason === 'cold' ? !cold : dry;
      this.dryFor[g.id] = over ? (this.dryFor[g.id] ?? 0) + dt : 0;
      this.delay[g.id] ??= between(this.random, p.dryDelayMin, p.dryDelayMax);
      if (this.clock >= m.leaveAt && (m.reason === 'cold' || this.dryFor[g.id] >= this.delay[g.id])) {
        delete this.delay[g.id];
        events.push({ type: 'out', girl: g.id, cab: m.cab });
      }
    }

    // An engine she started goes off when nobody she took there is left.
    for (const cab of [...this.startedBy.keys()]) {
      if (![...this.mine.values()].some((m) => m.cab === cab)) {
        this.startedBy.delete(cab);
        events.push({ type: 'switchOff', cab });
      }
    }
    return events;
  }

  /**
   * The cabs each girl could go to now (the same `ctx` as update; a girl's `interruptible` means the rain can get her up off a seat or
   * away from something idle like warming her hands):
   * [{ key: 'shelterCab' | 'warmCab', girl, cab, reason, weight }] for the chooser. In the rain the nearest cab with room, or on a cold
   * dry day the nearest Land Rover, and not before the start, while she's in one, or straight after.
   */
  offers(ctx) {
    const p = this.p;
    if (this.clock < p.startAfter) return [];
    const raining = ctx.rain > p.rainAbove;
    const cold = !raining && ctx.warmth < p.coldBelow;
    if (!raining && !cold) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (this.mine.has(g.id) || this.clock < (this.coolUntil[g.id] ?? 0)) continue;
      if (raining && (g.free || g.interruptible)) {
        const cab = this.nearest(g, ctx);
        if (cab) out.push({ key: 'shelterCab', girl: g.id, cab: cab.id, reason: 'rain', weight: p.rainWeight });
      } else if (cold && g.free) {
        const cab = this.nearest(g, ctx, (c) => c.warm);
        if (cab) out.push({ key: 'warmCab', girl: g.id, cab: cab.id, reason: 'cold', weight: p.coldWeight * (cab.running ? 2 : 1) });
      }
    }
    return out;
  }

  /** She chose to go: books her seat and returns the 'go' event (null if it's gone in the meantime). In the rain she may start it. */
  take(offer, ctx) {
    const cab = ctx.cabs.find((c) => c.id === offer.cab);
    if (!cab || this.mine.has(offer.girl)) return null;
    const start = offer.reason === 'cold' ? true : cab.warm && this.random() < this.p.rainStartChance;
    return this.send({ id: offer.girl }, cab, offer.reason, start);
  }

  drop(id, events) {
    this.mine.delete(id);
    delete this.delay[id];
    this.dryFor[id] = 0;
    this.coolUntil[id] = this.clock + this.p.cooldown;
    return events;
  }
}
