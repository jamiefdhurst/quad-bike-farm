import { describe, it, expect } from 'vitest';
import { setQuirk, setFault, clearFaults, fixEverything, problemSummary, quirkLabel } from '../src/debug/vehicleDebug.js';
import { QuirkSet } from '../src/vehicle/quirks.js';
import { Faults } from '../src/vehicle/faults.js';

const unitWith = () => ({
  engine: { fouling: 0.5, clog: 0.6, wear: 0.4, scuff: 0.3, overheat: 0.2, seized: true, water: 0.4, dieselSoak: 0.4, silencerBlown: 0.5, boiled: true, coolant: 0.2, coolantLeak: 2, battery: 1 },
  quad: { faults: new Faults(), quirks: new QuirkSet(['tapStiff']), sump: { level: 0.2 }, fuel: { litres: 5 } },
});

describe('vehicle debug helpers', () => {
  it('adds and removes quirks, never both fuel gauge lies', () => {
    const q = new QuirkSet(['fuelHigh']);
    setQuirk(q, 'fuelSticks', true);
    expect(q.kinds).toEqual(['fuelSticks']);
    setQuirk(q, 'hornFlaky', true);
    setQuirk(q, 'fuelSticks', false);
    expect(q.kinds).toEqual(['hornFlaky']);
  });

  it('sets and clears faults', () => {
    const f = new Faults();
    setFault(f, 'belt', 0.7);
    expect(f.started.belt).toBe(true);
    expect(f.levels.belt).toBe(0.7);
    setFault(f, 'belt', 0);
    expect(f.started.belt).toBe(false);
    setFault(f, 'puncture', 0.5);
    setFault(f, 'carb', 0.5);
    clearFaults(f);
    expect(f.any).toBe(false);
    expect(f.tyre).toBe(-1);
  });

  it('fixes everything but leaves quirks', () => {
    const u = unitWith();
    setFault(u.quad.faults, 'cable', 0.8);
    expect(problemSummary(u)).toContain('seized');
    fixEverything(u);
    expect(problemSummary(u)).toBe('nothing wrong');
    expect(u.quad.quirks.kinds).toEqual(['tapStiff']);
    expect(u.quad.quirks.tapStiff).toBe(0);
    expect(u.quad.sump.level).toBe(1);
  });

  it('labels quirks readably', () => {
    expect(quirkLabel('headlightFlicker')).toBe('headlight flicker');
  });
});
