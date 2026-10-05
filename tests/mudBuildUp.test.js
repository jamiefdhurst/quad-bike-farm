import { describe, it, expect } from 'vitest';
import { createMudState, updateMudBuildUp } from '../src/effects/mudBuildUp.js';
import { DEFAULT_MUD_PARAMS } from '../src/effects/quadMud.js';

const p = { ...DEFAULT_MUD_PARAMS };
const on = (mud, puddle = 0) => [0, 1, 2, 3].map((i) => ({ contact: true, mud, puddle, driven: i >= 2 }));

function ride(state, seconds, wheels, speed, spin = 0) {
  for (let t = 0; t < seconds * 60; t++) updateMudBuildUp(state, 1 / 60, wheels, speed, spin, p);
  return state;
}

describe('mud build-up', () => {
  it('stays clean on grass', () => {
    const s = ride(createMudState(), 60, on(0), 10);
    expect(s.body).toBe(0);
    expect(s.wheels).toBe(0);
  });

  it('coats the tyres in seconds and the bodywork over a few laps', () => {
    const s = ride(createMudState(), 10, on(1), 9);
    expect(s.wheels).toBeGreaterThan(0.6);
    expect(s.body).toBeLessThan(0.15);
    ride(s, 120, on(1), 9);
    expect(s.body).toBeGreaterThan(0.6);
    expect(s.body).toBeLessThanOrEqual(1);
    expect(s.wet).toBe(1);
  });

  it('builds up faster with wheelspin and in puddles', () => {
    const plain = ride(createMudState(), 5, on(1), 6);
    const spinning = ride(createMudState(), 5, on(1), 6, 5);
    const puddle = ride(createMudState(), 5, on(1, 1), 6);
    expect(spinning.body).toBeGreaterThan(plain.body);
    expect(puddle.body).toBeGreaterThan(plain.body * 2);
  });

  it('sheds mud off the tyres on grass but keeps it on the body, drying out', () => {
    const s = ride(createMudState(), 60, on(1), 9);
    const body = s.body;
    const tyres = s.wheels;
    ride(s, 60, on(0), 9);
    expect(s.wheels).toBeLessThan(tyres * 0.6);
    expect(s.body).toBe(body);
    ride(s, p.dryTime, on(0), 0);
    expect(s.wet).toBe(0);
  });

  it('nothing happens standing still or in the air', () => {
    const s = ride(createMudState(), 30, on(1), 0);
    expect(s.body).toBe(0);
    const air = on(1).map((w) => ({ ...w, contact: false }));
    ride(s, 30, air, 10, 8);
    expect(s.body).toBe(0);
  });
});
