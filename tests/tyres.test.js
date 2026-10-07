import { describe, it, expect } from 'vitest';
import { TyreSet, dealTyres, newTyres, BRANDS, WHEEL_NAMES, DEFAULT_TYRE_PARAMS as P } from '../src/vehicle/tyres.js';
import { DEFAULT_TUNE_PARAMS as T } from '../src/vehicle/tuneUp.js';
import { describeVehicle } from '../src/debug/startReport.js';
import { createRandom } from '../src/core/random.js';

const many = (n, f) => Array.from({ length: n }, (_, i) => f(createRandom(i + 1)));
const fresh = (set = newTyres(T.stockPsi)) => new TyreSet(set, P, T);

describe('dealing tyres', () => {
  it('keeps pressures within limits, mostly near stock, sometimes with one wheel well out', () => {
    const deals = many(500, (r) => dealTyres(r, T.stockPsi));
    for (const d of deals) for (const v of d.psi) expect(v).toBeGreaterThanOrEqual(P.minPsi);
    for (const d of deals) for (const v of d.psi) expect(v).toBeLessThanOrEqual(P.maxPsi);
    const spread = (d) => Math.max(...d.psi) - Math.min(...d.psi);
    expect(deals.filter((d) => spread(d) > 1).length).toBeGreaterThan(40);
    expect(deals.filter((d) => spread(d) < 0.8).length).toBeGreaterThan(200);
    expect(deals.some((d) => d.psi.every((v) => v !== T.stockPsi))).toBe(true);
  });

  it('mismatches the brands most of the time and wears the rear more, sometimes to bald', () => {
    const deals = many(1000, (r) => dealTyres(r, T.stockPsi));
    const matched = deals.filter((d) => d.brand.front === d.brand.rear).length;
    expect(matched).toBeGreaterThan(300);
    expect(matched).toBeLessThan(500);
    for (const d of deals) {
      expect(Object.keys(BRANDS)).toContain(d.brand.front);
      expect(Object.keys(BRANDS)).toContain(d.brand.rear);
      expect(d.tread.front).toBeGreaterThanOrEqual(P.frontTreadLow);
      expect(d.tread.rear).toBeGreaterThanOrEqual(P.baldLow);
      expect(d.tread.rear).toBeLessThanOrEqual(1);
    }
    const bald = deals.filter((d) => d.tread.rear <= P.baldHigh).length;
    expect(bald).toBeGreaterThan(150);
    expect(bald).toBeLessThan(350);
    const mean = (f) => deals.reduce((a, d) => a + f(d), 0) / deals.length;
    expect(mean((d) => d.tread.rear)).toBeLessThan(mean((d) => d.tread.front));
  });

  it('repeats for a seed', () => {
    expect(dealTyres(createRandom(5), 4)).toEqual(dealTyres(createRandom(5), 4));
  });
});

describe('grip', () => {
  it('is 1 for a new, matched set at the stock pressure on grass', () => {
    const t = fresh();
    for (let i = 0; i < 4; i++) expect(t.grip(i, 0, 0)).toBeCloseTo(1, 5);
  });

  it('is better with softer tyres, more so in mud', () => {
    const soft = fresh({ ...newTyres(), psi: [3, 3, 3, 3] });
    const hard = fresh({ ...newTyres(), psi: [5, 5, 5, 5] });
    expect(soft.grip(0, 0, 0)).toBeGreaterThan(hard.grip(0, 0, 0));
    expect(soft.grip(0, 1, 0) / hard.grip(0, 1, 0)).toBeGreaterThan(soft.grip(0, 0, 0) / hard.grip(0, 0, 0));
  });

  it('loses little on the dry and a lot in mud with a bald rear, and only on the rear', () => {
    const t = fresh({ ...newTyres(), tread: { front: 1, rear: 0.2 } });
    expect(t.grip(2, 0, 0)).toBeGreaterThan(0.8);
    expect(t.grip(2, 1, 0)).toBeLessThan(0.7);
    expect(t.grip(0, 1, 0)).toBeCloseTo(BRANDS.trackmaster.mud, 5);
  });

  it('follows the brand: the digger wins in mud and loses on grass', () => {
    const mud = fresh({ ...newTyres(), brand: { front: 'mudclaw', rear: 'roadrunner' } });
    expect(mud.grip(0, 1, 0)).toBeGreaterThan(mud.grip(2, 1, 0));
    expect(mud.grip(0, 0, 0)).toBeLessThan(mud.grip(2, 0, 0));
  });

  it('counts puddles as mud', () => {
    const t = fresh({ ...newTyres(), tread: { front: 0.3, rear: 0.3 } });
    expect(t.grip(0, 0, 1)).toBeCloseTo(t.grip(0, 1, 0), 5);
  });
});

describe('the gauge and levelling', () => {
  it('reads every wheel, and a puncture lets one down', () => {
    const t = fresh({ ...newTyres(), psi: [3.8, 4.3, 4, 4.1] });
    expect(t.reading()).toEqual([3.8, 4.3, 4, 4.1]);
    const flat = t.reading(1, 1);
    expect(flat[1]).toBeCloseTo(4.3 * (1 - P.flatDrop));
    expect(flat[0]).toBe(3.8);
    expect(t.gauge()).toBe('FL 3.8  FR 4.3  RL 4.0  RR 4.1 psi');
    expect(WHEEL_NAMES.length).toBe(4);
  });

  it('levels all four to one pressure within the limits', () => {
    const t = fresh({ ...newTyres(), psi: [3.8, 4.3, 4, 4.1] });
    t.level(4.5);
    expect(t.psi).toEqual([4.5, 4.5, 4.5, 4.5]);
    t.level(100);
    expect(t.psi.every((v) => v === P.maxPsi)).toBe(true);
  });

  it('keeps the real pressure when the puncture only shows on the gauge', () => {
    const t = fresh();
    t.reading(0, 1);
    expect(t.psi[0]).toBe(T.stockPsi);
  });
});

describe('rolling and bounce', () => {
  it('rolls easier hard and bounces more soft', () => {
    const soft = fresh({ ...newTyres(), psi: [3, 3, 3, 3] });
    const hard = fresh({ ...newTyres(), psi: [5, 5, 5, 5] });
    expect(hard.rollingFactor).toBeLessThan(soft.rollingFactor);
    expect(soft.stiffness(0)).toBeLessThan(hard.stiffness(0));
    expect(fresh().rollingFactor).toBeCloseTo(1, 5);
    expect(fresh().stiffness(2)).toBeCloseTo(1, 5);
  });
});

describe('describing them', () => {
  it('names the brands and treads, and the console block shows them', () => {
    const t = fresh({ psi: [3.8, 4.3, 4, 4.1], brand: { front: 'mudclaw', rear: 'roadrunner' }, tread: { front: 0.82, rear: 0.3 } });
    expect(t.describe()).toBe('front Mudclaw, tread 0.82; rear Roadrunner, tread 0.30');
    const text = describeVehicle({
      name: 'Red quad', idle: 1000, top: 6000, redline: 5800, roughness: 0.05, litres: 5, tap: 'off', hours: 1, odo: 1, trip: 0, pod: null, wear: 0.1, faults: [], tinker: null, lastRider: null, quirks: [], wornGear: null, hand: null, tyres: t,
    });
    expect(text).toContain('tyres:    FL 3.8  FR 4.3  RL 4.0  RR 4.1 psi; front Mudclaw, tread 0.82; rear Roadrunner, tread 0.30');
  });
});
