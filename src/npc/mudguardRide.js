// A girl riding on the tractor's rear wheel arch while you drive. Pure logic (the game says what the tractor and the girls are doing,
// and gets events back), so it's tested without the game (tests/mudguardRide.test.js).
//
//   board   you've stopped with the engine running and no trailer on: one girl who's stood about may walk over and climb up
//   shout   she's up there with the diesel going: now and then she yells something across at you
//   join    she's driving the tractor herself and her friend may hop up on the arch as she gets it going
//   idle    nobody's on or driving it and a girl who's stood about climbs up to sit, as she does on the back of a quad
//   leave   you got off, the engine's off, or a trailer went on: she climbs down

export const DEFAULT_MUDGUARD_PARAMS = {
  boardRange: 30, // metres a girl who's stood about will walk over from
  stopSpeed: 0.6, // m/s: the tractor has to be slower than this for her to climb up
  boardDelayMin: 1.5, // seconds after you've stopped (or she's free) before she sets off
  boardDelayMax: 5,
  boardChance: 0.55, // chance a given stop gets a girl climbing up at all
  jessChance: 0.6, // chance it's Jess, when both would
  joinChance: 0.5, // chance a girl's go at driving the tractor gets her friend climbing up beside her
  joinDelayMin: 0.5, // seconds before the friend sets off: short, so she's walking over before the driver is ready to go
  joinDelayMax: 2,
  idleBoardRate: 0.004, // per second, per girl stood about nearby, that she climbs up on a parked tractor by herself (about once in four minutes)
  maxAboard: 1, // girls on the mudguards at once (one each side at most)
  shoutMin: 18, // seconds between her shouts while it's moving
  shoutMax: 40,
  shoutSpeed: 1, // m/s: she only shouts over it when it's going
  leaveDelayMax: 0.9, // seconds she takes to start climbing down once you've got off
  stayMin: 90, // seconds up there before she gets bored and climbs down by herself (asked up or not)...
  stayMax: 240, // ...somewhere between these
};

export const MUDGUARD_PARAM_RANGES = {
  boardRange: [5, 100, 1],
  stopSpeed: [0.1, 3, 0.1],
  boardDelayMin: [0, 10, 0.5],
  boardDelayMax: [0, 20, 0.5],
  boardChance: [0, 1, 0.05],
  jessChance: [0, 1, 0.05],
  joinChance: [0, 1, 0.05],
  joinDelayMin: [0, 5, 0.1],
  joinDelayMax: [0, 8, 0.1],
  idleBoardRate: [0, 0.05, 0.001],
  maxAboard: [1, 2, 1],
  shoutMin: [3, 120, 1],
  shoutMax: [3, 240, 1],
  shoutSpeed: [0.2, 6, 0.1],
  leaveDelayMax: [0, 5, 0.1],
  stayMin: [10, 600, 5],
  stayMax: [10, 900, 5],
};

export class MudguardRide {
  constructor(params = { ...DEFAULT_MUDGUARD_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.stopped = false; // were we stopped last step (so a stop is rolled for once)
    this.rolled = false; // this stop has had its chance already
    this.pick = null; // the girl chosen for this stop, or null
    this.boardIn = null;
    this.joinRolled = false; // this go at driving has had its chance of a friend joining already
    this.joinPick = null; // { id, in }
    this.girls = {}; // id -> { shoutIn, leaveIn }
    this.asked = new Set(); // girls you asked up there from the wheel: they stay until you ask them down, even with you off the tractor
  }

  girl(id) {
    return (this.girls[id] ??= { shoutIn: null, leaveIn: null, aboardFor: 0, stayFor: null });
  }

  between(a, b) {
    return a + this.random() * Math.max(0, b - a);
  }

  /**
   * One step. `ctx`:
   *   active: you're on the tractor, its engine is running and no trailer is hitched
   *   parked: nobody is on or driving it, so a girl may climb up by herself
   *   drivenBy: id of the girl driving it, or null
   *   settingOff: she's getting on, starting it or letting it tick over, about to go (the moment her friend may hop up)
   *   riding: you're on the tractor (so a girl stays up there while it's stopped to start it)
   *   speed: the tractor's ground speed
   *   running: its engine is running
   *   girls: [{ id, free, aboard, dist, wants }]  free: stood about with nothing to do; aboard: on or climbing onto a mudguard; wants: she asked to sit up there
   * Returns events: { type: 'board' | 'shout' | 'leave', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    const aboard = ctx.girls.filter((g) => g.aboard);

    this.bore(dt, ctx, events); // an asked girl with you off the tractor gets bored too
    if (ctx.trailer) this.asked.clear(); // the bales are the ride now
    // Climbing down: you got off, or something changed.
    if (!ctx.drivenBy) {
      this.joinRolled = false;
      this.joinPick = null;
    }
    if (ctx.drivenBy && !ctx.riding && !ctx.trailer) return this.girlDriving(dt, ctx, aboard, events);
    if (ctx.parked && !ctx.trailer && ctx.speed < p.stopSpeed && !aboard.length) {
      // One who asked to sit up there while it idles goes at once, once it is running (the favour in requests.js).
      const g = ctx.girls.find((x) => x.free && x.dist <= p.boardRange && (x.wants ? ctx.running : this.random() < p.idleBoardRate * dt));
      if (g) {
        this.ask(g.id); // she stays put until she's bored of it, even with you not on it
        events.push({ type: 'board', girl: g.id, idle: true });
      }
    }
    if (!ctx.riding || ctx.trailer) {
      this.stopped = false;
      this.rolled = false;
      this.pick = null;
      this.boardIn = null;
      for (const g of ctx.girls) {
        const s = this.girl(g.id);
        s.shoutIn = null;
        if (!g.aboard || this.asked.has(g.id)) {
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

    // Getting up, once you've stopped with it running: a stop is rolled once, and then it's one girl's decision.
    const stopped = ctx.speed < p.stopSpeed;
    if (!stopped || !ctx.active) {
      if (!stopped) this.rolled = false;
      this.boardIn = null;
      this.pick = null;
    }
    this.stopped = stopped;
    if (stopped && ctx.active && aboard.length < p.maxAboard) {
      const near = ctx.girls.filter((g) => g.free && !g.aboard && g.dist <= p.boardRange);
      if (!this.rolled && near.length) {
        this.rolled = true;
        if (this.random() < p.boardChance) {
          const jess = near.find((g) => g.id === 'jess');
          this.pick = (jess && (near.length === 1 || this.random() < p.jessChance) ? jess : near.find((g) => g.id !== 'jess') ?? jess).id;
          this.boardIn = this.between(p.boardDelayMin, p.boardDelayMax);
        }
      }
      if (this.pick && this.boardIn !== null) {
        const g = near.find((n) => n.id === this.pick);
        if (!g) this.boardIn = this.pick = null; // she's been called away
        else if ((this.boardIn -= dt) <= 0) {
          this.boardIn = this.pick = null;
          events.push({ type: 'board', girl: g.id });
        }
      }
    }

    // Shouting across at you.
    for (const g of ctx.girls) {
      const s = this.girl(g.id);
      if (!g.aboard || !ctx.active || ctx.speed < p.shoutSpeed) {
        if (!g.aboard) s.shoutIn = null;
        continue;
      }
      s.shoutIn ??= this.between(p.shoutMin, p.shoutMax);
      s.shoutIn -= dt;
      if (s.shoutIn <= 0) {
        s.shoutIn = null;
        events.push({ type: 'shout', girl: g.id });
      }
    }
    return events;
  }

  /**
   * A girl is driving the tractor and you aren't on it. Her friend who's stood about may hop up on the arch as she gets going (one
   * roll per go), and stays up there until the go is over (the usual rules take her down then, or boredom does).
   */
  girlDriving(dt, ctx, aboard, events) {
    const p = this.p;
    for (const g of ctx.girls) this.girl(g.id).leaveIn = null;
    if (ctx.settingOff && ctx.speed < p.stopSpeed && !this.joinRolled && aboard.length < p.maxAboard) {
      const friend = ctx.girls.find((g) => g.id !== ctx.drivenBy && g.free && !g.aboard && g.dist <= p.boardRange);
      if (friend) {
        this.joinRolled = true;
        if (this.random() < p.joinChance) this.joinPick = { id: friend.id, in: this.between(p.joinDelayMin, p.joinDelayMax) };
      }
    }
    if (this.joinPick) {
      const g = ctx.girls.find((x) => x.id === this.joinPick.id);
      if (!g || !g.free || g.aboard) this.joinPick = null; // she's been called away
      else if ((this.joinPick.in -= dt) <= 0) {
        this.joinPick = null;
        events.push({ type: 'board', girl: g.id, join: true });
      }
    }
    return events;
  }

  /** Sat up there too long: she gets bored and climbs down, whether or not you asked her up. */
  bore(dt, ctx, events) {
    for (const g of ctx.girls) {
      const s = this.girl(g.id);
      if (!g.aboard) {
        s.aboardFor = 0;
        s.stayFor = null;
        continue;
      }
      s.stayFor ??= this.between(this.p.stayMin, this.p.stayMax);
      s.aboardFor += dt;
      if (s.aboardFor >= s.stayFor) events.push({ type: 'leave', girl: g.id, bored: true });
    }
  }

  /** You asked her up there from the wheel. */
  ask(id) {
    this.asked.add(id);
  }

  /** You asked her down (or she's off some other way): she goes back to the usual rules. */
  dismiss(id) {
    this.asked.delete(id);
  }

  /** She's off, however that happened. */
  clear(id) {
    this.asked.delete(id);
    Object.assign(this.girl(id), { shoutIn: null, leaveIn: null });
  }
}
