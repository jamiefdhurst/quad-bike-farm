import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { popPropensity, runOnChance } from '../src/engine/runOn.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';

const P = DEFAULT_ENGINE_PARAMS;
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (params = {}, seed = 5) => new EngineModel(params, { random: seeded(seed) });

function start(e) {
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
}

/** Revs it up, then shuts the throttle and counts pops over the overrun. */
function pops(e, { wear = 0, seconds = 3 } = {}) {
  start(e);
  e.wear = wear;
  for (let t = 0; t < 4; t += 0.05) e.update(0.05, { throttle: 1 });
  let n = 0;
  for (let t = 0; t < seconds; t += 0.05) {
    // The wheels turn it over as the quad slows, so the revs come down over a second or two rather than at once.
    e.update(0.05, { throttle: 0, overrunRpm: Math.max(0, 5000 * (1 - t / seconds)) });
    n += e.events.filter((x) => x.type === 'overrunPop').length;
  }
  return n;
}

describe('popping on the overrun', () => {
  it('only pops with the throttle shut at speed', () => {
    const e = make({ strokes: 2, popProne: 0.7 });
    start(e);
    let n = 0;
    for (let t = 0; t < 4; t += 0.05) {
      e.update(0.05, { throttle: 1 });
      n += e.events.filter((x) => x.type === 'overrunPop').length;
    }
    expect(n).toBe(0);
    const idle = make({ strokes: 2, popProne: 0.7 });
    start(idle);
    for (let t = 0; t < 10; t += 0.05) {
      idle.update(0.05, { throttle: 0 });
      n += idle.events.filter((x) => x.type === 'overrunPop').length;
    }
    expect(n).toBe(0);
  });

  it('crackles a lot on a two-stroke, rarely on a healthy four-stroke, and more as it wears', () => {
    const yellow = QUAD_SPECS.find((q) => q.id === 'yellow').engine;
    const two = pops(make(yellow));
    const four = pops(make());
    const worn = pops(make(), { wear: 0.8 });
    expect(two).toBeGreaterThan(5);
    expect(four).toBeLessThan(two / 3);
    expect(worn).toBeGreaterThan(four + 1);
  });

  it('is more likely when lean or hot', () => {
    const base = { lean: 0, wear: 0, heat: 0 };
    expect(popPropensity({ ...base, lean: 0.5 }, P)).toBeGreaterThan(popPropensity(base, P));
    expect(popPropensity({ ...base, heat: 1 }, P)).toBeGreaterThan(popPropensity(base, P));
  });

  it('is set for the two-strokes and the others are left at the default', () => {
    for (const s of QUAD_SPECS) expect(s.engine?.popProne ?? P.popProne).toBe(s.engine?.strokes === 2 ? 0.7 : P.popProne);
  });
});

describe('running on after switching off', () => {
  const shutOff = (e) => {
    const events = [];
    e.setIgnition(false);
    let beats = 0;
    for (let t = 0; t < 6; t += 1 / 60) {
      e.update(1 / 60, {});
      events.push(...e.events.map((x) => x.type));
      beats += e.pulses.length;
    }
    return { events, beats };
  };

  it('does not on a healthy, cool engine: it stops at once', () => {
    const e = make();
    start(e);
    e.setIgnition(false);
    expect(e.state).toBe('off');
    expect(e.keyOff).toBe(false);
  });

  it('chugs on for a few beats when it is hot and worn, then dies with one shutdown', () => {
    const cases = [];
    for (let seed = 1; seed <= 12; seed++) {
      const e = make({}, seed);
      start(e);
      e.soak = 1;
      e.wear = 0.7;
      e.setIgnition(false);
      cases.push(e);
    }
    const ran = cases.filter((e) => e.keyOff);
    expect(ran.length).toBeGreaterThan(4);
    for (const e of ran) {
      expect(e.isRunning).toBe(true);
      expect(e.ignitionOn).toBe(false);
      expect(e.hasPower).toBe(false);
      const { events } = shutOff2(e);
      expect(events.filter((x) => x === 'shutdown')).toHaveLength(1);
      expect(e.state).toBe('off');
      expect(e.keyOff).toBe(false);
    }
  });

  it('goes on longer the worse it is', () => {
    const cycles = (wear) => {
      let total = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const e = make({}, seed);
        start(e);
        e.soak = 1;
        e.wear = wear;
        e.setIgnition(false);
        if (e.keyOff) total += e.runOnLeft;
      }
      return total;
    };
    expect(cycles(0.9)).toBeGreaterThan(cycles(0.2));
  });

  it('carries on if switched back on while running on', () => {
    for (let seed = 1; seed < 40; seed++) {
      const e = make({}, seed);
      start(e);
      e.soak = 1;
      e.wear = 0.9;
      e.setIgnition(false);
      if (!e.keyOff) continue;
      e.setIgnition(true);
      expect(e.keyOff).toBe(false);
      expect(e.ignitionOn).toBe(true);
      for (let t = 0; t < 3; t += 0.05) e.update(0.05, {});
      expect(e.isRunning).toBe(true);
      return;
    }
    throw new Error('never ran on');
  });

  it('has the chance rise with heat, wear and leanness', () => {
    const base = { soak: 0, heat: 0, wear: 0, lean: 0 };
    expect(runOnChance(base, P)).toBe(0);
    expect(runOnChance({ ...base, soak: 1 }, P)).toBeGreaterThan(0.4);
    expect(runOnChance({ ...base, wear: 1 }, P)).toBeGreaterThan(0.4);
    expect(runOnChance({ ...base, lean: 1 }, P)).toBeGreaterThan(0.4);
    expect(runOnChance({ soak: 1, heat: 1, wear: 1, lean: 1 }, P)).toBeLessThanOrEqual(0.9);
  });
});

function shutOff2(e) {
  const events = [];
  for (let t = 0; t < 8; t += 1 / 60) {
    e.update(1 / 60, {});
    events.push(...e.events.map((x) => x.type));
  }
  return { events };
}
