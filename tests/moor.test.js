import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, MOOR_PLAN, BACK_LANE_PLAN, RESERVED_PLAN, LANDMARKS_PLAN } from '../src/world/layoutNew.js';
import { roadNetwork } from '../src/world/roads.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { MOOR_FEATURES_PLAN, createMoor, wallPieces, distToLine, gridPlace } from '../src/world/moor.js';
import { laneGaps, moorStretch, MOOR_SIDE } from '../src/world/backLaneProps.js';
import { laneHedgeRuns } from '../src/world/laneHedges.js';
import { turnRoundLines, TurnRound, crossed } from '../src/world/turnRound.js';

const two = layoutNew(LAYOUT, RAW_LAYOUT);
const net = roadNetwork(two);
const lane = net.road('backLane');
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const M = two.moor;

describe('the Moor in layout 2 (#713)', () => {
  it('is the ground from Back Lane to the ridge wall, about 30 ha, and the ground reaches the wall', () => {
    const w = M.bounds.maxX - M.bounds.minX;
    const d = M.bounds.maxZ - M.bounds.minZ;
    expect(w * d).toBeGreaterThan(28e4);
    expect(w * d).toBeLessThan(34e4);
    expect(M.bounds.minX).toBeCloseTo(fromPlan([MOOR_PLAN.minX, 0])[0], 6);
    for (const [x] of M.wall.points) expect(x).toBeGreaterThan(two.ground.minX + 5);
  });

  it('rises west to the ridge about 100 m above the valley floor, nowhere steeper than the hill\'s banks (38 degrees)', () => {
    const z = fromPlan([0, 480])[1];
    const ridge = heights.heightAt(fromPlan([-330, 0])[0], z);
    const floor = heights.heightAt(fromPlan([1000, 0])[0], z);
    expect(ridge - floor).toBeGreaterThan(90);
    let steepest = 0;
    for (let px = MOOR_PLAN.minX; px <= MOOR_PLAN.maxX; px += 3) {
      for (let pz = MOOR_PLAN.minZ; pz <= MOOR_PLAN.maxZ; pz += 7) {
        const [x, zz] = fromPlan([px, pz]);
        const [x2] = fromPlan([px + 1, pz]);
        const [, z2] = fromPlan([px, pz + 1]);
        if (net.nearest(x, zz, 30)) continue; // the lane's own cuttings and hairpins are #686's, not the common's
        const h = heights.heightAt(x, zz);
        steepest = Math.max(steepest, Math.atan(Math.abs(heights.heightAt(x2, zz) - h)) , Math.atan(Math.abs(heights.heightAt(x, z2) - h)));
      }
    }
    expect((steepest * 180) / Math.PI).toBeLessThan(38);
  });

  it('has outcrops and boulders clear of the lane, the stream, the wall, the pillar, the spring and the stile', () => {
    const moor = heights.moor;
    expect(moor.outcrops.length).toBeGreaterThan(15);
    expect(moor.boulders.length).toBeGreaterThan(40);
    const clearOfAll = (p) => {
      expect(net.nearest(p.x, p.z, 8)).toBeFalsy();
      expect(distToLine(M.wall.points, p.x, p.z)).toBeGreaterThan(3);
      for (const a of [M.trig.at, M.spring.at, M.stile.at]) expect(Math.hypot(p.x - a[0], p.z - a[1])).toBeGreaterThan(5);
    };
    [...moor.outcrops, ...moor.boulders].forEach(clearOfAll);
  });

  it('cuts peat banks and raises an outcrop', () => {
    const moor = heights.moor;
    const o = moor.outcrops[0];
    expect(moor.reliefAt(o.x, o.z)).toBeGreaterThan(0.3);
    const p = M.peat[0];
    const mid = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
    let lo = 0;
    for (let d = -3; d <= 3; d += 0.25) lo = Math.min(lo, moor.reliefAt(mid[0] + d * 0.3, mid[1] + d));
    expect(lo).toBeLessThan(-0.8);
  });
});

describe('the stream and its spring', () => {
  it('rises at a spring on the moor at about plan (-200, 560) and the channel runs to it', () => {
    const [sx, sz] = M.spring.at;
    const [px, pz] = [sx, sz];
    expect(Math.hypot(...[px - fromPlan([-200, 560])[0], pz - fromPlan([-200, 560])[1]])).toBeLessThan(20);
    const stream = two.hill.stream;
    expect(stream.west.minX).toBeCloseTo(sx, 3);
    // the stream's channel is cut into the ground east of the spring and gone well west of it
    const zAt = (x) => stream.z + stream.wander * Math.sin(x * 0.05 + 1.1);
    const mid = (sx + fromPlan([BACK_LANE_PLAN.ford.at[0] - 40, 0])[0]) / 2;
    const bank = heights.heightAt(mid, zAt(mid) + 6);
    expect(bank - heights.heightAt(mid, zAt(mid))).toBeGreaterThan(0.3);
    expect(Math.abs(heights.heightAt(sx - 20, zAt(sx - 20)) - heights.heightAt(sx - 20, zAt(sx - 20) + 6))).toBeLessThan(0.3);
  });
});

describe('Back Lane across the common', () => {
  it('has a cattle grid at each end of the moor stretch, near the plan\'s places', () => {
    expect(lane.moor.grids.map((g) => g.id)).toEqual(['north', 'south']);
    const near = MOOR_FEATURES_PLAN.grids.map((g) => gridPlace(lane, fromPlan(g.near)));
    expect(Math.hypot(near[0].x - fromPlan([60, 34])[0], near[0].z - fromPlan([60, 34])[1])).toBeLessThan(30);
    expect(Math.hypot(near[1].x - fromPlan([-30, 840])[0], near[1].z - fromPlan([-30, 840])[1])).toBeLessThan(40);
    expect(near[1].s).toBeGreaterThan(near[0].s);
  });

  it('is unhedged on the moor side between the grids and hedged on the farm side', () => {
    const { from, to } = moorStretch(lane);
    const runs = laneHedgeRuns(lane, laneGaps(lane));
    const mid = (from + to) / 2;
    const covers = (side, s) => runs.some((r) => r.side === side && r.from <= s && r.to >= s);
    for (const s of [from + 80, mid, to - 80]) {
      expect(covers(MOOR_SIDE, s)).toBe(false);
      expect(covers(-MOOR_SIDE, s)).toBe(true);
    }
    expect(covers(MOOR_SIDE, from - 40)).toBe(true);
  });
});

describe('the ridge wall and its stile', () => {
  it('runs the length of the common and is whole but for nothing: a collider every few metres', () => {
    const pieces = wallPieces(M.wall);
    const zs = M.wall.points.map((p) => p[1]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(870);
    for (const p of pieces) expect(p.len).toBeLessThanOrEqual(3.01);
    expect(pieces.reduce((a, p) => a + p.len, 0)).toBeGreaterThan(880);
  });

  it('has the ladder stile at the footpath\'s end, on the wall\'s line', () => {
    const end = RESERVED_PLAN.footpath.match(/-?\d+(?:\.\d+)?/g).slice(-2).map(Number);
    expect(M.stile.at).toEqual(fromPlan(end));
    expect(distToLine(M.wall.points, M.stile.at[0], M.stile.at[1])).toBeLessThan(0.01);
  });

  it('has the trig pillar and the cairn on the ridge inside the wall', () => {
    expect(M.trig.at).toEqual(fromPlan(LANDMARKS_PLAN.find((l) => l.name === 'trig pillar').at));
    expect(M.trig.at[0]).toBeGreaterThan(M.wall.points.find((p) => Math.abs(p[1] - M.trig.at[1]) < 1)[0]);
    expect(Math.hypot(M.cairn.at[0] - M.trig.at[0], M.cairn.at[1] - M.trig.at[1])).toBeLessThan(40);
  });
});

describe('climbing the stile', () => {
  const lines = turnRoundLines(net, two.turnRound, two.ground);
  const line = lines.find((l) => l.id === 'moor-stile');

  it('has a line across the way up to the stile, on the farm side of the wall', () => {
    expect(line.free).toBe(true);
    expect(line.point.x).toBeGreaterThan(M.stile.at[0]);
    expect(line.point.x - M.stile.at[0]).toBeLessThan(2);
    expect(Math.hypot(line.point.z - M.stile.at[1], 0)).toBeLessThan(0.01);
  });

  it('turns you round: fades out, puts you 25 m back the way you came, facing it, and fades in', () => {
    const t = new TurnRound({ net, lines });
    const here = { x: line.point.x + 3, z: line.point.z };
    t.update(0.016, here);
    const r = t.update(0.016, { x: line.point.x - 0.4, z: line.point.z });
    expect(r.started).toBe(true);
    expect(r.line.id).toBe('moor-stile');
    let move = null;
    for (let i = 0; i < 200 && !move; i++) move = t.update(0.016, { x: line.point.x - 0.4, z: line.point.z }).move;
    expect(move.x).toBeCloseTo(line.point.x - 0.4 + 25, 0);
    expect(Math.abs(move.yaw - Math.PI / 2)).toBeLessThan(0.01); // east, heading 0 being south
    let done = false;
    for (let i = 0; i < 200 && !done; i++) done = !!t.update(0.016, move).done;
    expect(done).toBe(true);
  });

  it('is not crossed from the wall\'s farm side by walking along the ground', () => {
    const a = { x: line.point.x + 3, z: line.point.z + 3 };
    const b = { x: line.point.x + 3, z: line.point.z - 3 };
    expect(crossed(line, a, b)).toBe(false);
  });
});
