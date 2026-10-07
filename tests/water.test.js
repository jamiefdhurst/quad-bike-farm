import { describe, it, expect } from 'vitest';
import { EngineModel, EngineState } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { waterGulp, stepWater, waterCatchFactor } from '../src/engine/water.js';

const P = DEFAULT_ENGINE_PARAMS;
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function running(seed = 3) {
  const e = new EngineModel({}, { random: seeded(seed) });
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  return e;
}

/** Crosses a puddle (0.25 s at that depth and speed) and returns the water it took in. */
function cross(speed, puddle = 1) {
  let w = 0;
  for (let t = 0; t < 0.25; t += 0.05) w = stepWater(w, 0.05, { gulp: waterGulp(puddle, speed, P), running: true }, P);
  return w;
}

describe('gulping water', () => {
  it('takes in nothing wading slowly, or through a shallow edge', () => {
    expect(waterGulp(1, 2, P)).toBe(0);
    expect(waterGulp(0.3, 12, P)).toBe(0);
  });
  it('takes in more the faster and deeper it goes', () => {
    expect(waterGulp(1, 10, P)).toBeGreaterThan(waterGulp(1, 6, P));
    expect(waterGulp(1, 8, P)).toBeGreaterThan(waterGulp(0.6, 8, P));
  });
  it('is only a splutter at a steady pace across and a lot at a fast pace', () => {
    expect(cross(5)).toBeLessThan(0.3);
    expect(cross(11)).toBeGreaterThan(0.6);
  });
  it('drains over time, faster running with the throttle open', () => {
    const off = stepWater(0.5, 10, { running: false }, P);
    const run = stepWater(0.5, 10, { running: true, throttle: 0 }, P);
    const open = stepWater(0.5, 10, { running: true, throttle: 1 }, P);
    expect(off).toBeLessThan(0.5);
    expect(open).toBeLessThan(run);
    expect(stepWater(0.01, 100, { running: false }, P)).toBe(0);
  });
  it('only lets it catch when it has nearly dried', () => {
    expect(waterCatchFactor(0, P)).toBe(1);
    expect(waterCatchFactor(P.waterNoStart, P)).toBe(0);
  });
});

describe('a drowned engine', () => {
  it('stalls when it has swallowed plenty', () => {
    let stalled = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const e = running(seed);
      for (let t = 0; t < 1.5; t += 0.05) e.update(0.05, { throttle: 0.3, gulp: 6 });
      if (e.state === EngineState.STALLED) {
        stalled++;
        expect(e.lastStallReason).toBe('water');
      }
    }
    expect(stalled).toBeGreaterThanOrEqual(8);
  });
  it('runs rougher and weaker while it has water in it', () => {
    const wet = running();
    const dry = running();
    wet.water = 0.5;
    wet.update(0.05, { throttle: 0.3 });
    dry.update(0.05, { throttle: 0.3 });
    expect(wet.roughness).toBeGreaterThan(dry.roughness);
    expect(wet.power).toBeLessThan(dry.power);
  });
  it('won\'t restart until it has drained, then does', () => {
    const e = running();
    e.water = 0.8;
    e.stall('water');
    e.setIgnition(false);
    const crank = (secs) => {
      e.setIgnition(true);
      for (let t = 0; t < secs && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
      return e.isRunning;
    };
    expect(crank(4)).toBe(false);
    // Left alone, it dries out.
    e.setIgnition(false);
    for (let t = 0; t < 60; t += 0.5) e.update(0.5);
    expect(e.water).toBe(0);
    expect(crank(10)).toBe(true);
  });
});

describe('small puddles', () => {
  it('never stall a quad, and a steady pace through a deep one stays well short of stalling', () => {
    expect(cross(12, 0.5)).toBe(0);
    expect(cross(6, 1)).toBeLessThan(P.waterStallAt / 2);
    expect(cross(10, 1)).toBeGreaterThan(P.waterStallAt);
  });
});
