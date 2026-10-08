import { describe, it, expect } from 'vitest';
import { surfaceFeel, DEFAULT_SURFACE_PARAMS as S } from '../src/world/surfaces.js';
import { squealLevel, slipAngle, DEFAULT_SQUEAL_PARAMS as Q } from '../src/vehicle/tyreSqueal.js';

describe('how the ground feels', () => {
  it('leaves grass as it was', () => {
    expect(surfaceFeel(S, 0, 0, 0)).toEqual({ grip: 1, roll: 1 });
    expect(surfaceFeel(S, 0, 0, 1)).toEqual({ grip: 1, roll: 1 });
  });

  it('grips harder and rolls easier on tarmac, wet or dry', () => {
    const dry = surfaceFeel(S, 1, 0, 0);
    const wet = surfaceFeel(S, 1, 0, 1);
    expect(dry.grip).toBeGreaterThan(1.2);
    expect(wet.grip).toBeGreaterThan(1);
    expect(wet.grip).toBeLessThan(dry.grip);
    expect(dry.roll).toBeLessThan(0.7);
  });

  it('makes dry stubble quick, gripping like grass, and greasier than grass in the wet', () => {
    const dry = surfaceFeel(S, 0, 1, 0);
    expect(dry.grip).toBe(1);
    expect(dry.roll).toBeLessThan(1);
    expect(surfaceFeel(S, 0, 1, 1).grip).toBeLessThan(1);
  });
});

describe('tyre squeal', () => {
  const at = (o) => squealLevel(Q, { tarmac: 1, slip: 0, speed: 10, brake: 0, spin: 0, ...o });

  it('is quiet rolling straight, and off the tarmac whatever happens', () => {
    expect(at({})).toBe(0);
    expect(at({ tarmac: 0, slip: 0.5, brake: 1, spin: 1 })).toBe(0);
  });

  it('squeals sliding through a corner, braking hard and spinning up', () => {
    expect(at({ slip: 0.4 })).toBe(1);
    expect(at({ slip: 0.15 })).toBeGreaterThan(0);
    expect(at({ slip: 0.15 })).toBeLessThan(1);
    expect(at({ brake: 1 })).toBeCloseTo(Q.brakeLevel);
    expect(at({ brake: 0.4 })).toBe(0);
    expect(at({ spin: 1, speed: 0 })).toBe(1);
  });

  it('needs some speed for a slide', () => {
    expect(at({ slip: 0.4, speed: 1 })).toBe(0);
    expect(slipAngle(10, 0)).toBe(0);
    expect(slipAngle(-10, 10)).toBeCloseTo(Math.PI / 4);
  });
});
