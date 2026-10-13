import { describe, it, expect } from 'vitest';
import { Bonfire, DEFAULT_BONFIRE_PARAMS as P, BONFIRE_PARAM_RANGES, logSeats } from '../src/world/bonfire.js';
import { LAYOUT } from '../src/world/layout.js';
import { spawnKeepOut } from '../src/world/spawns.js';

const dry = { rain: 0, wind: 2 };
const lit = () => {
  const f = new Bonfire({ ...P });
  f.buildAll();
  f.light();
  return f;
};
const run = (f, seconds, w = dry) => {
  const ev = [];
  for (let i = 0; i < seconds * 10; i++) ev.push(...f.update(0.1, w));
  return ev;
};

describe('the bonfire', () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) expect(BONFIRE_PARAM_RANGES[k], k).toBeTruthy();
  });

  it('needs the whole pile before it can be lit', () => {
    const f = new Bonfire({ ...P });
    expect(f.canLight()).toBe(false);
    for (let i = 0; i < P.heapsNeeded - 1; i++) f.addHeap();
    expect(f.canLight()).toBe(false);
    expect(f.addHeap()).toBe(true);
    expect(f.built).toBe(true);
    expect(f.addHeap()).toBe(false); // the pile is made
    expect(f.canLight()).toBe(true);
  });

  it('will not light in the rain', () => {
    const f = new Bonfire({ ...P });
    f.buildAll();
    expect(f.light(P.rainOut + 0.1)).toBe(false);
    expect(f.light(0)).toBe(true);
  });

  it('grows to a blaze, burns for its time and dies to ash', () => {
    const f = lit();
    run(f, 1);
    expect(f.intensity).toBeLessThan(0.1);
    run(f, P.growSeconds);
    expect(f.intensity).toBe(1);
    expect(f.blazing).toBe(true);
    const ev = run(f, P.burnSeconds + P.dieSeconds + 5);
    expect(ev).toEqual([{ type: 'out', why: 'burntOut' }]);
    expect(f.state).toBe('ash');
    expect(f.intensity).toBe(0);
  });

  it('dims as it dies down', () => {
    const f = lit();
    run(f, P.burnSeconds + P.dieSeconds / 2);
    expect(f.intensity).toBeGreaterThan(0.3);
    expect(f.intensity).toBeLessThan(0.7);
  });

  it('goes out in the rain, and burns down quicker and smokier when it is only damp', () => {
    const damp = lit();
    run(damp, P.growSeconds + 100, { rain: P.rainDamp + 0.05, wind: 2 });
    expect(damp.damp).toBe(true);
    expect(damp.smoke).toBeGreaterThan(lit().smoke);
    const dryOne = lit();
    run(dryOne, P.growSeconds + 100);
    expect(damp.fuel).toBeLessThan(dryOne.fuel);
    const ev = run(damp, 1, { rain: P.rainOut + 0.1, wind: 2 });
    expect(ev).toEqual([{ type: 'out', why: 'rain' }]);
  });

  it('is blown out by a gale only before it has caught properly', () => {
    const young = lit();
    expect(run(young, 2, { rain: 0, wind: P.windOut + 1 })).toEqual([{ type: 'out', why: 'wind' }]);
    const old = lit();
    run(old, P.growSeconds + 5);
    expect(run(old, 2, { rain: 0, wind: P.windOut + 1 })).toEqual([]);
  });

  it('takes a new pile on the old ash', () => {
    const f = lit();
    f.putOut();
    expect(f.state).toBe('ash');
    expect(f.canAdd()).toBe(true);
    f.addHeap();
    expect(f.piled).toBe(1);
    expect(f.state).toBe('built');
  });

  it('warms hands near a blaze and not far off or when low', () => {
    const f = lit();
    expect(f.warms(1)).toBe(false); // only just lit
    run(f, P.growSeconds);
    expect(f.warms(P.warmRange - 0.5)).toBe(true);
    expect(f.warms(P.warmRange + 1)).toBe(false);
  });
});

describe('where the fire is', () => {
  it('has log seats round it facing in', () => {
    const seats = logSeats(LAYOUT.bonfire);
    expect(seats).toHaveLength(4);
    for (const s of seats) {
      expect(Math.hypot(s.x - LAYOUT.bonfire.x, s.z - LAYOUT.bonfire.z)).toBeCloseTo(LAYOUT.bonfire.seatRadius, 5);
      const toFire = Math.atan2(LAYOUT.bonfire.x - s.x, LAYOUT.bonfire.z - s.z);
      expect(Math.cos(s.yaw - toFire)).toBeCloseTo(1, 5);
    }
  });

  it('keeps vehicles from starting on it, and the brushwood lies inside the field', () => {
    expect(spawnKeepOut(LAYOUT).some((k) => k.what === 'the bonfire')).toBe(true);
    for (const [x, z] of LAYOUT.brushwood) {
      expect(Math.abs(x)).toBeLessThan(LAYOUT.fieldHalf - 4);
      expect(z).toBeLessThan(LAYOUT.fieldHalf - 1.5);
    }
  });
});
