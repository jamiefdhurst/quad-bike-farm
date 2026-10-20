import { describe, it, expect } from 'vitest';
import * as specModule from '../src/vehicle/quadSpecs.js';
import { createRandom } from '../src/core/random.js';
import {
  DEFAULT_MARKET_PARAMS as P,
  FOR_SALE,
  NOT_FOR_SALE,
  Market,
  dealAds,
  dealPurse,
  moneyFacts,
  sellOffer,
  withoutSold,
  makeAd,
  unlistedSpecs,
  usedSpec,
  withBought,
} from '../src/farm/classifieds.js';

// Every vehicle spec the game exports, found rather than listed, so a new one is caught here.
const allSpecs = Object.values(specModule).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && 'bodyColor' in s);
const byId = Object.fromEntries(allSpecs.map((s) => [s.id, s]));

describe('every vehicle is on the market or says why not', () => {
  it('finds the specs', () => {
    expect(allSpecs.length).toBeGreaterThanOrEqual(15);
  });

  it('has each spec in FOR_SALE or NOT_FOR_SALE (add a new vehicle to one of them in src/farm/classifieds.js)', () => {
    expect(unlistedSpecs(allSpecs)).toEqual([]);
  });

  it('lists nothing that is not a spec, and nothing in both', () => {
    for (const id of [...Object.keys(FOR_SALE), ...Object.keys(NOT_FOR_SALE)]) expect(byId[id], id).toBeTruthy();
    for (const id of Object.keys(FOR_SALE)) expect(id in NOT_FOR_SALE).toBe(false);
  });

  it('gives each excluded vehicle a reason and each one for sale a price and colours', () => {
    for (const why of Object.values(NOT_FOR_SALE)) expect(why.length).toBeGreaterThan(5);
    for (const [id, s] of Object.entries(FOR_SALE)) {
      expect(s.price, id).toBeGreaterThan(0);
      expect(s.colours.length, id).toBeGreaterThanOrEqual(3);
      expect(s.colours, id).toContain(byId[id].bodyColor);
    }
  });
});

describe('the board', () => {
  const days = Array.from({ length: 800 }, (_, i) => dealAds(createRandom(i), { specs: byId }));

  it('is empty on most days and has an ad on some', () => {
    const withAds = days.filter((d) => d.length).length / days.length;
    expect(withAds).toBeGreaterThan(0.2);
    expect(withAds).toBeLessThan(0.4);
  });

  it('never has more than three, or two of one model', () => {
    for (const d of days) {
      expect(d.length).toBeLessThanOrEqual(3);
      expect(new Set(d.map((a) => a.specId)).size).toBe(d.length);
    }
  });

  it('is the same for the same random numbers', () => {
    expect(dealAds(createRandom(9), { specs: byId })).toEqual(dealAds(createRandom(9), { specs: byId }));
  });

  it('leaves out the models that are on the farm or already bought', () => {
    const onFarm = ['red', 'blue', 'yellow', 'green', 'orange', 'kids', 'moto', 'atc'];
    const owned = [{ specId: 'tractor' }];
    for (let i = 0; i < 300; i++) {
      for (const a of dealAds(createRandom(i), { specs: byId, onFarm, owned })) {
        expect(onFarm).not.toContain(a.specId);
        expect(a.specId).not.toBe('tractor');
      }
    }
  });

  it('has nothing once you have bought as many as you may', () => {
    const owned = Array.from({ length: P.maxBought }, () => ({ specId: 'moto' }));
    for (let i = 0; i < 100; i++) expect(dealAds(createRandom(i), { specs: byId, owned })).toEqual([]);
  });

  it('only ever offers a colour from that model\'s list, and a readable price', () => {
    for (const a of days.flat()) {
      expect(FOR_SALE[a.specId].colours).toContain(a.colour);
      expect(a.price).toBeGreaterThan(0);
      expect(a.text).toContain(`£${a.price.toLocaleString('en-GB')}`);
    }
  });

  it('prices a more worn one lower than a good one of the same model', () => {
    const cheap = Array.from({ length: 200 }, (_, i) => makeAd(createRandom(i), 'tractor', byId.tractor, 0)).sort((a, b) => a.wear - b.wear);
    const avg = (xs) => xs.reduce((s, a) => s + a.price, 0) / xs.length;
    expect(avg(cheap.slice(-50))).toBeLessThan(avg(cheap.slice(0, 50)));
  });
});

describe('buying', () => {
  const ad = () => makeAd(createRandom(3), 'tractor', byId.tractor, 0);

  it('takes the price from the purse, takes the ad down and keeps a record', () => {
    const m = new Market();
    m.purse = 5000;
    const a = ad();
    m.ads = [a];
    const rec = m.buy(a);
    expect(rec.specId).toBe('tractor');
    expect(m.purse).toBe(5000 - a.price);
    expect(m.ads).toEqual([]);
    expect(m.bought).toHaveLength(1);
  });

  it('refuses when you are short, over the limit, or the ad has gone', () => {
    const m = new Market();
    const a = ad();
    m.ads = [a];
    expect(m.whyNot(a)).toMatch(/short/);
    expect(m.buy(a)).toBeNull();
    expect(m.purse).toBe(P.startPurseMin);
    expect(m.whyNot(ad())).toMatch(/gone/);
    m.purse = 99999;
    m.bought = Array.from({ length: P.maxBought }, () => ({ specId: 'moto' }));
    expect(m.whyNot(a)).toMatch(/more than/);
  });

  it('is kept in the save and put back', () => {
    const m = new Market();
    m.purse = 5000;
    const a = ad();
    m.ads = [a];
    m.buy(a);
    const back = new Market();
    back.restore(JSON.parse(JSON.stringify(m.toJSON())));
    expect(back.purse).toBe(m.purse);
    expect(back.bought).toEqual(m.bought);
  });

  it('ignores a record for a model that is not for sale', () => {
    const m = new Market();
    m.restore({ purse: 10, bought: [{ specId: 'corsa', colour: 1 }, { specId: 'moto', colour: 0x123456 }] });
    expect(m.bought.map((b) => b.specId)).toEqual(['moto']);
  });
});

describe('what turns up next morning', () => {
  const rec = { specId: 'tractor', colour: 0x2c4f8a, hours: 3100, miles: 0, wear: 0.6, bodyWear: 0.6, price: 1000 };

  it('is the model in the colour and condition it was sold with, under its own id', () => {
    const u = usedSpec(byId.tractor, rec);
    expect(u.id).toBe('tractor');
    expect(u.bodyColor).toBe(0x2c4f8a);
    expect(u.hoursRange).toEqual([3100, 3101]);
    expect(u.bodyWear).toBe(0.6);
    expect(byId.tractor.bodyColor).not.toBe(0x2c4f8a); // the shared spec is untouched
  });

  it('replaces the dealt model in the fleet, or joins it', () => {
    const fleet = [byId.red, byId.tractor];
    const out = withBought(fleet, [rec, { ...rec, specId: 'utv', colour: 0x2e2e30 }], byId);
    expect(out.map((s) => s.id)).toEqual(['red', 'tractor', 'utv']);
    expect(out[1].bodyColor).toBe(0x2c4f8a);
    expect(out[2].bodyColor).toBe(0x2e2e30);
    expect(fleet[1]).toBe(byId.tractor);
  });
});

describe('the starting purse', () => {
  const purses = Array.from({ length: 500 }, (_, i) => dealPurse(createRandom(i), P));

  it('is a round number from £200 to £600, and not always the same', () => {
    for (const p of purses) {
      expect(p).toBeGreaterThanOrEqual(200);
      expect(p).toBeLessThanOrEqual(600);
      expect(p % 10).toBe(0);
    }
    expect(new Set(purses).size).toBeGreaterThan(20);
    expect(Math.min(...purses)).toBeLessThan(250);
    expect(Math.max(...purses)).toBeGreaterThan(550);
  });

  it('is the same for the same seed, and the market starts with it', () => {
    expect(dealPurse(createRandom(7), P)).toBe(dealPurse(createRandom(7), P));
    expect(new Market(P, createRandom(7)).purse).toBe(dealPurse(createRandom(7), P));
  });

  it('is replaced by a saved purse', () => {
    const m = new Market(P, createRandom(3));
    m.restore({ purse: 42 });
    expect(m.purse).toBe(42);
  });
});

describe('what a buyer offers', () => {
  const fine = { wear: 0, bodyWear: 0, faults: 0 };

  it('is less than a new one costs, and less again for a worse one', () => {
    for (const id of Object.keys(FOR_SALE)) {
      const best = sellOffer(id, fine);
      const worst = sellOffer(id, { wear: 1, bodyWear: 1, faults: 5 });
      expect(best.price).toBeLessThan(FOR_SALE[id].price);
      expect(worst.price).toBeLessThan(best.price);
      expect(worst.price).toBeGreaterThanOrEqual(Math.round((FOR_SALE[id].price * P.sellFloor) / 10) * 10 - 10);
    }
  });

  it('never pays more than the board charged for the same one, so buying to sell loses money', () => {
    for (const id of Object.keys(FOR_SALE)) {
      for (let i = 0; i < 300; i++) {
        const ad = makeAd(createRandom(i), id, byId[id], 0);
        // the best case for the seller: the engine as little worn as the second-hand spec allows, no faults
        expect(sellOffer(id, { wear: ad.wear * 0.5, bodyWear: ad.bodyWear, faults: 0 }).price, `${id} ${i}`).toBeLessThanOrEqual(ad.price);
      }
    }
  });

  it('says what pulled it down', () => {
    expect(sellOffer('red', fine).notes).toEqual([]);
    expect(sellOffer('red', { wear: 0.7, bodyWear: 0.8, faults: 2 }).notes).toEqual(['engine tired', 'rough body', '2 faults']);
    expect(sellOffer('red', { wear: 0, bodyWear: 0, faults: 1 }).notes).toEqual(['a fault']);
  });

  it('is nothing for what is not for sale', () => {
    expect(sellOffer('corsa', fine)).toBeNull();
  });
});

describe('selling', () => {
  const regulars = ['red', 'blue', 'yellow', 'green', 'orange'];
  const ctx = (onFarm) => ({ onFarm, regulars });

  it('takes the money now and puts a dealt model on the list to go in the morning', () => {
    const m = new Market(P);
    const before = m.purse;
    const r = m.sell('tractor', { price: 1500 }, ctx(['red', 'blue', 'tractor']));
    expect(r.price).toBe(1500);
    expect(m.purse).toBe(before + 1500);
    expect(m.sold).toEqual(['tractor']);
    expect(m.today.sold).toBe(1500);
  });

  it('removes a bought one from the bought list instead', () => {
    const m = new Market(P);
    m.bought = [{ specId: 'utv', colour: 1 }];
    m.sell('utv', { price: 900 }, ctx(['utv']));
    expect(m.bought).toEqual([]);
    expect(m.sold).toEqual([]);
  });

  it('will not sell the same one twice, one that is not for sale, or the last regular quads', () => {
    const m = new Market(P);
    m.sell('tractor', { price: 1 }, ctx(['tractor']));
    expect(m.sellWhyNot('tractor', ctx(['tractor']))).toMatch(/Already sold/);
    expect(m.sell('tractor', { price: 1 }, ctx(['tractor']))).toBeNull();
    expect(m.sellWhyNot('corsa', ctx(['corsa']))).toBeTruthy();
    expect(m.sellWhyNot('red', ctx(['red', 'blue']))).toMatch(/Keep 2/);
    expect(m.sellWhyNot('red', ctx(['red', 'blue', 'green']))).toBeNull();
    m.sold.push('green');
    expect(m.sellWhyNot('red', ctx(['red', 'blue', 'green']))).toMatch(/Keep 2/); // green is already going
  });

  it('is kept in the save, and the sold list drops anything that is not a model for sale', () => {
    const m = new Market(P);
    m.sell('tractor', { price: 5 }, ctx(['tractor']));
    const back = new Market(P);
    back.restore(JSON.parse(JSON.stringify({ ...m.toJSON(), sold: [...m.sold, 'corsa'] })));
    expect(back.sold).toEqual(['tractor']);
  });

  it('takes the sold models out of the fleet', () => {
    const out = withoutSold([byId.red, byId.tractor, byId.utv], ['tractor']);
    expect(out.map((x) => x.id)).toEqual(['red', 'utv']);
  });
});

describe('the day\'s money', () => {
  it('counts what came in, went out and was sold', () => {
    const m = new Market(P);
    m.earn(60);
    m.earn(60);
    expect(m.today).toEqual({ earned: 120, spent: 0, sold: 0 });
    expect(moneyFacts({ earned: 120, spent: 480, sold: 300 }, 1234)).toBe('£1,234 in the tin (earned £120, spent £480, sold for £300)');
    expect(moneyFacts({ earned: 0, spent: 0, sold: 0 }, 200)).toBe('£200 in the tin');
  });
});
