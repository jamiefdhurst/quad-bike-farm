import { describe, it, expect } from 'vitest';
import { DEFAULT_LOOSE_PARAMS as P, LOOSE_PARAM_RANGES, newLoose, creepStep, offRack, shuffleStep, tipStep, looseDrive, floorPush, slideStep, slideTip, fallsOut } from '../src/vehicle/looseThings.js';

const fixed = (v) => () => v;
const run = (fn, s, seconds, shake, random = fixed(0.5)) => {
  for (let t = 0; t < seconds; t += 0.1) fn(s, 0.1, shake, P, random);
  return s;
};

describe('loose things on a shaking vehicle', () => {
  it('does nothing under the threshold, and pushes harder the rougher it is', () => {
    expect(looseDrive(0.2, P)).toBe(0);
    const still = run(creepStep, newLoose(fixed(0)), 60, P.shakeFrom);
    expect([still.x, still.z]).toEqual([0, 0]);
    const mild = run(creepStep, newLoose(fixed(0)), 10, 0.6);
    const rough = run(creepStep, newLoose(fixed(0)), 10, 1.2);
    expect(Math.hypot(rough.x, rough.z)).toBeGreaterThan(Math.hypot(mild.x, mild.z) * 2);
  });

  it('a mug walks off the rack in the end, but not in seconds', () => {
    const s = newLoose(fixed(0));
    run(creepStep, s, 5, 1);
    expect(offRack(s, P)).toBe(false);
    run(creepStep, s, 120, 1);
    expect(offRack(s, P)).toBe(true);
  });

  it('a thing in a bed stays within its slack and twist however long it shakes', () => {
    let n = 0;
    const random = () => (n++ % 7) / 7;
    const s = run(shuffleStep, newLoose(random), 300, 2, random);
    expect(Math.abs(s.x)).toBeLessThanOrEqual(P.bedSlack);
    expect(Math.abs(s.z)).toBeLessThanOrEqual(P.bedSlack);
    expect(Math.abs(s.twist)).toBeLessThanOrEqual(P.bedTwist);
  });

  it('a can goes over after a long hard shake only, a lull eases it back, and it stays over', () => {
    const s = newLoose();
    run(tipStep, s, P.tipSeconds - 1, P.tipFrom);
    expect(s.tipped).toBe(false);
    run(tipStep, s, 20, 0.5); // calms
    expect(s.tip).toBeLessThan(P.tipSeconds / 2);
    run(tipStep, s, P.tipSeconds + 1, P.tipFrom);
    expect(s.tipped).toBe(true);
    run(tipStep, s, 60, 0);
    expect(s.tipped).toBe(true);
  });
});

describe('loads that slide', () => {
  const room = { minX: -0.3, maxX: 0.3, minZ: -0.2, maxZ: 0.2 };
  const slide = (s, seconds, push, limits = room) => {
    let hit = 0;
    for (let t = 0; t < seconds; t += 0.05) hit = Math.max(hit, slideStep(s, 0.05, push, limits));
    return hit;
  };

  it('is pushed the opposite way to the vehicle and downhill', () => {
    expect(floorPush({ x: 3, z: -2 })).toEqual({ x: -3, z: 2 });
    expect(floorPush({ x: 0, z: 0 }, { x: 0.5, z: -0.2 })).toEqual({ x: 0.5, z: -0.2 });
  });

  it('stays put for a push under friction, even for ever', () => {
    const s = newLoose();
    slide(s, 5, { x: P.slideFriction * 9.81 * 0.9, z: 0 });
    expect(s.sx).toBe(0);
  });

  it('slides on a hard corner, stops at the wall, and stays shifted when the push ends', () => {
    const s = newLoose();
    slide(s, 2, { x: 6, z: 0 });
    expect(s.sx).toBeCloseTo(room.maxX);
    slide(s, 2, { x: 0, z: 0 });
    expect(s.sx).toBeCloseTo(room.maxX);
    expect(s.vx).toBe(0);
  });

  it('slides forward under braking and not back again once friction has it', () => {
    const s = newLoose();
    slide(s, 0.3, { x: 0, z: 6 });
    const at = s.sz;
    expect(at).toBeGreaterThan(0);
    slide(s, 3, { x: 0, z: 0 });
    expect(s.sz).toBeGreaterThanOrEqual(at);
    expect(s.sz).toBeLessThanOrEqual(room.maxZ);
    expect(Math.hypot(s.vx, s.vz)).toBe(0);
  });

  it('tips a can that hits the wall hard, not one that settles against it', () => {
    const hard = newLoose();
    slideTip(hard, slide(hard, 2, { x: 9, z: 0 }));
    expect(hard.tipped).toBe(true);
    const soft = newLoose();
    slideTip(soft, slide(soft, 2, { x: 3.6, z: 0 }, { ...room, maxX: 0.02 }));
    expect(soft.tipped).toBe(false);
  });

  it('goes over the edge of an open back, and one sat on it goes on a bump', () => {
    expect(fallsOut(0.01, 0)).toBe(true);
    expect(fallsOut(-0.3, 5)).toBe(false);
    expect(fallsOut(-P.edgeBalance / 2, P.edgeShake - 0.1)).toBe(false);
    expect(fallsOut(-P.edgeBalance / 2, P.edgeShake)).toBe(true);
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(LOOSE_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });
});

