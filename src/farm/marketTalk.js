// When a girl remarks on the farm's money and the market, besides the moments the game calls out directly (you buy or sell, a job pays): the
// cork board has an ad while you are in the barn, the tin is low or well stocked while you are at it, and a vehicle you bought turns up in
// the yard. These are remarks, not choices (she is not deciding to do anything), so they have a cooldown each, not a place in the chooser.
// Pure: the game says what is true now and gets back the situation to speak, if any. Tested in tests/marketTalk.test.js.

export const DEFAULT_MARKET_TALK_PARAMS = {
  lowBelow: 60, // pounds: the tin is low under this
  highAbove: 1500, // pounds: and well stocked over this
  atTinRange: 9, // metres from the tin you must be for her to say anything about the tin or the board
  lowGap: 600, // seconds between her remarks that the tin is low...
  highGap: 900, // ...or well stocked
  adGap: 400, // and between her remarks that there is something on the board
  arrivedRange: 25, // metres from the new vehicle a girl must be to remark on it
  arrivedAfter: 8, // seconds into the day before she does, so it is not said as the page loads
  jobPaidChance: 0.3, // chance a girl comments when a job pays (a job also has its own line)
  buyChance: 0.9, // and when you buy
  sellChance: 0.9, // and when you sell
};

export const MARKET_TALK_RANGES = {
  lowBelow: [0, 500, 10],
  highAbove: [200, 10000, 50],
  atTinRange: [2, 30, 1],
  lowGap: [30, 3600, 30],
  highGap: [30, 3600, 30],
  adGap: [30, 3600, 30],
  arrivedRange: [5, 80, 1],
  arrivedAfter: [0, 120, 1],
  jobPaidChance: [0, 1, 0.05],
  buyChance: [0, 1, 0.05],
  sellChance: [0, 1, 0.05],
};

/** The situations a girl has lines for (moneyLines.js). */
export const MONEY_SITUATIONS = ['moneyBought', 'moneySold', 'moneyIn', 'moneyAd', 'moneyLow', 'moneyHigh', 'moneyArrived'];

export class MarketTalk {
  constructor(params = { ...DEFAULT_MARKET_TALK_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.last = {}; // situation -> clock when it was last said
    this.arrivalsSaid = false; // the new vehicles have been remarked on this day
    this.adsSaid = null; // the ads (their ids, joined) already remarked on
  }

  /** Whether `situation` has waited its gap since it was last said. */
  ready(situation, gap) {
    return this.last[situation] === undefined || this.clock - this.last[situation] >= gap;
  }

  /** She did say it: it waits now. */
  said(situation) {
    this.last[situation] = this.clock;
    if (situation === 'moneyArrived') this.arrivalsSaid = true;
  }

  /** She said what the ads were: not again for these ads. */
  saidAds(ads) {
    this.adsSaid = ads.map((a) => a.id).join(',');
    this.said('moneyAd');
  }

  /**
   * One step. `ctx`: { atTin: metres from you to the tin, girlNear: a girl who is free to remark is close to you, purse, ads: the board's ads,
   * arrivalGirlNear: a girl who is free to remark is near a vehicle that arrived this morning, arrivals: how many there are }.
   * Returns the situation to speak, or null.
   */
  update(dt, ctx) {
    this.clock += dt;
    const p = this.p;
    if (ctx.arrivals > 0 && !this.arrivalsSaid && ctx.arrivalGirlNear && this.clock >= p.arrivedAfter) return 'moneyArrived';
    if (ctx.atTin > p.atTinRange || !ctx.girlNear) return null;
    const adKey = ctx.ads.map((a) => a.id).join(',');
    if (ctx.ads.length && adKey !== this.adsSaid && this.ready('moneyAd', p.adGap)) return 'moneyAd';
    if (ctx.purse < p.lowBelow && this.ready('moneyLow', p.lowGap)) return 'moneyLow';
    if (ctx.purse > p.highAbove && this.ready('moneyHigh', p.highGap)) return 'moneyHigh';
    return null;
  }
}
