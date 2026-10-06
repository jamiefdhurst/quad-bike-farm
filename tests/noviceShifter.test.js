import { describe, it, expect } from 'vitest';
import { NoviceShifter, DEFAULT_SHIFTER_PARAMS, DEFAULT_NOVICE_PARAMS as N } from '../src/vehicle/autoShifter.js';

const tops = { 1: 2.4, 2: 4.8, 3: 8.5 };
const state = (over = {}) => ({ gear: 0, gears: 3, topSpeed: (g) => tops[g], speed: 0, throttle: 0.5, brake: 0, reverse: false, ...over });

// Drives the shifter from rest with the lever following what it asks for, `seconds` long.
function setOff(shifter, seconds, { speedAt = () => 0 } = {}) {
  let gear = 0;
  const log = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const out = shifter.update(0.05, state({ gear, speed: speedAt(t) }));
    gear = out.gear;
    log.push({ t, ...out, events: shifter.events });
  }
  return log;
}

describe('the novice', () => {
  it('is a plain shifter when nothing goes wrong, and never goes above her top gear', () => {
    const s = new NoviceShifter(DEFAULT_SHIFTER_PARAMS, { ...N, skipFirstChance: 0, hopChance: 0, cutChance: 0, maxGear: 2 }, () => 0.5);
    const log = setOff(s, 6, { speedAt: (t) => Math.min(8, t * 2) });
    expect(Math.max(...log.map((l) => l.gear))).toBe(2);
    expect(log.every((l) => l.throttleScale === 1)).toBe(true);
  });

  it('kangaroos on a set-off: the clutch comes up in fits', () => {
    const s = new NoviceShifter(DEFAULT_SHIFTER_PARAMS, { ...N, skipFirstChance: 0, hopChance: 1, cutChance: 0 }, () => 0);
    const log = setOff(s, 3);
    const after = log.filter((l) => l.gear === 1);
    const flips = after.slice(1).filter((l, i) => l.clutch !== after[i].clutch).length;
    expect(flips).toBeGreaterThanOrEqual(3);
    expect(log.flatMap((l) => l.events)).toContain('hop');
  });

  it('can set off in second and shut the throttle as it bites, which is what stalls the tractor', () => {
    const s = new NoviceShifter(DEFAULT_SHIFTER_PARAMS, { ...N, skipFirstChance: 1, hopChance: 0, cutChance: 1 }, () => 0);
    const log = setOff(s, 3);
    expect(log.some((l) => l.gear === 2)).toBe(true);
    expect(log.some((l) => l.throttleScale === 0)).toBe(true);
    expect(log.flatMap((l) => l.events)).toContain('cut');
  });

  it('does not misbehave in first, or once she is rolling', () => {
    const s = new NoviceShifter(DEFAULT_SHIFTER_PARAMS, { ...N, skipFirstChance: 0, hopChance: 0, cutChance: 1 }, () => 0);
    expect(setOff(s, 3).every((l) => l.throttleScale === 1)).toBe(true);
  });
});
