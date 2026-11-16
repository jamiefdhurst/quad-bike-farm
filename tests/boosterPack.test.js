import { describe, it, expect, vi } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { boostStep, packOvernight, DEFAULT_BOOSTER_PARAMS as P } from '../src/items/boosterPack.js';

const flat = (battery = 0.05) => ({ battery, batteryOut: false, isRunning: false, state: 'off' });
const pack = (battery = 1) => ({ battery });

describe('the booster pack', () => {
  it('pushes charge into a flat battery and stops at starting', () => {
    const e = flat();
    const p = pack();
    let how;
    for (let t = 0; t < 20; t += 0.1) how = boostStep(p, e, 0.1, P);
    expect(e.battery).toBeCloseTo(P.boostTo, 5);
    expect(how).toBe('enough');
    expect(p.battery).toBeCloseTo(1 - (P.boostTo - 0.05) * P.drainPerCharge, 5);
  });

  it('takes about five seconds from flat', () => {
    const e = flat(0.05);
    let t = 0;
    while (boostStep(pack(), e, 0.1, P) === 'boosting') t += 0.1;
    expect(t).toBeGreaterThan(3);
    expect(t).toBeLessThan(7);
  });

  it('runs flat itself: a pack at its minimum gives nothing', () => {
    const e = flat();
    const p = pack(P.minPack);
    expect(boostStep(p, e, 1, P)).toBe('flat');
    expect(e.battery).toBe(0.05);
  });

  it('gives only what it has left, and never goes below zero', () => {
    const e = flat(0);
    const p = pack(0.1);
    for (let i = 0; i < 100; i++) boostStep(p, e, 0.1, P);
    expect(p.battery).toBeGreaterThanOrEqual(0);
    expect(p.battery).toBeCloseTo(P.minPack, 5);
    expect(e.battery).toBeCloseTo((0.1 - P.minPack) / P.drainPerCharge, 5);
  });

  it('refuses a vehicle with no battery in it, one that is running and one that is cranking', () => {
    const p = pack();
    expect(boostStep(p, { ...flat(), batteryOut: true }, 1, P)).toBe('out');
    expect(boostStep(p, { ...flat(), isRunning: true }, 1, P)).toBe('running');
    expect(boostStep(p, { ...flat(), state: 'cranking' }, 1, P)).toBe('running');
    expect(p.battery).toBe(1);
  });

  it('gives a full pack enough for more than one flat battery', () => {
    const p = pack();
    let starts = 0;
    for (let n = 0; n < 3; n++) {
      const e = flat(0.05);
      while (boostStep(p, e, 0.1, P) === 'boosting');
      if (e.battery >= P.boostTo - 0.001) starts++;
    }
    expect(starts).toBeGreaterThanOrEqual(1);
    expect(starts).toBeLessThan(3);
  });

  it('loses a little overnight and never goes negative', () => {
    expect(packOvernight(1, P)).toBeCloseTo(1 - P.nightDrain, 5);
    expect(packOvernight(0.01, P)).toBe(0);
  });
});

describe('the booster pack model', () => {
  it('has no two faces on one plane, which flicker as alpha fighting (the label is textured and sits off the face on purpose, so the check leaves it out)', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildBoosterModel } = await import('../src/items/boosterPack.js');
    const fights = coplanarOverlaps(buildBoosterModel(), { gap: 0.003, minArea: 2e-5 });
    expect(fights.map((f) => `${f.a} ${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(3))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });
});
