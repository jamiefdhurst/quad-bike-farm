import { describe, it, expect } from 'vitest';
import { buildHood, lowerHood, faceGap, tartan, HOOD } from '../src/npc/hood.js';

const head = { top: 1.6, x: 0, z: 0.01, width: 0.16, depth: 0.19 };
const collar = { y: 1.38, radius: 0.09, x: 0, z: 0 };

describe('the hood', () => {
  it('closes over her forehead and opens round her face and below her chin', () => {
    const cy = head.top - HOOD.centreDrop;
    expect(faceGap(cy + HOOD.faceTop + 0.02, cy)).toBe(0);
    expect(faceGap(cy, cy)).toBeGreaterThan(0.9);
    expect(faceGap(cy - 0.2, cy)).toBeCloseTo(HOOD.neckHalf, 2);
  });

  it('clears her head all round, comes down to inside the collar, and leaves her face open', () => {
    const h = buildHood(head, collar);
    const wax = h.points.filter((_, i) => h.kind[i] === 'wax');
    expect(Math.max(...wax.map((p) => p[1]))).toBeGreaterThan(head.top + 0.02);
    const bottom = Math.min(...wax.map((p) => p[1]));
    expect(bottom).toBeCloseTo(collar.y, 3);
    // Round her head at her eyes' height, nothing in front of her face.
    const eye = head.top - 0.09;
    const ring = wax.filter((p) => Math.abs(p[1] - eye) < 0.012);
    expect(ring.length).toBeGreaterThan(10);
    for (const p of ring) {
      expect(Math.hypot(p[0] - head.x, (p[2] - head.z) * (head.width / head.depth))).toBeGreaterThan(head.width / 2);
      expect(Math.atan2(Math.abs(p[0]), p[2] - head.z)).toBeGreaterThan(0.8);
    }
    // The lining is inside the wax.
    const lining = h.points.filter((_, i) => h.kind[i] === 'lining');
    expect(lining.length).toBe(wax.length);
    expect(h.tris.every((t) => t.every((i) => i >= 0 && i < h.points.length))).toBe(true);
  });

  it('pushed back, lies on her back behind the collar and below it, never inside the coat', () => {
    const h = buildHood(head, collar);
    const backAt = () => -0.13;
    const d = lowerHood(h, [0, collar.y, -collar.radius], backAt);
    for (const p of d.points) {
      expect(p[2]).toBeLessThan(-0.13);
      expect(p[2]).toBeGreaterThan(-0.13 - 0.12);
      expect(p[1]).toBeLessThan(collar.y + 0.12);
    }
  });

  it('has a tartan lining of a few colours', () => {
    const seen = new Set();
    for (let u = 0; u < 1; u += 0.01) for (let v = 0; v < 1; v += 0.05) seen.add(tartan([u, v]).join());
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

describe('hair under the hood', () => {
  it('pulls hair standing out or hanging below inside it, and leaves hair already inside alone', async () => {
    const { hoodShape, intoHood } = await import('../src/npc/hood.js');
    const shape = hoodShape(head, collar);
    const inside = [0, head.top - 0.08, 0];
    expect(intoHood(inside, shape)).toEqual(inside);
    const out = intoHood([0.2, head.top - 0.08, -0.05], shape);
    expect(out[0]).toBeLessThan(0.2);
    const low = intoHood([0, collar.y - 0.08, -0.07], shape);
    expect(low[1]).toBeGreaterThan(collar.y);
    // Moved points are inside: moving them again leaves them where they are.
    for (const q of [out, low]) {
      const again = intoHood(q, shape);
      for (let k = 0; k < 3; k++) expect(again[k]).toBeCloseTo(q[k], 6);
    }
  });
});
