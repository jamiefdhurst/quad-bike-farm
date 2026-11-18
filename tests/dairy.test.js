import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan } from '../src/world/layoutNew.js';
import { neighbourFarmShape, createNeighbourFarm } from '../src/world/neighbourFarm.js';
import { createRandom } from '../src/core/random.js';

const two = layoutNew(LAYOUT);
const S = neighbourFarmShape(two);
const inRect = (r, x, z) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
const overlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const fights = (g) => {
  g.updateMatrixWorld(true);
  return coplanarOverlaps(g, { gap: 0.003, minArea: 2e-5, textured: true }).map((f) => `${f.axis}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2)).join(',')} area ${f.area.toFixed(4)}`);
};

describe('the dairy\'s places on the plan (#569)', () => {
  it('puts the parlour at plan (1000 to 1030, 256 to 269) and the collecting yard in front of it at (1000 to 1030, 271 to 289)', () => {
    const [x0, z0] = fromPlan([1000, 256]);
    const [x1, z1] = fromPlan([1030, 269]);
    expect(S.parlour.outer).toMatchObject({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    const [cx0, cz0] = fromPlan([1000, 271]);
    const [cx1, cz1] = fromPlan([1030, 289]);
    expect(S.collecting).toMatchObject({ minX: cx0, maxX: cx1, minZ: cz0, maxZ: cz1 });
    expect(S.collecting.minZ).toBeGreaterThan(S.parlour.outer.maxZ); // in front of it, on the side the cow gates are
  });

  it('puts the bulk tank\'s room at plan (1036, 262), against the parlour\'s east end with its door on the south, and the slurry store at (970, 318)', () => {
    const [tx, tz] = fromPlan([1036, 262]);
    expect([S.tankRoom.x, S.tankRoom.z]).toEqual([tx, tz]);
    expect(S.tankRoom.outer.minX - S.parlour.outer.maxX).toBeGreaterThan(0.5);
    expect(S.tankRoom.outer.minX - S.parlour.outer.maxX).toBeLessThan(5); // close enough for the milk pipe
    const [sx, sz] = fromPlan([970, 318]);
    expect([S.slurry.x, S.slurry.z]).toEqual([sx, sz]);
    expect(S.slurry.r).toBe(9);
  });

  it('keeps everything inside the wall and clear of the house, the barn, her vehicles and the way in', () => {
    const all = [S.parlour.outer, S.tankRoom.outer, S.collecting.outer, S.slurry.outer];
    for (const r of all) {
      expect(r.minX).toBeGreaterThan(S.yard.minX + S.yard.wall);
      expect(r.maxX).toBeLessThan(S.yard.maxX - S.yard.wall);
      expect(r.minZ).toBeGreaterThan(S.yard.minZ + S.yard.wall);
      expect(r.maxZ).toBeLessThan(S.yard.maxZ - S.yard.wall);
    }
    const others = [S.house.roof, S.barn.roof, ...S.parked.map((p) => p.outer)];
    for (const r of all) for (const o of others) expect(overlap(r, o)).toBe(false);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i], all[j]), `${i} and ${j}`).toBe(false);
    const way = { minX: S.gateway.x, maxX: S.yard.maxX, minZ: S.gateway.z - 2.5, maxZ: S.gateway.z + 2.5 }; // a tanker's width either side of the gateway's middle
    for (const r of all) expect(overlap(r, way), 'the way in from the gateway').toBe(false);
  });

  it('leaves the tanker\'s way: in at the gateway, across the yard south of the collecting yard and up the strip beside it to the tank room\'s door', () => {
    const cell = 0.25;
    const key = (x, z) => `${Math.round(x / cell)},${Math.round(z / cell)}`;
    const blocked = (x, z) => {
      const half = 1.5; // the tanker is 3 m wide
      const box = { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half };
      return [S.parlour.outer, S.tankRoom.outer, S.collecting.outer, S.slurry.outer, S.house.outer, S.barn.outer, ...S.parked.map((p) => p.outer)].some((r) => overlap(r, box))
        || x - half < S.yard.minX + S.yard.wall + (Math.abs(z - S.gateway.z) < 2.5 ? -99 : 0) || x + half > S.yard.maxX - S.yard.wall || z - half < S.yard.minZ + S.yard.wall || z + half > S.yard.maxZ - S.yard.wall;
    };
    const start = [S.gateway.x + 1, S.gateway.z];
    const seen = new Set([key(...start)]);
    const todo = [start];
    while (todo.length) {
      const [x, z] = todo.pop();
      for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (blocked(nx, nz) || seen.has(key(nx, nz))) continue;
        seen.add(key(nx, nz));
        todo.push([nx, nz]);
      }
    }
    // A tanker's middle can reach the strip in front of the tank room's door, 3 m off its wall, and the yard beyond the collecting yard.
    const doorFront = [S.tankRoom.x, S.tankRoom.outer.maxZ + 3];
    expect(seen.has(key(...doorFront)), 'in front of the tank room\'s door').toBe(true);
    expect(seen.has(key(S.collecting.minX - 6, S.collecting.maxZ + 6))).toBe(true);
  });

  it('is built into the yard\'s outbuildings: counted as built, and the roofs shelter', () => {
    const nf = createNeighbourFarm(two);
    expect(nf.builtAt(S.parlour.x, S.parlour.z)).toBe(true);
    expect(nf.builtAt(S.tankRoom.x, S.tankRoom.z)).toBe(true);
    expect(nf.builtAt(S.slurry.x, S.slurry.z)).toBe(true);
    expect(nf.covered(S.parlour.x, S.parlour.z)).toBe(true);
    expect(nf.covered(S.tankRoom.x, S.tankRoom.z)).toBe(true);
    expect(nf.covered(S.slurry.x, S.slurry.z)).toBe(false); // open to the sky
    expect(nf.covered(S.collecting.minX + 5, S.collecting.minZ + 8)).toBe(false);
  });

  it('is not on today\'s farm', () => {
    const old = neighbourFarmShape(LAYOUT);
    expect(old.parlour).toBeNull();
    expect(old.slurry).toBeNull();
  });
});

describe('the dairy built', () => {
  const boxes = [];
  let built;
  let dm;
  let y0;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const dairy = await import('../src/world/dairyKit.js');
    const random = createRandom(4);
    dm = dairy.dairyMaterials(random, new THREE.MeshStandardMaterial({ color: 0x9d9b94 }));
    y0 = 3;
    const deps = { fixedBox: (...a) => boxes.push(a) };
    built = {
      parlour: dairy.buildParlour(S.parlour, y0, dm, deps),
      collecting: dairy.buildCollectingYard(S.collecting, S.parlour, y0, dm, deps),
      tank: dairy.buildTankRoom(S.tankRoom, S.parlour, y0, dm, deps),
      slurry: dairy.buildSlurryStore(S.slurry, y0, dm, deps),
    };
  });

  it('has each piece stand on the ground, nothing under it and nothing in the air', () => {
    for (const [name, g] of Object.entries(built)) {
      g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g, true);
      expect(box.min.y, `${name} lowest`).toBeGreaterThan(y0 - 0.6);
      expect(box.min.y, `${name} lowest`).toBeLessThan(y0 + 0.2);
      expect(box.max.y, `${name} highest`).toBeLessThan(y0 + 6.5);
    }
  });

  it('keeps each piece to its own place on the plan', () => {
    const within = (g, r, slack) => {
      const b = new THREE.Box3().setFromObject(g, true);
      expect(b.min.x).toBeGreaterThan(r.minX - slack);
      expect(b.max.x).toBeLessThan(r.maxX + slack);
      expect(b.min.z).toBeGreaterThan(r.minZ - slack);
      expect(b.max.z).toBeLessThan(r.maxZ + slack);
    };
    within(built.parlour, S.parlour.roof, 1.5);
    within(built.slurry, S.slurry.outer, 5);
    within(built.collecting, { minX: S.collecting.minX, maxX: S.collecting.maxX, minZ: S.collecting.minZ - 2, maxZ: S.collecting.maxZ }, 1);
  });

  it('has the sizes of the real things: a parlour 30 by 13 m and under 5 m, a door 2 m high, windows 0.9 by 0.45 m, a slurry store 3.6 m high', () => {
    const roofTop = new THREE.Box3().setFromObject(built.parlour, true).max.y - y0;
    expect(roofTop).toBeGreaterThan(4.4);
    expect(roofTop).toBeLessThan(5.2);
    const slurryTop = new THREE.Box3().setFromObject(built.slurry, true).max.y - y0;
    expect(slurryTop).toBeGreaterThan(3.6);
    expect(slurryTop).toBeLessThan(5.2); // the ladder's top and the hoop stand above the lip
  });

  it('has a ladder: two rails and rungs every 0.3 m, a safety hoop and a warning board on a post', () => {
    const rungs = built.slurry.children.filter((o) => o.geometry?.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop === 0.016);
    expect(rungs.length).toBeGreaterThanOrEqual(12);
    expect(built.slurry.children.some((o) => o.material === dm.danger)).toBe(true);
  });

  it('has the collecting yard\'s rails round its open sides with a way in on the west, and a channel under a grating along the parlour wall', () => {
    const cy = built.collecting.children;
    expect(cy.filter((o) => o.material === dm.galv).length).toBeGreaterThan(80);
    expect(cy.some((o) => o.material === dm.muck)).toBe(true);
    expect(cy.some((o) => o.material === dm.hose)).toBe(true); // the hosepipe
    // The west rail stops either side of the gap: no collider across it.
    const gapZ = S.collecting.gap.z;
    const west = boxes.filter(([x, , z, hx, , hz]) => Math.abs(x - (S.collecting.minX + 0.15)) < 0.3 && hx < 0.2 && hz > 0.5);
    expect(west).toHaveLength(2);
    for (const [, , z, , , hz] of west) expect(Math.abs(z - gapZ) - hz).toBeGreaterThan(S.collecting.gap.width / 2 - 0.5);
  });

  it('has the tank room\'s doorway clear and wide enough to walk in, with the stub and its board on the tanker\'s side', () => {
    const doorHalf = 0.62;
    const walls = boxes.filter(([x, , z, hx, , hz]) => Math.abs(z - (S.tankRoom.z + S.tankRoom.halfZ - 0.125)) < 0.01 && hz < 0.2 && hx < S.tankRoom.halfX);
    expect(walls).toHaveLength(2); // the south wall in two, either side of the door
    const gap = Math.min(...walls.map(([x, , , hx]) => Math.abs(x - S.tankRoom.x) - hx)) * 2;
    expect(gap).toBeGreaterThan(1.1); // a 0.6 m capsule through a 1.24 m door
    expect(gap).toBeCloseTo(doorHalf * 2, 1);
    expect(built.tank.children.some((o) => o.material === dm.collect)).toBe(true);
    expect(built.tank.children.some((o) => o.material === dm.stainless)).toBe(true);
  });

  it('has no faces fighting for one plane in any of the four', () => {
    for (const [name, g] of Object.entries(built)) expect(fights(g).slice(0, 12), name).toEqual([]);
  });
});
