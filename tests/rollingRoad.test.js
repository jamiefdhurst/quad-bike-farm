import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROAD_PARAMS as P,
  ROAD_PARAM_RANGES,
  RollingRun,
  RoadLog,
  bhpAt,
  canRun,
  daysToRoadDay,
  isRoadDay,
  onRollers,
  roadOpen,
  runResult,
  slipLines,
  stockRpm,
  torqueOf,
  verdictOf,
  whyNotPay,
  whyNotRun,
} from '../src/farm/rollingRoad.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';

const ALL_QUADS = [...QUAD_SPECS, ...EXTRA_SPECS];

const red = QUAD_SPECS.find((s) => s.id === 'farm300');

/** Runs a quad whose engine revs follow the throttle to its full revs and makes `power`, to the end. */
function runThrough(spec, power = 1, params = P) {
  const run = new RollingRun({ spec, params });
  const full = stockRpm(spec);
  const events = [];
  let guard = 0;
  while (run.active && guard++ < 10000) {
    const rpm = 1100 + (full - 1100) * run.throttle;
    events.push(...run.update(0.05, { rpm, power, running: true }));
  }
  return { run, events };
}

describe('the params', () => {
  it('have a range each', () => {
    for (const k of Object.keys(P)) expect(ROAD_PARAM_RANGES[k], k).toBeTruthy();
  });
});

describe('every quad has a stock figure', () => {
  it('names a believable one', () => {
    for (const spec of ALL_QUADS) {
      expect(canRun(spec), spec.id).toBe(true);
      expect(spec.stockBhp, spec.id).toBeGreaterThan(1);
      expect(spec.stockBhp, spec.id).toBeLessThan(60);
    }
  });
  it('puts the two-stroke race quad above the farm workhorse and the kids quad below everything', () => {
    const by = Object.fromEntries(ALL_QUADS.map((s) => [s.id, s.stockBhp]));
    expect(by.adder).toBeGreaterThan(by.rb300);
    expect(Math.min(...Object.values(by))).toBe(by.asp);
  });
  it('is not for anything but a quad', () => {
    expect(canRun({})).toBe(false);
    expect(canRun(undefined)).toBe(false);
  });
});

describe('the power curve', () => {
  const at = (rpm, power = 1) => bhpAt({ rpm, power, stockBhp: 20, fullRpm: 6000 });
  it('makes the stock figure at its peak, a little under full revs', () => {
    expect(at(6000 * P.peakAt)).toBeCloseTo(20, 5);
  });
  it('makes less each side of the peak and nothing at standstill', () => {
    expect(at(0)).toBe(0);
    expect(at(2000)).toBeLessThan(at(4000));
    expect(at(6000)).toBeLessThan(at(6000 * P.peakAt));
    expect(at(8000)).toBeLessThan(at(6000));
  });
  it('follows the engine model power', () => {
    expect(at(4650, 0.8)).toBeCloseTo(at(4650, 1) * 0.8, 5);
    expect(at(4650, 1.1)).toBeGreaterThan(20);
  });
  it('gives torque from power and revs', () => {
    expect(torqueOf(10, 5252)).toBeCloseTo(10, 5);
    expect(torqueOf(10, 0)).toBe(0);
  });
});

describe('a run', () => {
  it('settles, sweeps, cools and finishes with a result', () => {
    const { run, events } = runThrough(red);
    expect(run.phase).toBe('done');
    expect(events.map((e) => e.type)).toEqual(['sweep', 'done']);
    expect(run.result).toBeTruthy();
  });
  it('finds the stock figure on a sound engine, near three quarters of full revs', () => {
    const { run } = runThrough(red, 1);
    expect(run.result.stock).toBe(red.stockBhp);
    expect(Math.abs(run.result.diff)).toBeLessThan(1);
    expect(run.result.verdict).toBe('stock');
    expect(run.result.rpm).toBeGreaterThan(stockRpm(red) * 0.6);
    expect(run.result.rpm).toBeLessThan(stockRpm(red) * 0.95);
  });
  it('reads low on a sick engine and high on a keen one', () => {
    expect(runThrough(red, 0.7).run.result.verdict).toBe('down');
    expect(runThrough(red, 1.12).run.result.verdict).toBe('up');
    expect(runThrough(red, 0.7).run.result.bhp).toBeLessThan(runThrough(red, 1.12).run.result.bhp);
  });
  it('opens the throttle through the sweep and shuts it after', () => {
    const run = new RollingRun({ spec: red });
    const throttles = [];
    for (let i = 0; i < 400 && run.active; i++) {
      run.update(0.05, { rpm: 4000, power: 1, running: true });
      throttles.push([run.phase, run.throttle]);
    }
    const sweep = throttles.filter(([ph]) => ph === 'sweep').map(([, t]) => t);
    expect(sweep[0]).toBeGreaterThanOrEqual(P.startThrottle);
    expect(sweep[sweep.length - 1]).toBeGreaterThan(0.95);
    expect(sweep).toEqual([...sweep].sort((a, b) => a - b));
    expect(run.throttle).toBe(0);
    expect(run.load).toBe(0);
  });
  it('holds the rollers load through the run', () => {
    const run = new RollingRun({ spec: red });
    run.update(0.1, { rpm: 2000, power: 1, running: true });
    expect(run.load).toBe(P.rollerLoad);
  });
  it('drops the run if the engine cuts out', () => {
    const run = new RollingRun({ spec: red });
    run.update(0.1, { rpm: 2000, power: 1, running: true });
    const events = run.update(0.1, { rpm: 0, power: 0, running: false });
    expect(events).toEqual([{ type: 'stalled' }]);
    expect(run.active).toBe(false);
    expect(run.result).toBeNull();
    expect(run.throttle).toBe(0);
  });
  it('reports its progress from 0 to 1', () => {
    const run = new RollingRun({ spec: red });
    expect(run.progress).toBe(0);
    const seen = [];
    while (run.active) {
      run.update(0.1, { rpm: 3000, power: 1, running: true });
      seen.push(run.progress);
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(run.progress).toBe(1);
  });
});

describe('the result', () => {
  it('takes the highest point as the peak and thins the curve', () => {
    const points = Array.from({ length: 40 }, (_, i) => ({ rpm: 1000 + i * 100, bhp: 10 - Math.abs(i - 25) * 0.2 }));
    const r = runResult({ stockBhp: 10 }, points);
    expect(r.bhp).toBe(10);
    expect(r.rpm).toBe(3500);
    expect(r.curve.length).toBeLessThanOrEqual(16);
    expect(r.diff).toBe(0);
  });
  it('says which way it stands against stock', () => {
    expect(verdictOf(0.2)).toBe('stock');
    expect(verdictOf(-0.5)).toBe('stock');
    expect(verdictOf(0.6)).toBe('up');
    expect(verdictOf(-0.6)).toBe('down');
  });
});

describe('which days', () => {
  it('has one on the first day', () => {
    expect(isRoadDay(1, 123)).toBe(true);
  });
  it('has one in each week after, on a day dealt from the farm', () => {
    for (const seed of [1, 99, 123456]) {
      for (let block = 1; block < 12; block++) {
        let n = 0;
        for (let d = 1 + block * P.everyDays; d < 1 + (block + 1) * P.everyDays; d++) if (isRoadDay(d, seed)) n++;
        expect(n).toBe(1);
      }
    }
  });
  it('is the same every time it is asked, and differs between farms', () => {
    const days = (seed) => Array.from({ length: 60 }, (_, i) => i + 1).filter((d) => isRoadDay(d, seed)).join();
    expect(days(5)).toBe(days(5));
    expect(new Set([1, 2, 3, 4, 5, 6].map(days)).size).toBeGreaterThan(1);
  });
  it('can be turned off', () => {
    expect(isRoadDay(1, 5, { ...P, everyDays: 0 })).toBe(false);
    expect(daysToRoadDay(3, 5, { ...P, everyDays: 0 })).toBeNull();
  });
  it('counts the days to the next', () => {
    const d = daysToRoadDay(2, 77);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(isRoadDay(2 + d, 77)).toBe(true);
    for (let i = 0; i < d; i++) expect(isRoadDay(2 + i, 77)).toBe(false);
  });
  it('keeps the tuner between the hours', () => {
    expect(roadOpen(8)).toBe(false);
    expect(roadOpen(12)).toBe(true);
    expect(roadOpen(18)).toBe(false);
  });
});

describe('paying', () => {
  it('takes the price from the tin and says how short you are', () => {
    expect(whyNotPay(15)).toBeNull();
    expect(whyNotPay(100)).toBeNull();
    expect(whyNotPay(9)).toBe('You are £6 short');
  });
});

describe('sitting on the rollers', () => {
  const cradle = { x: 10, z: 20, yaw: Math.PI / 2, halfAcross: 0.8, halfAlong: 0.9 };
  it('needs the quad over them, still and square on', () => {
    const r = onRollers({ x: 10.2, z: 20.1, yaw: Math.PI / 2 + 0.1, speed: 0 }, cradle);
    expect(r).toMatchObject({ in: true, still: true, square: true });
  });
  it('accepts it facing either way along the trailer', () => {
    expect(onRollers({ x: 10, z: 20, yaw: -Math.PI / 2, speed: 0 }, cradle).square).toBe(true);
  });
  it('refuses one off to the side, crosswise or rolling', () => {
    expect(onRollers({ x: 10, z: 22, yaw: Math.PI / 2, speed: 0 }, cradle).in).toBe(false);
    expect(onRollers({ x: 10, z: 20, yaw: 0, speed: 0 }, cradle).square).toBe(false);
    expect(onRollers({ x: 10, z: 20, yaw: Math.PI / 2, speed: 3 }, cradle).still).toBe(false);
  });
});

describe('why a run will not start', () => {
  const ok = { spec: red, onCradle: true, running: true, purse: 100, busy: false };
  it('starts when all is well', () => {
    expect(whyNotRun(ok)).toBeNull();
  });
  it('says what is missing, in the order you would fix it', () => {
    expect(whyNotRun({ ...ok, busy: true })).toBe('A run is on');
    expect(whyNotRun({ ...ok, onCradle: false })).toBe('Ride a quad onto the rollers first');
    expect(whyNotRun({ ...ok, spec: {} })).toBe('She can only strap down a quad');
    expect(whyNotRun({ ...ok, running: false })).toBe("Start the quad's engine first");
    expect(whyNotRun({ ...ok, purse: 3 })).toBe('You are £12 short');
  });
});

describe('what the farm keeps', () => {
  const result = (bhp) => ({ bhp, rpm: 4800, torque: 20, diff: 0, curve: [{ rpm: 3000, bhp: bhp - 3 }, { rpm: 4800, bhp }] });
  it('keeps the latest runs of each quad', () => {
    const log = new RoadLog({ ...P, keptRuns: 3 });
    for (let i = 0; i < 5; i++) log.add('farm300', i + 1, result(10 + i));
    expect(log.runs.farm300.map((r) => r.day)).toEqual([3, 4, 5]);
    expect(log.last('farm300').bhp).toBe(14);
    expect(log.before('farm300').bhp).toBe(13);
  });
  it('knows the strongest quad by its latest run', () => {
    const log = new RoadLog();
    expect(log.strongest()).toBeNull();
    log.add('farm300', 1, result(18));
    log.add('bruin', 1, result(26));
    log.add('bruin', 2, result(15));
    expect(log.strongest()).toBe('farm300');
  });
  it('orders quads by when they were last run', () => {
    const log = new RoadLog();
    log.add('farm300', 3, result(18));
    log.add('bruin', 1, result(26));
    expect(log.ids()).toEqual(['bruin', 'farm300']);
  });
  it('saves and loads, and shrugs off rubbish', () => {
    const log = new RoadLog();
    log.add('farm300', 1, result(18));
    const copy = new RoadLog();
    copy.restore(JSON.parse(JSON.stringify(log.toJSON())));
    expect(copy.toJSON()).toEqual(log.toJSON());
    copy.restore(undefined);
    expect(copy.runs).toEqual({});
    copy.restore({ farm300: 'no', bruin: [null, { day: 'x' }, { day: 2, bhp: 9, rpm: 4000 }] });
    expect(copy.runs.farm300).toBeUndefined();
    expect(copy.runs.bruin).toHaveLength(1);
    expect(copy.runs.bruin[0].curve).toEqual([]);
  });
});

describe('the slip', () => {
  it('prints the figures and where they stand', () => {
    const lines = slipLines('the red quad', { bhp: 19.4, rpm: 4800, torque: 21, stock: 18, diff: 1.4, verdict: 'up' });
    expect(lines[0]).toBe('the red quad');
    expect(lines[1]).toBe('19.4 bhp at 4,800 rpm');
    expect(lines[3]).toBe('Stock is 18 bhp: +1.4');
  });
  it('says so when it is on stock, and compares with last time', () => {
    const lines = slipLines('the red quad', { bhp: 18, rpm: 4800, torque: 20, stock: 18, diff: 0, verdict: 'stock' }, { bhp: 16.5 });
    expect(lines[3]).toBe('Stock is 18 bhp: right on it');
    expect(lines[4]).toBe('Up 1.5 on last time');
  });
});
