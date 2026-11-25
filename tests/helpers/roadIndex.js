import { expect } from 'vitest';
import { createRoads } from '../../src/world/roads.js';

// The index of a road (#664) checked against a walk of every segment, for tests/roadsIndex*.test.js. The walk is slow on purpose, so the
// checks are split over two files that run side by side (#1183); they share the roads and the comparison from here.

export const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const base = (x, z) => 0.04 * x + 0.02 * z + Math.sin(x * 0.07) * 0.6 + Math.cos(z * 0.05) * 0.4; // a made-up lie of the land
export const PLAIN = 1e6; // one cell for the whole map: every segment, every pad and every bay walked

const winding = (n, seed) => {
  const r = rng(seed);
  let x = -1400;
  let z = 0;
  let heading = 0;
  const points = [[x, z]];
  for (let i = 0; i < n; i++) {
    heading += (r() - 0.5) * 0.9;
    heading *= 0.9;
    x += Math.cos(heading) * 50;
    z += Math.sin(heading) * 50;
    points.push([x, z]);
  }
  return points;
};

/** A winding 3 km road with passing places, two pads and a side road joining it, indexed (`fast`) and walked whole (`plain`). */
export function longRoads() {
  const longDef = { id: 'long', name: 'Long Road', surface: 'tarmac', halfWidth: 2.2, pavement: 0.4, points: winding(60, 7), camber: 0.1, markings: { centre: 'none' }, level: { shoulder: 3, lead: [2, 3], blend: 8, mouth: 4 }, passing: { spacing: 150, length: 8, bay: 2.5 } };
  const probe = createRoads([longDef]);
  const mid = probe.pointAt('long', 1500);
  const side = (id, onto, end, ox, oz) => ({ id, name: id, surface: 'stone', halfWidth: 1.6, points: [[mid.x + ox, mid.z + oz], [mid.x + ox * 5, mid.z + oz * 5 + 40], [mid.x + ox * 8, mid.z + oz * 8 + 70]], junction: { end, onto }, level: { shoulder: 2, blend: 8, mouth: 4 } });
  const defs = [
    { ...longDef, pads: [{ x: mid.x + 20, z: mid.z + 30, radius: 6 }, { x: probe.pointAt('long', 300).x, z: probe.pointAt('long', 300).z + 8, radius: 4 }] },
    side('lane2', 'long', 'start', 2, 0),
  ];
  return { fast: createRoads(defs), plain: createRoads(defs, { cell: PLAIN }), mid };
}

const ground = (x, z) => base(x, z);
const pick = (a) => (a ? { ...a, road: a.road?.id ?? a.road } : a);

/** Every question asked of both networks at (x, z), with the same answer expected. */
export function same(nets, x, z) {
  const [f, p] = nets;
  expect(f.tarmacAt(x, z)).toBe(p.tarmacAt(x, z));
  expect(f.stoneAt(x, z)).toBe(p.stoneAt(x, z));
  expect(f.surfaceAt(x, z)).toEqual(p.surfaceAt(x, z));
  expect(pick(f.nearest(x, z))).toEqual(pick(p.nearest(x, z)));
  expect(pick(f.nearest(x, z, 12))).toEqual(pick(p.nearest(x, z, 12)));
  expect(f.onCarriageway(x, z)?.id).toBe(p.onCarriageway(x, z)?.id);
  for (const id of ['long', 'lane2']) expect(f.onRoad(id, x, z)).toBe(p.onRoad(id, x, z));
  expect(f.levelAt(x, z, ground)).toEqual(p.levelAt(x, z, ground));
}

/**
 * Points `from` to `to` of the 20,000 the long road is checked at, the same ones however they are split: most near the road's middle, so
 * the cases that matter (edges, bays, pads) come up, the rest anywhere in the box. Each point takes two numbers from one seeded stream, so
 * the points before `from` are drawn and passed over.
 */
export function longRoadPoints({ fast, plain }, from, to) {
  const b = fast.road('long').bounds;
  const r = rng(11);
  for (let i = 0; i < to; i++) {
    if (i < from) {
      r();
      r();
      continue;
    }
    if (i % 2) same([fast, plain], b.minX - 60 + r() * (b.maxX - b.minX + 120), b.minZ - 60 + r() * (b.maxZ - b.minZ + 120));
    else {
      const p = fast.pointAt('long', r() * fast.road('long').length);
      const off = (r() - 0.5) * 16;
      same([fast, plain], p.x + p.tz * off, p.z - p.tx * off);
    }
  }
}
