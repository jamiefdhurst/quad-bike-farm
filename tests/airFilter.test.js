import { describe, it, expect } from 'vitest';
import { AirFilter, DEFAULT_FILTER_PARAMS as FP } from '../src/vehicle/airFilter.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
function runningEngine(clog) {
  const e = new EngineModel({}, { random: seeded(3) });
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  return e;
}
/** Full throttle for a few seconds, returning the engine's power and richness at the end. */
function flatOut(clog) {
  const e = runningEngine();
  for (let t = 0; t < 5; t += 0.05) e.update(0.05, { throttle: 1, clog });
  return { power: e.power, rich: e.rich, mixture: e.mixture, rpm: e.rpm };
}

describe('the air filter', () => {
  it('clogs slowly with mud and puddles, and not stood still, with the engine off, or on clean ground', () => {
    const f = new AirFilter();
    f.update(60, { running: true, speed: 5, mud: 1 });
    expect(f.clog).toBeCloseTo(60 * FP.mudRate, 5);
    expect(f.clog).toBeLessThan(0.2); // a minute of mud is not much
    const g = new AirFilter();
    g.update(60, { running: true, speed: 0.5, mud: 1 });
    g.update(60, { running: false, speed: 5, mud: 1 });
    g.update(60, { running: true, speed: 5, mud: 0, puddle: 0 });
    expect(g.clog).toBe(0);
    const p = new AirFilter();
    p.update(60, { running: true, speed: 5, puddle: 1 });
    expect(p.clog).toBeGreaterThan(f.clog); // splashing is worse than mud
  });

  it('takes several minutes of hard mud to choke it, never past 1, and cleaning clears it', () => {
    const f = new AirFilter();
    for (let t = 0; t < 1200; t += 1) f.update(1, { running: true, speed: 5, mud: 1, puddle: 1 });
    expect(f.clog).toBe(1);
    expect(f.state).toBe('choked');
    f.clean();
    expect(f.clog).toBe(0);
    expect(f.isClean).toBe(true);
    expect(f.state).toBe('clean');
  });

  it('a clogged filter runs the engine richer and takes the top end off its power', () => {
    const clean = flatOut(0);
    const choked = flatOut(1);
    expect(choked.mixture).toBeCloseTo(clean.mixture + P.clogRich, 1);
    expect(choked.power).toBeLessThan(clean.power);
    expect(choked.power).toBeGreaterThan(clean.power * (1 - P.clogPowerLoss) - 0.1);
  });

  it('but costs almost nothing at idle, where the engine barely breathes', () => {
    const idle = (clog) => {
      const e = runningEngine();
      for (let t = 0; t < 3; t += 0.05) e.update(0.05, { throttle: 0, clog });
      return e.power;
    };
    expect(idle(1)).toBeGreaterThan(idle(0) - 0.05);
  });
});
