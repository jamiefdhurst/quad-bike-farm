import { describe, it, expect } from 'vitest';
import { figureOffset, bustSurface } from '../src/npc/figure.js';

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
    // A tiny move never shifts the offset by more than some times as much, at two sizes of move: a jump would not shrink with the
    // move. (The fold under her bust is steep, as a round underside is, so the bound is looser than it was for the old push.)
    for (const step of [0.0005, 0.00005]) {
      grid((x, y, z) => {
        const a = figureOffset(x, y, z, APEX, FULL);
        for (const [ex, ey, ez] of [
          [step, 0, 0],
          [0, step, 0],
          [0, 0, step],
        ]) {
          const b = figureOffset(x + ex, y + ey, z + ez, APEX, FULL);
          for (let k = 0; k < 3; k++) expect(Math.abs(b[k] - a[k])).toBeLessThan(step * 12);
        }
      });
    }
  });
});

describe('a round bust', () => {
  const shaped = (bust, x, y, z) => {
    const [dx, dy, dz] = figureOffset(x, y, z, APEX, { bust, waist: 0, hips: 0 });
    return [x + dx, y + dy, z + dz];
  };

  it('is one curve in its middle, whatever the model was there', () => {
    // The model has one point at each apex and a ring round it, so a push added to her own points kept that cone. Points round the
    // middle of it, wherever they were, now lie on the dome.
    for (const bust of [1, 1.4]) {
      for (const [x, y] of [[APEX.x, APEX.y], [APEX.x + 0.04, APEX.y - 0.03], [APEX.x - 0.02, APEX.y + 0.04]]) {
        for (const z of [APEX.z - 0.05, APEX.z, APEX.z + 0.03]) {
          const [sx, sy, sz] = shaped(bust, x, y, z);
          expect(Math.abs(sz - bustSurface(sx, sy, APEX, bust))).toBeLessThan(0.003);
        }
      }
    }
  });

  it('is rounded at the front, not a point', () => {
    // Down through its front the curve bends gently everywhere: a point (a cone) bends all at once at its tip.
    const h = 0.01;
    for (const bust of [1, 1.4]) {
      const z = (y) => bustSurface(APEX.x + 0.01, y, APEX, bust);
      for (let y = APEX.y - 0.12; y <= APEX.y + 0.08; y += 0.01) {
        expect(Math.abs(z(y + h) - 2 * z(y) + z(y - h))).toBeLessThan(0.006);
      }
    }
  });

  it('does not fold the shelf under it', () => {
    // Down her front through the apex, the model's own profile (a shelf steps in under her bust): shaped, it still runs downwards
    // all the way, so no triangle between these points is turned inside out.
    const profile = [[0.85, 0.27], [0.8, 0.29], [0.76, 0.33], [APEX.y, APEX.z], [0.68, 0.32], [0.65, 0.29], [0.626, 0.23], [0.6, 0.22], [0.55, 0.22], [0.5, 0.22]];
    for (const bust of [1, 1.4]) {
      const ys = profile.map(([y, z]) => shaped(bust, APEX.x, y, z)[1]);
      for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
    }
  });

  it('leaves a dip between them', () => {
    for (const bust of [1, 1.4]) {
      const middle = shaped(bust, 0, APEX.y - 0.02, APEX.z - 0.02)[2];
      const apex = shaped(bust, APEX.x, APEX.y - 0.02, APEX.z)[2];
      expect(middle).toBeLessThan(apex - 0.04);
    }
  });
});

describe('a bigger bust', () => {
  it('covers more of her, wider and deeper, as well as standing out further', () => {
    const at = (bust, x, y, z) => figureOffset(x, y, z, APEX, { bust, waist: 0, hips: 0 });
    // Out towards her side, past where a smaller one reaches, a bigger one's dome still covers her.
    expect(bustSurface(APEX.x + 0.15, APEX.y - 0.04, APEX, 1)).toBe(-Infinity);
    expect(bustSurface(APEX.x + 0.15, APEX.y - 0.04, APEX, 1.5)).toBeGreaterThan(0.1);
    // At the apex it stands out further than in proportion to the amount.
    expect(at(1.5, APEX.x, APEX.y, APEX.z)[2]).toBeGreaterThan(1.5 * at(1, APEX.x, APEX.y, APEX.z)[2]);
  });

  it('is fuller underneath than above, and a bigger one reaches further down', () => {
    const at = (bust, y) => figureOffset(APEX.x, y, APEX.z, APEX, { bust, waist: 0, hips: 0 })[2];
    // The same distance below the apex as above, it stands out further.
    expect(at(1, APEX.y - 0.1)).toBeGreaterThan(at(1, APEX.y + 0.1));
    // Low down, a bigger bust still stands out more than in proportion (its height grows with it).
    const low = APEX.y - 0.17;
    expect(at(1.4, low)).toBeGreaterThan(1.4 * at(1, low));
  });
});

describe('her seat', () => {
  it('turns a flat plate with a shelf under it into round cheeks, and leaves her front alone', async () => {
    const { roundSeat } = await import('../src/npc/figure.js');
    // A block bottom: flat at -0.3 from y 0 down to -0.25, then straight in to -0.1 below it, at a few points across her.
    const pts = [];
    for (const x of [0, 0.13, 0.25]) for (let y = 0.15; y >= -0.45; y -= 0.025) pts.push({ x, y, z: y > -0.26 && y < 0.05 ? -0.3 : -0.1 });
    pts.push({ x: 0.1, y: -0.1, z: 0.3 }); // her front
    const out = roundSeat(pts);
    const at = (x, y) => out[pts.findIndex((q) => q.x === x && Math.abs(q.y - y) < 1e-9)];
    // The plate's bottom edge (the shelf) comes in, so the step under it is smaller and it curves under.
    expect(at(0, -0.25)).toBeGreaterThan(-0.3 + 0.03);
    // Up the plate she stays as full (never further out than she was at her fullest), and just above it she's rounded out.
    expect(at(0.13, -0.1)).toBeLessThan(-0.29);
    expect(at(0.13, 0.075)).toBeLessThan(-0.15);
    // Below the shelf her thighs are left alone.
    expect(at(0.13, -0.4)).toBe(-0.1);
    expect(out[out.length - 1]).toBe(0.3);
  });
});
