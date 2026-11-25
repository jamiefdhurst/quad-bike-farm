import { describe, it, expect } from 'vitest';
import { Wind, DEFAULT_WIND_PARAMS as P, WIND_PARAM_RANGES } from '../src/world/wind.js';
import { createRandom } from '../src/core/random.js';

const run = (w, seconds, scale = 1) => {
  let gusts = 0;
  for (let t = 0; t < seconds; t += 0.1) if (w.update(0.1, scale)) gusts++;
  return gusts;
};

describe('Wind', () => {
  it('blows the way the day says and keeps the old drift at a scale of 1 with no gust', () => {
    const w = new Wind(createRandom(1), Math.PI / 2, { ...P, gustiness: 0, veer: 0 });
    run(w, 5);
    expect(w.x).toBeCloseTo(P.drift, 5);
    expect(Math.abs(w.z)).toBeLessThan(1e-6);
  });

  it('comes in gusts that rise and die away, and a calm day has none worth the name', () => {
    const w = new Wind(createRandom(2), 0);
    expect(run(w, 600)).toBeGreaterThan(20);
    w.blowGust();
    w.update(1, 1);
    const up = w.strength;
    w.update(3.9, 1);
    expect(up).toBeGreaterThan(1);
    expect(w.gust).toBeLessThan(0.3);
    const calm = new Wind(createRandom(2), 0);
    run(calm, 60, 0);
    expect(calm.strength).toBe(0);
    expect(Math.hypot(calm.x, calm.z)).toBe(0);
  });

  it('a steady wind (gustiness 0) never changes strength', () => {
    const w = new Wind(createRandom(3), 1, { ...P, gustiness: 0 });
    for (let i = 0; i < 300; i++) {
      w.update(0.1, 1.5);
      expect(w.strength).toBeCloseTo(1.5, 6);
    }
  });

  it('veers only a little round the day heading', () => {
    const w = new Wind(createRandom(4), 2);
    for (let i = 0; i < 6000; i++) {
      w.update(0.1, 1);
      expect(Math.abs(w.heading - 2)).toBeLessThanOrEqual(P.veer + 1e-6);
    }
  });

  it('measures the wind along a heading', () => {
    const w = new Wind(createRandom(5), Math.PI / 2, { ...P, gustiness: 0, veer: 0 });
    run(w, 2);
    expect(w.along(Math.PI / 2)).toBeCloseTo(1, 5);
    expect(w.along(-Math.PI / 2)).toBeCloseTo(-1, 5);
    expect(Math.abs(w.along(0))).toBeLessThan(1e-6);
  });

  it('has a range for every param', () => {
    for (const k of Object.keys(P)) expect(WIND_PARAM_RANGES[k], k).toBeDefined();
  });
});
