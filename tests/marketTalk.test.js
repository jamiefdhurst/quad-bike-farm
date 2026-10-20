import { describe, it, expect } from 'vitest';
import { MarketTalk, DEFAULT_MARKET_TALK_PARAMS as P, MONEY_SITUATIONS } from '../src/farm/marketTalk.js';
import { AMY_MONEY_LINES, JESS_MONEY_LINES } from '../src/npc/moneyLines.js';

const ctx = (o = {}) => ({ atTin: 3, girlNear: true, purse: 300, ads: [], arrivals: 0, arrivalGirlNear: false, ...o });
const ads = [{ id: 'ad0-tractor' }];

describe('what a girl remarks on about the money', () => {
  it('says nothing about an ordinary tin with nothing on the board', () => {
    const t = new MarketTalk();
    expect(t.update(1, ctx())).toBeNull();
  });

  it('mentions an ad once for that board, and not again until it changes', () => {
    const t = new MarketTalk();
    expect(t.update(1, ctx({ ads }))).toBe('moneyAd');
    t.saidAds(ads);
    expect(t.update(P.adGap + 1, ctx({ ads }))).toBeNull();
    expect(t.update(P.adGap + 1, ctx({ ads: [{ id: 'ad0-utv' }] }))).toBe('moneyAd');
  });

  it('only talks about the tin or the board while you are at it with a girl near', () => {
    const t = new MarketTalk();
    expect(t.update(1, ctx({ ads, atTin: P.atTinRange + 1 }))).toBeNull();
    expect(t.update(1, ctx({ ads, girlNear: false }))).toBeNull();
    expect(t.update(1, ctx({ purse: 10, atTin: 20 }))).toBeNull();
  });

  it('says the tin is low, then waits its gap', () => {
    const t = new MarketTalk();
    expect(t.update(1, ctx({ purse: P.lowBelow - 1 }))).toBe('moneyLow');
    t.said('moneyLow');
    expect(t.update(10, ctx({ purse: 5 }))).toBeNull();
    expect(t.update(P.lowGap, ctx({ purse: 5 }))).toBe('moneyLow');
  });

  it('says the tin is well stocked, with its own gap', () => {
    const t = new MarketTalk();
    expect(t.update(1, ctx({ purse: P.highAbove + 1 }))).toBe('moneyHigh');
    t.said('moneyHigh');
    expect(t.update(10, ctx({ purse: 5000 }))).toBeNull();
    expect(t.update(P.highGap, ctx({ purse: 5000 }))).toBe('moneyHigh');
  });

  it('remarks on a vehicle that turned up this morning once, wherever you are, when a girl is near it', () => {
    const t = new MarketTalk();
    expect(t.update(1, ctx({ arrivals: 1, arrivalGirlNear: false, atTin: 80, girlNear: false }))).toBeNull();
    expect(t.update(1, ctx({ arrivals: 1, arrivalGirlNear: true, atTin: 80, girlNear: false }))).toBeNull(); // not as the page loads
    expect(t.update(P.arrivedAfter, ctx({ arrivals: 1, arrivalGirlNear: true, atTin: 80, girlNear: false }))).toBe('moneyArrived');
    t.said('moneyArrived');
    expect(t.update(5000, ctx({ arrivals: 1, arrivalGirlNear: true }))).toBeNull();
  });
});

describe('the lines', () => {
  it('both girls have lines for every situation', () => {
    for (const s of MONEY_SITUATIONS) {
      expect(AMY_MONEY_LINES[s]?.lines.length, `amy ${s}`).toBeGreaterThanOrEqual(3);
      expect(JESS_MONEY_LINES[s]?.length, `jess ${s}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('never call the player he, she or they, and use no em dash', () => {
    const all = [...Object.values(AMY_MONEY_LINES).flatMap((e) => e.lines), ...Object.values(JESS_MONEY_LINES).flat()];
    for (const l of all) {
      expect(/\b(he|she|they)\b/i.test(l), l).toBe(false);
      expect(l.includes('\u2014'), l).toBe(false);
    }
  });
});
