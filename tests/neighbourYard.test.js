import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';
import { NEIGHBOUR_PLAN, neighbourLayout } from '../src/world/layoutNew.js';
import { neighbourFarmShape, createNeighbourFarm } from '../src/world/neighbourFarm.js';
import { YARD_KINDS, yardPiece, yardFootprints, yardMarks } from '../src/world/neighbourYard.js';
import { createRandom } from '../src/core/random.js';

const S = neighbourFarmShape(LAYOUT);
const overlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const feet = yardFootprints(S.furniture);
const buildings = () => [S.house.outer, S.barn.outer, S.parlour.outer, S.tankRoom.outer, S.collecting.outer, S.slurry.outer, ...S.parked.map((p) => p.outer)];

describe('what stands about the neighbour\'s yard (#911)', () => {
  it('lists every kind of piece the issue names, each with a footprint', () => {
    const kinds = new Set(S.furniture.map((f) => f.kind));
    for (const k of ['silageTrough', 'mineralTub', 'balefeeder', 'wrappedBale', 'waterTrough', 'hoseHook', 'yardTap', 'barrow', 'leaningTools', 'scrapeBlade', 'palletStack', 'limeBags',
      'feedSacks', 'tyreStack', 'ibcTank', 'muckHeap', 'henCoop', 'catOnWall', 'kennel', 'dogBowl', 'bootsAtDoor', 'churnStand', 'nameBoard', 'yardLight']) {
      expect(kinds.has(k), k).toBe(true);
      expect(YARD_KINDS[k], k).toBeTruthy();
    }
    expect(S.furniture.filter((f) => f.kind === 'wrappedBale')).toHaveLength(2);
  });

  it('turns a footprint a quarter and squares it on any other turn', () => {
    expect(yardPiece({ kind: 'barrow', x: 0, z: 0, yaw: Math.PI / 2 }).hx).toBeCloseTo(0.75, 9);
    const odd = yardPiece({ kind: 'barrow', x: 0, z: 0, yaw: 0.7 });
    expect(odd.hx).toBe(odd.hz);
  });

  it('keeps each piece inside the wall, off every building and vehicle, and off the others (but the things that go on or against another)', () => {
    for (const f of feet) {
      expect(f.outer.minX, f.kind).toBeGreaterThan(S.yard.minX + S.yard.wall);
      expect(f.outer.maxX, f.kind).toBeLessThan(S.yard.maxX - S.yard.wall);
      expect(f.outer.minZ, f.kind).toBeGreaterThan(S.yard.minZ + S.yard.wall);
      expect(f.outer.maxZ, f.kind).toBeLessThan(S.yard.maxZ - S.yard.wall);
      for (const b of buildings()) if (b !== S.slurry.outer) expect(overlap(f.outer, b), `${f.kind} in a building`).toBe(false);
      expect(overlap(f.outer, S.slurry.outer), `${f.kind} in the slurry store`).toBe(false);
    }
    const near = new Set(['dogBowl:kennel']); // a bowl by the kennel is the only pair allowed to touch
    for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) {
      if (near.has(`${feet[i].kind}:${feet[j].kind}`) || near.has(`${feet[j].kind}:${feet[i].kind}`)) continue;
      expect(overlap(feet[i].outer, feet[j].outer), `${feet[i].kind} and ${feet[j].kind}`).toBe(false);
    }
  });

  it('has the cat on the wall, the tools on the barn\'s wall and the feed passage against it', () => {
    const cat = S.furniture.find((f) => f.kind === 'catOnWall');
    expect(S.walls.some((w) => Math.abs(cat.x - w.x) < w.hx + 0.01 && Math.abs(cat.z - w.z) < w.hz)).toBe(true);
    const trough = yardPiece(S.furniture.find((f) => f.kind === 'silageTrough'));
    expect(trough.outer.minZ - S.barn.outer.maxZ).toBeLessThan(0.12);
    expect(trough.outer.minZ - S.barn.outer.maxZ).toBeGreaterThanOrEqual(-0.001);
  });

  it('leaves a 3 m way from the gateway to the barn door, the collecting yard\'s gap, the tank room\'s door and her front door', () => {
    const cell = 0.25;
    const key = (x, z) => `${Math.round(x / cell)},${Math.round(z / cell)}`;
    const wall = S.yard;
    const blocked = (x, z, half = 1.5) => {
      const box = { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half };
      return [...buildings(), ...feet.map((f) => f.outer)].some((r) => overlap(r, box))
        || x - half < wall.minX + wall.wall + (Math.abs(z - S.gateway.z) < 2.5 ? -99 : 0) || x + half > wall.maxX - wall.wall || z - half < wall.minZ + wall.wall || z + half > wall.maxZ - wall.wall;
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
    const reach = (x, z) => seen.has(key(x, z));
    expect(reach(S.barn.door.x + 3, S.barn.door.z), 'the barn door').toBe(true);
    expect(reach(S.collecting.minX - 3, S.collecting.gap.z), 'the collecting yard\'s gap').toBe(true);
    expect(reach(S.tankRoom.x, S.tankRoom.outer.maxZ + 3), 'the tank room\'s door').toBe(true);
    // On foot: her front door, a person's width.
    const person = (x, z) => !blocked(x, z, 0.5);
    expect(person(S.house.door.x, S.house.door.z - 2.2), 'her door').toBe(true);
  });

  it('counts each piece as built for whatever the yard scatters (builtAt) but not the cat', () => {
    const nf = createNeighbourFarm(LAYOUT);
    for (const f of feet) expect(nf.builtAt(f.x, f.z), f.kind).toBe(true);
  });

  it('moves with the anchor, like the rest of the yard', () => {
    const [ax, az] = NEIGHBOUR_PLAN.anchor;
    const here = neighbourLayout().neighbourFarm.furniture;
    const moved = neighbourLayout({ ...NEIGHBOUR_PLAN, anchor: [ax + 10, az + 5] }).neighbourFarm.furniture;
    expect(moved).toHaveLength(here.length);
    here.forEach((f, i) => {
      expect(moved[i].x - f.x).toBeCloseTo(10, 9);
      expect(moved[i].z - f.z).toBeCloseTo(5, 9);
    });
  });
});

describe('the marks of work on her concrete', () => {
  const marks = yardMarks(S, createRandom(5));
  const of = (type) => marks.filter((m) => m.type === type);

  it('has tracks, hoof prints, a puddle, straw, a scrape and a drip', () => {
    for (const t of ['tyre', 'hoof', 'puddle', 'straw', 'scrape', 'drip', 'oil']) expect(of(t).length, t).toBeGreaterThan(0);
  });

  it('puts oil under each vehicle that stands on the concrete', () => {
    const onSlab = (p) => p.x > S.slab.minX && p.x < S.slab.maxX && p.z > S.slab.minZ && p.z < S.slab.maxZ;
    expect(S.parked.filter(onSlab).length).toBeGreaterThanOrEqual(2);
    for (const p of S.parked.filter(onSlab)) expect(of('oil').some((m) => m.vehicle === p.kind && Math.hypot(m.x - p.x, m.z - p.z) < 1.6), p.kind).toBe(true);
  });

  it('keeps every mark on the slab, and the puddle in the low corner, clear of the buildings', () => {
    for (const m of marks) {
      expect(m.x, m.type).toBeGreaterThan(S.slab.minX);
      expect(m.x, m.type).toBeLessThan(S.slab.maxX);
      expect(m.z, m.type).toBeGreaterThan(S.slab.minZ);
      expect(m.z, m.type).toBeLessThan(S.slab.maxZ);
    }
    const pud = of('puddle')[0];
    expect(pud.x).toBeLessThan(S.slab.minX + 10);
    expect(pud.z).toBeGreaterThan(S.slab.maxZ - 8);
    expect(buildings().some((r) => overlap(r, { minX: pud.x - pud.w / 2, maxX: pud.x + pud.w / 2, minZ: pud.z - pud.d / 2, maxZ: pud.z + pud.d / 2 }))).toBe(false);
  });

  it('puts the straw against the barn door and the drip under the tap', () => {
    expect(of('straw').some((m) => Math.abs(m.z - S.barn.door.z) < 1 && Math.abs(m.x - S.barn.door.x) < 3)).toBe(true);
    const tap = S.furniture.find((f) => f.kind === 'yardTap');
    expect(of('drip').some((m) => Math.hypot(m.x - tap.x, m.z - tap.z) < 1)).toBe(true);
  });

  it('is the same every load, and different for another seed', () => {
    expect(yardMarks(S, createRandom(5))).toEqual(marks);
    expect(yardMarks(S, createRandom(6))).not.toEqual(marks);
  });
});

describe('the yard\'s furniture built', () => {
  let built;
  let marksMesh;
  const boxes = [];
  const y0 = 3;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const dairy = await import('../src/world/dairyKit.js');
    const props = await import('../src/world/neighbourYardProps.js');
    const random = createRandom(7);
    const dm = dairy.dairyMaterials(random, new THREE.MeshStandardMaterial({ color: 0x9d9b94 }));
    built = props.buildYardFurniture(S, y0, dm, { random, fixedBox: (...a) => (boxes.push(a), a) });
    marksMesh = props.buildYardMarks(S, random, y0 + 0.015).mesh;
    built.group.updateMatrixWorld(true);
  });

  it('adds no light of any kind, only emissive lamps that are dark by day', () => {
    let lights = 0;
    built.group.traverse((o) => { if (o.isLight) lights++; });
    expect(lights).toBe(0);
    expect(built.glow.emissiveIntensity).toBe(0);
    expect(built.glow.emissive.getHex()).not.toBe(0);
  });

  it('is meshes on lit standard materials all through, a few dozen materials at most', () => {
    const mats = new Set();
    built.group.traverse((o) => { if (o.isMesh) { expect(o.material.isMeshStandardMaterial).toBe(true); mats.add(o.material); } });
    expect(mats.size).toBeLessThan(26);
  });

  it('stands on the ground and nothing sinks or hangs', () => {
    const box = new THREE.Box3().setFromObject(built.group, true);
    expect(box.min.y).toBeGreaterThan(y0 - 0.7); // the muck heap's lumps are buried a little
    expect(box.max.y).toBeLessThan(y0 + 6.2);
  });

  it('has the yard light on a pole about 5.5 m and the gable light high on the barn', () => {
    const light = S.furniture.find((f) => f.kind === 'yardLight');
    const b = new THREE.Box3();
    let pole = 0;
    built.group.traverse((o) => {
      if (!o.isMesh) return;
      b.setFromObject(o);
      if (Math.abs((b.min.x + b.max.x) / 2 - light.x) < 1 && Math.abs((b.min.z + b.max.z) / 2 - light.z) < 0.3) pole = Math.max(pole, b.max.y - y0);
    });
    expect(pole).toBeGreaterThan(5.4);
    expect(built.colliders.length).toBeGreaterThan(10);
  });

  it('puts the marks in one decal plane a hair over the slab, not a mesh a mark', () => {
    expect(marksMesh.isMesh).toBe(true);
    expect(marksMesh.material.transparent).toBe(true);
    expect(marksMesh.position.y).toBeGreaterThan(y0 + 0.015);
    expect(marksMesh.position.y).toBeLessThan(y0 + 0.03);
  });

  it('has no two faces of one way within 3 mm of a plane and overlapping', () => {
    const hits = coplanarOverlaps(built.group, { textured: true });
    expect(hits.map((f) => `${f.axis}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2)).join(',')} area ${f.area.toFixed(4)}`)).toEqual([]);
  });
});
