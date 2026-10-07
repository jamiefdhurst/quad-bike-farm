// The girls riding in the UTV while you drive. Pure logic (the game says what the UTV and the girls are doing, and gets events back), so it's
// tested without the game (tests/utvRide.test.js).
//
//   board     you've stopped with the engine running: one girl who's stood about may walk over and climb in, or both of them
//   squabble  both want the middle of the bench: one wins it (Jess more often than not), the other has the window, or goes in the bed
//   bedTell   a girl is riding in the bed against the rules, and the other one says so
//   bedShout  she's in the bed and you're going fast: she complains about the bouncing
//   slide     the bed has tipped up with her on the tailgate: she goes off the back
//   leave     you got off, or she's been in long enough: she climbs out

export const UTV_SEAT_NAMES = ['mid', 'left', 'bed'];

export const DEFAULT_UTV_RIDE_PARAMS = {
  boardRange: 30, // metres a girl who's stood about will walk over from
  stopSpeed: 0.6, // m/s: the UTV has to be slower than this for her to climb in
  boardDelayMin: 1.5, // seconds after you've stopped before the first one sets off
  boardDelayMax: 5,
  followDelayMin: 0.8, // and after the first one the second sets off this much later
  followDelayMax: 2.4,
  boardChance: 0.6, // chance a given stop gets a girl climbing in at all
  bothChance: 0.45, // chance it's both of them when both are near
  jessChance: 0.55, // chance it's Jess when only one of two comes
  squabbleChance: 0.7, // chance that both coming means a row over the middle
  jessWinsMiddle: 0.6, // chance Jess gets it in a row
  aloneMiddle: 0.5, // a girl on her own takes the middle (beside you) rather than the window
  jessBedChance: 0.3, // chance Jess on her own would rather ride in the bed
  amyBedChance: 0.03, // chance Amy would
  jessBedLoseChance: 0.35, // chance Jess goes in the bed after losing the middle
  amyBedLoseChance: 0.02,
  tellMin: 1.5, // seconds after a girl is up in the bed before the other one says something
  tellMax: 3.5,
  tellRange: 25, // metres: the other girl has to be this close to notice
  bedShoutSpeed: 6, // m/s: she only complains about the bouncing when it's going
  bedShoutMin: 18, // seconds between her complaints
  bedShoutMax: 40,
  leaveDelayMax: 0.9, // seconds she takes to start climbing out once you've got off
  stayMin: 120, // seconds in there before she gets bored and climbs out (asked in or not)...
  stayMax: 300, // ...somewhere between these
};

export const UTV_RIDE_PARAM_RANGES = {
  boardRange: [5, 100, 1],
  stopSpeed: [0.1, 3, 0.1],
  boardDelayMin: [0, 10, 0.5],
  boardDelayMax: [0, 20, 0.5],
  followDelayMin: [0, 5, 0.1],
  followDelayMax: [0, 8, 0.1],
  boardChance: [0, 1, 0.05],
  bothChance: [0, 1, 0.05],
  jessChance: [0, 1, 0.05],
  squabbleChance: [0, 1, 0.05],
  jessWinsMiddle: [0, 1, 0.05],
  aloneMiddle: [0, 1, 0.05],
  jessBedChance: [0, 1, 0.05],
  amyBedChance: [0, 1, 0.01],
  jessBedLoseChance: [0, 1, 0.05],
  amyBedLoseChance: [0, 1, 0.01],
  tellMin: [0, 10, 0.5],
  tellMax: [0, 20, 0.5],
  tellRange: [5, 80, 1],
  bedShoutSpeed: [1, 12, 0.5],
  bedShoutMin: [3, 120, 1],
  bedShoutMax: [3, 240, 1],
  leaveDelayMax: [0, 5, 0.1],
  stayMin: [10, 900, 5],
  stayMax: [10, 1200, 5],
};

/**
 * Where the girls in `ids` sit, given the seats already taken (`taken`: a Set of 'mid', 'left', 'bed'). `random` is a 0..1 source.
 * Returns { seats: [{ id, seat }] in the order they should climb in, squabble: { winner, loser } or null }. A girl with no seat to take
 * isn't in the list.
 */
export function planSeats(ids, taken, random, p = DEFAULT_UTV_RIDE_PARAMS) {
  const free = new Set(['mid', 'left'].filter((s) => !taken.has(s)));
  const bedFree = !taken.has('bed');
  const bedChance = (id) => (id === 'jess' ? p.jessBedChance : p.amyBedChance);
  const bedLose = (id) => (id === 'jess' ? p.jessBedLoseChance : p.amyBedLoseChance);
  const seats = [];
  let squabble = null;
  const take = (id, want) => {
    const seat = free.has(want) ? want : free.has('mid') ? 'mid' : free.has('left') ? 'left' : bedFree && !seats.some((s) => s.seat === 'bed') ? 'bed' : null;
    if (!seat) return;
    free.delete(seat);
    seats.push({ id, seat });
  };

  if (ids.length >= 2 && free.has('mid') && free.has('left') && random() < p.squabbleChance) {
    const jess = ids.includes('jess');
    const winner = jess && ids.length > 1 ? (random() < p.jessWinsMiddle ? 'jess' : ids.find((i) => i !== 'jess')) : ids[0];
    const loser = ids.find((i) => i !== winner);
    squabble = { winner, loser };
    take(winner, 'mid');
    // Having lost, she may sulk off to the bed rather than sit at the window.
    if (bedFree && random() < bedLose(loser)) seats.push({ id: loser, seat: 'bed' });
    else take(loser, 'left');
    return { seats, squabble };
  }
  const order = ids.length > 1 && random() < 0.5 ? ids.slice().reverse() : ids.slice();
  for (const id of order) {
    if (bedFree && !seats.some((s) => s.seat === 'bed') && random() < bedChance(id)) seats.push({ id, seat: 'bed' });
    else take(id, random() < p.aloneMiddle ? 'mid' : 'left');
  }
  return { seats, squabble: null };
}

export class UtvRide {
  constructor(params = { ...DEFAULT_UTV_RIDE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.rolled = false; // this stop has had its chance already
    this.queue = []; // girls on their way: { id, seat, in, squabble }
    this.girls = {}; // id -> { aboardFor, stayFor, shoutIn, leaveIn, tellIn, told }
    this.asked = new Set(); // girls you asked in from the wheel: they stay until you ask them out, even with you off the UTV
  }

  girl(id) {
    return (this.girls[id] ??= { aboardFor: 0, stayFor: null, shoutIn: null, leaveIn: null, tellIn: null, told: false });
  }

  between(a, b) {
    return a + this.random() * Math.max(0, b - a);
  }

  /** The seats taken right now, by who's aboard or on their way. */
  taken(ctx) {
    const set = new Set();
    for (const g of ctx.girls) if (g.seat) set.add(g.seat);
    for (const q of this.queue) set.add(q.seat);
    return set;
  }

  /**
   * One step. `ctx`:
   *   active: you're driving it and its engine is running
   *   riding: you're in it (so a girl stays put while it's stopped to start)
   *   speed: its ground speed
   *   slide: the bed is tipped high enough that a girl on the tailgate goes
   *   girls: [{ id, free, seat, dist }]  free: stood about with nothing to do; seat: 'mid' | 'left' | 'bed' if she's in or climbing in
   * Returns events: { type: 'board', girl, seat, squabble }, { type: 'bedTell', girl, target }, { type: 'bedShout', girl },
   * { type: 'slide', girl }, { type: 'leave', girl, bored }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    const aboard = ctx.girls.filter((g) => g.seat);

    this.bore(dt, ctx, events);
    for (const g of ctx.girls) {
      const s = this.girl(g.id);
      if (!g.seat) {
        s.aboardFor = 0;
        s.stayFor = null;
        s.shoutIn = null;
        s.tellIn = null;
        s.told = false;
      }
    }

    // Tipped up with someone on the tailgate.
    if (ctx.slide) {
      for (const g of aboard) if (g.seat === 'bed') events.push({ type: 'slide', girl: g.id });
    }

    // You've got off (or never got on): whoever's up there climbs out, unless you asked her to stay.
    if (!ctx.riding) {
      this.rolled = false;
      this.queue = [];
      for (const g of ctx.girls) {
        const s = this.girl(g.id);
        if (!g.seat || this.asked.has(g.id)) {
          s.leaveIn = null;
          continue;
        }
        s.leaveIn ??= this.between(0, p.leaveDelayMax);
        s.leaveIn -= dt;
        if (s.leaveIn <= 0) {
          s.leaveIn = null;
          events.push({ type: 'leave', girl: g.id });
        }
      }
      return events;
    }
    for (const g of ctx.girls) this.girl(g.id).leaveIn = null;

    // Getting in, once you've stopped with it running. A stop is rolled once, then it's one or two girls' decision.
    const stopped = ctx.speed < p.stopSpeed;
    if (!stopped || !ctx.active) {
      if (!stopped) this.rolled = false;
      this.queue = [];
    } else {
      const near = ctx.girls.filter((g) => g.free && !g.seat && g.dist <= p.boardRange);
      if (!this.rolled && near.length && this.queue.length === 0) {
        this.rolled = true;
        if (this.random() < p.boardChance) this.plan(near, ctx);
      }
      for (const q of this.queue) q.in -= dt;
      const ready = this.queue.filter((q) => q.in <= 0);
      this.queue = this.queue.filter((q) => q.in > 0);
      for (const q of ready) {
        const g = ctx.girls.find((x) => x.id === q.id);
        if (!g || g.seat || !g.free || g.dist > p.boardRange) continue; // she's been called away
        events.push({ type: 'board', girl: q.id, seat: q.seat, squabble: q.squabble });
      }
    }

    // Somebody in the bed against the rules: the other one says so, once.
    for (const g of aboard) {
      const s = this.girl(g.id);
      if (g.seat !== 'bed') continue;
      if (!s.told) {
        s.tellIn ??= this.between(p.tellMin, p.tellMax);
        s.tellIn -= dt;
        if (s.tellIn <= 0) {
          s.told = true;
          const other = ctx.girls.find((o) => o.id !== g.id && (o.seat || o.dist <= p.tellRange));
          if (other) events.push({ type: 'bedTell', girl: other.id, target: g.id });
        }
      }
      // And she complains about the bouncing when it's going.
      if (ctx.speed < p.bedShoutSpeed) continue;
      s.shoutIn ??= this.between(p.bedShoutMin, p.bedShoutMax);
      s.shoutIn -= dt;
      if (s.shoutIn <= 0) {
        s.shoutIn = null;
        events.push({ type: 'bedShout', girl: g.id });
      }
    }
    return events;
  }

  /** Chooses who comes and where they sit, and queues them. */
  plan(near, ctx) {
    const p = this.p;
    let ids = near.map((g) => g.id);
    if (ids.length > 1) {
      if (this.random() >= p.bothChance) {
        const jess = near.find((g) => g.id === 'jess');
        ids = [jess && this.random() < p.jessChance ? 'jess' : ids.find((i) => i !== 'jess') ?? 'jess'];
      } else if (ids.includes('jess') && this.random() < 0.5) ids.reverse();
    }
    const { seats, squabble } = planSeats(ids, this.taken(ctx), this.random, p);
    let delay = this.between(p.boardDelayMin, p.boardDelayMax);
    seats.forEach((s, i) => {
      if (i > 0) delay += this.between(p.followDelayMin, p.followDelayMax);
      this.queue.push({ id: s.id, seat: s.seat, in: delay, squabble: i === 0 ? squabble : null });
    });
  }

  /** Sat in there too long: she gets bored and climbs out, whether or not you asked her in. */
  bore(dt, ctx, events) {
    for (const g of ctx.girls) {
      const s = this.girl(g.id);
      if (!g.seat) continue;
      s.stayFor ??= this.between(this.p.stayMin, this.p.stayMax);
      s.aboardFor += dt;
      if (s.aboardFor >= s.stayFor) events.push({ type: 'leave', girl: g.id, bored: true });
    }
  }

  /** You asked her in from the wheel (she goes at once and stays until you ask her out). */
  ask(id) {
    this.asked.add(id);
  }

  /** You asked her out, or she's off some other way: back to the usual rules. */
  dismiss(id) {
    this.asked.delete(id);
  }

  /** She's off, however that happened. */
  clear(id) {
    this.asked.delete(id);
    Object.assign(this.girl(id), { aboardFor: 0, stayFor: null, shoutIn: null, leaveIn: null, tellIn: null, told: false });
  }
}
