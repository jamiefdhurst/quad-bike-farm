import { describe, it, expect } from 'vitest';
import { LightSwitch, LIGHT_MODES, lightLook, lightLamps, DEFAULT_LIGHT_SWITCH_PARAMS as P } from '../src/vehicle/lightSwitch.js';
import { UTV_SPEC } from '../src/vehicle/quadSpecs.js';
import { forwardGearShown } from '../src/vehicle/dashState.js';

describe('LightSwitch', () => {
  it('starts off and cycles off, dipped, main beam, off', () => {
    const sw = new LightSwitch();
    expect(sw.mode).toBe('off');
    expect([sw.cycle(), sw.cycle(), sw.cycle(), sw.cycle()]).toEqual(['low', 'high', 'off', 'low']);
  });

  it('ignores a mode it does not know', () => {
    const sw = new LightSwitch('high');
    sw.set('blue');
    expect(sw.mode).toBe('high');
    expect(new LightSwitch('nonsense').mode).toBe('off');
    expect(LIGHT_MODES).toEqual(['off', 'low', 'high']);
  });
});

describe('lightLook', () => {
  it('is dark with the switch off, or with no power whatever the switch says', () => {
    expect(lightLook('off', true).level).toBe(0);
    expect(lightLook('low', false).level).toBe(0);
    expect(lightLook('high', false).level).toBe(0);
  });

  it('gives a dipped beam the usual reach and a main beam a longer, wider, brighter, whiter one', () => {
    const low = lightLook('low', true);
    const high = lightLook('high', true);
    expect(low).toMatchObject({ level: P.lowLevel, reach: 1, spread: 1, glare: 1, halo: 1, main: false });
    expect(high).toMatchObject({ level: P.highLevel, reach: P.highReach, spread: P.highSpread, glare: P.highGlare, halo: P.highHalo, main: true });
    expect(high.level).toBeGreaterThan(low.level);
    expect(high.colour).not.toBe(low.colour);
  });
});

describe('lightLamps', () => {
  it('lights the green lamp for dipped or main beam and the blue one for main beam only', () => {
    expect(lightLamps('off', true)).toEqual({ lights: false, main: false });
    expect(lightLamps('low', true)).toEqual({ lights: true, main: false });
    expect(lightLamps('high', true)).toEqual({ lights: true, main: true });
  });

  it('is dark with no power', () => {
    expect(lightLamps('high', false)).toEqual({ lights: false, main: false });
  });
});

describe('the UTV', () => {
  it('has the switches the console shows, and starts in 2WD like the Land Rover', () => {
    expect(UTV_SPEC.driveSwitch).toBe(true);
    expect(UTV_SPEC.diffLock).toBe(true);
    expect(UTV_SPEC.vehicle.fourWheelDrive).toBe(0);
  });

  it('shows F, N or R on its cluster', () => {
    expect(forwardGearShown({ reverse: true, neutral: false })).toBe('R');
    expect(forwardGearShown({ reverse: false, neutral: true })).toBe('N');
    expect(forwardGearShown({ reverse: false, neutral: false })).toBe('F');
  });
});
