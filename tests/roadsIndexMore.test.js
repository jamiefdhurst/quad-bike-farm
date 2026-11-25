import { describe, it } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createRoads } from '../src/world/roads.js';
import { rng, PLAIN, longRoads, longRoadPoints, same } from './helpers/roadIndex.js';

// The index (#664), the rest of its check against a walk of every segment: split from roadsIndex.test.js so the slow walk runs in two
// files side by side (#1183).
describe('the index of a road', () => {
  const nets = longRoads();

  it('answers as a walk of every segment does, at the other 10,000 of 20,000 points over a winding 3 km road with passing places and a junction', () => {
    longRoadPoints(nets, 10000, 20000);
  }, 120000);

  it('answers the same as a plain walk of the segments on every road of the farm', () => {
    const [f, p] = [createRoads(LAYOUT.roads), createRoads(LAYOUT.roads, { cell: PLAIN })];
    const r = rng(5);
    for (let i = 0; i < 2000; i++) same([f, p], -80 + r() * 200, -60 + r() * 520 - 200); // the plain walk is slow on the farm's many roads
    for (const road of f.roads) for (let s = -10; s < road.length + 10; s += 25) {
      const q = f.pointAt(road.id, Math.max(0, Math.min(road.length, s)));
      for (const off of [-8, -3, 0, 2, 7]) same([f, p], q.x + q.tz * off - q.tx * Math.min(0, s), q.z - q.tx * off - q.tz * Math.min(0, s));
    }
  });
});
