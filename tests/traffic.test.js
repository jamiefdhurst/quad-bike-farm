import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createRandom } from '../src/core/random.js';
import { Drive, Traffic, Visit, DEFAULT_TRAFFIC_PARAMS, TRAFFIC_PARAM_RANGES, visitPlaces, planVisit, laneX, LANE_KINDS } from '../src/world/traffic.js';
import { createFields } from '../src/world/fields.js';

const places = visitPlaces(LAYOUT);
const P = { ...DEFAULT_TRAFFIC_PARAMS };

/** A stand-in gate the visit can open and shut. */
const fakeGate = (open = false, allow = true) => ({
  isOpen: open,
  set(v) {
    if (!v && !allow) return false;
    this.isOpen = v;
    return true;
  },
});

function runVisit(visit, gate, { blockers = [], limit = 1200, gates } = {}) {
  const events = [];
  let t = 0;
  while (!visit.done && t < limit) {
    events.push(...visit.update(0.1, { gate, gates, blockers, swingSeconds: 1.8 }));
    t += 0.1;
  }
  return { events, t };
}

describe('Drive', () => {
  it('follows waypoints and stops at a stop', () => {
    const d = new Drive({ x: 0, z: 0, yaw: 0, speed: 8, cruise: 8 });
    d.go([{ x: 0, z: 40 }, { x: 0, z: 60, stop: true }]);
    for (let i = 0; i < 400 && !d.arrived; i++) d.update(0.05);
    expect(d.arrived).toBe(true);
    expect(d.speed).toBe(0);
    expect(Math.abs(d.z - 60)).toBeLessThan(1.5);
  });

  it('brakes for something in the way and goes on when it has gone', () => {
    const d = new Drive({ x: 0, z: 0, yaw: 0, speed: 8, cruise: 8 });
    d.go([{ x: 0, z: 200 }]);
    const block = [{ x: 0, z: 14 }];
    for (let i = 0; i < 400; i++) d.update(0.05, block);
    expect(d.speed).toBe(0);
    expect(d.z).toBeLessThan(14);
    expect(d.waited).toBeGreaterThan(3);
    for (let i = 0; i < 60; i++) d.update(0.05, []);
    expect(d.speed).toBeGreaterThan(2);
  });

  it('ignores something beside it or behind it', () => {
    const d = new Drive({ x: 0, z: 0, yaw: 0, speed: 8 });
    expect(d.inTheWay([{ x: 3, z: 6 }, { x: 0, z: -6 }])).toBe(false);
    expect(d.inTheWay([{ x: 0.5, z: 6 }])).toBe(true);
  });
});

describe('the lane and the plan', () => {
  it('has the lane outside the farm and on the terrain', () => {
    const lane = LAYOUT.publicLane;
    expect(lane.x - lane.halfWidth).toBeGreaterThan(LAYOUT.farm.maxX + 1);
    expect(lane.x + lane.halfWidth).toBeLessThan(LAYOUT.terrainSize / 2);
  });

  it('drives on the left', () => {
    const lane = LAYOUT.publicLane;
    expect(laneX(lane, 1)).toBeGreaterThan(lane.x); // heading south, the left is east
    expect(laneX(lane, -1)).toBeLessThan(lane.x);
  });

  it('keeps every waypoint of a visit inside the farm or on the lane, clear of the hedges', () => {
    const F = LAYOUT.fieldHalf;
    for (const from of [1, -1]) {
      for (const to of [1, -1]) {
        for (const leaveOpen of [true, false]) {
          for (const s of planVisit({ places, from, to, does: 'parcel', leaveOpen, farmSpeed: 7 })) {
            for (const p of s.path ?? []) {
              if (p.x > LAYOUT.farm.maxX + 1) continue; // out on the lane
              if (p.x > F) continue; // along the farm road, between its hedges
              expect(p.z).toBeLessThan(F - 1.5);
              expect(p.z).toBeGreaterThan(-F);
            }
          }
        }
      }
    }
  });

  it('stops and turns east of the barn, clear of the silage bales and the bell, with its door on the yard side', () => {
    const b = LAYOUT.barn;
    expect(places.door.x).toBeGreaterThan(b.x + b.halfX);
    expect(places.stop.x - places.turn.dx - places.turn.r).toBeGreaterThan(b.x + 2.3 + 2); // the silage stack runs to about x = barn.x + 2.3
    expect(places.turn.z1).toBeLessThan(LAYOUT.fieldHalf - 3);
    expect(places.parcel.x).toBeGreaterThan(b.x + b.halfX);
  });

  it('goes through the cattle grid gateway, not the hedge', () => {
    const steps = planVisit({ places, from: 1, to: 1, does: 'parcel', leaveOpen: false, farmSpeed: 7 });
    for (const s of steps) {
      const path = s.path ?? [];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        // a leg that crosses x = fieldHalf (the hedge) must cross it within the road's gateway
        if ((a.x - LAYOUT.fieldHalf) * (b.x - LAYOUT.fieldHalf) < 0) {
          const z = a.z + ((b.z - a.z) * (LAYOUT.fieldHalf - a.x)) / (b.x - a.x);
          expect(Math.abs(z - LAYOUT.road.z)).toBeLessThan(LAYOUT.road.halfWidth);
        }
      }
    }
  });

  it('gives the post van and the neighbour their own registrations, not the farm\'s Land Rovers\'', () => {
    const farm = ['FRM 88L', 'H471 DKP'];
    const t = new Traffic({ places, params: P, random: createRandom(5) });
    const regs = new Set();
    for (let i = 0; i < 40; i++) {
      t.visit = null;
      const v = t.startVisit(i % 2 ? 'post' : 'neighbour');
      regs.add(v.reg);
      expect(farm).not.toContain(v.reg);
    }
    expect(regs.has('G342 TVR')).toBe(true);
    expect(regs.size).toBeGreaterThan(2);
  });
});

describe('a visit', () => {
  const make = (kind, extra = {}) => new Visit({ kind, places, from: 1, to: -1, leaveOpen: false, params: P, colour: 0xc8102e, ...extra });

  it('opens the shut gate, delivers, shuts it again and leaves', () => {
    const gate = fakeGate(false);
    const v = make('post');
    const { events, t } = runVisit(v, gate);
    const types = events.map((e) => e.type + (e.open !== undefined ? `:${e.open}` : ''));
    expect(types).toEqual(['gate:true', 'arrived', 'parcel', 'gate:false', 'done']);
    expect(gate.isOpen).toBe(false);
    expect(t).toBeLessThan(400);
  });

  it('leaves an open gate as it found it, and goes in without stopping to open it', () => {
    const gate = fakeGate(true);
    const { events } = runVisit(make('neighbour', { leaveOpen: true }), gate);
    const types = events.map((e) => e.type);
    expect(types).toContain('chat');
    expect(types).toContain('leftOpen');
    expect(events.filter((e) => e.type === 'gate').map((e) => e.open)).toEqual([]);
    expect(gate.isOpen).toBe(true);
  });

  it('opens the gate by the cattle grid each way and shuts it behind her', () => {
    const grid = fakeGate(false);
    const { events } = runVisit(make('post'), fakeGate(false), { gates: { grid } });
    const swings = events.filter((e) => e.type === 'gate' && e.which === 'grid').map((e) => e.open);
    expect(swings).toEqual([true, false, true, false]);
    expect(grid.isOpen).toBe(false);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('has the grid gate east of the grid, across the road', () => {
    expect(places.grid.x).toBeGreaterThan(LAYOUT.fieldHalf + LAYOUT.road.grid.length / 2);
    expect(places.grid.z).toBe(LAYOUT.road.z);
  });

  it('opens a gate that was shut behind it from inside', () => {
    const gate = fakeGate(false);
    const v = make('post');
    const events = [];
    for (let i = 0; i < 12000 && !v.done; i++) {
      events.push(...v.update(0.1, { gate, blockers: [], swingSeconds: 1.8 }));
      if (events.some((e) => e.type === 'parcel') && gate.isOpen && !v.shutInside) {
        gate.isOpen = false; // someone shuts it while she is at the barn
        v.shutInside = true;
      }
    }
    expect(events.filter((e) => e.type === 'gate').map((e) => e.open)).toEqual([true, true, false]);
    expect(v.done).toBe(true);
  });

  it('hoots when held up and waits for the way to clear', () => {
    const gate = fakeGate(true);
    const v = make('post');
    const events = [];
    // Someone stood on the lane where she turns in.
    const block = [{ x: laneX(places.lane, 1), z: places.gate.z - 10 }];
    for (let i = 0; i < 300; i++) events.push(...v.update(0.1, { gate, blockers: block, swingSeconds: 1.8 }));
    expect(events.some((e) => e.type === 'honk')).toBe(true);
    expect(v.drive.z).toBeLessThan(places.gate.z - 10);
    expect(v.done).toBe(false);
  });

  it('edges past something that never moves, after a long wait', () => {
    const d = new Drive({ x: 0, z: 0, yaw: 0, speed: 0, cruise: 8 });
    d.go([{ x: 0, z: 60 }]);
    const block = [{ x: 0, z: 8 }];
    for (let i = 0; i < 400 && d.z < 7; i++) d.update(0.1, block);
    expect(d.z).toBeLessThan(7);
    for (let i = 0; i < 600; i++) d.update(0.1, block);
    expect(d.z).toBeGreaterThan(20);
  });

  it('keeps the driver in the seat while driving and on foot only to walk', () => {
    const gate = fakeGate(false);
    const v = make('neighbour');
    let foot = 0;
    for (let i = 0; i < 12000 && !v.done; i++) {
      v.update(0.1, { gate, blockers: [], swingSeconds: 1.8 });
      if (v.driver.mode === 'foot') {
        foot++;
        expect(v.drive.speed).toBe(0);
      }
    }
    expect(foot).toBeGreaterThan(50);
    expect(v.driver.mode).toBe('seat');
  });
});

describe('Traffic', () => {
  const make = (params = {}, seed = 3) => new Traffic({ places, params: { ...P, ...params }, random: createRandom(seed) });
  const ctx = (extra = {}) => ({ darkness: 0, blockers: [], gate: fakeGate(true), swingSeconds: 1.8, ...extra });

  it('sends vehicles by on the lane, each in its own lane and gone off the end', () => {
    const t = make({ passEvery: 30, visitEvery: 0 });
    const seen = new Set();
    let passes = 0;
    let gone = 0;
    for (let i = 0; i < 12000; i++) {
      for (const e of t.update(0.1, ctx())) {
        if (e.type === 'pass') passes++;
        if (e.type === 'gone') gone++;
      }
      for (const v of t.vehicles) seen.add(v.kind);
    }
    expect(passes).toBeGreaterThan(10);
    expect(gone).toBeGreaterThanOrEqual(passes - 3);
    expect(seen.size).toBeGreaterThan(1);
    expect(t.vehicles.length).toBeLessThanOrEqual(3);
  });

  it('is quieter at night', () => {
    const count = (darkness) => {
      const t = make({ passEvery: 60, visitEvery: 0 }, 11);
      let n = 0;
      for (let i = 0; i < 36000; i++) for (const e of t.update(0.1, ctx({ darkness }))) if (e.type === 'pass') n++;
      return n;
    };
    expect(count(1)).toBeLessThan(count(0) * 0.7);
  });

  it('can be switched off', () => {
    const t = make({ passEvery: 0, visitEvery: 0 });
    for (let i = 0; i < 6000; i++) expect(t.update(0.1, ctx())).toEqual([]);
  });

  it('does not send a visitor before the first visit time or in the dark, and only one at a time', () => {
    const t = make({ visitEvery: 5, firstVisit: 100, passEvery: 0 });
    let first = null;
    for (let i = 0; i < 6000; i++) {
      for (const e of t.update(0.1, ctx())) if (e.type === 'visit' && first === null) first = t.clock;
      if (t.visit) expect(t.startVisit()).toBeNull();
    }
    expect(first).toBeGreaterThanOrEqual(100);
    const dark = make({ visitEvery: 5, firstVisit: 0, passEvery: 0 });
    for (let i = 0; i < 3000; i++) for (const e of dark.update(0.1, ctx({ darkness: 1 }))) expect(e.type).not.toBe('visit');
  });

  it('runs whole visits through the update and ends them', () => {
    const t = make({ visitEvery: 1, firstVisit: 0, passEvery: 0 });
    const gate = fakeGate(false);
    let ended = 0;
    for (let i = 0; i < 20000; i++) for (const e of t.update(0.1, ctx({ gate }))) if (e.type === 'visitEnded') ended++;
    expect(ended).toBeGreaterThanOrEqual(2);
  });

  it('has a range for every tunable and a model for every kind', () => {
    for (const k of Object.keys(DEFAULT_TRAFFIC_PARAMS)) expect(TRAFFIC_PARAM_RANGES[k], k).toBeTruthy();
    for (const k of Object.values(LANE_KINDS)) expect(['defender', 'series', 'tractor', 'utv']).toContain(k.model);
  });
});

describe('the gates in the fields', () => {
  it('lets the route through the south gate only while it is open', () => {
    const f = createFields(LAYOUT);
    const from = { x: -30, z: 40 };
    const to = { x: -30, z: 120 };
    expect(f.route(from, to).length).toBeGreaterThan(1);
    f.gates.south.shut = true;
    expect(f.route(from, to)).toEqual([to]);
    f.gates.south.shut = false;
    expect(f.route(from, to).length).toBeGreaterThan(1);
  });

  it('counts the big gate as a hedge while it is shut', () => {
    const f = createFields(LAYOUT);
    const ahead = () => f.hedgeAhead(190, LAYOUT.road.z, Math.PI / 2);
    expect(ahead()).toBeCloseTo(LAYOUT.farm.maxX - 190, 0);
    f.gates.road.shut = false;
    expect(ahead()).toBe(Infinity);
  });
});

describe('the girls and the lane', () => {
  it('has a notice, a wave reaction and chances for both girls', async () => {
    const { NOTICE_KINDS } = await import('../src/npc/attention.js');
    const { NOTICE_REACTIONS, REACTIONS, reactionTo } = await import('../src/npc/reactions.js');
    const { DEFAULT_COMPANION_PARAMS } = await import('../src/npc/companionParams.js');
    const { CHARACTERS } = await import('../src/npc/characters.js');
    expect(NOTICE_KINDS.traffic).toBeTruthy();
    expect(REACTIONS.wave).toBeTruthy();
    expect(NOTICE_REACTIONS.traffic.reaction).toBe('wave');
    const jess = { ...DEFAULT_COMPANION_PARAMS, ...CHARACTERS.find((c) => c.id === 'jess').params };
    const amy = { ...DEFAULT_COMPANION_PARAMS, ...CHARACTERS.find((c) => c.id === 'amy').params };
    expect(jess.reactWaveChance).toBeGreaterThan(amy.reactWaveChance);
    const n = { kind: 'traffic', x: 10, y: 0, z: 0, strength: 1 };
    const ctx = { distance: 10, own: false, can: () => true, current: null };
    expect(reactionTo(n, ctx, jess, () => 0.5)?.type).toBe('wave');
    expect(reactionTo(n, ctx, amy, () => 0.5)).toBeNull();
    expect(reactionTo(n, { ...ctx, distance: 80 }, jess, () => 0)).toBeNull();
  });

  it('has lines for both girls for each thing she may remark on', async () => {
    const { AMY_TRAFFIC_LINES, JESS_TRAFFIC_LINES } = await import('../src/npc/trafficLines.js');
    expect(Object.keys(JESS_TRAFFIC_LINES).sort()).toEqual(Object.keys(AMY_TRAFFIC_LINES).sort());
    for (const l of [...Object.values(JESS_TRAFFIC_LINES), ...Object.values(AMY_TRAFFIC_LINES).map((x) => x.lines)].flat()) expect(l).not.toMatch(/—|–/);
  });

  it('shifts the drone with speed and goes quiet when stood', async () => {
    const { droneFor } = await import('../src/audio/trafficAudio.js');
    expect(droneFor('van', 15).hz).toBeGreaterThan(droneFor('van', 2).hz);
    expect(droneFor('van', 0).tyre).toBe(0);
    expect(droneFor('tractor', 6).hz).toBeLessThan(droneFor('van', 6).hz);
  });
});
