import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { jumpTarget } from '../src/items/jumpLeads.js';

const run = (e, seconds, controls = {}) => {
  for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, controls);
};
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (params = {}) => new EngineModel(params, { random: seeded(7) });
const P = DEFAULT_ENGINE_PARAMS;

describe('battery', () => {
  it('starts full and drains with the ignition left on', () => {
    const e = make();
    e.setIgnition(true);
    run(e, 60);
    expect(e.battery).toBeCloseTo(1 - P.batteryIgnitionDrain * 60, 2);
    run(e, 600);
    expect(e.battery).toBeLessThan(P.batteryDeadBelow);
  });
  it('does not drain with the ignition off', () => {
    const e = make();
    run(e, 120);
    expect(e.battery).toBe(1);
  });
  it('drains on the starter, and charges while running', () => {
    const e = make();
    e.setIgnition(true);
    e.battery = 0.5;
    run(e, 2, { starter: true, choke: 1 });
    expect(e.battery).toBeLessThan(0.5);
    const r = make();
    r.state = 'running';
    r.battery = 0.5;
    r.rpm = 3000; // revved: the alternator gives its all, less what the ignition draws
    r.updateBattery(30);
    expect(r.battery).toBeCloseTo(0.5 + (P.batteryChargeRate - P.batteryRunDraw) * 30, 3);
  });
  it('cranks slower on a weak battery', () => {
    const peak = (b) => {
      const e = make();
      e.setIgnition(true);
      e.battery = b;
      let max = 0;
      for (let t = 0; t < 1.5; t += 1 / 120) {
        e.update(1 / 120, { starter: true });
        max = Math.max(max, e.rpm);
      }
      return max;
    };
    expect(peak(0.4)).toBeLessThan(peak(1) * 0.9);
  });
  it('only clicks when flat: no cranking, a click once per press', () => {
    const e = make();
    e.setIgnition(true);
    e.battery = 0.1;
    const clicks = [];
    for (let t = 0; t < 2; t += 1 / 60) {
      e.update(1 / 60, { starter: true });
      clicks.push(...e.events.filter((x) => x.type === 'starterClick'));
    }
    expect(e.state).toBe('ignition');
    expect(e.rpm).toBeLessThan(50);
    expect(clicks).toHaveLength(1);
    e.update(1 / 60, { starter: false });
    e.update(1 / 60, { starter: true });
    expect(e.events.some((x) => x.type === 'starterClick')).toBe(true);
  });
  it('dash power fails on a flat battery', () => {
    const e = make();
    e.setIgnition(true);
    expect(e.hasPower).toBe(true);
    e.battery = 0.05;
    expect(e.hasPower).toBe(false);
  });
  it('can be charged and is clamped', () => {
    const e = make();
    e.battery = 0.2;
    e.charge(0.3);
    expect(e.battery).toBeCloseTo(0.5);
    e.charge(5);
    expect(e.battery).toBe(1);
  });
});

describe('pull-start', () => {
  const pullable = () => {
    const e = make({ pullStart: true, strokes: 2 });
    e.setIgnition(true);
    e.battery = 0;
    return e;
  };
  it('does nothing on a quad without one, or with the ignition off', () => {
    const e = make();
    e.setIgnition(true);
    expect(e.pull(0.7)).toBeNull();
    const off = make({ pullStart: true });
    expect(off.pull(0.7)).toBeNull();
  });
  it('grades the yank by how long the cord was held', () => {
    expect(pullable().pull(0.7)).toBe(1);
    expect(pullable().pull(0.1)).toBeLessThan(0.5);
    expect(pullable().pull(1.5)).toBeLessThan(0.6);
    expect(pullable().pull(3)).toBeLessThan(0.5);
  });
  it('turns it over with a flat battery, without using any', () => {
    const e = pullable();
    e.pull(0.7);
    let peak = 0;
    for (let t = 0; t < 1; t += 1 / 120) {
      e.update(1 / 120, { choke: 1 });
      peak = Math.max(peak, e.rpm);
    }
    expect(peak).toBeGreaterThan(150);
    expect(e.battery).toBeLessThan(0.001);
  });
  it('a proper yank catches more often than a weak one', () => {
    const catches = (held) => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const e = new EngineModel({ pullStart: true, strokes: 2 }, { random: seeded(seed * 13) });
        e.setIgnition(true);
        e.temperature = 0.6;
        e.pull(held);
        for (let t = 0; t < 1.2; t += 1 / 120) e.update(1 / 120, { choke: 0.5 });
        if (e.isRunning) n++;
      }
      return n;
    };
    expect(catches(0.7)).toBeGreaterThan(catches(0.1));
  });
});

describe('jump leads', () => {
  const eng = (running, battery) => ({ isRunning: running, battery, charge(a) { this.battery += a; } });
  it('charges the flat quad from the running one', () => {
    const run1 = eng(true, 0.9);
    const flat = eng(false, 0.05);
    expect(jumpTarget(run1, flat)).toBe(flat);
    expect(jumpTarget(flat, run1)).toBe(flat);
  });
  it('does nothing when neither is running, or the flat one is already full', () => {
    expect(jumpTarget(eng(false, 0.9), eng(false, 0.1))).toBeNull();
    expect(jumpTarget(eng(true, 0.9), eng(false, 1))).toBeNull();
  });
  it('between two running quads the higher donates', () => {
    const hi = eng(true, 0.9);
    const lo = eng(true, 0.3);
    expect(jumpTarget(hi, lo)).toBe(lo);
  });
});
