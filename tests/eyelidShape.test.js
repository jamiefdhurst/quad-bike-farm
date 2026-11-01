import { describe, it, expect } from 'vitest';
import { fitPlane, eyeOf, isEye, lidAt, LID } from '../src/npc/eyelidShape.js';

// A painted oval on a face that slopes away to the side (z falls 0.5 for each unit of x).
const oval = (cx = 0.12, cy = 0.38, hw = 0.035, hh = 0.042) => {
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = cx + Math.cos(a) * hw;
    const y = cy + Math.sin(a) * hh;
    pts.push([x, y, 0.3 - 0.5 * x - 0.1 * y]);
  }
  return pts;
};
const brow = () => [0.1, 0.14, 0.18, 0.2].flatMap((x) => [[x, 0.44, 0.2], [x, 0.455, 0.2]]);

describe('fitPlane', () => {
  it('finds the plane through points on it', () => {
    const p = fitPlane(oval());
    expect(p.b).toBeCloseTo(-0.5, 6);
    expect(p.c).toBeCloseTo(-0.1, 6);
    expect(p.a).toBeCloseTo(0.3, 6);
  });
  it('gives up on points in a line', () => {
    expect(fitPlane([[0, 0, 0], [1, 1, 1], [2, 2, 2]])).toBeNull();
  });
});

describe('an eye', () => {
  it('is round and tall, where a brow is a thin wide stroke', () => {
    expect(isEye(oval())).toBe(true);
    expect(isEye(brow())).toBe(false);
  });
  it('knows its middle and size', () => {
    const e = eyeOf(oval());
    expect(e.x).toBeCloseTo(0.12, 3);
    expect(e.hh).toBeCloseTo(0.042, 2);
  });
});

describe('lidAt', () => {
  const eye = eyeOf(oval());
  const ys = (l) => l.positions.map((p) => p[1]);

  it('has the same vertices and triangles at any lid, so only their places change', () => {
    const [a, b] = [lidAt(eye, 0), lidAt(eye, 1)];
    expect(a.positions.length).toBe(b.positions.length);
    expect(a.index).toEqual(b.index);
  });

  it('open, is a sliver tucked at the top of the eye with no area to show', () => {
    const l = lidAt(eye, 0);
    expect(Math.max(...ys(l)) - Math.min(...ys(l))).toBeLessThan(1e-9);
    expect(Math.min(...ys(l))).toBeGreaterThan(eye.y + eye.hh);
  });

  it('shut, covers the whole painted eye, to its lowest edge', () => {
    const l = lidAt(eye, 1);
    expect(Math.max(...ys(l))).toBeGreaterThan(eye.y + eye.hh);
    expect(Math.min(...ys(l))).toBeLessThanOrEqual(eye.y - eye.hh);
    // The middle row spans the eye's width.
    const mid = l.positions.filter((p) => Math.abs(p[1] - eye.y) < eye.hh * 0.2);
    const xs = mid.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(eye.hw * 2);
  });

  it('comes down smoothly: the more shut, the lower its edge', () => {
    const edge = (s) => Math.min(...ys(lidAt(eye, s)));
    expect(edge(0.25)).toBeGreaterThan(edge(0.5));
    expect(edge(0.5)).toBeGreaterThan(edge(0.75));
    expect(edge(0.75)).toBeGreaterThan(edge(1));
  });

  it('lies on the face, off it by more than the painted eye stands proud, and rounds out when shut', () => {
    const l = lidAt(eye, 1);
    const above = l.positions.map((p) => p[2] - (eye.plane.a + eye.plane.b * p[0] + eye.plane.c * p[1]));
    expect(Math.min(...above)).toBeGreaterThanOrEqual(eye.proud + LID.out - 1e-9);
    expect(Math.max(...above)).toBeGreaterThan(eye.proud + LID.out + LID.dome * 0.5);
  });

  it('squeezed, lifts the cheek under the eye without going lower', () => {
    const shut = lidAt(eye, 1);
    const squeezed = lidAt(eye, LID.reach + 0.25);
    expect(Math.min(...ys(squeezed))).toBeCloseTo(Math.min(...ys(shut)), 9);
    const lower = (l) => Math.max(...l.positions.filter((p) => p[1] < eye.y - eye.hh * 0.4).map((p) => p[2]));
    expect(lower(squeezed)).toBeGreaterThan(lower(shut));
  });

  it('ends in a lash line: the last row alone is dark', () => {
    const l = lidAt(eye, 1);
    expect(l.lash.filter(Boolean).length).toBe(LID.columns);
    expect(l.lash.slice(-LID.columns).every(Boolean)).toBe(true);
  });
});
