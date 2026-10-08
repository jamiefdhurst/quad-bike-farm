import { describe, expect, it } from 'vitest';
import { benchDismountSpots, pickBenchSeat } from '../src/vehicle/benchSeat.js';
import { planSeats } from '../src/npc/utvRide.js';
import { UtvRide } from '../src/npc/utvRide.js';
import { UTV_STAND } from '../src/vehicle/utvModel.js';

describe('pickBenchSeat', () => {
  it('takes the seat by the door when it is free', () => {
    expect(pickBenchSeat([])).toBe('left');
  });
  it('takes the middle when the other girl has the door seat', () => {
    expect(pickBenchSeat(['left'])).toBe('mid');
    expect(pickBenchSeat(new Set(['left']))).toBe('mid');
  });
  it('takes the door seat if only the middle is gone', () => {
    expect(pickBenchSeat(['mid'])).toBe('left');
  });
  it('finds nothing when the bench is full', () => {
    expect(pickBenchSeat(['left', 'mid'])).toBeNull();
  });
});

describe('benchDismountSpots', () => {
  it('starts at the door and tries further out, then fore and aft', () => {
    const spots = benchDismountSpots(UTV_STAND.left);
    expect(spots[0]).toEqual([UTV_STAND.left.x, UTV_STAND.left.z]);
    expect(spots[1][0]).toBeGreaterThan(spots[0][0]);
    expect(spots.length).toBe(4);
  });
});

describe('a girl joining while you are on the bench', () => {
  it('counts your seat as taken', () => {
    const ride = new UtvRide(undefined, () => 0.5);
    expect([...ride.taken({ girls: [], playerSeat: 'left' })]).toEqual(['left']);
    expect(ride.taken({ girls: [], playerSeat: null }).size).toBe(0);
  });
  it('plans the other girl into the seat you left', () => {
    const { seats } = planSeats(['jess'], new Set(['left']), () => 0.99);
    expect(seats[0].seat).not.toBe('left');
  });
});
