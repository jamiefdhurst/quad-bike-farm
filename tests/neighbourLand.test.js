import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, NEIGHBOUR_LAND_PLAN } from '../src/world/layoutNew.js';
import { neighbourFarmShape } from '../src/world/neighbourFarm.js';
import { neighbourLandShape, stretchesOf, hedgeStretches, landFieldAt } from '../src/world/neighbourLand.js';
import { landColor, patchColor } from '../src/world/patchwork.js';
import { COW_VARIANTS, buildCow, cowGeometry } from '../src/world/cattleModel.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

const two = LAYOUT;
const land = neighbourLandShape(two);
const S = neighbourFarmShape(two);
const lane = two.publicLane;

describe('her land across the lane (#569)', () => {

  it('is the plan\'s block of fields east of the lane\'s hedge, from plan z -18 to 560 and x 1282 (cut back from the map\'s -60 and 1290 by the roads, #687), with the yard inside one of them', () => {
    const [x0, z0] = fromPlan([912, -18]);
    const [x1, z1] = fromPlan([1282, 560]);
    expect(Math.min(...land.fields.map((f) => f.minX))).toBe(x0);
    expect(Math.min(...land.fields.map((f) => f.minZ))).toBe(z0);
    expect(Math.max(...land.fields.map((f) => f.maxX))).toBe(x1);
    expect(Math.max(...land.fields.map((f) => f.maxZ))).toBe(z1);
    expect(x0).toBeGreaterThan(lane.x + lane.halfWidth); // her hedge is beyond the lane's tarmac
    expect(land.fields.map((f) => f.name)).toEqual(NEIGHBOUR_LAND_PLAN.fields.map((f) => f.name));
    expect(landFieldAt(land, (S.yard.minX + S.yard.maxX) / 2, (S.yard.minZ + S.yard.maxZ) / 2)).toBe('yardField');
    // Every field is the one place: no two overlap, and the six together are the whole block.
    let area = 0;
    for (const f of land.fields) area += (f.maxX - f.minX) * (f.maxZ - f.minZ);
    expect(area).toBeCloseTo((x1 - x0) * (z1 - z0), 3);
    for (const f of land.fields) for (const g of land.fields) if (f !== g) expect(f.minX < g.maxX && f.maxX > g.minX && f.minZ < g.maxZ && f.maxZ > g.minZ, `${f.name} ${g.name}`).toBe(false);
  });

  it('has a gap in the lane\'s hedge for her track, and a gate for her north field at plan z 130, and the hedge is whole elsewhere', () => {
    const laneHedge = land.lines.find((l) => l.axis === 'x' && l.at === fromPlan([912, 0])[0]);
    const [, trackZ] = fromPlan([0, 292]);
    const [, gateZ] = fromPlan([0, 130]);
    expect(laneHedge.gaps.some(([a, b]) => trackZ > a + 2 && trackZ < b - 2)).toBe(true); // wider than her track's carriageway (4 m)
    expect(land.gate).toMatchObject({ x: fromPlan([912, 0])[0], z: gateZ, width: 5 });
    expect(laneHedge.gaps.some(([a, b]) => gateZ > a && gateZ < b && b - a >= land.gate.width)).toBe(true);
    expect(stretchesOf(laneHedge)).toHaveLength(5); // her track, her north gate, the first gateway (#687), the village approach's frontage open from z 405 to 555 (#819), and the short stretch to her south hedge
    // No stretch of any hedge crosses her track, her wall or the lane.
    for (const s of hedgeStretches(land)) {
      const box = { minX: s.x - s.hx, maxX: s.x + s.hx, minZ: s.z - s.hz, maxZ: s.z + s.hz };
      expect(box.minX).toBeGreaterThan(lane.x + lane.halfWidth);
      const inYard = box.maxX > S.yard.minX && box.minX < S.yard.maxX && box.maxZ > S.yard.minZ && box.minZ < S.yard.maxZ;
      expect(inYard).toBe(false);
      expect(box.minX < fromPlan([950, 0])[0] && box.maxX > fromPlan([912, 0])[0] && box.minZ < trackZ + 2 && box.maxZ > trackZ - 2 && s.axis === 'x' && s.at === laneHedge.at).toBe(false);
    }
  });

  it('puts her 22 cows (the map\'s own) in her two north fields, clear of every hedge, facing every way', () => {
    expect(land.cows).toHaveLength(22);
    const [, zEdge] = fromPlan([0, 150]);
    for (const c of land.cows) {
      expect(['northWest', 'northEast']).toContain(landFieldAt(land, c.x, c.z));
      expect(c.z).toBeLessThan(zEdge);
      for (const s of hedgeStretches(land)) {
        const d = Math.hypot(Math.max(s.x - s.hx - c.x, 0, c.x - s.x - s.hx), Math.max(s.z - s.hz - c.z, 0, c.z - s.z - s.hz));
        expect(d, `cow at ${c.x}, ${c.z}`).toBeGreaterThan(1.5);
      }
    }
    expect(new Set(land.cows.map((c) => c.yaw.toFixed(2))).size).toBeGreaterThan(18);
  });

  it('has a collider box for each stretch of hedge, between the gaps', () => {
    for (const line of land.lines) {
      const stretches = stretchesOf(line);
      expect(stretches.length).toBe(line.gaps.length + 1 - (line.from === line.gaps[0]?.[0] ? 1 : 0));
      for (const s of stretches) expect(s.to - s.from).toBeGreaterThanOrEqual(1);
    }
    const boxes = hedgeStretches(land);
    expect(boxes.length).toBe(land.lines.reduce((n, l) => n + stretchesOf(l).length, 0));
    for (const b of boxes) expect(Math.min(b.hx, b.hz)).toBeCloseTo(land.hedge.width / 2, 6);
  });
});

describe('the grass and the hedge lines in her ground', () => {
  it('gives each of her fields its own tone, with a dark line along every hedge and none through a gap', () => {
    const [cx, cz] = fromPlan([1000, 80]);
    expect(landColor(land, cx, cz)).toEqual(land.fields.find((f) => f.name === 'northWest').tone);
    const [hx, hz] = fromPlan([1110, 20]);
    expect(landColor(land, hx, hz)).toEqual([0.17, 0.25, 0.11]); // on her hedge between the two north fields
    const [gx, gz] = fromPlan([1110, 100]);
    expect(landColor(land, gx, gz)).not.toEqual([0.17, 0.25, 0.11]); // the gap in it
    expect(landColor(land, fromPlan([880, 100])[0], 0)).toBeNull(); // our side of the lane is the farm's
  });

  it('is what patchColor gives on her land, and the generic patchwork off it', () => {
    const [x, z] = fromPlan([1000, 80]);
    const near = [0.37, 0.49, 0.23];
    const tone = land.fields.find((f) => f.name === 'northWest').tone;
    expect(patchColor(x, z, 1, land)).toEqual(tone.map((v, k) => near[k] + (v - near[k])));
    expect(patchColor(x, z, 1, land)).not.toEqual(patchColor(x, z, 1));
    const [ox, oz] = fromPlan([1500, 80]); // beyond her land
    expect(patchColor(ox, oz, 1, land)).toEqual(patchColor(ox, oz, 1));
  });
});

describe('her cows', () => {
  it('are black and white in a few patterns, at a real cow\'s size, standing on the ground', () => {
    expect(COW_VARIANTS).toBe(3);
    for (let v = 0; v < COW_VARIANTS; v++) {
      const g = cowGeometry(v);
      g.computeBoundingBox();
      const size = g.boundingBox.getSize(new THREE.Vector3());
      expect(size.y).toBeGreaterThan(1.3);
      expect(size.y).toBeLessThan(1.7);
      expect(size.z).toBeGreaterThan(2.3);
      expect(size.z).toBeLessThan(3.1);
      expect(g.boundingBox.min.y).toBeCloseTo(0, 1);
      const col = g.attributes.color;
      let dark = 0;
      let pale = 0;
      for (let i = 0; i < col.count; i++) (col.getX(i) < 0.3 ? dark++ : pale++);
      expect(dark / col.count, `variant ${v} dark share`).toBeGreaterThan(0.2);
      expect(pale / col.count, `variant ${v} pale share`).toBeGreaterThan(0.15);
    }
    expect(cowGeometry(0).attributes.color.array).not.toEqual(cowGeometry(1).attributes.color.array);
  });

  it('is a model of several parts for the bare-block look and the herd\'s one instanced draw', () => {
    const cow = buildCow(0);
    expect(cow.children.length).toBeGreaterThan(15);
    expect(cowGeometry(0).attributes.position.count / 3).toBeGreaterThan(900); // triangles
  });
});

describe('her land built', () => {
  let built;
  const boxes = [];
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const c = headlessContext();
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    const { buildNeighbourLand } = await import('../src/world/neighbourLandProps.js');
    built = buildNeighbourLand({ ...c, layout: two, heights, fixedBox: (...a) => (boxes.push(a), { setEnabled() {} }), gateParams: { swingSeconds: 1, blockBelow: 0.5, clearRadius: 3 } });
  });

  it('is one set piece named neighbourLand with her hedges (near and far), her gate and her herd, in the scene', () => {
    expect(built.group.name).toBe('neighbourLand');
    expect(built.group.parent).toBeTruthy();
    expect(built.group.children.some((o) => o.name === 'neighbourHerd')).toBe(true);
    expect(built.hedgeSwap.tiles.size).toBeGreaterThan(10);
    expect(built.gate.id).toBe('northField');
    expect([built.gate.x, built.gate.z]).toEqual([land.gate.x, land.gate.z]);
  });

  it('puts her hedges in the scene, not in the set piece that is hidden at 160 m, and none of them casts a shadow', () => {
    const hedges = [];
    for (const t of built.hedgeSwap.tiles.values()) hedges.push(...t.near, ...t.far);
    expect(hedges.length).toBeGreaterThan(20);
    for (const m of hedges) {
      expect(m.castShadow, 'a hedge mesh').toBe(false);
      for (let up = m.parent; up; up = up.parent) expect(up, 'not inside the set piece').not.toBe(built.group);
      expect(m.parent.parent ?? m.parent, 'in the scene').toBeTruthy();
    }
    // The herd and the gate do cast.
    const herd = built.group.children.find((o) => o.name === 'neighbourHerd');
    let casting = 0;
    herd.traverse((o) => { if (o.isMesh && o.castShadow) casting++; });
    expect(casting).toBeGreaterThan(0);
  });

  it('draws 22 cows in a handful of instanced meshes, never one for each', () => {
    const herd = built.group.children.find((o) => o.name === 'neighbourHerd');
    let cows = 0;
    let meshes = 0;
    herd.traverse((o) => {
      if (o.isInstancedMesh) {
        cows += o.count;
        meshes++;
      }
    });
    expect(cows).toBe(22);
    expect(meshes).toBeLessThan(22);
  });

  it('puts a collider on each stretch of hedge and on the gate\'s posts, none across the gap for her track', () => {
    const stretchCount = hedgeStretches(land).length;
    expect(boxes.length).toBeGreaterThanOrEqual(stretchCount + 3); // the stretches, two posts and the gate's own box
    const [, trackZ] = fromPlan([0, 292]);
    const laneX = fromPlan([912, 0])[0];
    for (const [x, , z, hx, , hz] of boxes) if (Math.abs(x - laneX) < 1 && hz > 1) expect(Math.abs(z - trackZ) - hz, `box at z ${z}`).toBeGreaterThan(1);
  });

  it('has no faces fighting on one plane in her gate, its posts or a cow', () => {
    built.group.updateMatrixWorld(true);
    const fights = coplanarOverlaps(built.group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.axis}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2)).join(',')} area ${f.area.toFixed(4)}`)).toEqual([]);
    const cow = buildCow(0);
    cow.updateMatrixWorld(true);
    expect(coplanarOverlaps(cow, { gap: 0.003, minArea: 2e-5, textured: true })).toEqual([]);
  });

  it('opens her gate with E like the others, swinging in to her field', () => {
    expect(built.gate.isOpen).toBe(false);
    built.gate.state.setOpen(true);
    built.gate.state.update(10);
    built.gate.apply();
    expect(built.gate.state.amount).toBe(1);
  });
});
