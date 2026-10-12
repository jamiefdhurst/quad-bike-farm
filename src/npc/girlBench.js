// A girl at the bench. With a quad parked in the painted bay and the toolbox on the bench, a girl may decide to work on it herself (an
// offer, chooser.js). She does one of the bench's own jobs (workshop/benchJobs.js) a step at a time. Amy asks you for things on the way
// ("Pass me the 10 mm", "Hold the torch": go to the bench and press E); help quick and she's glad, ignore her and she fetches it herself,
// slower and likelier to slip. Jess has a go, botches a step and asks you to finish: the half-done job waits at the bench for you to pick
// up from the step she got to, and is left if you don't come. Pure: the game says who and what is where and does the walking and the
// finishing of the job on the quad.

import { BenchJob, JOBS } from '../workshop/benchJobs.js';

export const DEFAULT_GIRL_BENCH_PARAMS = {
  startAfter: 60, // seconds into the game before a girl thinks of it herself
  weight: 0.8, // how keen she is (times her own benchWeight, and weighed against everything else she could do, chooser.js)
  cooldown: 480, // seconds after one before either girl offers another (you can still ask)
  girlRange: 45, // metres: she is this close to the bench for her to think of it
  walkTimeout: 90, // seconds she has to get to the bench
  stepSeconds: 2.4, // seconds she takes over a step (a hold takes its own time as well)
  askChance: 0.8, // the chance Amy asks for a hand at a step that could use one
  maxAsks: 2, // most times she asks in one job
  askWait: 9, // seconds she waits for you to help before she fetches it herself
  fetchSeconds: 6, // extra seconds it takes when she has to go and get it herself
  helpRange: 3.5, // metres: you have to be this close to the bench to pass her something
  quickWithin: 4, // seconds: help this quick counts as quick
  amyBotch: 0.05, // the chance Amy slips on a step that has a window (snug, not tight)
  missedBotch: 0.3, // and when she had to fetch it herself
  jessStopFraction: 0.5, // how far through the job Jess gets before it goes wrong
  waitForYou: 240, // seconds Jess waits for you to finish her job before she gives up on it
  nagEvery: 70, // seconds between her reminding you
  favourQuick: 1.5, // favour for passing it quickly
  favourSlow: 0.5, // and for passing it late
  favourFinish: 2.5, // favour from Jess for finishing her job
  favourDone: 1, // favour from Amy for a job done and written up
};

export const GIRL_BENCH_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  weight: [0, 3, 0.05],
  cooldown: [0, 1800, 10],
  girlRange: [5, 100, 1],
  walkTimeout: [10, 300, 5],
  stepSeconds: [0.5, 10, 0.1],
  askChance: [0, 1, 0.05],
  maxAsks: [0, 6, 1],
  askWait: [2, 40, 1],
  fetchSeconds: [0, 30, 1],
  helpRange: [1.5, 8, 0.25],
  quickWithin: [1, 20, 0.5],
  amyBotch: [0, 1, 0.01],
  missedBotch: [0, 1, 0.01],
  jessStopFraction: [0.2, 0.8, 0.05],
  waitForYou: [30, 900, 10],
  nagEvery: [10, 300, 5],
  favourQuick: [0, 10, 0.1],
  favourSlow: [0, 10, 0.1],
  favourFinish: [0, 10, 0.1],
  favourDone: [0, 10, 0.1],
};

/** The jobs a girl takes on herself: the short ones that need no kit (benchJobs.js has the rest). */
export const GIRL_JOBS = ['plug', 'carb', 'tyre', 'oil'];

/** Steps where Amy could use a hand, and what for. */
export const ASK_STEPS = { out: 'spanner', tight: 'spanner', off: 'spanner', bowl: 'spanner', look: 'torch', jets: 'torch', patch: 'torch', pour: 'torch' };

/** What the prompt says when she's asking. */
export const ASK_PROMPT = { spanner: 'Pass {name} the 10 mm', torch: 'Hold the torch for {name}' };

/**
 * Which job she would do on a quad: what it needs most. `s`: { puncture, carb (faults started), fouling, wear, oilLow (a two-stroke with
 * little oil in the mix), twoStroke }. `can(kind)`: whether the quad can have that job. A plug is the fallback: it is never wasted.
 */
export function pickJob(s, can = () => true) {
  const want = [];
  if (s.puncture) want.push('tyre');
  if (s.carb) want.push('carb');
  if (s.twoStroke && s.oilLow) want.push('oil');
  if (s.fouling >= 0.25 || s.wear >= 0.35) want.push('plug');
  want.push('plug');
  return want.find((k) => GIRL_JOBS.includes(k) && can(k)) ?? null;
}

/** Where she stands to work: beside the quad in the bay, towards the bench end, facing the quad. `bay`: layout.bay. Heading as atan2(dx, dz). */
export function workSpot(bay) {
  const x = bay.x + bay.halfX - 0.35;
  const z = bay.z - bay.halfZ * 0.3;
  return { x, z, yaw: Math.atan2(bay.x - x, bay.z - z) };
}

export class GirlBench {
  /** `benchParams`: the bench's own (hold scale and so on), shared so the debug panel's changes count. */
  constructor(params = { ...DEFAULT_GIRL_BENCH_PARAMS }, benchParams = {}, random = Math.random) {
    this.p = params;
    this.benchParams = benchParams;
    this.random = random;
    this.clock = 0;
    this.cooldownUntil = 0;
    this.session = null; // { girl, how, unit, kind, job, slips (she will make a hash of it), phase: 'going' | 'working' | 'asking', t, extra, asks, askedAt, ask, missed, said }
    this.pending = null; // Jess's half-done job: { girl, unit, kind, job, since, nagged }
  }

  get girl() {
    return this.session?.girl ?? null;
  }

  get active() {
    return !!this.session;
  }

  /** What she is asking you for now: { girl, type } or null. */
  get asking() {
    const s = this.session;
    return s?.phase === 'asking' ? { girl: s.girl, type: s.ask.type } : null;
  }

  /** Where each free girl could take it on: [{ key: 'benchWork', girl, unit, kind, weight }]. `ctx`: { girls: [{ id, free, distance, weight, slip (the chance she makes a hash of it) }], bay: { unit, kind } | null }. */
  offers(ctx) {
    const p = this.p;
    if (this.session || this.pending || !ctx.bay || this.clock < p.startAfter || this.clock < this.cooldownUntil) return [];
    return ctx.girls.filter((g) => g.free && g.distance <= p.girlRange && g.weight > 0).map((g) => ({ key: 'benchWork', girl: g.id, unit: ctx.bay.unit, kind: ctx.bay.kind, slips: this.random() < (g.slip ?? 0), weight: p.weight * g.weight }));
  }

  take(o) {
    return this.begin(o.girl, o.unit, o.kind, 'offer', { slips: o.slips });
  }

  /** Starts it (her choice, or the debug panel's). Returns { type: 'go', girl, unit, kind, how }, or null if it is already on. */
  begin(girl, unit, kind, how, { slips = false } = {}) {
    if (this.session || this.pending || !JOBS[kind]) return null;
    this.session = { girl, how, unit, kind, job: new BenchJob(kind, this.benchParams), phase: 'going', t: 0, extra: 0, slips, asks: 0, askedAt: -1, ask: null, missed: false, said: new Set() };
    return { type: 'go', girl, unit, kind, how };
  }

  cancel() {
    this.session = null;
  }

  /** You pass her what she asked for. Returns true if she was asking. */
  help() {
    const s = this.session;
    if (s?.phase !== 'asking' || s.ask.helped) return false;
    s.ask.helped = true;
    return true;
  }

  /** Whether the half-done job is for this unit (the bench picks it up). */
  pendingFor(unit) {
    return this.pending && this.pending.unit === unit ? this.pending : null;
  }

  /** The bench finished the job she left (or you dropped it): forget it. */
  settle() {
    this.pending = null;
    this.cooldownUntil = this.clock + this.p.cooldown;
  }

  /** The job as it stands for the toast and the logbook. */
  describe() {
    const s = this.session;
    const pn = this.pending;
    if (s) return `${s.girl}: ${s.phase === 'going' ? 'on her way to the bench' : `${JOBS[s.kind].name.toLowerCase()}, step ${s.job.index + 1} of ${s.job.def.steps.length}`}${s.phase === 'asking' ? `, asking for the ${s.ask.type}` : ''}`;
    if (pn) return `${pn.girl} left ${JOBS[pn.kind].name.toLowerCase()} for you to finish (step ${pn.job.index + 1})`;
    return this.clock < this.cooldownUntil ? `no (again in ${Math.round(this.cooldownUntil - this.clock)} s)` : 'no';
  }

  /** How long she takes over the step she is on. */
  stepTime(job) {
    const step = job.step;
    return this.p.stepSeconds + (step.kind === 'hold' ? job.needSeconds : 0);
  }

  /** Does the step now: a clean one, or a slip (a window she lets go of at once). */
  doStep(job, slip) {
    const step = job.step;
    if (step.kind === 'press') return job.press();
    job.startHold();
    if (slip && step.limit) return job.releaseHold();
    const out = job.update(job.needSeconds + 0.05);
    return step.limit && !out.some((e) => e.type === 'step' || e.type === 'done') ? job.releaseHold() : out;
  }

  /**
   * One step. `ctx`: { girl: { free (asked, her own hold not counted), there (stood at the bench) } | null, unitOk (the quad is still in
   * the bay with the engine off), benchOpen }. Whether she botches it (and hands it over) was settled when she began.
   * Events: { type: 'say', girl, line }, { type: 'finish', girl, unit, job, botched, helped } (Amy: apply the job to the quad),
   * { type: 'handover', girl, unit, kind } (Jess leaves it for you), { type: 'gaveUp', girl }, { type: 'help', girl, quick }, { type: 'end', girl, why }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const out = [];
    const pn = this.pending;
    if (pn) {
      pn.since += dt;
      if (!ctx.unitOk && !ctx.benchOpen) {
        this.pending = null;
        out.push({ type: 'gaveUp', girl: pn.girl, why: 'moved' });
      } else if (!ctx.benchOpen) {
        if (pn.since - pn.nagged >= p.nagEvery) {
          pn.nagged = pn.since;
          out.push({ type: 'say', girl: pn.girl, line: 'benchNag' });
        }
        if (pn.since >= p.waitForYou) {
          this.settle();
          out.push({ type: 'gaveUp', girl: pn.girl, why: 'waited' });
        }
      }
    }
    const s = this.session;
    if (!s) return out;
    const end = (why) => {
      this.session = null;
      this.cooldownUntil = this.clock + p.cooldown;
      out.push({ type: 'end', girl: s.girl, why });
    };
    s.t += dt;
    if (!ctx.girl || !ctx.unitOk || ctx.benchOpen) {
      end('lost');
      return out;
    }
    if (s.phase === 'going') {
      if (ctx.girl.there) {
        s.phase = 'working';
        s.t = 0;
        out.push({ type: 'say', girl: s.girl, line: 'benchGirlStart' });
      } else if (s.t >= p.walkTimeout) end('lost');
      return out;
    }
    const job = s.job;
    if (s.phase === 'asking') {
      s.ask.t += dt;
      if (s.ask.helped) {
        const quick = s.ask.t <= p.quickWithin;
        out.push({ type: 'help', girl: s.girl, quick });
        out.push({ type: 'say', girl: s.girl, line: quick ? 'benchThanks' : 'benchThanksLate' });
        s.phase = 'working';
        s.t = 0;
      } else if (s.ask.t >= p.askWait) {
        s.missed = true;
        s.extra = p.fetchSeconds;
        out.push({ type: 'say', girl: s.girl, line: 'benchMissed' });
        s.phase = 'working';
        s.t = 0;
      }
      return out;
    }
    // Working. Amy stops to ask on the steps that could use a hand, once as the step starts.
    const step = job.step;
    if (!s.slips && s.askedAt !== job.index) {
      s.askedAt = job.index;
      const type = ASK_STEPS[step.id];
      if (type && s.asks < p.maxAsks && this.random() < p.askChance) {
        s.asks++;
        s.ask = { type, t: 0, helped: false };
        s.phase = 'asking';
        out.push({ type: 'say', girl: s.girl, line: type === 'spanner' ? 'benchAskSpanner' : 'benchAskTorch' });
        return out;
      }
    }
    if (s.t < this.stepTime(job) + s.extra) return out;
    s.t = 0;
    s.extra = 0;
    const slip = s.slips ? false : !!step.limit && this.random() < (s.missed ? p.missedBotch : p.amyBotch);
    s.missed = false;
    const events = this.doStep(job, slip);
    if (events.some((e) => e.type === 'flaw')) out.push({ type: 'say', girl: s.girl, line: 'benchGirlSlip' });
    else if (!job.done && this.random() < 0.3) out.push({ type: 'say', girl: s.girl, line: 'benchGirlStep' });
    if (job.done) {
      out.push({ type: 'finish', girl: s.girl, unit: s.unit, kind: s.kind, job, botched: job.botched });
      end('done');
      return out;
    }
    // Jess gets so far, then it goes wrong and she asks you to finish.
    if (s.slips && job.index >= Math.max(2, Math.floor(job.def.steps.length * p.jessStopFraction))) {
      if (!job.botched) job.flaws.push({ step: job.def.steps[job.index - 1].id, how: 'short' });
      this.pending = { girl: s.girl, unit: s.unit, kind: s.kind, job, since: 0, nagged: 0 };
      out.push({ type: 'say', girl: s.girl, line: 'benchGirlSlip' });
      out.push({ type: 'handover', girl: s.girl, unit: s.unit, kind: s.kind });
      end('handover');
    }
    return out;
  }
}
