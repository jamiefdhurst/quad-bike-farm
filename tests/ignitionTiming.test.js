import { describe, it, expect } from 'vitest';
import { DEFAULT_TIMING_PARAMS as T, idealAdvance, kickBackChance, startFactor, timingError, timingPower, retardHeat, retardPop } from '../src/engine/ignitionTiming.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const bantam = { ...DEFAULT_ENGINE_PARAMS, strokes: 2, pullStart: true, noStarter: true, manualTiming: true, kickStart: true };

describe('ignition timing', () => {
  it('wants more advance as the revs rise', () => {
    expect(idealAdvance(0, 1500, 6000)).toBe(T.startAdvance);
    expect(idealAdvance(1500, 1500, 6000)).toBeCloseTo(T.idleAdvance);
    expect(idealAdvance(6000, 1500, 6000)).toBeCloseTo(T.topAdvance);
  });
  it('kicks back only when advanced', () => {
    expect(kickBackChance(0, T)).toBe(0);
    expect(kickBackChance(T.kickAbove, T)).toBe(0);
    expect(kickBackChance(1, T)).toBeCloseTo(T.kickMax);
  });
  it('starts best near the starting setting', () => {
    expect(startFactor(T.startAdvance)).toBe(1);
    expect(startFactor(1)).toBe(0);
    expect(startFactor(0)).toBeGreaterThan(0);
  });
  it('is right at the ideal and loses power either side', () => {
    expect(timingPower(timingError(0.3, 1500, 1500, 6000))).toBe(1);
    const retarded = timingError(0, 6000, 1500, 6000);
    const advanced = timingError(1, 1500, 1500, 6000);
    expect(retarded).toBeLessThan(0);
    expect(advanced).toBeGreaterThan(0);
    expect(timingPower(retarded)).toBeLessThan(0.8);
    expect(retardHeat(retarded)).toBeGreaterThan(0);
    expect(retardHeat(advanced)).toBe(0);
    expect(retardPop(advanced)).toBe(0);
    expect(retardPop(retarded)).toBeGreaterThan(0);
  });
});

describe('a manual-timing engine', () => {
  const make = (advance, rnd = () => 0.01) => {
    const e = new EngineModel(bantam, { random: rnd });
    e.advance = advance;
    e.setIgnition(true);
    return e;
  };
  it('kicks back when kicked with the lever advanced', () => {
    const e = make(1);
    expect(e.pull(0.6)).toBe(0);
    expect(e.kicked).toBeGreaterThan(0);
  });
  it('turns over when retarded', () => {
    const e = make(0.2);
    expect(e.pull(0.6)).toBe(1);
    expect(e.kicked).toBe(0);
  });
  it('an ordinary engine ignores the lever', () => {
    const e = new EngineModel({ ...bantam, manualTiming: false }, { random: () => 0.01 });
    e.advance = 1;
    e.setIgnition(true);
    expect(e.pull(0.6)).toBe(1);
  });
});
