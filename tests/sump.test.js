import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { sumpLube } from '../src/engine/lubrication.js';
import { Sump, DEFAULT_SUMP_PARAMS as P, hasSump, pickBurner, startLevel, oilLowLamp, readStick } from '../src/vehicle/sump.js';
import { createRandom } from '../src/core/random.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const fourStroke = () => new EngineModel({}, { random: seeded(7) });

/** Runs a four-stroke at the given sump level: returns the engine after `seconds`, or as soon as it seizes. */
function ride(sump, seconds, { throttle = 0.9, driveLoad = 0.5 } = {}) {
  const e = fourStroke();
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 12 && !e.isRunning; t += 1 / 60) e.update(1 / 60, { starter: true, choke: 0.5, sump });
  for (let t = 0; t < seconds && !e.seized; t += 1 / 60) {
    e.update(1 / 60, { throttle: e.isRunning ? throttle : 0, driveLoad, sump });
    if (e.state === 'stalled' && !e.seized) e.update(1 / 60, { starter: true, sump });
  }
  return e;
}

describe('which vehicles have a sump', () => {
  it('is the petrol four-strokes only', () => {
    expect(hasSump({ strokes: 4 })).toBe(true);
    expect(hasSump({})).toBe(true);
    expect(hasSump({ strokes: 2 })).toBe(false);
    expect(hasSump({ runsOnDiesel: true })).toBe(false);
    expect(hasSump({ strokes: 4, tractor: true })).toBe(false);
  });
  it('picks one burner from the seed, or none with no four-strokes', () => {
    const ids = ['red', 'blue', 'green', 'loan'];
    const picked = new Set();
    for (let s = 1; s < 60; s++) picked.add(pickBurner(ids, createRandom(s)));
    expect(picked.size).toBeGreaterThan(1);
    expect([...picked].every((id) => ids.includes(id))).toBe(true);
    expect(pickBurner(ids, createRandom(5))).toBe(pickBurner(ids, createRandom(5)));
    expect(pickBurner([], createRandom(5))).toBeNull();
  });
  it('deals the burner a lower start than the rest', () => {
    for (let s = 1; s < 30; s++) {
      const b = startLevel(true, createRandom(s));
      const n = startLevel(false, createRandom(s));
      expect(b).toBeGreaterThanOrEqual(P.burnerLow);
      expect(b).toBeLessThanOrEqual(P.burnerHigh);
      expect(n).toBeGreaterThanOrEqual(P.normalLow);
      expect(n).toBeLessThanOrEqual(P.normalHigh);
    }
  });
});

describe('the sump level', () => {
  it('only drops while the engine runs, and far faster on the burner', () => {
    const burner = new Sump({ level: 0.8, burner: true });
    const other = new Sump({ level: 0.8 });
    burner.step(100, { running: false, work: 1 });
    expect(burner.level).toBe(0.8);
    for (let i = 0; i < 600; i++) {
      burner.step(1, { running: true, work: 0.6 });
      other.step(1, { running: true, work: 0.6 });
    }
    expect(burner.level).toBeLessThan(0.45);
    expect(other.level).toBeGreaterThan(0.78);
  });
  it('a burner left to run goes from half-full to starved in about a quarter of an hour of riding', () => {
    const s = new Sump({ level: 0.5, burner: true });
    let t = 0;
    while (s.level > 0.25 && t < 7200) {
      s.step(1, { running: true, work: 0.5 });
      t++;
    }
    expect(t).toBeGreaterThan(300);
    expect(t).toBeLessThan(900);
  });
  it('tops up from a bottle to the top mark and no further', () => {
    const s = new Sump({ level: 0.3 });
    expect(s.low).toBe(false);
    const low = new Sump({ level: 0.2 });
    expect(low.low).toBe(true);
    let took = 0;
    for (let i = 0; i < 100; i++) took += low.pour(1);
    expect(low.level).toBe(1);
    expect(took).toBeCloseTo(0.8, 5);
    expect(low.pour(1)).toBe(0);
  });
  it('the burner smokes on the overrun only, and the rest never do', () => {
    const b = new Sump({ level: 0.6, burner: true });
    expect(b.burnSmoke(0, 3000)).toBeGreaterThan(0.5);
    expect(b.burnSmoke(0.8, 3000)).toBe(0);
    expect(b.burnSmoke(0, 0)).toBe(0);
    expect(new Sump({ level: 0.6 }).burnSmoke(0, 3000)).toBe(0);
    expect(new Sump({ level: 0, burner: true }).burnSmoke(0, 3000)).toBe(0);
  });
});

describe('the dipstick and the lamp', () => {
  it('reads in words and never lies by more than a little', () => {
    expect(readStick(1).text).toBe('Up to the top mark');
    expect(readStick(0.6).text).toBe('Between the marks');
    expect(readStick(0.32).text).toBe('On the bottom mark: it wants some');
    expect(readStick(0.25).text).toBe('Just below the bottom mark');
    expect(readStick(0.1).text).toBe('Well below the bottom mark');
    expect(readStick(0).text).toBe('Nothing on the stick at all');
    expect(Math.abs(readStick(0.5, 1).reading - 0.5)).toBeLessThanOrEqual(P.readNoise + 1e-9);
  });
  it('lights the OIL lamp only when it is running low, flickering at idle', () => {
    const base = { running: true, rpm: 1500, idleRpm: 1500, t: 0 };
    expect(oilLowLamp({ ...base, level: 0.6 })).toBe(false);
    expect(oilLowLamp({ ...base, level: 0.1, running: false })).toBe(false);
    const idle = [];
    for (let t = 0; t < 4; t += 0.05) idle.push(oilLowLamp({ ...base, level: 0.1, t }));
    expect(idle.includes(true) && idle.includes(false)).toBe(true);
    expect(oilLowLamp({ ...base, level: 0.15, rpm: 4000 })).toBe(false); // revved, it goes out unless it's very low
    expect(oilLowLamp({ ...base, level: 0.05, rpm: 4000 })).toBe(true);
  });
});

describe('a four-stroke on a low sump', () => {
  const ok = DEFAULT_ENGINE_PARAMS.sumpOkLevel;
  it('is fully lubricated from the okay level, starved below it', () => {
    expect(sumpLube(1, ok)).toBe(1);
    expect(sumpLube(ok, ok)).toBe(1);
    expect(sumpLube(ok / 2, ok)).toBeCloseTo(0.5);
    expect(sumpLube(0, ok)).toBe(0);
  });
  it('runs for good on a middling sump', () => {
    const e = ride(0.5, 600);
    expect(e.seized).toBe(false);
    expect(e.scuff).toBe(0);
    expect(e.tick).toBe(0);
  });
  it('ticks as the level drops under the mark, with a rougher engine', () => {
    const full = ride(0.9, 5);
    const low = ride(0.15, 5);
    expect(full.tick).toBe(0);
    expect(low.tick).toBeGreaterThan(0.2);
    expect(low.roughness).toBeGreaterThan(full.roughness);
  });
  it('knocks, then seizes if run dry, taking minutes rather than seconds', () => {
    const e = ride(0, 600);
    expect(e.seized).toBe(true);
    const e2 = ride(0, 20);
    expect(e2.seized).toBe(false);
    expect(e2.scuff).toBeGreaterThan(0);
    const knock = ride(0, 60);
    expect(knock.nip).toBeGreaterThan(0);
  });
  it('can be stripped down and freed once it has seized', () => {
    const e = ride(0, 600);
    expect(e.seized).toBe(true);
    expect(e.freeSeized()).toBe(true);
    expect(e.seized).toBe(false);
  });
  it('a two-stroke ignores the sump and the tractor is left alone', () => {
    const two = new EngineModel({ strokes: 2 }, { random: seeded(3) });
    two.setTemperature(1);
    two.setIgnition(true);
    for (let t = 0; t < 120; t += 1 / 60) two.update(1 / 60, { starter: !two.isRunning, throttle: 0.9, driveLoad: 0.5, oil: 0.02, sump: 0 });
    expect(two.scuff).toBe(0);
    const diesel = new EngineModel({ runsOnDiesel: true }, { random: seeded(3) });
    diesel.update(1 / 60, { sump: 0 });
    expect(diesel.tick).toBe(0);
  });
  it('passes the burner\'s smoke on to the exhaust', () => {
    const e = fourStroke();
    e.update(1 / 60, { oilBurn: 0.7 });
    expect(e.oilBurn).toBeCloseTo(0.7);
    expect(e.oilRich).toBe(0);
  });
});
