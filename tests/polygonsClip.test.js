import { describe, it, expect } from 'vitest';
import { intersectPolygons, triangulate, isConvex, joinPieces, polygonArea, pointInPolygon } from '../src/world/polygons.js';

// The clip the new farm's fields are cut to the outline with (#681): any two simple polygons, notches and all.
const area = (polys) => polys.reduce((s, p) => s + polygonArea(p), 0);
const square = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
// An L: a 10 by 10 square with its south-east quarter gone.
const ell = [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]];

describe('isConvex and triangulate', () => {
  it('tells a notch from a straight run', () => {
    expect(isConvex(square(0, 0, 4, 4))).toBe(true);
    expect(isConvex([[0, 0], [2, 0], [4, 0], [4, 4], [0, 4]])).toBe(true);
    expect(isConvex(ell)).toBe(false);
  });
  it('cuts a polygon into n - 2 triangles that add up to it', () => {
    const tris = triangulate(ell);
    expect(tris).toHaveLength(4);
    expect(area(tris)).toBeCloseTo(75, 9);
    for (const t of tris) expect(polygonArea(t)).toBeGreaterThan(0);
  });
});

describe('intersectPolygons', () => {
  it('cuts two squares to their overlap', () => {
    const [p] = intersectPolygons(square(0, 0, 10, 10), square(5, 5, 15, 15));
    expect(polygonArea(p)).toBeCloseTo(25, 9);
  });
  it('keeps a shape inside the other whole, and gives nothing where they miss', () => {
    expect(area(intersectPolygons(square(2, 2, 4, 4), ell))).toBeCloseTo(4, 9);
    expect(intersectPolygons(square(6, 6, 9, 9), ell)).toEqual([]);
  });
  it('cuts by a clip with a notch in it, as one piece', () => {
    const parts = intersectPolygons(square(-5, -5, 8, 8), ell);
    expect(parts).toHaveLength(1);
    expect(polygonArea(parts[0])).toBeCloseTo(8 * 8 - 3 * 3, 9);
    expect(pointInPolygon(parts[0], 6.5, 6.5)).toBe(false);
  });
  it('cuts a subject with a notch, either way round', () => {
    expect(area(intersectPolygons(ell, square(3, 3, 12, 12)))).toBeCloseTo(7 * 2 + 2 * 5, 9);
    expect(area(intersectPolygons(square(3, 3, 12, 12), ell))).toBeCloseTo(area(intersectPolygons(ell, square(3, 3, 12, 12))), 9);
  });
  it('is fine with sides lying along each other and corners on the other\'s sides', () => {
    // The outline's east side runs along the fields' east sides, and field lines run through its corners.
    const outline = [[0, 2], [5, 0], [10, 2], [10, 10], [0, 10]];
    const west = square(-1, -1, 5, 11);
    const east = square(5, -1, 10, 11);
    const parts = [...intersectPolygons(outline, west), ...intersectPolygons(outline, east)];
    expect(parts).toHaveLength(2);
    expect(area(parts)).toBeCloseTo(polygonArea(outline), 9);
  });
  it('gives two pieces where the overlap is in two', () => {
    const u = [[0, 0], [3, 0], [3, 8], [7, 8], [7, 0], [10, 0], [10, 10], [0, 10]];
    const parts = intersectPolygons(u, square(-1, 2, 11, 6));
    expect(parts).toHaveLength(2);
    expect(area(parts)).toBeCloseTo(2 * 3 * 4, 9);
  });
});

describe('joinPieces', () => {
  it('joins pieces that share a side cut differently on each', () => {
    const left = [[0, 0], [5, 0], [5, 10], [0, 10]];
    const right = [[5, 0], [10, 0], [10, 10], [5, 10], [5, 4]]; // its west side has an extra corner at (5, 4)
    const joined = joinPieces([left, right]);
    expect(joined).toHaveLength(1);
    expect(joined[0]).toHaveLength(4);
    expect(polygonArea(joined[0])).toBeCloseTo(100, 9);
  });
});
