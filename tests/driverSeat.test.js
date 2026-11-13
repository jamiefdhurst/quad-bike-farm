import { describe, it, expect } from 'vitest';
import { UTV_STAND, UTV_SEATS } from '../src/vehicle/utvModel.js';
import { CAB_STAND, CAB_SEATS } from '../src/vehicle/cabModel.js';

// A girl driving climbs in from the driver's door, on the right: the stand point is beyond the seat on that side.
describe('the driver\'s door', () => {
  it('is on the right of the UTV, further out than the wheel seat and clear of the body', () => {
    expect(UTV_STAND.driver.x).toBeLessThan(UTV_SEATS.driver.x);
    expect(Math.abs(UTV_STAND.driver.x)).toBeGreaterThan(1.1);
    expect(UTV_SEATS.driver.x).toBeLessThan(0); // the wheel is on the right (x is negative)
  });

  it('is on the right of the Land Rover, clear of its 1.15 scaled body', () => {
    expect(CAB_SEATS.driver.x).toBeLessThan(0);
    expect(CAB_STAND.driver.x).toBeLessThan(CAB_SEATS.driver.x);
    expect(Math.abs(CAB_STAND.driver.x)).toBeGreaterThan(1.1);
  });

  it('mirrors the passenger side the girls already use', () => {
    expect(UTV_STAND.driver.x).toBe(-UTV_STAND.left.x);
    expect(CAB_STAND.driver.x).toBe(-CAB_STAND.left.x);
  });
});
