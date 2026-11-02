import { describe, it, expect } from 'vitest';
import { DEFAULT_RACK_PARAMS as P, RACK_PARAM_RANGES, RackLoad, rackEffect, rackKg, slidePush } from '../src/vehicle/rackLoad.js';

const loaded = (kind = 'can') => {
  const r = new RackLoad({ ...P });
  r.put({ id: 1 }, kind);
  return r;
};

describe('what a load weighs and costs', () => {
  it('weighs a can and a toolbox, and nothing else', () => {
    expect(rackKg('can')).toBe(P.canKg);
    expect(rackKg('toolbox')).toBe(P.toolboxKg);
    expect(rackKg('bale')).toBe(0);
  });

  it('leaves an empty rack alone and takes drive and braking off a loaded one, to a floor', () => {
    expect(rackEffect(0)).toEqual({ driveFactor: 1, brakeFactor: 1 });
    const can = rackEffect(P.canKg);
    expect(can.driveFactor).toBeLessThan(1);
    expect(can.brakeFactor).toBeLessThan(1);
    expect(rackEffect(1000)).toEqual({ driveFactor: P.minDrive, brakeFactor: P.minBrake });
    expect(rackEffect(P.canKg).driveFactor).toBeLessThan(rackEffect(P.toolboxKg).driveFactor);
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(RACK_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
    for (const [k, [lo, hi]] of Object.entries(RACK_PARAM_RANGES)) {
      expect(P[k], k).toBeGreaterThanOrEqual(lo);
      expect(P[k], k).toBeLessThanOrEqual(hi);
    }
  });
});

describe('the strap', () => {
  it('weighs nothing on an empty rack', () => {
    expect(new RackLoad().kg).toBe(0);
  });

  it('takes a loose load off on a tap', () => {
    const r = loaded();
    r.press();
    r.hold(P.tapSeconds / 2);
    expect(r.release()).toBe('takeOff');
    expect(r.strapped).toBe(false);
  });

  it('straps a load held for the whole time, and does nothing more on release', () => {
    const r = loaded();
    r.press();
    let done = null;
    for (let t = 0; t < 3 && !done; t += 0.1) done = r.hold(0.1);
    expect(done).toBe('strapped');
    expect(r.strapped).toBe(true);
    expect(r.release()).toBe(null);
  });

  it('does not strap when let go part way', () => {
    const r = loaded();
    r.press();
    r.hold(P.tapSeconds + P.strapSeconds / 2);
    expect(r.progress).toBeCloseTo(0.5);
    expect(r.release()).toBe(null);
    expect(r.strapped).toBe(false);
    expect(r.progress).toBe(0);
  });

  it('unstraps with a hold, and a tap on a strapped load does nothing', () => {
    const r = loaded();
    r.strapped = true;
    r.press();
    r.hold(0.1);
    expect(r.release()).toBe(null);
    r.press();
    let done = null;
    for (let t = 0; t < 3 && !done; t += 0.1) done = r.hold(0.1);
    expect(done).toBe('unstrapped');
    expect(r.strapped).toBe(false);
  });

  it('does nothing with nothing on the rack', () => {
    const r = new RackLoad({ ...P });
    r.press();
    expect(r.hold(5)).toBe(null);
    expect(r.release()).toBe(null);
  });

  it('clears everything when the load is taken off', () => {
    const r = loaded('toolbox');
    r.strapped = true;
    expect(r.clear()).toEqual({ id: 1 });
    expect(r.loaded).toBe(false);
    expect(r.strapped).toBe(false);
    expect(r.kg).toBe(0);
  });
});

describe('sliding off', () => {
  const run = (r, seconds, push) => {
    for (let t = 0; t < seconds; t += 0.05) if (r.update(0.05, push) === 'slid') return true;
    return false;
  };

  it('is pushed by a hard brake or a bump but not by gentle braking or a smooth ride', () => {
    expect(slidePush(0, -2, 1)).toBe(0);
    expect(slidePush(0, -8, 0)).toBeGreaterThan(0);
    expect(slidePush(0, 0, 25)).toBeGreaterThan(0);
    expect(slidePush(0, 0, -25)).toBeGreaterThan(0);
    expect(slidePush(0.5, 0, 0)).toBeGreaterThan(0);
  });

  it('lets a loose load go over under repeated hard braking', () => {
    expect(run(loaded(), 10, slidePush(0, -9, 0))).toBe(true);
  });

  it('settles back when the quad is driven smoothly, so one small jolt is not the end', () => {
    const r = loaded();
    run(r, 0.5, slidePush(0, -7, 0));
    const after = r.slide;
    expect(after).toBeGreaterThan(0);
    run(r, 5, 0);
    expect(r.slide).toBeLessThan(after);
  });

  it('never moves a strapped load, whatever happens', () => {
    const r = loaded();
    r.strapped = true;
    expect(run(r, 60, slidePush(2, -20, 40))).toBe(false);
    expect(r.slide).toBe(0);
  });

  it('starts again at nothing when it is put back', () => {
    const r = loaded();
    r.slide = 0.9;
    r.put({ id: 2 }, 'can');
    expect(r.slide).toBe(0);
  });
});
