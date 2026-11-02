// Second-hand buying: the classified ads pinned up in the barn, the purse you pay from, and the vehicles you have bought (they turn up the next
// morning). Pure logic, no Three.js; the board is drawn in world/classifiedsView.js. Tested in tests/classifieds.test.js.
//
// Only a model that is not on the farm this game is advertised: the tractor, UTV and Land Rovers each have one slot in the game, and a
// second quad of a model that is here would share its id. Every vehicle spec has to be in FOR_SALE or NOT_FOR_SALE (a test fails for one that
// is in neither), so a vehicle added later joins the market or says why it stays out.

import { fullName } from '../vehicle/names.js';

export const DEFAULT_MARKET_PARAMS = {
  startPurseMin: 200, // a new farm starts with a purse dealt from the farm seed, between these (pounds)...
  startPurseMax: 600, // ...and this, in tens
  jobPay: 60, // pounds paid for each farm job ticked off the chalkboard
  adDayChance: 0.3, // chance a day has any ad on the board at all (most days there are none)
  secondAdChance: 0.3, // chance a day with an ad has a second
  thirdAdChance: 0.1, // and, given two, a third
  maxBought: 4, // vehicles you can have bought and not yet sold
  sellCeil: 0.7, // a vehicle in perfect order sells for this fraction of the going rate (below what the cheapest ad costs, so buying to sell never pays)...
  sellFloor: 0.4, // ...and a wrecked one for this
  keepRegulars: 2, // you cannot sell the regular quads below this many, so each girl has one to ride
  priceSpread: 0.12, // an ad's price is the going rate within this fraction either way
  wearDiscount: 0.35, // the fraction of the price a fully worn vehicle loses
};

const LEDGER_LENGTH = 5; // deals the tin's card remembers

export const MARKET_PARAM_RANGES = {
  startPurseMin: [0, 1000, 10],
  startPurseMax: [0, 2000, 10],
  jobPay: [0, 500, 5],
  adDayChance: [0, 1, 0.05],
  secondAdChance: [0, 1, 0.05],
  thirdAdChance: [0, 1, 0.05],
  maxBought: [0, 8, 1],
  sellCeil: [0.3, 1, 0.01],
  sellFloor: [0.1, 1, 0.01],
  keepRegulars: [0, 5, 1],
  priceSpread: [0, 0.5, 0.01],
  wearDiscount: [0, 0.8, 0.05],
};

// What can be advertised: `price` is the going rate in pounds for one in fair nick; `colours` are body colours the seller might have it in
// (the spec's own is always one of them). The ad names it from vehicle/names.js.
export const FOR_SALE = {
  red: { price: 520, colours: [0xa8271f, 0x1f5fb0, 0x2e2e30, 0xd8d4c8] },
  blue: { price: 560, colours: [0x1d4fa3, 0xa8271f, 0x2e2e30, 0x7f8a45] },
  yellow: { price: 480, colours: [0xe9c21b, 0x1d4fa3, 0xc8c4b8, 0x2e2e30] },
  green: { price: 600, colours: [0x33692c, 0x8a3a26, 0x2e2e30, 0xd8d4c8] },
  orange: { price: 640, colours: [0xe86a12, 0x1d4fa3, 0x2e2e30, 0xe9e6dc] },
  kids: { price: 180, colours: [0xd596ad, 0x4f8fd0, 0x6aa84f, 0xe0b030] },
  moto: { price: 240, colours: [0x3f6fa8, 0xa8271f, 0xe9c21b, 0x2e2e30] },
  ag200: { price: 420, colours: [0x1d4fa3, 0xe9c21b, 0xc8c4b8, 0x6b7a3a] },
  atc: { price: 280, colours: [0xb4553f, 0x3f6fa8, 0xd8d4c8, 0x6b7a3a] },
  tractor: { price: 3200, colours: [0xa82a20, 0x2c4f8a, 0x3a6a3a, 0xc8a02c] },
  utv: { price: 2400, colours: [0x3b5b3a, 0x8a6a3a, 0x2e2e30, 0xa82a20] },
  landrover: { price: 1700, colours: [0x3b4a36, 0xa8a090, 0x3f5f7a, 0x6b2a22] },
  landrover200: { price: 2600, colours: [0x3f5f7a, 0x3b4a36, 0xb8b4a8, 0x6b2a22] },
};

// Everything else in the spec files, and why it is not for sale. Another vehicle goes in one list or the other.
export const NOT_FOR_SALE = {
  loan: 'it is on loan, not ours to sell',
  plover: 'the old bike is the barn project, always under its tarp at the back: it is not for sale',
  fiesta: "the girls' own car, always on the farm (one slot; a second needs vehicles that can have several of a model)",
  corsa: "the girls' own car, always on the farm (one slot; a second needs vehicles that can have several of a model)",
  p309: 'your own car: you arrive in it every morning',
};

const COLOUR_NAMES = new Map([
  [0xa8271f, 'red'], [0x1f5fb0, 'blue'], [0x2e2e30, 'black'], [0xd8d4c8, 'white'], [0x1d4fa3, 'blue'], [0x7f8a45, 'olive'],
  [0xe9c21b, 'yellow'], [0xc8c4b8, 'cream'], [0x33692c, 'green'], [0x8a3a26, 'rust red'], [0xe86a12, 'orange'], [0xe9e6dc, 'white'],
  [0xd596ad, 'pink'], [0x4f8fd0, 'light blue'], [0x6aa84f, 'green'], [0xe0b030, 'yellow'], [0x3f6fa8, 'blue'], [0xb4553f, 'red'],
  [0x6b7a3a, 'olive green'], [0x2c4f8a, 'blue'], [0x3a6a3a, 'green'], [0xc8a02c, 'mustard'], [0x3b5b3a, 'green'], [0x8a6a3a, 'brown'],
  [0x3b4a36, 'bronze green'], [0xa8a090, 'sand'], [0x3f5f7a, 'blue'], [0x6b2a22, 'maroon'], [0xb8b4a8, 'silver'], [0xa82a20, 'red'],
]);

/** What a new farm starts with: a round number of pounds between the two limits, from the farm's seed. */
export function dealPurse(random, P = DEFAULT_MARKET_PARAMS) {
  const steps = Math.floor((P.startPurseMax - P.startPurseMin) / 10);
  return P.startPurseMin + Math.floor(random() * (steps + 1)) * 10;
}

/**
 * What a buyer offers for a vehicle on the farm, from the going rate and how it is: `cond` is { wear: engine wear 0..1, bodyWear: 0..1,
 * faults: how many it has } . Returns { price, notes } where notes say what pulled it down, for the card.
 */
export function sellOffer(specId, cond, P = DEFAULT_MARKET_PARAMS) {
  const sale = FOR_SALE[specId];
  if (!sale) return null;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const wear = clamp(cond.wear ?? 0);
  const body = clamp(cond.bodyWear ?? 0);
  const faults = Math.max(0, cond.faults ?? 0);
  const badness = clamp(0.5 * wear + 0.2 * body + 0.3 * Math.min(1, faults / 3));
  const fraction = P.sellCeil - (P.sellCeil - P.sellFloor) * badness;
  const notes = [];
  if (wear >= 0.5) notes.push('engine tired');
  if (body >= 0.6) notes.push('rough body');
  if (faults > 0) notes.push(faults === 1 ? 'a fault' : `${faults} faults`);
  return { price: Math.max(10, Math.round((sale.price * fraction) / 10) * 10), notes };
}

/** The fleet without the models you sold (they went in the morning). */
export function withoutSold(chosen, sold) {
  return chosen.filter((s) => !sold.includes(s.id));
}

/** The day's money in a line for the end-of-day card, or null on a day nothing happened. */
export function moneyFacts(today, purse) {
  const parts = [];
  if (today.earned) parts.push(`earned £${today.earned}`);
  if (today.spent) parts.push(`spent £${today.spent}`);
  if (today.sold) parts.push(`sold for £${today.sold}`);
  return `£${purse.toLocaleString('en-GB')} in the tin${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

export function colourName(colour) {
  return COLOUR_NAMES.get(colour) ?? 'painted';
}

/** The spec ids a spec list has that are in neither list (a test fails if any). */
export function unlistedSpecs(specs) {
  return specs.map((s) => s.id).filter((id) => !(id in FOR_SALE) && !(id in NOT_FOR_SALE));
}

/**
 * The ads on the board for a day. `onFarm` is the ids of the models here this game (they are not advertised), `owned` the bought records so far
 * (a model you bought is on its way, so it is not advertised either). Most days there are none. The same random numbers give the same board.
 * An ad: { id, specId, colour, hours, miles, wear, bodyWear, price, text }. `specs` maps id to the spec (for the hour and mile ranges).
 */
export function dealAds(random, { specs, onFarm = [], owned = [], P = DEFAULT_MARKET_PARAMS }) {
  if (owned.length >= P.maxBought || random() >= P.adDayChance) return [];
  let count = 1;
  if (random() < P.secondAdChance) count += 1 + (random() < P.thirdAdChance ? 1 : 0);
  const left = Object.keys(FOR_SALE).filter((id) => specs[id] && !onFarm.includes(id) && !owned.some((o) => o.specId === id));
  const ads = [];
  while (ads.length < count && left.length) {
    const specId = left.splice(Math.floor(random() * left.length), 1)[0];
    ads.push(makeAd(random, specId, specs[specId], ads.length, P));
  }
  return ads;
}

/** One ad for a model: a colour, readings and wear picked from the spec's own ranges (leaning towards the old end) and a price to match. */
export function makeAd(random, specId, spec, n, P = DEFAULT_MARKET_PARAMS) {
  const sale = FOR_SALE[specId];
  const colour = sale.colours[Math.floor(random() * sale.colours.length)];
  const lean = Math.sqrt(random()); // towards the high end
  const [hLo, hHi] = spec.hoursRange ?? [0, 0];
  const [oLo, oHi] = spec.odoRange ?? [0, 0];
  const hours = Math.round(hLo + (hHi - hLo) * lean);
  const miles = Math.round(oLo + (oHi - oLo) * lean);
  const wear = Math.round((0.15 + 0.6 * lean) * 100) / 100; // how worn the body looks
  const rate = 1 + (random() * 2 - 1) * P.priceSpread;
  const price = Math.max(10, Math.round((sale.price * rate * (1 - P.wearDiscount * wear)) / 10) * 10);
  return { id: `ad${n}-${specId}`, specId, colour, hours, miles, wear, bodyWear: wear, price, text: adText(specId, colour, hours, wear, price) };
}

/** How the ad reads on the board: what it is, how it has been looked after, and the price. */
export function adText(specId, colour, hours, wear, price) {
  const state = wear < 0.3 ? 'Good order' : wear < 0.55 ? 'Some wear' : 'Well used';
  return `${colourName(colour)} ${fullName(specId)}. ${state}, ${hours.toLocaleString('en-GB')} hrs. £${price.toLocaleString('en-GB')} ono`;
}

/** The spec a bought vehicle has: the model's own with the colour and readings it was sold with. Same id, so everything that knows the model still does. */
export function usedSpec(spec, record) {
  return {
    ...spec,
    bodyColor: record.colour,
    hoursRange: [record.hours, record.hours + 1], // a range with some width: the tractor and UTV divide by it
    odoRange: [record.miles, record.miles + 1],
    bodyWear: record.bodyWear,
    wearRange: [Math.max(spec.wearRange?.[0] ?? 0, record.wear * 0.5), Math.max(spec.wearRange?.[1] ?? 0, record.wear * 0.7)],
  };
}

/** The money, and the vehicles bought but not yet sold. Saved with the farm. */
export class Market {
  constructor(P = DEFAULT_MARKET_PARAMS, random = null) {
    this.p = P;
    this.purse = random ? dealPurse(random, P) : P.startPurseMin;
    this.bought = []; // { specId, colour, hours, miles, wear, bodyWear, price }
    this.sold = []; // models sold that were dealt with the farm: they leave the fleet in the morning
    this.ads = [];
    this.today = { earned: 0, spent: 0, sold: 0 }; // this day's money, for the end-of-day card (not kept)
    this.ledger = []; // the last few buys and sells, newest last: { day, deal: 'bought' | 'sold', specId, price } (the tin's card)
  }

  note(day, deal, specId, price) {
    this.ledger.push({ day, deal, specId, price });
    while (this.ledger.length > LEDGER_LENGTH) this.ledger.shift();
  }

  /** The vehicles bought yesterday, which turned up this morning (`day` is today). */
  arrivals(day) {
    return this.bought.filter((b) => Number.isFinite(b.boughtDay) && b.boughtDay === day - 1);
  }

  earn(amount) {
    this.purse += amount;
    this.today.earned += amount;
  }

  /** Pays `amount` out of the tin for something small (fuel, the shop): false, and nothing taken, if the tin hasn't got it. */
  spend(amount) {
    if (!(amount > 0) || this.purse < amount) return false;
    this.purse -= amount;
    this.today.spent += amount;
    return true;
  }

  /** Why this model can't be sold now, or null if it can. `onFarm` is the models here, `regulars` the regular quads' ids. */
  sellWhyNot(specId, { onFarm, regulars }, P = this.p) {
    if (!(specId in FOR_SALE)) return NOT_FOR_SALE[specId] ? 'Not ours to sell' : 'Nobody wants that';
    if (this.sold.includes(specId)) return 'Already sold: it goes in the morning';
    if (regulars.includes(specId)) {
      const left = regulars.filter((id) => id !== specId && onFarm.includes(id) && !this.sold.includes(id)).length;
      if (left < P.keepRegulars) return `Keep ${P.keepRegulars} of the regular quads for the girls`;
    }
    return null;
  }

  /** Takes the offer: the money now, and the vehicle gone in the morning. Returns { price } or null if it can't be sold. */
  sell(specId, offer, ctx, day = null) {
    if (this.sellWhyNot(specId, ctx)) return null;
    const at = this.bought.findIndex((b) => b.specId === specId);
    if (at >= 0) this.bought.splice(at, 1);
    else this.sold.push(specId);
    this.purse += offer.price;
    this.today.sold += offer.price;
    this.note(day, 'sold', specId, offer.price);
    return { price: offer.price };
  }

  /** Why the ad can't be bought right now, or null if it can. */
  whyNot(ad) {
    if (!this.ads.includes(ad)) return 'That one has gone';
    if (this.bought.length >= this.p.maxBought) return `You can't take on more than ${this.p.maxBought} bought vehicles`;
    if (this.purse < ad.price) return `You are £${ad.price - this.purse} short`;
    return null;
  }

  /** Pays for the ad and takes it off the board; it turns up next morning. Returns the record, or null if it can't be bought. */
  buy(ad, day = null) {
    if (this.whyNot(ad)) return null;
    this.purse -= ad.price;
    this.today.spent += ad.price;
    this.ads = this.ads.filter((a) => a !== ad);
    const { specId, colour, hours, miles, wear, bodyWear, price } = ad;
    const record = { specId, colour, hours, miles, wear, bodyWear, price, boughtDay: day };
    this.bought.push(record);
    this.note(day, 'bought', specId, price);
    return record;
  }

  toJSON() {
    return { purse: this.purse, bought: this.bought.map((b) => ({ ...b })), sold: [...this.sold], ledger: this.ledger.map((l) => ({ ...l })) };
  }

  restore(s) {
    if (!s) return;
    if (Number.isFinite(s.purse)) this.purse = s.purse;
    if (Array.isArray(s.ledger)) this.ledger = s.ledger.filter((l) => l && (l.deal === 'bought' || l.deal === 'sold') && l.specId in FOR_SALE && Number.isFinite(l.price)).map((l) => ({ ...l })).slice(-LEDGER_LENGTH);
    if (Array.isArray(s.sold)) this.sold = s.sold.filter((id) => id in FOR_SALE);
    if (Array.isArray(s.bought)) this.bought = s.bought.filter((b) => b && b.specId in FOR_SALE && Number.isFinite(b.colour)).map((b) => ({ ...b }));
  }
}

/** The fleet with the bought vehicles in it: each is forced in, in its second-hand spec, in place of the dealt one of the same model. */
export function withBought(chosen, bought, specs) {
  const out = chosen.slice();
  for (const b of bought) {
    const base = specs[b.specId];
    if (!base) continue;
    const used = usedSpec(base, b);
    const at = out.findIndex((s) => s.id === b.specId);
    if (at >= 0) out[at] = used;
    else out.push(used);
  }
  return out;
}

/** How full the tin looks, 0 (a coin or two) to 4 (notes piled over the rim), from what is in it. */
export function tinLevel(purse, steps = TIN_STEPS) {
  return steps.filter((at) => purse >= at).length;
}

export const TIN_STEPS = [100, 400, 1000, 2500];

/** One ledger line for the tin's card: "Day 3: bought the Tamura Hornet 200 for £480". */
export function ledgerText(entry) {
  return `${entry.day ? `Day ${entry.day}: ` : ''}${entry.deal === 'sold' ? 'sold' : 'bought'} the ${fullName(entry.specId)} for £${entry.price.toLocaleString('en-GB')}`;
}
