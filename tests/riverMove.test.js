import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, RIVER_PLAN, GATEWAYS_PLAN, NOT_MOVED_YET } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createFields } from '../src/world/fields.js';
import { createHill } from '../src/world/hill.js';
import { createRiver } from '../src/world/river.js';
import { Track } from '../src/world/track.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';
import { deepWaterGulp, stepWater } from '../src/engine/water.js';
import { createGroundPlan, paintGround, paintContext } from '../src/world/groundTexture.js';
import { pointInPolygon } from '../src/world/polygons.js';

// The river on the new farm (#565): the hill's stream widens into it at the meadow's head, it runs east with the land through Brook Meadow, and the
// brook carries on to the lane's verge.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const brook = heights.brook;
const hill = createHill(two);
const fields = createFields(two);
const river = createRiver(two, brook);
const R = two.hill.river;
const M = two.hill.riverside;
const cx = R.crossing.x;
const bed = (x) => heights.heightAt(x, brook.zAt(x));
const surface = (x) => bed(x) + brook.waterDepthAt(x);

describe('the river, from the hill\'s stream to the lane', () => {
  it('starts where the stream ends, at the same line, width, depth and level, so there is no gap or step', () => {
    expect(brook.minX).toBe(hill.pasture.maxX);
    const x = brook.minX;
    expect(brook.zAt(x)).toBeCloseTo(hill.streamZ(x), 3);
    expect(brook.halfAt(x)).toBeCloseTo(hill.halfAt(x), 3);
    expect(brook.depthAt(x)).toBeCloseTo(hill.depthAt(x), 3);
    for (let d = -10; d < 10; d++) {
      const a = hill.pasture.maxX + d;
      const zs = (xx) => (xx <= x ? hill.streamZ(xx) : brook.zAt(xx));
      expect(Math.abs(heights.heightAt(a + 1, zs(a + 1)) - heights.heightAt(a, zs(a))), `bed at ${a}`).toBeLessThan(0.35);
    }
    expect(Math.abs(surface(x + 0.5) - (heights.heightAt(x - 0.5, hill.streamZ(x - 0.5)) + hill.waterDepthAt(x - 0.5)))).toBeLessThan(0.35);
  });

  it('is at the plan\'s (420, 572) where the stream ends', () => {
    const [px, pz] = fromPlan([420, 572]);
    expect(brook.minX).toBeCloseTo(px, 3);
    expect(brook.zAt(brook.minX)).toBeCloseTo(pz, 0);
  });

  it('runs on east under the lane\'s bridge and past the village to a spring short of the A-road (#688)', () => {
    expect(brook.culvert).toBeTruthy();
    expect(brook.culvert.x).toBe(two.publicLane.x);
    const [endX] = fromPlan([1250, 0]);
    expect(brook.maxX).toBeCloseTo(endX, 0);
    for (let x = brook.minX; x < brook.maxX - 32; x += 1) {
      if (Math.abs(x - brook.culvert.x) < brook.culvert.half + brook.culvert.ease) continue; // the bridge's span has no channel across the tarmac
      expect(brook.waterDepthAt(x), `x ${x}`).toBeGreaterThanOrEqual(R.crossing.water - 0.01);
      expect(brook.depthAt(x), `x ${x}`).toBeGreaterThan(0.5);
    }
  });

  it('runs east with the land: its bed and its surface fall from the meadow\'s head to the lane', () => {
    expect(bed(brook.minX + 5)).toBeGreaterThan(bed(cx + 100));
    expect(surface(brook.minX + 5)).toBeGreaterThan(surface(brook.maxX - 10) + 10);
  });

  it('is wide through Brook Meadow and a brook either side of it, with three or four bends and a width that varies from 8 to 13 m', () => {
    const full = [];
    for (let x = M.minX + 45; x < fromPlan([650, 0])[0]; x += 1) full.push(x);
    for (const x of full) {
      const w = brook.halfAt(x) * 2;
      expect(w, `x ${x}`).toBeGreaterThan(7.5);
      expect(w, `x ${x}`).toBeLessThan(13.5);
    }
    expect(Math.max(...full.map((x) => brook.halfAt(x))) - Math.min(...full.map((x) => brook.halfAt(x)))).toBeGreaterThan(1);
    expect(brook.halfAt(brook.maxX - 20)).toBeLessThan(2.2);
    // Bends: the line turns at least three times along the river, each swing more than 6 m.
    const line = [];
    for (let x = M.minX + 30; x < M.maxX + 40; x += 2) line.push(brook.zAt(x));
    let turns = 0;
    let dir = 0;
    let from = line[0];
    for (let i = 1; i < line.length; i++) {
      const d = Math.sign(line[i] - line[i - 1]);
      if (d && dir && d !== dir && Math.abs(line[i - 1] - from) > 6) {
        turns++;
        from = line[i - 1];
      }
      if (d) dir = d;
    }
    expect(turns).toBeGreaterThanOrEqual(3);
  });

  it('stays inside Brook Meadow, clear of its edges and its gateways', () => {
    const plan = fields.polygons.brook;
    for (let x = M.minX + 2; x < M.maxX - 2; x += 2) {
      const z = brook.zAt(x);
      for (const dz of [-brook.halfAt(x) - 4, brook.halfAt(x) + 4]) expect(pointInPolygon(plan, x, z + dz), `x ${x}`).toBe(true);
    }
  });

  it('only ever falls: the surface never rises downstream, wherever the land rolls up under the line', () => {
    for (let x = brook.minX + 1; x < brook.maxX - 8; x++) {
      expect(surface(x) - surface(x - 1), `x ${x}`).toBeLessThan(0.01);
    }
  });
});

describe('deep water, the crossing and the bridge', () => {
  it('drowns an engine in the deep and not on the crossing, which is a wade', () => {
    const x = cx + 30;
    expect(brook.deepAt(x, brook.zAt(x))).toBeCloseTo(1, 5);
    expect(brook.deepAt(cx, brook.zAt(cx))).toBe(0);
    expect(brook.waterDepthAt(cx)).toBeCloseTo(R.crossing.water, 2);
    let w = 0;
    for (let t = 0; t < 1; t += 0.05) w = stepWater(w, 0.05, { gulp: deepWaterGulp(brook.deepAt(x, brook.zAt(x)), P), running: true }, P);
    expect(w).toBeGreaterThan(P.waterStallAt);
  });


  it('keeps the crossing at least 25 m from the bridge, so the bridge does not set off the crossing\'s remark', () => {
    expect(cx - R.bridge.x).toBeGreaterThanOrEqual(25);
    expect(river.nearCrossing(R.bridge.x, brook.zAt(R.bridge.x))).toBe(false);
    expect(river.places().bridge.x).toBe(R.bridge.x);
    expect(river.places().crossing.x).toBe(cx);
  });

  it('has a worn muddy landing on each bank of the crossing, and drinking places along the banks', () => {
    const zc = brook.zAt(cx);
    expect(heights.mudAt(cx, zc - brook.halfAt(cx) - 1.2)).toBeGreaterThan(0.5);
    expect(heights.mudAt(cx, zc + brook.halfAt(cx) + 1.2)).toBeGreaterThan(0.5);
    for (const [x, side] of R.drinks) expect(heights.mudAt(x, brook.zAt(x) + side * (brook.halfAt(x) + 0.8)), `${x}`).toBeGreaterThan(0.4);
    expect(R.drinks.filter(([, s]) => s < 0).length).toBeGreaterThanOrEqual(2);
    expect(R.drinks.filter(([, s]) => s > 0).length).toBeGreaterThanOrEqual(2);
  });
});

describe('the meadow', () => {
  it('is Brook Meadow\'s own outline, 7 ha or more, with no hedge ring of its own', () => {
    expect(M.points).toEqual(fields.polygons.brook);
    expect((M.maxX - M.minX) * (M.maxZ - M.minZ)).toBeGreaterThan(60000);
    expect(M.trees).toEqual([]);
  });

  it('has a river gate wherever the river crosses a boundary, each a shut gap that spans the water', () => {
    const gates = river.hurdles();
    expect(gates).toHaveLength(3);
    const shut = fields.gateways.filter((g) => g.gap?.shut && !g.gap.gate);
    expect(shut).toHaveLength(GATEWAYS_PLAN.filter((g) => g.river).length);
    // The gate fills its gap: it spans what the boundary leaves open, from where the plan puts the gap.
    for (const h of river.hurdles(fields.gateways)) {
      const g = shut.find((s) => Math.abs((s.pa.x + s.pb.x) / 2 - h.x) < 3);
      expect(h.half, `gate at x ${h.x}`).toBeCloseTo(g.gap.half, 6);
      expect(h.z, `gate at x ${h.x}`).toBeCloseTo((g.pa.z + g.pb.z) / 2, 6);
    }
    for (const h of gates) {
      const g = shut.find((s) => Math.abs((s.pa.x + s.pb.x) / 2 - h.x) < 3 && Math.abs((s.pa.z + s.pb.z) / 2 - h.z) < 4);
      expect(g, `gate at x ${h.x}`).toBeTruthy();
      const mid = (g.pa.z + g.pb.z) / 2;
      for (let z = h.z - 12; z <= h.z + 12; z += 0.5) {
        if (brook.waterAt(h.x, z) > 0.05) expect(Math.abs(z - mid), `z ${z}`).toBeLessThan(g.gap.half);
      }
    }
  });

  it('has willows in groups along both banks, clear of the water, the crossing and the sight line from the gateway to the bridge', () => {
    const w = river.willows();
    expect(w.length).toBeGreaterThanOrEqual(12);
    expect(w.length).toBeLessThanOrEqual(16);
    expect(w.filter((t) => t.z < brook.zAt(t.x)).length).toBeGreaterThanOrEqual(5);
    expect(w.filter((t) => t.z > brook.zAt(t.x)).length).toBeGreaterThanOrEqual(5);
    for (const t of w) {
      expect(brook.waterAt(t.x, t.z)).toBe(0);
      expect(Math.abs(t.x - cx)).toBeGreaterThan(R.crossing.half + 3);
    }
    // From the gateway (plan 420, 545) to the bridge (420, 572): nothing stands on the line.
    const [gx, gz] = fromPlan([420, 545]);
    const bz = R.bridge.z;
    const trunks = [...w.map((t) => [t.x, t.z]), ...(two.fieldLandmarks.find((l) => l.kind === 'bigOaks')?.trees ?? [])];
    for (const [x, z] of trunks) {
      const t = Math.max(0, Math.min(1, (z - gz) / (bz - gz)));
      expect(Math.hypot(x - R.bridge.x, z - (gz + t * (bz - gz))), `trunk at ${x},${z}`).toBeGreaterThan(3);
    }
    expect(Math.hypot(M.crackWillow[0] - R.bridge.x, M.crackWillow[1] - bz)).toBeLessThan(20); // the crack willow stands by the bridge
  });

  it('is reachable from the yard by way of the gateway from Hay Meadow, and the river is not a way through', () => {
    const north = { x: cx, z: brook.zAt(cx) - brook.halfAt(cx) - 10 };
    const into = fields.route({ x: 0, z: 0 }, north);
    expect(into.length).toBeGreaterThan(1);
    const gate = fields.gateways.find((g) => g.a === 'hay' && g.b === 'brook');
    const gm = { x: (gate.pa.x + gate.pb.x) / 2, z: (gate.pa.z + gate.pb.z) / 2 };
    expect(into.some((p) => Math.hypot(p.x - gm.x, p.z - gm.z) < 6)).toBe(true);
    expect(fields.areaOf(north.x, north.z)).toBe('brook');
    expect(fields.areaOf(0, 0)).toBe('farmstead');
  });
});

describe('what the move leaves behind', () => {
  it('is not on the list of places at today\'s numbers, and carries on east past the lane\'s bridge, and today\'s farm keeps its culvert and spring', () => {
    expect(NOT_MOVED_YET.river).toBeUndefined();
    expect(RIVER_PLAN.points.at(-1)[0]).toBeGreaterThan(905); // on, past the lane's bridge (#688)
    expect(createFields(LAYOUT).brook.culvert).toBeTruthy();
  });
});

describe('the bank\'s dirt where the stream becomes the river', () => {
  // The ground is painted through a stand-in canvas that records each rectangle, as groundPaintWindows.test.js does.
  const win = { minX: brookMinX() - 30, maxX: brookMinX() + 30, minZ: 160, maxZ: 240 };
  const s = 4;
  let ops;
  const savedDocument = globalThis.document;
  beforeAll(() => {
    const record = () => {
      const out = [];
      let fill = '';
      const ctx = new Proxy({}, {
        get: (_, name) => {
          if (name === 'fillRect') return (x, z, w, h) => out.push({ x: win.minX + (x + w / 2) / s, z: win.minZ + (z + h / 2) / s, w: w / s, fill });
          if (name === 'createRadialGradient') return () => ({ addColorStop() {} });
          if (name === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
          return () => {};
        },
        set: (_, name, v) => {
          if (name === 'fillStyle') fill = typeof v === 'string' ? v : 'gradient';
          return true;
        },
      });
      return { ctx, out };
    };
    globalThis.document = { createElement: () => ({ getContext: () => record().ctx }) };
    const plan = createGroundPlan({ track: new Track(two.trackPoints), layout: two, fields, puddles: heights.puddles, bogs: heights.bogs });
    const rec = record();
    for (const _ of paintGround(plan, paintContext(rec.ctx, win, s)));
    ops = rec.out;
  }, 60000);
  afterAll(() => {
    globalThis.document = savedDocument;
  });

  it('carries the silt on along the river, with no column of the bank left bare across the joint', () => {
    const silt = ops.filter((o) => o.w < 2 && /^rgba\([567]\d(\.\d+)?,[45]\d(\.\d+)?,[34]\d(\.\d+)?,/.test(o.fill));
    for (let x = brook.minX - 12; x < brook.minX + 12; x++) {
      const z = x <= brook.minX ? hill.streamZ(x) : brook.zAt(x);
      expect(silt.some((o) => Math.abs(o.x - x) < 1.1 && Math.abs(o.z - z) < 1.5), `column ${x}`).toBe(true);
    }
  });
});

function brookMinX() {
  return createHill(layoutNew(LAYOUT, RAW_LAYOUT)).pasture.maxX;
}
