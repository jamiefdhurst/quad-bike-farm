import { describe, it, expect } from 'vitest';
import { counts } from '../src/world/roads.js';
import { rng, longRoads, longRoadPoints, same } from './helpers/roadIndex.js';

// The index (#664): a lookup looks only at the cells near the point, and must answer as a walk of every segment does. The other half of the
// 20,000 points and today's roads are in roadsIndexMore.test.js, so the two halves of the slow walk run side by side (#1183).
describe('the index of a road', () => {
  const nets = longRoads();
  const { fast, plain, mid } = nets;

  it('answers as a walk of every segment does, at the first 10,000 of 20,000 points over a winding 3 km road with passing places and a junction', () => {
    expect(fast.road('long').length).toBeGreaterThan(2500);
    expect(fast.passingPlaces('long').length).toBeGreaterThan(8);
    longRoadPoints(nets, 0, 10000);
  }, 120000);

  it('answers the same past each end, behind a square junction end and far from any road', () => {
    for (const id of ['long', 'lane2']) {
      const r = fast.road(id);
      for (const [s, dir] of [[0, -1], [r.length, 1]]) {
        const e = fast.pointAt(id, s);
        for (let along = 0; along <= 40; along += 2.5) for (const off of [-6, -2, 0, 1.5, 5]) same([fast, plain], e.x + e.tx * dir * along + e.tz * off, e.z + e.tz * dir * along - e.tx * off);
      }
    }
    for (const [x, z] of [[0, 0], [5000, -5000], [-9000, 20], [mid.x, mid.z + 3000], [mid.x + 300, mid.z - 300]]) same([fast, plain], x, z);
    // Behind the square end of the side road, on the far side of the long road: nothing there.
    const j = fast.road('lane2').segs[0];
    for (let back = 0.5; back < 12; back += 1.5) same([fast, plain], j.a.x - j.tx * back, j.a.z - j.tz * back);
  });

  it('looks at few segments for a lookup: under 30 on average across the farm, on a 3 km road', () => {
    const b = fast.road('long').bounds;
    const r = rng(3);
    const before = counts.segments;
    const N = 20000;
    for (let i = 0; i < N; i++) fast.tarmacAt(b.minX - 200 + r() * (b.maxX - b.minX + 400), b.minZ - 200 + r() * (b.maxZ - b.minZ + 400));
    const segments = fast.roads.reduce((n, road) => n + road.segs.length, 0);
    expect(segments).toBeGreaterThan(1500); // a walk of the lot would be this many a lookup
    expect((counts.segments - before) / N).toBeLessThan(30);
  });
});
