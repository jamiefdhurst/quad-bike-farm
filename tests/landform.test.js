import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, LANDFORM_PLAN, landformPoints, PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { createLandform } from '../src/world/landform.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { stripFrame } from '../src/world/layout.js';

// The land's lie on the new farm (#813): falling east to the valley floor, rising west to the moor's ridge 100 m up.
const two = LAYOUT;
const plan = createLandform(LANDFORM_PLAN);
const game = createLandform(two.landform);
const heights2 = createTerrainHeight(two, new Track(two.trackPoints));
const heights1 = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
// The same two with the stubble fields' own lie left out (today's south field rises 4 m; the new farm's wheat does not: its lie is the land's).
const flat2 = createTerrainHeight({ ...two, stubbleFields: {} }, new Track(two.trackPoints));
const flat1 = createTerrainHeight({ ...LAYOUT, stubbleFields: {} }, new Track(LAYOUT.trackPoints));
const PLAN_X = { ridge: -330, backLane: 30, yard: 520, lane: 885, aRoad: 1300 };
const slopeDeg = (f, x0, x1) => {
  let worst = 0;
  for (let x = x0; x < x1; x += 2) worst = Math.max(worst, Math.abs((Math.atan((f(x + 2) - f(x)) / 2) * 180) / Math.PI));
  return worst;
};

describe('the shape through the farm', () => {
  it('has the valley floor flat from the A-road out, at 0', () => {
    expect(plan(PLAN_X.aRoad)).toBe(0);
    expect(plan(1000)).toBe(0);
    expect(plan(990)).toBeGreaterThan(0);
    expect(slopeDeg(plan, 1000, 1400)).toBe(0);
  });
  it('falls east at every point from the ridge to the valley floor', () => {
    for (let x = PLAN_X.ridge; x < 1000; x += 5) expect(plan(x + 5), `x ${x}`).toBeLessThanOrEqual(plan(x));
    for (let x = PLAN_X.ridge + 10; x < 990; x += 20) expect(plan(x + 5), `x ${x}`).toBeLessThan(plan(x));
  });
  it('rises west to the ridge, 100 m above the valley floor, and levels off there', () => {
    expect(plan(PLAN_X.ridge) - plan(PLAN_X.aRoad)).toBe(100);
    expect(plan(PLAN_X.ridge - 200)).toBe(100);
    expect(slopeDeg(plan, PLAN_X.ridge, PLAN_X.ridge + 5)).toBeLessThan(1);
  });
  it('is gentle across the farm and steeper up the moor, nothing near the hill\'s 38 degrees', () => {
    expect(slopeDeg(plan, PLAN_X.backLane + 70, PLAN_X.lane)).toBeLessThan(4.5);
    expect(slopeDeg(plan, PLAN_X.backLane, PLAN_X.lane)).toBeLessThan(7); // the foot of the moor, at Back Lane
    expect(slopeDeg(plan, PLAN_X.ridge, PLAN_X.backLane)).toBeLessThan(12);
    expect(slopeDeg(plan, PLAN_X.ridge, PLAN_X.backLane)).toBeGreaterThan(slopeDeg(plan, PLAN_X.backLane + 70, PLAN_X.lane));
  });
  it('never overshoots a height it is given', () => {
    for (let x = -400; x < 1100; x += 1) {
      expect(plan(x)).toBeGreaterThanOrEqual(0);
      expect(plan(x)).toBeLessThanOrEqual(100);
    }
    for (const [x, h] of LANDFORM_PLAN) expect(plan(x)).toBeCloseTo(h, 9);
  });
});

describe('in the layout', () => {
  it('is the same shape in game metres, relative to the yard (the game\'s 0, 0), so the yard keeps the height it has today', () => {
    expect(PLAN_ORIGIN[0]).toBe(520);
    expect(game(0)).toBeCloseTo(0, 9);
    for (let px = -400; px < 1200; px += 37) expect(game(px - 520) + plan(520), `plan x ${px}`).toBeCloseTo(plan(px), 9);
    expect(landformPoints().find(([x]) => x === 0)[1]).toBe(0);
    expect(() => landformPoints([[0, 1], [10, 0]])).toThrow(/yard/);
  });
  it('is only on the new farm: today\'s has none and keeps its own rise beyond the hedges', () => {
    expect(two.landform.length).toBe(LANDFORM_PLAN.length);
  });
});

describe('the ground that is built from it', () => {
  const at = (px, pz) => fromPlan([px, pz]);
  // The farm's own rolling is under 3 m either way, and today's hill, wood and pit sit round the yard, so look at the far ends.
  it('rises west and falls east: the moor, the farm and the valley floor in order', () => {
    const avg = (px) => [200, 365, 560].reduce((s, pz) => s + heights2.heightAt(...at(px, pz)), 0) / 3;
    const moor = avg(-300);
    const west = avg(100);
    const east = avg(885);
    const valley = avg(1100);
    expect(moor).toBeGreaterThan(west + 20);
    expect(west).toBeGreaterThan(east + 10);
    expect(east).toBeGreaterThan(valley + 2);
    expect(moor - valley).toBeGreaterThan(90);
    expect(moor - valley).toBeLessThan(110);
  });
  it('has no step the land\'s lie added: the steepest metre is the one today\'s ground has', () => {
    const ground = two.ground;
    const steepest = (h) => {
      let worst = 0;
      for (let x = ground.minX; x < ground.maxX; x += 9) {
        for (let z = ground.minZ; z < ground.maxZ; z += 9) worst = Math.max(worst, Math.abs(h.heightAt(x + 1, z) - h.heightAt(x, z)));
      }
      return worst;
    };
    expect(steepest(heights2)).toBeLessThan(steepest(heights1) + 0.05);
  });
});
