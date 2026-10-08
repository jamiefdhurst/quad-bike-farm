import { describe, it, expect } from 'vitest';
import { Carry, CARRY_ITEMS, CARRY_PARAM_RANGES, DEFAULT_CARRY_PARAMS, carryLean, carryPace, carryWeight } from '../src/npc/carrying.js';

const P = DEFAULT_CARRY_PARAMS;

function run(carry, seconds, dt = 0.05) {
  const events = [];
  for (let t = 0; t < seconds; t += dt) {
    const e = carry.update(dt);
    if (e) events.push(e);
  }
  return events;
}

describe('a girl carrying something', () => {
  it('has every item described, and every tunable in the panel', () => {
    for (const [kind, item] of Object.entries(CARRY_ITEMS)) {
      expect(item.grip, kind).toBeGreaterThan(0);
      expect(P[item.pace], kind).toBeGreaterThan(0);
    }
    for (const key of Object.keys(P)) expect(CARRY_PARAM_RANGES[key], key).toBeDefined();
  });

  it('finds a jerry can heavier the fuller it is', () => {
    const empty = carryWeight('can', 0);
    const half = carryWeight('can', 10);
    const full = carryWeight('can', 20);
    expect(empty).toBeLessThan(half);
    expect(half).toBeLessThan(full);
    expect(full).toBe(1);
    expect(carryWeight('mug')).toBeLessThan(carryWeight('toolbox'));
  });

  it('slows to the full-can pace and leans more with a heavy load', () => {
    expect(carryPace(P, 'can', 0)).toBe(1);
    expect(carryPace(P, 'can', 1)).toBeCloseTo(P.canPace);
    expect(carryPace(P, 'can', 0.5)).toBeGreaterThan(P.canPace);
    expect(carryPace(P, 'toolbox', 0.7)).toBe(P.toolboxPace);
    expect(carryLean(P, 1)).toBeGreaterThan(carryLean(P, 0.35));
    expect(carryLean(P, 0)).toBe(0);
  });

  it('picks it up, holds it and puts it down, once each', () => {
    const c = new Carry('can', 1, P);
    expect(c.phase).toBe('raise');
    expect(c.ease).toBe(0);
    expect(run(c, P.reachTime + 0.2)).toEqual(['raised']);
    expect(c.phase).toBe('hold');
    expect(c.ease).toBe(1);
    expect(run(c, 3)).toEqual([]);
    c.lower();
    expect(run(c, P.lowerTime + 0.2)).toEqual(['lowered']);
    expect(c.phase).toBe('done');
    expect(c.ease).toBe(0);
    expect(run(c, 1)).toEqual([]);
  });

  it('is bent over most at the bottom of the lift', () => {
    const c = new Carry('toolbox', 0.7, P);
    expect(c.stoop).toBe(1);
    run(c, P.reachTime + 0.1);
    expect(c.stoop).toBe(0);
  });

  it('can be put down part-way through the lift', () => {
    const c = new Carry('can', 1, P);
    run(c, P.reachTime / 2);
    const k = c.k;
    c.lower();
    expect(run(c, P.lowerTime)).toEqual(['lowered']);
    expect(k).toBeGreaterThan(0);
  });

  it('has a mug brought from the house already in the hand', () => {
    const c = new Carry('mug', 0.05, P, { sip: true });
    c.inHand();
    expect(c.phase).toBe('hold');
    expect(c.sip).toBe(0);
  });

  it('has a drink from a mug, then has had it', () => {
    const c = new Carry('mug', 0.05, P, { sip: true });
    c.inHand();
    expect(c.sipped).toBe(false);
    let top = 0;
    for (let t = 0; t < P.sipFor + 0.5; t += 0.05) {
      c.update(0.05);
      top = Math.max(top, c.sip);
      expect(c.sip).toBeGreaterThanOrEqual(0);
      expect(c.sip).toBeLessThanOrEqual(1);
    }
    expect(top).toBe(1);
    expect(c.sipped).toBe(true);
    expect(c.sip).toBe(0);
  });

  it('never has a drink from something that is not a mug', () => {
    const c = new Carry('can', 1, P);
    run(c, 5);
    expect(c.sipped).toBe(true);
    expect(c.sip).toBe(0);
  });
});
