import { describe, it, expect } from 'vitest';
import { JumpRun, JumpWatch, rateLanding, rampFrame, rampPoint, DEFAULT_JUMP_PARAMS as P } from '../src/npc/jumps.js';
import { JESS_JUMP_LINES, AMY_JUMP_LINES, JUMP_LINE_KEYS } from '../src/npc/jumpLines.js';
import { boredOdds, BORED_NORM } from '../src/npc/boredom.js';
import { choose } from '../src/npc/chooser.js';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';

const ramp = { x: 0, z: 0, yaw: Math.PI / 2, length: 7, width: 3.2, height: 1.4 }; // pointing along +x

describe('the ramp frame', () => {
  it('measures along the way it points and across it', () => {
    expect(rampFrame(ramp, { x: -10, z: 2 })).toEqual({ along: expect.closeTo(-10, 6), across: expect.closeTo(-2, 6) });
    const p = rampPoint(ramp, 5, 1);
    expect(rampFrame(ramp, p).along).toBeCloseTo(5, 6);
    expect(rampFrame(ramp, p).across).toBeCloseTo(1, 6);
  });
});

describe('rating a landing', () => {
  const clean = { air: 0.9, upY: 0.99, impact: 3, tipped: false };
  it('great for a long clean one, good for a short clean one', () => {
    expect(rateLanding(clean)).toBe('great');
    expect(rateLanding({ ...clean, air: 0.4 })).toBe('good');
  });
  it('rough for a hard or crooked landing, a bail for a roll, tame for barely leaving the ground', () => {
    expect(rateLanding({ ...clean, impact: 9 })).toBe('rough');
    expect(rateLanding({ ...clean, upY: 0.8 })).toBe('rough');
    expect(rateLanding({ ...clean, tipped: true })).toBe('bail');
    expect(rateLanding({ ...clean, air: 0.1 })).toBe('tame');
  });
});

// A little kinematic rider: goes where it is steered, at the speed it is told, and leaves the ground at the lip.
function ride(run, { start, yaw = ramp.yaw, v = 0, seconds = 120, tipOnLand = false } = {}) {
  let { x, z } = start;
  let y = 0;
  let vy = 0;
  let airborne = false;
  let air = 0;
  const events = [];
  const phases = new Set();
  for (let t = 0; t < seconds; t += 0.05) {
    const r = run.step(0.05, { pos: { x, z }, yaw, speed: v, airborne, vy, upY: tipOnLand && air > 0 && !airborne ? 0.2 : 0.99, tipped: tipOnLand && air > 0 && !airborne }, 1.4);
    events.push(...r.events);
    phases.add(run.phase);
    if (r.done) return { events, phases, done: true, t };
    const target = r.brake ? 0 : r.targetSpeed;
    v += Math.max(-8 * 0.05, Math.min(3 * 0.05, target - v));
    if (run.phase === 'air' || run.phase === 'landing') v = Math.max(v, 0);
    yaw += r.steer * 0.05 * (v / 3);
    x += Math.sin(yaw) * v * 0.05;
    z += Math.cos(yaw) * v * 0.05;
    const f = rampFrame(ramp, { x, z });
    if (!airborne && run.phase === 'run' && f.along >= ramp.length) {
      airborne = true;
      vy = 2.5;
      air = 0;
    }
    if (airborne) {
      air += 0.05;
      vy -= 9.81 * 0.05;
      y += vy * 0.05;
      if (air > 0.2 && y <= 0) {
        airborne = false;
        y = 0;
      }
    }
  }
  return { events, phases, done: false, t: seconds };
}

describe('her goes at the ramp', () => {
  it('rides the run-up, takes off, lands, is rated and pulls up, then is done after her goes', () => {
    const run = new JumpRun(ramp, { ...P, goesMin: 1, goesMax: 1 }, () => 0);
    const r = ride(run, { start: { x: -30, z: 6 }, yaw: 0 });
    expect(r.done).toBe(true);
    expect(r.events).toContain('jumpRun');
    expect(r.events).toContain('jumpAir');
    const rated = r.events.filter((e) => e.type === 'rated');
    expect(rated).toHaveLength(1);
    expect(['great', 'good']).toContain(rated[0].rating);
    for (const phase of ['approach', 'run', 'air', 'landing', 'settle', 'pause']) expect(r.phases.has(phase), phase).toBe(true);
  });

  it('goes back for another go until it has had them all', () => {
    const run = new JumpRun(ramp, { ...P, goesMin: 3, goesMax: 3 }, () => 0);
    const r = ride(run, { start: { x: -25, z: 0 } });
    expect(r.events.filter((e) => e.type === 'rated')).toHaveLength(3);
    expect(run.results).toHaveLength(3);
  });

  it('rolling it ends her goes with a bail', () => {
    const run = new JumpRun(ramp, { ...P, goesMin: 3, goesMax: 3 }, () => 0);
    const r = ride(run, { start: { x: -25, z: 0 }, tipOnLand: true });
    expect(r.done).toBe(true);
    expect(run.lastRating).toBe('bail');
  });

  it('comes at it from the side: turns for it from the run-up point, and gives it up and goes round rather than hit it crooked', () => {
    const run = new JumpRun(ramp, { ...P }, () => 0);
    const near = { pos: { x: -4, z: 3 }, yaw: 0.2, speed: 8, airborne: false, vy: 0, upY: 1, tipped: false };
    run.phase = 'run';
    const r = run.step(0.05, near);
    expect(r.events).toContain('jumpAbort');
    expect(run.phase).toBe('approach');
  });

  it('steers back to the centre line on the run', () => {
    const run = new JumpRun(ramp, { ...P }, () => 0);
    run.phase = 'run';
    const left = run.step(0.05, { pos: { x: -16, z: 1.5 }, yaw: ramp.yaw, speed: 8, airborne: false, vy: 0, upY: 1, tipped: false });
    const right = run.step(0.05, { pos: { x: -16, z: -1.5 }, yaw: ramp.yaw, speed: 8, airborne: false, vy: 0, upY: 1, tipped: false });
    expect(Math.sign(left.steer)).toBe(-Math.sign(right.steer));
    expect(left.targetSpeed).toBe(P.runSpeed);
  });
});

describe('the other girl watching', () => {
  const girls = (o = {}) => [{ id: 'jess', free: false, distance: 0 }, { id: 'amy', free: true, distance: 12, ...o }];
  it('says what she thought a few seconds after a landing, if she can see it', () => {
    const w = new JumpWatch({ ...P }, () => 0);
    w.landed('jess', 'great');
    expect(w.update(1, { jumper: 'jess', girls: girls() })).toEqual([]);
    expect(w.update(P.rateGap, { jumper: 'jess', girls: girls() })).toEqual([{ type: 'rate', girl: 'amy', jumper: 'jess', rating: 'great' }]);
    const far = new JumpWatch({ ...P }, () => 0);
    far.landed('jess', 'good');
    expect(far.update(P.rateGap + 1, { jumper: 'jess', girls: girls({ distance: 90 }) })).toEqual([]);
  });

  it('keeps a tally of each girl\'s jumps, great ones and bails', () => {
    const w = new JumpWatch({ ...P }, () => 0);
    for (const r of ['great', 'good', 'bail']) w.landed('jess', r);
    expect(w.score.jess).toEqual({ jumps: 3, great: 1, bails: 1 });
  });

  it('then has a turn, once, if the dice say so, after the first girl is done', () => {
    const w = new JumpWatch({ ...P }, () => 0);
    w.update(1, { jumper: 'jess', girls: girls() });
    expect(w.update(1, { jumper: null, girls: girls() })).toEqual([]);
    expect(w.update(P.turnAfter, { jumper: null, girls: girls() })).toEqual([{ type: 'turn', girl: 'amy' }]);
    expect(w.update(10, { jumper: null, girls: girls() })).toEqual([]);
    const no = new JumpWatch({ ...P }, () => 0.99);
    no.update(1, { jumper: 'jess', girls: girls() });
    no.update(1, { jumper: null, girls: girls() });
    expect(no.update(P.turnAfter, { jumper: null, girls: girls() })).toEqual([]);
  });
});

/** What the chooser picks for a girl bored through and through, offered these (her odds as weights, no whim). */
const pickOf = (p, kinds) => {
  const odds = boredOdds(p);
  const offers = kinds.map((key) => ({ key, weight: odds[key] / BORED_NORM })).filter((o) => o.weight > 0);
  return choose({ purpose: 1, excitement: 0.5 }, offers, { ...p, chooseWhim: 0, chooseMin: 0 }).pick?.key;
};

describe('deciding to, and what they say', () => {
  it('only a girl with a chance for it picks it, and only when there is a clear ramp', () => {
    const base = { boredMountChance: 0, boredStartChance: 0, boredDriveChance: 0, boredJumpChance: 1 };
    expect(pickOf(base, ['jumps', 'wander'])).toBe('jumps');
    expect(pickOf(base, ['wander'])).toBe('wander');
    expect(pickOf({ ...base, boredJumpChance: 0 }, ['jumps', 'wander'])).toBe('wander');
  });

  it('both have a line for everything, and never call you he, she or they', () => {
    for (const k of JUMP_LINE_KEYS) {
      expect(AMY_JUMP_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_JUMP_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_JUMP_LINES[k].lines, ...JESS_JUMP_LINES[k]]) expect(l, l).not.toMatch(/—|–/);
    }
  });
});

describe('where the ramp stands', () => {
  const track = new Track(LAYOUT.trackPoints);
  const heights = createTerrainHeight(LAYOUT, track);
  const r = LAYOUT.jumpRamp;

  it('has level ground for the run-up and the landing, clear of the track, bogs and puddles, inside the hedges', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let along = -P.runUp - 4; along <= r.length + 24; along += 2) {
      for (const across of [-4, 0, 4]) {
        const pt = rampPoint(r, along, across);
        expect(Math.abs(pt.x) < LAYOUT.fieldHalf - 8 && Math.abs(pt.z) < LAYOUT.fieldHalf - 8, `${along},${across} inside`).toBe(true);
        expect(heights.bogAt(pt.x, pt.z), `bog at ${along},${across}`).toBe(0);
        expect(heights.puddleAt(pt.x, pt.z), `puddle at ${along},${across}`).toBe(0);
        const h = heights.heightAt(pt.x, pt.z);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    expect(hi - lo).toBeLessThan(0.5);
  });

  it('stays clear of the straw bales', () => {
    for (const [x, z] of LAYOUT.strawBaleSpots) {
      const f = rampFrame(r, { x, z });
      expect(f.along < -P.runUp - 4 || f.along > r.length + 24 || Math.abs(f.across) > 5, `bale ${x},${z}`).toBe(true);
    }
  });
});
