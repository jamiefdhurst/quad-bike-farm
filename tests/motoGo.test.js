import { describe, it, expect } from 'vitest';
import { MotoNerve, refusesMoto, speedShare, DEFAULT_MOTO_PARAMS as P } from '../src/npc/motoGo.js';
import { BikeLean, DEFAULT_BIKE_PARAMS } from '../src/vehicle/bikeLean.js';

const run = (n, seconds, speed = 5, grass = true) => {
  let fell = false;
  let peak = 0;
  for (let t = 0; t < seconds && !fell; t += 0.1) {
    const r = n.update(0.1, { speed, grass });
    peak = Math.max(peak, Math.abs(r.wobble));
    fell = r.fall;
  }
  return { fell, peak };
};

describe('the girls on the mini moto', () => {
  it('has Amy refuse and Jess not', () => {
    expect(refusesMoto('amy')).toBe(true);
    expect(refusesMoto('jess')).toBe(false);
    expect(refusesMoto('amy', { ...P, amyRefuses: 0 })).toBe(false);
  });

  it('comes off on the first go, within the window, and not before', () => {
    const n = new MotoNerve(P, () => 0.5);
    n.begin();
    const early = run(n, P.firstFallMin - 1);
    expect(early.fell).toBe(false);
    expect(run(n, 60).fell).toBe(true);
    expect(n.falls).toBe(1);
  });

  it('waits for the grass, and for her to be moving', () => {
    const n = new MotoNerve(P, () => 0);
    n.begin();
    expect(run(n, 40, 5, false).fell).toBe(false);
    expect(run(n, 5, 0.5, true).fell).toBe(false);
    expect(run(n, 5, 5, true).fell).toBe(true);
  });

  it('wobbles at first and steadies as her nerve grows', () => {
    const n = new MotoNerve({ ...P, firstFallMin: 999, firstFallMax: 999 }, Math.random);
    n.begin();
    const first = run(n, 10).peak;
    n.nerve = 0.95;
    const later = run(n, 10).peak;
    expect(first).toBeGreaterThan(0.15);
    expect(later).toBeLessThan(first / 4);
  });

  it('gets braver from riding and from coming off, and rides faster', () => {
    const n = new MotoNerve(P, () => 0);
    n.begin();
    const before = n.nerve;
    run(n, P.firstFallMin + 5);
    expect(n.nerve).toBeGreaterThan(before + P.fallBrave);
    expect(speedShare(1, P)).toBe(1);
    expect(speedShare(0, P)).toBe(P.speedFloor);
    expect(speedShare(0.6, P)).toBeGreaterThan(speedShare(0.2, P));
  });

  it('falls less often on later goes as her nerve rises', () => {
    const goes = (nerve) => {
      let falls = 0;
      let seed = 1;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 400; i++) {
        const n = new MotoNerve(P, random);
        n.falls = 1;
        n.nerve = nerve;
        n.begin();
        if (n.go.fallAt < Infinity) falls++;
      }
      return falls;
    };
    expect(goes(0.1)).toBeGreaterThan(goes(0.7));
    expect(goes(1)).toBe(0);
  });

  it('puts the bike on its side when she loses it', () => {
    const bike = new BikeLean(DEFAULT_BIKE_PARAMS);
    bike.forceFall(-1);
    expect(bike.fallen).toBe(true);
    expect(bike.fallSide).toBe(-1);
    expect(bike.takeFall()).toBe(false);
    const out = bike.update(0.016, { lean: 0.1, leanRate: 0, speed: 5, bars: 0, barAngle: 0, throttle: 0, brake: 0, grip: 1, safe: true, gentle: true });
    expect(out.rollTorque).toBeLessThan(0);
  });
});
