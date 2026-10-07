import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { followThrottle, isSnap, spitChance, spitPropensity } from '../src/engine/spitBack.js';

const P = DEFAULT_ENGINE_PARAMS;
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('spitPropensity', () => {
  it('needs both a lean and a cold engine', () => {
    expect(spitPropensity({ lean: 0.4, temperature: 1 }, P)).toBe(0);
    expect(spitPropensity({ lean: 0, temperature: 0 }, P)).toBe(0);
    expect(spitPropensity({ lean: 0.4, temperature: 0.1 }, P)).toBeGreaterThan(0.5);
  });
  it('grows with leanness and with cold', () => {
    const a = spitPropensity({ lean: 0.15, temperature: 0.3 }, P);
    expect(spitPropensity({ lean: 0.3, temperature: 0.3 }, P)).toBeGreaterThan(a);
    expect(spitPropensity({ lean: 0.15, temperature: 0.1 }, P)).toBeGreaterThan(a);
  });
  it('never happens on a diesel or when switched off', () => {
    expect(spitPropensity({ lean: 1, temperature: 0 }, { ...P, compressionIgnition: true })).toBe(0);
    expect(spitChance({ lean: 1, temperature: 0 }, { ...P, spitBase: 0 })).toBe(0);
  });
});

describe('isSnap', () => {
  it('is a throttle well above its recent self', () => {
    expect(isSnap(0.1, 1, P)).toBe(true);
    expect(isSnap(0.8, 1, P)).toBe(false);
    expect(isSnap(0, 0.4, P)).toBe(false);
  });
  it('is not a slow roll-on', () => {
    let slow = 0;
    let snapped = false;
    for (let t = 0; t < 3; t += 1 / 60) {
      const thr = Math.min(1, t / 2);
      snapped ||= isSnap(slow, thr, P);
      slow = followThrottle(slow, thr, 1 / 60, P);
    }
    expect(snapped).toBe(false);
  });
});

function ride(temperature, choke, snaps) {
  const e = new EngineModel({}, { random: seeded(5) });
  // Started warm so it catches, then let go cold, as a quad that's been choked up and had the choke pushed in too soon.
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  expect(e.isRunning).toBe(true);
  e.setTemperature(temperature);
  let n = 0;
  for (let i = 0; i < snaps; i++) {
    for (let t = 0; t < 2; t += 1 / 60) e.update(1 / 60, { throttle: 0.1, choke });
    for (let t = 0; t < 0.3; t += 1 / 60) {
      e.update(1 / 60, { throttle: 1, choke });
      n += e.events.filter((x) => x.type === 'spitBack').length;
    }
  }
  return n;
}

describe('the engine spitting back', () => {
  it('spits when cold and barely choked, and not when warm', () => {
    expect(ride(0.4, 0.3, 8)).toBeGreaterThan(0);
    expect(ride(1, 0.3, 8)).toBe(0);
  });
  it('is stopped by the choke', () => {
    expect(ride(0.4, 1, 8)).toBeLessThan(ride(0.4, 0.3, 8));
  });
  it('spits at most once per cooldown', () => {
    expect(ride(0.4, 0.3, 1)).toBeLessThanOrEqual(1);
  });
});
