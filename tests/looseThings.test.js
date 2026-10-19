import { describe, it, expect } from 'vitest';
import { DEFAULT_LOOSE_PARAMS as P, newLoose, creepStep, offRack, shuffleStep, tipStep, looseDrive } from '../src/vehicle/looseThings.js';

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
