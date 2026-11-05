import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createFields } from '../src/world/fields.js';
import { createQuarry, dealPit, dealtLayout, quarryPlants, quarryOf } from '../src/world/quarry.js';
import { createRandom } from '../src/core/random.js';
import { climbGates } from '../src/npc/hillClimb.js';

const deg = (slope) => (Math.atan(slope) * 180) / Math.PI;
const q0 = LAYOUT.quarry;
const make = (seed) => {
  const layout = dealtLayout(LAYOUT, seed);
  const heights = createTerrainHeight(layout, new Track(layout.trackPoints));
  return { layout, heights, quarry: heights.quarry, fields: createFields(layout) };
};
const base = make(51);
const { quarry, heights, fields } = base;
const slopeAt = (h, x, z) => deg(Math.hypot(h.heightAt(x + 1, z) - h.heightAt(x, z), h.heightAt(x, z + 1) - h.heightAt(x, z)));

describe('the gravel pit: how it is dealt', () => {
  it('is the same for a farm every time and different between farms', () => {
    const a = dealPit(q0, createRandom(7));
    expect(dealPit(q0, createRandom(7))).toEqual(a);
    expect(dealPit(q0, createRandom(8))).not.toEqual(a);
    expect(dealtLayout(LAYOUT, 123).quarry.pit).toEqual(dealtLayout(LAYOUT, 123).quarry.pit);
    expect(dealtLayout(LAYOUT, 123).quarry.pit).not.toEqual(dealtLayout(LAYOUT, 124).quarry.pit);
  });

  it('gives an undealt layout the same fixed pit each time', () => {
    expect(quarryOf(LAYOUT).pit).toEqual(quarryOf(LAYOUT).pit);
  });

  it('always keeps the lip inside the hedges, deep enough to matter, with a way in and a way to climb', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const q = createQuarry(dealtLayout(LAYOUT, seed * 7919));
      const { rect, pit } = q;
      expect(pit.depth, `seed ${seed}`).toBeGreaterThanOrEqual(18);
      expect(pit.depth).toBeLessThanOrEqual(22);
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const p = q.frameAt(a, q.rimAt(a));
        expect(Math.min(p.x - rect.minX, rect.maxX - p.x, p.z - rect.minZ), `seed ${seed} rim at ${i}`).toBeGreaterThan(5.9);
        expect(q.runAt(a)).toBeGreaterThan(7);
      }
      // The steep wall is steeper than the rest on average, and has two chutes in it.
      expect(pit.steepRun).toBeLessThan(pit.gentleRun - 2);
      for (const b of pit.buttresses) expect(q.runAt(b.at)).toBeLessThan(pit.steepRun);
      expect(pit.chutes).toHaveLength(2);
      for (const c of pit.chutes) expect(q.runAt(c.at)).toBeGreaterThan(pit.steepRun);
      expect(pit.heaps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the heaps on the floor, clear of the pond, the road end and the start of the climb', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = createQuarry(dealtLayout(LAYOUT, seed * 104729));
      const [sx, sz] = q.climb.points[0];
      for (const h of q.pit.heaps) {
        const { a, s } = q.polar(h.x, h.z);
        expect(s + h.r * 0.8, `seed ${seed}`).toBeLessThan(q.floorEdge(a) + 0.01);
        expect(Math.hypot(h.x - q.pond.x, h.z - q.pond.z)).toBeGreaterThan(h.r + 2);
        expect(Math.hypot(h.x - sx, h.z - sz)).toBeGreaterThan(h.r + 7);
      }
      for (const [i, a] of q.pit.heaps.entries()) for (const b of q.pit.heaps.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.r + b.r);
    }
  });
});

describe('the gravel pit: the ground', () => {
  it('is cut to its depth, flat-ish on the floor and level outside', () => {
    const p = quarry.pit;
    const lip = quarry.frameAt(p.road.from + Math.PI, quarry.rimAt(p.road.from + Math.PI) + 3);
    const rimGround = heights.heightAt(lip.x, lip.z);
    const floorPoint = quarry.frameAt(p.steepAt + Math.PI, quarry.floorEdge(p.steepAt + Math.PI) - 12);
    const floor = heights.heightAt(floorPoint.x, floorPoint.z) - quarry.heapRise(floorPoint.x, floorPoint.z) + quarry.pondCut(floorPoint.x, floorPoint.z);
    expect(rimGround - floor).toBeGreaterThan(p.depth - 1.2);
    expect(rimGround - floor).toBeLessThan(p.depth + 1.2);
  });

  it('has banks between 25 and 55 degrees on the walls, the steep wall the steepest, and no cliffs or spikes anywhere in the field', () => {
    const rect = quarry.rect;
    let worst = 0;
    for (let x = rect.minX + 1; x < rect.maxX - 1; x += 1.5) {
      for (let z = rect.minZ + 1; z < rect.maxZ - 1; z += 1.5) worst = Math.max(worst, slopeAt(heights, x, z));
    }
    expect(worst).toBeLessThan(76);
    // Up the middle of the steep wall, the average slope is steep but a quad could try it.
    const a = quarry.pit.buttresses[0].at; // the steep wall where there is no chute
    const top = quarry.frameAt(a, quarry.rimAt(a));
    const foot = quarry.frameAt(a, quarry.floorEdge(a));
    const mean = deg((heights.heightAt(top.x, top.z) - heights.heightAt(foot.x, foot.z)) / Math.hypot(top.x - foot.x, top.z - foot.z));
    expect(mean).toBeGreaterThan(36);
    expect(mean).toBeLessThan(56);
    // And the easy walls are gentler.
    const e = quarry.pit.steepAt + Math.PI;
    const etop = quarry.frameAt(e, quarry.rimAt(e));
    const efoot = quarry.frameAt(e, quarry.floorEdge(e));
    const easy = deg((heights.heightAt(etop.x, etop.z) - heights.heightAt(efoot.x, efoot.z)) / Math.hypot(etop.x - efoot.x, etop.z - efoot.z));
    expect(easy).toBeLessThan(mean - 4);
  });

  it('has chutes in the steep wall you can climb at 34 degrees or less on average (a 20 m wall at 36 to 38 was not climbable), and buttresses you cannot', () => {
    for (const seed of [51, 123, 4242]) {
      const { quarry: q, heights: h } = make(seed);
      for (const c of q.pit.chutes) {
        const top = q.frameAt(c.at, q.rimAt(c.at));
        const foot = q.frameAt(c.at, q.floorEdge(c.at));
        const slope = deg((h.heightAt(top.x, top.z) - h.heightAt(foot.x, foot.z)) / Math.hypot(top.x - foot.x, top.z - foot.z));
        expect(slope, `seed ${seed}`).toBeLessThan(34);
      }
    }
    for (const b of quarry.pit.buttresses) {
      const top = quarry.frameAt(b.at, quarry.rimAt(b.at));
      const foot = quarry.frameAt(b.at, quarry.floorEdge(b.at));
      const slope = deg((heights.heightAt(top.x, top.z) - heights.heightAt(foot.x, foot.z)) / Math.hypot(top.x - foot.x, top.z - foot.z));
      expect(slope).toBeGreaterThan(36);
    }
  });

  it('winds the haul roads down the wall at a grade a quad can take, from the gate to the floor, one each way round', () => {
    const grade = (pts) => {
      let steepest = 0;
      let down = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const drop = heights.heightAt(a.x, a.z) - heights.heightAt(b.x, b.z);
        if (b.t > 0) steepest = Math.max(steepest, drop / Math.hypot(b.x - a.x, b.z - a.z));
        down += drop;
      }
      return { steepest: deg(steepest), down };
    };
    const main = quarry.roadPoints;
    const other = quarry.rampPoints;
    expect(main[0].t).toBe(0);
    expect(main[main.length - 1].t).toBeCloseTo(1, 5);
    expect(other[other.length - 1].t).toBeCloseTo(1, 5);
    expect(Math.hypot(main[0].x - quarry.gate.x, main[0].z - quarry.rect.maxZ)).toBeLessThan(1);
    // They leave the same point on the lip and go round opposite ways.
    const lipEnd = main.filter((p) => p.t === 0).pop();
    expect(Math.hypot(other[0].x - lipEnd.x, other[0].z - lipEnd.z)).toBeLessThan(0.5);
    const sideOf = (pts) => Math.sign(Math.sin(pts[pts.length - 1].a - pts[0].a));
    expect(sideOf(main)).toBe(-sideOf(other));
    for (const pts of [main, other]) {
      const g = grade(pts);
      expect(g.down).toBeGreaterThan(quarry.pit.depth - 1.5);
      expect(g.steepest).toBeLessThan(19);
    }
    expect(quarry.roadLength).toBeGreaterThan(100);
    // Their surface is level across.
    const mid = main[Math.floor(main.length * 0.8)];
    const next = main[Math.floor(main.length * 0.8) + 1];
    const nx = -(next.z - mid.z);
    const nz = next.x - mid.x;
    const len = Math.hypot(nx, nz);
    const across = [-1.5, 0, 1.5].map((o) => heights.heightAt(mid.x + (nx / len) * o, mid.z + (nz / len) * o));
    expect(Math.max(...across) - Math.min(...across)).toBeLessThan(0.9);
  });

  it('keeps the two roads apart once they have left the lip, for every farm', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = createQuarry(dealtLayout(LAYOUT, seed * 4093));
      for (const a of q.roadPoints.filter((p) => p.t > 0.3)) {
        for (const b of q.rampPoints.filter((p) => p.t > 0.3)) expect(Math.hypot(a.x - b.x, a.z - b.z), `seed ${seed}`).toBeGreaterThan(q.roadHalf * 2 + 1);
      }
    }
  });

  it('is big enough: at least 80 by 62 m at the lip, with a floor of its own', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = createQuarry(dealtLayout(LAYOUT, seed * 2711));
      const xs = [];
      const zs = [];
      for (let i = 0; i < 72; i++) {
        const p = q.frameAt((i / 72) * Math.PI * 2, q.rimAt((i / 72) * Math.PI * 2));
        xs.push(p.x);
        zs.push(p.z);
      }
      const wide = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      const narrow = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      expect(wide, `seed ${seed}`).toBeGreaterThan(80);
      expect(narrow, `seed ${seed}`).toBeGreaterThan(62);
      for (let i = 0; i < 72; i++) expect(q.floorEdge((i / 72) * Math.PI * 2), `seed ${seed}`).toBeGreaterThan(4);
    }
  });

  it('holds water in the pond only, and not much of it', () => {
    const p = quarry.pond;
    expect(quarry.waterAt(p.x, p.z)).toBe(1);
    expect(heights.puddleAt(p.x, p.z)).toBe(1);
    expect(quarry.waterAt(p.x + p.rx * 1.5, p.z)).toBe(0);
    const [sx, sz] = quarry.climb.points[0];
    expect(quarry.waterAt(sx, sz)).toBe(0);
    expect(p.water).toBeLessThan(0.5);
    expect(quarry.mudAt(p.x + p.rx * 1.1, p.z)).toBeGreaterThan(0.3);
    expect(heights.mudAt(p.x + p.rx * 1.1, p.z)).toBeGreaterThan(0.3);
  });

  it('is loose underfoot: the walls loosest, the floor and road less, none in the field', () => {
    const a = quarry.pit.steepAt;
    const wall = quarry.frameAt(a, quarry.rimAt(a) - quarry.runAt(a) * 0.5);
    const [fx, fz] = quarry.climb.points[0];
    const road = quarry.roadPoints[quarry.roadPoints.length - 3];
    expect(quarry.gravelAt(wall.x, wall.z)).toBeGreaterThan(0.85);
    expect(quarry.gravelAt(fx, fz)).toBeGreaterThan(0.6);
    expect(quarry.gravelAt(fx, fz)).toBeLessThan(quarry.gravelAt(wall.x, wall.z));
    expect(quarry.gravelAt(road.x, road.z)).toBeGreaterThan(0.5);
    expect(quarry.gravelAt(quarry.rect.minX + 4, quarry.rect.minZ + 4)).toBe(0);
    expect(quarry.gravelAt(0, 0)).toBe(0);
  });

  it('puts the heaps on the floor, up to their height', () => {
    for (const h of quarry.pit.heaps) {
      expect(quarry.heapRise(h.x, h.z)).toBeGreaterThan(h.h * 0.85);
      expect(quarry.heapRise(h.x + h.r * 1.05, h.z)).toBeLessThan(0.3);
    }
  });

  it('does not move the ground anywhere else on the farm', () => {
    const without = { ...LAYOUT, quarry: undefined };
    const plain = createTerrainHeight(without, new Track(without.trackPoints));
    for (const [x, z] of [[0, 0], [-60, 60], [120, 20], [140, -40], [60, -150], [-30, -120], [130, 150], [40, 160]]) {
      expect(heights.heightAt(x, z), `${x}, ${z}`).toBeCloseTo(plain.heightAt(x, z), 5);
    }
  });

  it('keeps the field flat to the hedges, with no step where it meets the barley field or the wood', () => {
    for (const x of [90, 110, 140, 170, 195]) {
      const north = heights.heightAt(x, -79.2);
      const south = heights.heightAt(x, -80.8);
      expect(Math.abs(north - south)).toBeLessThan(0.5);
    }
    for (const z of [-90, -120, -150, -190]) expect(Math.abs(heights.heightAt(79.2, z) - heights.heightAt(80.8, z))).toBeLessThan(0.7);
  });
});

describe('the gravel pit: its field', () => {
  it('is a field of its own, through a gate in the barley field\'s north hedge', () => {
    const [gx, gz] = [quarry.gate.x, quarry.rect.maxZ];
    expect(fields.areaOf(gx, gz - 3)).toBe('quarry');
    expect(fields.areaOf(gx, gz + 3)).toBe('north');
    const gap = fields.hedges.find((h) => h.alongX && h.z1 === gz && h.x1 === 80).gaps.find((g) => g.id === 'quarry');
    expect(gap).toMatchObject({ at: gx, gate: true, shut: false });
    expect(gap.half).toBeCloseTo(quarry.gate.width / 2 + 0.35);
    expect(fields.gates.quarry).toBe(gap);
  });

  it('is hedged on its other three sides, the wood\'s east hedge being its west', () => {
    const r = quarry.rect;
    const has = (pred) => fields.hedges.some(pred);
    expect(has((h) => h.alongX && h.z1 === r.minZ && h.x1 === r.minX && h.x2 === r.maxX)).toBe(true);
    expect(has((h) => !h.alongX && h.x1 === r.maxX && h.z1 === r.minZ && h.z2 === r.maxZ)).toBe(true);
    expect(has((h) => !h.alongX && h.x1 === r.minX && h.z1 === r.minZ && h.z2 === r.maxZ)).toBe(true);
  });

  it('is reached from the farm only through the gate, and a girl routes through it', () => {
    const from = { x: 120, z: -40 };
    const to = { x: quarry.gate.x - 20, z: quarry.rect.minZ + 20 };
    const route = fields.route(from, to);
    expect(route.length).toBeGreaterThan(1);
    expect(route.some((p) => Math.abs(p.x - quarry.gate.x) < 0.01 && p.z > quarry.rect.maxZ - 3)).toBe(true);
    expect(fields.route({ x: 0, z: 0 }, to).length).toBeGreaterThan(2);
  });

  it('counts as part of the farm for the hedges, the map and the distant trees', () => {
    expect(fields.outside(140, -150)).toBe(0);
    expect(quarry.weight(140, -150)).toBe(1);
    expect(quarry.weight(0, 0)).toBe(0);
    expect(fields.areas.quarry).toMatchObject({ minX: 80, maxX: 200, minZ: -200, maxZ: -80 });
  });

  it('makes a follower wait just inside the gate rather than go down the road', () => {
    expect(quarry.pastGate(quarry.gate.x, quarry.rect.maxZ - 3)).toBe(false);
    expect(quarry.pastGate(quarry.gate.x, quarry.rect.maxZ - 30)).toBe(true);
    expect(quarry.inQuarry(quarry.waitSpot.x, quarry.waitSpot.z)).toBe(true);
    expect(quarry.pastGate(quarry.waitSpot.x, quarry.waitSpot.z)).toBe(false);
  });
});

describe('the gravel pit: the climb and the plants', () => {
  it('has start cones on the floor, a gate on the wall and the finish over the lip, all in a line up the steep wall', () => {
    const [start, mid, finish] = quarry.climb.points;
    expect(quarry.inPit(...start)).toBe(true);
    expect(quarry.inPit(...mid)).toBe(true);
    expect(quarry.inPit(...finish)).toBe(false);
    const hs = start.length ? heights.heightAt(start[0], start[1]) : 0;
    expect(heights.heightAt(mid[0], mid[1])).toBeGreaterThan(hs + 2);
    expect(heights.heightAt(finish[0], finish[1])).toBeGreaterThan(hs + quarry.pit.depth - 1.5);
    const gates = climbGates(quarry.climb);
    expect(gates).toHaveLength(3);
    for (const g of gates) expect(g.half).toBe(quarry.climb.gateHalf);
    expect(gates[0].tx * (finish[0] - start[0]) + gates[0].tz * (finish[1] - start[1])).toBeGreaterThan(0);
  });

  it('has gates wide enough to take in both chutes, for every farm', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = createQuarry(dealtLayout(LAYOUT, seed * 6151));
      const [, , finish] = q.climb.points;
      const g = climbGates(q.climb)[2];
      for (const c of q.pit.chutes) {
        const p = q.frameAt(c.at, q.rimAt(c.at) + 5);
        const lateral = (p.x - finish[0]) * -g.tz + (p.z - finish[1]) * g.tx;
        expect(Math.abs(lateral), `seed ${seed}`).toBeLessThanOrEqual(q.climb.gateHalf);
      }
      expect(q.climb.gateHalf).toBeLessThan(26);
    }
  });

  it('keeps bushes and trees off the pit, the road and the gate, and boulders off the water and the start line', () => {
    const plants = quarryPlants(quarry, createRandom(5));
    expect(plants.bushes.length).toBeGreaterThan(60);
    for (const [x, z] of [...plants.bushes, ...plants.trees]) {
      expect(quarry.inPit(x, z)).toBe(false);
      expect(quarry.roadNear(x, z).d).toBeGreaterThan(quarry.roadHalf);
      expect(Math.hypot(x - quarry.gate.x, z - quarry.rect.maxZ)).toBeGreaterThan(8.9);
    }
    const [sx, sz] = quarry.climb.points[0];
    for (const [x, z] of plants.boulders) {
      expect(quarry.waterAt(x, z)).toBe(0);
      expect(Math.hypot(x - sx, z - sz)).toBeGreaterThanOrEqual(4);
    }
    expect(plants.boulders.length).toBeGreaterThan(30);
    expect(plants.big.length).toBeGreaterThan(3);
    for (const [x, z] of plants.big) expect(Math.hypot(x - sx, z - sz)).toBeGreaterThanOrEqual(9);
  });
});
