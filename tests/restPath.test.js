import { describe, it, expect } from 'vitest';
import { pathAt } from '../src/npc/restPath.js';

// The hut's steps and bunk: she goes from where she stood through the `via` points to her seat.
describe('the way up to a raised seat', () => {
  const points = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 0 }, { x: 4, y: 3, z: 0 }]; // 3 m up, then 4 m across
  it('runs from the first point to the last by length', () => {
    expect(pathAt(points, 0)).toMatchObject({ x: 0, y: 0, z: 0, climbing: true });
    expect(pathAt(points, 1)).toMatchObject({ x: 4, y: 3, z: 0, climbing: false });
    const half = pathAt(points, 0.5); // 3.5 m of 7: on the second leg, half a metre along it
    expect(half.y).toBeCloseTo(3, 9);
    expect(half.x).toBeCloseTo(0.5, 9);
  });
  it('is climbing until the last leg, and holds k inside 0 to 1', () => {
    expect(pathAt(points, 0.2).climbing).toBe(true);
    expect(pathAt(points, 0.9).climbing).toBe(false);
    expect(pathAt(points, -1)).toMatchObject({ x: 0, y: 0 });
    expect(pathAt(points, 2)).toMatchObject({ x: 4, y: 3 });
  });
});
