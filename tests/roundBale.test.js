import { describe, it, expect } from 'vitest';
import { roundBaleGeometry } from '../src/world/props.js';

describe('roundBaleGeometry', () => {
  const R = 0.75;
  const W = 1.2;
  const geo = roundBaleGeometry(R, W);
  geo.computeBoundingBox();

  it('keeps the collider\'s length and never swells past its radius by much', () => {
    expect(geo.boundingBox.max.y).toBeCloseTo(W / 2, 5);
    expect(geo.boundingBox.min.y).toBeCloseTo(-W / 2, 5);
    expect(geo.boundingBox.max.x).toBeLessThan(R * 1.03);
    expect(geo.boundingBox.max.x).toBeGreaterThan(R);
  });

  it('rounds the rim: the end rings are narrower than the middle', () => {
    const pos = geo.attributes.position;
    let endR = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i)) > W / 2 - 1e-6) endR = Math.max(endR, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(endR).toBeLessThan(R * 0.9);
  });

  it('keeps three material groups for side and ends', () => {
    expect(geo.groups.length).toBe(3);
  });
});

describe('squareBaleGeometry', () => {
  it('keeps the bale\'s size and bulges only a little', async () => {
    const { squareBaleGeometry } = await import('../src/world/squareBale.js');
    const geo = squareBaleGeometry(0.9, 0.36, 0.46);
    geo.computeBoundingBox();
    expect(geo.boundingBox.max.x).toBeCloseTo(0.45, 5);
    expect(geo.boundingBox.max.y).toBeGreaterThan(0.18);
    expect(geo.boundingBox.max.y).toBeLessThan(0.18 * 1.04);
    expect(geo.boundingBox.max.z).toBeLessThan(0.23 * 1.04);
  });
});
