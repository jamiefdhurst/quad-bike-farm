import { describe, it, expect } from 'vitest';
import { WearLedger, isThrashed } from '../src/engine/wearLedger.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { AMY_THRASH_LINES, JESS_THRASH_LINES } from '../src/npc/thrashLines.js';

describe('WearLedger', () => {
  it('pins wear on whoever was riding when it built up', () => {
    const l = new WearLedger();
    l.record('red', 0.1, null); // the wear it came with
    l.record('red', 0.2, 'jess');
    l.record('red', 0.25, 'you');
    expect(l.worn('red', 'jess')).toBeCloseTo(0.1);
    expect(l.worn('red', 'you')).toBeCloseTo(0.05);
    expect(l.culprit('red').who).toBe('jess');
  });

  it('names nobody when it is evenly shared, or too little to say', () => {
    const l = new WearLedger();
    l.record('a', 0, null);
    l.record('a', 0.01, 'amy');
    expect(l.culprit('a')).toBeNull();
    l.record('b', 0, null);
    l.record('b', 0.1, 'amy');
    l.record('b', 0.2, 'jess');
    expect(l.culprit('b')).not.toBeNull(); // exactly half each: the first one is named at a 0.5 share
    l.record('b', 0.3, 'you');
    expect(l.culprit('b')).toBeNull();
  });

  it('shrinks with a service', () => {
    const l = new WearLedger();
    l.record('x', 0, null);
    l.record('x', 0.4, 'jess');
    l.record('x', 0.1, null);
    expect(l.worn('x', 'jess')).toBeCloseTo(0.1);
    l.record('x', 0, null);
    expect(l.culprit('x')).toBeNull();
  });
});

describe('thrashing it cold', () => {
  function run(startTemp, seconds) {
    const e = new EngineModel({ initialTemperature: 1 }, { random: () => 0.5 });
    e.setIgnition(true);
    for (let i = 0; i < 600 && !e.isRunning; i++) e.update(1 / 60, { starter: true });
    const w0 = e.wear;
    e.temperature = startTemp;
    // Hold the temperature where it started so only the rate differs.
    for (let i = 0; i < seconds * 20; i++) {
      e.update(1 / 20, { throttle: 1 });
      e.temperature = startTemp;
    }
    return e.wear - w0;
  }

  it('wears an engine faster than revving it warm', () => {
    expect(run(0.1, 60)).toBeGreaterThan(run(1, 60) * 1.8);
  });

  it('is only thrashing when it is cold and working hard', () => {
    const p = { thrashColdBelow: 0.4, thrashWork: 0.6 };
    const e = { isRunning: true, temperature: 0.2, work: 0.9 };
    expect(isThrashed(e, p)).toBe(true);
    expect(isThrashed({ ...e, temperature: 0.8 }, p)).toBe(false);
    expect(isThrashed({ ...e, work: 0.2 }, p)).toBe(false);
    expect(isThrashed({ ...e, isRunning: false }, p)).toBe(false);
  });
});

describe('lines', () => {
  it('both girls can blame each of you, Amy and Jess', () => {
    for (const k of ['blameYou', 'blameAmy', 'blameJess']) {
      expect(AMY_THRASH_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_THRASH_LINES[k].length).toBeGreaterThan(0);
    }
  });
});
