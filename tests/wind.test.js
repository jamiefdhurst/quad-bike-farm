import { describe, it, expect } from 'vitest';
import { Wind, Shutter, DEFAULT_WIND_PARAMS as P, WIND_PARAM_RANGES } from '../src/world/wind.js';
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

  it('blows hay out only in a strong gust blowing out of the door, and not again for a while', () => {
    const w = new Wind(createRandom(6), Math.PI / 2, { ...P, gustiness: 0, veer: 0 });
    run(w, 2, 1);
    expect(w.hayBlows(Math.PI / 2)).toBe(false); // ordinary wind
    run(w, 2, 2);
    expect(w.hayBlows(-Math.PI / 2)).toBe(false); // blowing into the door
    expect(w.hayBlows(Math.PI / 2)).toBe(true);
    expect(w.hayBlows(Math.PI / 2)).toBe(false); // too soon
    run(w, P.hayEvery + 1, 2);
    expect(w.hayBlows(Math.PI / 2)).toBe(true);
  });

  it('has a range for every param', () => {
    for (const k of Object.keys(P)) expect(WIND_PARAM_RANGES[k], k).toBeDefined();
  });
});

describe('Shutter', () => {
  const swing = (s, push, seconds) => {
    const bangs = [];
    for (let t = 0; t < seconds; t += 0.02) {
      const b = s.update(0.02, push(t));
      if (b) bangs.push(b);
    }
    return bangs;
  };

  it('stays shut in a light breeze and when the wind blows into the door', () => {
    const s = new Shutter();
    expect(swing(s, () => 0.4, 20)).toEqual([]);
    expect(s.angle).toBe(0);
    expect(swing(s, () => -3, 20)).toEqual([]);
    expect(s.angle).toBe(0);
  });

  it('swings open in a strong wind out of the door and stays within its range', () => {
    const s = new Shutter();
    let max = 0;
    for (let t = 0; t < 10; t += 0.02) {
      s.update(0.02, 2.5);
      max = Math.max(max, s.angle);
      expect(s.angle).toBeGreaterThanOrEqual(0);
      expect(s.angle).toBeLessThanOrEqual(P.shutterOpen);
    }
    expect(max).toBeGreaterThan(0.8);
  });

  it('bangs shut when a gust drops away after throwing it open', () => {
    const s = new Shutter();
    const bangs = swing(s, (t) => (t < 1.5 ? 3 : 0), 12);
    expect(bangs.length).toBeGreaterThan(0);
    for (const b of bangs) {
      expect(b.strength).toBeGreaterThan(0);
      expect(b.strength).toBeLessThanOrEqual(1);
    }
    expect(s.angle).toBeLessThan(0.05); // and it settles shut
  });
});
