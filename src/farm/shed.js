// The barn's shed kit, built up over games (DECISIONS.md, #32): a compressor, a parts washer and a pit, bought from the catalogue that hangs under
// the cork board with money from the tin. A piece paid for today stands in the barn tomorrow morning, like a second-hand vehicle. Each puts
// right faults that nothing else can (vehicle/shedFaults.js, workshop/shedJobs.js). Pure, tested.

export const SHED_PIECES = {
  compressor: {
    name: 'Compressor',
    blurb: 'Sets the tyre pressures (the toolbox pump is gone), and seals a leaking bead, a dud valve core and uneven or cold-shrunk tyres.',
  },
  washer: {
    name: 'Parts washer',
    blurb: 'A solvent tank for the carb, the fuel tap and its filter, the chain and the brakes: gummed, clogged and caked parts come clean.',
  },
  pit: {
    name: 'Inspection pit',
    blurb: 'Drive a vehicle over it and work from underneath: a holed silencer, a weeping sump gasket, a dragging caliper and a worn wheel bearing.',
  },
};

export const SHED_PIECE_IDS = Object.keys(SHED_PIECES);

export const DEFAULT_SHED_PARAMS = {
  compressorPrice: 120, // £ for the compressor
  washerPrice: 200, // £ for the parts washer
  pitPrice: 450, // £ for the pit
  hoseReach: 9, // metres from the compressor a vehicle can be and still be reached by its hose (the pressure settings in the toolbox)
};

export const SHED_PARAM_RANGES = {
  compressorPrice: [0, 2000, 10],
  washerPrice: [0, 2000, 10],
  pitPrice: [0, 3000, 10],
  hoseReach: [2, 30, 1],
};

export class Shed {
  constructor(P = DEFAULT_SHED_PARAMS) {
    this.p = P;
    this.bought = []; // { piece, boughtDay }
  }

  price(piece) {
    return this.p[`${piece}Price`];
  }

  /** Paid for, whether or not it has turned up yet. */
  ordered(piece) {
    return this.bought.some((b) => b.piece === piece);
  }

  /** Standing in the barn: paid for on an earlier day, so it was delivered in the morning. `day` is today. A piece with no day recorded is old stock. */
  has(piece, day) {
    return this.bought.some((b) => b.piece === piece && (!Number.isFinite(b.boughtDay) || b.boughtDay < day));
  }

  /** Paid for today, due tomorrow morning. */
  onTheWay(piece, day) {
    return this.ordered(piece) && !this.has(piece, day);
  }

  /** Pieces that turned up this morning (`day` is today). */
  arrivals(day) {
    return this.bought.filter((b) => Number.isFinite(b.boughtDay) && b.boughtDay === day - 1).map((b) => b.piece);
  }

  /** Why it can't be bought now, or null if it can. `purse` is what is in the tin. */
  whyNot(piece, purse) {
    if (!(piece in SHED_PIECES)) return 'The catalogue has no such thing';
    if (this.ordered(piece)) return 'You have this already';
    const price = this.price(piece);
    if (purse < price) return `You are £${price - purse} short`;
    return null;
  }

  /** Pays from `market` (anything with `purse` and `today.spent`) and orders it. Returns the piece's record, or null if it can't be bought. */
  buy(piece, market, day = null) {
    if (this.whyNot(piece, market.purse)) return null;
    const price = this.price(piece);
    market.purse -= price;
    market.today.spent += price;
    const record = { piece, boughtDay: day };
    this.bought.push(record);
    return record;
  }

  /** Hands the piece over at once (the debug panel and the console). */
  give(piece) {
    if (!(piece in SHED_PIECES)) return false;
    this.bought = this.bought.filter((b) => b.piece !== piece);
    this.bought.push({ piece, boughtDay: null });
    return true;
  }

  take(piece) {
    this.bought = this.bought.filter((b) => b.piece !== piece);
  }

  toJSON() {
    return { bought: this.bought.map((b) => ({ ...b })) };
  }

  restore(s) {
    if (!s || !Array.isArray(s.bought)) return;
    this.bought = s.bought.filter((b) => b && b.piece in SHED_PIECES && (b.boughtDay === null || Number.isFinite(b.boughtDay))).map((b) => ({ piece: b.piece, boughtDay: b.boughtDay ?? null }));
  }
}

/**
 * Why a vehicle's tyre pressures can't be changed from the toolbox, or null if they can: the pump is gone, they are set at the barn's compressor, so it has to
 * be bought and delivered, and the vehicle within the hose's reach.
 */
export function pressureWhyNot(shed, day, compressor, x, z, reach = DEFAULT_SHED_PARAMS.hoseReach) {
  if (!shed.has('compressor', day)) {
    return shed.onTheWay('compressor', day)
      ? 'The compressor turns up tomorrow morning'
      : 'The toolbox pump is gone: tyre pressures are set at a compressor. There is one in the catalogue under the cork board';
  }
  return inHoseReach(compressor, x, z, reach) ? null : "The compressor's hose does not reach this far: bring it into the barn";
}

/** Whether a vehicle at (x, z) is within the compressor hose's reach. */
export function inHoseReach(compressor, x, z, reach = DEFAULT_SHED_PARAMS.hoseReach) {
  return Math.hypot(x - compressor.x, z - compressor.z) <= reach;
}
