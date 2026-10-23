import { describe, it, expect } from 'vitest';
import { Spares, ALL_PART_IDS, DEFAULT_SPARES_PARAMS } from '../src/workshop/spares.js';
import { Market } from '../src/farm/classifieds.js';
import { DEFAULT_VILLAGE_PARAMS, VILLAGE_PARAM_RANGES, SHOP_STOCK, PUMP_FUELS, GARAGE_PARTS, partWhyNot, buyPart, Till, PumpBill } from '../src/world/villageShop.js';

const P = DEFAULT_VILLAGE_PARAMS;
const tin = (purse) => {
  const m = new Market();
  m.purse = purse;
  return m;
};

describe('the market spends small amounts', () => {
  it('takes what you pay out of the tin and counts it for the day', () => {
    const m = tin(20);
    expect(m.spend(7)).toBe(true);
    expect(m.purse).toBe(13);
    expect(m.today.spent).toBe(7);
  });
  it('takes nothing if the tin cannot pay', () => {
    const m = tin(5);
    expect(m.spend(6)).toBe(false);
    expect(m.purse).toBe(5);
    expect(m.spend(0)).toBe(false);
    expect(m.spend(-3)).toBe(false);
  });
});

describe('the village params', () => {
  it('has a range for each, with the default inside it', () => {
    for (const [k, v] of Object.entries(P)) {
      const [min, max] = VILLAGE_PARAM_RANGES[k];
      expect(v, k).toBeGreaterThanOrEqual(min);
      expect(v, k).toBeLessThanOrEqual(max);
    }
    for (const k of Object.keys(VILLAGE_PARAM_RANGES)) expect(P, k).toHaveProperty(k);
  });
  it('names a price, a cooldown and an effect that exist for each thing the shop sells, and a price for each fuel', () => {
    for (const item of Object.values(SHOP_STOCK)) {
      expect(P).toHaveProperty(item.price);
      expect(P).toHaveProperty(item.every);
      expect(P).toHaveProperty(item.favour);
      if (item.warmth) expect(P).toHaveProperty(item.warmth);
    }
    for (const f of Object.values(PUMP_FUELS)) expect(P).toHaveProperty(f.price);
  });
});

describe('the shop till', () => {
  it('sells the sweets for the price and says what they do', () => {
    const t = new Till();
    const m = tin(10);
    const got = t.buy('sweets', m, P);
    expect(got).toEqual({ price: P.sweetsPrice, favour: P.sweetsFavour, warmth: 0 });
    expect(m.purse).toBe(10 - P.sweetsPrice);
  });
  it('a pasty warms the girls', () => {
    expect(new Till().buy('pasty', tin(10), P).warmth).toBe(P.pastyWarmth);
  });
  it('will not sell what the tin cannot pay for, and says how short you are', () => {
    const t = new Till();
    const m = tin(1);
    expect(t.whyNot('sweets', m.purse, P)).toBe(`You are £${P.sweetsPrice - 1} short`);
    expect(t.buy('sweets', m, P)).toBeNull();
    expect(m.purse).toBe(1);
  });
  it('a second bag straight after the first is not wanted, until the cooldown is up', () => {
    const t = new Till();
    const m = tin(50);
    t.buy('sweets', m, P);
    expect(t.whyNot('sweets', m.purse, P)).toMatch(/just had/);
    expect(t.buy('sweets', m, P)).toBeNull();
    t.update(P.sweetsEvery + 1);
    expect(t.buy('sweets', m, P)).not.toBeNull();
  });
  it('keeps the cooldowns apart', () => {
    const t = new Till();
    const m = tin(50);
    t.buy('sweets', m, P);
    expect(t.whyNot('pasty', m.purse, P)).toBeNull();
  });
});

describe('the pump bill', () => {
  it('bills in whole pounds as the litres go in and carries the fraction over', () => {
    const b = new PumpBill();
    const m = tin(100);
    b.begin();
    for (let i = 0; i < 10; i++) expect(b.charge(1, P.petrolPrice, m)).toBe(true); // 10 L at £1.52 = £15.20
    expect(b.paid).toBe(15);
    expect(m.purse).toBe(85);
    expect(b.owed).toBeCloseTo(0.2, 6);
    b.begin(); // the next fill starts with the fraction still owed
    expect(b.owed).toBeCloseTo(0.2, 6);
  });
  it('never takes more than the litres were worth', () => {
    const b = new PumpBill();
    const m = tin(1000);
    b.begin();
    for (let i = 0; i < 400; i++) b.charge(0.05, 1.58, m); // 20 L
    expect(1000 - m.purse + b.owed).toBeCloseTo(20 * 1.58, 6);
  });
  it('lets a small fill through free of the tin until a pound is owed', () => {
    const b = new PumpBill();
    expect(b.allow(0.2, 1.52, tin(0))).toBe(0.2);
  });
  it('stops a fill when the tin can no longer pay', () => {
    const b = new PumpBill();
    const m = tin(3);
    b.begin();
    let litres = 0;
    for (let i = 0; i < 400; i++) {
      const ok = b.allow(0.1, 1.52, m);
      if (ok <= 0) break;
      expect(b.charge(ok, 1.52, m)).toBe(true);
      litres += ok;
    }
    expect(m.purse).toBeGreaterThanOrEqual(0);
    expect(litres).toBeGreaterThan(1.9); // £3 and a little over, at £1.52 a litre
    expect(litres).toBeLessThan(2.7);
    expect(b.allow(0.1, 1.52, m)).toBe(0);
  });
  it('a tin of nothing buys nothing', () => {
    const b = new PumpBill();
    const m = tin(0);
    b.begin();
    b.charge(0.9, 1.52, m);
    expect(b.allow(1, 1.52, m)).toBeLessThan(1);
  });
});

describe('parts from the garage', () => {
  const shelf = () => new Spares({ ...DEFAULT_SPARES_PARAMS }, () => 0.5);

  it('sells only parts the spares shelf counts, each with a price', () => {
    for (const [id, part] of Object.entries(GARAGE_PARTS)) {
      expect(ALL_PART_IDS, id).toContain(id);
      expect(P, id).toHaveProperty(part.price);
    }
  });
  it('takes the price from the tin and puts one on the rack', () => {
    const m = tin(50);
    const s = shelf();
    const before = s.count('plug');
    expect(buyPart('plug', m, s, P, 'spark plug')).toEqual({ price: P.plugPrice });
    expect(m.purse).toBe(50 - P.plugPrice);
    expect(s.count('plug')).toBe(before + 1);
  });
  it('refuses when the tin is short, and changes nothing', () => {
    const m = tin(P.beltPrice - 1);
    const s = shelf();
    const before = s.count('belt');
    expect(partWhyNot('belt', m.purse, s, P, 'drive belt')).toBe('You are £1 short');
    expect(buyPart('belt', m, s, P, 'drive belt')).toBeNull();
    expect(m.purse).toBe(P.beltPrice - 1);
    expect(s.count('belt')).toBe(before);
  });
  it('refuses when the rack at the barn has no room, counting what is on order', () => {
    const m = tin(500);
    const s = shelf();
    s.counts.tube = s.p.maxOnShelf - 1;
    s.ordered.tube = 1;
    expect(partWhyNot('tube', m.purse, s, P, 'inner tube')).toBe('The rack at the barn is full of inner tubes');
    expect(buyPart('tube', m, s, P, 'inner tube')).toBeNull();
    expect(m.purse).toBe(500);
  });
});
