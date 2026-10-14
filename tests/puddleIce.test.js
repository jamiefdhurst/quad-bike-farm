import { describe, it, expect } from 'vitest';
import { PuddleIce, DEFAULT_PUDDLE_ICE_PARAMS, freezeTarget } from '../src/world/puddleIce.js';
import { surfaceGrip } from '../src/vehicle/traction.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';

const make = () => new PuddleIce([{ x: 0, z: 0 }, { x: 20, z: 0 }], 1.7, { ...DEFAULT_PUDDLE_ICE_PARAMS });

describe('puddle ice', () => {
  it('freezes below freezing, harder the colder, and not above', () => {
    const p = DEFAULT_PUDDLE_ICE_PARAMS;
    expect(freezeTarget(p, 3)).toBe(0);
    expect(freezeTarget(p, -1.5)).toBeCloseTo(0.5);
    expect(freezeTarget(p, -8)).toBe(1);
  });

  it('grows over time in a frost and melts when it warms', () => {
    const ice = make();
    for (let i = 0; i < 60; i++) ice.update(1, -4);
    expect(ice.thickness[0]).toBe(1);
    expect(ice.coverAt(0, 0)).toBe(1);
    expect(ice.coverAt(5, 5)).toBe(0);
    for (let i = 0; i < 200; i++) ice.update(1, 6);
    expect(ice.thickness[0]).toBe(0);
    expect(ice.coverAt(0, 0)).toBe(0);
  });

  it('starts as a cold night would have left it', () => {
    const ice = make();
    ice.settle(-6);
    expect(ice.isIce(0)).toBe(true);
    ice.settle(5);
    expect(ice.isIce(0)).toBe(false);
  });

  it('a wheel loads it until it cracks and then breaks, and open water stays open for a while', () => {
    const ice = make();
    ice.settle(-6);
    const seen = [];
    for (let i = 0; i < 400 && !seen.includes('break'); i++) {
      const hit = ice.load(0, 0, 900, 5, 0.05);
      if (hit) seen.push(hit);
    }
    expect(seen).toEqual(['crack', 'break']);
    expect(ice.take().map((e) => e.type)).toEqual(['crack', 'break']);
    expect(ice.isIce(0)).toBe(false);
    expect(ice.isIce(1)).toBe(true); // the other puddle is untouched
    ice.update(10, -6);
    expect(ice.isIce(0)).toBe(false);
    ice.update(DEFAULT_PUDDLE_ICE_PARAMS.openSeconds + 100, -6);
    expect(ice.isIce(0)).toBe(true);
  });

  it('thin ice and fast wheels go sooner than thick ice and slow ones', () => {
    const breakTime = (temp, speed) => {
      const ice = make();
      ice.settle(temp);
      let t = 0;
      while (ice.load(0, 0, 900, speed, 0.05) !== 'break' && t < 100) t += 0.05;
      return t;
    };
    expect(breakTime(-1.5, 4)).toBeLessThan(breakTime(-6, 4));
    expect(breakTime(-6, 10)).toBeLessThan(breakTime(-6, 1));
  });

  it('ignores a wheel off the ice or with no load', () => {
    const ice = make();
    ice.settle(-6);
    expect(ice.load(10, 10, 900, 5, 1)).toBe(null);
    expect(ice.load(0, 0, 0, 5, 1)).toBe(null);
    expect(ice.damage[0]).toBe(0);
  });

  it('grips like glass compared with the puddle it covers', () => {
    expect(DEFAULT_PUDDLE_ICE_PARAMS.gripSlip).toBeLessThan(surfaceGrip(DEFAULT_VEHICLE_PARAMS, 0, 1));
  });
});
