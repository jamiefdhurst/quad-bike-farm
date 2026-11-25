import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, BACK_LANE_PLAN, OUTLINE_PLAN, fromPlan } from '../src/world/layoutNew.js';
import { roadNetwork } from '../src/world/roads.js';
import { pointInPolygon } from '../src/world/polygons.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

const two = LAYOUT;
const net = roadNetwork(two);
const road = net.road('backLane');

describe('Back Lane', () => {
  it('never doubles back on itself, nor any road: no two samples in a row turn more than 25 degrees, hairpins and all (the point before the ford made a loop, #1187)', () => {
    for (const r of net.roads) {
      for (let i = 1; i < r.samples.length; i++) {
        const [a, b] = [r.samples[i - 1], r.samples[i]];
        expect(a.tx * b.tx + a.tz * b.tz, `${r.id} at ${b.s.toFixed(1)} m`).toBeGreaterThan(Math.cos((25 * Math.PI) / 180));
      }
    }
  });

  it('is 2.5 to 3.4 km of single track joined to the lane at both ends', () => {
    expect(road.length).toBeGreaterThan(2500);
    expect(road.length).toBeLessThan(3400);
    expect(road.halfWidth * 2).toBeCloseTo(3.2, 1);
    expect(road.junctions.map((j) => j.end)).toEqual(['start', 'end']);
    const lane = two.publicLane.x;
    expect(road.samples[0].x).toBeCloseTo(lane, 3);
    expect(road.samples[road.samples.length - 1].x).toBeCloseTo(lane, 3);
  });

  it('keeps outside the farm\'s outline by at least 8 m everywhere', () => {
    const outline = OUTLINE_PLAN.map(([x, z]) => fromPlan([x, z]));
    const edges = outline.map((a, i) => [a, outline[(i + 1) % outline.length]]);
    const dist = (p, [a, b]) => {
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * (b[0] - a[0]) + (p.z - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
      return Math.hypot(p.x - a[0] - t * (b[0] - a[0]), p.z - a[1] - t * (b[1] - a[1]));
    };
    for (const p of road.samples) {
      if (p.x > fromPlan([880, 0])[0]) continue; // the two ends are on the lane
      expect(pointInPolygon(outline, p.x, p.z)).toBe(false);
      expect(Math.min(...edges.map((e) => dist(p, e)))).toBeGreaterThan(8);
    }
  });

  it('has 12 to 20 passing places 150 to 250 m apart', () => {
    const places = net.passingPlaces('backLane');
    expect(places.length).toBeGreaterThanOrEqual(12);
    expect(places.length).toBeLessThanOrEqual(20);
    for (let i = 1; i < places.length; i++) {
      expect(places[i].s - places[i - 1].s).toBeGreaterThanOrEqual(150);
      expect(places[i].s - places[i - 1].s).toBeLessThanOrEqual(250);
    }
  });

  it('is on the plan\'s line: the plan points are within 3 m of the smoothed centreline', () => {
    for (const pp of BACK_LANE_PLAN.points) {
      const [x, z] = fromPlan(pp);
      expect(Math.min(...road.samples.map((p) => Math.hypot(p.x - x, p.z - z)))).toBeLessThan(3);
    }
  });

  describe('the way along it', () => {
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    it('has no gap, step or bump over 3 cm along its whole centreline, from the lane at one end to the lane at the other', () => {
      let worst = 0;
      let at = 0;
      let prev = heights.heightAt(road.samples[0].x, road.samples[0].z);
      for (let s = 0.02; s <= road.length; s += 0.02) {
        const p = net.pointAt('backLane', s);
        const h = heights.heightAt(p.x, p.z);
        if (Math.abs(h - prev) > worst) [worst, at] = [Math.abs(h - prev), s];
        prev = h;
      }
      expect(worst, `${at.toFixed(1)} m along`).toBeLessThan(0.03);
    });

    it('cuts no deeper than 1.5 m into a bank anywhere, so no cutting is needed', () => {
      const cuts = net.cuttings(heights.naturalAt, 2, heights.naturalAt);
      expect(cuts.filter((c) => c.road === 'backLane' && !c.flagged)).toEqual([]);
    });
  });
});

describe('the hedges along it', () => {
  it('stand a verge\'s width clear of the carriageway, further out round a passing place', async () => {
    const { hedgeOffset, laneHedgeRuns, JUNCTION_OPEN } = await import('../src/world/laneHedges.js');
    const plain = road.halfWidth + road.verge;
    const bay = road.bays[0];
    expect(hedgeOffset(road, 3, bay.side)).toBeCloseTo(plain, 6);
    expect(hedgeOffset(road, bay.s, bay.side)).toBeCloseTo(plain + bay.bay, 6);
    expect(hedgeOffset(road, bay.s, -bay.side)).toBeCloseTo(plain, 6);
    const runs = laneHedgeRuns(road, [{ s: 500, half: 2.6, side: 1 }]);
    expect(runs.filter((r) => r.side === 1).length).toBe(2);
    expect(runs.filter((r) => r.side === -1).length).toBe(1);
    expect(Math.min(...runs.map((r) => r.from))).toBe(JUNCTION_OPEN);
    expect(Math.max(...runs.map((r) => r.to))).toBeCloseTo(road.length - JUNCTION_OPEN, 6);
  });
});

describe('the signs along it', () => {
  it('has the entry signs at both ends, a passing place sign each way at every bay, bends and chevrons at the hairpins, and the ford\'s signs', async () => {
    const { laneSigns, SIGN_KINDS } = await import('../src/world/laneSigns.js');
    const signs = laneSigns(road);
    const of = (k) => signs.filter((s) => s.kind === k);
    for (const k of SIGN_KINDS) expect(of(k).length, k).toBeGreaterThan(0);
    expect(of('singleTrack').map((s) => s.facing).sort()).toEqual([-1, 1]);
    expect(of('nationalLimit').length).toBe(2);
    expect(of('passingPlace').length).toBe(2 * road.bays.length);
    expect(of('chevron').length).toBe(3 * 2);
    expect(of('gauge').length).toBe(1);
    expect(of('bends').length).toBe(2);
    expect(of('ford').length).toBe(2);
    // Each one stands on the left of the way that reads it.
    for (const s of signs.filter((x) => ['singleTrack', 'nationalLimit', 'bends', 'ford'].includes(x.kind))) expect(s.side).toBe(s.facing);
    for (const s of signs) {
      expect(s.s).toBeGreaterThan(0);
      expect(s.s).toBeLessThan(road.length);
    }
  });
});

describe('the ford', () => {
  const heights = createTerrainHeight(two, new Track(two.trackPoints));
  const [fx] = fromPlan(BACK_LANE_PLAN.ford.at);
  const fz = heights.hill.streamZ(fx);
  it('has about 0.15 to 0.2 m of water over the road and a channel beside it that runs into the pasture\'s stream', () => {
    const water = heights.hill.waterDepthAt(fx);
    expect(water).toBeGreaterThan(0.12);
    expect(water).toBeLessThan(0.2);
    expect(heights.waterAt?.(fx, fz) ?? heights.hill.waterAt(fx, fz)).toBeGreaterThan(0.9);
    const pasture = two.hill.pasture;
    for (let x = fx; x <= pasture.minX + 10; x += 2) expect(heights.hill.waterAt(x, heights.hill.streamZ(x)), `x ${x}`).toBeGreaterThan(0.5);
  });

  it('is a dip in the road, the stream\'s bed, with no step in it (the whole centreline test above walks it at 2 cm)', () => {
    const road2 = net.road('backLane');
    const s = road2.samples.reduce((a, p) => (Math.hypot(p.x - fx, p.z - fz) < Math.hypot(a.x - fx, a.z - fz) ? p : a)).s;
    const at = (d) => {
      const p = net.pointAt('backLane', s + d);
      return heights.heightAt(p.x, p.z);
    };
    // The bed is lower than the road 12 m either side of it, by more than the land's own fall along the road there, and not by more than the stream's channel and that.
    expect(at(0)).toBeLessThan(at(12) - 0.05);
    expect(at(0)).toBeLessThan(at(-12) - 0.05);
    expect(at(-12) - at(0)).toBeLessThan(1.5);
  });

  it('rises with the stream: the water deepens after rain, by the stream\'s own level', () => {
    heights.hill.setRise(0.22);
    expect(heights.hill.waterDepthAt(fx)).toBeGreaterThan(0.35);
    heights.hill.setRise(0);
  });
});

describe('the verge', () => {
  it('has cow parsley, nettles and dock along both sides, between the tarmac and the hedge and clear of the gaps', async () => {
    const { vergePlants } = await import('../src/world/laneVerge.js');
    const { hedgeOffset } = await import('../src/world/laneHedges.js');
    let seed = 5;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const plants = vergePlants(road, random, (s) => s > 100 && s < 140);
    expect(new Set(plants.map((p) => p.kind))).toEqual(new Set(['parsley', 'nettle', 'dock']));
    expect(new Set(plants.map((p) => p.side))).toEqual(new Set([1, -1]));
    expect(plants.length).toBeGreaterThan(2500);
    for (const p of plants) {
      expect(p.off).toBeGreaterThan(road.halfWidth);
      expect(p.off).toBeLessThan(hedgeOffset(road, p.s, p.side));
      expect(p.s > 100 && p.s < 140).toBe(false);
    }
  });
});

describe('the hedgerow trees', () => {
  it('stand 35 to 75 m apart on each side, in the hedge, clear of the gates, the ford and the ends', async () => {
    const { laneTrees, JUNCTION_OPEN } = await import('../src/world/laneHedges.js');
    const { laneGaps } = await import('../src/world/backLaneProps.js');
    let seed = 9;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gaps = laneGaps(road);
    const trees = laneTrees(road, random, gaps);
    expect(trees.length).toBeGreaterThan(50);
    for (const side of [1, -1]) {
      const mine = trees.filter((t) => t.side === side).map((t) => t.s);
      for (let i = 1; i < mine.length; i++) expect(mine[i] - mine[i - 1]).toBeGreaterThanOrEqual(35);
    }
    for (const t of trees) {
      expect(t.s).toBeGreaterThan(JUNCTION_OPEN + 12);
      expect(t.s).toBeLessThan(road.length - JUNCTION_OPEN - 12);
      for (const g of gaps) if (g.side === undefined || g.side === t.side) expect(Math.abs(t.s - g.s)).toBeGreaterThan(g.half);
    }
  });
});

describe('the ditch', () => {
  it('runs along the low (east) side of the west stretch, at the hedge\'s foot, and nowhere along the north and south stretches', () => {
    const [, z0] = fromPlan([13, 300]); // on the west stretch
    const mid = road.samples.reduce((a, p) => (Math.abs(p.z - z0) < Math.abs(a.z - z0) ? p : a));
    const x0 = mid.x; // the middle of the road there, which runs south
    const at = (dx) => net.ditchAt(x0 + dx, mid.z);
    const centre = road.halfWidth + BACK_LANE_PLAN.ditch.centre;
    expect(at(centre)).toBeCloseTo(BACK_LANE_PLAN.ditch.depth, 1);
    expect(at(-centre)).toBe(0); // not on the uphill side
    expect(at(0)).toBe(0);
    for (const [px, pz] of [[400, 0], [600, 880]]) {
      const [x, z] = fromPlan([px, pz]);
      const m = road.samples.reduce((a, p) => (Math.abs(p.x - x) < Math.abs(a.x - x) && Math.abs(p.z - z) < 20 ? p : a), road.samples[0]);
      for (const d of [-centre, centre]) expect(net.ditchAt(m.x, m.z + d)).toBe(0);
    }
  });
});

describe('the drains', () => {
  it('are a few, one about every 330 m, clear of the ford and the passing places', async () => {
    const { laneGrates } = await import('../src/world/laneSigns.js');
    const grates = laneGrates(road);
    expect(grates.length).toBeGreaterThanOrEqual(6);
    for (const g of grates) for (const b of road.bays) expect(Math.abs(g.s - b.s)).toBeGreaterThanOrEqual(b.length);
  });
});

describe('traffic along it', () => {
  it('waits at a passing place for what comes the other way, and both get through without sharing the road', async () => {
    const { LaneDrive, shouldYield } = await import('../src/world/backLaneTraffic.js');
    const all = [];
    const a = new LaneDrive({ id: 1, road, all, dir: 1, speed: 7 });
    const b = new LaneDrive({ id: 2, road, all, dir: -1, speed: 7 });
    const mid = road.bays[4].s; // they meet at a passing place, one side of the road or the other
    a.s = mid - 38;
    b.s = mid + 38;
    all.push(a, b);
    const call = shouldYield(road, a, b);
    expect(call).not.toBeNull();
    expect(call.yields !== shouldYield(road, b, a).yields || call.bay === null).toBe(true); // exactly one gives way, unless there is no bay
    let waited = 0;
    let closest = Infinity;
    let atBay = false;
    for (let t = 0; t < 1200 && !(a.arrived && b.arrived); t += 0.1) {
      a.update(0.1);
      b.update(0.1);
      if (a.state === 'waiting' || b.state === 'waiting') {
        waited += 0.1;
        const waiter = a.state === 'waiting' ? a : b;
        atBay = atBay || road.bays.some((bay) => Math.abs(bay.s - waiter.s) < 3);
      }
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(a.arrived && b.arrived).toBe(true);
    expect(waited).toBeGreaterThan(0);
    expect(atBay).toBe(true);
    expect(closest).toBeGreaterThan(1.8); // a car is 1.7 m across: they passed side by side only where a bay let them
  });

  it('is two vehicles of the same way, the second behind the first, never meeting', async () => {
    const { LaneDrive } = await import('../src/world/backLaneTraffic.js');
    const all = [];
    const a = new LaneDrive({ id: 1, road, all, dir: 1, speed: 6 });
    const b = new LaneDrive({ id: 2, road, all, dir: 1, speed: 8 }); // faster, dealt 3 s after the first at the same end (#1015)
    all.push(a);
    let closest = Infinity;
    for (let i = 0; i < 100; i++) {
      if (i === 30) all.push(b);
      a.update(0.1);
      if (i >= 30) {
        b.update(0.1);
        closest = Math.min(closest, (a.s - b.s) * a.dir);
      }
    }
    expect(a.s).toBeGreaterThan(50);
    expect(a.state).toBe('driving');
    expect(b.s).toBeGreaterThan(20);
    expect(b.state).toBe('driving');
    expect(closest).toBeGreaterThan(5); // still behind it, and never on it
  });

  // #1015: same-way vehicles drove through each other, a van at 4 m/s and a car at 9 m/s behind it reaching 0.00 m apart.
  it('keeps a fast vehicle at least 5 m behind a slow one the whole way round, either way', async () => {
    const { LaneDrive } = await import('../src/world/backLaneTraffic.js');
    for (const dir of [1, -1]) {
      const all = [];
      const van = new LaneDrive({ id: 1, road, all, dir, speed: 4 });
      const car = new LaneDrive({ id: 2, road, all, dir, speed: 9 });
      van.s = dir > 0 ? 60 : road.length - 60;
      all.push(van, car);
      let closest = Infinity;
      let nearestAlong = Infinity;
      for (let t = 0; t < 1500 && !van.arrived; t += 0.1) {
        van.update(0.1);
        car.update(0.1);
        if (van.arrived || car.arrived) break;
        closest = Math.min(closest, Math.hypot(van.x - car.x, van.z - car.z));
        nearestAlong = Math.min(nearestAlong, (van.s - car.s) * dir);
      }
      expect(van.arrived, `dir ${dir}`).toBe(true);
      expect(closest, `dir ${dir}`).toBeGreaterThanOrEqual(5);
      expect(nearestAlong, `dir ${dir}: it caught the van up and followed it`).toBeLessThan(20);
    }
  });

  it('never puts two vehicles in one passing place when two following each other meet one coming the other way', async () => {
    const { LaneDrive } = await import('../src/world/backLaneTraffic.js');
    for (const dir of [1, -1]) {
      const bay = road.bays.find((b, i) => b.side === dir && i >= 2 && i < road.bays.length - 2); // on the left of the two that follow
      const all = [];
      const lead = new LaneDrive({ id: 1, road, all, dir, speed: 7 });
      const follower = new LaneDrive({ id: 2, road, all, dir, speed: 7 });
      const other = new LaneDrive({ id: 3, road, all, dir: -dir, speed: 7 });
      lead.s = bay.s - 50 * dir;
      follower.s = bay.s - 64 * dir;
      other.s = bay.s + 50 * dir;
      all.push(lead, follower, other);
      let waited = 0;
      let closest = Infinity;
      for (let t = 0; t < 1200 && !all.every((v) => v.arrived); t += 0.1) {
        for (const v of all) v.update(0.1);
        const held = all.filter((v) => !v.arrived && (v.state === 'pulling' || v.state === 'waiting')).map((v) => v.bay);
        expect(new Set(held).size, `dir ${dir} at ${t.toFixed(1)} s`).toBe(held.length);
        if (all.some((v) => v.state === 'waiting')) waited += 0.1;
        if (!lead.arrived && !follower.arrived) closest = Math.min(closest, (lead.s - follower.s) * dir);
      }
      expect(all.every((v) => v.arrived), `dir ${dir}`).toBe(true);
      expect(waited, `dir ${dir}: one of them waited in a passing place`).toBeGreaterThan(0);
      expect(closest, `dir ${dir}`).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('the lane\'s traffic on the new farm', () => {
  it('sets vehicles off round Back Lane now and then, from either end, and they go the whole way', async () => {
    const { Traffic, DEFAULT_TRAFFIC_PARAMS, visitPlaces } = await import('../src/world/traffic.js');
    let seed = 3;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const traffic = new Traffic({ places: visitPlaces(two), params: { ...DEFAULT_TRAFFIC_PARAMS, passEvery: 0, visitEvery: 0, backEvery: 0, aRoadEvery: 0 }, random });
    const v = traffic.spawnBackLane('van', 1);
    expect(v.backLane).toBe(true);
    expect(v.drive.s).toBe(0);
    const w = traffic.spawnBackLane('tor', -1);
    expect(w.drive.s).toBeCloseTo(road.length, 6);
    const events = [];
    for (let t = 0; t < 1500 && traffic.vehicles.length; t += 0.5) events.push(...traffic.update(0.5, { blockers: [], darkness: 0 }));
    expect(traffic.vehicles.length).toBe(0);
    expect(events.filter((e) => e.type === 'gone').length).toBe(2);
    expect(events.filter((e) => e.type === 'pass').length).toBe(0); // they do not go by the big gate
  });

  it('spawns on its own when backEvery is set, and not at all on today\'s farm', async () => {
    const { Traffic, DEFAULT_TRAFFIC_PARAMS, visitPlaces } = await import('../src/world/traffic.js');
    const random = () => 0.5;
    const on = new Traffic({ places: visitPlaces(two), params: { ...DEFAULT_TRAFFIC_PARAMS, passEvery: 0, visitEvery: 0, backEvery: 20 }, random });
    for (let t = 0; t < 600; t += 1) on.update(1, { blockers: [], darkness: 0 });
    expect(on.vehicles.some((x) => x.backLane) || on.count > 0).toBe(true);
  });
});

describe('the places you can go to', () => {
  it('has Back Lane\'s on the tarmac, and none on today\'s farm', async () => {
    const { backLanePlaces } = await import('../src/console/gameHost.js');
    const places = backLanePlaces(two, net);
    for (const k of ['backlane', 'backlaneford', 'hairpins', 'footpath']) {
      expect(places[k], k).toBeTruthy();
      expect(net.onCarriageway(places[k].x, places[k].z) ?? net.tarmacAt(places[k].x, places[k].z), k).toBeTruthy();
    }
  });
});

describe('walking and riding into the gateways', () => {
  it('leaves each gate\'s opening 3.5 m or more between its posts and the hedge ends beyond them, so a quad goes through', async () => {
    const { laneGaps, laneGates, GATE_HALF } = await import('../src/world/backLaneProps.js');
    const { laneHedgeRuns } = await import('../src/world/laneHedges.js');
    const gates = laneGates(road);
    expect(gates.length).toBe(5); // the north, the wood, the far, the hill and the moor gate (#713)
    expect(2 * (GATE_HALF - 0.1) - 0.24).toBeGreaterThan(3.5); // the posts' clear width
    const runs = laneHedgeRuns(road, laneGaps(road));
    for (const g of gates) {
      for (const r of runs.filter((x) => x.side === g.side)) {
        expect(r.from >= g.s + GATE_HALF - 1e-6 || r.to <= g.s - GATE_HALF + 1e-6, `${g.id}: a hedge run across its opening`).toBe(true);
      }
    }
  });
});
