import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan } from '../src/world/layoutNew.js';
import { roadNetwork } from '../src/world/roads.js';
import { GIVE_WAY_AT } from '../src/world/layoutNew.js';
import { turnRoundLines, crossed, putBack, TurnRound, DEFAULT_TURN_ROUND_PARAMS as P, headingOf } from '../src/world/turnRound.js';

const two = layoutNew(LAYOUT, RAW_LAYOUT);
const net = roadNetwork(two);
const lines = turnRoundLines(net, two.turnRound, two.ground);
const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
const lane = net.road('lane');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

describe('the lines you are turned round at (#687)', () => {
  it('has one at each junction\'s give-way line, one across the lane at plan z 955 and one at the moor\'s stile (#713)', () => {
    expect(lines.map((l) => l.id)).toEqual(['lane-north', 'village', 'lane-south', 'moor-stile']);
    expect(byId['lane-north'].point.x).toBeGreaterThan(fromPlan([1280, 0])[0]); // 3 m in from the A-road
    expect(dist(byId['lane-north'].point, lane.samples[0])).toBeCloseTo(GIVE_WAY_AT, 0);
    expect(net.onRoad('aRoad', byId['lane-north'].point.x, byId['lane-north'].point.z)).toBe(false); // short of the A-road's tarmac (#1022)
    expect(net.onRoad('aRoad', byId.village.point.x, byId.village.point.z)).toBe(false);
    expect(byId['lane-south'].point.z).toBeCloseTo(fromPlan([0, 955])[1], 1);
    expect(byId['lane-south'].wide).toBe(true);
    expect(byId['lane-south'].a.x).toBeLessThan(two.ground.minX); // all the way across the ground, so there is no way round it
    expect(byId['lane-south'].b.x).toBeGreaterThan(two.ground.maxX);
  });

  it('says whether a step crosses one', () => {
    const l = byId['lane-north'];
    const across = (d) => ({ x: l.point.x + d, z: l.point.z });
    expect(crossed(l, across(-2), across(2))).toBe(true);
    expect(crossed(l, across(2), across(-2))).toBe(true); // either way round
    expect(crossed(l, across(-5), across(-1))).toBe(false);
    expect(crossed(l, { x: l.point.x - 2, z: l.point.z - 30 }, { x: l.point.x + 2, z: l.point.z - 30 })).toBe(false); // well to the side of the lane: not this line
  });
});

describe('where you are put back, and which way you face', () => {
  const heading = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

  it('puts you 25 m back up the lane from the A-road, on the lane, keeping left, facing home (away from the junction)', () => {
    const l = byId['lane-north'];
    const from = { x: l.point.x - 0.4, z: l.point.z };
    const to = { x: l.point.x + 0.6, z: l.point.z };
    const at = putBack(net, l, from, to);
    expect(at.along).toBe(true);
    expect(net.onRoad('lane', at.x, at.z)).toBe(true);
    const sNow = lane.samples.reduce((best, p) => (dist(p, at) < dist(best, at) ? p : best)).s;
    expect(sNow).toBeGreaterThan(l.s + 25 - 1.5);
    expect(sNow).toBeLessThan(l.s + 25 + 1.5);
    const h = heading(at.yaw);
    const tangent = net.pointAt('lane', sNow);
    expect(h.x * tangent.tx + h.z * tangent.tz).toBeGreaterThan(0.99); // along the lane, away from its end on the A-road
    // keeping left: to the left of the way it is facing
    const centre = { x: tangent.x, z: tangent.z };
    expect((at.x - centre.x) * h.z - (at.z - centre.z) * h.x).toBeGreaterThan(0); // (hz, -hx) is the left of a heading on this map (x east, z south)
  });

  it('puts you 25 m back up the lane from its southern line, facing north', () => {
    const l = byId['lane-south'];
    const at = putBack(net, l, { x: l.point.x, z: l.point.z - 1 }, { x: l.point.x, z: l.point.z + 1 });
    expect(at.z).toBeCloseTo(l.point.z - 25, 0);
    expect(heading(at.yaw).z).toBeLessThan(-0.99);
  });

  it('puts you 25 m back up the village street\'s stub, facing west', () => {
    const l = byId.village;
    const at = putBack(net, l, { x: l.point.x - 1, z: l.point.z }, { x: l.point.x + 1, z: l.point.z });
    expect(at.x).toBeCloseTo(l.point.x - 25, 0);
    expect(heading(at.yaw).x).toBeLessThan(-0.99);
  });

  it('from open ground across the wide southern line, 25 m back the way you were going, facing the way you came', () => {
    const l = byId['lane-south'];
    const x = two.ground.minX + 60;
    const at = putBack(net, l, { x, z: l.point.z - 2 }, { x, z: l.point.z + 1 });
    expect(at.along).toBe(false);
    expect(at.z).toBeLessThan(l.point.z - 20);
    expect(heading(at.yaw).z).toBeLessThan(-0.9);
    expect(headingOf(0, -1)).toBeCloseTo(Math.PI, 5);
  });
});

describe('the fade and the move', () => {
  const run = (path, dt = 0.05, seconds = 4) => {
    const t = new TurnRound({ net, lines });
    const log = [];
    let i = 0;
    let moved = null; // once you are put somewhere you stay there, as a stood player would
    for (let time = 0; time < seconds; time += dt) {
      const pos = moved ?? path(i++);
      const r = t.update(dt, pos);
      if (r.move) moved = { x: r.move.x, z: r.move.z };
      log.push({ time, ...r });
    }
    return { t, log };
  };

  it('fades to black over 0.6 s, moves you once while black, and fades back in over 0.6 s', () => {
    const l = byId['lane-north'];
    // Walk 1.4 m a second across the line, then stand where you are.
    const path = (i) => ({ x: l.point.x - 1.5 + Math.min(i * 0.07, 3), z: l.point.z });
    const { t, log } = run(path, 0.05, 3);
    const moves = log.filter((e) => e.move);
    expect(moves).toHaveLength(1);
    const start = log.findIndex((e) => e.started);
    expect(start).toBeGreaterThan(0);
    const fadeOut = log.filter((e, i) => i > start && e.fade > 0 && e.fade < 1 && log[i - 1].fade <= e.fade);
    expect(fadeOut.length).toBeGreaterThan(8); // about 0.6 s of 0.05 s frames
    expect(Math.max(...log.map((e) => e.fade))).toBe(1);
    const black = log.findIndex((e) => e.move);
    expect(log[black].time - log[start].time).toBeGreaterThanOrEqual(P.fadeOut - 0.01);
    expect(log[black].time - log[start].time).toBeLessThan(P.fadeOut + 0.1);
    expect(log.at(-1).fade).toBe(0);
    expect(log.some((e) => e.done)).toBe(true);
    expect(t.busy).toBe(false);
    expect(log.filter((e) => e.started)).toHaveLength(1); // once: not again as you stand where you were put
  });

  it('is not caught out by the console\'s tp (a long jump is not a crossing), and does nothing away from the lines', () => {
    const l = byId['lane-north'];
    const hops = [{ x: l.point.x - 200, z: l.point.z }, { x: l.point.x + 200, z: l.point.z }, { x: l.point.x + 200, z: l.point.z }];
    const { log } = run((i) => hops[Math.min(i, 2)], 0.05, 0.2);
    expect(log.some((e) => e.started)).toBe(false);
    const farm = run(() => ({ x: two.road.fromX + 20, z: two.road.z }), 0.05, 1);
    expect(farm.log.some((e) => e.started)).toBe(false);
  });

  it('turns you round from open ground onto the A-road itself, by no line, 25 m back', () => {
    const a = net.road('aRoad');
    const p = a.samples[Math.floor(a.samples.length / 2)];
    const path = (i) => ({ x: p.x - 8 + Math.min(i * 0.5, 10), z: p.z });
    const { log } = run(path, 0.05, 3);
    const m = log.find((e) => e.move);
    expect(m).toBeTruthy();
    expect(m.line.id).toBe('road');
    expect(m.move.x).toBeLessThan(p.x - 15);
  });

  it('fires a junction\'s own line, not the A-road catch, coming diagonally across the bellmouth or down the stub (#1022)', () => {
    for (const id of ['lane-north', 'village']) {
      const l = byId[id];
      const road = net.road(l.road);
      const p = net.pointAt(l.road, l.sign > 0 ? l.s + 6.13 : l.s - 6.13); // 6 m short of the line, on the farm side
      const q = net.pointAt(l.road, l.sign > 0 ? l.s - 2.07 : l.s + 2.07); // 2 m past it, towards the A-road
      const side = (road.halfWidth - 0.3) * l.sign; // coming in off to one side of the road, diagonally
      const path = (i) => ({ x: p.x + (q.x - p.x) * Math.min(i / 40, 1) + p.tz * side * Math.min(i / 40, 1), z: p.z + (q.z - p.z) * Math.min(i / 40, 1) - p.tx * side * Math.min(i / 40, 1) });
      const { log } = run(path, 0.02, 1.5);
      const first = log.find((e) => e.started);
      expect(first?.line.id, id).toBe(id);
      const m = log.find((e) => e.move).move;
      expect(m.along, id).toBe(true);
      expect(net.onRoad(l.road, m.x, m.z), id).toBe(true); // on the road it came along, not out on the verge
    }
  });

  it('puts you back up a junction\'s road, on the farm side, from the A-road reached from open ground (the bus stop)', () => {
    const a = net.road('aRoad');
    const east = a.samples.find((q) => q.z > two.ground.minZ + 700);
    const path = (i) => ({ x: east.x + 8 - Math.min(i * 0.4, 12), z: east.z }); // from the east verge, west onto the tarmac
    const { log } = run(path, 0.05, 3);
    const m = log.find((e) => e.move);
    expect(m.line.id).toBe('road');
    expect(m.move.along).toBe(true);
    expect(m.move.x).toBeLessThan(east.x - 3); // on the farm side of the A-road, not thrown on across it
    expect(['lane', 'streetEnd'].some((id) => net.onRoad(id, m.move.x, m.move.z))).toBe(true);
  });

  it('turns you round on the A-road\'s verge too, from the bellmouth walking north, and not on the lane\'s own verge (#1025)', () => {
    const a = net.road('aRoad');
    const mouth = lane.samples[0];
    const west = mouth.x - a.halfWidth - 1; // on the A-road's west verge, 1 m off its tarmac
    const walk = (i) => ({ x: west, z: mouth.z - Math.min(i * 0.3, 20) });
    const { log } = run(walk, 0.05, 3);
    const hit = log.find((e) => e.started);
    expect(net.onRoad('aRoad', west, mouth.z - 5)).toBe(false); // it is not on the tarmac
    expect(hit?.line.id).toBe('road');
    // The lane's own verge, well along it, is nobody's catch.
    const along = net.pointAt('lane', 60);
    const idle = run(() => ({ x: along.x, z: along.z + 4 }), 0.05, 1);
    expect(idle.log.some((e) => e.started)).toBe(false);
  });
});
