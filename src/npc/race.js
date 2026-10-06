// Racing. Bored and both free, the girls pick two quads and race one lap of the track without you. The loser has
// excuses, and the wins and losses are kept for the rest of the game, so the rivalry has a score. Pure logic: the game
// plans the route and drives the quads (HerDrive has a race mode), and this runs the race around them: who is
// challenged, the grid, the count-down, the finish, and who won.

export const DEFAULT_RACE_PARAMS = {
  startAfter: 120, // seconds into the game before they might
  freeFor: 20, // seconds both have been stood about
  chance: 0.015, // per second after that
  cooldown: 300, // seconds between races
  jessChallenges: 0.7, // chance it's Jess who dares Amy to it
  gatherTimeout: 150, // seconds to get both quads started and to the start line before it's called off
  countdown: 3, // seconds of "three, two, one"
  raceTimeout: 150, // seconds after the start before whoever is still going is out of it
  rivalLead: 2, // wins ahead before they start going on about the score
  routeSpacing: 6, // metres between the route's waypoints
  hazardMargin: 1.4, // metres a waypoint is kept clear of a bog's or puddle's edge
  cruiseBase: 9, // m/s she aims for flat out: the quad's power decides what she gets
  cruiseConfidence: 4, // more for each 1 of confidence
  cruiseSpread: 1.5, // +/- random per race
  throttle: 1, // most throttle she'll use
};

export const RACE_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  freeFor: [0, 120, 1],
  chance: [0, 0.2, 0.005],
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

export class Race {
  constructor(params = { ...DEFAULT_RACE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.freeTime = 0;
    this.lastRace = -Infinity;
    this.tally = {}; // girl id -> { wins, losses }
    this.forced = false; // start one at the first chance, whatever the timing (the debug panel)
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
    const ids = Object.keys(this.tally);
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
    if (this.phase === 'idle') {
      const bothFree = ctx.girls.length >= 2 && ctx.girls.every((g) => g.free);
      this.freeTime = bothFree ? this.freeTime + dt : 0;
      const wait = !this.forced && (this.clock < p.startAfter || this.clock - this.lastRace < p.cooldown || this.freeTime < p.freeFor || this.random() >= p.chance * dt);
      if (!bothFree || wait) return events;
      const picks = pickQuads(ctx.options, ctx.claims, this.random);
      if (!picks) return events;
      this.forced = false;
      const ids = ctx.girls.map((g) => g.id);
      this.challenger = ids.includes('jess') && this.random() < p.jessChallenges ? 'jess' : ids.find((id) => id !== 'jess') ?? ids[0];
      this.picks = picks;
      this.phase = 'gather';
      this.phaseClock = 0;
      events.push({ type: 'invite', challenger: this.challenger, other: ids.find((id) => id !== this.challenger), picks });
      return events;
    }

    this.phaseClock += dt;
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
        events.push({ type: 'finish', girl: f.girl, place: i + 1, time: f.time });
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

  cancel(events) {
    this.lastRace = this.clock - this.p.cooldown / 2; // not straight away again
    this.reset();
    events.push({ type: 'cancel' });
    return events;
  }

  conclude(events) {
    const racers = Object.keys(this.picks);
    const first = this.finished[0]?.girl ?? null;
    const loser = first ? racers.find((g) => g !== first) : null;
    let margin = 0;
    if (first && this.finished[1]) margin = this.finished[1].time - this.finished[0].time;
    if (first) {
      this.record(first).wins++;
      this.record(loser).losses++;
    }
    this.lastRace = this.clock;
    this.phase = 'over';
    this.reported = null;
    events.push({ type: 'result', winner: first, loser, margin, dnf: first && !this.finished[1] });
  }
}
