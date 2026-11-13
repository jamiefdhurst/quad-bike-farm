import { describe, it, expect } from 'vitest';
import { headlightLook, taillightLevel, DEFAULT_HEADLIGHT_PARAMS as P } from '../src/vehicle/headlight.js';
import { QUAD_SPECS, EXTRA_SPECS, HARTLEY_SPEC } from '../src/vehicle/quadSpecs.js';

const run = (over = {}) => ({ keyOn: true, running: true, cranking: false, rpm: 1100, idle: 1100, max: 6000, roughness: 0.05, erratic: 0, steady: false, time: 0, ...over });

describe('headlightLook', () => {
  it('is dim and yellow at idle and bright and whiter when revved', () => {
    const idle = headlightLook(run());
    const revved = headlightLook(run({ rpm: 6000 }));
    expect(idle.level).toBeCloseTo(P.idleLevel, 5);
    expect(idle.colour).toBe(P.warmColour);
    expect(revved.level).toBeCloseTo(1, 5);
    expect(revved.colour).toBe(P.coolColour);
    const mid = headlightLook(run({ rpm: 2500 })).level;
    expect(mid).toBeGreaterThan(idle.level);
    expect(mid).toBeLessThan(revved.level);
  });

  it('is full by `fullAt` of the way up the revs, and no brighter beyond', () => {
    const at = 1100 + (6000 - 1100) * P.fullAt;
    expect(headlightLook(run({ rpm: at })).level).toBeCloseTo(1, 5);
    expect(headlightLook(run({ rpm: 9000 })).level).toBe(1);
  });

  it('is faint cranking, out when stalled and out with the key off', () => {
    expect(headlightLook(run({ running: false, cranking: true })).level).toBe(P.crankLevel);
    expect(headlightLook(run({ running: false })).level).toBe(0);
    expect(headlightLook(run({ keyOn: false })).level).toBe(0);
  });

  it('flickers with a rough engine and not with a smooth one', () => {
    const levels = (over) => Array.from({ length: 200 }, (_, i) => headlightLook(run({ rpm: 3000, time: i * 0.03, ...over })).level);
    const smooth = levels({});
    expect(Math.max(...smooth) - Math.min(...smooth)).toBe(0);
    const rough = levels({ roughness: 0.6 });
    expect(Math.max(...rough) - Math.min(...rough)).toBeGreaterThan(0.2);
    expect(Math.min(...rough)).toBeGreaterThan(0);
    const worse = levels({ roughness: 0.6, erratic: 0.4 });
    expect(Math.min(...worse)).toBeLessThan(Math.min(...rough));
  });

  it('is steady, full and white for a battery-lit quad whatever the engine does', () => {
    for (const over of [{}, { rpm: 6000 }, { roughness: 0.9 }, { running: false }]) expect(headlightLook(run({ steady: true, ...over }))).toEqual({ level: 1, colour: P.coolColour });
    expect(headlightLook(run({ steady: true, keyOn: false })).level).toBe(0);
  });

  it('is only the loan quad and the tractor that have a battery for it', () => {
    expect([...QUAD_SPECS, ...EXTRA_SPECS].filter((s) => s.steadyLights).map((s) => s.id)).toEqual(['ursa']);
    expect(HARTLEY_SPEC.steadyLights).toBe(true);
  });
});

describe('taillightLevel', () => {
  it('shares the headlight supply: dimmer than it running, out with it', () => {
    expect(taillightLevel(1, false)).toBeCloseTo(P.tailShare);
    expect(taillightLevel(0.3, false)).toBeLessThan(taillightLevel(1, false));
    expect(taillightLevel(0, false)).toBe(0);
  });

  it('braking lifts it to the brake light, up to full as the supply does, but not without a supply', () => {
    expect(taillightLevel(0.3, true)).toBeGreaterThan(taillightLevel(0.3, false));
    expect(taillightLevel(0.3, true)).toBeGreaterThanOrEqual(P.brakeBase);
    expect(taillightLevel(1, true)).toBeCloseTo(1);
    expect(taillightLevel(0, true)).toBe(0);
  });
});
