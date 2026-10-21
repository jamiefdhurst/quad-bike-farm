import { describe, it, expect } from 'vitest';
import { HayLoading, DEFAULT_HAY_LOADING_PARAMS, HAY_LOADING_PARAM_RANGES } from '../src/npc/hayLoading.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { CARRY_ITEMS, carryWeight, carryPace, DEFAULT_CARRY_PARAMS } from '../src/npc/carrying.js';

const girls = (over = {}) => [
  { id: 'amy', x: 100, z: 0, free: true, weight: 1, ...over.amy },
  { id: 'jess', x: 110, z: 0, free: true, weight: 1.3, ...over.jess },
];
const ctx = ({ girls: g, ...over } = {}) => ({ ready: true, at: { x: 105, z: 5 }, girls: girls({ amy: g?.amy, jess: g?.jess }), ...over });

describe('hay loading offers', () => {
  it('offers a bale to each free girl while there is one to carry', () => {
    const h = new HayLoading();
    const offers = h.offers(ctx());
    expect(offers.map((o) => o.girl).sort()).toEqual(['amy', 'jess']);
    expect(offers.every((o) => o.key === 'hayLoad' && o.weight > 0)).toBe(true);
    expect(offers.find((o) => o.girl === 'jess').weight).toBeGreaterThan(offers.find((o) => o.girl === 'amy').weight);
  });

  it('offers nothing when no bale is ready, or the girl is busy, far or uninterested', () => {
    const h = new HayLoading();
    expect(h.offers(ctx({ ready: false }))).toEqual([]);
    expect(h.offers(ctx({ at: null }))).toEqual([]);
    expect(h.offers(ctx({ girls: { amy: { free: false } } })).map((o) => o.girl)).toEqual(['jess']);
    expect(h.offers(ctx({ girls: { amy: { x: 1000 } } })).map((o) => o.girl)).toEqual(['jess']);
    expect(h.offers(ctx({ girls: { amy: { weight: 0 } } })).map((o) => o.girl)).toEqual(['jess']);
  });

  it('keeps a girl who is on a job out of the offers, and lets her rest before the next', () => {
    const h = new HayLoading();
    h.take({ girl: 'amy' });
    expect(h.busy('amy')).toBe(true);
    expect(h.offers(ctx()).map((o) => o.girl)).toEqual(['jess']);
    h.finished('amy', 5);
    expect(h.offers(ctx()).map((o) => o.girl)).toEqual(['jess']);
    h.update(5.1);
    expect(h.offers(ctx()).map((o) => o.girl).sort()).toEqual(['amy', 'jess']);
  });

  it('forgets a job that was never finished', () => {
    const h = new HayLoading();
    h.take({ girl: 'jess' });
    h.update(DEFAULT_HAY_LOADING_PARAMS.jobTimeout + 1);
    expect(h.busy('jess')).toBe(false);
  });

  it('can be forced from the panel only when there is a bale and she is free', () => {
    const h = new HayLoading();
    expect(h.force(ctx({ ready: false }), 'amy')).toBeNull();
    expect(h.force(ctx({ girls: { amy: { free: false } } }), 'amy')).toBeNull();
    expect(h.force(ctx(), 'amy')).toEqual({ type: 'go', girl: 'amy' });
    expect(h.force(ctx(), 'amy')).toBeNull();
  });

  it('has every tunable in range', () => {
    for (const k of Object.keys(DEFAULT_HAY_LOADING_PARAMS)) {
      const [lo, hi] = HAY_LOADING_PARAM_RANGES[k];
      expect(DEFAULT_HAY_LOADING_PARAMS[k]).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_HAY_LOADING_PARAMS[k]).toBeLessThanOrEqual(hi);
    }
  });
});

describe('the girls and hay', () => {
  it('is an offer that meets a need', () => {
    expect(OFFER_KINDS.hayLoad.satisfies.purpose).toBeGreaterThan(0);
  });

  it('has Jess keener, quicker and clumsier than Amy', () => {
    const amy = CHARACTERS.find((c) => c.id === 'amy').params;
    const jess = CHARACTERS.find((c) => c.id === 'jess').params;
    expect(jess.hayLoadWeight).toBeGreaterThan(amy.hayLoadWeight);
    expect(jess.hayCooldown).toBeLessThan(amy.hayCooldown);
    expect(jess.hayMissChance).toBeGreaterThan(amy.hayMissChance);
  });

  it('carries a bale as a heavy thing that slows her', () => {
    expect(CARRY_ITEMS.squareBale).toBeTruthy();
    expect(carryWeight('squareBale')).toBeGreaterThan(carryWeight('toolbox'));
    expect(carryPace(DEFAULT_CARRY_PARAMS, 'squareBale', carryWeight('squareBale'))).toBeLessThan(1);
  });
});
