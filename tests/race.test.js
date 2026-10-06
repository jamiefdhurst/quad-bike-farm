import { describe, it, expect } from 'vitest';
import { Race, pickQuads, planLap, DEFAULT_RACE_PARAMS as P } from '../src/npc/race.js';
import { Track } from '../src/world/track.js';
import { AMY_RACE_LINES, JESS_RACE_LINES, RACE_BANTER } from '../src/npc/raceLines.js';
import { BANTER_TIMING } from '../src/npc/banter.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

const free = [{ id: 'amy', free: true }, { id: 'jess', free: true }];
const ctx = (o = {}) => ({ girls: free, options: { amy: ['red', 'blue'], jess: ['red', 'blue', 'yellow'] }, claims: { amy: 'red', jess: 'yellow' }, ...o });
const make = (params = {}, random = () => 0) => new Race({ ...P, startAfter: 0, freeFor: 0, chance: 1, ...params }, random);
const step = (r, seconds, c = ctx(), dt = 0.5) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...r.update(dt, c));
  return events;
};
// Gets a race going to the point where it has started.
function started(params) {
  const r = make(params);
  const [invite] = r.update(1, ctx());
  r.grid('amy');
  r.grid('jess');
  step(r, 5);
  expect(r.phase).toBe('race');
  return { r, invite };
}

describe('picking the quads', () => {
  it('gives each their own claim when they can, never the same quad', () => {
    expect(pickQuads({ amy: ['red', 'blue'], jess: ['red', 'yellow'] }, { amy: 'red', jess: 'yellow' }, () => 0)).toEqual({ amy: 'red', jess: 'yellow' });
    expect(pickQuads({ amy: ['red', 'blue'], jess: ['red'] }, { amy: 'red', jess: 'red' }, () => 0)).toBeNull(); // only one quad she could have, and Amy has it
  });

  it('falls back to something else when the claim is not on offer, and gives up with only one quad between them', () => {
    expect(pickQuads({ amy: ['blue'], jess: ['blue', 'green'] }, { amy: 'red', jess: 'blue' }, () => 0)).toEqual({ amy: 'blue', jess: 'green' });
    expect(pickQuads({ amy: ['blue'], jess: ['blue'] }, {}, () => 0)).toBeNull();
  });
});

describe('the lap', () => {
  const track = new Track([[0, 0], [60, 0], [60, 60], [0, 60]]);
  it('goes once round, ending back at the start, with the waypoints about the spacing apart', () => {
    const lap = planLap(track, 0, [], { spacing: 10 });
    const start = track.sample(0);
    expect(Math.hypot(lap.at(-1).x - start.x, lap.at(-1).z - start.z)).toBeLessThan(0.5);
    expect(lap.length).toBeGreaterThanOrEqual(20);
    for (let i = 1; i < lap.length; i++) expect(Math.hypot(lap[i].x - lap[i - 1].x, lap[i].z - lap[i - 1].z)).toBeLessThan(16);
  });

  it('keeps clear of a bog it would have gone through', () => {
    const hazard = { x: 30, z: 0, radius: 4 };
    const lap = planLap(track, 0, [hazard], { spacing: 5, margin: 1.4 });
    for (const pt of lap) expect(Math.hypot(pt.x - hazard.x, pt.z - hazard.z)).toBeGreaterThanOrEqual(hazard.radius + 1.4 - 0.01);
  });

  it('puts two quads on the grid side by side', () => {
    const a = planLap(track, 0, [], { lateral: 1 }).at(-1);
    const b = planLap(track, 0, [], { lateral: -1 }).at(-1);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(2, 1);
  });
});

describe('a race', () => {
  it('starts when both are free, after the start delay and the free time, not before', () => {
    expect(make({ startAfter: 100 }).update(1, ctx())).toEqual([]);
    expect(make({ freeFor: 10 }).update(1, ctx())).toEqual([]);
    expect(make().update(1, ctx({ girls: [{ id: 'amy', free: true }, { id: 'jess', free: false }] }))).toEqual([]);
    const [invite] = make().update(1, ctx());
    expect(invite).toMatchObject({ type: 'invite', challenger: 'jess', other: 'amy', picks: { amy: 'red', jess: 'yellow' } });
  });

  it('waits for both on the grid, counts down, then they are off', () => {
    const r = make();
    r.update(1, ctx());
    expect(r.go()).toBe(false);
    r.grid('amy');
    expect(step(r, 5)).toEqual([]); // one on the line is not enough
    r.grid('jess');
    expect(step(r, 1)[0]).toEqual({ type: 'countdown', seconds: P.countdown });
    expect(r.go()).toBe(false);
    const events = step(r, P.countdown);
    expect(events.some((e) => e.type === 'go')).toBe(true);
    expect(r.go()).toBe(true);
  });

  it('is called off if they have not both got to the line in time, or one is out before the start', () => {
    const r = make({ gatherTimeout: 20 });
    r.update(1, ctx());
    r.grid('amy');
    expect(step(r, 25).some((e) => e.type === 'cancel')).toBe(true);
    expect(r.active).toBe(false);
    const q = make();
    q.update(1, ctx());
    q.abort('amy');
    expect(step(q, 1).some((e) => e.type === 'cancel')).toBe(true);
  });

  it('is won by whoever finishes first, and scored', () => {
    const { r } = started();
    step(r, 20);
    r.finish('jess');
    step(r, 5);
    r.finish('amy');
    const events = step(r, 1);
    expect(events.filter((e) => e.type === 'finish').map((e) => [e.girl, e.place])).toEqual([['amy', 2]]);
    const result = events.find((e) => e.type === 'result');
    expect(result).toMatchObject({ winner: 'jess', loser: 'amy', dnf: false });
    expect(result.margin).toBeCloseTo(5, 0);
    expect(r.tally).toEqual({ jess: { wins: 1, losses: 0 }, amy: { wins: 0, losses: 1 } });
  });

  it('a girl who drops out loses, even though the other has to finish', () => {
    const { r } = started();
    step(r, 10);
    r.abort('amy');
    r.finish('jess');
    const events = step(r, 1);
    expect(events.find((e) => e.type === 'out')?.girl).toBe('amy');
    expect(events.find((e) => e.type === 'result')).toMatchObject({ winner: 'jess', loser: 'amy', dnf: true });
  });

  it('nobody wins if both are out, and nobody is out of the race for ever', () => {
    const { r } = started({ raceTimeout: 30 });
    const events = step(r, 40);
    expect(events.find((e) => e.type === 'result')).toMatchObject({ winner: null });
    expect(r.tally).toEqual({});
  });

  it('then not again until the cooldown is up, and the score is kept', () => {
    const { r } = started();
    r.finish('amy');
    r.finish('jess');
    step(r, 2);
    expect(step(r, P.cooldown - 20).some((e) => e.type === 'invite')).toBe(false);
    expect(step(r, 40).some((e) => e.type === 'invite')).toBe(true);
  });

  it('rivalry is the one with the lead of at least rivalLead wins', () => {
    const r = make();
    r.record('amy').wins = 3;
    r.record('jess').wins = 1;
    expect(r.rivalry()).toEqual({ leader: 'amy', trailing: 'jess' });
    r.record('jess').wins = 2;
    expect(r.rivalry()).toBeNull();
  });
});

describe('her race mode when driving', () => {
  // Just the waypoint and phase logic, without a quad to drive.
  const quad = { engine: { isRunning: true, temperature: 1 }, position: { x: 0, z: 0 }, yaw: 0, forwardSpeed: 0, choke: 0 };
  function racer(race) {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, { p: { ...DEFAULT_COMPANION_PARAMS, drivePauseChance: 0 }, race, quad, events: [], controls: { throttle: 0, brake: 0, steer: 0, reverse: false }, index: 0, waypoints: race.route, forgetsChoke: true, origin: { x: 0, z: 0 }, maxDistance: 0, clock: 0, noted: {}, timer: 0, running: true, stalls: 0, friend: () => null, friendAboard: false });
    d.random = () => 0;
    return d;
  }

  it('on the grid it holds, then once the start has gone it drives on', () => {
    let go = false;
    const race = { route: [{ x: 0, z: 0 }, { x: 0, z: 30 }], gridIndex: 0, go: () => go, alive: () => true, onGrid() {}, cruise: 10 };
    const d = racer(race);
    d.phase = 'grid';
    d.timer = 0;
    d.update(0.1);
    expect(d.phase).toBe('grid');
    expect(d.controls.brake).toBe(1);
    go = true;
    d.update(0.1);
    expect(d.phase).toBe('drive');
    expect(d.events).toContain('raceGo');
  });

  it('stops where she is if the race is called off', () => {
    const race = { route: [{ x: 0, z: 0 }], gridIndex: 0, go: () => false, alive: () => false, cruise: 10 };
    const d = racer(race);
    d.phase = 'grid';
    d.timer = 0;
    d.update(0.1);
    expect(d.phase).toBe('stop');
  });
});

describe('what they say', () => {
  it('has lines for every part of a race, and banter for every outcome', () => {
    for (const k of ['raceInvite', 'raceAccept', 'raceCount', 'raceWin', 'raceLose', 'raceOut']) {
      expect(AMY_RACE_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_RACE_LINES[k].length, k).toBeGreaterThan(0);
    }
    for (const roles of [{ winner: 'amy', loser: 'jess' }, { winner: 'jess', loser: 'amy' }]) {
      expect(RACE_BANTER.filter((e) => e.when === 'raced' && e.roles.winner === roles.winner).length).toBeGreaterThan(1);
    }
    for (const e of RACE_BANTER) expect(BANTER_TIMING[e.when]).toBeTruthy();
  });
});

describe('starting one from the debug panel', () => {
  it('forced, it starts at the first chance whatever the timing, once both are free', () => {
    const r = new Race({ ...P }, () => 0.99); // the dice would never allow it
    expect(r.update(1, ctx())).toEqual([]);
    r.forced = true;
    expect(r.update(1, ctx({ girls: [{ id: 'amy', free: true }, { id: 'jess', free: false }] }))).toEqual([]);
    expect(r.update(1, ctx())[0].type).toBe('invite');
    expect(r.forced).toBe(false);
  });
});

describe('called away', () => {
  it('stand() calls a race off quietly and keeps them from starting another straight away', () => {
    const { r } = started();
    r.stand();
    expect(r.active).toBe(false);
    expect(step(r, 5).some((e) => e.type === 'invite')).toBe(false);
  });
});
