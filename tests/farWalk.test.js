import { describe, it, expect } from 'vitest';
import { DEFAULT_FAR_WALK_PARAMS as P, FAR_WALK_PARAM_RANGES, wayLength, tooFar, splitFar, liftOffer, howShePlans } from '../src/npc/farWalk.js';

const straight = (from) => (to) => [{ x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }, to];

describe('far is far', () => {
  it('has a range for every param', () => {
    expect(Object.keys(FAR_WALK_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });

  it('measures a way along its points', () => {
    expect(wayLength({ x: 0, z: 0 }, [{ x: 30, z: 0 }, { x: 30, z: 40 }])).toBe(70);
    expect(wayLength({ x: 0, z: 0 }, [])).toBe(0);
  });

  it('a way is too far past about 150 m, and not at it', () => {
    expect(tooFar(150)).toBe(false);
    expect(tooFar(151)).toBe(true);
  });

  it('keeps near places and things with no place, and sets the far ones aside', () => {
    const from = { x: 0, z: 0 };
    const places = { tea: { x: 60, z: 0 }, hut: { x: 400, z: 0 }, wander: null };
    const offers = [{ key: 'tea' }, { key: 'hut' }, { key: 'wander' }];
    const { near, far } = splitFar(offers, from, (o) => places[o.key], straight(from));
    expect(near.map((o) => o.key)).toEqual(['tea', 'wander']);
    expect(far.map((f) => f.offer.key)).toEqual(['hut']);
    expect(far[0].place).toEqual({ x: 400, z: 0 });
  });

  it('judges the way round by the gateways, not as the crow flies', () => {
    const from = { x: 0, z: 0 };
    const roundTheHedge = () => [{ x: 0, z: 140 }, { x: 100, z: 140 }];
    const { far } = splitFar([{ key: 'hut' }], from, () => ({ x: 100, z: 0 }), roundTheHedge);
    expect(far).toHaveLength(1);
  });

  it('a far offer becomes one lift offer, as keen as the keenest of them', () => {
    const far = [{ offer: { key: 'tea', girl: 'amy', weight: 0.5 }, place: { x: 1, z: 2 } }, { offer: { key: 'hut', girl: 'amy', weight: 1.2 }, place: { x: 9, z: 9 } }];
    const o = liftOffer(far, 'quad');
    expect(o).toMatchObject({ key: 'lift', girl: 'amy', how: 'quad', for: 'hut', place: { x: 9, z: 9 } });
    expect(o.weight).toBeCloseTo(1.2 * P.liftWeight);
  });

  it('no lift with nothing far, and none when she has no way there', () => {
    expect(liftOffer([], 'quad')).toBe(null);
    expect(liftOffer([{ offer: { key: 'hut', girl: 'amy' }, place: {} }], null)).toBe(null);
  });

  it('she asks you if you are close on a stopped quad with room, else takes one herself, else stays put', () => {
    expect(howShePlans({ youDistance: 8, youStopped: true, youRoom: true, quadFree: true })).toBe('ask');
    expect(howShePlans({ youDistance: 40, youStopped: true, youRoom: true, quadFree: true })).toBe('quad');
    expect(howShePlans({ youDistance: 8, youStopped: false, youRoom: true, quadFree: true })).toBe('quad');
    expect(howShePlans({ youDistance: 8, youStopped: true, youRoom: false, quadFree: false })).toBe(null);
  });

  it('she never walks further than the limit on her own choice: every offer left to walk is within it', () => {
    const from = { x: 0, z: 0 };
    const offers = [60, 149, 151, 400, 900].map((x) => ({ key: `to${x}`, x }));
    const { near } = splitFar(offers, from, (o) => ({ x: o.x, z: 0 }), straight(from));
    for (const o of near) expect(o.x).toBeLessThanOrEqual(P.liftFrom);
    expect(near).toHaveLength(2);
  });
});
