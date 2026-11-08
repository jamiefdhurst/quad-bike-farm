import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createRoads, roadNetwork, describeRoad, describeRoadUnder, MAX_CUT, KEEP_LEFT, counts } from '../src/world/roads.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

const net = roadNetwork(LAYOUT);
const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const base = (x, z) => 0.04 * x + 0.02 * z + Math.sin(x * 0.07) * 0.6 + Math.cos(z * 0.05) * 0.4; // a made-up lie of the land
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('the road network of the farm', () => {
  it('has the lane, the farm road and the village street, each a tarmac road with a width', () => {
    expect(net.roads.map((r) => r.id)).toEqual(['lane', 'farm', 'street']);
    for (const r of net.roads) {
      expect(r.surface).toBe('tarmac');
      expect(r.halfWidth).toBeGreaterThan(1);
      expect(r.length).toBeGreaterThan(50);
    }
    expect(net.road('street').junction).toEqual({ end: 'start', onto: 'lane' });
  });

  it('agrees with the numbers the lane and the farm road were laid out with', () => {
    expect(net.road('lane').halfWidth).toBe(LAYOUT.publicLane.halfWidth);
    expect(net.pointAt('lane', 0).x).toBe(LAYOUT.publicLane.x);
    expect(net.pointAt('lane', 0).z).toBe(LAYOUT.publicLane.minZ);
    expect(net.pointAt('lane', net.road('lane').length).z).toBe(LAYOUT.publicLane.maxZ);
    expect(net.road('farm').halfWidth).toBe(LAYOUT.road.halfWidth);
    expect(net.pointAt('farm', 0)).toMatchObject({ x: LAYOUT.road.fromX, z: LAYOUT.road.z });
    expect(net.pointAt('farm', net.road('farm').length).x).toBe(LAYOUT.road.toX);
    expect(net.road('farm').pads[0]).toMatchObject({ x: LAYOUT.road.pad.x, z: LAYOUT.road.z, radius: LAYOUT.road.pad.radius });
  });

  it('is tarmac along the middle of every road and not 1 m past its edge', () => {
    for (const r of net.roads) {
      const solo = createRoads([{ ...r, junction: undefined }]);
      for (let s = 3; s < r.length - 3; s += 5) {
        const p = net.pointAt(r.id, s);
        expect(net.tarmacAt(p.x, p.z), `${r.id} at ${s}`).toBe(1);
        for (const side of [-1, 1]) {
          const x = p.x + p.tz * side * (r.hard + 1);
          const z = p.z - p.tx * side * (r.hard + 1);
          if (r.pads.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius + 2)) continue; // the hardstanding is wider than the road
          expect(solo.tarmacAt(x, z), `${r.id} at ${s}, side ${side}`).toBe(0);
        }
      }
    }
  });

  it('counts the street cut square where it joins the lane, so its pavement does not spill over the lane\'s far side', () => {
    const lane = LAYOUT.publicLane;
    const start = net.pointAt('street', 0);
    expect(net.tarmacAt(start.x, start.z)).toBe(1);
    expect(net.tarmacAt(lane.x + lane.halfWidth + 1, start.z)).toBe(0);
    expect(net.nearest(lane.x + lane.halfWidth + 1, start.z, 3)?.road.id).not.toBe('street');
  });

  it('gives the same tarmac as the three roads had when each was its own code', () => {
    const road = LAYOUT.road;
    const lane = LAYOUT.publicLane;
    const old = (x, z) => {
      const e = 0.15;
      const along = Math.max(road.fromX - x, 0, x - road.toX);
      const onRoad = 1 - smoothstep(road.halfWidth - e, road.halfWidth + e, Math.hypot(along, z - road.z));
      const onPad = 1 - smoothstep(road.pad.radius - e, road.pad.radius + e, Math.hypot(x - road.pad.x, z - road.z));
      const la = Math.max(lane.minZ - z, 0, z - lane.maxZ);
      return Math.max(onRoad, onPad, 1 - smoothstep(lane.halfWidth - e, lane.halfWidth + e, Math.hypot(la, x - lane.x)));
    };
    const r = rng(7);
    for (let i = 0; i < 4000; i++) {
      const x = 60 + r() * 160;
      const z = -30 + r() * 80;
      const lx = 200 + r() * 12;
      const lz = -210 + r() * 420;
      expect(net.tarmacAt(x, z)).toBeCloseTo(old(x, z), 9);
      expect(net.tarmacAt(lx, lz)).toBeGreaterThanOrEqual(old(lx, lz) - 1e-9);
    }
  });

  it('says which surface is under a point, and how much of it', () => {
    expect(net.surfaceAt(130, 2)).toMatchObject({ surface: 'tarmac', t: 1, road: 'farm' });
    expect(net.surfaceAt(130, 20)).toBeNull();
    expect(net.nearest(130, 4)).toMatchObject({ d: 2 });
    expect(net.nearest(130, 4).road.id).toBe('farm');
    expect(net.nearest(130, 4, 1)).toBeNull();
  });
});

describe('a stone road', () => {
  const stone = createRoads([{ id: 'drive', surface: 'stone', halfWidth: 1.5, points: [[0, 0], [30, 0]] }]);
  it('is stone, not tarmac', () => {
    expect(stone.surfaceAt(15, 0)).toMatchObject({ surface: 'stone', t: 1 });
    expect(stone.tarmacAt(15, 0)).toBe(0);
    expect(stone.stoneAt(15, 0)).toBe(1);
    expect(stone.stoneAt(15, 3)).toBe(0);
  });
  it('turns away a road with no such surface', () => {
    expect(() => createRoads([{ id: 'x', surface: 'gravel', halfWidth: 1, points: [[0, 0], [1, 0]] }])).toThrow(/surface/);
    expect(() => createRoads([{ id: 'x', surface: 'tarmac', halfWidth: 1, points: [[0, 0], [1, 0]], junction: { end: 'start', onto: 'nowhere' } }])).toThrow(/not a road/);
  });
});

describe('single-track roads', () => {
  const lane = createRoads([{ id: 'back', surface: 'tarmac', halfWidth: 1.4, points: [[0, 0], [100, 0], [200, 40], [300, 40], [400, 0]], passing: { spacing: 100, length: 8, bay: 1.8 } }]);
  it('has passing places on alternate sides, clear of the ends', () => {
    const places = lane.passingPlaces('back');
    expect(places.length).toBeGreaterThanOrEqual(3);
    expect(new Set(places.map((p) => p.side)).size).toBe(2);
    places.forEach((p, i) => {
      if (i) expect(p.side).toBe(-places[i - 1].side);
      expect(p.s).toBeGreaterThan(8);
      expect(p.s).toBeLessThan(lane.road('back').length - 8);
    });
  });
  it('is wider in a passing place, on its own side, and not beyond it', () => {
    const p = lane.passingPlaces('back')[0];
    const edge = (out) => ({ x: p.x + p.tz * p.side * out, z: p.z - p.tx * p.side * out });
    const inBay = edge(1.4 + 1.2);
    expect(lane.tarmacAt(inBay.x, inBay.z)).toBe(1);
    const past = edge(1.4 + 1.8 + 1);
    expect(lane.tarmacAt(past.x, past.z)).toBe(0);
    const other = { x: p.x - p.tz * p.side * 2.6, z: p.z + p.tx * p.side * 2.6 };
    expect(lane.tarmacAt(other.x, other.z)).toBe(0);
    const beyond = { x: p.x + p.tx * 8, z: p.z + p.tz * 8 };
    const wide = { x: beyond.x + p.tz * p.side * 2.6, z: beyond.z - p.tx * p.side * 2.6 };
    expect(lane.tarmacAt(wide.x, wide.z)).toBe(0);
  });
});

describe('points along a road', () => {
  it('runs from one end to the other, with the left of the way you travel kept to', () => {
    const pts = net.pointsAlong('lane', { step: 10, offset: 1 });
    expect(pts[0]).toMatchObject({ z: LAYOUT.publicLane.minZ, s: 0 });
    expect(pts[pts.length - 1].z).toBe(LAYOUT.publicLane.maxZ);
    expect(pts[0].x).toBeCloseTo(LAYOUT.publicLane.x + 1, 9); // heading south, the left is east
    const back = net.pointsAlong('lane', { step: 10, offset: 1, dir: -1 });
    expect(back[0].z).toBe(LAYOUT.publicLane.maxZ);
    expect(back[0].x).toBeCloseTo(LAYOUT.publicLane.x - 1, 9); // and heading north it is west
  });
  it('gives the lane a path to keep left on, a lead past each end', () => {
    const [from, to] = net.lanePath('lane', 1, 12);
    expect(from.z).toBe(LAYOUT.publicLane.minZ - 12);
    expect(to.z).toBe(LAYOUT.publicLane.maxZ + 12);
    expect(from.x).toBeCloseTo(LAYOUT.publicLane.x + LAYOUT.publicLane.halfWidth * KEEP_LEFT, 9);
    const [nFrom, nTo] = net.lanePath('lane', -1, 12);
    expect(nFrom.z).toBe(LAYOUT.publicLane.maxZ + 12);
    expect(nTo.z).toBe(LAYOUT.publicLane.minZ - 12);
    expect(nFrom.x).toBeLessThan(LAYOUT.publicLane.x);
  });
});

describe('levelling the ground across a road', () => {
  it('lays the farm road as it was: level across, with a 3 m shoulder and a flat hardstanding', () => {
    const road = LAYOUT.road;
    const old = (x, z, h) => {
      const along = Math.max(road.fromX - 2 - x, 0, x - road.toX);
      const dRoad = Math.hypot(along, z - road.z) - road.halfWidth;
      const dPad = Math.hypot(x - road.pad.x, z - road.z) - road.pad.radius;
      const k = 1 - smoothstep(0, 3, Math.min(dRoad, dPad));
      if (k <= 0) return h;
      const padK = 1 - smoothstep(-4, 2, dPad);
      const level = base(Math.min(x, road.toX), road.z) * (1 - padK) + base(road.pad.x, road.z) * padK;
      return h + (level - h) * k;
    };
    const r = rng(11);
    let touched = 0;
    for (let i = 0; i < 6000; i++) {
      const x = 70 + r() * 140;
      const z = road.z - 14 + r() * 28;
      const h = base(x, z) + 0.3;
      const laid = net.levelAt(x, z, base);
      const got = laid ? h + (laid.level - h) * laid.k : h;
      if (laid) touched++;
      expect(got).toBeCloseTo(old(x, z, h), 9);
    }
    expect(touched).toBeGreaterThan(500);
  });

  it('crowns a cambered road in the middle and eases it into the ground at the verge', () => {
    const flat = () => 5;
    const c = createRoads([{ id: 'r', surface: 'tarmac', halfWidth: 3, camber: 0.06, level: { shoulder: 2 }, points: [[0, 0], [100, 0]] }]);
    const at = (z) => { const l = c.levelAt(50, z, flat); return l ? 5 + (l.level - 5) * l.k : 5; };
    expect(at(0)).toBeCloseTo(5.06, 9);
    expect(at(3)).toBeCloseTo(5, 9);
    expect(at(1.5)).toBeCloseTo(5 + 0.06 * 0.75, 9);
    expect(at(2.99)).toBeLessThan(5.001);
    expect(at(8)).toBe(5);
  });

  it('has no step in height across a junction (under 2 cm), side road onto a sloping main road', () => {
    const ground = (x, z) => 0.05 * x + 0.08 * z + Math.sin(x * 0.2) * 0.5; // a bank rising and rolling
    const c = createRoads([
      { id: 'main', surface: 'tarmac', halfWidth: 3, level: { shoulder: 3 }, points: [[0, 0], [60, 4], [120, 0]] },
      { id: 'side', surface: 'tarmac', halfWidth: 2.2, level: { shoulder: 3, blend: 10 }, junction: { end: 'start', onto: 'main' }, points: [[60, 4], [62, 30], [75, 60]] },
    ]);
    const height = (x, z) => {
      const l = c.levelAt(x, z, ground);
      return l ? ground(x, z) + (l.level - ground(x, z)) * l.k : ground(x, z);
    };
    // Along the side road's middle from 30 m up it, across the main road, to 10 m beyond it, and along the junction's mouth sideways.
    const walk = (a, b) => {
      let worst = 0;
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.01);
      let prev = height(a[0], a[1]);
      for (let i = 1; i <= n; i++) {
        const h = height(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n);
        worst = Math.max(worst, Math.abs(h - prev));
        prev = h;
      }
      return worst;
    };
    expect(walk([62, 30], [60, -8])).toBeLessThan(0.02);
    expect(walk([40, 3.5], [80, 4.5])).toBeLessThan(0.02);
    expect(walk([62, 14], [62, 4])).toBeLessThan(0.02);
    // And the side road's level meets the main road's where they join.
    const side = c.levelAt(60.5, 5, ground).level;
    const main = c.levelAt(60.5, 3.5, ground).level;
    expect(Math.abs(side - main)).toBeLessThan(0.02);
  });

  it('flags a cutting deeper than MAX_CUT and leaves a declared one alone', () => {
    const bank = (x, z) => (z > 4 || z < -4 ? 3 : 0) + (x > 50 ? 0 : 0); // a bank 3 m up along the whole road, a 4 m wide level strip between
    const mk = (cuttings) => createRoads([{ id: 'r', surface: 'tarmac', halfWidth: 2, verge: 3, level: { shoulder: 1 }, cuttings, points: [[0, 0], [100, 0]] }]);
    const found = mk(undefined).cuttings(bank);
    expect(found.length).toBe(1);
    expect(found[0].depth).toBeGreaterThan(MAX_CUT);
    expect(found[0].flagged).toBe(false);
    expect(mk([{ from: 0, to: 100 }]).cuttings(bank)[0].flagged).toBe(true);
    const gentle = (x, z) => (Math.abs(z) > 4 ? 1 : 0);
    expect(mk(undefined).cuttings(gentle)).toEqual([]);
  });

  it('never cuts more than 1.5 m into a bank on today\'s roads without a flagged cutting', () => {
    const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
    const free = net.cuttings((x, z) => heights.heightAt(x, z));
    expect(free.filter((c) => !c.flagged)).toEqual([]);
  });
});

describe('saying which road you are on', () => {
  it('names the road, its surface and how far from its middle', () => {
    expect(describeRoad(net, 130, 2)).toBe('the farm road (tarmac, 100%), on the carriageway, 0.0 m from its middle (52 m along)');
    expect(describeRoad(net, 130, 5)).toMatch(/on the verge/);
    expect(describeRoad(net, 130, 40)).toBe('no road within 12 m');
    expect(describeRoad(net, LAYOUT.publicLane.x, 0)).toMatch(/^the lane \(tarmac/);
  });

  it('reads the quad you ride before your feet', () => {
    const game = { world: { roads: net }, player: { position: { x: 130, z: 40 } }, riddenUnit: null };
    expect(describeRoadUnder(game)).toBe('no road within 12 m');
    game.riddenUnit = { quad: { position: { x: 130, z: 2 } } };
    expect(describeRoadUnder(game)).toMatch(/^the farm road/);
  });
});

// The index (#664): a lookup looks only at the cells near the point, and must answer as a walk of every segment does.
describe('the index of a road', () => {
  const PLAIN = 1e6; // one cell for the whole map: every segment, every pad and every bay walked
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
  const longDef = { id: 'long', name: 'Long Road', surface: 'tarmac', halfWidth: 2.2, pavement: 0.4, points: winding(60, 7), camber: 0.1, markings: { centre: 'none' }, level: { shoulder: 3, lead: [2, 3], blend: 8, mouth: 4 }, passing: { spacing: 150, length: 8, bay: 2.5 } };
  const probe = createRoads([longDef]);
  const mid = probe.pointAt('long', 1500);
  const side = (id, onto, end, ox, oz) => ({ id, name: id, surface: 'stone', halfWidth: 1.6, points: [[mid.x + ox, mid.z + oz], [mid.x + ox * 5, mid.z + oz * 5 + 40], [mid.x + ox * 8, mid.z + oz * 8 + 70]], junction: { end, onto }, level: { shoulder: 2, blend: 8, mouth: 4 } });
  const defs = [
    { ...longDef, pads: [{ x: mid.x + 20, z: mid.z + 30, radius: 6 }, { x: probe.pointAt('long', 300).x, z: probe.pointAt('long', 300).z + 8, radius: 4 }] },
    side('lane2', 'long', 'start', 2, 0),
  ];
  const fast = createRoads(defs);
  const plain = createRoads(defs, { cell: PLAIN });
  const ground = (x, z) => base(x, z);
  const pick = (a) => (a ? { ...a, road: a.road?.id ?? a.road } : a);
  const same = (nets, x, z) => {
    const [f, p] = nets;
    expect(f.tarmacAt(x, z)).toBe(p.tarmacAt(x, z));
    expect(f.stoneAt(x, z)).toBe(p.stoneAt(x, z));
    expect(f.surfaceAt(x, z)).toEqual(p.surfaceAt(x, z));
    expect(pick(f.nearest(x, z))).toEqual(pick(p.nearest(x, z)));
    expect(pick(f.nearest(x, z, 12))).toEqual(pick(p.nearest(x, z, 12)));
    expect(f.onCarriageway(x, z)?.id).toBe(p.onCarriageway(x, z)?.id);
    for (const id of ['long', 'lane2']) expect(f.onRoad(id, x, z)).toBe(p.onRoad(id, x, z));
    expect(f.levelAt(x, z, ground)).toEqual(p.levelAt(x, z, ground));
  };

  it('answers as a walk of every segment does, at 20,000 points over a winding 3 km road with passing places and a junction', () => {
    expect(fast.road('long').length).toBeGreaterThan(2500);
    expect(fast.passingPlaces('long').length).toBeGreaterThan(8);
    const b = fast.road('long').bounds;
    const r = rng(11);
    for (let i = 0; i < 20000; i++) {
      // Most points near the road's middle, so the cases that matter (edges, bays, pads) come up; the rest anywhere in the box.
      if (i % 2) same([fast, plain], b.minX - 60 + r() * (b.maxX - b.minX + 120), b.minZ - 60 + r() * (b.maxZ - b.minZ + 120));
      else {
        const p = fast.pointAt('long', r() * fast.road('long').length);
        const off = (r() - 0.5) * 16;
        same([fast, plain], p.x + p.tz * off, p.z - p.tx * off);
      }
    }
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

  it('answers the same on today\'s three roads', () => {
    const [f, p] = [createRoads(LAYOUT.roads), createRoads(LAYOUT.roads, { cell: PLAIN })];
    const r = rng(5);
    for (let i = 0; i < 20000; i++) same([f, p], -80 + r() * 200, -60 + r() * 520 - 200);
    for (const road of f.roads) for (let s = -10; s < road.length + 10; s += 3) {
      const q = f.pointAt(road.id, Math.max(0, Math.min(road.length, s)));
      for (const off of [-8, -3, 0, 2, 7]) same([f, p], q.x + q.tz * off - q.tx * Math.min(0, s), q.z - q.tx * off - q.tz * Math.min(0, s));
    }
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
