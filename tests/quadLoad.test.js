import { describe, it, expect } from 'vitest';
import { rampGeometry, surfaceAt, loadPose, canCapture, inWinchReach, mayLoad, QuadLoad, DEFAULT_LOAD_PARAMS as P } from '../src/vehicle/quadLoad.js';

const g = rampGeometry(-1.7, 0.78, 2.4);
const run = (load, secs, ctx, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < secs; t += dt) events.push(...load.step(dt, { winch: 0, push: 0, accel: 0, rampOpen: true, ...ctx }));
  return events;
};
const onRamp = (extra = {}) => new QuadLoad(g, { x: 0, z: g.footZ, heading: 0 }, { mode: 'ramp', facing: 1, ...extra });

describe('the ramp geometry', () => {
  it('reaches from the ground to the bed over its length', () => {
    expect(g.footZ).toBeLessThan(g.rearZ - 2);
    expect(Math.hypot(g.run, g.rise)).toBeCloseTo(2.4, 5);
    expect(surfaceAt(g, g.footZ - 1)).toBe(0);
    expect(surfaceAt(g, g.rearZ + 1)).toBe(0.78);
    expect(surfaceAt(g, (g.footZ + g.rearZ) / 2)).toBeCloseTo(0.39, 5);
  });
  it('pitches the quad nose up on the ramp and level on the bed', () => {
    expect(loadPose(g, (g.footZ + g.rearZ) / 2).pitch).toBeCloseTo(g.angle, 1);
    expect(loadPose(g, 0).pitch).toBeCloseTo(0, 5);
    expect(loadPose(g, 0).y).toBeCloseTo(0.78, 5);
  });
});

describe('lining up and eligibility', () => {
  it('captures a quad pushed straight on, either way round', () => {
    expect(canCapture(g, { x: 0.1, z: g.footZ - 0.5, heading: 0.1 })).toEqual({ ok: true, facing: 1 });
    expect(canCapture(g, { x: 0, z: g.footZ - 0.5, heading: Math.PI - 0.1 })).toEqual({ ok: true, facing: -1 });
  });
  it('does not capture a crooked, off-centre or distant one', () => {
    expect(canCapture(g, { x: 0, z: g.footZ - 0.5, heading: 1.2 }).ok).toBe(false);
    expect(canCapture(g, { x: 1.5, z: g.footZ - 0.5, heading: 0 }).ok).toBe(false);
    expect(canCapture(g, { x: 0, z: g.footZ - 4, heading: 0 }).ok).toBe(false);
  });
  it('winch reach is behind the trailer and within range', () => {
    expect(inWinchReach(g, { x: 1, z: g.footZ - 3 })).toBe(true);
    expect(inWinchReach(g, { x: 0, z: 0 })).toBe(false);
    expect(inWinchReach(g, { x: 0, z: g.footZ - 20 })).toBe(false);
  });
  it('only a dead, empty, upright, unhooked quad may be loaded', () => {
    expect(mayLoad({})).toBeNull();
    for (const k of ['running', 'occupied', 'tipped', 'excluded', 'hooked']) expect(mayLoad({ [k]: true })).toBeTruthy();
  });
});

describe('the winch', () => {
  it('drags a quad to the foot of the ramp, then up, and it ends aboard', () => {
    const l = new QuadLoad(g, { x: 1, z: g.footZ - 4, heading: 2 }, { mode: 'approach', held: true });
    const ev = run(l, 40, { winch: 1 });
    expect(ev).toContain('caught');
    expect(ev).toContain('aboard');
    expect(l.mode).toBe('aboard');
    expect(l.z).toBeCloseTo(l.aboardZ, 5);
    expect(Math.abs(l.heading)).toBeLessThan(0.05);
  });
  it('holds a quad where it is on the ramp when nobody reels', () => {
    const l = onRamp({ held: true });
    run(l, 3, { winch: 1 });
    const z = l.z;
    run(l, 3, {});
    expect(l.z).toBe(z);
  });
  it('pays out and lets a quad go at the foot', () => {
    const l = onRamp({ held: true });
    run(l, 3, { winch: 1 });
    const ev = run(l, 10, { winch: -1 });
    expect(ev).toContain('released');
  });
  it('lowers an aboard, unstrapped quad when paid out, but not a strapped one', () => {
    const l = onRamp({ held: true });
    run(l, 10, { winch: 1 });
    expect(l.mode).toBe('aboard');
    l.toggleStrap();
    run(l, 1, { winch: -1 });
    expect(l.mode).toBe('aboard');
    l.toggleStrap();
    run(l, 0.2, { winch: -1 });
    expect(l.mode).toBe('ramp');
  });
});

describe('pushing', () => {
  it('goes up only while pushed, and rolls back when let go', () => {
    const l = onRamp();
    run(l, 1, { push: 1 });
    const up = l.z;
    expect(up).toBeGreaterThan(g.footZ + 0.3);
    const ev = run(l, 4, {});
    expect(l.z).toBeLessThan(up);
    expect(ev).toContain('released');
  });
  it('can be pushed all the way aboard', () => {
    const l = onRamp();
    expect(run(l, 8, { push: 1 })).toContain('aboard');
  });
});

describe('riding aboard', () => {
  const aboard = (strap) => {
    const l = onRamp({ held: true });
    run(l, 10, { winch: 1 });
    l.vz = 0;
    l.z = -0.7;
    if (strap) l.toggleStrap();
    return l;
  };
  it('a strapped quad stays put whatever the trailer does', () => {
    const l = aboard(true);
    run(l, 3, { accel: -8 });
    expect(l.z).toBe(-0.7);
  });
  it('an unstrapped one slides forward under hard braking and thumps the front', () => {
    const l = aboard(false);
    const ev = run(l, 3, { accel: -7 });
    expect(l.z).toBeGreaterThan(-0.7);
    expect(ev).toContain('thump');
    expect(l.z).toBeLessThanOrEqual(l.frontStop);
  });
  it('gentle driving moves nothing', () => {
    const l = aboard(false);
    run(l, 3, { accel: 1.5 });
    expect(l.z).toBe(-0.7);
  });
  it('pulling away hard slides it back and, with the ramps down, off the back', () => {
    const l = aboard(false);
    const ev = run(l, 6, { accel: 7 });
    expect(ev).toContain('slid');
    expect(l.mode).toBe('ramp');
  });
  it('with the ramps up it stops at the back', () => {
    const l = aboard(false);
    run(l, 6, { accel: 7, rampOpen: false });
    expect(l.mode).toBe('aboard');
    expect(l.z).toBeGreaterThanOrEqual(l.aboardZ);
  });
  it('will not strap until it is aboard and still', () => {
    expect(onRamp().toggleStrap()).toMatch(/all the way/);
    const l = aboard(false);
    l.vz = 1;
    expect(l.toggleStrap()).toMatch(/settle/);
  });
  it('blocks the ramps folding up until it is aboard', () => {
    expect(onRamp().blocksRamp).toBe(true);
    expect(aboard(false).blocksRamp).toBe(false);
  });
});

it('has a range for every tunable', async () => {
  const { LOAD_PARAM_RANGES } = await import('../src/vehicle/quadLoad.js');
  expect(Object.keys(LOAD_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
});
