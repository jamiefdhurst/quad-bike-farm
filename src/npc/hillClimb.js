// The hill climb: a timed run from the cones just past the stream up the pasture to the cones near the top (layout.hill.climb). You ask with
// Enter near the start, then the clock runs from the moment you cross the start cones and stops over the finish cones; the cones between
// are gates you have to go through in order, wide enough that the line is yours to choose. The girls do it too, as something Jess (keener) or
// Amy chooses to do with her free time. Pure logic: the game feeds in where everyone is and drives the girls (HerDrive's race mode).

import { pickQuads } from './race.js';

export const DEFAULT_CLIMB_PARAMS = {
  startAfter: 150, // seconds into the game before a girl might choose to
  cooldown: 360, // seconds between the girls' climbs
  weightJess: 1.6, // how keen Jess is to climb the hill against the clock (chooser.js weighs it)
  weightAmy: 0.7, // and Amy
  nearStart: 12, // metres from the start cones you count as there to ask
  armFor: 90, // seconds your ask lasts before you have to ask again
  gridBack: 3, // metres behind the start cones a girl waits for the go
  leaveAfter: 2.5, // seconds a girl waits on her grid point before setting off
  gatherTimeout: 120, // seconds a girl has to reach the start before it's called off
  outAfter: 10, // seconds off the quad or stalled and a run is out
  timeout: 150, // seconds from the start before a run is out
  cruise: 16, // m/s a girl aims for (her quad's grip and the bank decide the rest)
};

export const CLIMB_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  cooldown: [0, 1800, 10],
  weightJess: [0, 5, 0.05],
  weightAmy: [0, 5, 0.05],
  nearStart: [5, 80, 1],
  armFor: [10, 300, 5],
  gridBack: [1, 10, 0.5],
  leaveAfter: [0.5, 10, 0.5],
  gatherTimeout: [20, 300, 5],
  outAfter: [2, 60, 1],
  timeout: [30, 400, 5],
  cruise: [4, 30, 0.5],
};

/** The cones' gates from the course's points: each faces along the course towards the next point (the last as the one before it). */
export function climbGates(climb) {
  const pts = climb.points;
  return pts.map(([x, z], i) => {
    const [nx, nz] = pts[Math.min(i + 1, pts.length - 1)];
    const [px, pz] = pts[i === pts.length - 1 ? i - 1 : i];
    const dx = i === pts.length - 1 ? x - px : nx - x;
    const dz = i === pts.length - 1 ? z - pz : nz - z;
    const len = Math.hypot(dx, dz) || 1;
    return { x, z, tx: dx / len, tz: dz / len, half: climb.gateHalf };
  });
}

/** Whether a step from a to b goes through the gate the right way: from behind its line to ahead of it, between its cones. */
export function crossesGate(gate, a, b) {
  const along = (p) => (p.x - gate.x) * gate.tx + (p.z - gate.z) * gate.tz;
  const before = along(a);
  const after = along(b);
  if (before >= 0 || after < 0) return false;
  // Where the step meets the gate's line.
  const t = before / (before - after);
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  return Math.abs((x - gate.x) * -gate.tz + (z - gate.z) * gate.tx) <= gate.half;
}

/** Where a girl waits, `gridBack` metres behind the start gate (with a staging point 4 m before that), and the points she drives through (the gates, then on past the last). */
export function climbRoute(gates, p, runOff = 8) {
  const s = gates[0];
  const last = gates[gates.length - 1];
  const back = (m) => ({ x: s.x - s.tx * m, z: s.z - s.tz * m });
  return [back(p.gridBack + 4), back(p.gridBack), ...gates.map((g) => ({ x: g.x, z: g.z })), { x: last.x + last.tx * runOff, z: last.z + last.tz * runOff }];
}

/** One run against the clock. `update` returns 'start', 'gate' (one between), 'finish' or 'out' on the step it happens, else null. */
export class ClimbRun {
  constructor(gates, p = DEFAULT_CLIMB_PARAMS) {
    this.gates = gates;
    this.p = p;
    this.state = 'waiting'; // 'waiting' for the start, 'running', 'finished' or 'out'
    this.time = 0;
    this.next = 1; // the next gate to go through once running
    this.idle = 0;
    this.prev = null;
  }

  /** `at` is { x, z }; `status` { riding (on the quad meant), running (engine on) }. */
  update(dt, at, status = { riding: true, running: true }) {
    const prev = this.prev;
    this.prev = { x: at.x, z: at.z };
    if (this.state === 'finished' || this.state === 'out') return null;
    if (this.state === 'waiting') return prev && status.riding && crossesGate(this.gates[0], prev, at) ? this.begin() : null;
    this.time += dt;
    this.idle = status.riding && status.running ? 0 : this.idle + dt;
    if (this.idle > this.p.outAfter || this.time > this.p.timeout) {
      this.state = 'out';
      return 'out';
    }
    if (prev && crossesGate(this.gates[this.next], prev, at)) {
      this.next++;
      if (this.next >= this.gates.length) {
        this.state = 'finished';
        return 'finish';
      }
      return 'gate';
    }
    return null;
  }

  begin() {
    this.state = 'running';
    this.time = 0;
    this.next = 1;
    this.idle = 0;
    return 'start';
  }

  /** Gates still to go through, for the toast. */
  get gatesLeft() {
    return this.gates.length - this.next;
  }
}

/** Starts and keeps the runs: yours (once asked for) and a girl's (her own choice). */
export class HillClimb {
  constructor(gates, params = { ...DEFAULT_CLIMB_PARAMS }, random = Math.random) {
    this.gates = gates;
    this.p = params;
    this.random = random;
    this.Run = ClimbRun; // the kind of run it times (the cone course's adds penalties)
    this.kind = 'climb'; // the event type `take` returns
    this.clock = 0;
    this.lastClimb = -Infinity;
    this.armed = 0; // seconds left of your ask
    this.runs = {}; // 'you' or a girl's id -> ClimbRun
    this.girl = null;
    this.pick = null; // the spec id she drives
    this.phase = 'idle'; // for a girl: 'idle', 'gather' (driving to the start), 'wait' (on her point), 'run'
    this.phaseClock = 0;
    this.forced = false; // from the debug panel: the next free girl does it at once
    this.tally = {}; // id -> climbs finished
  }

  get active() {
    return this.phase !== 'idle';
  }

  /** You ask (Enter near the start): the next time you cross the start cones the clock runs. */
  arm() {
    this.armed = this.p.armFor;
    this.runs.you = new this.Run(this.gates, this.p);
  }

  get youArmed() {
    return this.armed > 0 && this.runs.you?.state === 'waiting';
  }

  /** The girl's drive reached her point behind the start cones. */
  grid(id) {
    if (id === this.girl && this.phase === 'gather') {
      this.phase = 'wait';
      this.phaseClock = 0;
    }
  }

  /** The signal her drive waits on: she may go. */
  go() {
    return this.phase === 'run';
  }

  /** A drive ended some other way (stalled out, gave up): she's out of it. */
  abort(id) {
    const run = this.runs[id];
    if (id === this.girl && run && run.state !== 'finished') run.state = 'out';
  }

  /** Called off from outside (the bell): her climb is forgotten; yours too. */
  stand() {
    this.end();
    this.runs = {};
    this.armed = 0;
    this.forced = false;
  }

  end() {
    this.lastClimb = this.clock;
    delete this.runs[this.girl];
    this.girl = null;
    this.pick = null;
    this.phase = 'idle';
  }

  /**
   * A girl choosing to climb: [{ key: 'climb', girl, pick, weight }]. ctx: { busy (a race or recall is on), dark, girls: [{ id, free }],
   * options: { girlId: [spec ids] }, claims }.
   */
  offers(ctx) {
    const p = this.p;
    if (this.phase !== 'idle' || ctx.busy || ctx.dark) return [];
    if (!this.forced && (this.clock < p.startAfter || this.clock - this.lastClimb < p.cooldown)) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free) continue;
      const pick = pickQuads({ [g.id]: ctx.options[g.id] ?? [] }, ctx.claims, this.random);
      if (pick) out.push({ key: this.kind, girl: g.id, pick: pick[g.id], weight: this.forced ? 100 : g.id === 'jess' ? p.weightJess : p.weightAmy });
    }
    return out;
  }

  /** She chose to: the event the game acts on, { type: 'climb', girl, pick }. */
  take(o) {
    this.forced = false;
    this.girl = o.girl;
    this.pick = o.pick;
    this.phase = 'gather';
    this.phaseClock = 0;
    this.runs[o.girl] = new this.Run(this.gates, this.p);
    return { type: this.kind, girl: o.girl, pick: o.pick };
  }

  /**
   * One step. ctx.at: { you?: {x, z, riding, running}, [girlId]: {...} }. Returns events { type: 'start'|'gate'|'finish'|'out', id, time,
   * gatesLeft } and, for a girl called off, { type: 'cancel', girl }.
   */
  update(dt, ctx) {
    const events = [];
    this.clock += dt;
    if (this.armed > 0) this.armed -= dt;
    if (this.armed <= 0 && this.runs.you?.state === 'waiting') delete this.runs.you;
    for (const [id, run] of Object.entries(this.runs)) {
      const at = ctx.at?.[id];
      if (!at) continue;
      if (id === 'you' && run.state === 'waiting' && !this.youArmed) continue;
      const e = run.update(dt, at, at);
      if (e) events.push({ type: e, id, time: run.result?.() ?? run.time, gatesLeft: run.gatesLeft, cones: run.cones, misses: run.misses });
      if (e === 'finish') this.tally[id] = (this.tally[id] ?? 0) + 1;
    }
    this.phaseClock += dt;
    const hers = this.runs[this.girl];
    const stuck = (this.phase === 'gather' && this.phaseClock > this.p.gatherTimeout) || (this.phase === 'run' && hers?.state === 'waiting' && this.phaseClock > this.p.timeout);
    if (this.active && (stuck || (this.phase !== 'run' && hers?.state === 'out'))) {
      events.push({ type: 'cancel', girl: this.girl });
      this.end();
    } else if (this.phase === 'wait' && this.phaseClock >= this.p.leaveAfter) {
      this.phase = 'run';
      this.phaseClock = 0;
    } else if (this.phase === 'run') {
      const run = this.runs[this.girl];
      if (!run || run.state === 'finished' || run.state === 'out') {
        if (run?.state === 'out' && !events.some((e) => e.type === 'out' && e.id === this.girl)) events.push({ type: 'out', id: this.girl, time: run.time });
        this.end();
      }
    }
    return events;
  }
}
