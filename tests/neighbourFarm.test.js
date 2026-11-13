import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createRandom } from '../src/core/random.js';
import { neighbourFarmShape, laneBarriers, createNeighbourFarm, Neighbour, DEFAULT_NEIGHBOUR_PARAMS, NEIGHBOUR_PARAM_RANGES, PARKED_SIZES } from '../src/world/neighbourFarm.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { createOutbuildings } from '../src/world/outbuildings.js';
import { NEIGHBOUR_VOICE, AMY_NEIGHBOUR_LINES, JESS_NEIGHBOUR_LINES } from '../src/npc/neighbourLines.js';
import { VISITOR_KINDS } from '../src/world/traffic.js';

const S = neighbourFarmShape(LAYOUT);
const lane = LAYOUT.publicLane;
const inBox = (b, x, z) => Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz;
const inRect = (r, x, z) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
const overlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

describe('the neighbour\'s yard', () => {
  it('has a shape, and every building, vehicle and wall is inside its outline', () => {
    expect(S).toBeTruthy();
    for (const r of [S.house.outer, S.house.roof, S.barn.outer, S.barn.roof, ...S.parked.map((p) => p.outer)]) {
      expect(r.minX).toBeGreaterThan(S.outline.minX);
      expect(r.maxX).toBeLessThan(S.outline.maxX);
      expect(r.minZ).toBeGreaterThan(S.outline.minZ);
      expect(r.maxZ).toBeLessThan(S.outline.maxZ);
    }
  });

  it('keeps the buildings and the parked vehicles apart, and clear of the lane and the farm', () => {
    const things = [S.house.roof, S.barn.roof, ...S.parked.map((p) => p.outer)];
    for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) expect(overlap(things[i], things[j]), `${i} and ${j}`).toBe(false);
    // The wall stays west of the lane's tarmac, and south of the farm's own hedge.
    expect(S.outline.maxX).toBeLessThan(lane.x - lane.halfWidth);
    expect(S.outline.minZ).toBeGreaterThan(LAYOUT.farm.maxZ + 5);
  });

  it('leaves the gateway open in the east wall, wide enough for the tractor, and a clear way from it to the barn door and the house', () => {
    const gw = S.gateway;
    expect(gw.maxZ - gw.minZ).toBeGreaterThanOrEqual(5);
    for (let z = gw.minZ + 0.1; z < gw.maxZ; z += 0.5) expect(S.walls.some((w) => inBox(w, gw.x, z))).toBe(false);
    expect(S.walls.some((w) => inBox(w, gw.x, gw.minZ - 0.5))).toBe(true);
    expect(S.walls.some((w) => inBox(w, gw.x, gw.maxZ + 0.5))).toBe(true);
    // The barn's door faces the yard (east), and sits within the barn's side.
    expect(S.barn.door.z - S.barn.door.halfWidth).toBeGreaterThan(S.barn.outer.minZ);
    expect(S.barn.door.z + S.barn.door.halfWidth).toBeLessThan(S.barn.outer.maxZ);
    // The house door is in its north wall, facing the yard, and she stands in front of it, not in anything.
    expect(S.house.door.x).toBeGreaterThan(S.house.outer.minX);
    expect(S.house.door.x).toBeLessThan(S.house.outer.maxX);
    expect(S.stand.z).toBeLessThan(S.house.outer.minZ);
    for (const r of [S.house.roof, S.barn.roof, ...S.parked.map((p) => p.outer)]) expect(inRect({ minX: r.minX - 0.8, maxX: r.maxX + 0.8, minZ: r.minZ - 0.8, maxZ: r.maxZ + 0.8 }, S.stand.x, S.stand.z)).toBe(false);
  });

  it('parks a vehicle of each kind the game has a size for', () => {
    for (const p of S.parked) expect(PARKED_SIZES[p.kind], p.kind).toBeTruthy();
  });

  it('is counted as built by the world\'s outbuildings, and shelters under its roofs', () => {
    const ob = createOutbuildings(LAYOUT);
    expect(ob.builtAt(S.house.x, S.house.z)).toBe(true);
    expect(ob.builtAt(S.barn.x, S.barn.z)).toBe(true);
    expect(ob.builtAt(S.parked[0].x, S.parked[0].z)).toBe(true);
    expect(ob.covered(S.house.x, S.house.z)).toBe(true);
    expect(ob.covered(S.stand.x, S.stand.z)).toBe(false);
    expect(ob.builtAt(100, 50)).toBe(false); // the farm's wheat field
  });

  it('levels the ground inside the wall to one height and eases out beyond it', () => {
    const nf = createNeighbourFarm(LAYOUT);
    const ground = () => 3;
    const mid = nf.floorAt(170, 120, ground);
    expect(mid.k).toBe(1);
    expect(mid.level).toBe(3);
    expect(nf.floorAt(S.outline.minX - 2, 120, ground).k).toBeGreaterThan(0);
    expect(nf.floorAt(S.outline.minX - 2, 120, ground).k).toBeLessThan(1);
    expect(nf.floorAt(S.outline.minX - 6, 120, ground)).toBeNull();
  });

  it('leaves the lane\'s own ground alone along the wall, so the tarmac has no camber from the yard, but ramps up to it at the gateway', () => {
    const nf = createNeighbourFarm(LAYOUT);
    const ground = () => 3;
    const laneEdge = lane.x - lane.halfWidth;
    expect(laneEdge).toBeGreaterThan(S.outline.maxX + 1);
    for (const z of [125, 135, 145]) expect(nf.floorAt(laneEdge, z, ground), `z ${z}`).toBeNull();
    expect(nf.floorAt(laneEdge, S.gateway.z, ground).k).toBeGreaterThan(0);
  });

  it('really leaves the terrain under the lane as it was along the wall (the yard does not pull the tarmac sideways)', () => {
    const track = new Track(LAYOUT.trackPoints);
    const withYard = createTerrainHeight(LAYOUT, track).heightAt;
    const without = createTerrainHeight({ ...LAYOUT, neighbourFarm: undefined }, track).heightAt;
    for (const z of [125, 130, 135, 140, 145]) for (const x of [lane.x - lane.halfWidth, lane.x, lane.x + lane.halfWidth]) expect(withYard(x, z)).toBeCloseTo(without(x, z), 6);
  });
});

describe('the lane you can ride', () => {
  const barriers = laneBarriers(LAYOUT);
  // The barn is a hollow shed: its walls (0.16 thick) are solid, but not its doorway or its inside.
  const barnWall = (x, z) => {
    const o = S.barn.outer;
    const inner = { minX: o.minX + 0.16, maxX: o.maxX - 0.16, minZ: o.minZ + 0.16, maxZ: o.maxZ - 0.16 };
    const doorway = x > o.maxX - 0.4 && Math.abs(z - S.barn.door.z) < S.barn.door.halfWidth;
    return inRect(o, x, z) && !inRect(inner, x, z) && !doorway;
  };
  const blocked = (x, z) => barriers.some((b) => inBox(b, x, z)) || S.walls.some((w) => inBox(w, x, z)) || inRect(S.house.outer, x, z) || barnWall(x, z) || S.parked.some((p) => inRect(p.outer, x, z));
  const westX = lane.x - lane.halfWidth - 1.2;

  it('shuts the lane\'s near edge outside the open stretch and along it, except at the big gate and the neighbour\'s wall', () => {
    expect(blocked(westX, -150)).toBe(true);
    expect(blocked(westX, 190)).toBe(true);
    expect(blocked(westX, -30)).toBe(true);
    expect(blocked(westX, 60)).toBe(true);
    expect(blocked(westX, LAYOUT.road.z)).toBe(false); // the big gate
    expect(barriers.some((b) => inBox(b, westX, 120))).toBe(false); // the neighbour's own wall shuts it there
    expect(blocked(S.yard.maxX - S.yard.wall / 2, 120)).toBe(true);
  });

  it('shuts the far side and both ends of the open stretch', () => {
    const open = lane.open;
    expect(blocked(lane.x + lane.halfWidth + 1.2, 50)).toBe(true);
    expect(blocked(lane.x, open.minZ)).toBe(true);
    expect(blocked(lane.x, open.maxZ)).toBe(true);
    expect(blocked(lane.x, 50)).toBe(false);
  });

  it('lets you ride from the big gate along the lane into the yard and up to the barn door and the house, but no further along the lane', () => {
    const cell = 0.5;
    const key = (x, z) => `${Math.round(x / cell)},${Math.round(z / cell)}`;
    const seen = new Set([key(lane.x, LAYOUT.road.z)]);
    const todo = [[lane.x, LAYOUT.road.z]];
    while (todo.length) {
      const [x, z] = todo.pop();
      for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 150 || nx > 215 || nz < -80 || nz > 215) continue; // the part of the world that matters
        if (blocked(nx, nz) || seen.has(key(nx, nz))) continue;
        seen.add(key(nx, nz));
        todo.push([nx, nz]);
      }
    }
    const reach = (x, z) => seen.has(key(x, z));
    expect(reach(S.gateway.x - 3, S.gateway.z)).toBe(true);
    expect(reach(S.barn.outer.maxX + 2, S.barn.door.z)).toBe(true);
    expect(reach(S.barn.x, S.barn.z)).toBe(true); // through the big door, inside
    expect(reach(S.stand.x, S.stand.z)).toBe(true);
    expect(reach(lane.x, lane.open.maxZ - 2)).toBe(true);
    expect(reach(lane.x, lane.open.maxZ + 2)).toBe(false);
    expect(reach(lane.x, lane.open.minZ - 2)).toBe(false);
  });
});

describe('the neighbour herself', () => {
  const make = () => new Neighbour(S, { ...DEFAULT_NEIGHBOUR_PARAMS }, createRandom(5));
  const you = (d, onFoot = false) => ({ kind: 'you', x: S.stand.x + d, z: S.stand.z, onFoot });
  const run = (n, seconds, ctx, dt = 0.25) => {
    const out = [];
    for (let t = 0; t < seconds; t += dt) out.push(...n.update(dt, ctx));
    return out;
  };

  it('stands about and says nothing when no one is near', () => {
    const n = make();
    expect(run(n, 60, { targets: [you(200)] })).toEqual([]);
    expect(n.watching).toBeNull();
  });

  it('greets you once as you come in range, turns to face you, and does not repeat herself at once', () => {
    const n = make();
    const ev = run(n, 10, { targets: [you(10)] });
    expect(ev.filter((e) => e.type === 'greet')).toHaveLength(1);
    expect(ev[0].key).toBe('greet');
    expect(Math.sin(n.yaw)).toBeGreaterThan(0.9); // facing +x, where you are
    expect(run(n, 100, { targets: [you(10)] }).filter((e) => e.type === 'greet')).toHaveLength(0);
  });

  it('greets again after a while, in a different way, and in the wet', () => {
    const n = make();
    run(n, 5, { targets: [you(10)] });
    const later = run(n, DEFAULT_NEIGHBOUR_PARAMS.greetEvery + 5, { targets: [you(10)] }).filter((e) => e.type === 'greet');
    expect(later[0].key).toBe('greetAgain');
    const w = make();
    expect(run(w, 5, { targets: [you(10)], rain: 0.8 }).find((e) => e.type === 'greet').key).toBe('greetWet');
  });

  it('greets a girl who comes first, and makes conversation only with you on foot', () => {
    const n = make();
    const girl = { kind: 'girl', x: S.stand.x + 8, z: S.stand.z, onFoot: true };
    expect(run(n, 5, { targets: [girl] }).filter((e) => e.type === 'greet')[0].who).toBe('girl');
    const talk = make();
    const ev = run(talk, 150, { targets: [you(3, true)] });
    expect(ev.filter((e) => e.type === 'chat').length).toBeGreaterThanOrEqual(2);
    const riding = make();
    expect(run(riding, 150, { targets: [you(3, false)] }).filter((e) => e.type === 'chat')).toHaveLength(0);
  });

  it('says goodbye when you ride off after a good while near, but not after a flying visit', () => {
    const n = make();
    run(n, 20, { targets: [you(6)] });
    expect(run(n, 5, { targets: [you(60)] }).filter((e) => e.type === 'farewell')).toHaveLength(1);
    const quick = make();
    run(quick, 3, { targets: [you(10)] });
    expect(run(quick, 5, { targets: [you(60)] }).filter((e) => e.type === 'farewell')).toHaveLength(0);
  });

  it('goes indoors when it is dark, says nothing there, and comes out again in the morning', () => {
    const n = make();
    expect(run(n, 1, { targets: [you(5)], darkness: 0.9 }).map((e) => e.type)).toEqual(['indoors']);
    expect(n.indoors).toBe(true);
    expect(run(n, 30, { targets: [you(5, true)], darkness: 0.9 })).toEqual([]);
    expect(run(n, 1, { targets: [], darkness: 0.1 }).map((e) => e.type)).toContain('outdoors');
    expect(n.indoors).toBe(false);
  });

  it('turns back to where she stood when you go', () => {
    const n = make();
    run(n, 6, { targets: [you(8)] });
    run(n, 10, { targets: [you(200)] });
    expect(Math.cos(n.yaw)).toBeLessThan(-0.99); // yaw PI, facing north
  });

  it('can be made to greet at once', () => {
    const n = make();
    run(n, 5, { targets: [you(10)] });
    n.greetNow();
    expect(run(n, 1, { targets: [you(10)] }).filter((e) => e.type === 'greet')).toHaveLength(1);
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(NEIGHBOUR_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_NEIGHBOUR_PARAMS).sort());
    for (const [k, [lo, hi]] of Object.entries(NEIGHBOUR_PARAM_RANGES)) {
      expect(DEFAULT_NEIGHBOUR_PARAMS[k]).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_NEIGHBOUR_PARAMS[k]).toBeLessThanOrEqual(hi);
    }
  });
});

describe('what is said', () => {
  const texts = [
    ...Object.values(NEIGHBOUR_VOICE.lines).flatMap((l) => l.lines),
    ...Object.values(AMY_NEIGHBOUR_LINES).flatMap((l) => l.lines),
    ...Object.values(JESS_NEIGHBOUR_LINES).flat(),
  ];

  it('has several lines of every kind she says, all different', () => {
    for (const [k, l] of Object.entries(NEIGHBOUR_VOICE.lines)) {
      expect(l.lines.length, k).toBeGreaterThanOrEqual(3);
      expect(new Set(l.lines).size).toBe(l.lines.length);
    }
    for (const k of ['greet', 'greetAgain', 'greetWet', 'chat', 'farewell']) expect(NEIGHBOUR_VOICE.lines[k]).toBeTruthy();
  });

  it('has no em dashes in what anyone says', () => {
    for (const t of texts) expect(t).not.toMatch(/—|–/);
  });

  it('gives Amy and Jess the same kinds of line about her farm', () => {
    expect(Object.keys(JESS_NEIGHBOUR_LINES).sort()).toEqual(Object.keys(AMY_NEIGHBOUR_LINES).sort());
  });

  it('has her own voice bank, not either girl\'s', () => {
    expect(NEIGHBOUR_VOICE.voiceBank).toBe('companion-voice-neighbour');
  });

  it('matches the paint of a visitor kind that exists (she drives the same Land Rover)', () => {
    expect(VISITOR_KINDS.neighbour.model).toBe('tor');
    expect(S.parked.some((p) => p.kind === 'tor')).toBe(true);
  });
});
