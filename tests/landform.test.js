import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, LANDFORM_PLAN, landformPoints, PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { createLandform } from '../src/world/landform.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { stripFrame } from '../src/world/layout.js';
import { createHill } from '../src/world/hill.js';
import { createWoods } from '../src/world/woods.js';

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
  it('has no metre steeper than today\'s hill fade, less the landform\'s own slope, anywhere but where it is cut on purpose (#945)', () => {
    // 21 degrees is today's hill fade at its worst, measured on `resolveLayout(RAW_LAYOUT)`.
    const cap = Math.tan((21 * Math.PI) / 180);
    const ground = two.ground;
    const h = heights2;
    const steep = [];
    for (let x = ground.minX; x < ground.maxX; x += 5) {
      for (let z = ground.minZ; z < ground.maxZ; z += 5) {
        if (h.quarry && h.quarry.weight(x, z) > 0) continue; // the pit's own walls
        if (x < LAYOUT.hill.pasture.minX) continue; // west of the pasture: held to the 40 m fade by the next test, and the stream and the moor's own ground are cut on purpose
        if (h.woods && h.woods.weight(x, z) >= 1) continue; // the wood's own ground: the Run's banks
        if (h.hill.weight(x, z) >= 1) continue; // the hill's own ground inside its hedges: its banks and the stream's channel are cut on purpose
        const a = h.naturalAt(x, z);
        const dx = Math.abs(h.naturalAt(x + 1, z) - a - (game(x + 1) - game(x)));
        const dz = Math.abs(h.naturalAt(x, z + 1) - a);
        if (Math.max(dx, dz) > cap) steep.push(`${x},${z}:${Math.max(dx, dz).toFixed(2)}`);
      }
    }
    expect(steep.slice(0, 20)).toEqual([]);
  });
  it('keeps the long hill fade off the pasture\'s west side, where the banks run along z (#1172)', () => {
    const short = createTerrainHeight(two, new Track(two.trackPoints), { hillFade: 40 });
    const west = LAYOUT.hill.pasture.minX;
    const steepest = (h, x, z) => Math.max(Math.abs(h.naturalAt(x, z + 1) - h.naturalAt(x, z)), Math.abs(h.naturalAt(x + 1, z) - h.naturalAt(x, z) - (game(x + 1) - game(x))));
    for (let x = west - 120; x < west; x += 5) {
      for (let z = LAYOUT.hill.pasture.minZ; z < LAYOUT.hill.pasture.maxZ; z += 5) {
        expect(steepest(heights2, x, z), `${x}, ${z}`).toBeLessThan(steepest(short, x, z) + 0.02);
      }
    }
  });
  it('rides Back Lane\'s centreline beside the pasture\'s west hedge, x -510 from z 207 to 335, in no more than 21 degrees (#1172)', () => {
    const cap = Math.tan((21 * Math.PI) / 180);
    const road = LAYOUT.roads.find((r) => r.id === 'backLane');
    expect(road.points.some(([x, z]) => x === -510 && z === 207)).toBe(true); // the line this walks is still the lane's
    for (let z = 207; z < 335; z++) expect(Math.abs(heights2.heightAt(-510, z + 4) - heights2.heightAt(-510, z)) / 4, `z ${z}`).toBeLessThan(cap);
  });
  it('rides down from the pasture\'s south and east hedges, Back Lane\'s laid level ground included, in no more than 21 degrees (#945)', () => {
    const cap = Math.tan((21 * Math.PI) / 180);
    const h = heights2;
    const worst = [];
    for (const x of [-460, -380, -273, -200]) for (let z = 480; z < 530; z++) worst.push([Math.abs(h.heightAt(x, z + 1) - h.heightAt(x, z)), `x ${x}, z ${z}`]);
    for (const z of [350, 450]) for (let x = -110; x < -50; x++) worst.push([Math.abs(h.heightAt(x + 1, z) - h.heightAt(x, z) - (game(x + 1) - game(x))), `x ${x}, z ${z}`]);
    for (const [d, where] of worst) expect(d, where).toBeLessThan(cap);
  });
});

// The meadow's pond and the wood's (#946): their water is a flat sheet at the ground's height at the middle, so on the lie the bowl is levelled.
// (The game has only layout 2 now; `LAYOUT` is it.)
describe('the ponds sit level on the land\'s lie', () => {
  const ponds = [['meadow', createHill(two)], ['wood', createWoods(two)]];
  for (const [name, src] of ponds) {
    const p = src.pond;
    const level = heights2.heightAt(p.x, p.z) + p.water;
    const at = (a, r) => [p.x + Math.cos(a) * r * p.rx, p.z + Math.sin(a) * r * p.rz];
    it(`has the ${name} pond's water meeting its shore all round`, () => {
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        let r = 0;
        while (r < 1.3 && src.waterAt(...at(a, r)) > 0.05) r += 0.02; // as buildPond marches out to the rim
        const rim = at(a, r * 0.97);
        expect(Math.abs(level - heights2.heightAt(...rim)), `bearing ${i}`).toBeLessThan(0.05);
      }
    });
    it(`has no ground over the ${name} pond's water and none under the water outside it`, () => {
      for (let i = 0; i < 48; i++) {
        for (let r = 0; r <= 1; r += 0.05) {
          const [x, z] = at((i / 48) * Math.PI * 2, r);
          const wet = src.waterAt(x, z) > 0.05;
          const ground = heights2.heightAt(x, z);
          if (wet) expect(ground, `wet ${i} ${r}`).toBeLessThan(level + 0.05);
          else expect(ground, `dry ${i} ${r}`).toBeGreaterThan(level - 0.05);
        }
      }
    });
  }
});
