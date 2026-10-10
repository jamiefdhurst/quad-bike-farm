import { describe, it, expect } from 'vitest';
import { Places, DEFAULT_PLACE_PARAMS, isFine, nearestSpot, restStay } from '../src/npc/places.js';

const P = DEFAULT_PLACE_PARAMS;
const barn = { id: 'barn1', kind: 'shelter', x: 0, z: 0, yaw: 0 };
const barn2 = { id: 'barn2', kind: 'shelter', x: 0, z: 3, yaw: 0 };
const bale = { id: 'bale1', kind: 'bale', x: 10, z: 10, yaw: 0, seat: 1.3 };
const girls = (over = {}) => [{ id: 'amy', x: 20, z: 0, state: 'idle', spot: null, ...over }];
const run = (pl, ctx, seconds) => {
  const out = [];
  for (let t = 0; t < seconds; t++) out.push(...pl.update(1, ctx));
  return out;
};
const make = () => new Places({ ...P }, () => 0.5);

describe('isFine', () => {
  it('needs a sunny kind of day and dry ground', () => {
    expect(isFine('sunny', 0)).toBe(true);
    expect(isFine('sunny intervals', 0)).toBe(true);
    expect(isFine('overcast', 0)).toBe(false);
    expect(isFine('sunny', 0.5)).toBe(false);
  });
});

describe('nearestSpot', () => {
  const spots = [bale, { ...bale, id: 'bale2', x: 3, z: 3 }, barn];
  it('picks the nearest free spot of the kind, within range', () => {
    expect(nearestSpot(spots, ['bale'], { x: 0, z: 0 }, new Set(), 50).id).toBe('bale2');
    expect(nearestSpot(spots, ['bale'], { x: 0, z: 0 }, new Set(['bale2']), 50).id).toBe('bale1');
    expect(nearestSpot(spots, ['bale'], { x: 0, z: 0 }, new Set(['bale1', 'bale2']), 50)).toBeNull();
    expect(nearestSpot(spots, ['bale'], { x: 0, z: 0 }, new Set(), 2)).toBeNull();
    expect(nearestSpot(spots, ['shelter'], { x: 0, z: 0 }, new Set(), 50).id).toBe('barn1');
  });
});

describe('restStay', () => {
  it('is within the range', () => {
    expect(restStay(P, () => 0)).toBe(P.restStayMin);
    expect(restStay(P, () => 1)).toBe(P.restStayMax);
  });
});

describe('Places in the rain', () => {
  it('offers an idle girl the barn once the rain has set in, and taking it sends her', () => {
    const pl = make();
    const ctx = { rain: 0.8, spots: [barn, bale], girls: girls() };
    const offers = pl.offers(ctx);
    expect(offers).toEqual([{ key: 'shelterBarn', girl: 'amy', spot: barn, weight: P.shelterWeight }]);
    expect(pl.take(offers[0])).toMatchObject({ girl: 'amy', do: 'shelter', spot: { id: 'barn1' } });
  });
  it('never sends her on its own: that is the chooser\'s', () => {
    expect(run(make(), { rain: 0.8, spots: [barn], girls: girls() }, 60)).toEqual([]);
  });
  it('offers nothing for a drizzle below the threshold, or to a girl who is busy', () => {
    expect(make().offers({ rain: 0.1, spots: [barn], girls: girls() })).toEqual([]);
    expect(make().offers({ rain: 0.8, spots: [barn], girls: girls({ state: 'busy' }) })).toEqual([]);
  });
  it('offers a girl sitting out on a bale the barn too', () => {
    expect(make().offers({ rain: 0.8, spots: [barn, bale], girls: girls({ state: 'resting', spot: bale }) })).toHaveLength(1);
  });
  it('gives two girls different spots once one is taken', () => {
    const ctx = { rain: 0.8, spots: [barn, barn2], girls: [{ id: 'amy', x: 5, z: 0, state: 'idle', spot: null }, { id: 'jess', x: 5, z: 1, state: 'idle', spot: barn }] };
    expect(make().offers(ctx).map((o) => o.spot.id)).toEqual(['barn2']);
  });
  it('offers nothing if there is nowhere to shelter, or to a girl already at the barn', () => {
    expect(make().offers({ rain: 0.8, spots: [bale], girls: girls() })).toEqual([]);
    expect(make().offers({ rain: 0.8, spots: [barn], girls: girls({ x: 0, state: 'resting', spot: barn }) })).toEqual([]);
  });
});

describe('Places drying off', () => {
  it('lets her out of the barn after it has stayed dry a while, not before', () => {
    const pl = make();
    const ctx = { rain: 0, spots: [barn], girls: girls({ x: 0, state: 'resting', spot: barn }) };
    expect(run(pl, ctx, P.dryDelayMin - 2)).toEqual([]);
    expect(run(pl, ctx, P.dryDelayMax)).toEqual([{ girl: 'amy', do: 'leave' }]);
  });
  it('keeps her in while it is still spitting', () => {
    expect(run(make(), { rain: 0.15, spots: [barn], girls: girls({ x: 0, state: 'resting', spot: barn }) }, 200)).toEqual([]);
  });
  it('restarts the wait if the rain comes back', () => {
    const pl = make();
    const g = girls({ x: 0, state: 'resting', spot: barn });
    run(pl, { rain: 0, spots: [barn], girls: g }, P.dryDelayMin - 1);
    run(pl, { rain: 0.9, spots: [barn], girls: g }, 5);
    expect(run(pl, { rain: 0, spots: [barn], girls: g }, 5)).toEqual([]);
  });
});
