import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOT_PARAMS as P, MOT_PARAM_RANGES, MOT_ITEMS, MotWear, MotLog, canMot, inspect, itemFails, readCondition, whyNotTest, inBay, withCertificate, girlMinds, sheetLines,
} from '../src/farm/mot.js';
import { BenchJob, JOBS, JOB_KINDS, finishJob, jobAvailable, DEFAULT_BENCH_PARAMS as B } from '../src/workshop/benchJobs.js';
import { entryText } from '../src/workshop/logbook.js';
import { AMY_MOT_LINES, JESS_MOT_LINES } from '../src/npc/motLines.js';
import { TOR_SPEC, CRAG_SPEC, FINCH_SPEC, HARTLEY_SPEC } from '../src/vehicle/quadSpecs.js';

const sound = () => ({
  wear: { bulbs: 0.1, blades: 0.1, horn: 0.1 },
  brakes: { binding: false, heat: 0, wet: 0 },
  faults: {},
  tread: { front: 0.8, rear: 0.7 },
  psi: [4, 4, 4, 4],
  coolantLeak: 0,
  silencerBlown: 0,
});

function doJob(job, flawAt) {
  while (!job.done) {
    const s = job.step;
    if (s.kind === 'press') job.press();
    else {
      job.startHold();
      job.update(s.id === flawAt ? job.needSeconds * 0.3 : s.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01);
      job.releaseHold();
    }
  }
  return job;
}

describe('the sheet', () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) expect(MOT_PARAM_RANGES[k], k).toBeTruthy();
  });

  it('passes a sound Tor or Crag on every item', () => {
    const s = inspect(sound());
    expect(s.passed).toBe(true);
    expect(s.items.map((i) => i.id)).toEqual(MOT_ITEMS);
  });

  it('fails each item from its own cause', () => {
    const fail = (id, change) => {
      const c = sound();
      change(c);
      expect(itemFails(id, c), id).toBe(true);
      expect(inspect(c).fails).toEqual([id]);
    };
    fail('lights', (c) => (c.wear.bulbs = 0.7));
    fail('wipers', (c) => (c.wear.blades = 0.7));
    fail('horn', (c) => (c.wear.horn = 0.7));
    fail('brakes', (c) => (c.brakes.binding = true));
    fail('brakes', (c) => (c.faults.caliper = 0.4));
    fail('tyres', (c) => (c.tread.rear = 0.1));
    fail('tyres', (c) => (c.psi = [4, 4, 1.8, 4]));
    fail('tyres', (c) => (c.faults.puncture = 0.5));
    fail('leak', (c) => (c.coolantLeak = 0.5));
    fail('leak', (c) => (c.faults.gasket = 0.5));
    fail('exhaust', (c) => (c.silencerBlown = 0.5));
    fail('exhaust', (c) => (c.faults.exhaustHole = 0.5));
  });

  it('words a pass and a fail', () => {
    expect(sheetLines('the Tor', inspect(sound()), 3).verdict).toContain('good to day 17');
    const c = sound();
    c.wear.bulbs = 1;
    c.wear.horn = 1;
    const l = sheetLines('the Tor', inspect(c), 3);
    expect(l.verdict).toBe('FAIL: lights, horn');
    expect(l.advice).toMatch(/bench/);
  });

  it('is read off a unit', () => {
    const wear = new MotWear();
    wear.bulbs = 0.9;
    const unit = {
      quad: { motWear: wear, faults: { started: { gasket: true }, levels: { gasket: 0.4 } }, brakes: { binding: true, heat: 0.1, wet: 0 }, tyres: { tread: { front: 0.5, rear: 0.5 }, psi: [4, 4, 4, 4] } },
      engine: { coolantLeak: 0, silencerBlown: 0.1 },
    };
    const c = readCondition(unit);
    expect(c.wear.bulbs).toBe(0.9);
    expect(c.faults.gasket).toBe(0.4);
    expect(inspect(c).fails).toEqual(['lights', 'brakes', 'leak']);
  });
});

describe('the bay', () => {
  const bay = { x: 100, z: 50, yaw: Math.PI / 2 };

  it('takes a Tor or Crag parked along it, either way round', () => {
    expect(inBay({ x: 100.5, z: 50.4, yaw: Math.PI / 2 }, bay)).toBe(true);
    expect(inBay({ x: 100, z: 50, yaw: -Math.PI / 2 }, bay)).toBe(true);
  });

  it('refuses one off the middle or across it', () => {
    expect(inBay({ x: 104, z: 50, yaw: Math.PI / 2 }, bay)).toBe(false);
    expect(inBay({ x: 100, z: 50, yaw: 0 }, bay)).toBe(false);
  });

  it('says why a test cannot start', () => {
    const ok = { spec: { landRover: true }, onBay: true, purse: 100, busy: false, running: false };
    expect(whyNotTest(ok)).toBeNull();
    expect(whyNotTest({ ...ok, onBay: false })).toMatch(/Park a Tor or Crag/);
    expect(whyNotTest({ ...ok, spec: { landRover: false } })).toMatch(/only does the Tor and the Crag/);
    expect(whyNotTest({ ...ok, running: true })).toMatch(/engine off/);
    expect(whyNotTest({ ...ok, purse: P.price - 5 })).toBe('You are £5 short');
    expect(whyNotTest({ ...ok, busy: true })).toMatch(/going over/);
  });

  it('is for the Tor and the Crag only', () => {
    expect([TOR_SPEC, CRAG_SPEC].every(canMot)).toBe(true);
    expect([FINCH_SPEC, HARTLEY_SPEC].some(canMot)).toBe(false);
  });
});

describe('the log', () => {
  const pass = { passed: true, fails: [] };
  const fail = { passed: false, fails: ['horn'] };

  it('keeps a pass for the days it is good for', () => {
    const log = new MotLog(P);
    log.record('tor', 3, pass);
    expect(log.valid('tor', 3 + P.validDays)).toBe(true);
    expect(log.valid('tor', 3 + P.validDays + 1)).toBe(false);
    expect(log.valid('crag', 3)).toBe(false);
    expect(log.describe('tor', 4)).toMatch(/passed on day 3/);
    expect(log.describe('tor', 40)).toMatch(/ran out/);
  });

  it('a fail voids the certificate and the girls mind until a pass', () => {
    const log = new MotLog(P);
    log.record('tor', 1, pass);
    log.record('tor', 2, fail);
    expect(log.valid('tor', 2)).toBe(false);
    expect(log.failed('tor')).toBe(true);
    expect(log.describe('tor', 2)).toBe('failed on day 2: horn');
    log.record('tor', 3, pass);
    expect(log.failed('tor')).toBe(false);
  });

  it('survives the farm save and ignores nonsense in it', () => {
    const log = new MotLog(P);
    log.record('tor', 5, fail);
    log.record('crag', 6, pass);
    const back = new MotLog(P);
    back.restore(JSON.parse(JSON.stringify(log.toJSON())));
    expect(back.failed('tor')).toBe(true);
    expect(back.valid('crag', 6)).toBe(true);
    back.restore({ last: { x: { day: 'no' } }, certificate: { y: 'no' }, history: [1] });
    expect(back.failed('x')).toBe(false);
  });

  it('keeps only the latest few tests', () => {
    const log = new MotLog({ ...P, logKept: 3 });
    for (let d = 1; d <= 6; d++) log.record('tor', d, pass);
    expect(log.history.map((h) => h.day)).toEqual([4, 5, 6]);
  });
});

describe('the price and the girls', () => {
  it('adds the bonus only with a valid certificate', () => {
    expect(withCertificate(1000, false)).toBe(1000);
    expect(withCertificate(1000, true)).toBe(1080);
  });

  it('Amy refuses a failed one and Jess grumbles; neither minds a good one', () => {
    expect(girlMinds('amy', true)).toBe('refuses');
    expect(girlMinds('jess', true)).toBe('grumbles');
    expect(girlMinds('amy', false)).toBe('ok');
    expect(girlMinds('jess', false)).toBe('ok');
  });

  it('has lines for what they say', () => {
    for (const k of ['motPass', 'motFail', 'motWont']) expect(AMY_MOT_LINES[k].lines.length, k).toBeGreaterThan(0);
    for (const k of ['motPass', 'motFail', 'motGrumble']) expect(JESS_MOT_LINES[k].length, k).toBeGreaterThan(0);
  });
});

describe('the wear', () => {
  it('is dealt below the failing line, grows with hours and is renewed', () => {
    const w = new MotWear(P);
    w.deal(() => 0.999);
    expect(Math.max(w.bulbs, w.blades, w.horn)).toBeLessThan(P.wornAt);
    w.wear(10);
    expect(w.bulbs).toBe(1);
    w.renew();
    expect(w.capture()).toEqual({ bulbs: 0, blades: 0, horn: 0 });
  });

  it('is kept by the farm and put right by "Put it right"', () => {
    const w = new MotWear(P);
    w.bulbs = 0.8;
    const copy = new MotWear(P);
    copy.restore(JSON.parse(JSON.stringify(w.capture())));
    expect(copy.bulbs).toBe(0.8);
    copy.restore({ bulbs: 'x', horn: 7 });
    expect(copy.bulbs).toBe(0.8);
    expect(copy.horn).toBe(1);
  });
});

describe('the bench job', () => {
  it('is on the list and offered only with the wear to renew', () => {
    expect(JOB_KINDS).toContain('electrics');
    expect(JOBS.electrics.steps.length).toBeGreaterThanOrEqual(4);
    const e = { params: { strokes: 4 } };
    expect(jobAvailable('electrics', e, B, false, true, false, null, null, new MotWear())).toBe(true);
    expect(jobAvailable('electrics', e, B, false, true, false, null, null, null)).toBe(false);
  });

  it('renews the bulbs, rubbers and horn; a botched horn stays weak', () => {
    const worn = () => {
      const w = new MotWear();
      Object.assign(w, { bulbs: 0.9, blades: 0.9, horn: 0.9 });
      return w;
    };
    const good = { engine: {}, faults: {}, fuel: {}, motWear: worn() };
    finishJob(doJob(new BenchJob('electrics')), good);
    expect(good.motWear.capture()).toEqual({ bulbs: 0, blades: 0, horn: 0 });
    const bad = { engine: {}, faults: {}, fuel: {}, motWear: worn() };
    finishJob(doJob(new BenchJob('electrics'), 'horn'), bad);
    expect(bad.motWear.bulbs).toBe(0);
    expect(bad.motWear.horn).toBe(0.9);
  });

  it('writes the logbook entries', () => {
    expect(entryText({ kind: 'mot', passed: true })).toBe('MOT passed');
    expect(entryText({ kind: 'mot', passed: false, fails: ['lights', 'horn'] })).toBe('MOT failed: lights, horn');
    expect(entryText({ kind: 'job', job: 'electrics' })).toBe('new bulbs, blades and horn');
  });
});
