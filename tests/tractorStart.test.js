import { describe, it, expect } from 'vitest';
import { TractorStartAttempt, DEFAULT_TRACTOR_START_PARAMS as P } from '../src/npc/tractorStart.js';

// A tractor engine that catches when cranked with the lamp lit (or, with `catchesCold`, any time), after `crankFor` seconds.
function fakeEngine({ lampAfter = 5, catchesCold = false, crankFor = 1 } = {}) {
  const e = {
    ignitionOn: false,
    isRunning: false,
    t: 0,
    cranked: 0,
    get glowHot() {
      return this.ignitionOn && !this.isRunning && this.t >= lampAfter;
    },
    setIgnition(on) {
      this.ignitionOn = on;
      if (!on) this.isRunning = false;
    },
  };
  e.step = (dt, starter) => {
    if (e.ignitionOn) e.t += dt;
    if (starter) {
      e.cranked += dt;
      if (e.cranked > crankFor && (catchesCold || e.glowHot)) e.isRunning = true;
    } else e.cranked = 0;
  };
  return e;
}

function run(a, engine, seconds) {
  const events = [];
  for (let t = 0; t < seconds && !a.done; t += 0.1) {
    events.push(...a.update(0.1));
    engine.step(0.1, a.starter);
  }
  return events;
}

const make = (engine, random, params = {}) => new TractorStartAttempt({ engine }, { random, params: { ...P, ...params } });

describe('starting the tractor', () => {
  it('turns the key, waits for the lamp, cranks and has it running', () => {
    const engine = fakeEngine();
    const a = make(engine, () => 0.99, { rushChance: 0 });
    const events = run(a, engine, 40);
    expect(events).toContain('keyOn');
    expect(events).toContain('glowWait');
    expect(events).not.toContain('rush');
    expect(a.result).toBe('running');
    expect(engine.isRunning).toBe(true);
  });

  it('does not touch the starter before the lamp when she is patient', () => {
    const engine = fakeEngine({ lampAfter: 6 });
    const a = make(engine, () => 0.99, { rushChance: 0 });
    let early = false;
    for (let t = 0; t < 5.5; t += 0.1) {
      a.update(0.1);
      engine.step(0.1, a.starter);
      if (a.starter) early = true;
    }
    expect(early).toBe(false);
  });

  it('cranks early when she cannot wait, which only works on a warm engine', () => {
    const cold = fakeEngine({ lampAfter: 7 });
    const a = make(cold, () => 0, { rushChance: 1 });
    const events = run(a, cold, 4.5);
    expect(events).toContain('rush');
    expect(cold.isRunning).toBe(false); // the plugs weren't ready
    const warm = fakeEngine({ lampAfter: 7, catchesCold: true });
    const b = make(warm, () => 0, { rushChance: 1 });
    run(b, warm, 8);
    expect(warm.isRunning).toBe(true);
  });

  it('waits for the lamp on later goes however keen she was', () => {
    const engine = fakeEngine({ lampAfter: 12 });
    const a = make(engine, () => 0, { rushChance: 1, burstMin: 2, burstMax: 2, pauseMin: 1, pauseMax: 1 });
    run(a, engine, 8);
    expect(a.bursts).toBe(1); // the rush; she's waiting now
    run(a, engine, 15);
    expect(a.result).toBe('running');
  });

  it('gives up after her goes run out, with the key off', () => {
    const engine = fakeEngine({ lampAfter: 0 });
    engine.step = () => {}; // it never catches
    const a = make(engine, () => 0.5, { maxBursts: 2, burstMin: 1, burstMax: 1, pauseMin: 1, pauseMax: 1 });
    const events = [];
    for (let t = 0; t < 30 && !a.done; t += 0.1) {
      events.push(...a.update(0.1));
      engine.t += 0.1; // the lamp's lit, but it won't catch
    }
    expect(a.result).toBe('gaveUp');
    expect(events).toContain('gaveUp');
    expect(engine.ignitionOn).toBe(false);
  });

  it('stops trying when abandoned', () => {
    const engine = fakeEngine();
    const a = make(engine, () => 0.5);
    run(a, engine, 2);
    a.abandon();
    expect(a.done).toBe(true);
    expect(a.starter).toBe(false);
  });
});
