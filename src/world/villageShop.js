// Buying in the village (layout.village): fuel at the garage's pumps by the litre into the jerry can you hold, parts from the garage's rack, and
// sweets and a hot pasty at the shop.
// Pure: prices, what each treat does, the till's cooldowns and the pump's billing. world/villageHost.js is the game side.

export const DEFAULT_VILLAGE_PARAMS = {
  petrolPrice: 1.52, // £ a litre of unleaded at Hollis Motors
  dieselPrice: 1.58, // £ a litre of diesel (white, not the farm's red: the girls' cars, and it will do for the tractor in a pinch)
  sweetsPrice: 3, // £ for a bag of sweets for the girls from Pargeter's Stores
  sweetsFavour: 2.5, // favour each girl gives you for sweets
  sweetsEvery: 120, // s before another bag is worth as much (the till remembers; a second bag in that time pleases nobody)
  pastyPrice: 4, // £ for two hot pasties, one each
  pastyWarmth: 0.7, // how much of each girl's cold a hot pasty takes off (needs, 0..1)
  pastyFavour: 1.5, // favour each girl gives you for a pasty
  pastyEvery: 180, // s before another pasty is wanted
  plugPrice: 6, // £ for a spark plug off the garage's rack (the classifieds' rates: a quad is about £500, so parts are pocket money)
  tubePrice: 12, // £ for an inner tube
  beltPrice: 28, // £ for a drive belt
  tyreQuadPrice: 38, // £ for a quad tyre (one, off the stack by the roller door)
};

export const VILLAGE_PARAM_RANGES = {
  petrolPrice: [0.5, 4, 0.01],
  dieselPrice: [0.5, 4, 0.01],
  sweetsPrice: [0, 20, 0.5],
  sweetsFavour: [0, 10, 0.1],
  sweetsEvery: [0, 900, 10],
  pastyPrice: [0, 20, 0.5],
  pastyWarmth: [0, 1, 0.05],
  pastyFavour: [0, 10, 0.1],
  pastyEvery: [0, 900, 10],
  plugPrice: [0, 100, 1],
  tubePrice: [0, 100, 1],
  beltPrice: [0, 200, 1],
  tyreQuadPrice: [0, 200, 1],
};

/** What the shop sells: its label, the price's param, what it does to each girl, and the cooldown param. */
export const SHOP_STOCK = {
  sweets: { label: 'a bag of sweets for the girls', price: 'sweetsPrice', every: 'sweetsEvery', favour: 'sweetsFavour', warmth: null },
  pasty: { label: 'two hot pasties, one each', price: 'pastyPrice', every: 'pastyEvery', favour: 'pastyFavour', warmth: 'pastyWarmth' },
};

/** The fuels at the pumps: the price's param and what the can is filled with (the diesel one is the farm's own mix argument: petrol, oil, diesel). */
export const PUMP_FUELS = {
  petrol: { label: 'unleaded', price: 'petrolPrice', diesel: 0 },
  diesel: { label: 'diesel', price: 'dieselPrice', diesel: 1 },
};

/** What the garage's rack sells: spares-shelf part ids (workshop/spares.js) and the price's param. One at a time; it goes on the barn's rack. */
export const GARAGE_PARTS = {
  plug: { price: 'plugPrice' },
  tube: { price: 'tubePrice' },
  belt: { price: 'beltPrice' },
  tyreQuad: { price: 'tyreQuadPrice' },
};

const pounds = (n) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;
export { pounds };

/** The shop's till: when each thing was last bought, so a second bag of sweets straight after the first does not count for as much. */
export class Till {
  constructor() {
    this.since = {}; // item -> seconds since it was bought
  }

  update(dt) {
    for (const k of Object.keys(this.since)) this.since[k] += dt;
  }

  /** Seconds before this is worth buying again (0 when it is). */
  wait(item, P) {
    const left = P[SHOP_STOCK[item].every] - (this.since[item] ?? Infinity);
    return left > 0 ? left : 0;
  }

  /** Why you can't buy it now, or null. `purse` is what is in the tin. */
  whyNot(item, purse, P) {
    const price = P[SHOP_STOCK[item].price];
    if (this.wait(item, P) > 0) return item === 'sweets' ? 'The girls have just had their sweets' : 'The girls have just had a pasty';
    if (purse < price) return `You are ${pounds(price - purse)} short`;
    return null;
  }

  /** Buys it from `market` (anything with a `spend`): returns what it does, { price, favour, warmth }, or null if it can't be bought. */
  buy(item, market, P) {
    if (this.whyNot(item, market.purse, P)) return null;
    const stock = SHOP_STOCK[item];
    const price = P[stock.price];
    if (!market.spend(price)) return null;
    this.since[item] = 0;
    return { price, favour: P[stock.favour], warmth: stock.warmth ? P[stock.warmth] : 0 };
  }
}

/**
 * Why a part can't be bought from the garage now, or null. `shelf` is the barn's Spares (count/total/pack/p.maxOnShelf), `partName` what to call it.
 * It is refused when the rack at the barn could not hold one more (counting what is on order), as ordering is.
 */
export function partWhyNot(id, purse, shelf, P, partName) {
  const price = P[GARAGE_PARTS[id].price];
  if (shelf.total(id) + 1 > shelf.p.maxOnShelf) return `The rack at the barn is full of ${partName}s`;
  if (purse < price) return `You are ${pounds(price - purse)} short`;
  return null;
}

/** Buys one: the tin pays and it goes on the barn's rack. Returns { price } or null if it can't be bought. */
export function buyPart(id, market, shelf, P, partName) {
  if (partWhyNot(id, market.purse, shelf, P, partName)) return null;
  const price = P[GARAGE_PARTS[id].price];
  if (!market.spend(price)) return null;
  shelf.give(id);
  return { price };
}

/**
 * Billing for a fill at a pump. The tin is paid in whole pounds as the litres go in (the fraction owed carries over to the next fill, so the
 * pump never takes more than the litres were worth), and a fill stops when the tin can't pay the next pound.
 */
export class PumpBill {
  constructor() {
    this.owed = 0; // £, under a pound
    this.litres = 0; // this fill
    this.paid = 0;
  }

  /** Starts a fill (the owed fraction stays). */
  begin() {
    this.litres = 0;
    this.paid = 0;
  }

  /** How many of `want` litres the tin can pay for at `price` a litre now. */
  allow(want, price, market) {
    if (this.owed + want * price < 1) return want;
    const spare = market.purse + (1 - this.owed) - 1e-9; // what could still be paid, counting the pound that rounds this fraction up
    return Math.max(0, Math.min(want, spare / price));
  }

  /** The litres went in: pay for them. Returns false if the tin could not pay (nothing should have gone in). */
  charge(litres, price, market) {
    this.owed += litres * price;
    this.litres += litres;
    while (this.owed >= 1) {
      if (!market.spend(1)) return false;
      this.owed -= 1;
      this.paid += 1;
    }
    return true;
  }
}
