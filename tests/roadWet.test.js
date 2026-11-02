import { describe, it, expect } from 'vitest';
import { RoadWet, tarmacMask, DEFAULT_ROAD_WET_PARAMS as P } from '../src/world/roadWet.js';

const run = (w, seconds, ctx) => {
  for (let t = 0; t < seconds; t++) w.update(1, ctx);
  return w.value;
};

describe('wet tarmac', () => {
  it('soaks in the rain within about half a minute, and not at all in a dry spell', () => {
    expect(run(new RoadWet(), 30, { rain: 1 })).toBe(1);
    expect(run(new RoadWet(), 30, { rain: 0 })).toBe(0);
    expect(run(new RoadWet(), 10, { rain: 0.3 })).toBeLessThan(0.2);
  });

  it('dries slowly under cloud, faster in sun and wind', () => {
    const cloud = run(new RoadWet({ wet: 1 }), 200, { sun: 0, wind: 0 });
    const sunny = run(new RoadWet({ wet: 1 }), 200, { sun: 1, wind: 0 });
    const breezy = run(new RoadWet({ wet: 1 }), 200, { sun: 1, wind: 1 });
    expect(cloud).toBeGreaterThan(0.6);
    expect(sunny).toBeLessThan(cloud);
    expect(breezy).toBeLessThan(sunny);
    expect(run(new RoadWet({ wet: 1 }), 500, { sun: 1, wind: 1 })).toBe(0);
  });

  it('dries more slowly in the cold', () => {
    const warm = run(new RoadWet({ wet: 1 }), 200, { sun: 1, temperature: 15 });
    const cold = run(new RoadWet({ wet: 1 }), 200, { sun: 1, temperature: 0 });
    expect(cold).toBeGreaterThan(warm);
    expect(P.dryTime).toBeGreaterThan(0);
  });

  it('is set and held between 0 and 1', () => {
    const w = new RoadWet();
    w.set(3);
    expect(w.value).toBe(1);
    w.set(-1);
    expect(w.value).toBe(0);
  });
});

describe('the tarmac mask', () => {
  it('marks the road and nothing else, with the road where it should be', () => {
    const m = tarmacMask((x, z) => (Math.abs(z) < 2 ? 1 : 0), 20, 1);
    expect(m.n).toBe(20);
    expect(m.data[10 * 20 + 3]).toBe(255); // z = 0.5
    expect(m.data[3 * 20 + 3]).toBe(0); // z = -6.5
    expect(m.minX).toBe(-10);
  });

  it('keeps a soft edge as a part value', () => {
    const m = tarmacMask(() => 0.5, 4, 1);
    expect(m.data[0]).toBe(128);
  });
});
