import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createHill } from '../src/world/hill.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { HillClimb, ClimbRun, climbGates, climbRoute, crossesGate, DEFAULT_CLIMB_PARAMS, CLIMB_PARAM_RANGES } from '../src/npc/hillClimb.js';
import { AMY_CLIMB_LINES, JESS_CLIMB_LINES, CLIMB_LINE_KEYS } from '../src/npc/hillClimbLines.js';

const P = { ...DEFAULT_CLIMB_PARAMS };
const gates = climbGates({ points: [[0, 0], [0, 20], [0, 40], [0, 60]], gateHalf: 5 });

/** Drives straight up the course at `speed`, returning the events (as [type, id] pairs) and the final run. */
function drive(run, { x = 0, from = -4, to = 64, speed = 10, dt = 0.1, status } = {}) {
  const out = [];
  for (let z = from; z <= to; z += speed * dt) {
    const e = run.update(dt, { x, z }, status);
    if (e) out.push(e);
  }
  return out;
}

describe('hill climb gates', () => {
  it('every tunable has a range', () => {
    expect(Object.keys(CLIMB_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_CLIMB_PARAMS).sort());
  });

  it('faces each gate along the course', () => {
    expect(gates).toHaveLength(4);
    for (const g of gates) expect([g.tx, g.tz]).toEqual([0, 1]);
  });

  it('counts a step through the gate, between the cones, going the right way', () => {
    const g = gates[1];
    expect(crossesGate(g, { x: 0, z: 19 }, { x: 0, z: 21 })).toBe(true);
    expect(crossesGate(g, { x: 4, z: 19 }, { x: 4, z: 21 })).toBe(true);
    expect(crossesGate(g, { x: 6, z: 19 }, { x: 6, z: 21 })).toBe(false); // outside the cones
    expect(crossesGate(g, { x: 0, z: 21 }, { x: 0, z: 19 })).toBe(false); // backwards
    expect(crossesGate(g, { x: 0, z: 10 }, { x: 0, z: 15 })).toBe(false); // not there yet
  });

  it('puts the real course on the gentler ground, inside the pasture and clear of the wood and the stream', () => {
    const real = climbGates(LAYOUT.hill.climb);
    const hill = createHill(LAYOUT);
    const h = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints)).heightAt;
    for (const g of real) {
      for (const f of [-1, 0, 1]) {
        const x = g.x - g.tz * g.half * f;
        const z = g.z + g.tx * g.half * f;
        expect(hill.inPasture(x, z), `${x},${z}`).toBe(true);
        expect(hill.inWood(x, z)).toBe(false);
        expect(hill.waterAt(x, z)).toBeLessThanOrEqual(0);
      }
    }
    expect(real[0].z).toBeGreaterThan(hill.farEdge(real[0].x));
    // It climbs from the start to the finish, never steeper than a quad can take.
    expect(h(real[3].x, real[3].z) - h(real[0].x, real[0].z)).toBeGreaterThan(10);
    for (let i = 0; i < real.length - 1; i++) {
      const a = real[i];
      const b = real[i + 1];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        const slope = Math.abs(h(a.x + (b.x - a.x) * t1, a.z + (b.z - a.z) * t1) - h(a.x + (b.x - a.x) * t0, a.z + (b.z - a.z) * t0)) / (Math.hypot(b.x - a.x, b.z - a.z) / n);
        expect(slope).toBeLessThan(0.6);
      }
    }
  });
});

describe('a climb run', () => {
  it('starts at the start cones, passes the gates in order and finishes', () => {
    const run = new ClimbRun(gates, P);
    expect(drive(run)).toEqual(['start', 'gate', 'gate', 'finish']);
    expect(run.state).toBe('finished');
    expect(run.time).toBeCloseTo(6, 0); // 60 m at 10 m/s
  });

  it('does not run the clock before the start', () => {
    const run = new ClimbRun(gates, P);
    for (let i = 0; i < 100; i++) run.update(0.1, { x: 0, z: -20 });
    expect(run.state).toBe('waiting');
    expect(run.time).toBe(0);
  });

  it('cannot cut a gate: going round outside the cones counts for nothing', () => {
    const run = new ClimbRun(gates, P);
    run.update(0.1, { x: 0, z: -1 });
    run.update(0.1, { x: 0, z: 1 }); // start
    run.update(0.1, { x: 9, z: 19 });
    expect(run.update(0.1, { x: 9, z: 21 })).toBe(null); // round the cones
    expect(run.next).toBe(1);
  });

  it('cannot skip a gate', () => {
    const run = new ClimbRun(gates, P);
    run.update(0.1, { x: 0, z: -1 });
    run.update(0.1, { x: 0, z: 1 });
    run.update(0.1, { x: 12, z: 10 });
    run.update(0.1, { x: 12, z: 38 }); // round the first gate's cones
    expect(run.update(0.1, { x: 0, z: 41 })).toBe(null); // through the second without the first
    expect(run.state).toBe('running');
    expect(run.next).toBe(1);
  });

  it('is out when off the quad or stalled for too long, and when it takes too long', () => {
    const run = new ClimbRun(gates, P);
    run.update(0.1, { x: 0, z: -1 });
    run.update(0.1, { x: 0, z: 1 });
    let e = null;
    for (let t = 0; t < P.outAfter + 1 && !e; t += 0.1) e = run.update(0.1, { x: 0, z: 5 }, { riding: true, running: false });
    expect(e).toBe('out');
    const slow = new ClimbRun(gates, P);
    slow.update(0.1, { x: 0, z: -1 });
    slow.update(0.1, { x: 0, z: 1 });
    let f = null;
    for (let t = 0; t < P.timeout + 1 && !f; t += 1) f = slow.update(1, { x: 0, z: 5 });
    expect(f).toBe('out');
  });

  it('a stall that is cured in time is forgiven', () => {
    const run = new ClimbRun(gates, P);
    run.update(0.1, { x: 0, z: -1 });
    run.update(0.1, { x: 0, z: 1 });
    for (let t = 0; t < 5; t += 0.1) run.update(0.1, { x: 0, z: 5 }, { riding: true, running: false });
    run.update(0.1, { x: 0, z: 6 }, { riding: true, running: true });
    expect(run.idle).toBe(0);
    expect(run.state).toBe('running');
  });
});

describe('climbing for you', () => {
  const at = (z) => ({ you: { x: 0, z, riding: true, running: true } });

  it('only times you once you have asked', () => {
    const c = new HillClimb(gates, P);
    c.update(0.1, { at: at(-1) });
    expect(c.update(0.1, { at: at(1) })).toEqual([]);
    c.arm();
    c.update(0.1, { at: at(-1) });
    expect(c.update(0.1, { at: at(1) }).map((e) => e.type)).toEqual(['start']);
  });

  it('forgets your ask after a while', () => {
    const c = new HillClimb(gates, P);
    c.arm();
    c.update(P.armFor + 1, { at: at(-30) });
    expect(c.youArmed).toBe(false);
    c.update(0.1, { at: at(-1) });
    expect(c.update(0.1, { at: at(1) })).toEqual([]);
  });

  it('reports the gates and the finish with the time, and counts it', () => {
    const c = new HillClimb(gates, P);
    c.arm();
    const events = [];
    for (let z = -4; z <= 64; z += 1) events.push(...c.update(0.1, { at: at(z) }));
    expect(events.map((e) => e.type)).toEqual(['start', 'gate', 'gate', 'finish']);
    expect(events.at(-1).time).toBeGreaterThan(0);
    expect(c.tally.you).toBe(1);
  });
});

describe('a girl climbing', () => {
  const ctx = (extra = {}) => ({ busy: false, dark: false, girls: [{ id: 'amy', free: true }, { id: 'jess', free: true }], options: { amy: ['farm300'], jess: ['bruin'] }, claims: {}, ...extra });
  const ready = () => {
    const c = new HillClimb(gates, P, () => 0.1);
    c.update(P.startAfter + 1, { at: {} });
    return c;
  };

  it('offers nothing early, after another, or while busy or dark', () => {
    const early = new HillClimb(gates, P);
    expect(early.offers(ctx())).toEqual([]);
    expect(ready().offers(ctx({ busy: true }))).toEqual([]);
    expect(ready().offers(ctx({ dark: true }))).toEqual([]);
    const c = ready();
    c.take(c.offers(ctx())[0]);
    c.end();
    expect(c.offers(ctx())).toEqual([]);
  });

  it('Jess is keener than Amy, and a girl who is not free is not offered', () => {
    const c = ready();
    const o = c.offers(ctx());
    expect(o.find((x) => x.girl === 'jess').weight).toBeGreaterThan(o.find((x) => x.girl === 'amy').weight);
    expect(c.offers(ctx({ girls: [{ id: 'amy', free: false }, { id: 'jess', free: true }] })).map((x) => x.girl)).toEqual(['jess']);
  });

  it('can be forced at once', () => {
    const c = new HillClimb(gates, P, () => 0.1);
    c.forced = true;
    expect(c.offers(ctx()).length).toBe(2);
  });

  it('gathers, waits, goes, and times her over the gates', () => {
    const c = ready();
    const e = c.take(c.offers(ctx())[0]);
    expect(e.type).toBe('climb');
    expect(c.go()).toBe(false);
    c.grid(e.girl);
    expect(c.phase).toBe('wait');
    c.update(P.leaveAfter + 0.1, { at: { [e.girl]: { x: 0, z: -3, riding: true, running: true } } });
    expect(c.go()).toBe(true);
    const events = [];
    for (let z = -4; z <= 64; z += 1) events.push(...c.update(0.1, { at: { [e.girl]: { x: 0, z, riding: true, running: true } } }));
    expect(events.map((x) => x.type)).toEqual(['start', 'gate', 'gate', 'finish']);
    expect(c.active).toBe(false);
  });

  it('is out when her quad dies on the bank, and then it is over', () => {
    const c = ready();
    const e = c.take(c.offers(ctx())[0]);
    c.grid(e.girl);
    c.update(P.leaveAfter + 0.1, { at: {} });
    c.update(0.1, { at: { [e.girl]: { x: 0, z: -1, riding: true, running: true } } });
    c.update(0.1, { at: { [e.girl]: { x: 0, z: 1, riding: true, running: true } } });
    c.abort(e.girl);
    const events = c.update(0.1, { at: { [e.girl]: { x: 0, z: 2, riding: true, running: true } } });
    expect(events.some((x) => x.type === 'out' && x.id === e.girl)).toBe(true);
    expect(c.active).toBe(false);
  });

  it('gives up if she never reaches the start', () => {
    const c = ready();
    c.take(c.offers(ctx())[0]);
    const events = c.update(P.gatherTimeout + 1, { at: {} });
    expect(events.map((x) => x.type)).toEqual(['cancel']);
    expect(c.active).toBe(false);
  });

  it('is called off by the bell', () => {
    const c = ready();
    c.take(c.offers(ctx())[0]);
    c.arm();
    c.stand();
    expect(c.active).toBe(false);
    expect(c.youArmed).toBe(false);
  });

  it('her route waits behind the start, goes through every gate and on past the finish', () => {
    const route = climbRoute(gates, P);
    expect(route[1].z).toBeCloseTo(-P.gridBack, 5);
    expect(route.slice(2, 6).map((r) => r.z)).toEqual([0, 20, 40, 60]);
    expect(route.at(-1).z).toBeGreaterThan(60);
  });
});

describe('climb lines', () => {
  it('every key has lines for both girls, without dashes', () => {
    for (const k of CLIMB_LINE_KEYS) {
      expect(AMY_CLIMB_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_CLIMB_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_CLIMB_LINES[k].lines, ...JESS_CLIMB_LINES[k]]) expect(l, l).not.toMatch(/—|–/);
    }
  });
});
