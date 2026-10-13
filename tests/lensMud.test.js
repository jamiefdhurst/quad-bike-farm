import { describe, it, expect } from 'vitest';
import { DEFAULT_LENS_PARAMS as P, createLens, updateLens, wipeLens, leaderAhead, splatRates, isOpenVehicle, lensCoverage, addSplat } from '../src/effects/lensMud.js';
import { createRandom } from '../src/core/random.js';

const calm = { speed: 8, puddle: 0, leader: null, rain: 0, covered: false };
const run = (lens, secs, s, seed = 1) => {
  const random = createRandom(seed);
  for (let t = 0; t < secs; t += 0.1) updateLens(lens, 0.1, s, random, P);
  return lens;
};

describe('which vehicles get it', () => {
  it('keeps cabs and cars clean and leaves the rest open', () => {
    for (const id of ['utv', 'landrover', 'landrover200', 'fiesta', 'corsa']) expect(isOpenVehicle(id)).toBe(false);
    for (const id of ['red', 'blue', 'yellow', 'green', 'orange', 'kids', 'moto', 'atc', 'loan', 'tractor']) expect(isOpenVehicle(id)).toBe(true);
  });
});

describe('what throws it', () => {
  const me = { x: 0, z: 0, yaw: 0 }; // facing +z
  const ahead = (over) => ({ x: 0, z: 6, speed: 8, mud: 0.8, ...over });

  it('finds a muddy vehicle close ahead and moving', () => {
    expect(leaderAhead(me, [ahead()], P)?.dist).toBeCloseTo(6);
  });

  it('ignores one behind, off to the side, too far, too slow or on clean ground', () => {
    for (const o of [ahead({ z: -6 }), ahead({ x: 6, z: 1 }), ahead({ z: 40 }), ahead({ speed: 1 }), ahead({ mud: 0 })]) {
      expect(leaderAhead(me, [o], P)).toBeNull();
    }
  });

  it('takes the nearest', () => {
    expect(leaderAhead(me, [ahead({ z: 8 }), ahead({ z: 4 })], P).dist).toBeCloseTo(4);
  });

  it('splats in a puddle at speed but not crawling, and nothing on a dry track', () => {
    expect(splatRates({ ...calm, puddle: 1 }, P).mud).toBeGreaterThan(0);
    expect(splatRates({ ...calm, puddle: 1, speed: 1 }, P).mud).toBe(0);
    expect(splatRates(calm, P)).toEqual({ mud: 0, drops: 0 });
  });

  it('splats more the closer you are behind', () => {
    const near = splatRates({ ...calm, leader: { dist: 2, mud: 1, speed: 9 } }, P).mud;
    const far = splatRates({ ...calm, leader: { dist: 8, mud: 1, speed: 9 } }, P).mud;
    expect(near).toBeGreaterThan(far);
  });

  it('puts drops on in rain, but not under a roof', () => {
    expect(splatRates({ ...calm, rain: 1 }, P).drops).toBeGreaterThan(0);
    expect(splatRates({ ...calm, rain: 1, covered: true }, P).drops).toBe(0);
  });

  it('is kept off by goggles in proportion', () => {
    const bare = splatRates({ ...calm, puddle: 1 }, P).mud;
    expect(splatRates({ ...calm, puddle: 1 }, { ...P, guard: 0.75 }).mud).toBeCloseTo(bare * 0.25);
    expect(splatRates({ ...calm, puddle: 1 }, { ...P, guard: 1 }).mud).toBe(0);
  });
});

describe('the lens itself', () => {
  it('stays clean when nothing is thrown', () => {
    expect(run(createLens(), 60, calm).splats).toHaveLength(0);
  });

  it('gets splattered following a muddy quad, and never holds more than the cap', () => {
    const lens = run(createLens(), 60, { ...calm, leader: { dist: 2, mud: 1, speed: 12 } });
    expect(lens.splats.length).toBeGreaterThan(3);
    expect(lens.splats.length).toBeLessThanOrEqual(P.maxSplats);
    expect(lensCoverage(lens)).toBeGreaterThan(0);
  });

  it('dries off by itself, drops long before mud', () => {
    const lens = createLens();
    const random = createRandom(3);
    addSplat(lens, random, P, 'mud');
    addSplat(lens, random, P, 'drop');
    run(lens, P.dropDryTime + 1, null);
    expect(lens.splats.map((s) => s.kind)).toEqual(['mud']);
    run(lens, P.dryTime, null);
    expect(lens.splats).toHaveLength(0);
  });

  it('smears on the first wipe and clears on the second', () => {
    const lens = createLens();
    const random = createRandom(5);
    addSplat(lens, random, P, 'mud');
    const before = { size: lens.splats[0].size, thick: lens.splats[0].thick };
    wipeLens(lens, P);
    expect(lens.splats).toHaveLength(1);
    expect(lens.splats[0].smeared).toBe(true);
    expect(lens.splats[0].size).toBeGreaterThan(before.size);
    expect(lens.splats[0].thick).toBeLessThan(before.thick);
    wipeLens(lens, P);
    expect(lens.splats).toHaveLength(0);
  });

  it('wipes raindrops away at once', () => {
    const lens = createLens();
    addSplat(lens, createRandom(2), P, 'drop');
    wipeLens(lens, P);
    expect(lens.splats).toHaveLength(0);
  });
});
