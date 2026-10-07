import { describe, it, expect } from 'vitest';
import { GroundWear, DEFAULT_WEAR_PARAMS } from '../src/world/groundWear.js';

// A quad crossing the same spot: four wheels, 2 m of each inside the grid's reach, per pass.
const pass = (g, x, z, wet = 0, n = 1) => {
  for (let k = 0; k < n; k++) for (let w = 0; w < 4; w++) g.trample(x, z, 2, { wet });
};
const fresh = (o = {}) => new GroundWear({ half: 80, ...o });

describe('ground wear', () => {
  it('starts as untouched grass', () => {
    const g = fresh();
    expect(g.wearAt(10, 10)).toBe(0);
    expect(g.softAt(10, 10)).toBe(0);
    expect(g.bogAt(10, 10, 1)).toBe(0);
  });

  it('wears where wheels roll, more with wheelspin, more when wet, and not where nothing moves', () => {
    const g = fresh();
    g.trample(5, 5, 2);
    const rolled = g.wearAt(5, 5);
    expect(rolled).toBeGreaterThan(0);
    const spun = fresh();
    spun.trample(5, 5, 2, { spin: 4, dt: 1 });
    expect(spun.wearAt(5, 5)).toBeGreaterThan(rolled);
    const wetter = fresh();
    wetter.trample(5, 5, 2, { wet: 1 });
    expect(wetter.wearAt(5, 5)).toBeCloseTo(rolled * (1 + DEFAULT_WEAR_PARAMS.wetWear), 4);
    const still = fresh();
    still.trample(5, 5, 0);
    expect(still.wearAt(5, 5)).toBe(0);
  });

  it('goes soft after a couple of dozen passes, not after one', () => {
    const g = fresh();
    pass(g, 20, -10);
    expect(g.softAt(20, -10)).toBe(0);
    pass(g, 20, -10, 0, 30);
    expect(g.softAt(20, -10)).toBeGreaterThan(0.5);
  });

  it('makes a bog only where it is worn and wet, and a dry spell takes it away', () => {
    const g = fresh();
    pass(g, 20, -10, 0.6, 40);
    expect(g.wearAt(20, -10)).toBeGreaterThan(0.9);
    expect(g.bogAt(20, -10, 0)).toBe(0); // as dry as a bone: soft, but nothing to sink in
    expect(g.bogAt(20, -10, 0.6)).toBeGreaterThan(0.9);
    // Rain swells it...
    const wetter = g.bogAt(20, -10, 1);
    expect(wetter).toBeGreaterThanOrEqual(g.bogAt(20, -10, 0.3));
    // ...and a long dry spell shrinks it (the ground dries before the grass grows back).
    expect(g.bogAt(20, -10, 0.3)).toBeLessThan(g.bogAt(20, -10, 0.6));
  });

  it('a lightly worn patch never makes a bog, even in the rain', () => {
    const g = fresh();
    pass(g, 20, -10, 0, 12);
    expect(g.bogAt(20, -10, 1)).toBe(0);
  });

  it('grows back, much more slowly in the rain than in the dry', () => {
    const dry = fresh();
    const rain = fresh();
    pass(dry, 0, 0, 0, 20);
    pass(rain, 0, 0, 0, 20);
    const before = dry.wearAt(0, 0);
    for (let i = 0; i < 300; i++) {
      dry.update(1, 0);
      rain.update(1, 1);
    }
    expect(dry.wearAt(0, 0)).toBeLessThan(before * 0.6);
    expect(rain.wearAt(0, 0)).toBeGreaterThan(dry.wearAt(0, 0) + 0.1);
    for (let i = 0; i < 1200; i++) dry.update(1, 0);
    expect(dry.wearAt(0, 0)).toBe(0);
  });

  it('leaves exempt ground and anywhere off the grid alone', () => {
    const g = fresh({ exempt: (x) => x < 0 });
    pass(g, -10, 0, 0, 30);
    expect(g.wearAt(-10, 0)).toBe(0);
    pass(g, 500, 500, 0, 30);
    expect(g.wearAt(500, 500)).toBe(0);
    g.trample(79.9, 79.9, 2); // the corner is fine
    expect(g.wearAt(500, 0)).toBe(0);
  });

  it('packs the soft and bog amounts for the shader, and lists the bogs for the girls to avoid', () => {
    const g = fresh();
    pass(g, 20, -10, 0.6, 40);
    g.pack(0.6);
    const idx = (x, z) => (Math.round((x + g.half) / g.cell - 0.5) * g.n + Math.round((z + g.half) / g.cell - 0.5)) * 4;
    expect(g.data[idx(20, -10)]).toBe(255);
    expect(g.data[idx(20, -10) + 1]).toBeGreaterThan(200);
    expect(g.data[idx(-40, 30)]).toBe(0);
    const h = g.hazards(0.6);
    expect(h.length).toBeGreaterThan(0);
    expect(h.every((b) => Math.hypot(b.x - 20, b.z + 10) < 6)).toBe(true);
    expect(g.hazards(0)).toHaveLength(0);
  });

  it('repacks twice a second after a change, not every frame', () => {
    const g = fresh();
    g.trample(0, 0, 2);
    g.update(0.1, 0);
    expect(g.packed).toBeUndefined();
    g.update(0.5, 0);
    expect(g.packed).toBe(true);
  });
});
