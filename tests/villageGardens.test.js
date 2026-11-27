import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { fromPlan, VILLAGE_PLAN } from '../src/world/layoutNew.js';
import { villageShape, gardenHedges, hedgeCorners } from '../src/world/village.js';
import { neighbourLandShape } from '../src/world/neighbourLand.js';
import { farmPlacements } from '../src/world/farmPlacement.js';

// The lane houses' and the small farm's garden hedges keep inside their plots (#1084): none crosses the farm yard's wall or the neighbour's z 560 hedge.

const v = villageShape(LAYOUT);
const houses = v.laneBuildings.filter((b) => b.kind !== 'barn');
const [, z560] = fromPlan([0, 560]);
const toPlanZ = (z) => z - fromPlan([0, 0])[1];
const bounds = (corners) => ({
  minX: Math.min(...corners.map((c) => c[0])), maxX: Math.max(...corners.map((c) => c[0])),
  minZ: Math.min(...corners.map((c) => c[1])), maxZ: Math.max(...corners.map((c) => c[1])),
});
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const pieces = houses.flatMap((b) => gardenHedges(b, v.gardenDepth(b)).map((p) => ({ b, p, r: bounds(hedgeCorners(b, p)) })));

describe('the lane houses\' and farmhouse\'s garden hedges (#1084)', () => {
  it('finds the three lane houses and the farmhouse, each lane house with a front hedge either side of its gate', () => {
    expect(houses.map((b) => b.id).sort()).toEqual(['fh', 'l1', 'l2', 'l3']);
    for (const id of ['l1', 'l2', 'l3']) expect(pieces.filter((q) => q.b.id === id && q.p.part === 'front').length, id).toBe(2);
  });

  it('has no hedge piece crossing any of the small farm\'s yard walls', () => {
    const yard = LAYOUT.village.approach.farm.yard;
    const half = LAYOUT.village.approach.farm.wall / 2;
    const walls = [
      { minX: yard.minX - half, maxX: yard.maxX + half, minZ: yard.minZ - half, maxZ: yard.minZ + half },
      { minX: yard.minX - half, maxX: yard.maxX + half, minZ: yard.maxZ - half, maxZ: yard.maxZ + half },
      { minX: yard.minX - half, maxX: yard.minX + half, minZ: yard.minZ - half, maxZ: yard.maxZ + half },
      { minX: yard.maxX - half, maxX: yard.maxX + half, minZ: yard.minZ - half, maxZ: yard.maxZ + half },
    ];
    for (const { b, p, r } of pieces) for (const w of walls) expect(overlaps(r, w), `${b.id}'s ${p.part} hedge`).toBe(false);
    // The farmhouse's garden is the yard: it has no hedges of its own behind it.
    expect(pieces.filter((q) => q.b.id === 'fh')).toEqual([]);
  });

  it('has no hedge piece crossing the neighbour\'s z 560 hedge, nor running past it', () => {
    const line = { minX: fromPlan([912, 0])[0], maxX: fromPlan([1282, 0])[0] };
    for (const { b, p, r } of pieces) {
      if (r.maxX < line.minX || r.minX > line.maxX) continue;
      expect(r.maxZ <= z560 || r.minZ >= z560, `${b.id}'s ${p.part} hedge from plan z ${toPlanZ(r.minZ)} to ${toPlanZ(r.maxZ)}`).toBe(true);
    }
    // l3's front hedge ends at the face of it, about z 559, so there is no gap at the corner either.
    const l3 = pieces.filter((q) => q.b.id === 'l3' && q.p.part === 'front').map((q) => toPlanZ(q.r.maxZ));
    expect(Math.max(...l3)).toBeCloseTo(VILLAGE_PLAN.approach.houses.find((h) => h.id === 'l3').plot[1], 3);
    expect(Math.max(...l3)).toBeGreaterThan(559);
  });

  it('keeps each lane house\'s front hedge inside its own plot, so no two overlap', () => {
    const fronts = pieces.filter((q) => q.p.part === 'front');
    for (const { b, r } of fronts) {
      expect(r.minZ, b.id).toBeGreaterThanOrEqual(b.plot.minZ - 1e-4);
      expect(r.maxZ, b.id).toBeLessThanOrEqual(b.plot.maxZ + 1e-4);
    }
    for (const a of fronts) for (const c of fronts) if (a.b !== c.b) expect(overlaps(a.r, c.r), `${a.b.id} and ${c.b.id}`).toBe(false);
  });

  it('leaves no stub of the neighbour\'s lane hedge at x 912 running in front of l3\'s garden', () => {
    const land = neighbourLandShape(LAYOUT);
    const [x912] = fromPlan([912, 0]);
    const [, z540] = fromPlan([0, 540]);
    const stub = land.stretches.filter((s) => Math.abs(s.x - x912) < 0.5 && s.z + s.hz > z540 && s.z - s.hz < z560);
    expect(stub).toEqual([]);
  });

  it('lists every garden hedge piece in the farm\'s placements', () => {
    const listed = farmPlacements(LAYOUT).filter((t) => t.kind === 'hedge' && t.house);
    expect(listed.filter((t) => houses.some((b) => b.id === t.house)).length).toBe(pieces.length);
  });
});
