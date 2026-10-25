import { describe, it, expect } from 'vitest';
import { nearerPassenger } from '../src/interaction/seatLook.js';

const driver = { x: 0, z: 0.3 };
const back = { x: 0, z: -0.4 };

describe('nearerPassenger', () => {
  it('is the back when you look behind the middle of the two seats', () => {
    expect(nearerPassenger({ x: 0.05, z: -0.3 }, driver, back)).toBe(true);
  });
  it('is the driver\'s seat when you look at the front half', () => {
    expect(nearerPassenger({ x: 0, z: 0.5 }, driver, back)).toBe(false);
  });
  it('works across a car, where the passenger sits to the side', () => {
    expect(nearerPassenger({ x: 0.5, z: 0.2 }, { x: -0.4, z: 0.2 }, { x: 0.4, z: 0.2 })).toBe(true);
    expect(nearerPassenger({ x: -0.5, z: 0.2 }, { x: -0.4, z: 0.2 }, { x: 0.4, z: 0.2 })).toBe(false);
  });
  it('is the driver\'s seat when nothing is looked at or a seat is missing', () => {
    expect(nearerPassenger(null, driver, back)).toBe(false);
    expect(nearerPassenger({ x: 0, z: -1 }, driver, null)).toBe(false);
  });
});
