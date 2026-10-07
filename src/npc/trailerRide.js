// A girl riding in the little tipping trailer behind a quad, against the rules. Pure logic (the game says what the trailer and the girls
// are doing, and gets events back), so it's tested without the game (tests/trailerRide.test.js).
//
//   board   you've stopped with a trailer hitched: a girl who's stood about may hop in (Jess far more often than Amy)
//   tell    the other girl has seen her in there, and says so
//   bump    it went over something hard and she shrieks
//   shout   she's in there and it's going: she complains about the bouncing
//   slide   the tub has tipped up with her in it: she goes off the back
//   leave   you got off or unhitched, or she's been in long enough: she climbs out

export const DEFAULT_TRAILER_RIDE_PARAMS = {
  boardRange: 30, // metres a girl who's stood about will walk over from
  stopSpeed: 0.6, // m/s: it has to be slower than this for her to climb in
  boardDelayMin: 2, // seconds after you've stopped before she sets off
  boardDelayMax: 6,
  boardChance: 0.4, // chance a given stop gets a girl hopping in at all
  jessChance: 0.85, // chance it's Jess when both are near, and it happens
  amyChance: 0.08, // chance Amy would go in on her own
  tellMin: 1.5, // seconds after she is in before the other one says something
  tellMax: 3.5,
  tellRange: 25, // metres: the other girl has to be this close to notice
  bumpJolt: 0.45, // metres a second of bounce that makes her shriek
  bumpGap: 10, // seconds between shrieks
  shoutSpeed: 4, // m/s: she only complains about the bouncing when it's going
  shoutMin: 15, // seconds between her complaints
  shoutMax: 35,
  leaveDelayMax: 0.9, // seconds she takes to start climbing out once you've got off
  stayMin: 90, // seconds in there before she gets bored and climbs out (asked in or not)...
  stayMax: 240, // ...somewhere between these
};

export const TRAILER_RIDE_PARAM_RANGES = {
  boardRange: [5, 100, 1],
  stopSpeed: [0.1, 3, 0.1],
  boardDelayMin: [0, 10, 0.5],
  boardDelayMax: [0, 20, 0.5],
  boardChance: [0, 1, 0.05],
  jessChance: [0, 1, 0.05],
  amyChance: [0, 1, 0.01],
  tellMin: [0, 10, 0.5],
  tellMax: [0, 20, 0.5],
  tellRange: [5, 80, 1],
  bumpJolt: [0.1, 2, 0.05],
  bumpGap: [2, 60, 1],
  shoutSpeed: [1, 12, 0.5],
  shoutMin: [3, 120, 1],
  shoutMax: [3, 240, 1],
  leaveDelayMax: [0, 5, 0.1],
  stayMin: [10, 900, 5],
  stayMax: [10, 1200, 5],
};

export class TrailerRide {
  constructor(params = { ...DEFAULT_TRAILER_RIDE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.rolled = false; // this stop has had its chance already
    this.queue = null; // { id, in }: a girl on her way
    this.girl = { aboardFor: 0, stayFor: null, shoutIn: null, leaveIn: null, tellIn: null, told: false, bumpIn: 0, id: null };
    this.asked = new Set(); // girls you asked in from the wheel: they stay until you ask them out
  }

  between(a, b) {
    return a + this.random() * Math.max(0, b - a);
  }

  /**
   * One step. `ctx`:
   *   riding: you're on whatever is pulling it, with it hitched
   *   active: and its engine is running
   *   speed: the trailer's ground speed
   *   jolt: how hard its body is being thrown about
   *   slide: the tub is tipped high enough that whoever is in it goes
   *   girls: [{ id, free, aboard, dist }]  free: stood about with nothing to do; aboard: in it or climbing in
   * Returns events: { type: 'board', girl }, { type: 'tell', girl, target }, { type: 'bump', girl }, { type: 'shout', girl },
   * { type: 'slide', girl }, { type: 'leave', girl, bored }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    const inside = ctx.girls.find((g) => g.aboard);
    const s = this.girl;
    if (!inside || s.id !== inside.id) {
      Object.assign(s, { id: inside?.id ?? null, aboardFor: 0, stayFor: null, shoutIn: null, tellIn: null, told: false, bumpIn: 0 });
    }

    if (inside) {
      s.stayFor ??= this.between(p.stayMin, p.stayMax);
      s.aboardFor += dt;
      if (s.aboardFor >= s.stayFor) events.push({ type: 'leave', girl: inside.id, bored: true });
      if (ctx.slide) events.push({ type: 'slide', girl: inside.id });
    }

    // You've got off or unhitched: whoever's in there climbs out, unless you asked her to stay.
    if (!ctx.riding) {
      this.rolled = false;
      this.queue = null;
      if (inside && !this.asked.has(inside.id)) {
        s.leaveIn ??= this.between(0, p.leaveDelayMax);
        s.leaveIn -= dt;
        if (s.leaveIn <= 0) {
          s.leaveIn = null;
          events.push({ type: 'leave', girl: inside.id });
        }
      } else s.leaveIn = null;
      return events;
    }
    s.leaveIn = null;

    // Getting in, once you've stopped with it running. A stop is rolled once.
    const stopped = ctx.speed < p.stopSpeed;
    if (!stopped || !ctx.active || inside) {
      if (!stopped) this.rolled = false;
      this.queue = null;
    } else {
      const near = ctx.girls.filter((g) => g.free && g.dist <= p.boardRange);
      if (!this.rolled && near.length && !this.queue) {
        this.rolled = true;
        const jess = near.find((g) => g.id === 'jess');
        const pick = jess && (near.length === 1 || this.random() < p.jessChance) ? jess : near.find((g) => g.id !== 'jess');
        const chance = pick?.id === 'jess' ? p.boardChance : p.amyChance;
        if (pick && this.random() < chance) this.queue = { id: pick.id, in: this.between(p.boardDelayMin, p.boardDelayMax) };
      }
      if (this.queue) {
        this.queue.in -= dt;
        if (this.queue.in <= 0) {
          const q = this.queue;
          this.queue = null;
          const g = ctx.girls.find((x) => x.id === q.id);
          if (g && g.free && g.dist <= p.boardRange) events.push({ type: 'board', girl: q.id });
        }
      }
    }

    if (!inside) return events;
    // In there against the rules: the other one says so, once.
    if (!s.told) {
      s.tellIn ??= this.between(p.tellMin, p.tellMax);
      s.tellIn -= dt;
      if (s.tellIn <= 0) {
        s.told = true;
        const other = ctx.girls.find((o) => o.id !== inside.id && o.dist <= p.tellRange);
        if (other) events.push({ type: 'tell', girl: other.id, target: inside.id });
      }
    }
    // A hard bump gets a shriek, not too often; and she complains about the bouncing when it's going.
    s.bumpIn = Math.max(0, s.bumpIn - dt);
    if (ctx.jolt > p.bumpJolt && s.bumpIn <= 0) {
      s.bumpIn = p.bumpGap;
      events.push({ type: 'bump', girl: inside.id });
    }
    if (ctx.speed >= p.shoutSpeed) {
      s.shoutIn ??= this.between(p.shoutMin, p.shoutMax);
      s.shoutIn -= dt;
      if (s.shoutIn <= 0) {
        s.shoutIn = null;
        events.push({ type: 'shout', girl: inside.id });
      }
    }
    return events;
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
    Object.assign(this.girl, { id: null, aboardFor: 0, stayFor: null, shoutIn: null, leaveIn: null, tellIn: null, told: false, bumpIn: 0 });
  }
}
