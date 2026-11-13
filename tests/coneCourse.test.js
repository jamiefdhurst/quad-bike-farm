import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { climbRoute, crossesGate } from '../src/npc/hillClimb.js';
import { ConeCourse, ConeField, CourseRun, coneGates, coneSpots, knockRoute, DEFAULT_CONE_PARAMS as P, CONE_PARAM_RANGES } from '../src/npc/coneCourse.js';
import { AMY_CONE_LINES, JESS_CONE_LINES, CONE_LINE_KEYS } from '../src/npc/coneCourseLines.js';
import { RECORD_KINDS } from '../src/world/records.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const course = { x: 0, z: 0, yaw: 0, lead: 5, gates: 4, spacing: 4, swing: 2, gateHalf: 1.5, tail: 5 };
const gates = coneGates(course);

/** Rides the weaving line through every gate, at `speed`, returning the events from the run. */
function ride(run, points, speed = 5, dt = 0.1) {
  const out = [];
  let [x, z] = points[0];
  run.update(dt, { x, z });
  for (const [px, pz] of points.slice(1)) {
    const d = Math.hypot(px - x, pz - z);
    const n = Math.max(1, Math.ceil(d / (speed * dt)));
    for (let i = 1; i <= n; i++) {
      const e = run.update(dt, { x: x + ((px - x) * i) / n, z: z + ((pz - z) * i) / n });
      if (e) out.push(e);
    }
    [x, z] = [px, pz];
  }
  return out;
}
const weave = [[0, -3], ...gates.map((g) => [g.x, g.z]), [0, 25]];

describe('the cone course gates', () => {
  it('every tunable has a range', () => {
    expect(Object.keys(CONE_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });

  it('start, the slalom gates swinging either side in turn, and the finish', () => {
    expect(gates).toHaveLength(course.gates + 2);
    expect(gates.slice(1, -1).map((g) => Math.sign(g.x))).toEqual([1, -1, 1, -1]);
    expect(gates[0].z).toBe(0);
    expect(gates.at(-1).z).toBe(course.lead + 3 * course.spacing + course.tail);
  });

  it('a cone either side of each gap, and two pairs at the start and the finish', () => {
    const spots = coneSpots(gates);
    expect(spots).toHaveLength(4 * 2 + 2 * 4);
    for (const s of spots.filter((o) => o.gate === 2)) expect(Math.hypot(s.x - gates[2].x, s.z - gates[2].z)).toBeCloseTo(gates[2].half + 0.5);
  });

  it('a step through a gap counts, one through a cone does not', () => {
    const g = gates[1];
    expect(crossesGate(g, { x: g.x, z: g.z - 1 }, { x: g.x, z: g.z + 1 })).toBe(true);
    expect(crossesGate(g, { x: g.x + 2, z: g.z - 1 }, { x: g.x + 2, z: g.z + 1 })).toBe(false);
  });
});

describe('a run with penalties', () => {
  it('times the weave from the start to the finish', () => {
    const run = new CourseRun(gates, P);
    const types = ride(run, weave).map((e) => e);
    expect(types.filter((e) => e === 'gate')).toHaveLength(gates.length - 2);
    expect(types.at(-1)).toBe('finish');
    expect(run.result()).toBeCloseTo(run.time);
  });

  it('adds two seconds for each cone knocked, only while the clock runs', () => {
    const run = new CourseRun(gates, P);
    run.hit(); // before the start: nothing
    ride(run, weave.slice(0, 3));
    run.hit();
    run.hit();
    expect(run.cones).toBe(2);
    expect(run.result()).toBeCloseTo(run.time + 2 * P.conePenalty);
  });

  it('a gate skipped costs a penalty and the run goes on', () => {
    const run = new CourseRun(gates, P);
    const skipping = weave.filter((_, i) => i !== 2); // through every gate but the first slalom gate
    const events = ride(run, skipping);
    expect(events.at(-1)).toBe('finish');
    expect(run.misses).toBe(1);
    expect(run.result()).toBeCloseTo(run.time + P.missPenalty);
  });

  it('is out when it takes too long', () => {
    const run = new CourseRun(gates, { ...P, timeout: 5 });
    ride(run, weave.slice(0, 2));
    let e = null;
    for (let i = 0; i < 80 && !e; i++) e = run.update(0.1, { x: 0, z: 1 });
    expect(e).toBe('out');
  });
});

describe('the cones falling over', () => {
  const field = () => new ConeField([{ x: 0, z: 0 }, { x: 5, z: 0 }], P);

  it('a quad going through one sends it over away from itself', () => {
    const f = field();
    const hits = f.hit([{ id: 'you', x: 0, z: -0.5, speed: 4 }]);
    expect(hits).toEqual([{ index: 0, id: 'you' }]);
    expect(f.cones[0]).toMatchObject({ down: true });
    expect(f.cones[0].dz).toBeGreaterThan(0.9);
    expect(f.downCount).toBe(1);
  });

  it('only a thing that is moving knocks one, and only one near enough', () => {
    const f = field();
    expect(f.hit([{ id: 'you', x: 0, z: -0.5, speed: 0.1 }])).toEqual([]);
    expect(f.hit([{ id: 'you', x: 0, z: -2, speed: 5 }])).toEqual([]);
    expect(f.hit([{ id: 'amy', x: 5.3, z: 0, speed: 1.4, foot: true }])).toEqual([{ index: 1, id: 'amy' }]);
  });

  it('a cone that is already down is not knocked again', () => {
    const f = field();
    f.hit([{ id: 'you', x: 0, z: -0.5, speed: 4 }]);
    expect(f.hit([{ id: 'amy', x: 0, z: -0.5, speed: 4 }])).toEqual([]);
  });

  it('falls over a third of a second, and Amy stands them up after the tidy delay', () => {
    const f = field();
    f.hit([{ id: 'you', x: 0, z: 0, speed: 4 }]);
    f.update(0.2);
    expect(f.cones[0].fall).toBeCloseTo(0.6);
    f.tidySoon(5);
    expect(f.update(4)).toBe(false);
    expect(f.downCount).toBe(1);
    expect(f.update(1.5)).toBe(true);
    expect(f.downCount).toBe(0);
    f.update(1);
    expect(f.cones[0].fall).toBe(0);
  });

  it('has nothing to tidy if none are down', () => {
    const f = field();
    f.tidySoon(1);
    expect(f.update(2)).toBe(false);
  });
});

describe('the girls on the course', () => {
  const girls = [{ id: 'amy', free: true }, { id: 'jess', free: true }];
  const ctx = { girls, options: { amy: ['farm300'], jess: ['bruin'] }, claims: {}, busy: false, dark: false };
  const ready = () => {
    const c = new ConeCourse(gates, { ...P }, () => 0);
    c.update(P.startAfter + 1, { at: {} });
    return c;
  };

  it('is an offer of its own kind, which the chooser knows', () => {
    const c = ready();
    const offers = c.offers(ctx);
    expect(offers.map((o) => o.key)).toEqual(['cones', 'cones']);
    expect(OFFER_KINDS.cones).toBeTruthy();
    expect(c.take(offers[0]).type).toBe('cones');
  });

  it('times a girl with the penalties, and counts the cones she knocks', () => {
    const c = ready();
    const f = c.take(c.offers(ctx)[1]);
    c.grid(f.girl);
    c.update(P.leaveAfter + 0.1, { at: {} });
    const at = (x, z) => ({ at: { [f.girl]: { x, z, riding: true, running: true } } });
    c.update(0.1, at(0, -2));
    c.update(0.1, at(0, 0.5));
    c.hit(f.girl);
    c.hit(f.girl);
    let finish = null;
    for (const [x, z] of weave.slice(2)) finish = c.update(0.5, at(x, z)).find((o) => o.type === 'finish') ?? finish;
    expect(finish.cones).toBe(2);
    expect(finish.time).toBeGreaterThan(2 * P.conePenalty);
  });

  it('Jess sometimes means to knock them, and Amy never does', () => {
    expect(new ConeCourse(gates, { ...P, jessKnockChance: 1 }, () => 0).knocksOnPurpose('jess')).toBe(true);
    expect(new ConeCourse(gates, { ...P, jessKnockChance: 0 }, () => 0).knocksOnPurpose('jess')).toBe(false);
    expect(new ConeCourse(gates, { ...P, jessKnockChance: 1 }, () => 0).knocksOnPurpose('amy')).toBe(false);
  });

  it('her knocking route still goes through every gate', () => {
    const route = climbRoute(gates, P, 5);
    const aimed = knockRoute(gates, route);
    expect(aimed).toHaveLength(route.length);
    for (let i = 2; i < route.length - 1; i++) {
      const g = gates[i - 2];
      const along = (aimed[i].x - g.x) * -g.tz + (aimed[i].z - g.z) * g.tx;
      expect(Math.abs(along), `gate ${i - 2}`).toBeLessThanOrEqual(g.half);
    }
    // The start and the finish stay in the middle; the slalom gates move to an edge.
    expect(aimed[2]).toEqual(route[2]);
    expect(Math.hypot(aimed[3].x - route[3].x, aimed[3].z - route[3].z)).toBeGreaterThan(1);
  });
});

describe('the real course', () => {
  const real = coneGates(LAYOUT.coneCourse);
  const track = new Track(LAYOUT.trackPoints);
  const heights = createTerrainHeight(LAYOUT, track);

  it('is clear of the track, bogs, puddles and hedges, and the ground is gentle, from the run-up to the run-off', () => {
    const c = LAYOUT.coneCourse;
    const f = { x: Math.sin(c.yaw), z: Math.cos(c.yaw) };
    const total = c.lead + (c.gates - 1) * c.spacing + c.tail;
    let lo = Infinity;
    let hi = -Infinity;
    for (let along = -8; along <= total + 3; along += 2) {
      for (let across = -5; across <= 5; across += 2) {
        const x = c.x + f.x * along + Math.cos(c.yaw) * across;
        const z = c.z + f.z * along - Math.sin(c.yaw) * across;
        expect(Math.abs(x) < LAYOUT.fieldHalf - 6 && Math.abs(z) < LAYOUT.fieldHalf - 6, `${along},${across} inside`).toBe(true);
        expect(heights.bogAt(x, z), `bog ${along},${across}`).toBe(0);
        expect(heights.puddleAt(x, z), `puddle ${along},${across}`).toBe(0);
        expect(track.distanceTo(x, z), `track ${along},${across}`).toBeGreaterThan(LAYOUT.trackHalfWidth + 2);
        for (const [bx, bz] of LAYOUT.strawBaleSpots) expect(Math.hypot(bx - x, bz - z), `bale ${bx},${bz}`).toBeGreaterThan(3);
        const h = heights.heightAt(x, z);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    expect(hi - lo).toBeLessThan(2); // a slope of about 4%: gentle for a quad, and it needs no levelling
    expect(real).toHaveLength(c.gates + 2);
  });

  it('keeps clear of the drag strip and the jump', () => {
    const s = LAYOUT.dragStrip;
    for (const g of real) {
      const dx = g.x - s.x;
      const dz = g.z - s.z;
      const along = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
      const across = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
      expect(along < -8 || along > s.length + s.runOff + 4 || Math.abs(across) > s.width / 2 + 8).toBe(true);
      expect(Math.hypot(g.x - LAYOUT.jumpRamp.x, g.z - LAYOUT.jumpRamp.z)).toBeGreaterThan(25);
    }
  });
});

describe('cone course lines and records', () => {
  it('every key has lines for both girls, without dashes', () => {
    for (const k of CONE_LINE_KEYS) {
      expect(AMY_CONE_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_CONE_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_CONE_LINES[k].lines, ...JESS_CONE_LINES[k]]) expect(l, l).not.toMatch(/—|–/);
    }
  });

  it('the board keeps the score, lower being better', () => {
    expect(RECORD_KINDS.cones.better).toBe('lower');
  });
});
