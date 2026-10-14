import { describe, it, expect } from 'vitest';
import { Cat, DEFAULT_CAT_PARAMS, CAT_PARAM_RANGES, perchWarmth, catShelter } from '../src/world/cat.js';
import { createRandom } from '../src/core/random.js';

const make = (over = {}) =>
  new Cat({ allowed: (x, z) => Math.hypot(x, z) < 40, home: { x: 0, z: 0 }, random: createRandom(7), params: { ...DEFAULT_CAT_PARAMS, ...over } });
const ctx = (over = {}) => ({ threats: [], perches: [], friends: [], shelter: false, ...over });
const run = (cat, seconds, c, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...cat.update(dt, typeof c === 'function' ? c() : c));
  return events;
};
const warmPerch = { id: 'q1', x: 6, z: 0, y: 0.9, warm: 0.8, taken: false };

describe('the barn cat', () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_CAT_PARAMS)) expect(CAT_PARAM_RANGES[k], k).toBeTruthy();
  });

  it('climbs onto a warm engine and goes to sleep on it', () => {
    const cat = make({ perchChance: 1, sitMin: 0.5, sitMax: 1 });
    const events = run(cat, 30, ctx({ perches: [warmPerch] }));
    expect(events.some((e) => e.kind === 'settled' && e.id === 'q1')).toBe(true);
    expect(cat.mode).toBe('sleep');
    expect(cat.y).toBeCloseTo(0.9);
    expect(cat.purring).toBe(true);
  });

  it('keeps off a cold engine', () => {
    const cat = make({ perchChance: 1, sitMin: 0.5, sitMax: 1 });
    run(cat, 60, ctx({ perches: [{ ...warmPerch, warm: 0.05 }] }));
    expect(cat.mode).not.toBe('sleep');
  });

  it('does not move for someone walking up to it asleep, but goes when shooed, and keeps off that perch for a while', () => {
    const cat = make({ perchChance: 1, sitMin: 0.5, sitMax: 1 });
    const c = ctx({ perches: [warmPerch] });
    run(cat, 30, c);
    run(cat, 5, ctx({ perches: [warmPerch], threats: [{ x: cat.x + 1, z: cat.z, speed: 0, loud: 0 }] }));
    expect(cat.mode).toBe('sleep');
    expect(cat.shoo(cat.x + 1, cat.z)).toBe('perch');
    run(cat, 3, c);
    expect(cat.mode).not.toBe('sleep');
    expect(cat.bans.has('q1')).toBe(true);
    run(cat, 60, c);
    expect(cat.mode).not.toBe('sleep');
  });

  it('leaves a perch whose vehicle is started', () => {
    const cat = make({ perchChance: 1, sitMin: 0.5, sitMax: 1 });
    run(cat, 30, ctx({ perches: [warmPerch] }));
    const events = run(cat, 3, ctx({ perches: [{ ...warmPerch, taken: true }] }));
    expect(events.some((e) => e.kind === 'woke' && e.scared)).toBe(true);
    expect(cat.mode).not.toBe('sleep');
  });

  it('wakes at a vehicle revved right beside it', () => {
    const cat = make({ perchChance: 1, sitMin: 0.5, sitMax: 1 });
    run(cat, 30, ctx({ perches: [warmPerch] }));
    run(cat, 2, ctx({ perches: [warmPerch], threats: [{ x: 3, z: 0, speed: 0, loud: 0.9 }] }));
    expect(cat.mode).not.toBe('sleep');
  });

  it('runs from a fast vehicle, further the faster it comes, and ends up sitting wary', () => {
    const cat = make();
    cat.place(10, 0);
    run(cat, 0.1, ctx({ threats: [{ x: 20, z: 0, speed: 3, loud: 0 }] }));
    expect(cat.mode).toBe('sit');
    run(cat, 0.1, ctx({ threats: [{ x: 16, z: 0, speed: 8, loud: 0 }] }));
    expect(cat.mode).toBe('flee');
    run(cat, 12, ctx());
    expect(['hide', 'sit']).toContain(cat.mode);
    expect(cat.x).toBeLessThan(10);
  });

  it('goes in to the barn when it is too wet, cold or dark, and curls up there', () => {
    const cat = make({ sitMin: 0.5, sitMax: 1 });
    cat.place(20, 0);
    run(cat, 40, ctx({ shelter: true }));
    expect(cat.mode).toBe('curl');
    expect(Math.hypot(cat.x, cat.z)).toBeLessThan(0.5);
    run(cat, 40, ctx());
    expect(cat.mode).not.toBe('curl');
  });

  it('goes in by the door when sheltering, and out by it again', () => {
    // A shed on x -10..-4 with a door on its +x wall at z 0, and a wall everywhere else.
    const inShed = (x, z) => x > -9.6 && x < -4.4 && Math.abs(z) < 4;
    const allowed = (x, z) => {
      if (inShed(x, z)) return true;
      const wall = x > -10 && x < -4 && Math.abs(z) < 4.4;
      if (wall) return x > -4.6 && Math.abs(z) < 1;
      return Math.hypot(x, z) < 40;
    };
    const cat = new Cat({ allowed, home: { x: -7, z: 0, via: { x: -3.5, z: 0 } }, inHome: inShed, random: createRandom(3), params: { ...DEFAULT_CAT_PARAMS, sitMin: 0.5, sitMax: 1 } });
    cat.place(10, 12);
    run(cat, 40, ctx({ shelter: true }));
    expect(cat.mode).toBe('curl');
    expect(inShed(cat.x, cat.z)).toBe(true);
    run(cat, 60, ctx());
    expect(inShed(cat.x, cat.z)).toBe(false);
  });

  it('does not jump to a perch from across a wall', () => {
    const cat = make({ perchChance: 1, sitMin: 0.5, sitMax: 1 });
    cat.allowed = (x) => x < 3; // a wall at x 3; the perch is beyond it
    run(cat, 60, ctx({ perches: [{ ...warmPerch, x: 8 }] }));
    expect(cat.mode).not.toBe('sleep');
  });

  it('rubs round a girl stood about, and tells the game it has', () => {
    const cat = make({ greetRate: 50 });
    cat.place(8, 0);
    const friends = [{ id: 'jess', x: 0, z: 0, free: true }];
    const events = run(cat, 40, ctx({ friends }));
    expect(events.some((e) => e.kind === 'greeted' && e.id === 'jess')).toBe(true);
    expect(events.some((e) => e.kind === 'fussed' && e.id === 'jess')).toBe(true);
  });

  it('ignores a girl who is busy', () => {
    const cat = make({ greetRate: 50 });
    cat.place(8, 0);
    const events = run(cat, 20, ctx({ friends: [{ id: 'jess', x: 0, z: 0, free: false }] }));
    expect(events.some((e) => e.kind === 'greeted')).toBe(false);
  });

  it('stays where it is allowed', () => {
    const cat = make();
    run(cat, 300, ctx({ perches: [] }));
    expect(Math.hypot(cat.x, cat.z)).toBeLessThan(41);
  });
});

describe('perch warmth and shelter', () => {
  it('is the warmer of the metal and the sun, and nothing from sun in the rain or snow', () => {
    expect(perchWarmth({ soak: 0.7, sun: 0.2 })).toBeCloseTo(0.7);
    expect(perchWarmth({ soak: 0, sun: 1 })).toBeGreaterThan(0.8);
    expect(perchWarmth({ soak: 0, sun: 1, wet: 0.6 })).toBe(0);
    expect(perchWarmth({ soak: 0, sun: 1, snow: 0.6 })).toBe(0);
    expect(perchWarmth({ soak: 0.5, sun: 1, wet: 1 })).toBe(0.5);
  });

  it('shelters in rain, snow, a hard frost or the dark', () => {
    expect(catShelter({ rain: 0.5 })).toBe(true);
    expect(catShelter({ snow: 0.5 })).toBe(true);
    expect(catShelter({ temperature: -3 })).toBe(true);
    expect(catShelter({ darkness: 0.9 })).toBe(true);
    expect(catShelter({ rain: 0, snow: 0, temperature: 14, darkness: 0.1 })).toBe(false);
  });
});
