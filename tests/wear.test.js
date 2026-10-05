import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function running(throttle, minutes) {
  const e = new EngineModel({ initialTemperature: 1 }, { random: seededRandom(1) });
  e.setIgnition(true);
  for (let i = 0; i < 300 && !e.isRunning; i++) e.update(1 / 60, { starter: true });
  for (let i = 0; i < minutes * 60 * 20; i++) e.update(1 / 20, { throttle });
  return e;
}

describe('wear', () => {
  it('builds up while it runs, faster when worked hard, up to a limit', () => {
    const idle = running(0, 10);
    const hard = running(1, 10);
    expect(idle.wear).toBeGreaterThan(0.08);
    expect(hard.wear).toBeGreaterThan(idle.wear * 2);
    expect(running(1, 60).wear).toBeCloseTo(idle.params.wearMax, 5);
  });

  it('makes it run rougher, and clears when serviced', () => {
    const e = running(0, 10);
    const worn = e.roughness;
    e.wear = 0;
    e.update(1 / 20, {});
    expect(e.roughness).toBeLessThan(worn - 0.05);
  });

  it('does not build up with the engine off', () => {
    const e = new EngineModel({ initialTemperature: 1 }, { random: seededRandom(2) });
    for (let i = 0; i < 60 * 20; i++) e.update(1 / 20, {});
    expect(e.wear).toBe(0);
  });
});
