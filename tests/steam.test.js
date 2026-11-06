import { describe, it, expect } from 'vitest';
import { cuppingMethods } from '../src/npc/companionCupping.js';
import { DEFAULT_STEAM_PARAMS as P, STEAM_PARAM_RANGES, teaTemperature, steamAmount, steamLean, wispOffset, cupLift, patStroke } from '../src/npc/steam.js';

describe('tea cooling and steam', () => {
  it('starts hot, loses half its heat over the air each half-life and tends to the air', () => {
    expect(teaTemperature(0, 10)).toBe(P.teaStartC);
    expect(teaTemperature(P.coolHalfLife, 10)).toBeCloseTo(10 + (P.teaStartC - 10) / 2);
    expect(teaTemperature(1e6, 10)).toBeCloseTo(10);
  });

  it('steams while hot, thins as it cools and is gone once cold', () => {
    const a = steamAmount(teaTemperature(0, 5), 5);
    const b = steamAmount(teaTemperature(P.coolHalfLife * 0.7, 5), 5);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
    expect(steamAmount(P.steamStopC, 5)).toBe(0);
    expect(steamAmount(teaTemperature(P.coolHalfLife * 4, 5), 5)).toBe(0);
  });

  it('steams more on a cold day than a warm one, but still a little on a warm one', () => {
    expect(steamAmount(80, 0)).toBeGreaterThan(steamAmount(80, 20));
    expect(steamAmount(80, 30)).toBeCloseTo(P.warmFloor);
    expect(steamAmount(80, -5)).toBe(1);
  });

  it('leans downwind by the wind, up to a limit, and not at all in a calm', () => {
    expect(steamLean({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
    const l = steamLean({ x: 2, z: 0 });
    expect(l.x).toBeCloseTo(2 * P.windBend);
    expect(l.z).toBe(0);
    expect(Math.hypot(steamLean({ x: 100, z: 100 }).x, steamLean({ x: 100, z: 100 }).z)).toBeCloseTo(P.windBendMax);
  });

  it('rises from the lip, weaving a little, more bent the higher it is', () => {
    const lean = { x: 0.2, z: 0 };
    const low = wispOffset(0, 0, 0, lean);
    const high = wispOffset(1, 0, 0, lean);
    expect(low.y).toBe(0);
    expect(high.y).toBeGreaterThan(0.1);
    expect(Math.abs(low.x)).toBeLessThan(0.01);
    expect(high.x).toBeGreaterThan(0.1);
    expect(wispOffset(0.5, 1, 0.3, lean)).not.toEqual(wispOffset(0.5, 2, 0.3, lean));
  });
});

describe('a mug in both hands', () => {
  it('is held at her chest, then brought up to drink now and then and lowered again', () => {
    const lifts = [];
    for (let t = 0; t < 120; t += 0.1) lifts.push(cupLift(t));
    expect(lifts[0]).toEqual({ lift: 0, drinking: false }); // not drinking the moment it is poured
    expect(lifts.some((l) => l.drinking && l.lift === 1)).toBe(true);
    expect(lifts.every((l) => l.lift >= 0 && l.lift <= 1)).toBe(true);
    const drinks = lifts.filter((l, i) => l.drinking && !lifts[i - 1]?.drinking).length;
    expect(drinks).toBeGreaterThanOrEqual(8);
    expect(drinks).toBeLessThanOrEqual(10);
  });

  it('rises and falls smoothly rather than jumping', () => {
    let last = cupLift(0).lift;
    for (let t = 0.05; t < 60; t += 0.05) {
      const l = cupLift(t).lift;
      expect(Math.abs(l - last)).toBeLessThan(0.15);
      last = l;
    }
  });
});

describe('patting the tank', () => {
  it('has the hand clear before and after, and down flat on the metal a few times in between', () => {
    expect(patStroke(0)).toEqual({ press: 0, reach: 0 });
    expect(patStroke(1)).toEqual({ press: 0, reach: 0 });
    let touches = 0;
    let was = false;
    for (let t = 0.01; t < 1; t += 0.005) {
      const on = patStroke(t, 3).press > 0.9;
      if (on && !was) touches++;
      was = on;
    }
    expect(touches).toBe(3);
    expect(patStroke(0.5, 3).reach).toBe(1);
  });
});

describe('tunables', () => {
  it('has a range for every parameter, holding its default', () => {
    for (const [k, v] of Object.entries(P)) {
      expect(STEAM_PARAM_RANGES[k], k).toBeDefined();
      expect(v).toBeGreaterThanOrEqual(STEAM_PARAM_RANGES[k][0]);
      expect(v).toBeLessThanOrEqual(STEAM_PARAM_RANGES[k][1]);
    }
  });
});

describe('her hands (companionCupping.js)', () => {
  const calls = [];
  const girl = (o = {}) => ({ scene: { attach: (m) => calls.push(m) }, cup: null, pat: null, attempt: null, drive: null, quad: { id: 'q' }, ...o });

  it('takes a mug in both hands once, and gives it back when she lets go', () => {
    const g = girl();
    const mug = { name: 'mug' };
    expect(cuppingMethods.startCup.call(g, mug)).toBe(true);
    expect(calls).toContain(mug);
    expect(cuppingMethods.startCup.call(g, { name: 'another' })).toBe(false);
    expect(cuppingMethods.stopCup.call(g)).toBe(mug);
    expect(g.cup).toBeNull();
    expect(cuppingMethods.stopCup.call(g)).toBeNull();
  });

  it('pats the tank only while she is trying to start a quad, and not again while she is at it', () => {
    expect(cuppingMethods.patTank.call(girl())).toBe(false);
    const g = girl({ attempt: {} });
    expect(cuppingMethods.patTank.call(g)).toBe(true);
    expect(g.pat.quad).toBe(g.quad);
    expect(cuppingMethods.patTank.call(g)).toBe(false);
    expect(cuppingMethods.patTank.call(girl({ drive: { attempt: {} } }))).toBe(true); // sat at the wheel
  });
});
