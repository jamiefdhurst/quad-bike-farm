import { describe, it, expect } from 'vitest';
import { GirlBench, DEFAULT_GIRL_BENCH_PARAMS as P, pickJob, workSpot, ASK_STEPS } from '../src/npc/girlBench.js';
import { DEFAULT_BENCH_PARAMS, JOBS, BenchJob } from '../src/workshop/benchJobs.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { AMY_BENCH_LINES, JESS_BENCH_LINES } from '../src/npc/benchLines.js';

const bay = { unit: 'farm300', kind: 'plug' };
const girls = [
  { id: 'amy', free: true, distance: 10, weight: 1.3, slip: 0 },
  { id: 'jess', free: true, distance: 10, weight: 0.7, slip: 1 },
];
const ok = { girl: { there: true }, unitOk: true, benchOpen: false };
const make = (random = () => 0.5, p = { ...P }) => new GirlBench(p, DEFAULT_BENCH_PARAMS, random);

/** Runs the module until it ends or `max` seconds pass, helping at once when asked; returns every event. */
function run(gb, { help = true, max = 200 } = {}) {
  const events = [];
  for (let t = 0; t < max; t += 0.25) {
    if (help && gb.asking) gb.help();
    events.push(...gb.update(0.25, ok));
    if (!gb.active) break;
  }
  return events;
}

describe('A girl at the bench: choosing', () => {
  it('picks the job the quad needs, and a plug when nothing is wrong', () => {
    const s = { puncture: false, carb: false, fouling: 0, wear: 0, twoStroke: true, oilLow: false };
    expect(pickJob(s)).toBe('plug');
    expect(pickJob({ ...s, carb: true })).toBe('carb');
    expect(pickJob({ ...s, carb: true, puncture: true })).toBe('tyre');
    expect(pickJob({ ...s, oilLow: true })).toBe('oil');
    expect(pickJob({ ...s, oilLow: true }, (k) => k !== 'oil')).toBe('plug');
    expect(pickJob(s, () => false)).toBeNull();
  });

  it('offers once it is late enough, to free girls near the bench who want to, with a quad in the bay', () => {
    const gb = make();
    expect(gb.offers({ girls, bay })).toEqual([]);
    gb.update(P.startAfter + 1, ok);
    expect(gb.offers({ girls, bay: null })).toEqual([]);
    expect(gb.offers({ girls: [{ ...girls[0], free: false }, { ...girls[1], distance: 200 }], bay })).toEqual([]);
    expect(gb.offers({ girls: [{ ...girls[0], weight: 0 }], bay })).toEqual([]);
    const out = gb.offers({ girls, bay });
    expect(out.map((o) => o.girl)).toEqual(['amy', 'jess']);
    expect(out[1].slips).toBe(true);
    expect(out[0].slips).toBe(false);
    expect(OFFER_KINDS.benchWork).toBeTruthy();
  });

  it('gives Amy a keen weight and Jess a lower one, and only Jess a habit of botching', () => {
    expect(CHARACTERS.find((c) => c.id === 'amy').params.benchWeight).toBeGreaterThan(CHARACTERS.find((c) => c.id === 'jess').params.benchWeight);
    expect(CHARACTERS.find((c) => c.id === 'jess').params.benchSlip).toBeGreaterThan(0.5);
    expect(CHARACTERS.find((c) => c.id === 'amy').params.benchSlip ?? 0).toBe(0);
  });

  it('stands her beside the quad, facing it', () => {
    const b = { x: 0, z: 10, halfX: 1.5, halfZ: 1.1 };
    const s = workSpot(b);
    expect(Math.hypot(s.x - b.x, s.z - b.z)).toBeLessThan(2);
    expect(Math.sin(s.yaw) * (b.x - s.x)).toBeGreaterThan(0); // turned towards the quad's middle
  });

  it('does not start a second while one is on or left, and ignores unknown jobs', () => {
    const gb = make();
    gb.update(P.startAfter + 1, ok);
    expect(gb.begin('amy', 'farm300', 'nope', 'asked')).toBeNull();
    expect(gb.begin('amy', 'farm300', 'plug', 'asked')?.type).toBe('go');
    expect(gb.begin('jess', 'farm300', 'plug', 'asked')).toBeNull();
    expect(gb.offers({ girls, bay })).toEqual([]);
  });
});

describe('A girl at the bench: Amy', () => {
  it('waits to get there, then does the whole job and hands the finished job to the game', () => {
    const gb = make(() => 0.99); // never asks, never slips
    gb.begin('amy', 'farm300', 'plug', 'asked');
    expect(gb.update(1, { ...ok, girl: { there: false } })).toEqual([]);
    const events = run(gb);
    const fin = events.find((e) => e.type === 'finish');
    expect(fin.kind).toBe('plug');
    expect(fin.botched).toBe(false);
    expect(events.some((e) => e.type === 'say' && e.line === 'benchGirlStart')).toBe(true);
    expect(gb.active).toBe(false);
  });

  it('gives up if she cannot get there, or the quad goes, or you open the bench', () => {
    const a = make();
    a.begin('amy', 'farm300', 'plug', 'asked');
    const lost = a.update(P.walkTimeout + 1, { ...ok, girl: { there: false } });
    expect(lost.find((e) => e.type === 'end').why).toBe('lost');
    const b = make();
    b.begin('amy', 'farm300', 'plug', 'asked');
    expect(b.update(1, { ...ok, unitOk: false }).find((e) => e.type === 'end').why).toBe('lost');
    const c = make();
    c.begin('amy', 'farm300', 'plug', 'asked');
    expect(c.update(1, { ...ok, benchOpen: true }).find((e) => e.type === 'end').why).toBe('lost');
  });

  it('says what she is asking for while she waits, the spanner or the torch', () => {
    const gb = make(() => 0.5);
    gb.begin('amy', 'farm300', 'plug', 'asked');
    const seen = new Set();
    for (let t = 0; t < 100 && gb.active; t += 0.25) {
      if (gb.asking) {
        seen.add(gb.asking.type);
        gb.help();
      }
      gb.update(0.25, ok);
    }
    expect([...seen].sort()).toEqual(['spanner', 'torch']);
  });

  it('only asks maxAsks times in a job, on steps that are in the table', () => {
    const gb = make(() => 0.5);
    gb.begin('amy', 'farm300', 'plug', 'asked');
    const asked = run(gb, { help: true }).filter((e) => e.type === 'say' && /^benchAsk/.test(e.line));
    expect(asked.length).toBeLessThanOrEqual(P.maxAsks);
    expect(asked.length).toBeGreaterThan(0);
    for (const kind of ['plug', 'carb', 'tyre', 'oil']) expect(JOBS[kind].steps.some((s) => ASK_STEPS[s.id])).toBe(true);
  });

  it('thanks you for quick help, and fetches it herself when you ignore her, slower', () => {
    const quick = make(() => 0.5);
    quick.begin('amy', 'farm300', 'plug', 'asked');
    const a = run(quick, { help: true });
    expect(a.find((e) => e.type === 'help').quick).toBe(true);
    const slow = make(() => 0.5);
    slow.begin('amy', 'farm300', 'plug', 'asked');
    const b = run(slow, { help: false });
    expect(b.some((e) => e.type === 'say' && e.line === 'benchMissed')).toBe(true);
    expect(b.some((e) => e.type === 'help')).toBe(false);
    expect(b.find((e) => e.type === 'finish')).toBeTruthy(); // she still does it
  });

  it('is slow-help late: passing it after quickWithin is not quick', () => {
    const gb = make(() => 0.5);
    gb.begin('amy', 'farm300', 'plug', 'asked');
    let late = null;
    for (let t = 0; t < 100 && gb.active; t += 0.25) {
      const events = gb.update(0.25, ok);
      if (gb.asking && gb.session.ask.t > P.quickWithin + 0.5) gb.help();
      late = events.find((e) => e.type === 'help') ?? late;
    }
    expect(late.quick).toBe(false);
  });

  it('slips more when she had to fetch it herself', () => {
    const slipped = (missed) => {
      const gb = make(() => 0.2); // a slip needs the roll under the chance: over amyBotch 0.05, under missedBotch 0.3
      gb.begin('amy', 'farm300', 'plug', 'asked');
      gb.session.phase = 'working';
      gb.session.missed = missed;
      gb.session.askedAt = 4; // not asking this time
      gb.session.job.index = 4; // the tightening, a step with a window
      const ev = [];
      for (let t = 0; t < 20 && gb.active; t += 0.25) ev.push(...gb.update(0.25, ok));
      return ev.find((e) => e.type === 'finish').botched;
    };
    expect(slipped(false)).toBe(false); // 0.2 is over amyBotch
    expect(slipped(true)).toBe(true); // and under missedBotch
  });
});

describe('A girl at the bench: Jess', () => {
  it('gets part way, botches a step, and leaves the rest for you', () => {
    const gb = make(() => 0.5);
    gb.begin('jess', 'farm300', 'plug', 'asked', { slips: true });
    const events = run(gb);
    expect(events.some((e) => e.type === 'finish')).toBe(false);
    const hand = events.find((e) => e.type === 'handover');
    expect(hand.kind).toBe('plug');
    expect(gb.active).toBe(false);
    const left = gb.pendingFor('farm300');
    expect(left.job.index).toBeGreaterThanOrEqual(2);
    expect(left.job.index).toBeLessThan(JOBS.plug.steps.length);
    expect(left.job.botched).toBe(true);
    expect(gb.pendingFor('bruin')).toBeNull();
  });

  it('never asks you for a hand', () => {
    const gb = make(() => 0);
    gb.begin('jess', 'farm300', 'carb', 'asked', { slips: true });
    expect(run(gb).some((e) => e.type === 'say' && /^benchAsk/.test(e.line))).toBe(false);
  });

  it('leaves it half done when it is a short job too', () => {
    for (const kind of ['plug', 'carb', 'tyre', 'oil']) {
      const gb = make();
      gb.begin('jess', 'farm300', kind, 'asked', { slips: true });
      run(gb);
      expect(gb.pending.job.index).toBeLessThan(JOBS[kind].steps.length);
    }
  });

  it('nags now and then, and gives up if you never come, leaving the quad as it was', () => {
    const gb = make();
    gb.begin('jess', 'farm300', 'plug', 'asked', { slips: true });
    run(gb);
    const events = [];
    for (let t = 0; t < P.waitForYou + 5; t += 1) events.push(...gb.update(1, ok));
    expect(events.some((e) => e.type === 'say' && e.line === 'benchNag')).toBe(true);
    expect(events.find((e) => e.type === 'gaveUp').why).toBe('waited');
    expect(gb.pending).toBeNull();
    expect(gb.offers({ girls, bay })).toEqual([]); // still in cooldown
  });

  it('stops waiting if the quad is moved, and does not nag or give up while you have the bench open', () => {
    const gb = make();
    gb.begin('jess', 'farm300', 'plug', 'asked', { slips: true });
    run(gb);
    for (let t = 0; t < P.waitForYou + 5; t += 1) expect(gb.update(1, { ...ok, benchOpen: true })).toEqual([]);
    expect(gb.pending).toBeTruthy();
    expect(gb.update(1, { ...ok, unitOk: false }).find((e) => e.type === 'gaveUp').why).toBe('moved');
  });

  it('lets the bench finish the job she left', () => {
    const gb = make();
    gb.begin('jess', 'farm300', 'plug', 'asked', { slips: true });
    run(gb);
    const job = gb.pending.job;
    expect(job).toBeInstanceOf(BenchJob);
    gb.settle();
    expect(gb.pending).toBeNull();
  });
});

describe('A girl at the bench: lines', () => {
  const keys = ['benchGirlGo', 'benchGirlStart', 'benchGirlSlip', 'benchGirlStep', 'benchAskSpanner', 'benchAskTorch', 'benchThanks', 'benchThanksLate', 'benchMissed', 'benchGirlDone', 'benchGirlBotched', 'benchHandOver', 'benchNag', 'benchGaveUp', 'benchFinished'];
  it('both girls have a line for every situation, and none says he, she or they of you', () => {
    for (const k of keys) {
      expect(AMY_BENCH_LINES[k]?.lines.length).toBeGreaterThan(0);
      expect(JESS_BENCH_LINES[k]?.length).toBeGreaterThan(0);
      for (const l of [...AMY_BENCH_LINES[k].lines, ...JESS_BENCH_LINES[k]]) expect(l).not.toMatch(/—|\b(he|she|they)\b/i);
    }
  });
});
