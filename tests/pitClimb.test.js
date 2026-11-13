import { describe, it, expect } from 'vitest';
import { PitClimb, DEFAULT_PIT_PARAMS, PIT_PARAM_RANGES, pitMessage } from '../src/world/pitClimb.js';
import { climbGates } from '../src/npc/hillClimb.js';
import { createQuarry } from '../src/world/quarry.js';
import { LAYOUT } from '../src/world/layout.js';
import { RECORD_KINDS, Records } from '../src/world/records.js';

const quarry = createQuarry(LAYOUT);
const gates = climbGates(quarry.climb);
const along = (g, m) => ({ x: g.x + g.tx * m, z: g.z + g.tz * m });
const on = (p) => ({ ...p, riding: true, running: true });

/** Rides from `from` to `to` in steps, feeding the climb as the game would; returns every event. */
function ride(pc, from, to, steps = 20, dt = 0.5) {
  const events = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    events.push(...pc.update(dt, on({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t })));
  }
  return events;
}

describe('the pit climb', () => {
  it('has a range for every tunable, and a board line', () => {
    for (const k of Object.keys(DEFAULT_PIT_PARAMS)) {
      const [lo, hi] = PIT_PARAM_RANGES[k];
      expect(DEFAULT_PIT_PARAMS[k]).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_PIT_PARAMS[k]).toBeLessThanOrEqual(hi);
    }
    expect(RECORD_KINDS.pit).toEqual({ label: 'Pit climb', better: 'lower' });
  });

  it('does not run the clock until you have asked', () => {
    const pc = new PitClimb(gates);
    const events = ride(pc, along(gates[0], -6), along(gates[2], 4));
    expect(events).toEqual([]);
    expect(pc.running).toBe(false);
  });

  it('times you from the start cones through the gate to the finish over the lip', () => {
    const pc = new PitClimb(gates);
    pc.arm();
    expect(pc.youArmed).toBe(true);
    const events = ride(pc, along(gates[0], -6), along(gates[2], 4), 60, 0.5);
    expect(events.map((e) => e.type)).toEqual(['start', 'gate', 'finish']);
    const finish = events[2];
    expect(finish.time).toBeGreaterThan(5);
    expect(pc.tally).toBe(1);
  });

  it('goes out if you stop or get off, and if the time runs out', () => {
    const pc = new PitClimb(gates);
    pc.arm();
    pc.update(0.5, on(along(gates[0], -3)));
    expect(pc.update(0.5, on(along(gates[0], 3))).map((e) => e.type)).toEqual(['start']);
    const out = [];
    for (let t = 0; t < 12; t += 0.5) out.push(...pc.update(0.5, { ...along(gates[0], 4), riding: true, running: false }));
    expect(out.map((e) => e.type)).toEqual(['out']);
    const slow = new PitClimb(gates);
    slow.arm();
    slow.update(0.5, on(along(gates[0], -3)));
    slow.update(0.5, on(along(gates[0], 3)));
    const events = [];
    for (let t = 0; t < DEFAULT_PIT_PARAMS.timeout + 5; t += 0.5) events.push(...slow.update(0.5, on(along(gates[0], 4))));
    expect(events.map((e) => e.type)).toEqual(['out']);
  });

  it('forgets an ask that was not used, and a run called off', () => {
    const pc = new PitClimb(gates);
    pc.arm();
    for (let t = 0; t < DEFAULT_PIT_PARAMS.armFor + 5; t += 1) pc.update(1, on(along(gates[0], -30)));
    expect(pc.youArmed).toBe(false);
    pc.arm();
    pc.stand();
    expect(pc.youArmed).toBe(false);
    expect(pc.run).toBe(null);
  });

  it('says how far you are from the start cones', () => {
    const pc = new PitClimb(gates);
    expect(pc.distanceToStart(along(gates[0], 0))).toBeCloseTo(0);
    expect(pc.distanceToStart(along(gates[0], 10))).toBeCloseTo(10);
  });

  it('tells you what happened', () => {
    expect(pitMessage({ type: 'start' })).toBe('Go!');
    expect(pitMessage({ type: 'gate' })).toContain('finish cones');
    expect(pitMessage({ type: 'out' })).toBe('Pit climb: you are out');
    expect(pitMessage({ type: 'finish', time: 41.23 }, { record: true })).toBe('Pit climb: 41.2 s. A record!');
    expect(pitMessage({ type: 'finish', time: 41.23 }, { quadBest: true })).toBe('Pit climb: 41.2 s. Your best on this quad');
    expect(pitMessage({ type: 'finish', time: 41.23 })).toBe('Pit climb: 41.2 s');
  });

  it('keeps its record, and a better time beats it', () => {
    const r = new Records(1);
    expect(r.submit('pit', 'you', 50, 'farm300').record).toBe(true);
    expect(r.submit('pit', 'you', 60, 'farm300').record).toBe(false);
    expect(r.submit('pit', 'you', 44, 'farm300').record).toBe(true);
    const saved = new Records(2);
    saved.restore(JSON.parse(JSON.stringify(r.toJSON())));
    expect(saved.best('pit').value).toBe(44);
  });
});
