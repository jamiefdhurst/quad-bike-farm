import { describe, it, expect } from 'vitest';
import { Flock, findFlockSpot, DEFAULT_FLOCK_PARAMS as P, FLOCK_PARAM_RANGES } from '../src/world/flock.js';
import { createRandom } from '../src/core/random.js';

const open = () => true;
const make = (allowed = open, seed = 4, params = {}) => {
  const f = new Flock({ allowed, random: createRandom(seed), params: { ...P, ...params } });
  f.place({ x: 0, z: 0 });
  return f;
};
const run = (f, seconds, threats = [], dt = 0.1) => {
  const bleats = [];
  for (let t = 0; t < seconds; t += dt) bleats.push(...f.update(dt, threats));
  return bleats;
};
const spread = (f) => {
  const c = f.centre();
  return Math.max(...f.sheep.map((s) => Math.hypot(s.x - c.x, s.z - c.z)));
};

describe('the flock', () => {
  it('places the number asked for, apart, on allowed ground only', () => {
    const f = make((x) => x > -3);
    expect(f.sheep).toHaveLength(P.count);
    expect(f.sheep.every((s) => s.x > -3)).toBe(true);
    for (const a of f.sheep) for (const b of f.sheep) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(P.separation);
  });

  it('drifts about and grazes but stays together', () => {
    const f = make();
    const start = f.sheep.map((s) => [s.x, s.z]);
    run(f, 300);
    expect(f.sheep.some((s, i) => Math.hypot(s.x - start[i][0], s.z - start[i][1]) > 1)).toBe(true);
    expect(spread(f)).toBeLessThan(P.spread * 3);
  });

  it('never steps onto ground it may not stand on', () => {
    const allowed = (x, z) => Math.hypot(x, z) < 12;
    const f = make(allowed);
    run(f, 200);
    expect(f.sheep.every((s) => allowed(s.x, s.z))).toBe(true);
    run(f, 20, [{ x: 0, z: 0, speed: 8 }]);
    expect(f.sheep.every((s) => allowed(s.x, s.z))).toBe(true);
  });

  it('moves off from a quad that comes close, and sooner from a fast one', () => {
    const slow = make();
    const fast = make();
    const c = slow.centre();
    run(slow, 0.2, [{ x: c.x + 14, z: c.z, speed: 0 }]);
    run(fast, 0.2, [{ x: c.x + 14, z: c.z, speed: 8 }]);
    expect(slow.sheep.some((s) => s.mode === 'run')).toBe(false);
    expect(fast.sheep.some((s) => s.mode === 'run')).toBe(true);
  });

  it('runs away from the thing, not towards it', () => {
    const f = make();
    const before = f.sheep.map((s) => Math.hypot(s.x - 5, s.z));
    run(f, 1, [{ x: 5, z: 0, speed: 0 }]);
    const after = f.sheep.map((s) => Math.hypot(s.x - 5, s.z));
    expect(after.filter((d, i) => d < before[i] - 0.5)).toHaveLength(0);
  });

  it('calms down and goes back to grazing once it has gone', () => {
    const f = make();
    run(f, 3, [{ x: 2, z: 0, speed: 5 }]);
    run(f, 60);
    expect(f.sheep.every((s) => s.mode !== 'run')).toBe(true);
  });

  it('bleats now and then, more when frightened', () => {
    const calm = run(make(), 120);
    const scared = run(make(), 30, [{ x: 2, z: 0, speed: 6 }]);
    expect(calm.length).toBeGreaterThan(0);
    expect(scared.length / 30).toBeGreaterThan(calm.length / 120);
    expect(calm.every((e) => e.pitch > 0.7 && e.pitch < 1.3)).toBe(true);
  });

  it('is the same flock for the same seed', () => {
    const a = make(open, 9);
    const b = make(open, 9);
    run(a, 50);
    run(b, 50);
    expect(a.sheep.map((s) => [s.x, s.z])).toEqual(b.sheep.map((s) => [s.x, s.z]));
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(FLOCK_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });
});

describe('finding where to put the flock', () => {
  it('picks the roomy ground, not a sliver', () => {
    const allowed = (x, z) => (x > 40 && x < 42) || (x > -30 && x < 0 && z > 0 && z < 30);
    const spot = findFlockSpot(allowed, { minX: -40, maxX: 60, minZ: -10, maxZ: 40 }, createRandom(1));
    expect(spot.x).toBeLessThan(0);
  });

  it('says so when there is nowhere', () => {
    expect(findFlockSpot(() => false, { minX: 0, maxX: 20, minZ: 0, maxZ: 20 }, createRandom(1))).toBeNull();
  });
});
