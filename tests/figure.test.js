import { describe, it, expect } from 'vitest';
import { figureOffset } from '../src/npc/figure.js';

// Roughly where the shipped model's left bust apex sits, in body-frame units.
const APEX = { x: 0.11, y: 0.725, z: 0.35 };
const FULL = { bust: 1, waist: 1, hips: 1 };

function grid(fn) {
  for (let x = -0.5; x <= 0.5; x += 0.05) {
    for (let y = -0.6; y <= 1.3; y += 0.05) {
      for (let z = -0.3; z <= 0.5; z += 0.05) fn(x, y, z);
    }
  }
}

describe('figure', () => {
  it('leaves the body alone at zero', () => {
    grid((x, y, z) => expect(figureOffset(x, y, z, APEX, { bust: 0, waist: 0, hips: 0 })).toEqual([0, 0, 0]));
  });

  it('is symmetric left to right', () => {
    grid((x, y, z) => {
      const [lx, ly, lz] = figureOffset(x, y, z, APEX, FULL);
      const [rx, ry, rz] = figureOffset(-x, y, z, APEX, FULL);
      expect(rx).toBeCloseTo(-lx, 9);
      expect(ry).toBeCloseTo(ly, 9);
      expect(rz).toBeCloseTo(lz, 9);
    });
  });

  it('does not touch the head or the legs below the hips', () => {
    for (const y of [1.1, 1.3, -0.5, -1.5]) {
      expect(figureOffset(0.1, y, 0.1, APEX, FULL)).toEqual([0, 0, 0]);
    }
  });

  it('pushes the bust forward, pulls the waist in and widens the hips', () => {
    expect(figureOffset(APEX.x, APEX.y, APEX.z, APEX, FULL)[2]).toBeGreaterThan(0.05);
    expect(figureOffset(0.28, 0.37, 0.05, APEX, FULL)[0]).toBeLessThan(0);
    expect(figureOffset(0.35, -0.15, 0.05, APEX, FULL)[0]).toBeGreaterThan(0);
  });

  it('has no jumps, so the mesh never tears', () => {
    // A tiny move never shifts the offset by more than a few times as much.
    const step = 0.0005;
    grid((x, y, z) => {
      const a = figureOffset(x, y, z, APEX, FULL);
      for (const [ex, ey, ez] of [
        [step, 0, 0],
        [0, step, 0],
        [0, 0, step],
      ]) {
        const b = figureOffset(x + ex, y + ey, z + ez, APEX, FULL);
        for (let k = 0; k < 3; k++) expect(Math.abs(b[k] - a[k])).toBeLessThan(step * 4);
      }
    });
  });
});
