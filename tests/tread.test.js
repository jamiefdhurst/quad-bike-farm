import { describe, it, expect } from 'vitest';
import { TREAD_KINDS, carcassProfile, treadBlocks, treadTyre, outerRadius } from '../src/vehicle/detail/tread.js';

const size = { radius: 0.3, width: 0.2, rimR: 0.15 };

describe('tread', () => {
  it.each(Object.keys(TREAD_KINDS))('%s: the tread tops are on the wheel radius, and nothing pokes past the width', (kind) => {
    const geo = treadTyre(kind, size);
    expect(outerRadius(geo)).toBeCloseTo(size.radius, 4);
    geo.computeBoundingBox();
    expect(geo.boundingBox.max.x).toBeLessThan(size.width * 0.58);
    expect(geo.boundingBox.min.x).toBeGreaterThan(-size.width * 0.58);
    expect(geo.index.count / 3).toBeLessThan(4000); // a tyre stays cheap: four of them on a quad
  });

  it('the carcass sits on the rim and stays under the tread', () => {
    for (const kind of Object.keys(TREAD_KINDS)) {
      const prof = carcassProfile(kind, size);
      expect(prof[0][0]).toBeGreaterThan(size.rimR);
      for (const [r] of prof) expect(r).toBeLessThanOrEqual(size.radius + 1e-9);
    }
  });

  it('every kind with blocks lays them round the whole tyre', () => {
    for (const [kind, k] of Object.entries(TREAD_KINDS)) {
      const b = treadBlocks(kind, size);
      if (!k.count) {
        expect(b).toHaveLength(0);
        continue;
      }
      expect(b.length).toBeGreaterThanOrEqual(k.count);
      const ths = b.map((x) => x.th);
      expect(Math.max(...ths) - Math.min(...ths)).toBeGreaterThan(Math.PI * 1.8);
    }
  });

  it('a chevron is two arms meeting on the centre line, mirrored', () => {
    const arms = treadBlocks('atv', size).filter((b) => b.lean === 0 && b.th === 0);
    expect(arms).toHaveLength(2);
    expect(arms[0].x).toBeCloseTo(-arms[1].x);
    expect(arms[0].yaw).toBeCloseTo(-arms[1].yaw);
  });

  it('a tractor lug is much taller than an ATV lug on the same tyre', () => {
    const t = treadBlocks('tractor', size)[0].h;
    const a = treadBlocks('atv', size)[0].h;
    expect(t).toBeGreaterThan(a * 1.8);
  });

  it('rejects a kind it does not know', () => {
    expect(() => treadTyre('slick', size)).toThrow();
  });
});
