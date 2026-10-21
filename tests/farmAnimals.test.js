import { describe, it, expect } from 'vitest';
import { FarmAnimals, DEFAULT_ANIMAL_PARAMS, ANIMAL_PARAM_RANGES, HEN_COUNT, distanceToRect, nearestEdge } from '../src/world/farmAnimals.js';
import { FARM_JOBS, JobBoard, availableJobs, feedWanted, DEFAULT_JOB_BOARD_PARAMS, JOB_BOARD_PARAM_RANGES } from '../src/world/farmJobs.js';
import { LAYOUT } from '../src/world/layout.js';
import { spawnKeepOut } from '../src/world/spawns.js';
import { createRandom } from '../src/core/random.js';
import { AMY_FARM_JOB_LINES, JESS_FARM_JOB_LINES } from '../src/npc/farmJobLines.js';

const pen = { minX: 0, maxX: 7, minZ: 0, maxZ: 7 };
const sty = { minX: 10, maxX: 15, minZ: 0, maxZ: 5 };
const make = (params = {}, seed = 3) => new FarmAnimals({ pen, sty, random: createRandom(seed), params: { ...DEFAULT_ANIMAL_PARAMS, ...params } });
const run = (a, seconds, ctx = {}, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...a.update(dt, ctx));
  return events;
};
const quad = (x, z, extra = {}) => ({ x, z, running: true, speed: 0, ...extra });

describe('the animals', () => {
  it('every tunable has a range', () => {
    expect(Object.keys(ANIMAL_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_ANIMAL_PARAMS).sort());
  });

  it('has four hens and a pig, all inside their own fences to begin with', () => {
    const a = make();
    expect(a.hens).toHaveLength(HEN_COUNT);
    for (const h of a.hens) expect(distanceToRect(pen, h.x, h.z)).toBe(0);
    expect(distanceToRect(sty, a.pig.x, a.pig.z)).toBe(0);
  });

  it('gets hungrier over the day and is not hungry at the start', () => {
    const a = make({ hungerSeconds: 100, startHunger: 0.2, hungryAt: 0.6 });
    expect(a.hungry('hens')).toBe(false);
    run(a, 50);
    expect(a.hunger.pig).toBeCloseTo(0.7, 1);
    expect(a.hungry('pig')).toBe(true);
    run(a, 200);
    expect(a.hunger.hens).toBe(1);
  });

  it('keeps hens in the run and the pig in the sty however they are scared', () => {
    const a = make();
    const ctx = { threats: [quad(3, 3), quad(-1, 3), quad(8, 8, { speed: 5 })], you: { x: -4, z: 3 } };
    for (let i = 0; i < 400; i++) {
      a.update(0.1, ctx);
      for (const h of a.hens) expect(distanceToRect(pen, h.x, h.z)).toBe(0);
      expect(distanceToRect(sty, a.pig.x, a.pig.z)).toBe(0);
    }
  });
});

describe('a quad left running near the hens', () => {
  it('scatters them, once, with a scatter event', () => {
    const a = make();
    const events = run(a, 2, { threats: [quad(9, 3.5)] });
    expect(a.hens.every((h) => h.mode === 'run')).toBe(true);
    expect(events.filter((e) => e.type === 'scatter')).toHaveLength(1);
  });

  it('runs them away from it', () => {
    const a = make();
    for (const h of a.hens) Object.assign(h, { x: 3.5, z: 3.5 });
    run(a, 0.5, { threats: [quad(12, 3.5)] });
    expect(a.hens.every((h) => h.x < 3.5)).toBe(true);
  });

  it('does not bother them when it is switched off and still, or far away', () => {
    const a = make();
    expect(run(a, 3, { threats: [quad(9, 3.5, { running: false })] }).some((e) => e.type === 'scatter')).toBe(false);
    expect(run(a, 3, { threats: [quad(60, 3.5)] }).some((e) => e.type === 'scatter')).toBe(false);
    expect(a.hens.some((h) => h.mode === 'run')).toBe(false);
  });

  it('is noticed from further off the faster it goes', () => {
    const slow = make();
    const fast = make();
    run(slow, 1, { threats: [quad(17, 3.5, { speed: 0.2 })] });
    run(fast, 1, { threats: [quad(17, 3.5, { speed: 8 })] });
    expect(slow.hens.some((h) => h.mode === 'run')).toBe(false);
    expect(fast.hens.every((h) => h.mode === 'run')).toBe(true);
  });

  it('settles again a few seconds after it has gone', () => {
    const a = make();
    run(a, 1, { threats: [quad(9, 3.5)] });
    run(a, DEFAULT_ANIMAL_PARAMS.panicSeconds + 1.5, { threats: [] });
    expect(a.hens.some((h) => h.mode === 'run')).toBe(false);
  });

  it('does not frighten the pig into squealing: she only grunts', () => {
    const a = make({ startHunger: 0 });
    const events = run(a, 120, { threats: [quad(12, 2)], near: true });
    expect(events.some((e) => e.type === 'squeal')).toBe(false);
    expect(events.some((e) => e.type === 'grunt')).toBe(true);
  });
});

describe('hungry animals', () => {
  it('crowd the fence nearest you', () => {
    const a = make({ startHunger: 1 });
    run(a, 25, { you: { x: -3, z: 3.5 } });
    const mean = a.hens.reduce((s, h) => s + h.x, 0) / HEN_COUNT;
    expect(mean).toBeLessThan(1.5);
    const p = nearestEdge(pen, -3, 3.5);
    expect(a.hens.every((h) => Math.hypot(h.x - p.x, h.z - p.z) < 3)).toBe(true);
  });

  it('do not crowd you from across the farm', () => {
    const a = make({ startHunger: 1 });
    run(a, 25, { you: { x: -80, z: 3.5 } });
    expect(a.hens.some((h) => h.mode === 'walk' && h.tx < 1)).toBe(false);
  });

  it('squeal for you when the pig is hungry and you are near, and not when you are far', () => {
    const a = make({ startHunger: 1 });
    expect(run(a, 60, { you: { x: 20, z: 2 }, near: true }).some((e) => e.type === 'squeal')).toBe(true);
    const b = make({ startHunger: 1 });
    expect(run(b, 60, { you: { x: 20, z: 2 }, near: false }).some((e) => e.type === 'squeal')).toBe(false);
  });

  it('are quiet of squeals and grunt instead once fed', () => {
    const a = make({ startHunger: 1, hungerSeconds: 100000 });
    a.hunger.pig = 0;
    const events = run(a, 200, { near: true });
    expect(events.some((e) => e.type === 'squeal')).toBe(false);
    expect(events.some((e) => e.type === 'grunt')).toBe(true);
  });
});

describe('feeding', () => {
  it('works from within reach of the fence, not from across the yard', () => {
    const a = make();
    expect(a.canFeed('hens', -1.5, 3)).toBe(true);
    expect(a.canFeed('hens', 3, 3)).toBe(true);
    expect(a.canFeed('hens', -8, 3)).toBe(false);
    expect(a.canFeed('pig', 7, 2)).toBe(false);
    expect(a.canFeed('pig', 8, 2)).toBe(true);
  });

  it('takes feedSeconds of holding, takes feedUse from the bucket, and feeds them', () => {
    const a = make({ startHunger: 0.8, feedSeconds: 4, feedUse: 0.45 });
    let bucket = 1;
    const events = [];
    for (let t = 0; t < 4.2; t += 0.1) {
      const r = a.feeding('hens', 0.1, bucket);
      bucket -= r.used;
      events.push(...r.events);
    }
    expect(events.filter((e) => e.type === 'fed')).toEqual([{ type: 'fed', which: 'hens' }]);
    expect(bucket).toBeCloseTo(0.55, 2);
    expect(a.hunger.hens).toBe(0);
    expect(a.fed.hens).toBe(true);
    expect(a.fed.pig).toBe(false);
    expect(a.hungry('pig')).toBe(true);
  });

  it('one full bucket does both, and the job counts both', () => {
    const a = make({ startHunger: 0.8 });
    let bucket = 1;
    for (const which of ['hens', 'pig']) for (let t = 0; t < 4.5; t += 0.1) bucket -= a.feeding(which, 0.1, bucket).used;
    expect(a.allFed).toBe(true);
    expect(bucket).toBeCloseTo(0.1, 2);
  });

  it('says so once when the bucket runs out, and goes no further', () => {
    const a = make({ startHunger: 0.8 });
    const first = a.feeding('hens', 0.1, 0);
    expect(first.events).toEqual([{ type: 'empty' }]);
    expect(first.used).toBe(0);
    expect(a.feeding('hens', 0.1, 0).events).toEqual([]);
  });

  it('does not feed ones that have just been fed', () => {
    const a = make({ startHunger: 0.8 });
    for (let t = 0; t < 4.5; t += 0.1) a.feeding('pig', 0.1, 1);
    const again = a.feeding('pig', 0.1, 1);
    expect(again.used).toBe(0);
  });

  it('loses a half-done feed if you let go of the fence', () => {
    const a = make({ startHunger: 0.8 });
    for (let t = 0; t < 2; t += 0.1) {
      a.feeding('hens', 0.1, 1);
      a.update(0.1, {});
    }
    expect(a.progress.hens).toBeGreaterThan(0.3);
    run(a, 5);
    expect(a.progress.hens).toBe(0);
    expect(a.fed.hens).toBe(false);
  });

  it('a fresh day makes them unfed and as hungry as the day starts', () => {
    const a = make({ startHunger: 0.4 });
    for (let t = 0; t < 4.5; t += 0.1) a.feeding('hens', 0.1, 1);
    a.reset();
    expect(a.fed).toEqual({ hens: false, pig: false });
    expect(a.hunger.hens).toBe(0.4);
  });
});

describe('the feeding job', () => {
  it('is one of the farm jobs, needs the animals, and is on offer on this farm', () => {
    expect(FARM_JOBS.feed.needs).toBe('farmAnimals');
    expect(availableJobs(LAYOUT)).toContain('feed');
  });

  it('is dealt on a minority of days (under half), by the chance', () => {
    const p = DEFAULT_JOB_BOARD_PARAMS.feedChance;
    expect(p).toBeLessThan(0.5);
    expect(JOB_BOARD_PARAM_RANGES.feedChance).toBeDefined();
    const r = createRandom(11);
    let days = 0;
    for (let i = 0; i < 2000; i++) if (feedWanted(r, p)) days++;
    expect(days / 2000).toBeGreaterThan(p - 0.05);
    expect(days / 2000).toBeLessThan(p + 0.05);
    expect(feedWanted(() => 0.99, 0)).toBe(false);
    expect(feedWanted(() => 0.0, 1)).toBe(true);
  });

  it('goes on top of the two a day and ticks off when done', () => {
    const board = new JobBoard({ ids: ['muck', 'silage', 'logs'], random: createRandom(5) });
    expect(board.today).toHaveLength(2);
    board.add('feed', FARM_JOBS.feed);
    expect(board.today).toHaveLength(3);
    expect(board.lines().some((l) => l.text === 'Feed the hens and the pig')).toBe(true);
    expect(board.complete('feed')).toBe(true);
    expect(board.complete('feed')).toBe(false);
  });
});

describe('where they live', () => {
  const { pen: P, sty: S, bin, bucket } = LAYOUT.farmAnimals;
  const b = LAYOUT.barn;
  const overlap = (a, c, m = 0) => a.minX - m < c.maxX && a.maxX + m > c.minX && a.minZ - m < c.maxZ && a.maxZ + m > c.minZ;

  it('keeps the run and the sty apart from each other, the barn, the silage, the paddock and the hedge', () => {
    expect(overlap(P, S, 1.5)).toBe(false);
    const barn = { minX: b.x - b.halfX, maxX: b.x + b.halfX, minZ: b.z - b.halfZ, maxZ: b.z + b.halfZ };
    const silage = { minX: LAYOUT.silage.x - 1, maxX: LAYOUT.silage.x + 4, minZ: LAYOUT.silage.z - 1, maxZ: LAYOUT.silage.z + 6 };
    const paddock = { minX: LAYOUT.paddock.x - LAYOUT.paddock.half, maxX: LAYOUT.paddock.x + LAYOUT.paddock.half, minZ: LAYOUT.paddock.z - LAYOUT.paddock.half, maxZ: LAYOUT.paddock.z + LAYOUT.paddock.half };
    for (const r of [P, S]) {
      for (const other of [barn, silage, paddock]) expect(overlap(r, other, 1)).toBe(false);
      expect(r.minX).toBeGreaterThan(-LAYOUT.fieldHalf + LAYOUT.hedgeThickness + 0.5);
    }
  });

  it('puts the bin by the barn wall, outside it, and the bucket beside it', () => {
    expect(bin.z).toBeLessThan(b.z - b.halfZ);
    expect(Math.abs(bin.x - b.x)).toBeLessThan(b.halfX);
    expect(Math.hypot(bucket.x - bin.x, bucket.z - bin.z)).toBeLessThan(2);
    expect(bucket.z).toBeLessThan(b.z - b.halfZ);
  });

  it('keeps vehicles from starting in them', () => {
    const what = spawnKeepOut(LAYOUT).map((k) => k.what);
    expect(what).toContain("the hens' run");
    expect(what).toContain("the pig's sty");
  });

  it('is a short walk from the bin to the run and the sty', () => {
    for (const r of [P, S]) expect(distanceToRect(r, bin.x, bin.z)).toBeLessThan(25);
  });
});

describe('what the girls say', () => {
  it('has lines for starting, finishing and the hens scattering, and has no dashes', () => {
    for (const key of ['feedStart', 'feedDone', 'hensScatter']) {
      const amy = AMY_FARM_JOB_LINES[key].lines;
      const jess = JESS_FARM_JOB_LINES[key];
      expect(amy.length).toBeGreaterThan(1);
      expect(jess.length).toBeGreaterThan(1);
      for (const l of [...amy, ...jess]) {
        expect(l).not.toMatch(/—|–/);
      }
    }
  });
});
