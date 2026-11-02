import { describe, it, expect } from 'vitest';
import { GrassTracks, DEFAULT_TRACKS_PARAMS, TRACKS_PARAM_RANGES } from '../src/world/grassTracks.js';

const RECT = { minX: 100, maxX: 132, minZ: -26, maxZ: -8 };
const mk = (over = {}) => new GrassTracks({ rect: RECT, params: { ...DEFAULT_TRACKS_PARAMS, ...over } });
// A wheel rolling along +x on row z at 3 m/s.
const roll = (t, z, { from = 105, to = 120, speed = 3 } = {}) => {
  for (let x = from; x <= to; x += 0.05) t.press(x, z, speed);
};

describe('pressing the grass', () => {
  it('starts standing', () => {
    const t = mk();
    expect(t.live).toBe(0);
    expect(t.at(110, -15)).toBe(0);
    expect(t.describe()).toMatch(/standing/);
  });

  it('flattens a line the width of the tyre and no more', () => {
    const t = mk();
    roll(t, -15);
    expect(t.at(112, -15)).toBeCloseTo(1, 1);
    expect(t.at(112, -14.5)).toBe(0);
    expect(t.at(112, -15.5)).toBe(0);
    expect(t.at(103, -15)).toBe(0);
    expect(t.at(125, -15)).toBe(0);
  });

  it('leaves no gaps in a line, wherever the wheel falls between grid points', () => {
    for (const z of [-15, -14.93, -14.87, -14.8]) {
      const t = mk();
      roll(t, z, { speed: 12 });
      for (let x = 106; x < 119; x += 0.05) expect(t.at(x, z)).toBeGreaterThan(0.5);
    }
  });

  it('is left alone by a wheel that is barely moving', () => {
    const t = mk();
    t.press(110, -15, DEFAULT_TRACKS_PARAMS.minSpeed - 0.01);
    expect(t.live).toBe(0);
  });

  it('ignores a wheel off the patch', () => {
    const t = mk();
    t.press(50, 40, 5);
    t.press(131.9, -7.9, 5);
    expect(t.at(50, 40)).toBe(0);
    expect(() => t.press(-1000, 1000, 5)).not.toThrow();
  });

  it('presses harder than it springs back: a second pass does not deepen it', () => {
    const t = mk();
    roll(t, -15);
    const before = Array.from(t.flat);
    roll(t, -15);
    expect(Array.from(t.flat)).toEqual(before);
  });
});

describe('springing back', () => {
  it('lifts the oldest end first and is gone after springSeconds', () => {
    const t = mk({ springSeconds: 100 });
    roll(t, -15);
    t.update(50);
    expect(t.at(112, -15)).toBeCloseTo(0.5, 1);
    t.press(112.125, -14.875, 3); // a cell's middle
    expect(t.at(112.125, -14.875)).toBeCloseTo(1, 5); // freshly pressed again
    expect(t.at(108.125, -14.875)).toBeLessThan(0.55); // an older bit is still half up
    t.update(60);
    expect(t.at(108.125, -14.875)).toBe(0);
    expect(t.at(112.125, -14.875)).toBeCloseTo(0.4, 1);
    t.update(60);
    expect(t.live).toBe(0);
    expect(t.describe()).toMatch(/standing/);
  });

  it('costs nothing when nobody has ridden the grass', () => {
    const t = mk();
    t.dirty = false;
    expect(t.update(1)).toBe(false);
    expect(t.dirty).toBe(false);
  });

  it('says it wants redrawing only when something changed', () => {
    const t = mk();
    t.dirty = false;
    t.press(110, -15, 3);
    expect(t.dirty).toBe(true);
    t.dirty = false;
    t.press(110, -15, 3); // the same spot, already flat
    expect(t.dirty).toBe(false);
  });

  it('can be lifted all at once', () => {
    const t = mk();
    roll(t, -15);
    t.clear();
    expect(t.live).toBe(0);
    expect(t.at(112, -15)).toBe(0);
  });
});

describe('the tunables', () => {
  it('have a range each, holding the default', () => {
    for (const [k, v] of Object.entries(DEFAULT_TRACKS_PARAMS)) {
      const [lo, hi] = TRACKS_PARAM_RANGES[k];
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    }
  });
});
