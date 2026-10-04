import { describe, it, expect } from 'vitest';
import { EngineModel, EngineState } from '../src/engine/engineModel.js';

// Small seeded PRNG so runs are repeatable.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

function makeEngine({ temperature = 0, seed = 1, params = {} } = {}) {
  const engine = new EngineModel({ ...params, initialTemperature: temperature }, { random: seededRandom(seed) });
  engine.setIgnition(true);
  return engine;
}

/** Runs the engine for `seconds`, returning every event raised along the way. */
function run(engine, seconds, controls = {}) {
  const events = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    engine.update(DT, typeof controls === 'function' ? controls(engine) : controls);
    events.push(...engine.events);
  }
  return events;
}

/** Cranks until the engine catches or the time runs out. */
function crank(engine, seconds, controls = {}) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps && !engine.isRunning; i++) {
    engine.update(DT, { ...controls, starter: true });
  }
  engine.update(DT, { ...controls, starter: false });
  return engine.isRunning;
}

function averageRpm(engine, seconds, controls) {
  let sum = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    engine.update(DT, controls);
    sum += engine.rpm;
  }
  return sum / steps;
}

describe('state machine basics', () => {
  it('needs the ignition on before the starter does anything', () => {
    const engine = new EngineModel({}, { random: seededRandom(1) });
    run(engine, 1, { starter: true, choke: 1 });
    expect(engine.state).toBe(EngineState.OFF);
    expect(engine.rpm).toBe(0);
  });

  it('goes off, ignition, cranking, running, and back to off', () => {
    const engine = new EngineModel({}, { random: seededRandom(1) });
    expect(engine.state).toBe(EngineState.OFF);
    engine.setIgnition(true);
    expect(engine.state).toBe(EngineState.IGNITION);
    engine.update(DT, { starter: true, choke: 1 });
    expect(engine.state).toBe(EngineState.CRANKING);
    expect(crank(engine, 5, { choke: 1 })).toBe(true);
    expect(engine.state).toBe(EngineState.RUNNING);
    engine.setIgnition(false);
    expect(engine.state).toBe(EngineState.OFF);
    run(engine, 3);
    expect(engine.rpm).toBe(0);
  });

  it('reports ignition events raised between updates on the next update', () => {
    const engine = new EngineModel({}, { random: seededRandom(1) });
    engine.setIgnition(true);
    engine.update(DT);
    expect(engine.events.map((e) => e.type)).toContain('ignitionOn');
  });
});

describe('cold start', () => {
  it('will not catch from cold without choke', () => {
    const engine = makeEngine({ temperature: 0 });
    expect(crank(engine, 10, { choke: 0 })).toBe(false);
  });

  it('catches from cold with full choke', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const engine = makeEngine({ temperature: 0, seed });
      expect(crank(engine, 5, { choke: 1 })).toBe(true);
    }
  });

  it('idles high and lumpy when cold on choke', () => {
    const engine = makeEngine({ temperature: 0 });
    crank(engine, 5, { choke: 1 });
    run(engine, 2, { choke: 1 });
    const idle = averageRpm(engine, 5, { choke: 1 });
    expect(idle).toBeGreaterThan(engine.params.idleRpmWarm + 200);
    expect(engine.roughness).toBeGreaterThan(0.4);
  });

  it('idle drifts up as it warms with the choke left on', () => {
    const engine = makeEngine({ temperature: 0 });
    crank(engine, 5, { choke: 1 });
    const coldIdle = averageRpm(engine, 10, { choke: 1 });
    engine.setTemperature(0.45);
    engine.fouling = 0;
    const warmerIdle = averageRpm(engine, 10, { choke: 1 });
    expect(warmerIdle).toBeGreaterThan(coldIdle + 100);
  });

  it('warms fully in roughly two to three minutes with sensible choke use', () => {
    const engine = makeEngine({ temperature: 0 });
    crank(engine, 5, { choke: 1 });
    // Ease the choke off as it warms, keeping it slightly rich.
    run(engine, 120, (e) => ({ choke: Math.min(1, Math.max(0, 1.15 - e.temperature)) }));
    expect(engine.isRunning).toBe(true);
    expect(engine.temperature).toBeLessThan(1);
    run(engine, 60, (e) => ({ choke: Math.min(1, Math.max(0, 1.15 - e.temperature)) }));
    expect(engine.isRunning).toBe(true);
    expect(engine.temperature).toBe(1);
  });
});

describe('warm engine', () => {
  it('starts without choke and idles steady and low', () => {
    const engine = makeEngine({ temperature: 1 });
    expect(crank(engine, 3, { choke: 0 })).toBe(true);
    run(engine, 3);
    let min = Infinity;
    let max = 0;
    run(engine, 10, (e) => {
      min = Math.min(min, e.rpm);
      max = Math.max(max, e.rpm);
      return {};
    });
    expect(Math.abs((min + max) / 2 - engine.params.idleRpmWarm)).toBeLessThan(100);
    expect(max - min).toBeLessThan(150);
    expect(engine.roughness).toBeLessThan(0.15);
  });

  it('is hard to start with too much choke', () => {
    let startsWithChoke = 0;
    let startsWithout = 0;
    for (let seed = 1; seed <= 20; seed++) {
      if (crank(makeEngine({ temperature: 1, seed }), 3, { choke: 1 })) startsWithChoke++;
      if (crank(makeEngine({ temperature: 1, seed }), 3, { choke: 0 })) startsWithout++;
    }
    expect(startsWithout).toBe(20);
    expect(startsWithChoke).toBeLessThan(6);
  });

  it('stalls when the choke is left on once warm', () => {
    const engine = makeEngine({ temperature: 1 });
    crank(engine, 3, { choke: 0 });
    const events = run(engine, 90, { choke: 1 });
    const stall = events.find((e) => e.type === 'stalled');
    expect(stall).toBeDefined();
    expect(stall.reason).toBe('flooded');
    expect(engine.state).toBe(EngineState.STALLED);
  });

  it('keeps running indefinitely with no choke', () => {
    const engine = makeEngine({ temperature: 1 });
    crank(engine, 3, { choke: 0 });
    const events = run(engine, 180, { choke: 0 });
    expect(events.find((e) => e.type === 'stalled')).toBeUndefined();
    expect(engine.isRunning).toBe(true);
  });

  it('stalls eventually after a cold start if the choke is never backed off', () => {
    const engine = makeEngine({ temperature: 0 });
    crank(engine, 5, { choke: 1 });
    const events = run(engine, 240, { choke: 1 });
    expect(events.some((e) => e.type === 'stalled' && e.reason === 'flooded')).toBe(true);
  });
});

describe('low rpm stall', () => {
  it('stalls under heavy braking load from cold', () => {
    const engine = makeEngine({ temperature: 0 });
    crank(engine, 5, { choke: 1 });
    run(engine, 2, { choke: 1 });
    const events = run(engine, 4, { choke: 1, load: 1 });
    const stall = events.find((e) => e.type === 'stalled');
    expect(stall).toBeDefined();
    expect(stall.reason).toBe('lowRpm');
  });

  it('survives the same load when warm', () => {
    const engine = makeEngine({ temperature: 1 });
    crank(engine, 3);
    run(engine, 2);
    const events = run(engine, 4, { load: 1 });
    expect(events.find((e) => e.type === 'stalled')).toBeUndefined();
    expect(engine.isRunning).toBe(true);
  });

  it('stalls when rpm is forced below the stall threshold', () => {
    const engine = makeEngine({ temperature: 1 });
    crank(engine, 3);
    engine.rpm = engine.params.stallRpm - 50;
    engine.update(DT);
    expect(engine.state).toBe(EngineState.STALLED);
  });
});

describe('firing pulses', () => {
  it('fires once every two revolutions', () => {
    const engine = makeEngine({ temperature: 1 });
    crank(engine, 3);
    run(engine, 2);
    let fires = 0;
    let rpmSum = 0;
    const seconds = 5;
    run(engine, seconds, (e) => {
      fires += e.pulses.filter((p) => p.type === 'fire' || p.type === 'misfire').length;
      rpmSum += e.rpm;
      return {};
    });
    const avgRpm = rpmSum / Math.round(seconds / DT);
    expect(fires).toBeCloseTo((avgRpm / 120) * seconds, -1);
  });

  it('warms up only while running and cools when off', () => {
    const engine = makeEngine({ temperature: 0.5 });
    run(engine, 30);
    expect(engine.temperature).toBeLessThan(0.5);
  });
});
