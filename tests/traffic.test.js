import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createRandom } from '../src/core/random.js';
import { Drive, Traffic, Visit, DEFAULT_TRAFFIC_PARAMS, TRAFFIC_PARAM_RANGES, visitPlaces, planVisit, laneX, LANE_KINDS, VISITOR_KINDS } from '../src/world/traffic.js';
import { wantedBodies } from '../src/world/trafficView.js';
import { createFields } from '../src/world/fields.js';

const places = visitPlaces(LAYOUT);
const P = { ...DEFAULT_TRAFFIC_PARAMS, backEvery: 0, aRoadEvery: 0 }; // Back Lane's and the A-road's traffic have their own tests (backLane, aRoadTraffic)

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

  it('drives on the left', () => {
    const lane = LAYOUT.publicLane;
    expect(laneX(lane, 1)).toBeGreaterThan(lane.x); // heading south, the left is east
    expect(laneX(lane, -1)).toBeLessThan(lane.x);
  });



  it('crosses the drive\'s cattle grid on the tarmac, in and out', () => {
    const steps = planVisit({ places, from: 1, to: 1, does: 'parcel', farmSpeed: 7 });
    const gx = LAYOUT.road.grid.x;
    let crossings = 0;
    for (const s of steps) {
      const path = s.path ?? [];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        // a leg that crosses the grid's line must cross it on the drive's tarmac
        if ((a.x - gx) * (b.x - gx) < 0) {
          const z = a.z + ((b.z - a.z) * (gx - a.x)) / (b.x - a.x);
          expect(Math.abs(z - LAYOUT.road.z)).toBeLessThan(LAYOUT.road.halfWidth);
          crossings++;
        }
      }
    }
    expect(crossings).toBe(2);
  });

  it('gives the post van and the neighbour their own registrations, not the farm\'s the Tor and the Crag\'', () => {
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
    expect(regs.has('K412 PBW')).toBe(true); // she drives her own Tor, the one parked in her yard
    expect(regs.size).toBe(2);
  });

  it('has the neighbour call in the Tor parked in her yard, in its paint and with its registration (#908)', () => {
    const tor = LAYOUT.neighbourFarm.parked.find((p) => p.kind === 'tor');
    expect(VISITOR_KINDS.neighbour.model).toBe('tor');
    expect(VISITOR_KINDS.neighbour.colour).toBe(tor.colour);
    expect(VISITOR_KINDS.neighbour.regs).toEqual([tor.reg]);
    const t = new Traffic({ places, params: P, random: createRandom(9) });
    const v = t.startVisit('neighbour');
    expect(v.colour).toBe(tor.colour);
    expect(v.reg).toBe(tor.reg);
  });
});

describe('a visit', () => {
  const make = (kind, extra = {}) => new Visit({ kind, places, from: 1, to: -1, leaveOpen: false, params: P, colour: 0xc8102e, ...extra });







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
    for (const k of Object.values(LANE_KINDS)) expect(['crag', 'tor', 'tractor', 'utv']).toContain(k.model);
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

describe('the bodies built ahead (#532)', () => {
  const key = (model, colour, reg) => `${model}:${colour}:${reg ?? ''}`;
  const wanted = new Set(wantedBodies().map((b) => key(b.model, b.colour, b.reg)));

  it('has one of everything the lane, the visitors and the kids can ask for, and no more than it needs', () => {
    const t = new Traffic({ places, params: P, random: createRandom(9) });
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const v = t.spawnPass();
      seen.add(key(v.model, v.colour, null));
      t.visit = null;
      const visit = t.startVisit(i % 3 === 0 ? 'post' : 'neighbour');
      seen.add(key(visit.model, visit.colour, visit.reg));
    }
    const tuner = new Traffic({ places, params: P, random: createRandom(1) }).startVisit('tuner');
    seen.add(key(tuner.model, tuner.colour, tuner.reg));
    for (const k of seen) expect(wanted.has(k)).toBe(true);
    expect(wanted.size).toBeLessThanOrEqual(30);
    expect(wantedBodies()).toHaveLength(wanted.size);
  });

  it('pairs each neighbour\'s paint with one registration', () => {
    const t = new Traffic({ places, params: P, random: createRandom(4) });
    const regOf = new Map();
    for (let i = 0; i < 80; i++) {
      t.visit = null;
      const v = t.startVisit('neighbour');
      expect(regOf.get(v.colour) ?? v.reg).toBe(v.reg);
      regOf.set(v.colour, v.reg);
    }
  });
});
