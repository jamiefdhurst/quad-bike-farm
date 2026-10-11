// Racing. Bored and both free, the girls pick two quads and race one lap of the track without you. The loser has
// excuses, and the wins and losses are kept for the rest of the game, so the rivalry has a score. Pure logic: the game
// plans the route and drives the quads (HerDrive has a race mode), and this runs the race around them: who is
// challenged, the grid, the count-down, the finish, and who won.

export const DEFAULT_RACE_PARAMS = {
  startAfter: 120, // seconds into the game before they might
  freeFor: 20, // seconds both have been stood about
  weight: 1.1, // how keen she is on a race after that (chooser.js weighs it; either girl can suggest it)
  cooldown: 300, // seconds between races
  jessChallenges: 0.7, // chance it's Jess who dares Amy to it
  gatherTimeout: 100, // seconds to get both quads started and to the start line before it's called off
  countdown: 3, // seconds of "three, two, one"
  raceTimeout: 150, // seconds after the start before whoever is still going is out of it
  rivalLead: 2, // wins ahead before they start going on about the score
  routeSpacing: 6, // metres between the route's waypoints
  hazardMargin: 1.4, // metres a waypoint is kept clear of a bog's or puddle's edge
  cruiseBase: 9, // m/s she aims for flat out: the quad's power decides what she gets
  cruiseConfidence: 4, // more for each 1 of confidence
  cruiseSpread: 1.5, // +/- random per race
  throttle: 1, // most throttle she'll use
  keepRidingChance: 0.5, // chance a girl carries on driving after the finish instead of pulling up and getting off (the drag race uses it too)
  youWait: 30, // seconds you get to line up on the grid once asked, before they race without you (not counted once you are lined up: the girls may be slow to arrive)
  dareStill: 4, // seconds you've sat still on a quad near the line before Jess may dare you
  dareWeight: 1.5, // how keen Jess is to dare you after that, when the girls are free and it's been long enough
  nearLine: 12, // metres from the start line you count as there (to be asked, or dared): on the line, not just near it
  gridSpacing: 3, // metres between lanes on the grid when you are racing (1.5 either side of the middle when you're not)
  youGridRadius: 5, // metres from your grid point you count as on the grid
  youGridYaw: 0.7, // radians off the track's direction you may be pointing and still count as lined up
  youCheckpoints: 4, // quarters of the lap you must pass through, in order, before the line counts
  youFinishRadius: 8, // metres from the line at which you've finished, once the lap is done
  youOutAfter: 15, // seconds off the quad or with it stalled and you're out of it
};

export const RACE_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  freeFor: [0, 120, 1],
  weight: [0, 5, 0.05],
  cooldown: [0, 1800, 10],
  jessChallenges: [0, 1, 0.05],
  gatherTimeout: [10, 300, 5],
  countdown: [1, 10, 0.5],
  raceTimeout: [30, 600, 10],
  rivalLead: [1, 10, 1],
  routeSpacing: [3, 30, 1],
  hazardMargin: [0, 5, 0.1],
  cruiseBase: [4, 25, 0.5],
  cruiseConfidence: [0, 10, 0.5],
  cruiseSpread: [0, 5, 0.1],
  throttle: [0.3, 1, 0.05],
  keepRidingChance: [0, 1, 0.05],
  youWait: [5, 120, 5],
  dareStill: [0, 30, 1],
  dareWeight: [0, 5, 0.05],
  nearLine: [10, 150, 5],
  gridSpacing: [2, 6, 0.5],
  youGridRadius: [2, 12, 0.5],
  youGridYaw: [0.2, 1.5, 0.05],
  youCheckpoints: [2, 12, 1],
  youFinishRadius: [3, 20, 1],
  youOutAfter: [3, 60, 1],
};

/**
 * Which quad each girl races: her own claim if it is on offer, else any of hers; never the same one. `options` is
 * { girlId: [spec ids she could race] }, `claims` { girlId: spec id }. Null if there aren't two different quads.
 */
export function pickQuads(options, claims, random = Math.random) {
  const ids = Object.keys(options);
  const picks = {};
  for (const id of ids) {
    const free = options[id].filter((s) => !Object.values(picks).includes(s));
    const own = free.find((s) => s === claims[id]);
    // Her own claim if she can have it, else anything the other girl hasn't taken.
    picks[id] = own ?? free[Math.floor(random() * free.length)];
    if (picks[id] === undefined) return null;
  }
  return picks;
}

/**
 * The lap as waypoints: points round the loop `spacing` metres apart starting from fraction `u0`, each pushed clear of
 * any hazard ({ x, z, radius }: bogs and puddles) it would be in (sideways round it), and the last one back at the start line. `track`
 * has `sample(u)` and `totalLength`.
 */
export function planLap(track, u0, hazards, { spacing = 10, margin = 1.4, lateral = 0 } = {}) {
  const n = Math.max(8, Math.round(track.totalLength / spacing));
  const points = [];
  for (let k = 1; k <= n; k++) {
    const s = track.sample(u0 + k / n);
    // Beside the middle of the track, on the side asked for, so two quads on the grid don't share a point.
    let x = s.x - s.tz * lateral;
    let z = s.z + s.tx * lateral;
    if (k === n) {
      points.push({ x, z });
      break;
    }
    // Round a hazard, not along the track away from it: sideways, on whichever side she's already on, by as much as
    // it takes to be just clear (so the line bends round it in an arc, and the straight bit between points keeps clear).
    for (const h of hazards) {
      const rx = x - h.x;
      const rz = z - h.z;
      const clear = h.radius + margin;
      if (Math.hypot(rx, rz) >= clear) continue;
      const along = rx * s.tx + rz * s.tz;
      const side = rx * -s.tz + rz * s.tx >= 0 ? 1 : -1;
      const across = side * Math.sqrt(Math.max(0, clear * clear - along * along));
      x = h.x + s.tx * along - s.tz * across;
      z = h.z + s.tz * along + s.tx * across;
    }
    points.push({ x, z });
  }
  return points;
}

/**
 * Judges your lap, since you're not following a route: you must pass through each quarter of the lap in order (so you
 * can't cut across the field), then get back to the line. `u0` is the line's fraction round the track, `p` the race
 * params. Fed each frame with where you are: { riding, running, u (fraction round the track), distToLine }. Returns
 * 'finish' once, 'out' once if you're off the quad or stalled for `youOutAfter` seconds, else null.
 */
export class YouRun {
  constructor(u0, p) {
    this.u0 = u0;
    this.p = p;
    this.next = 1; // the quarter to reach next
    this.idle = 0;
    this.done = false;
  }

  update(dt, { riding, running, u, distToLine }) {
    if (this.done) return null;
    this.idle = riding && running ? 0 : this.idle + dt;
    if (this.idle > this.p.youOutAfter) {
      this.done = true;
      return 'out';
    }
    const n = this.p.youCheckpoints;
    const rel = (((u - this.u0) % 1) + 1) % 1;
    // Only the band you're meant to be in next counts, so going backwards or cutting across gets you nowhere.
    if (this.next < n && rel >= this.next / n && rel < (this.next + 1) / n) this.next++;
    if (this.next >= n && riding && distToLine < this.p.youFinishRadius && rel > 0.5 + 0.5 / n) {
      this.done = true;
      return 'finish';
    }
    return null;
  }
}

/** Whether you're lined up on your grid point: close, stopped and pointing along the track (`trackYaw`). */
export function youOnGrid({ dist, speed, yaw }, trackYaw, p) {
  const off = Math.atan2(Math.sin(yaw - trackYaw), Math.cos(yaw - trackYaw));
  return dist < p.youGridRadius && Math.abs(speed) < 0.5 && Math.abs(off) < p.youGridYaw;
}

export class Race {
  constructor(params = { ...DEFAULT_RACE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.freeTime = 0;
    this.lastRace = -Infinity;
    this.tally = {}; // girl id -> { wins, losses }
    this.forced = false; // start one at the first chance, whatever the timing (the debug panel, or you asking)
    this.stillTime = 0; // seconds you have sat still on a quad near the line
    this.reset();
  }

  reset() {
    this.phase = 'idle'; // 'idle', 'gather', 'countdown', 'race' or 'over'
    this.picks = null;
    this.challenger = null;
    this.ready = new Set();
    this.finished = []; // { girl, time } in order
    this.out = new Set(); // girls who are out of it
    this.phaseClock = 0;
    this.raceClock = 0;
    this.reported = null;
    this.youIn = false;
  }

  get active() {
    return this.phase !== 'idle';
  }

  /** The start has gone: the girls may open it up. */
  go() {
    return this.phase === 'race' || this.phase === 'over';
  }

  record(girl) {
    return (this.tally[girl] ??= { wins: 0, losses: 0 });
  }

  /** Who is ahead on wins by the lead they go on about, if anyone: { leader, trailing }. */
  rivalry() {
    const ids = Object.keys(this.tally).filter((id) => id !== 'you'); // the score between the girls
    if (ids.length < 2) return null;
    const [a, b] = ids;
    const diff = this.tally[a].wins - this.tally[b].wins;
    if (Math.abs(diff) < this.p.rivalLead) return null;
    return diff > 0 ? { leader: a, trailing: b } : { leader: b, trailing: a };
  }

  /** A girl's quad has reached the start line. */
  grid(girl) {
    if (this.phase !== 'gather') return;
    this.ready.add(girl);
  }

  /** You've pulled off the grid (or it's been noticed you are no longer on it): ready no more. */
  ungrid(girl) {
    this.ready.delete(girl);
  }

  dropYou(events) {
    delete this.picks.you;
    this.ready.delete('you');
    this.youIn = false;
    events.push({ type: 'youDropped' });
  }

  /** A girl has crossed the finish line. */
  finish(girl) {
    if (this.phase !== 'race' || this.out.has(girl) || this.finished.some((f) => f.girl === girl)) return;
    this.finished.push({ girl, time: this.raceClock });
  }

  /** A girl's drive has ended some other way (stalled out, gave up, you got on): she's out of it. */
  abort(girl) {
    if (!this.active || this.phase === 'over' || this.finished.some((f) => f.girl === girl)) return;
    this.out.add(girl);
  }

  /**
   * A race, offered to each girl (the same `ctx` as update, after update), once both have been free a while and the cooldown is up:
   * [{ key: 'raceDare', girl: 'jess', ... }] first if you've sat still at the line long enough (Jess dares you), and
   * [{ key: 'race', girl, ... }] for each of them. Each carries the quads picked and whether you're in.
   */
  offers(ctx) {
    const p = this.p;
    if (this.phase !== 'idle' || ctx.girls.length < 2 || !ctx.girls.every((g) => g.free)) return [];
    if (this.clock < p.startAfter || this.clock - this.lastRace < p.cooldown || this.freeTime < p.freeFor) return [];
    const picks = pickQuads(ctx.options, ctx.claims, this.random);
    if (!picks) return [];
    const you = ctx.you ?? {};
    const youRiding = you.riding && you.near ? you.riding : null;
    const girls = ctx.girls.map((g) => g.id);
    const out = [];
    if (this.stillTime >= p.dareStill && girls.includes('jess') && p.dareWeight > 0) out.push({ key: 'raceDare', girl: 'jess', girls, picks, dare: true, youRiding, weight: p.dareWeight });
    if (p.weight > 0) for (const id of girls) out.push({ key: 'race', girl: id, girls, picks, dare: false, youRiding, weight: p.weight });
    return out;
  }

  /** One of them suggested it (or Jess dared you): who challenges whom, and the invite the game acts on. */
  take(o) {
    const ids = o.girls;
    // A dare to you is Jess's (or whoever's there); otherwise the usual.
    this.challenger = o.dare && ids.includes('jess') ? 'jess' : ids.includes('jess') && this.random() < this.p.jessChallenges ? 'jess' : ids.find((id) => id !== 'jess') ?? ids[0];
    const picks = { ...o.picks };
    this.youIn = !!o.youRiding;
    if (this.youIn) picks.you = o.youRiding;
    this.picks = picks;
    this.phase = 'gather';
    this.phaseClock = 0;
    return { type: 'invite', challenger: this.challenger, other: ids.find((id) => id !== this.challenger), picks, youIn: this.youIn, dare: o.dare };
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, free }]                       free: stood about, nothing on
   *   options: { girlId: [spec ids she could race now] }
   *   claims: { girlId: spec id }
   * Returns events: { type: 'invite', challenger, other, picks }, { type: 'countdown', seconds }, { type: 'go' },
   *   { type: 'finish', girl, place, time }, { type: 'out', girl },
   *   { type: 'result', winner, loser, margin } (winner null if nobody finished), { type: 'cancel' }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const you = ctx.you ?? {};
    const youHere = !!(you.riding && you.near);
    this.stillTime = youHere && you.still ? this.stillTime + dt : 0;
    if (this.phase === 'idle') {
      const bothFree = ctx.girls.length >= 2 && ctx.girls.every((g) => g.free);
      this.freeTime = bothFree ? this.freeTime + dt : 0;
      // Starting one is an offer (offers, take); only the debug panel's forced one (or yours, asked for) starts here.
      if (!bothFree || !this.forced) return events;
      const picks = pickQuads(ctx.options, ctx.claims, this.random);
      if (!picks) return events;
      this.forced = false;
      events.push(this.take({ girls: ctx.girls.map((g) => g.id), picks, dare: false, youRiding: youHere ? you.riding : null }));
      return events;
    }

    this.phaseClock += dt;
    // You didn't line up in time, or got off: they race without you.
    if ((this.phase === 'gather' && this.picks.you && ((this.phaseClock > p.youWait || you.riding !== this.picks.you) && !this.ready.has('you'))) || (this.phase === 'countdown' && this.picks.you && !this.ready.has('you'))) {
      this.dropYou(events);
    }
    const racers = Object.keys(this.picks);
    if (this.phase === 'gather') {
      for (const g of this.out) events.push({ type: 'out', girl: g });
      if (this.out.size || this.phaseClock > p.gatherTimeout) return this.cancel(events);
      if (racers.every((g) => this.ready.has(g))) {
        this.phase = 'countdown';
        this.phaseClock = 0;
        events.push({ type: 'countdown', seconds: p.countdown });
      }
    } else if (this.phase === 'countdown') {
      if (this.out.size) return this.cancel(events);
      if (this.phaseClock >= p.countdown) {
        this.phase = 'race';
        this.raceClock = 0;
        events.push({ type: 'go' });
      }
    } else if (this.phase === 'race') {
      this.raceClock += dt;
      const seen = new Set(this.reported ?? []);
      this.reported = seen;
      this.finished.forEach((f, i) => {
        if (seen.has(`f${f.girl}`)) return;
        seen.add(`f${f.girl}`);
        events.push({ type: 'finish', girl: f.girl, place: i + 1, time: f.time, ahead: this.finished.slice(0, i).map((x) => x.girl), youIn: !!this.picks.you });
      });
      for (const g of this.out) if (!seen.has(`o${g}`)) { seen.add(`o${g}`); events.push({ type: 'out', girl: g }); }
      if (this.raceClock > p.raceTimeout) for (const g of racers) if (!this.finished.some((f) => f.girl === g)) this.out.add(g);
      const done = racers.every((g) => this.out.has(g) || this.finished.some((f) => f.girl === g));
      if (done) this.conclude(events);
    } else if (this.phase === 'over') {
      // A moment for the result to be taken in, then they can race again after the cooldown.
      this.reset();
    }
    return events;
  }

  /** Called off from outside (they've been called away): no event, and not straight away again. */
  stand() {
    if (this.active) this.cancel([]);
    this.forced = false;
  }

  cancel(events) {
    this.lastRace = this.clock - this.p.cooldown / 2; // not straight away again
    this.reset();
    events.push({ type: 'cancel' });
    return events;
  }

  conclude(events) {
    const racers = Object.keys(this.picks);
    const first = this.finished[0]?.girl ?? null;
    // The other girl, for the bicker afterwards (null when you won, or nobody finished).
    const loser = first && first !== 'you' ? racers.find((g) => g !== first && g !== 'you') : null;
    let margin = 0;
    if (first && this.finished[1]) margin = this.finished[1].time - this.finished[0].time;
    if (first) {
      this.record(first).wins++;
      for (const g of racers) if (g !== first) this.record(g).losses++;
    }
    this.lastRace = this.clock;
    this.phase = 'over';
    this.reported = null;
    events.push({ type: 'result', winner: first, loser, margin, dnf: first && !this.finished[1], youIn: !!this.picks.you });
  }
}
