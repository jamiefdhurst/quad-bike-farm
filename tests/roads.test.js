import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createRoads, roadNetwork, describeRoad, describeRoadUnder, MAX_CUT, KEEP_LEFT } from '../src/world/roads.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { visitPlaces, laneX } from '../src/world/traffic.js';

const net = roadNetwork(LAYOUT);
const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};


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

describe('the farm\'s roads (#1118)', () => {
  it('is hard along the middle of every road and not 1 m past its edge, except at a passing place, a pad or a bellmouth', () => {
    let checked = 0;
    let bays = 0;
    for (const r of net.roads) {
      const solo = createRoads([{ ...r, junction: undefined }]); // the road alone, so a road it crosses or joins is not counted as its own
      for (let s = 3; s < r.length - 3; s += 5) {
        const p = net.pointAt(r.id, s);
        expect(solo.surfaceAt(p.x, p.z), `${r.id} at ${s}`).toMatchObject({ surface: r.surface, t: 1 });
        for (const side of [-1, 1]) {
          const x = p.x + p.tz * side * (r.hard + 1);
          const z = p.z - p.tx * side * (r.hard + 1);
          if (r.pads.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius + 2)) continue; // the hardstanding is wider than the road
          if ((r.fillets ?? []).some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 2)) continue; // a bellmouth's rounded corner, where it joins another road
          if (r.bays.some((b) => b.side === side && Math.abs(b.s - s) < b.length / 2 + 3)) { bays++; continue; } // a passing place, on its own side only
          expect(solo.surfaceAt(x, z)?.t ?? 0, `${r.id} at ${s}, side ${side}`).toBe(0);
          checked++;
        }
      }
    }
    expect(net.roads.length).toBeGreaterThanOrEqual(10);
    expect(bays).toBeGreaterThan(0); // Back Lane's passing places are skipped, and only they
    expect(checked).toBeGreaterThan(3000);
  });
});

describe('a lane to keep left on (#1118)', () => {
  const places = visitPlaces(LAYOUT);
  const lane = net.road('lane');
  const ends = [net.pointAt('lane', 0), net.pointAt('lane', lane.length)];
  // Which side of the way it is travelling a point is: negative on the left, as laneX keeps to.
  const across = (end, dir, q) => (end.tx * dir * (q.z - end.z) - end.tz * dir * (q.x - end.x));
  const along = (end, dir, q) => end.tx * dir * (q.x - end.x) + end.tz * dir * (q.z - end.z);

  it('runs from a lead before the start of the way to a lead past its end, on the left of the way travelled', () => {
    for (const dir of [1, -1]) {
      const [from, to] = net.lanePath('lane', dir, [12, 30]);
      const [start, end] = dir > 0 ? ends : [...ends].reverse();
      expect(along(start, dir, from)).toBeCloseTo(-12, 6);
      expect(along(end, dir, to)).toBeCloseTo(30, 6);
      for (const [p, q] of [[start, from], [end, to]]) expect(across(p, dir, q)).toBeCloseTo(-lane.halfWidth * KEEP_LEFT, 6);
    }
  });

  it('keeps to the same side of the straight lane past the drive as a visitor does', () => {
    expect(net.lanePath('lane', 1, 12)[1].x).toBeCloseTo(laneX(places.lane, 1), 9);
    expect(net.lanePath('lane', -1, 12)[0].x).toBeCloseTo(laneX(places.lane, -1), 9);
    expect(laneX(places.lane, 1)).not.toBeCloseTo(laneX(places.lane, -1), 1);
  });
});


describe('levelling the ground across a road', () => {

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

// The index of a road (#664), checked against a walk of every segment, is in roadsIndex.test.js and roadsIndexMore.test.js (#1183).
