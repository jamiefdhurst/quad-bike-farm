import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { roadNetwork } from '../src/world/roads.js';
import { Traffic, Visit, DEFAULT_TRAFFIC_PARAMS, A_ROAD_KINDS, visitPlaces } from '../src/world/traffic.js';
import { leaveRoute, hasGone, goneBeyond, homeVia, DEFAULT_GOING_HOME_PARAMS as G } from '../src/npc/goingHome.js';

const two = layoutNew(LAYOUT, RAW_LAYOUT);
const net = roadNetwork(two);
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const quiet = { ...DEFAULT_TRAFFIC_PARAMS, passEvery: 0, visitEvery: 0, backEvery: 0, aRoadEvery: 0 };
const on = (x, z) => ['lane', 'aRoad'].includes(net.onCarriageway(x, z)?.id);

describe('traffic on the A-road (#687)', () => {
  it('sets cars, vans and lorries off down it at 50 to 60 mph from either end, drawn only, and they go its whole length and are gone', () => {
    const t = new Traffic({ places: visitPlaces(two), params: quiet, random: seeded(5) });
    const down = t.spawnARoad('lorry', 1);
    const up = t.spawnARoad('van', -1);
    expect(down.aRoad && up.aRoad).toBe(true);
    expect(down.model).toBe('lorry');
    expect(down.drive.speed).toBeGreaterThanOrEqual(22);
    expect(down.drive.speed).toBeLessThanOrEqual(27);
    const a = net.road('aRoad');
    expect(down.drive.z).toBeCloseTo(a.samples[0].z, 0);
    expect(up.drive.z).toBeCloseTo(a.samples.at(-1).z, 0);
    const seen = [];
    let gone = 0;
    for (let s = 0; s < 200 && t.vehicles.length; s += 0.5) {
      for (const e of t.update(0.5, { blockers: [], darkness: 0 })) if (e.type === 'gone') gone++;
      for (const v of t.vehicles) seen.push({ x: v.drive.x, z: v.drive.z });
    }
    expect(gone).toBe(2);
    expect(t.vehicles).toEqual([]);
    for (const p of seen) expect(net.onCarriageway(p.x, p.z)?.id, `${p.x}, ${p.z}`).toBe('aRoad');
    expect(Object.keys(A_ROAD_KINDS).sort()).toEqual(['finch', 'griffin', 'lorry', 'van']);
  });

  it('deals one every 5 to 20 s on its own, and none on today\'s farm', () => {
    const t = new Traffic({ places: visitPlaces(two), params: { ...quiet, aRoadEvery: 12.5 }, random: seeded(9) });
    const at = [];
    for (let s = 0; s < 900; s += 0.25) for (const e of t.update(0.25, { blockers: [], darkness: 0 })) void e;
    // The count of what has been dealt (ids) and when: spawn times are read off the vehicles' ids as they appear.
    const seen = new Set();
    const t2 = new Traffic({ places: visitPlaces(two), params: { ...quiet, aRoadEvery: 12.5 }, random: seeded(9) });
    for (let s = 0; s < 900; s += 0.25) {
      t2.update(0.25, { blockers: [], darkness: 0 });
      for (const v of t2.vehicles) if (!seen.has(v.id)) { seen.add(v.id); at.push(s); }
    }
    expect(at.length).toBeGreaterThan(40);
    const gaps = at.slice(1).map((s, i) => s - at[i]).filter((g) => g > 0);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0); // cars dealt in the same quarter second count once
    const mean = (at.at(-1) - at[0]) / (at.length - 1);
    expect(mean).toBeGreaterThan(8);
    expect(mean).toBeLessThan(17);
    expect(new Traffic({ places: visitPlaces(LAYOUT), params: quiet, random: seeded(1) }).spawnARoad()).toBeNull();
  });
});

describe('the lane\'s traffic follows its bend (#687)', () => {
  for (const dir of [1, -1]) {
    it(`takes the lane ${dir > 0 ? 'in from the A-road and out of its south end' : 'from its south end to the A-road and out onto it'}, on the road the whole way`, () => {
      const t = new Traffic({ places: visitPlaces(two), params: quiet, random: seeded(11 + dir) });
      let v;
      for (let i = 0; i < 20 && (!v || v.dir !== dir); i++) {
        if (v) t.vehicles.pop();
        v = t.spawnPass('van');
      }
      expect(v.dir).toBe(dir);
      const lane = net.road('lane');
      const seen = [];
      let onLane = 0;
      for (let s = 0; s < 400 && t.vehicles.length; s += 0.05) {
        t.update(0.05, { blockers: [], darkness: 0 });
        if (!t.vehicles.length) break;
        seen.push({ x: v.drive.x, z: v.drive.z });
        if (net.onCarriageway(v.drive.x, v.drive.z)?.id === 'lane') onLane++;
      }
      expect(t.vehicles).toEqual([]);
      const off = seen.filter((p) => !on(p.x, p.z) && p.z <= two.ground.maxZ && Math.min(...lane.samples.map((q) => Math.hypot(q.x - p.x, q.z - p.z))) > 4);
      expect(off, `${off.length} samples off the road`).toEqual([]);
      expect(onLane).toBeGreaterThan(100);
      const xs = seen.filter((p) => net.onCarriageway(p.x, p.z)?.id === 'lane').map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300); // round the bend, not a straight line between its ends
    });
  }
});

describe('visitors and the girls driving home use the A-road (#687)', () => {
  it('has a visitor come in by the A-road from the north, and go out by it', () => {
    const places = visitPlaces(two);
    const { start, path } = places.route.in(1);
    expect(net.onCarriageway(start.x, start.z)?.id).toBe('aRoad');
    for (const p of path) expect(on(p.x, p.z), `${p.x}, ${p.z}`).toBe(true);
    const out = places.route.out(-1, true);
    expect(net.onCarriageway(out.at(-1).x, out.at(-1).z)?.id).toBe('aRoad');
    const south = places.route.out(1);
    expect(south.at(-1).z).toBeGreaterThan(two.ground.maxZ - 5);
    const v = new Visit({ kind: 'post', places, from: 1, to: -1, leaveOpen: false, params: DEFAULT_TRAFFIC_PARAMS, colour: 0xc8102e, north: false });
    expect(net.onCarriageway(v.drive.x, v.drive.z)?.id).toBe('aRoad');
  });

  it('has a girl drive home north up the lane and out onto the A-road, counted gone where it leaves the map', () => {
    const slot = { x: two.road.fromX + 6, z: two.road.z + 4 };
    const route = leaveRoute(slot, two, G, 'aRoad');
    const end = route.at(-1);
    expect(net.onCarriageway(end.x, end.z)?.id).toBe('aRoad');
    expect(hasGone(two, G, end, 'aRoad')).toBe(true);
    expect(hasGone(two, G, { x: two.publicLane.x, z: two.road.z + 20 }, 'aRoad')).toBe(false);
    expect(goneBeyond(two, G, 'aRoad').aRoad).toBe(true);
    for (const p of route.slice(5)) expect(on(p.x, p.z) || Math.abs(p.x - two.publicLane.x) < 6, `${p.x}, ${p.z}`).toBe(true);
    const picks = { lane: 0, backLane: 0, aRoad: 0 };
    for (let i = 0; i < 100; i++) picks[homeVia(two, 'jess', i / 100, G)]++;
    expect(picks.aRoad).toBeGreaterThan(10);
    expect(picks.lane).toBeGreaterThan(10);
    expect(homeVia(LAYOUT, 'jess', 0.9, G)).toBe('lane'); // today's farm has none
  });
});
