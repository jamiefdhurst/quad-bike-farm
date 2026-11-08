import { describe, it, expect } from 'vitest';
import { Rabbits, Pheasants, hedgeSpots, DEFAULT_WILDLIFE_PARAMS as P, WILDLIFE_PARAM_RANGES } from '../src/world/wildlife.js';
import { createRandom } from '../src/core/random.js';
import { boundary, gap } from '../src/world/fieldPlan.js';

const hedges = [boundary(-50, 50, 50, 50, [gap(50, 4)])]; // the gap is 50 m along, at x 0
const inGap = (h, s) => h.gaps.some((g) => Math.abs(s - g.at) < g.half);
const inField = (x, z) => z < 49 && Math.abs(x) < 60;
const spots = () => hedgeSpots(hedges, inGap, inField);
const rabbits = (seed = 3, params = {}) => {
  const r = new Rabbits({ allowed: (x, z) => inField(x, z) && z < 48, burrows: spots(), random: createRandom(seed), params: { ...P, ...params } });
  r.place();
  return r;
};
const run = (w, seconds, threats = [], dark = 0, dt = 0.1) => {
  const ev = [];
  for (let t = 0; t < seconds; t += dt) ev.push(...w.update(dt, threats, dark));
  return ev;
};

describe('hedge spots', () => {
  it('lie on the field side, out of the gaps, pointing into the hedge', () => {
    const s = spots();
    expect(s.length).toBeGreaterThan(5);
    for (const a of s) {
      expect(a.z).toBeCloseTo(48.5);
      expect(a.nz).toBe(1);
      expect(Math.abs(a.x)).toBeGreaterThan(5);
    }
  });
});

describe('the rabbits', () => {
  it('start on allowed ground, as many as asked for', () => {
    const r = rabbits();
    expect(r.rabbits).toHaveLength(P.rabbitCount);
    expect(r.rabbits.every((a) => a.z < 48)).toBe(true);
  });

  it('sit, hop and stay in the field when nothing is near', () => {
    const r = rabbits();
    run(r, 120);
    expect(r.rabbits.every((a) => inField(a.x, a.z))).toBe(true);
    expect(r.rabbits.some((a) => a.mode === 'hop' || a.mode === 'sit')).toBe(true);
  });

  it('bolt for the hedge from a quad, faster ones from further off, and go to ground', () => {
    const r = rabbits();
    const a = r.rabbits[0];
    const at = { x: a.x - 20, z: a.z };
    expect(run(r, 0.5, [{ ...at, speed: 0 }]).filter((e) => Math.hypot(e.x - a.x, e.z - a.z) < 1)).toHaveLength(0);
    const ev = run(r, 0.5, [{ ...at, speed: 20 }]);
    expect(ev.some((e) => e.kind === 'bolt')).toBe(true);
    expect(['run', 'down']).toContain(a.mode);
    run(r, 15);
    expect(a.mode).toBe('down');
  });

  it('come back out of the hedge after a while', () => {
    const r = rabbits(3, { rabbitDownMin: 5, rabbitDownMax: 6 });
    const a = r.rabbits[0];
    run(r, 0.5, [{ x: a.x - 3, z: a.z, speed: 0 }]);
    run(r, 20);
    expect(a.mode).not.toBe('down');
    expect(a.mode).not.toBe('run');
  });

  it('freeze in a headlight beam after dark and bolt when it is nearly on them', () => {
    const r = rabbits();
    const a = r.rabbits[0];
    a.mode = 'sit';
    a.t = 99;
    const beam = (d, speed = 0) => [{ x: a.x - d, z: a.z, speed, yaw: Math.PI / 2, beam: 1 }];
    run(r, 0.3, beam(15, 5), 0.9);
    expect(a.mode).toBe('caught');
    run(r, 1, beam(10, 0), 0.9);
    expect(a.mode).toBe('caught');
    const ev = run(r, 0.2, beam(2, 3), 0.9);
    expect(ev.some((e) => e.kind === 'bolt' && Math.hypot(e.x - a.x, e.z - a.z) < 2)).toBe(true);
  });

  it('do not freeze by day, or when the beam points elsewhere', () => {
    const r = rabbits();
    const a = r.rabbits[0];
    run(r, 0.3, [{ x: a.x - 15, z: a.z, speed: 0, yaw: Math.PI / 2, beam: 1 }], 0);
    expect(a.mode).not.toBe('caught');
    const b = r.rabbits[1];
    b.mode = 'sit';
    b.t = 99;
    run(r, 0.3, [{ x: b.x - 15, z: b.z, speed: 0, yaw: 0, beam: 1 }], 0.9);
    expect(b.mode).not.toBe('caught');
  });
});

describe('the pheasants', () => {
  const make = (seed = 5, params = {}) => {
    const p = new Pheasants({ spots: spots(), random: createRandom(seed), params: { ...P, ...params } });
    p.place();
    return p;
  };
  const go = (w, seconds, threats = [], dt = 0.1) => {
    const ev = [];
    for (let t = 0; t < seconds; t += dt) ev.push(...w.update(dt, threats, { x: 0, z: 0 }));
    return ev;
  };

  it('lie hidden, one to a spot', () => {
    const p = make();
    expect(p.birds).toHaveLength(P.pheasantCount);
    expect(p.birds.every((b) => b.mode === 'hidden')).toBe(true);
    expect(new Set(p.birds.map((b) => b.spot)).size).toBe(p.birds.length);
  });

  it('burst out from a quad, away from it, climbing and then lost to sight', () => {
    const p = make();
    const b = p.birds[0];
    const ev = go(p, 0.2, [{ x: b.x, z: b.z - 6, speed: 8 }]);
    expect(ev.filter((e) => e.kind === 'burst')).toHaveLength(1);
    expect(b.mode).toBe('fly');
    expect(b.dz).toBeGreaterThan(0.5);
    go(p, 1.2);
    expect(b.y).toBeGreaterThan(2);
    go(p, 4);
    expect(b.mode).toBe('gone');
  });

  it('let a slow vehicle go by at a distance and a person walk past, but not close', () => {
    const p = make();
    const b = p.birds[0];
    expect(go(p, 0.3, [{ x: b.x, z: b.z - 6, speed: 0 }])).toHaveLength(0);
    expect(go(p, 0.3, [{ x: b.x, z: b.z - 1.5, speed: 0 }]).some((e) => e.kind === 'burst')).toBe(true);
  });

  it('are replaced after a while, away from the player', () => {
    const p = make(5, { pheasantAwayMin: 5, pheasantAwayMax: 6 });
    const b = p.birds[0];
    go(p, 0.2, [{ x: b.x, z: b.z - 4, speed: 8 }]);
    go(p, 20);
    expect(b.mode).toBe('hidden');
    expect(Math.hypot(b.x, b.z)).toBeGreaterThanOrEqual(P.pheasantClear);
  });

  it('call now and then while hidden', () => {
    const p = make(5, { pheasantCallMin: 5, pheasantCallMax: 6 });
    expect(go(p, 30).some((e) => e.kind === 'call')).toBe(true);
  });

  it('flush on request', () => {
    const p = make();
    const b = p.birds[1];
    expect(p.flush(b.x - 2, b.z)).toMatchObject({ kind: 'burst' });
    expect(b.mode).toBe('fly');
  });
});

describe('the tuning', () => {
  it('has a range for every parameter', () => {
    for (const k of Object.keys(P)) expect(WILDLIFE_PARAM_RANGES[k], k).toBeTruthy();
  });
});

describe('the girls and the pheasant', () => {
  it('is a notice that makes her flinch, by a chance each girl has', async () => {
    const { NOTICE_KINDS } = await import('../src/npc/attention.js');
    const { NOTICE_REACTIONS } = await import('../src/npc/reactions.js');
    const { DEFAULT_COMPANION_PARAMS } = await import('../src/npc/companionParams.js');
    expect(NOTICE_KINDS.pheasant).toBeTruthy();
    expect(NOTICE_REACTIONS.pheasant.reaction).toBe('flinch');
    expect(DEFAULT_COMPANION_PARAMS[NOTICE_REACTIONS.pheasant.chance]).toBeGreaterThan(0);
  });
});
