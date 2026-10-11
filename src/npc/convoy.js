// Follow the leader. Both girls go off on a quad each, one leading and one following (the same following that works for
// you), and after a while they swap round: the follower overtakes (herDriving.js passTarget) and the one she passed
// follows her. They bicker about the pace. Pure logic: the game starts the drives and does the swapping, this runs the
// convoy: who starts it, who leads, when to swap and when it ends.

import { pickQuads } from './race.js';

export const DEFAULT_CONVOY_PARAMS = {
  startAfter: 150, // seconds into the game before they might
  freeFor: 20, // seconds both have been stood about
  weight: 1, // how keen she is on a ride together after that (chooser.js weighs it; either girl can suggest it)
  cooldown: 420, // seconds between convoys
  jessLeads: 0.6, // chance Jess is the one at the front to begin with
  formTimeout: 120, // seconds to get both going before it's called off
  swapMin: 60, // seconds in front before the other overtakes
  swapMax: 120,
  swaps: 2, // how many times they swap before it's over
  lastLeg: 60, // seconds after the last swap before they stop
  passTimeout: 45, // seconds a pass can take before it's given up
};

export const CONVOY_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  freeFor: [0, 120, 1],
  weight: [0, 5, 0.05],
  cooldown: [0, 1800, 10],
  jessLeads: [0, 1, 0.05],
  formTimeout: [20, 400, 5],
  swapMin: [10, 600, 5],
  swapMax: [10, 900, 5],
  swaps: [0, 10, 1],
  lastLeg: [10, 600, 5],
  passTimeout: [10, 120, 5],
};

export class Convoy {
  constructor(params = { ...DEFAULT_CONVOY_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.freeTime = 0;
    this.lastEnd = -Infinity;
    this.forced = false; // start one at the first chance (the debug panel)
    this.reset();
  }

  reset() {
    this.phase = 'idle'; // 'idle', 'forming', 'running'
    this.leader = null;
    this.follower = null;
    this.picks = null;
    this.readySet = new Set();
    this.phaseClock = 0;
    this.runClock = 0;
    this.swapAt = 0;
    this.swapsDone = 0;
    this.passing = false;
    this.passClock = 0;
  }

  get active() {
    return this.phase !== 'idle';
  }

  /** A girl's drive is going (the leader out on her loops, the follower waiting to follow or following). */
  ready(girl) {
    if (this.phase === 'forming') this.readySet.add(girl);
  }

  /** The follower has got in front: the order swaps. Returns the new { leader, follower }. */
  passed() {
    if (!this.passing) return null;
    [this.leader, this.follower] = [this.follower, this.leader];
    this.passing = false;
    this.swapsDone++;
    this.swapAt = this.p.swaps > this.swapsDone ? this.runClock + this.nextLeg() : this.runClock + this.p.lastLeg;
    return { leader: this.leader, follower: this.follower };
  }

  /** The pass came to nothing: carry on in the same order. */
  passFailed() {
    this.passing = false;
    this.swapAt = this.runClock + this.nextLeg();
  }

  nextLeg() {
    return this.p.swapMin + this.random() * Math.max(0, this.p.swapMax - this.p.swapMin);
  }

  /** Over now, whatever's happening (called away, a drive ended). */
  stand() {
    if (this.active) this.finish();
    this.forced = false;
  }

  /**
   * A ride together, offered to each girl (the same `ctx` as update, after update): [{ key: 'convoy', girl, girls, picks, weight }] once
   * both have been free a while, nothing else is on and the cooldown is up. Whichever takes it, who leads is decided as ever.
   */
  offers(ctx) {
    const p = this.p;
    if (this.phase !== 'idle' || ctx.busy || ctx.girls.length < 2 || !ctx.girls.every((g) => g.free)) return [];
    if (this.clock < p.startAfter || this.clock - this.lastEnd < p.cooldown || this.freeTime < p.freeFor) return [];
    const picks = pickQuads(ctx.options, ctx.claims, this.random);
    if (!picks) return [];
    const girls = ctx.girls.map((g) => g.id);
    return girls.map((id) => ({ key: 'convoy', girl: id, girls, picks, weight: p.weight }));
  }

  /** One of them suggested it: who leads (Jess, usually), and the invite the game acts on. */
  take(o) {
    const ids = o.girls;
    this.leader = ids.includes('jess') && this.random() < this.p.jessLeads ? 'jess' : ids.find((id) => id !== 'jess') ?? ids[0];
    this.follower = ids.find((id) => id !== this.leader);
    this.picks = o.picks;
    this.phase = 'forming';
    this.phaseClock = 0;
    return { type: 'invite', leader: this.leader, follower: this.follower, picks: o.picks };
  }

  finish() {
    this.lastEnd = this.clock;
    this.reset();
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, free }]                free: stood about, nothing on
   *   busy: something else (a race) is on
   *   options: { girlId: [spec ids she could drive] }, claims: { girlId: spec id }
   * Returns events: { type: 'invite', leader, follower, picks }, { type: 'running' }, { type: 'swap', leader, follower }
   *   (the follower is to overtake), { type: 'end' } and { type: 'cancel' }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    if (this.phase === 'idle') {
      const bothFree = ctx.girls.length >= 2 && ctx.girls.every((g) => g.free) && !ctx.busy;
      this.freeTime = bothFree ? this.freeTime + dt : 0;
      // Starting one is an offer (offers, take); only the debug panel's forced one starts here.
      if (!bothFree || !this.forced) return events;
      const picks = pickQuads(ctx.options, ctx.claims, this.random);
      if (!picks) return events;
      this.forced = false;
      events.push(this.take({ girls: ctx.girls.map((g) => g.id), picks }));
      return events;
    }
    this.phaseClock += dt;
    if (this.phase === 'forming') {
      if (this.readySet.size >= 2) {
        this.phase = 'running';
        this.runClock = 0;
        this.swapAt = this.nextLeg();
        events.push({ type: 'running' });
      } else if (this.phaseClock > p.formTimeout) {
        this.finish();
        events.push({ type: 'cancel' });
      }
      return events;
    }
    this.runClock += dt;
    if (this.passing) {
      this.passClock += dt;
      if (this.passClock > p.passTimeout) this.passFailed();
    } else if (this.runClock >= this.swapAt) {
      if (this.swapsDone >= p.swaps) {
        this.finish();
        events.push({ type: 'end' });
      } else {
        this.passing = true;
        this.passClock = 0;
        events.push({ type: 'swap', leader: this.leader, follower: this.follower });
      }
    }
    return events;
  }
}
