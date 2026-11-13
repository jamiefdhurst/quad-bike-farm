import { describe, it, expect } from 'vitest';
import { pickRelatedReading, advanceUsage, isNeutral, lampStates, counterDigits, drumPositions, counterText, DashClock, cycleIndex, pickReading } from '../src/vehicle/dashState.js';

describe('dash state', () => {
  it('counts hours in game time when given a time scale', () => {
    const u = { hours: 0, odoMiles: 0 };
    advanceUsage(u, { running: true, speedMps: 0, dt: 300, timeScale: 12 });
    expect(u.hours).toBeCloseTo(1, 6);
    advanceUsage(u, { running: false, speedMps: 0, dt: 300, timeScale: 12 });
    expect(u.hours).toBeCloseTo(1, 6);
  });

  it('adds hours only while the engine runs, and miles at speed', () => {
    const u = { hours: 10, odoMiles: 100 };
    advanceUsage(u, { running: true, speedMps: 0, dt: 360 });
    expect(u.hours).toBeCloseTo(10.1, 6);
    expect(u.odoMiles).toBe(100);
    advanceUsage(u, { running: false, speedMps: -1609.34, dt: 1 });
    expect(u.hours).toBeCloseTo(10.1, 6);
    expect(u.odoMiles).toBeCloseTo(101, 6);
  });

  it('is in neutral when idling and going nowhere', () => {
    const base = { ignition: true, reverse: false, speedMps: 0.1, rpm: 1100, clutchEngageRpm: 1500 };
    expect(isNeutral(base)).toBe(true);
    expect(isNeutral({ ...base, ignition: false })).toBe(false);
    expect(isNeutral({ ...base, reverse: true })).toBe(false);
    expect(isNeutral({ ...base, speedMps: 2 })).toBe(false);
    expect(isNeutral({ ...base, rpm: 2500 })).toBe(false);
  });

  it('lights lamps by the rules, and none with the ignition off', () => {
    const s = { ignition: true, reverse: true, neutral: false, temperature: 1, overheat: 1, fuelLevel: 0.05, reserveLevel: 0.1, oilLow: false };
    expect(lampStates(s)).toEqual({ r: true, n: false, temp: true, fuel: true, oil: false });
    expect(lampStates({ ...s, ignition: false })).toEqual({ r: false, n: false, temp: false, fuel: false, oil: false });
    expect(lampStates({ ...s, temperature: 0.3, overheat: 0, fuelLevel: 0.5, reverse: false, neutral: true })).toEqual({ r: false, n: true, temp: false, fuel: false, oil: false });
  });

  it('formats counters with tenths', () => {
    expect(counterDigits(1024.66, 5)).toMatchObject({ whole: '01024', tenth: '6' });
    expect(counterText(12.44, 4)).toBe('12.4');
    expect(counterText(0, 4)).toBe('0.0');
    expect(counterDigits(123456.7, 5).whole).toBe('23456'); // rolls over like a drum
  });

  it('runs the clock in real time from its start', () => {
    let t = 1000;
    const clock = new DashClock(9 * 3600 + 59 * 60, () => t);
    expect(clock.text()).toBe('09:59');
    t += 90;
    expect(clock.text()).toBe('10:00');
  });

  it('cycles lines every four seconds', () => {
    expect([0, 3.9, 4, 8, 12].map((s) => cycleIndex(s, 3))).toEqual([0, 0, 1, 2, 0]);
  });

  it('picks a related reading towards where the other one sits', () => {
    expect(pickRelatedReading([100, 200], 1, () => 0, 0.7)).toBeCloseTo(170);
    expect(pickRelatedReading([100, 200], 0, () => 1, 0.7)).toBeCloseTo(130);
    expect(pickRelatedReading([100, 200], 0.5, () => 0.5)).toBeCloseTo(150);
  });

  it('picks readings within a range', () => {
    expect(pickReading([10, 20], () => 0)).toBe(10);
    expect(pickReading([10, 20], () => 0.5)).toBe(15);
  });
});

describe('gearShown', () => {
  it('shows the gear on a manual quad and D, N or R on an automatic', async () => {
    const { gearShown } = await import('../src/vehicle/dashState.js');
    expect(gearShown({ gear: '3', neutral: false, reverse: false })).toBe('3');
    expect(gearShown({ gear: 'N', neutral: true })).toBe('N');
    expect(gearShown({ gear: null, neutral: false, reverse: false })).toBe('D');
    expect(gearShown({ gear: null, neutral: true, reverse: false })).toBe('N');
    expect(gearShown({ gear: null, reverse: true })).toBe('R');
  });
});

describe('the tractor spec', () => {
  it('starts with an odometer in the background and a hand throttle range inside 0..1', async () => {
    const { HARTLEY_SPEC } = await import('../src/vehicle/quadSpecs.js');
    expect(HARTLEY_SPEC.odoRange[0]).toBeGreaterThan(0);
    expect(HARTLEY_SPEC.odoRange[1]).toBeGreaterThan(HARTLEY_SPEC.odoRange[0]);
    const [lo, hi] = HARTLEY_SPEC.handStartRange;
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi).toBeGreaterThan(lo);
  });

  it('rolls the tenths drum steadily and the others only as the carry comes round', () => {
    const p = drumPositions(1999.45, 4);
    expect(p).toHaveLength(5);
    expect(p[4]).toBeCloseTo(4.5, 6); // tenths, part way between 4 and 5
    expect(p.slice(0, 4)).toEqual([1, 9, 9, 9]); // nothing above has started to move
    const q = drumPositions(1999.95, 4); // the tenths drum is nearly at 0 again, so each drum above is part way round
    expect(q[4]).toBeCloseTo(9.5, 6);
    expect(q[3]).toBeCloseTo(9.5, 6);
    expect(q[2]).toBeCloseTo(9.5, 6);
    expect(q[1]).toBeCloseTo(9.5, 6);
    expect(q[0]).toBeCloseTo(1.5, 6);
  });

  it('only carries into a higher drum when every drum below is on 9', () => {
    const p = drumPositions(1209.5, 4);
    expect(p[2]).toBeCloseTo(0, 6); // the tens drum waits: the units drum is on 9 and hasn't started to turn
    expect(p[3]).toBeCloseTo(9, 6);
    expect(drumPositions(1209.95, 4)[2]).toBeCloseTo(0.5, 6); // it goes round with the units drum, 9 to 0
  });

  it('gives a key that changes when a drum visibly moves', () => {
    expect(counterDigits(100.005, 4).key).toBe(counterDigits(100.0, 4).key);
    expect(counterDigits(100.05, 4).key).not.toBe(counterDigits(100.0, 4).key);
  });
});
