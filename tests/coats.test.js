import { describe, it, expect } from 'vitest';
import { Coats, DEFAULT_COAT_PARAMS, COATS, COAT_PALETTE, dealCoatColours, hoodUp, isCoatWeather } from '../src/npc/coats.js';
import { Jumpers, DEFAULT_JUMPER_PARAMS } from '../src/npc/jumpers.js';
import { createRandom } from '../src/core/random.js';

const P = { ...DEFAULT_COAT_PARAMS, startAfter: 0, wetFor: 5, dryFor: 10 };
const rail = { x: 0, z: 0 };
const girl = (id, over = {}) => ({ id, free: true, x: 10, z: 0, ...over });
const rain = { warmth: 0.3, rain: 0.6 };
const dull = { warmth: 0.2, rain: 0 };

function run(c, secs, ctx) {
  const out = [];
  for (let t = 0; t < secs; t += 1) {
    out.push(...c.update(1, ctx));
    const offer = c.offers(ctx)[0];
    if (offer) out.push(c.take(offer));
  }
  return out;
}

describe('Coats', () => {
  it('offers a coat once she has been rained on a while, as a coat', () => {
    const c = new Coats({ ...P }, () => 0);
    expect(run(c, 4, { weather: rain, girls: [girl('amy')], rail })).toEqual([]);
    c.update(1, { weather: rain, girls: [girl('amy')], rail });
    expect(c.offers({ weather: rain, girls: [girl('amy')], rail })[0]).toMatchObject({ key: 'coat', girl: 'amy', jumper: COATS[0].id });
  });

  it('is for rain, not a cold dry day (that is a jumper)', () => {
    expect(isCoatWeather(dull, P)).toBe(false);
    expect(isCoatWeather(rain, P)).toBe(true);
    const c = new Coats({ ...P }, () => 0);
    expect(run(c, 60, { weather: dull, girls: [girl('amy')], rail })).toEqual([]);
    const j = new Jumpers({ ...DEFAULT_JUMPER_PARAMS, startAfter: 0, coldFor: 5 }, () => 0);
    expect(run(j, 10, { weather: dull, girls: [girl('amy')], rail })[0]).toMatchObject({ type: 'fetch', jumper: 'left' });
  });

  it('hangs it up after a dry spell, not straight away', () => {
    const c = new Coats({ ...P }, () => 0);
    const ctx = { weather: rain, girls: [girl('amy')], rail };
    const fetch = run(c, 10, ctx).find((e) => e.type === 'fetch');
    c.dressed('amy', fetch.jumper);
    expect(run(c, 9, { ...ctx, weather: dull })).toEqual([]);
    expect(run(c, 2, { ...ctx, weather: dull })[0]).toMatchObject({ type: 'hang', girl: 'amy', jumper: fetch.jumper });
  });

  it('gives each girl a different coat, two at most', () => {
    const c = new Coats({ ...P }, () => 0);
    const fetches = run(c, 30, { weather: rain, girls: [girl('amy'), girl('jess'), girl('third')], rail }).filter((e) => e.type === 'fetch');
    expect(fetches).toHaveLength(2);
    expect(new Set(fetches.map((e) => e.jumper)).size).toBe(2);
  });

  it('deals each farm two different colours from the palette, the same each time', () => {
    const a = dealCoatColours(createRandom(5));
    expect(a).toEqual(dealCoatColours(createRandom(5)));
    expect(new Set(a).size).toBe(2);
    for (const col of a) expect(COAT_PALETTE.map((q) => q.color)).toContain(col);
    expect(new Coats(P, Math.random, a).colourOf('coatRight')).toBe(a[1]);
  });
});

describe('the hood', () => {
  const on = { coat: true, helmet: false, covered: false };
  it('goes up in proper rain and down once it has nearly stopped, staying put in between', () => {
    expect(hoodUp(false, { ...on, rain: 0.5 }, P)).toBe(true);
    expect(hoodUp(true, { ...on, rain: 0.2 }, P)).toBe(true);
    expect(hoodUp(false, { ...on, rain: 0.2 }, P)).toBe(false);
    expect(hoodUp(true, { ...on, rain: 0.05 }, P)).toBe(false);
  });

  it('is never up without a coat, under a helmet or with a roof over her', () => {
    expect(hoodUp(true, { ...on, coat: false, rain: 0.9 }, P)).toBe(false);
    expect(hoodUp(true, { ...on, helmet: true, rain: 0.9 }, P)).toBe(false);
    expect(hoodUp(true, { ...on, covered: true, rain: 0.9 }, P)).toBe(false);
  });

  it('reports only the girls whose hood changed', () => {
    const c = new Coats({ ...P }, () => 0);
    c.dressed('amy', 'coatLeft');
    const girls = [{ id: 'amy', helmet: false, covered: false }, { id: 'jess', helmet: false, covered: false }];
    expect(c.updateHoods(0.6, girls)).toEqual([{ girl: 'amy', up: true }]);
    expect(c.updateHoods(0.6, girls)).toEqual([]);
    expect(c.updateHoods(0.6, [{ ...girls[0], helmet: true }])).toEqual([{ girl: 'amy', up: false }]);
  });
});

describe('the hood from the debug panel', () => {
  it('goes the other way for a while whatever the rain, then follows the rain again', () => {
    const c = new Coats({ ...P }, () => 0);
    c.dressed('amy', 'coatLeft');
    const girls = [{ id: 'amy', helmet: false, covered: false }];
    expect(c.toggleHood('amy', 10)).toBe(true);
    expect(c.updateHoods(0, girls)).toEqual([{ girl: 'amy', up: true }]);
    expect(c.describe('amy')).toBe('on, hood up');
    c.clock += 11;
    expect(c.updateHoods(0, girls)).toEqual([{ girl: 'amy', up: false }]);
    expect(c.describe('jess')).toBe('none');
  });
});
