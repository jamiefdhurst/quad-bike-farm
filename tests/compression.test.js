import { describe, it, expect } from 'vitest';
import { glowNeeded, stepGlow, glowReady, compressionCatchFactor } from '../src/engine/compression.js';
import { EngineModel, EngineState } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// A diesel the way the tractor's spec makes it: no mixture, no choke.
const diesel = (extra = {}) => ({ ...P, compressionIgnition: true, runsOnDiesel: true, coldEnrichmentNeed: 0, catchChance: 0.9, ...extra });

function crank(engine, seconds, controls = {}) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds && engine.state !== EngineState.RUNNING; t += dt) engine.update(dt, { starter: true, fuel: 1, ...controls });
}

function settle(engine, seconds, controls = {}) {
  for (let t = 0; t < seconds; t += 1 / 60) engine.update(1 / 60, { fuel: 1, ...controls });
}

describe('glow plugs', () => {
  it('are needed cold and not at all warm', () => {
    expect(glowNeeded(0, P)).toBe(1);
    expect(glowNeeded(P.glowWarmAbove, P)).toBe(0);
    expect(glowNeeded(1, P)).toBe(0);
    expect(glowNeeded(P.glowWarmAbove / 2, P)).toBeCloseTo(0.5, 5);
  });

  it('heat in glowSeconds while the key is on, and cool away more slowly', () => {
    expect(stepGlow(0, P.glowSeconds / 2, true, P)).toBeCloseTo(0.5, 5);
    expect(stepGlow(0.9, 100, true, P)).toBe(1);
    expect(stepGlow(1, P.glowCoolSeconds / 2, false, P)).toBeCloseTo(0.5, 5);
    expect(P.glowCoolSeconds).toBeGreaterThan(P.glowSeconds);
  });

  it('light the lamp once they are hot enough for the engine, so a warm one needs no wait', () => {
    expect(glowReady(0, 0, P)).toBe(false);
    expect(glowReady(1, 0, P)).toBe(true);
    expect(glowReady(0, 0.9, P)).toBe(true);
  });

  it('give an unheated cold engine only a sliver of its chance, and a heated one all of it', () => {
    expect(compressionCatchFactor(0, 0, P)).toBeCloseTo(P.glowColdCatch, 5);
    expect(compressionCatchFactor(0.5, 0, P)).toBeGreaterThan(P.glowColdCatch);
    expect(compressionCatchFactor(0.5, 0, P)).toBeLessThan(1);
    expect(compressionCatchFactor(1, 0, P)).toBe(1);
    expect(compressionCatchFactor(0, 1, P)).toBe(1);
  });
});

describe('a diesel engine', () => {
  it('heats its plugs with the key on, the lamp lit while they heat and out when they are ready', () => {
    const e = new EngineModel(diesel(), { random: seeded(3) });
    expect(e.glowLit).toBe(false); // key off
    e.setIgnition(true);
    expect(e.glowHot).toBe(false);
    expect(e.glowLit).toBe(true);
    settle(e, P.glowSeconds + 1);
    expect(e.glowHot).toBe(true);
    expect(e.glowLit).toBe(false);
    e.setIgnition(false);
    expect(e.glowHot).toBe(false);
    expect(e.glowLit).toBe(false);
  });

  it('starts cold on hot plugs and almost never without them', () => {
    let hot = 0;
    let unheated = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const a = new EngineModel(diesel(), { random: seeded(seed) });
      a.setIgnition(true);
      settle(a, P.glowSeconds + 1);
      crank(a, 6);
      if (a.isRunning) hot++;
      const b = new EngineModel(diesel(), { random: seeded(seed) });
      b.setIgnition(true);
      crank(b, 2); // straight on the starter
      if (b.isRunning) unheated++;
    }
    expect(hot).toBeGreaterThanOrEqual(18);
    expect(unheated).toBeLessThanOrEqual(3);
  });

  it('starts warm without any glow', () => {
    const e = new EngineModel(diesel({ initialTemperature: 0.9 }), { random: seeded(5) });
    e.setIgnition(true);
    crank(e, 6);
    expect(e.isRunning).toBe(true);
  });

  it('carries on running when the key is turned off, and only the knob stops it', () => {
    const e = new EngineModel(diesel({ initialTemperature: 0.9 }), { random: seeded(5) });
    e.setIgnition(true);
    crank(e, 6);
    settle(e, 2);
    e.setIgnition(false);
    settle(e, 5);
    expect(e.isRunning).toBe(true);
    expect(e.ignitionOn).toBe(false);
    expect(e.hasPower).toBe(false); // the dash goes dark with the key off
    expect(e.stopKnob()).toBe(true);
    settle(e, 0.1);
    expect(e.state).toBe(EngineState.OFF);
    expect(e.stopKnob()).toBe(false);
  });

  it('can be switched back on while it runs, and the key is off again once it has stopped', () => {
    const e = new EngineModel(diesel({ initialTemperature: 0.9 }), { random: seeded(5) });
    e.setIgnition(true);
    crank(e, 6);
    e.setIgnition(false);
    e.setIgnition(true);
    expect(e.ignitionOn).toBe(true);
    e.setIgnition(false);
    e.stopKnob();
    expect(e.ignitionOn).toBe(false);
    e.setIgnition(true);
    expect(e.state).toBe(EngineState.IGNITION);
  });

  it('does not soak up red diesel as a petrol engine does', () => {
    const e = new EngineModel(diesel({ initialTemperature: 0.9 }), { random: seeded(5) });
    e.setIgnition(true);
    crank(e, 6);
    settle(e, 60, { diesel: 1 });
    expect(e.dieselSoak).toBe(0);
    expect(e.isRunning).toBe(true);
  });

  it('leaves a petrol engine alone', () => {
    const e = new EngineModel({ ...P }, { random: seeded(5) });
    e.setIgnition(true);
    e.setIgnition(false);
    expect(e.keyPulled).toBe(false);
    expect(e.glowHot).toBe(false);
    expect(e.stopKnob()).toBe(false);
  });
});
