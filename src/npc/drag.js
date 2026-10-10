// The drag race: you against one girl, side by side, down the straight (layout.dragStrip). Two ways in: you ask for it with Enter at the
// strip's start line, or you sit still on a quad for a while and Jess pulls up beside you and blips her throttle; blip back and it's on, ignore
// her and she calls you chicken. Pure logic: the game plans her route and drives the quads (HerDrive's race mode) and tells this where you
// both are along the strip; this runs the challenge, the grid, the count-down, false starts, the finish and who won.

import { pickQuads } from './race.js';

export const DEFAULT_DRAG_PARAMS = {
  startAfter: 90, // seconds into the game before Jess might challenge you
  cooldown: 240, // seconds between races
  blipStill: 10, // seconds you have sat still on a quad, engine running, before Jess may pull up beside you
  blipChance: 0.03, // per second after that, when both girls are free
  approachTimeout: 40, // seconds she has to reach you before she gives up
  blipCount: 2, // blips of the throttle
  blipLength: 0.4, // seconds each one is held
  blipGap: 0.45, // seconds between them
  blipPause: 1.2, // seconds she waits before the first, so you have noticed her
  blipWait: 8, // seconds after the last blip you have to blip back
  blipFrom: 0.15, // your throttle has to be below this and then go above `blipSnap` within `blipRise` seconds to count as a blip
  blipSnap: 0.3, // (the throttle key opens gradually, vehicle/pedalKeys.js, so a blip is a rise, not a jump in one frame)
  blipRise: 0.6,
  jessChooses: 0.6, // chance it's Jess, not Amy, when you ask from the line
  nearStrip: 15, // metres from the start line you count as there to ask
  laneOffset: 2, // metres either side of the middle each lane is
  gridBack: 1, // metres behind the line the grid point is (the quad's middle: its front wheels are at the line)
  gridRadius: 2.5, // metres from your grid point you count as lined up
  gridYaw: 0.5, // radians off the strip's direction you may point and still count as lined up
  youWait: 45, // seconds you get to line up once she has accepted, before it's called off
  gatherTimeout: 100, // seconds to get both of you on the line
  countdown: 3, // seconds of "three, two, one"
  falseStartAlong: 1, // metres past the line in the count-down that is a false start (the count-down starts again)
  falseStarts: 2, // false starts forgiven; the next one calls it off
  raceTimeout: 45, // seconds after the start before whoever is still going is out of it
  youOutAfter: 8, // seconds off the quad or stalled and you're out of it
};

export const DRAG_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  cooldown: [0, 1800, 10],
  blipStill: [1, 60, 1],
  blipChance: [0, 0.5, 0.01],
  approachTimeout: [10, 120, 5],
  blipCount: [1, 5, 1],
  blipLength: [0.1, 1.5, 0.05],
  blipGap: [0.1, 1.5, 0.05],
  blipPause: [0, 5, 0.1],
  blipWait: [2, 30, 1],
  blipFrom: [0, 0.5, 0.05],
  blipSnap: [0.2, 1, 0.05],
  blipRise: [0.05, 2, 0.05],
  jessChooses: [0, 1, 0.05],
  nearStrip: [5, 80, 1],
  laneOffset: [1, 4, 0.25],
  gridBack: [0, 4, 0.25],
  gridRadius: [1, 6, 0.25],
  gridYaw: [0.1, 1.5, 0.05],
  youWait: [10, 120, 5],
  gatherTimeout: [20, 300, 5],
  countdown: [1, 10, 0.5],
  falseStartAlong: [0.2, 4, 0.1],
  falseStarts: [0, 5, 1],
  raceTimeout: [10, 300, 5],
  youOutAfter: [2, 60, 1],
};

export class Drag {
  constructor(params = { ...DEFAULT_DRAG_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.lastRace = -Infinity;
    this.tally = {}; // 'you' and the girls' ids -> { wins, losses }
    this.forced = false; // you asked from the line (Enter): start at the first chance
    this.stillTime = 0; // seconds you have sat still on a quad
    this.reset();
  }

  reset() {
    this.phase = 'idle'; // 'idle', 'approach', 'blip', 'gather', 'countdown', 'race' or 'over'
    this.girl = null; // the girl racing you
    this.picks = null; // { you: spec id, [girl]: spec id }
    this.lane = 1; // which side of the middle the girl's lane is (+1 or -1); yours is the other
    this.ready = new Set();
    this.finished = []; // { id, time } in order
    this.out = new Set();
    this.phaseClock = 0;
    this.raceClock = 0;
    this.blipClock = 0;
    this.sinceClosed = 0; // seconds since your throttle was last below blipFrom
    this.notStill = 0;
    this.falseStartCount = 0;
    this.youIdle = 0; // seconds you've been off the quad or stalled in the race
    this.reported = null;
  }

  get active() {
    return this.phase !== 'idle';
  }

  /** The start has gone: the girl may open it up. */
  go() {
    return this.phase === 'race' || this.phase === 'over';
  }

  /** True while she should have the throttle open on the spot: the blips of the challenge. */
  blipping() {
    if (this.phase !== 'blip') return false;
    const p = this.p;
    const t = this.blipClock - p.blipPause;
    if (t < 0) return false;
    const k = Math.floor(t / (p.blipLength + p.blipGap));
    return k < p.blipCount && t - k * (p.blipLength + p.blipGap) < p.blipLength;
  }

  record(id) {
    return (this.tally[id] ??= { wins: 0, losses: 0 });
  }

  /** Where each is on the grid: the girl's quad has reached its place, or you've lined up. */
  grid(id) {
    if (this.phase === 'approach' && id === this.girl) {
      this.phase = 'blip';
      this.blipClock = 0;
      this.phaseClock = 0;
      this.sinceClosed = Infinity; // so a throttle already open when she arrives doesn't count as an answer
    } else if (this.phase === 'gather') this.ready.add(id);
  }

  ungrid(id) {
    this.ready.delete(id);
  }

  /** The girl crossed the finish line, or you did. */
  finish(id) {
    if (this.phase !== 'race' || this.out.has(id) || this.finished.some((f) => f.id === id)) return;
    this.finished.push({ id, time: this.raceClock });
  }

  /** A drive ended some other way (stalled out, gave up, you got off): out of it. */
  abort(id) {
    if (!this.active || this.phase === 'over' || this.finished.some((f) => f.id === id)) return;
    this.out.add(id);
  }

  /** Called off from outside (they've been called away): no event, and not straight away again. */
  stand() {
    if (this.active) this.cancel([]);
    this.forced = false;
  }

  cancel(events, quiet = false) {
    this.lastRace = this.clock - this.p.cooldown / 2; // not straight away again
    this.reset();
    if (!quiet) events.push({ type: 'cancel' });
    return events;
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, free }]                 free: stood about, nothing on
   *   options: { girlId: [spec ids she could race now] }   (never the one you're on)
   *   claims: { girlId: spec id }
   *   busy: another race or a recall is on
   *   you: { riding (spec id or null), still (stopped, engine running), stalled, throttle, near (at the start line), across (metres from the strip's middle) }
   *   along: { you, [girlId] }               metres along the strip from the start line (in the race)
   *   length: metres from the start line to the finish line
   * Returns events: { type: 'approach', girl, pick }, { type: 'answered' }, { type: 'chicken', girl },
   *   { type: 'invite', girl, picks, lane, blipped, asked }, { type: 'countdown' }, { type: 'falseStart', girl },
   *   { type: 'go' }, { type: 'finish', id, place, time, ahead }, { type: 'out', id },
   *   { type: 'result', winner, loser, margin }, { type: 'cancel' }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const you = ctx.you ?? {};
    const along = ctx.along ?? {};
    this.stillTime = you.riding && you.still ? this.stillTime + dt : 0;

    if (this.phase === 'idle') {
      if (ctx.busy) return events;
      const bothFree = ctx.girls.length >= 2 && ctx.girls.every((g) => g.free);
      if (this.forced && !you.riding) this.forced = false;
      if (!bothFree || !you.riding) return events;
      const ids = ctx.girls.map((g) => g.id);
      if (this.forced) {
        // Asked from the line: Jess or Amy, whichever fancies it.
        const first = ids.includes('jess') && this.random() < p.jessChooses ? 'jess' : ids.find((id) => id !== 'jess') ?? ids[0];
        const order = [first, ...ids.filter((id) => id !== first)];
        for (const girl of order) {
          const pick = pickQuads({ [girl]: ctx.options[girl] ?? [] }, ctx.claims, this.random);
          if (!pick) continue;
          this.forced = false;
          return this.invite(events, girl, pick[girl], you, { asked: true });
        }
        return events;
      }
      const gated = this.clock < p.startAfter || this.clock - this.lastRace < p.cooldown;
      if (gated || this.stillTime < p.blipStill || !ids.includes('jess') || this.random() >= p.blipChance * dt) return events;
      const pick = pickQuads({ jess: ctx.options.jess ?? [] }, ctx.claims, this.random);
      if (!pick) return events;
      this.girl = 'jess';
      this.picks = { jess: pick.jess };
      this.phase = 'approach';
      this.phaseClock = 0;
      events.push({ type: 'approach', girl: 'jess', pick: pick.jess });
      return events;
    }

    this.phaseClock += dt;
    if (this.phase === 'approach' || this.phase === 'blip') {
      // You've gone, or have been riding off, while she comes over: forget it.
      this.notStill = you.still ? 0 : this.notStill + dt;
      if (!you.riding || (this.phase === 'approach' && this.notStill > 8) || this.out.size) return this.cancel(events, true);
      if (this.phase === 'approach') {
        if (this.phaseClock > p.approachTimeout) return this.cancel(events, true);
        return events;
      }
      this.blipClock += dt;
      const t = this.blipClock - p.blipPause;
      const throttle = you.throttle ?? 0;
      this.sinceClosed = throttle < p.blipFrom ? 0 : this.sinceClosed + dt;
      const snapped = throttle >= p.blipSnap && this.sinceClosed <= p.blipRise;
      if (snapped) this.sinceClosed = Infinity;
      if (t > 0 && snapped && you.still) {
        events.push({ type: 'answered' });
        const girl = this.girl;
        const pick = this.picks[girl];
        return this.invite(events, girl, pick, you, { blipped: true });
      }
      if (t > p.blipCount * (p.blipLength + p.blipGap) + p.blipWait) {
        events.push({ type: 'chicken', girl: this.girl });
        return this.cancel(events, true);
      }
      return events;
    }

    const racers = Object.keys(this.picks);
    if (this.phase === 'gather') {
      if (this.out.size || this.phaseClock > p.gatherTimeout) return this.cancel(events);
      // You didn't line up in time, or got off: no race without you.
      if (this.phaseClock > p.youWait && !this.ready.has('you')) return this.cancel(events);
      if (you.riding !== this.picks.you && !this.ready.has('you') && this.phaseClock > 3) return this.cancel(events);
      if (racers.every((id) => this.ready.has(id))) {
        this.phase = 'countdown';
        this.phaseClock = 0;
        events.push({ type: 'countdown' });
      }
    } else if (this.phase === 'countdown') {
      if (this.out.size) return this.cancel(events);
      if (!this.ready.has('you')) {
        // Rolled forward over the line: a false start, and you line up again. Pulled off the grid some other way: forget it.
        if ((along.you ?? -Infinity) > p.falseStartAlong) {
          if (++this.falseStartCount > p.falseStarts) return this.cancel(events);
          this.phase = 'gather';
          this.phaseClock = 0;
          events.push({ type: 'falseStart', girl: this.girl });
          return events;
        }
        return this.cancel(events);
      }
      if (this.phaseClock >= p.countdown) {
        this.phase = 'race';
        this.raceClock = 0;
        events.push({ type: 'go' });
      }
    } else if (this.phase === 'race') {
      this.raceClock += dt;
      // Off the quad or stalled too long: out.
      this.youIdle = you.riding === this.picks.you && !you.stalled ? 0 : this.youIdle + dt;
      if (this.youIdle > p.youOutAfter) this.out.add('you');
      for (const id of racers) if ((along[id] ?? -Infinity) >= (ctx.length ?? Infinity)) this.finish(id);
      const seen = new Set(this.reported ?? []);
      this.reported = seen;
      this.finished.forEach((f, i) => {
        if (seen.has(`f${f.id}`)) return;
        seen.add(`f${f.id}`);
        events.push({ type: 'finish', id: f.id, place: i + 1, time: f.time, ahead: this.finished.slice(0, i).map((x) => x.id) });
      });
      for (const id of this.out) if (!seen.has(`o${id}`)) { seen.add(`o${id}`); events.push({ type: 'out', id }); }
      if (this.raceClock > p.raceTimeout) for (const id of racers) if (!this.finished.some((f) => f.id === id)) this.out.add(id);
      if (racers.every((id) => this.out.has(id) || this.finished.some((f) => f.id === id))) this.conclude(events);
    } else if (this.phase === 'over') {
      this.reset();
    }
    return events;
  }

  /** The challenge is on (or you asked): she and you now go to the grid. */
  invite(events, girl, pick, you, { asked = false, blipped = false } = {}) {
    this.girl = girl;
    this.picks = { [girl]: pick, you: you.riding };
    this.lane = (you.across ?? 0) >= 0 ? -1 : 1; // she takes the lane you're not nearer to
    this.ready = new Set();
    this.phase = 'gather';
    this.phaseClock = 0;
    events.push({ type: 'invite', girl, picks: this.picks, lane: this.lane, asked, blipped });
    return events;
  }

  conclude(events) {
    const first = this.finished[0]?.id ?? null;
    const racers = Object.keys(this.picks);
    let margin = 0;
    if (first && this.finished[1]) margin = this.finished[1].time - this.finished[0].time;
    if (first) {
      this.record(first).wins++;
      for (const id of racers) if (id !== first) this.record(id).losses++;
    }
    this.lastRace = this.clock;
    this.phase = 'over';
    this.reported = null;
    events.push({ type: 'result', winner: first, loser: first ? racers.find((id) => id !== first) : null, margin, girl: this.girl });
  }
}

/** Whether you're lined up on your grid point: close, stopped and pointing along the strip (`stripYaw`). `dist` is the distance to the point. */
export function onDragGrid({ dist, speed, yaw }, stripYaw, p) {
  const off = Math.atan2(Math.sin(yaw - stripYaw), Math.cos(yaw - stripYaw));
  return dist < p.gridRadius && Math.abs(speed) < 0.5 && Math.abs(off) < p.gridYaw;
}
