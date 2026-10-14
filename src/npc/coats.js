// Wax jackets from the barn. Two hang at the far end of the jumper rack, waxed cotton with corduroy collars, and when it has been
// raining on her for a while a girl stood about goes and puts one on, over her jumper if she has one. Once it has been dry for a
// good while she hangs it back up. The hood is up while it's really raining, and down behind the collar otherwise, under a
// helmet, or with a roof over her. It works as the jumpers do (jumpers.js); only the weather that calls for it differs.

import { Jumpers } from './jumpers.js';

export const DEFAULT_COAT_PARAMS = {
  startAfter: 20, // seconds into the game before anyone thinks of a coat
  wetFor: 15, // seconds a girl has been rained on before she goes for one
  dryFor: 120, // seconds of dry weather before she hangs it up again (showers come back)
  weight: 1.2, // how much she cares for fetching a coat once she's been rained on (chooser.js weighs it)
  wetAbove: 0.2, // rain (0..1) above which she wants a coat
  hoodUpAbove: 0.3, // rain over which her hood goes up
  hoodDownBelow: 0.12, // and under which it goes down again (between the two it stays as it is)
  range: 160, // metres: how far she'll walk to the barn for one
  timeout: 60, // seconds she has to get to the rack before it's forgotten
};

export const COAT_PARAM_RANGES = {
  startAfter: [0, 600, 10],
  wetFor: [0, 300, 5],
  dryFor: [0, 600, 5],
  weight: [0, 3, 0.05],
  wetAbove: [0, 1, 0.05],
  hoodUpAbove: [0, 1, 0.05],
  hoodDownBelow: [0, 1, 0.05],
  range: [10, 300, 5],
  timeout: [10, 180, 5],
};

/** The coats on the rack, by where they hang, and the colours they have unless the farm deals others (dealCoatColours). */
export const COATS = [
  { id: 'coatLeft', color: '#4b4a32' },
  { id: 'coatRight', color: '#5a4630' },
];

/** What the farm's wax jackets can be: the usual waxed cotton colours. */
export const COAT_PALETTE = [
  { name: 'olive', color: '#4b4a32' },
  { name: 'sage', color: '#6b6f52' },
  { name: 'navy', color: '#2b3141' },
  { name: 'rustic brown', color: '#5a4630' },
];

/** The corduroy of the collar, the same on every coat. */
export const COAT_COLLAR_COLOUR = '#5b3f28';

/** The farm's coats' colours, a different pair for each farm (from its own stream of the farm seed). */
export function dealCoatColours(random, count = COATS.length) {
  const left = COAT_PALETTE.slice();
  const out = [];
  for (let i = 0; i < count && left.length; i++) out.push(left.splice(Math.floor(random() * left.length), 1)[0].color);
  return out;
}

/** Whether it's a day for a coat: raining. */
export function isCoatWeather(weather, p) {
  return weather.rain > p.wetAbove;
}

/**
 * Whether her hood is up: only with a coat on, never under a helmet or a roof, up in proper rain and down once it has nearly
 * stopped, staying as it was in between so it doesn't flap up and down as a shower comes and goes.
 */
export function hoodUp(was, { coat, helmet, covered, rain }, p) {
  if (!coat || helmet || covered) return false;
  if (rain > p.hoodUpAbove) return true;
  if (rain < p.hoodDownBelow) return false;
  return !!was;
}

export class Coats extends Jumpers {
  constructor(params = { ...DEFAULT_COAT_PARAMS }, random = Math.random, colours = null) {
    super(params, random, colours, COATS);
    this.key = 'coat';
    this.hoods = {}; // girl id -> true while her hood is up
    this.hoodHeld = {}; // girl id -> { up, until }: the debug panel put it up or down, whatever the rain, for a while
  }

  /** The debug panel: her hood the other way for `secs` seconds, whatever the rain (she still needs a coat on). */
  toggleHood(girl, secs = 60) {
    this.hoodHeld[girl] = { up: !this.hoods[girl], until: this.clock + secs };
    return this.hoodHeld[girl].up;
  }

  /** Whether she has a coat on and where her hood is, for the debug panel and console. */
  describe(girl) {
    const coat = this.worn[girl];
    const job = this.pending[girl];
    if (job) return job.kind === 'fetch' ? 'on her way to the rack for a coat' : 'on her way to hang her coat up';
    if (!coat) return 'none';
    return `on, hood ${this.hoods[girl] ? 'up' : 'down'}`;
  }

  wanted(weather) {
    return isCoatWeather(weather, this.p);
  }

  get onAfter() {
    return this.p.wetFor;
  }

  get offAfter() {
    return this.p.dryFor;
  }

  /**
   * Hoods up or down. `girls`: [{ id, helmet, covered }] (helmet on her head; a roof over her). Returns the girls whose hood
   * changed, [{ girl, up }].
   */
  updateHoods(rain, girls) {
    const out = [];
    for (const g of girls) {
      const was = !!this.hoods[g.id];
      const held = this.hoodHeld[g.id];
      if (held && this.clock > held.until) delete this.hoodHeld[g.id];
      const up = this.hoodHeld[g.id] && this.worn[g.id] ? this.hoodHeld[g.id].up : hoodUp(was, { coat: !!this.worn[g.id], helmet: g.helmet, covered: g.covered, rain }, this.p);
      if (up !== was) {
        this.hoods[g.id] = up;
        out.push({ girl: g.id, up });
      }
    }
    return out;
  }
}
