import { describe, it, expect } from 'vitest';
import { DEFAULT_TIMING_PARAMS as T, idealAdvance, kickBackChance, startFactor, timingError, timingPower, retardHeat, retardPop } from '../src/engine/ignitionTiming.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { PLOVER_SPEC } from '../src/vehicle/quadSpecs.js';

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

describe('the tickler', () => {
  const tick = { ...bantam, tickler: true };
  const make = () => new EngineModel(tick, { random: () => 0.5 });
  it('does nothing on an engine without one', () => {
    const e = new EngineModel(bantam, { random: () => 0.5 });
    expect(e.tickle()).toBe(false);
    expect(e.tickled).toBe(0);
  });
  it('enriches the mixture, and drains away standing', () => {
    const e = make();
    e.update(0.02, {});
    const before = e.mixture;
    expect(e.tickle()).toBe(true);
    e.update(0.02, {});
    expect(e.mixture).toBeGreaterThan(before);
    for (let i = 0; i < 4000; i++) e.update(0.02, {});
    expect(e.tickled).toBe(0);
  });
  it('floods the plug when it is pressed too many times', () => {
    const e = make();
    e.setIgnition(true);
    for (let i = 0; i < 6; i++) e.tickle();
    expect(e.tickled).toBeGreaterThan(tick.tickleFloodAbove);
    const before = e.fouling;
    for (let i = 0; i < 100; i++) e.update(0.02, {});
    expect(e.fouling).toBeGreaterThan(before);
  });
  it('a kick-back flings the pedal and bangs', () => {
    const e = new EngineModel(tick, { random: () => 0.01 });
    e.advance = 1;
    e.setIgnition(true);
    e.pull(0.6);
    e.update(0.01, {});
    expect(e.events.map((v) => v.type)).toEqual(expect.arrayContaining(['kickBack', 'backfire']));
  });
});

describe('starting the old bike the old way', () => {
  const { engine: eng } = PLOVER_SPEC;
  const seeded = (seed) => { let n = seed; return () => ((n = (n * 16807) % 2147483647) / 2147483647); };
  // Cold, with the ignition on, the lever and the tickler set as given, kicked `kicks` times: how many of `trials` bikes caught.
  function run({ advance, tickles, choke = 0, kicks = 6 }, trials = 120) {
    let caught = 0;
    let kickedBack = 0;
    let flooded = 0;
    for (let t = 0; t < trials; t++) {
      const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...eng, idleRpmWarm: eng.idleRpmWarm }, { random: seeded(t + 1) });
      e.advance = advance;
      e.setIgnition(true);
      for (let i = 0; i < tickles; i++) e.tickle();
      let got = false;
      for (let k = 0; k < kicks && !got; k++) {
        e.pull(0.6);
        if (e.kicked > 0) kickedBack++;
        for (let i = 0; i < 90 && !got; i++) {
          e.update(0.02, { choke, fuel: 1 });
          if (e.isRunning) got = true;
        }
      }
      if (got) caught++;
      if (e.fouling > 0.5) flooded++;
    }
    return { caught: caught / trials, kickedBack: kickedBack / trials, flooded: flooded / trials };
  }
  it('catches when retarded with a tickle or two, within a few kicks', () => {
    expect(run({ advance: 0.2, tickles: 2 }).caught).toBeGreaterThan(0.85);
  });
  it('kicks back, and mostly fails to start, with the lever fully advanced', () => {
    const r = run({ advance: 1, tickles: 2 });
    expect(r.kickedBack).toBeGreaterThan(2);
    expect(r.caught).toBeLessThan(run({ advance: 0.2, tickles: 2 }).caught);
  });
  it('is much harder to start cold with no tickle and no choke than with one', () => {
    expect(run({ advance: 0.2, tickles: 0 }).caught).toBeLessThan(run({ advance: 0.2, tickles: 2 }).caught);
  });
  it('floods with too much tickling', () => {
    const r = run({ advance: 0.2, tickles: 6 });
    expect(r.flooded).toBeGreaterThan(0.5);
    expect(r.caught).toBeLessThan(run({ advance: 0.2, tickles: 2 }).caught);
  });
});

describe('the debug panel’s readouts', () => {
  it('list the spark lever only for an engine that has one', async () => {
    const { engineReadouts } = await import('../src/debug/vehicleDebug.js');
    const keys = (params) => engineReadouts(new EngineModel(params, { random: () => 0.5 })).map((r) => r.key);
    expect(keys({ ...DEFAULT_ENGINE_PARAMS, ...PLOVER_SPEC.engine })).toEqual(expect.arrayContaining(['sparkLever', 'timingError', 'kickedBack']));
    expect(keys({ ...DEFAULT_ENGINE_PARAMS })).not.toContain('sparkLever');
  });
});
