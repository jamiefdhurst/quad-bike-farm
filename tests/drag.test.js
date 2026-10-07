import { describe, it, expect } from 'vitest';
import { Drag, onDragGrid, DEFAULT_DRAG_PARAMS as P } from '../src/npc/drag.js';
import { AMY_DRAG_LINES, JESS_DRAG_LINES, DRAG_LINE_KEYS } from '../src/npc/dragLines.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { LAYOUT, stripFrame, stripPoint } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';

const free = [{ id: 'amy', free: true }, { id: 'jess', free: true }];
const idleYou = { riding: 'green', still: true, stalled: false, throttle: 0, near: true, across: 1 };
const ctx = (o = {}) => ({ girls: free, options: { amy: ['red', 'blue'], jess: ['red', 'blue', 'yellow'] }, claims: { amy: 'red', jess: 'yellow' }, you: idleYou, along: {}, length: 70, ...o });
const make = (params = {}, random = () => 0) => new Drag({ ...P, startAfter: 0, blipChance: 1, ...params }, random);
const step = (d, seconds, c = ctx(), dt = 0.25) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...d.update(dt, typeof c === 'function' ? c() : c));
  return events;
};
const types = (events) => events.map((e) => e.type);

// Asked from the line and both on the grid, counting down.
function counting(params) {
  const d = make(params);
  d.forced = true;
  const [invite] = d.update(0.5, ctx());
  d.grid('jess');
  d.grid('you');
  const events = d.update(0.5, ctx());
  return { d, invite, events };
}

describe('asking for one at the line', () => {
  it('starts when you ask, with Jess or Amy as the dice fall, once both girls are free and you are on a quad', () => {
    const d = make({}, () => 0.1);
    expect(d.update(0.5, ctx())).toEqual([]); // not asked, and not still long enough
    d.forced = true;
    const [invite] = d.update(0.5, ctx());
    expect(invite).toMatchObject({ type: 'invite', girl: 'jess', asked: true, picks: { jess: 'yellow', you: 'green' } });
    const amy = make({}, () => 0.99);
    amy.forced = true;
    expect(amy.update(0.5, ctx())[0]).toMatchObject({ girl: 'amy', picks: { amy: 'red' } });
  });

  it('waits for both girls to be free, and forgets it if you get off', () => {
    const d = make();
    d.forced = true;
    expect(d.update(0.5, ctx({ girls: [{ id: 'amy', free: true }, { id: 'jess', free: false }] }))).toEqual([]);
    expect(d.forced).toBe(true);
    expect(d.update(0.5, ctx({ you: { ...idleYou, riding: null } }))).toEqual([]);
    expect(d.forced).toBe(false);
  });

  it('puts her in the lane you are not nearer to', () => {
    const left = make();
    left.forced = true;
    expect(left.update(0.5, ctx({ you: { ...idleYou, across: 1 } }))[0].lane).toBe(-1);
    const right = make();
    right.forced = true;
    expect(right.update(0.5, ctx({ you: { ...idleYou, across: -1 } }))[0].lane).toBe(1);
  });
});

describe('the grid, the count-down and the start', () => {
  it('counts down once you are both on the line, and goes', () => {
    const { d, events } = counting();
    expect(types(events)).toEqual(['countdown']);
    expect(d.go()).toBe(false);
    expect(types(step(d, P.countdown + 0.5))).toContain('go');
    expect(d.go()).toBe(true);
  });

  it('does not count down with only one of you on the line', () => {
    const d = make();
    d.forced = true;
    d.update(0.5, ctx());
    d.grid('jess');
    expect(step(d, 5)).toEqual([]);
    expect(d.phase).toBe('gather');
  });

  it('calls it off if you never line up', () => {
    const d = make();
    d.forced = true;
    d.update(0.5, ctx());
    d.grid('jess');
    expect(types(step(d, P.youWait + 2))).toContain('cancel');
    expect(d.active).toBe(false);
  });

  it('calls it a false start when you roll over the line in the count-down, and lets you line up again, but only so many times', () => {
    const { d } = counting();
    d.ungrid('you');
    const events = d.update(0.25, ctx({ along: { you: 2 } }));
    expect(types(events)).toEqual(['falseStart']);
    expect(d.phase).toBe('gather');
    for (let i = 0; i < P.falseStarts; i++) {
      d.grid('you');
      d.update(0.25, ctx());
      expect(d.phase).toBe('countdown');
      d.ungrid('you');
      const e = d.update(0.25, ctx({ along: { you: 2 } }));
      expect(types(e)).toEqual(i < P.falseStarts - 1 ? ['falseStart'] : ['cancel']);
    }
  });

  it('forgets it quietly-ish if you pull off the grid without going forward', () => {
    const { d } = counting();
    d.ungrid('you');
    expect(types(d.update(0.25, ctx({ along: { you: -3 } })))).toEqual(['cancel']);
  });

  it('is called off if her quad dies before the start', () => {
    const { d } = counting();
    d.abort('jess');
    expect(types(d.update(0.25, ctx()))).toEqual(['cancel']);
  });
});

describe('the race', () => {
  function running() {
    const { d } = counting();
    step(d, P.countdown + 0.5);
    expect(d.phase).toBe('race');
    return d;
  }

  it('is won by whoever is first over the finish line, and the tally keeps it', () => {
    const d = running();
    const e1 = d.update(0.25, ctx({ along: { you: 70.5, jess: 60 } }));
    expect(e1[0]).toMatchObject({ type: 'finish', id: 'you', place: 1 });
    const e2 = d.update(0.25, ctx({ along: { you: 80, jess: 71 } }));
    expect(types(e2)).toEqual(['finish', 'result']);
    expect(e2[0]).toMatchObject({ id: 'jess', place: 2, ahead: ['you'] });
    expect(e2[1]).toMatchObject({ winner: 'you', loser: 'jess' });
    expect(d.tally.you).toEqual({ wins: 1, losses: 0 });
    expect(d.tally.jess).toEqual({ wins: 0, losses: 1 });
  });

  it('a girl who finishes first wins, and does not win it twice', () => {
    const d = running();
    const events = step(d, 1, () => ctx({ along: { you: 30, jess: 71 } }));
    expect(events.filter((e) => e.type === 'finish')).toHaveLength(1);
    expect(d.finished[0].id).toBe('jess');
  });

  it('a girl whose quad dies is out, and you win by finishing', () => {
    const d = running();
    d.abort('jess');
    const events = d.update(0.25, ctx({ along: { you: 71 } }));
    expect(types(events)).toContain('out');
    expect(events.find((e) => e.type === 'result')).toMatchObject({ winner: 'you', loser: 'jess' });
  });

  it('you are out if you are off the quad or stalled too long', () => {
    const d = running();
    const events = step(d, P.youOutAfter + 1, ctx({ you: { ...idleYou, stalled: true } }));
    expect(events).toContainEqual({ type: 'out', id: 'you' });
  });

  it('nobody finishing by the timeout ends it with no winner', () => {
    const d = running();
    const events = step(d, P.raceTimeout + 2, ctx({ along: { you: 10, jess: 10 } }));
    expect(events.find((e) => e.type === 'result')).toMatchObject({ winner: null });
  });
});

describe('Jess pulling up and blipping', () => {
  const sat = (o = {}) => ctx({ you: { ...idleYou, ...o } });
  function pulledUp(params) {
    const d = make({ blipStill: 3, ...params });
    const events = step(d, 5, sat());
    d.grid('jess');
    return { d, events };
  }

  it('comes over only after you have sat still on a quad long enough, and not before the start delay or in the cooldown', () => {
    expect(step(make({ blipStill: 3 }), 2.5, sat())).toEqual([]);
    expect(types(step(make({ blipStill: 3 }), 5, sat()))).toEqual(['approach']);
    expect(step(make({ blipStill: 3, startAfter: 100 }), 10, sat())).toEqual([]);
    expect(step(make({ blipStill: 3 }), 10, sat({ still: false }))).toEqual([]);
    expect(step(make({ blipStill: 3 }), 10, ctx({ busy: true, you: idleYou }))).toEqual([]);
  });

  it('is a ten second wait by default', () => {
    expect(P.blipStill).toBe(10);
  });

  it('is only ever Jess, on a quad you are not on', () => {
    const events = step(make({ blipStill: 3 }), 5, sat());
    expect(events[0]).toMatchObject({ type: 'approach', girl: 'jess', pick: 'yellow' });
    expect(step(make({ blipStill: 3 }), 8, ctx({ options: { amy: ['red'], jess: [] }, you: idleYou }))).toEqual([]);
  });

  it('blips her throttle when she is beside you, a set number of times', () => {
    const { d } = pulledUp();
    expect(d.phase).toBe('blip');
    let pulses = 0;
    let was = false;
    for (let t = 0; t < 8; t += 0.05) {
      d.update(0.05, sat());
      if (d.blipping() && !was) pulses++;
      was = d.blipping();
    }
    expect(pulses).toBe(P.blipCount);
  });

  it('is on when you blip back, and the girl is told to go to the strip', () => {
    const { d } = pulledUp();
    d.update(0.5, sat({ throttle: 0 }));
    step(d, 1.5, sat({ throttle: 0 }));
    const events = d.update(0.1, sat({ throttle: 1 }));
    expect(types(events)).toEqual(['answered', 'invite']);
    expect(events[1]).toMatchObject({ girl: 'jess', blipped: true, picks: { jess: 'yellow', you: 'green' } });
    expect(d.phase).toBe('gather');
  });

  it('does not count a throttle that was already open, or one when you are moving', () => {
    const { d } = pulledUp();
    expect(step(d, 1.5, sat({ throttle: 1 }))).toEqual([]);
    d.update(0.25, sat({ throttle: 0 }));
    expect(types(d.update(0.25, sat({ throttle: 1, still: false })))).toEqual([]);
  });

  it('calls you chicken if you ignore her, and does not try again straight away', () => {
    const { d } = pulledUp();
    const events = step(d, 12, sat());
    expect(events).toContainEqual({ type: 'chicken', girl: 'jess' });
    expect(d.active).toBe(false);
    d.clock += 1;
    expect(step(d, 20, sat())).toEqual([]);
  });

  it('forgets it if you get off, or ride away before she gets there', () => {
    const a = make({ blipStill: 3 });
    step(a, 5, sat());
    expect(types(a.update(0.25, sat({ riding: null })))).toEqual([]);
    expect(a.active).toBe(false);
    const b = make({ blipStill: 3 });
    step(b, 5, sat());
    step(b, 9, sat({ still: false }));
    expect(b.active).toBe(false);
  });

  it('gives up if she never gets there', () => {
    const d = make({ blipStill: 3 });
    step(d, 5, sat());
    step(d, P.approachTimeout + 1, sat());
    expect(d.active).toBe(false);
  });
});

describe('called away', () => {
  it('stand() calls it off quietly', () => {
    const { d } = counting();
    d.stand();
    expect(d.active).toBe(false);
    expect(d.forced).toBe(false);
  });
});

describe('lining up', () => {
  it('needs you close, stopped and pointing along the strip', () => {
    const at = (o) => onDragGrid({ dist: 1, speed: 0, yaw: 1.57, ...o }, 1.57, P);
    expect(at({})).toBe(true);
    expect(at({ dist: 4 })).toBe(false);
    expect(at({ speed: 3 })).toBe(false);
    expect(at({ yaw: 0 })).toBe(false);
  });
});

describe('her drive for it', () => {
  const quad = { engine: { isRunning: true, temperature: 1 }, position: { x: 0, z: 0 }, yaw: 0, forwardSpeed: 0, choke: 0 };
  function racer(race) {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, { p: { ...DEFAULT_COMPANION_PARAMS, drivePauseChance: 0 }, race, quad, events: [], controls: { throttle: 0, brake: 0, steer: 0, reverse: false }, index: 0, waypoints: race.route, forgetsChoke: true, origin: { x: 0, z: 0 }, maxDistance: 0, clock: 0, noted: {}, timer: 0, running: true, stalls: 0, friend: () => null, friendAboard: false });
    d.random = () => 0;
    return d;
  }

  it('holds the brake and opens the throttle while she blips', () => {
    let blip = false;
    const d = racer({ route: [{ x: 0, z: 0 }], gridIndex: 0, go: () => false, alive: () => true, blip: () => blip, cruise: 9 });
    d.phase = 'grid';
    d.update(0.1);
    expect(d.controls).toMatchObject({ throttle: 0, brake: 1 });
    blip = true;
    d.update(0.1);
    expect(d.controls).toMatchObject({ throttle: 1, brake: 1 });
  });

  it('can be sent somewhere else once she is waiting beside you', () => {
    const d = racer({ route: [{ x: 0, z: 0 }], gridIndex: 0, go: () => false, alive: () => true, cruise: 9 });
    d.phase = 'grid';
    const next = { route: [{ x: 5, z: -10 }, { x: 5, z: 0 }, { x: 5, z: 80 }], gridIndex: 1, go: () => false, alive: () => true, cruise: 30 };
    d.reroute(next);
    expect(d.phase).toBe('drive');
    expect(d.race).toBe(next);
    expect(d.index).toBe(0);
    expect(d.waypoints).toHaveLength(3);
  });
});

describe('what they say', () => {
  it('has a line for every part of it, in both voices, with no dashes', () => {
    for (const k of DRAG_LINE_KEYS) {
      expect(AMY_DRAG_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_DRAG_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_DRAG_LINES[k].lines, ...JESS_DRAG_LINES[k]]) expect(l, l).not.toMatch(/—|–/);
    }
  });
});

describe('where the strip is', () => {
  const s = LAYOUT.dragStrip;
  const track = new Track(LAYOUT.trackPoints);
  const heights = createTerrainHeight(LAYOUT, track);
  const each = (fn, { from = -8, to = s.length + s.runOff + 4, side = s.width / 2 + 2 } = {}) => {
    for (let along = from; along <= to; along += 2) for (const across of [-side, -s.width / 2, 0, s.width / 2, side]) fn(stripPoint(s, along, across), along, across);
  };

  it('converts both ways between the field and the strip', () => {
    const p = stripPoint(s, 12, 3);
    const f = stripFrame(s, p.x, p.z);
    expect(f.along).toBeCloseTo(12);
    expect(f.across).toBeCloseTo(3);
  });

  it('lies along its yaw, and the lanes sit the way the girls\' race counts them', () => {
    const a = stripPoint(s, 10, 0);
    const b = stripPoint(s, 20, 0);
    expect(Math.atan2(b.x - a.x, b.z - a.z)).toBeCloseTo(s.yaw);
    const left = stripPoint(s, 0, 2);
    // The same sense as planLap's `lateral`: x - tz * lateral, z + tx * lateral.
    expect(left.x).toBeCloseTo(s.x - Math.cos(s.yaw) * 2);
    expect(left.z).toBeCloseTo(s.z + Math.sin(s.yaw) * 2);
  });

  it('is level, clear of the track, bogs, puddles and hedges', () => {
    let lo = Infinity;
    let hi = -Infinity;
    each((pt, along, across) => {
      expect(Math.abs(pt.x) < LAYOUT.fieldHalf - 6 && Math.abs(pt.z) < LAYOUT.fieldHalf - 6, `${along},${across} inside`).toBe(true);
      expect(heights.bogAt(pt.x, pt.z), `bog at ${along},${across}`).toBe(0);
      expect(heights.puddleAt(pt.x, pt.z), `puddle at ${along},${across}`).toBe(0);
      expect(track.distanceTo(pt.x, pt.z), `track at ${along},${across}`).toBeGreaterThan(LAYOUT.trackHalfWidth + 1.5);
    });
    each((pt) => {
      const h = heights.heightAt(pt.x, pt.z);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }, { from: -8, to: s.length + s.runOff, side: s.width / 2 });
    expect(hi - lo).toBeLessThan(0.05);
  });

  it('keeps clear of the bales, the ramp and its run-up, and the other things in the field', () => {
    for (const [x, z] of LAYOUT.strawBaleSpots) {
      const f = stripFrame(s, x, z);
      expect(f.along < -8 || f.along > s.length + s.runOff + 4 || Math.abs(f.across) > s.width / 2 + 5, `bale ${x},${z}`).toBe(true);
    }
    const r = LAYOUT.jumpRamp;
    for (let along = -30; along <= r.length + 30; along += 2) {
      const f = stripFrame(s, r.x + Math.sin(r.yaw) * along, r.z + Math.cos(r.yaw) * along);
      expect(f.along < -8 || f.along > s.length + s.runOff + 4 || Math.abs(f.across) > s.width / 2 + 5, `ramp ${along}`).toBe(true);
    }
  });
});

describe('after the finish', () => {
  const quad = { engine: { isRunning: true, temperature: 1 }, position: { x: 0, z: 40 }, yaw: 0, forwardSpeed: 12, choke: 0 };
  function finishing(keepDriving) {
    const after = { driveMaxThrottle: 0.6, driveScareSpeed: 9, drivePauseChance: 0.3 };
    const race = { route: [{ x: 0, z: 0 }, { x: 0, z: 40 }], gridIndex: 0, go: () => true, alive: () => true, onFinish() {}, keepDriving, cruise: 30 };
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, { p: { ...DEFAULT_COMPANION_PARAMS, driveMaxThrottle: 1, driveScareSpeed: 99, drivePauseChance: 0 }, race, quad, events: [], controls: { throttle: 0, brake: 0, steer: 0, reverse: false }, index: 1, waypoints: race.route, forgetsChoke: true, origin: { x: 0, z: 0 }, maxDistance: 0, clock: 0, noted: {}, timer: 0, running: true, stalls: 0, friend: () => null, friendAboard: false, regrids: 0, time: 50, driveFor: 10, phase: 'drive', passenger: () => false, after });
    d.random = () => 0;
    d.pickCruise = () => 8;
    return d;
  }

  it('pulls up as before, or carries on driving as herself, as decided', () => {
    const stop = finishing(false);
    stop.update(0.1);
    expect(stop.phase).toBe('stop');
    const go = finishing(true);
    go.update(0.1);
    expect(go.events).toContain('carryOn');
    expect(go.race).toBeNull();
    expect(go.phase).toBe('drive');
    expect(go.p).toMatchObject({ driveMaxThrottle: 0.6, driveScareSpeed: 9, drivePauseChance: 0.3 });
    expect(go.time).toBe(0);
    expect(go.cruise).toBe(8);
  });

  it('after doughnuts, the ramp, showing off or a convoy she carries on or pulls up as the dice fall, and carrying on puts everything back', () => {
    const make = (roll) => {
      const d = finishing(false);
      d.race = null;
      d.doughnut = { centre: {}, radius: 5 };
      d.follow = () => null;
      d.quad.churn = 0.7;
      d.random = () => roll;
      d.between = (a, b) => a;
      d.p.keepRidingAfter = 0.3;
      d.p.driveForMin = 1e6;
      d.after = { ...d.after, driveForMin: 40, driveForMax: 60 };
      return d;
    };
    const on = make(0.1);
    on.endActivity();
    expect(on.events).toContain('carryOn');
    expect(on.doughnut).toBeNull();
    expect(on.follow).toBeNull();
    expect(on.quad.churn).toBe(0);
    expect(on.driveFor).toBe(40);
    const off = make(0.9);
    off.endActivity();
    expect(off.phase).toBe('stop');
    expect(off.stopReason).toBe('bored');
  });
});
