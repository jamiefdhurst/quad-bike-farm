import { describe, it, expect } from 'vitest';
import { Achievements, ACHIEVEMENTS, PLACES } from '../src/achievements/achievements.js';

const FLEET = ['red', 'blue', 'tractor', 'utv'];
const ride = (over = {}) => ({ id: 'red', seat: 'rider', speed: 5, airborne: false, tipped: false, yaw: 0, nearRamp: 100, running: true, girlsOnBoard: 0, driver: null, ...over });
const run = (a, seconds, snap, dt = 0.1) => {
  for (let t = 0; t < seconds; t += dt) a.update(dt, typeof snap === 'function' ? snap(t) : snap);
};

describe('achievements', () => {
  it('has unique ids and every test is a function', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(50);
    for (const a of ACHIEVEMENTS) expect(typeof a.test).toBe('function');
  });

  it('ticks off a ride only once you are moving, and tells the listener', () => {
    const a = new Achievements({ fleet: FLEET });
    const got = [];
    a.onUnlock((x) => got.push(x.id));
    run(a, 1, { riding: ride({ speed: 0 }) });
    expect(got).not.toContain('ride-red');
    run(a, 1, { riding: ride() });
    expect(got.filter((id) => id === 'ride-red')).toHaveLength(1);
  });

  it('leaves out achievements for vehicles that are not on the farm', () => {
    const a = new Achievements({ fleet: FLEET });
    const names = a.entries().filter((e) => e.available).map((e) => e.id);
    expect(names).toContain('ride-red');
    expect(names).not.toContain('ride-orange');
    expect(names).not.toContain('barn-find');
    expect(a.score().totalCount).toBe(names.length);
  });

  it('wants every vehicle on this farm for the full set', () => {
    const a = new Achievements({ fleet: ['red', 'blue'] });
    run(a, 1, { riding: ride({ id: 'red' }) });
    expect(a.unlocked.has('ride-all')).toBe(false);
    run(a, 1, { riding: ride({ id: 'blue' }) });
    expect(a.unlocked.has('ride-all')).toBe(true);
    expect(a.unlocked.has('ride-three')).toBe(false);
  });

  it('counts a ramp jump, a big one, and a clean landing only if you stay up', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 1.5, { riding: ride({ airborne: true, nearRamp: 5 }) });
    run(a, 0.5, { riding: ride({ nearRamp: 5 }) });
    expect(a.n('rampJumps')).toBe(1);
    expect(a.unlocked.has('big-air')).toBe(true);
    expect(a.unlocked.has('clean-landing')).toBe(false);
    run(a, 1.5, { riding: ride() });
    expect(a.unlocked.has('clean-landing')).toBe(true);
  });

  it('does not count air time away from the ramp, or a landing that tips', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 1, { riding: ride({ airborne: true, nearRamp: 80 }) });
    run(a, 0.3, { riding: ride() });
    expect(a.n('rampJumps')).toBe(0);
    run(a, 1, { riding: ride({ airborne: true, nearRamp: 3 }) });
    run(a, 0.3, { riding: ride({ tipped: true }) });
    run(a, 2, { riding: ride() });
    expect(a.n('rampJumps')).toBe(1);
    expect(a.n('rampClean')).toBe(0);
  });

  it('counts a doughnut after a full turn, not a gentle bend', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 10, (t) => ({ riding: ride({ yaw: Math.sin(t) * 0.5 }) }));
    expect(a.n('doughnuts')).toBe(0);
    run(a, 4, (t) => ({ riding: ride({ yaw: t * 2 }) }));
    expect(a.n('doughnuts')).toBeGreaterThanOrEqual(1);
  });

  it('does not count spinning on the spot as a doughnut', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 6, (t) => ({ riding: ride({ speed: 0.5, yaw: t * 2 }) }));
    expect(a.n('doughnuts')).toBe(0);
  });

  it('tracks passengers: driven by a girl, company, full load', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 25, { riding: ride({ seat: 'pillion', driver: 'amy' }) });
    expect(a.unlocked.has('passenger')).toBe(false);
    expect(a.unlocked.has('driven-amy')).toBe(true);
    expect(a.unlocked.has('driven-jess')).toBe(false);
    run(a, 35, { riding: ride({ girlsOnBoard: 1 }) });
    expect(a.unlocked.has('company')).toBe(true);
    expect(a.unlocked.has('full-load')).toBe(false);
    run(a, 20, { riding: ride({ girlsOnBoard: 2 }) });
    expect(a.unlocked.has('full-load')).toBe(true);
  });

  it('notes a bog, being freed, and how', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 1, { stuck: ['red'] });
    expect(a.n('bogged')).toBe(1);
    run(a, 1, { stuck: ['red'], pulling: [{ id: 'red', by: 'winch' }] });
    run(a, 0.2, { stuck: [] });
    expect(a.n('freed')).toBe(1);
    expect(a.n('winchedOut')).toBe(1);
    expect(a.n('chainedOut')).toBe(0);
  });

  it('counts rolling over once and righting after', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 3, { riding: ride({ tipped: true }), tippedIds: ['red'] });
    expect(a.n('rolled')).toBe(1);
    run(a, 0.2, { tippedIds: [] });
    expect(a.n('righted')).toBe(1);
  });

  it('wants all the quads running at once', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 1, { quadIds: ['red', 'blue', 'x'], running: ['red', 'blue'] });
    expect(a.unlocked.has('all-running')).toBe(false);
    run(a, 1, { quadIds: ['red', 'blue', 'x'], running: ['red', 'blue', 'x', 'utv'] });
    expect(a.unlocked.has('all-running')).toBe(true);
  });

  it('needs both girls to have favoured you, and every place for explorer', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 1, { favoured: ['amy'] });
    expect(a.unlocked.has('amy-likes')).toBe(true);
    expect(a.unlocked.has('both-like')).toBe(false);
    run(a, 1, { favoured: ['jess'] });
    expect(a.unlocked.has('both-like')).toBe(true);
    for (const p of PLACES.slice(0, -1)) run(a, 0.1, { places: [p] });
    expect(a.unlocked.has('explorer')).toBe(false);
    run(a, 0.1, { places: [PLACES.at(-1)] });
    expect(a.unlocked.has('explorer')).toBe(true);
  });

  it('washing counts seconds, events count with note, and the score adds up', () => {
    const a = new Achievements({ fleet: FLEET });
    run(a, 10, { washing: true });
    expect(a.unlocked.has('wash')).toBe(false);
    run(a, 6, { washing: true });
    expect(a.unlocked.has('wash')).toBe(true);
    a.note('bell');
    a.check();
    const s = a.score();
    expect(s.count).toBe(2);
    expect(s.points).toBe(2);
    expect(s.total).toBeGreaterThan(s.points);
  });
});

describe('places', () => {
  it('finds the places from where you stand', async () => {
    const { placesAt } = await import('../src/achievements/snapshot.js');
    const { LAYOUT } = await import('../src/world/layout.js');
    const h = LAYOUT.hill;
    expect(placesAt({ x: h.lane.x, z: h.stream.z }, LAYOUT)).toContain('ford');
    expect(placesAt({ x: -30, z: 170 }, LAYOUT)).toContain('pasture');
    expect(placesAt({ x: -80, z: 170 }, LAYOUT)).toEqual(expect.arrayContaining(['pasture', 'wood']));
    expect(placesAt({ x: LAYOUT.dutchBarn.x, z: LAYOUT.dutchBarn.z }, LAYOUT)).toContain('dutchBarn');
    expect(placesAt({ x: LAYOUT.fieldShed.x, z: LAYOUT.fieldShed.z }, LAYOUT)).toContain('fieldShed');
    expect(placesAt({ x: 79, z: LAYOUT.road.z }, LAYOUT)).toContain('cattleGrid');
    expect(placesAt({ x: LAYOUT.road.pad.x, z: LAYOUT.road.z }, LAYOUT)).toContain('farEnd');
    expect(placesAt({ x: 0, z: 0 }, LAYOUT)).toEqual([]);
  });
});
