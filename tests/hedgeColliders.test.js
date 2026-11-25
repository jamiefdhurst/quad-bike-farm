import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { layHedge, layLaneHedge } from '../src/world/hedgeLay.js';
import { roadNetwork } from '../src/world/roads.js';
import { laneHedgeRuns, laneGaps } from '../src/world/laneHedges.js';
import { aRoadGaps } from '../src/world/aRoadFittings.js';
import { HEDGE_SOLID_HALF, HEDGE_LEAF_SLACK, leafReach, blockWidth, bushHeight, widestBlock } from '../src/world/hedgeSolid.js';
import { glbModel, outline } from './helpers/hedgeModels.js';

// A hedge is solid as far as its leaves reach, and its leaves stay out of its gateways (#829). Built from the real hedge and bush models' vertices
// and the same laying-out props.js uses, so a block or bush that sticks out past the collider, or into a way through, fails here.

const hedge = glbModel('hedge');
const bush = glbModel('bush');
hedge.corners = outline(hedge.verts);
bush.corners = outline(bush.verts);
const blockReach = leafReach(hedge.root, hedge.size);
const bushReach = leafReach(bush.root, { x: bush.size.y, z: bush.size.y });
const T = LAYOUT.hedgeThickness;
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const lines = createFields(LAYOUT).hedges;

/** Every leaf vertex of every block and bush of a laid hedge, as { s (along), a (across) } in the hedge's own frame. */
function leaves(h, lay) {
  const out = [];
  const frame = (x, z) => {
    const flip = h.dx - h.dz < 0 ? -1 : 1;
    const side = { x: -h.dz * flip, z: h.dx * flip };
    const rx = x - h.x1;
    const rz = z - h.z1;
    return { s: rx * h.dx + rz * h.dz, a: rx * side.x + rz * side.z };
  };
  for (const b of lay.blocks) {
    const c = Math.cos(b.spin);
    const sn = Math.sin(b.spin);
    for (const v of hedge.corners) {
      const x = (v[0] / hedge.size.x) * b.width;
      const z = (v[2] / hedge.size.z) * b.width;
      out.push(frame(b.x + c * x + sn * z, b.z - sn * x + c * z));
    }
  }
  for (const b of lay.bushes) {
    const k = b.height / bush.size.y;
    const c = Math.cos(b.yaw);
    const sn = Math.sin(b.yaw);
    for (const v of bush.corners) out.push(frame(b.x + c * v[0] * k + sn * v[2] * k, b.z - sn * v[0] * k + c * v[2] * k));
  }
  return out;
}

const laid = lines.map((h) => ({ h, lay: layHedge(h, { T, H: h.height ?? LAYOUT.hedgeHeight, heightAt: () => 0, random: seeded(1234), blockReach, bushReach }) }));
for (const l of laid) l.pts = leaves(l.h, l.lay); // once: every vertex of every block

describe('hedge leaves and colliders', () => {
  it('keeps every leaf within the solid part and a hand, on every hedge', () => {
    let blocks = 0;
    let bushes = 0;
    for (const { h, lay, pts } of laid) {
      blocks += lay.blocks.length;
      bushes += lay.bushes.length;
      const worst = pts.reduce((m, p) => Math.max(m, Math.abs(p.a)), 0);
      expect(worst).toBeLessThanOrEqual(HEDGE_SOLID_HALF + HEDGE_LEAF_SLACK + 1e-6);
    }
    expect(blocks).toBeGreaterThan(1000);
    expect(bushes).toBeGreaterThan(100);
  });

  it('keeps leaves out of every gateway', () => {
    for (const { h, pts } of laid) {
      for (const p of pts) for (const g of h.gaps) expect(Math.abs(p.s - g.at)).toBeGreaterThanOrEqual(g.half - HEDGE_LEAF_SLACK - 1e-6);
    }
  });

  it('has a collider at every metre of a hedge except in its gateways, none in them', () => {
    for (const { h, lay } of laid) {
      for (let s = -1.5; s <= h.length + 1.5; s += 0.1) {
        const open = h.gaps.some((g) => Math.abs(s - g.at) < g.half);
        const covered = lay.colliders.some((k) => s >= k.s0 - 1e-6 && s <= k.s1 + 1e-6);
        if (open) expect(lay.colliders.some((k) => s > k.s0 + 1e-6 && s < k.s1 - 1e-6)).toBe(false);
        else expect(covered).toBe(true);
      }
    }
  });

  it('stops a walking capsule before any leaf clump, from either side, all along every hedge', () => {
    const r = 0.3; // the capsule's radius in plan
    for (const { h, lay, pts } of laid) {
      const byMetre = new Map(); // the leaves in each 0.5 m along the hedge, so each crossing looks only at its own
      for (const p of pts) {
        const key = Math.floor(p.s / 0.5);
        byMetre.set(key, [...(byMetre.get(key) ?? []), p]);
      }
      for (let s = -1; s <= h.length + 1; s += 0.25) {
        if (h.gaps.some((g) => Math.abs(s - g.at) < g.half + r)) continue; // the way through: walked freely
        const k = lay.colliders.find((c) => s >= c.s0 && s <= c.s1);
        expect(k, `a collider where the capsule crosses at ${s} on a hedge at ${h.x1.toFixed(0)}, ${h.z1.toFixed(0)}`).toBeDefined();
        for (let key = Math.floor((s - r) / 0.5); key <= Math.floor((s + r) / 0.5); key++) {
          for (const p of byMetre.get(key) ?? []) if (Math.abs(p.s - s) < r) expect(Math.abs(p.a)).toBeLessThanOrEqual(k.across + HEDGE_LEAF_SLACK); // any leaf further out is one the capsule would have to push through
        }
      }
    }
  });

  it('shrinks a block or bush only as far as it must', () => {
    expect(blockWidth(T, 0, blockReach, 0)).toBeCloseTo(T * 0.95, 6); // a slim block is as it was
    expect(blockWidth(T, 1, blockReach, 0.2)).toBeLessThanOrEqual(widestBlock(blockReach, 0.2) + 1e-9);
    expect(bushHeight(1, bushReach, 0.1) * bushReach + 0.1).toBeLessThanOrEqual(HEDGE_SOLID_HALF + HEDGE_LEAF_SLACK + 1e-9);
  });
});

// Back Lane's and the A-road's hedges (#1122): each run starts and ends at a gate, the ford, a stile, a bridle gate or a junction, so its leaves stop at the
// run's ends and its collider ends there too, and every leaf is within the collider and a hand across. Laid as the game lays them (hedgeLay.js `layLaneHedge`).
describe("the lanes' hedges at their gateways", () => {
  const net = roadNetwork(LAYOUT);
  const roads = [['backLane', (r) => laneGaps(r)], ['aRoad', (r) => aRoadGaps(net, r, LAYOUT)]].map(([id, gapsOf]) => {
    const road = net.road(id);
    const gaps = gapsOf(road);
    const runs = laneHedgeRuns(road, gaps).map((run) => ({ run, lay: layLaneHedge(road, run, { T, H: 2, heightAt: () => 0, random: seeded(77), blockReach }) }));
    return { id, road, gaps, runs };
  });
  /** Every leaf vertex of a block as { s (along the road), a (across, from the hedge's line) }: near the block, the road is straight enough to take its heading there. */
  const leafPoints = (road, run, lay, b) => {
    const mid = lay.at(b.s);
    const ahead = lay.at(b.s + 0.5);
    const len = Math.hypot(ahead.x - mid.x, ahead.z - mid.z) || 1;
    const ux = (ahead.x - mid.x) / len;
    const uz = (ahead.z - mid.z) / len;
    const c = Math.cos(b.spin);
    const sn = Math.sin(b.spin);
    return hedge.corners.map((v) => {
      const x = (v[0] / hedge.size.x) * b.width;
      const z = (v[2] / hedge.size.z) * b.width;
      const dx = b.x + c * x + sn * z - mid.x;
      const dz = b.z - sn * x + c * z - mid.z;
      return { s: b.s + dx * ux + dz * uz, a: -dx * uz + dz * ux };
    });
  };

  it('keeps every leaf out of each gateway and within the run, so none hangs past the collider', () => {
    let blocks = 0;
    for (const { id, road, gaps, runs } of roads) {
      for (const { run, lay } of runs) {
        for (const b of lay.blocks) {
          blocks++;
          for (const p of leafPoints(road, run, lay, b)) {
            expect(p.s, `${id}: a leaf before its run's start at ${run.from.toFixed(1)}`).toBeGreaterThanOrEqual(run.from - 1e-6);
            expect(p.s, `${id}: a leaf past its run's end at ${run.to.toFixed(1)}`).toBeLessThanOrEqual(run.to + 1e-6);
            for (const g of gaps) {
              if (g.side !== undefined && g.side !== run.side) continue;
              expect(Math.abs(p.s - g.s), `${id}: a leaf in the gap at ${g.s.toFixed(1)}`).toBeGreaterThanOrEqual(g.half - 1e-6);
            }
          }
        }
      }
    }
    expect(blocks).toBeGreaterThan(2000);
  });

  it('keeps every leaf within the collider and a hand across, and the collider within its run', () => {
    for (const { id, runs } of roads) {
      for (const { run, lay } of runs) {
        for (const b of lay.blocks) for (const p of leafPoints(null, run, lay, b)) expect(Math.abs(p.a), id).toBeLessThanOrEqual(HEDGE_SOLID_HALF + HEDGE_LEAF_SLACK + 1e-6);
        for (const k of lay.colliders) {
          expect(k.s0, `${id}: a collider before its run's start`).toBeGreaterThanOrEqual(run.from - 1e-6);
          expect(k.s1, `${id}: a collider past its run's end`).toBeLessThanOrEqual(run.to + 1e-6);
        }
      }
    }
  });
});
