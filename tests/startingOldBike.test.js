import { describe, it, expect } from 'vitest';
import { StartingAttempt, DEFAULT_STARTING_PARAMS } from '../src/npc/startingAttempt.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { PLOVER_SPEC } from '../src/vehicle/quadSpecs.js';

// A girl starting the old bike (#38): she tickles it, retards the lever if she remembers it, and kicks; if it kicks back or floods she thinks again.

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const DT = 1 / 60;

function attempt({ seed, advance = 0.5, params = DEFAULT_STARTING_PARAMS, seconds = 200 }) {
  const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...PLOVER_SPEC.engine, initialTemperature: 0 }, { random: seeded(seed + 100) });
  engine.advance = advance;
  const fuel = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startTap: 'on' });
  const quad = { engine, fuel, choke: 0, helperPull: false, helperThrottle: 0 };
  const a = new StartingAttempt(quad, { random: seeded(seed), params });
  const events = [];
  let held = 0;
  for (let i = 0; i < seconds / DT && !a.done; i++) {
    events.push(...a.update(DT));
    if (quad.helperPull) held += DT;
    else if (held > 0) {
      engine.pull(held);
      held = 0;
    }
    fuel.update(DT, { rpm: engine.rpm, throttle: quad.helperThrottle, choke: quad.choke, running: engine.isRunning });
    engine.update(DT, { starter: false, choke: quad.choke, throttle: quad.helperThrottle, fuel: fuel.bowlLevel });
  }
  return { a, engine, events };
}

describe('her starting the old bike', () => {
  const games = (o, n = 40) => Array.from({ length: n }, (_, i) => attempt({ ...o, seed: i + 1 }));

  it('tickles it from cold and usually gets it going', () => {
    const r = games({});
    expect(r.filter((g) => g.events.includes('tickle')).length).toBeGreaterThan(25);
    expect(r.filter((g) => g.a.result === 'running').length).toBeGreaterThan(24);
  });

  it('retards the lever when she remembers it, and goes back to it after a kick-back', () => {
    const r = games({ advance: 1 });
    expect(r.filter((g) => g.events.includes('retard')).length).toBeGreaterThan(30);
    expect(r.filter((g) => g.events.includes('kickedBack')).length).toBeGreaterThan(0);
    expect(r.filter((g) => g.a.result === 'running').length).toBeGreaterThan(20);
  });

  it('does not touch a lever or a tickler on any other bike', () => {
    const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, strokes: 2, pullStart: true, noStarter: true }, { random: seeded(3) });
    const a = new StartingAttempt({ engine, fuel: new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startTap: 'on' }), choke: 0, helperPull: false }, { random: seeded(1) });
    const before = engine.advance;
    const events = [];
    for (let i = 0; i < 600; i++) events.push(...a.update(DT));
    expect(engine.advance).toBe(before);
    expect(events).not.toContain('tickle');
    expect(events).not.toContain('retard');
  });
});
