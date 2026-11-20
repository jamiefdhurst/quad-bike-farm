import { describe, it, expect, beforeAll } from 'vitest';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { buildWorldModels } from './helpers/worldModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { edgeBetween, pointAlong } from '../src/world/polygons.js';
import { wallBoxes } from '../src/world/barn.js';
import { gatePosts, weedSpots, standingWater, restingHeight } from '../src/world/yardKit.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { puddleSpots } from '../src/world/yardGround.js';

// The yard's dressing (#817): the steel gates, the barn wall's gear, the heaps, the stackyard, and the places they are given in the new farm's layout.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const k = two.farmstead.yard;
const inRect = (r, x, z, m = 0) => x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m;
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const stream = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('the yard kit as models', () => {
  let models;
  beforeAll(async () => {
    models = (await buildWorldModels()).models;
  });
  for (const name of ['yardGates', 'yardFurniture', 'stackyardKit']) {
    it(`${name} is built, in a few merged meshes, with no two faces on one plane`, () => {
      const m = models.find((x) => x.name === name);
      expect(m, name).toBeTruthy();
      let meshes = 0;
      m.group.traverse((o) => { if (o.isMesh) meshes++; });
      expect(meshes).toBeGreaterThan(0);
      expect(meshes).toBeLessThan(30);
      const fights = coplanarOverlaps(m.group, { gap: 0.003, minArea: 2e-5, textured: true });
      expect(fights.map((f) => `${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`)).toEqual([]);
    });
  }
});

describe('where the yard is dressed', () => {
  const things = () => [
    k.wall, k.pallets, k.tyres, k.gully, k.stack, k.spike, ...k.round, ...k.straw,
  ];
  it('hangs the wall gear on the barn\'s east end wall, north of the tanks, facing out of it', () => {
    const wall = wallBoxes(two).find((w) => w.id === 'north');
    expect(Math.abs(k.wall.x - (wall.x + wall.hx))).toBeLessThan(0.15); // on its outer face
    expect(k.wall.z).toBeGreaterThan(wall.z - wall.hz + 3); // the gear reaches 3 m north of the anchor
    expect(k.wall.z).toBeLessThan(two.fuelTank.z - 2); // and the tank stands further south
    expect(Math.round((k.wall.yaw / Math.PI) * 2)).toBe(1);
  });
  it('keeps what stands in the yard clear of the kept-clear places and out of the slab\'s edge', () => {
    for (const p of [k.pallets, k.tyres, k.gully]) {
      expect(inRect(two.farmstead.slab, p.x, p.z)).toBe(true);
      for (const c of two.farmstead.keptClear) expect(inRect(c, p.x, p.z, 1), `${c.name}`).toBe(false);
    }
  });
  it('keeps the heaps and the bales out of the way of what is placed in the yard and the Dutch barn', () => {
    const placed = [two.fuelTank, two.dieselBowser, two.bell, two.generator, two.dutchCan, ...two.spawn.away, ...two.restSpots, ...two.jerryCanSpots].filter(Boolean);
    for (const t of [k.pallets, k.tyres, k.stack, k.spike, ...k.round, k.wall]) {
      for (const p of placed) expect(Math.hypot(p.x - t.x, p.z - t.z), `${JSON.stringify(t)} near ${JSON.stringify(p)}`).toBeGreaterThan(1.5);
    }
    expect(things().length).toBeGreaterThan(10);
  });
  it('hangs a steel gate at the Home Ground rail\'s gateway, the hay field\'s and Top Field\'s, where the layout has them (the drive\'s mouth stays open for the lorry)', () => {
    expect(k.gates.length).toBe(3);
    for (const g of k.gates) {
      const hit = two.gateways.find((gw) => {
        const b = two.boundaries[gw.boundary];
        let left = gw.at;
        for (let i = 0; i + 1 < b.points.length; i++) {
          const e = edgeBetween(...b.points[i], ...b.points[i + 1]);
          if (left <= e.length || i + 2 === b.points.length) {
            const p = pointAlong(e, left);
            return Math.hypot(p.x - g.x, p.z - g.z) < 0.6;
          }
          left -= e.length;
        }
        return false;
      });
      expect(hit, `a gateway at ${g.x}, ${g.z}`).toBeTruthy();
    }
    const posts = gatePosts(k.gates);
    expect(posts.length).toBe(6);
    for (const p of posts) expect(Math.abs(Math.hypot(p.x - p.gate.x, p.z - p.gate.z) - 2.6)).toBeLessThan(1e-9);
  });
  it('puts the drain along the yard, the puddles on the slab, the mud at the ways in and the muck line along the barn', () => {
    expect(inRect(two.farmstead.slab, k.drain.x, k.drain.z0)).toBe(true);
    expect(k.drain.z0).toBeGreaterThan(k.drain.z1);
    expect(Math.hypot(k.gully.x - k.drain.x, k.gully.z - k.drain.z1)).toBeLessThan(1.5);
    expect(puddleSpots(two).length).toBeGreaterThanOrEqual(4);
    for (const p of puddleSpots(two)) expect(inRect(two.farmstead.slab, p.x, p.z)).toBe(true);
    expect(k.mud.length).toBe(2);
    expect(k.muckLines[0].z0 + PLAN_ORIGIN[1]).toBeGreaterThan(335);
  });
  it('scatters nettles along the walls and gates without covering the barn\'s doors, the same every time', () => {
    const a = weedSpots(two, stream(7));
    expect(a.length).toBeGreaterThan(40);
    expect(weedSpots(two, stream(7))).toEqual(a);
    const x0 = k.muckLines[0].x0 - 501.8;
    for (const p of a.filter((s) => Math.abs(s.z - k.muckLines[0].z0) < 0.7)) {
      for (const [from, to] of [[504.4, 508.5], [513.4, 517.9]]) expect(p.x > x0 + from - 0.2 && p.x < x0 + to + 0.2, `${p.x}`).toBe(false);
    }
  });
  it('shows standing water only once the ground has been wet a while', () => {
    expect(standingWater(0)).toBe(0);
    expect(standingWater(0.1)).toBe(0);
    expect(standingWater(0.4)).toBeGreaterThan(0.1);
    expect(standingWater(1)).toBeLessThanOrEqual(0.8);
  });
  it('is not on today\'s farm', () => {
    expect(LAYOUT.farmstead).toBeUndefined();
  });

  it('leaves the wrapped bales behind the barn a clear way in from the west that a tractor can drive, well off the walls, the orchard, the garden and the kept-clear places', () => {
    const { silage, farmstead: f } = two;
    const stack = { minX: silage.x - 0.75, maxX: silage.x + 3 * 1.55 + 0.75, minZ: silage.z - 0.75, maxZ: silage.z + 1.6 + 0.75 };
    const lane = { minX: stack.minX - 7, maxX: stack.minX, minZ: stack.minZ - 1, maxZ: stack.maxZ + 1 }; // 7 m long, wider than the stack by a metre each side
    const hits = (r) => lane.minX < r.maxX && lane.maxX > r.minX && lane.minZ < r.maxZ && lane.maxZ > r.minZ;
    expect(hits(f.orchard)).toBe(false);
    expect(hits(f.garden)).toBe(false);
    for (const c of f.keptClear) expect(hits(c), c.name).toBe(false);
    for (const w of wallBoxes(two)) expect(hits({ minX: w.x - w.hx, maxX: w.x + w.hx, minZ: w.z - w.hz, maxZ: w.z + w.hz }), w.id).toBe(false);
    expect(lane.minZ).toBeGreaterThan(f.orchard.maxZ + 2); // and the fence of the orchard is not in it
    expect(stack.maxZ + 1).toBeLessThan(wallBoxes(two).find((w) => w.id === 'west').z - 2); // nor the barn's back wall
  });
});

describe('the stackyard\'s bales', () => {
  it('stand clear of the Dutch barn\'s own round bales and its stanchions, and the stack is under its roof', async () => {
    const { createOutbuildings } = await import('../src/world/outbuildings.js');
    const ob = createOutbuildings(two).barn;
    const s = k.stack;
    const box = { minX: s.x - 0.8, maxX: s.x + 2.0, minZ: s.z - 0.2, maxZ: s.z + 1.06 };
    expect(box.minX).toBeGreaterThan(ob.outer.minX);
    expect(box.maxX).toBeLessThan(ob.outer.maxX);
    for (const b of ob.bales) expect(box.maxX < b.x - 0.6 || box.minX > b.x + 0.6 || box.maxZ < b.z - 0.6 || box.minZ > b.z + 0.6, `bale at ${b.x}, ${b.z}`).toBe(true);
    for (const x of ob.postXs) expect(x < box.minX - 0.2 || x > box.maxX + 0.2, `stanchion at ${x}`).toBe(true);
    for (const r of k.round) expect(inRect(two.farmstead.stackyard, r.x, r.z, -1)).toBe(true);
  });
});

describe('standing on the slope (the yard falls about 3 cm a metre to the east)', () => {
  let furniture;
  beforeAll(async () => {
    furniture = (await buildWorldModels()).models.find((m) => m.name === 'yardFurniture').group;
  });
  const worldVertices = (group, keep) => {
    const out = [];
    group.traverse((o) => {
      if (!o.isMesh || o.userData.keepFar) return;
      const at = o.geometry.getAttribute('position');
      for (let i = 0; i < at.count; i++) {
        const x = o.position.x + at.getX(i);
        const z = o.position.z + at.getZ(i);
        if (keep(x, z)) out.push([x, o.position.y + at.getY(i), z]);
      }
    });
    return out;
  };
  it('lays each puddle\'s water on the ground at every point of it, not flat over a slope', () => {
    const discs = [];
    furniture.traverse((o) => o.userData.keepFar && discs.push(o));
    expect(discs.length).toBe(k.puddles.length);
    for (const d of discs) {
      const at = d.geometry.getAttribute('position');
      for (let i = 0; i < at.count; i++) {
        const x = d.position.x + at.getX(i) * d.scale.x;
        const z = d.position.z + at.getZ(i) * d.scale.z;
        expect(Math.abs(d.position.y + at.getY(i) - (heights.heightAt(x, z) + 0.012)), `${x}, ${z}`).toBeLessThan(0.002);
      }
    }
  });
  it('sets something on the highest ground under its footprint, so a low side is buried and none floats', () => {
    const ground = (x, z) => heights.heightAt(x, z);
    const y = restingHeight(ground, k.pallets.x, k.pallets.z, 0.65, 0.5);
    for (const dx of [-0.65, 0, 0.65]) for (const dz of [-0.5, 0, 0.5]) expect(y).toBeGreaterThanOrEqual(ground(k.pallets.x + dx, k.pallets.z + dz) - 1e-9);
  });
  it('stands the tyre pile\'s bottom rings and the leaning tyre on the ground under each, within 4 cm of it', () => {
    const t = k.tyres;
    for (const cx of [t.x - 0.82, t.x, t.x + 0.82, t.x + 1.5]) {
      const verts = worldVertices(furniture, (x, z) => Math.abs(x - cx) < 0.38 && Math.abs(z - t.z) < 0.45);
      expect(verts.length, `ring at ${cx}`).toBeGreaterThan(0);
      const low = Math.min(...verts.map((v) => v[1]));
      let top = -Infinity;
      for (const dx of [-0.4, 0, 0.4]) for (const dz of [-0.4, 0, 0.4]) top = Math.max(top, heights.heightAt(cx + dx, t.z + dz));
      expect(low - top, `ring at ${cx} floats`).toBeLessThan(0.04);
      expect(low - top, `ring at ${cx} buried`).toBeGreaterThan(-0.04);
    }
  });
  it('stops the drain, the tyre paths and the mud short of the places kept clear for the buildings still to come', () => {
    const rects = two.farmstead.keptClear.filter((c) => !/lorry|pole/.test(c.name));
    const along = (pts) => pts.flatMap((a, i) => (i ? Array.from({ length: 21 }, (_, t) => [pts[i - 1][0] + ((a[0] - pts[i - 1][0]) * t) / 20, pts[i - 1][1] + ((a[1] - pts[i - 1][1]) * t) / 20]) : []));
    const marks = [
      ...along([[k.drain.x, k.drain.z0], [k.drain.x, k.drain.z1]]),
      ...k.paths.flatMap((p) => along(p.points)),
      ...k.mud.flatMap((m) => [[m.x, m.z], [m.x + m.dx * m.radius, m.z + m.dz * m.radius]]),
    ];
    for (const [x, z] of marks) for (const c of rects) expect(inRect(c, x, z), `${c.name} at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(false);
  });
});
