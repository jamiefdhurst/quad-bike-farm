import { describe, it, expect } from 'vitest';
import { slapLevel, slapCarry, loosen, fitNewPiston, DEFAULT_SLAP_PARAMS as P } from '../src/engine/pistonSlap.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { rebuildTopEnd } from '../src/engine/topEnd.js';
import { fitBore } from '../src/engine/bigBore.js';
import { DEFAULT_BENCH_PARAMS as B } from '../src/workshop/benchJobs.js';

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A running engine at idle for `seconds`; returns the slaps heard. */
function idle(pistonWear, temperature, seconds = 10) {
  const e = new EngineModel({ initialTemperature: 0.6 }, { random: seeded(3) });
  e.setIgnition(true);
  for (let i = 0; i < 600 && !e.isRunning; i++) e.update(1 / 60, { starter: true, choke: 1 });
  if (!e.isRunning) throw new Error('did not start');
  e.pistonWear = pistonWear;
  e.temperature = temperature;
  let n = 0;
  for (let i = 0; i < seconds * 60; i++) {
    e.update(1 / 60, { throttle: 0, choke: 1 });
    e.temperature = temperature; // hold it, so the test is of the level alone
    n += e.events.filter((x) => x.type === 'slap').length;
  }
  return { n, e };
}

describe('piston slap', () => {
  it('needs a loose piston and a cold engine', () => {
    expect(slapLevel(0.1, 0, P)).toBe(0);
    expect(slapLevel(0.8, 0, P)).toBe(1);
    expect(slapLevel(0.8, 0.7, P)).toBe(0);
    expect(slapLevel(0.55, 0.2, P)).toBeGreaterThan(0);
    expect(slapLevel(0.8, 0.2, P)).toBeLessThan(slapLevel(0.8, 0, P));
  });

  it('carries most at idle and when pulling, least at high revs off the throttle', () => {
    expect(slapCarry(0, 0, P)).toBe(1);
    expect(slapCarry(0.8, 1, P)).toBe(1);
    expect(slapCarry(1, 0, P)).toBeCloseTo(1 - P.slapRevsQuiet);
  });

  it('only loosens, and not past the most wear', () => {
    expect(loosen(0.4, 0.1, 1)).toBeCloseTo(0.5);
    expect(loosen(0.4, -0.2, 1)).toBe(0.4);
    expect(loosen(0.95, 0.2, 1)).toBe(1);
  });

  it('knocks from a worn engine when cold, more with more wear, and not when warm or sound', () => {
    expect(idle(0.9, 0).n).toBeGreaterThan(10);
    expect(idle(0.9, 0).n).toBeGreaterThan(idle(0.45, 0).n);
    expect(idle(0.9, 0.9).n).toBe(0);
    expect(idle(0.05, 0).n).toBe(0);
    expect(idle(0.9, 0).e.slap).toBeGreaterThan(0);
  });

  it('starts from the wear the engine was dealt, then follows it up as it runs', () => {
    const e = new EngineModel({ initialTemperature: 0.5 }, { random: seeded(5) });
    e.wear = 0.6;
    e.setIgnition(true);
    for (let i = 0; i < 600 && !e.isRunning; i++) e.update(1 / 60, { starter: true });
    e.update(1 / 60, {});
    expect(e.pistonWear).toBeGreaterThanOrEqual(0.6);
    const before = e.pistonWear;
    for (let i = 0; i < 600; i++) e.update(1 / 60, {});
    expect(e.pistonWear).toBeGreaterThan(before);
  });

  it('is cured by a new piston, not by a service that clears the wear', () => {
    const e = { wear: 0.7, pistonWear: 0.7, scuff: 0.3, seized: false, overheat: 0, runIn: 0, params: { strokes: 2, wearMax: 1 } };
    e.wear = 0;
    expect(e.pistonWear).toBe(0.7);
    rebuildTopEnd(e, false, B);
    expect(e.pistonWear).toBe(0);
    const f = { wear: 0.7, pistonWear: 0.7, runIn: 0, params: {} };
    fitBore(f, 1, B);
    expect(f.pistonWear).toBe(0);
    const g = { pistonWear: 0.5, params: { slapNewPistonWear: 0.1 } };
    fitNewPiston(g);
    expect(g.pistonWear).toBe(0.1);
  });
});
