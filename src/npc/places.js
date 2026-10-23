// Places to be. On a fine day a bored girl might go and sit on the straw bales or
// the paddock fence rather than only wait at a quad; when the rain sets in, a
// girl who's about can head for the barn doorway (an offer, weighed by her needs
// in chooser.js against a cab and the rest) and stays there till it dries off.
// After dark the doorway pulls the same way (going in), and she stays in.
// Pure logic: the game says what the weather and the girls are doing and where
// the spots are, and does the walking and sitting this module asks for.
//
// A spot is { id, kind: 'bale' | 'fence' | 'bench' | 'shelter', x, z, yaw, seat? }. `seat` is the
// height she sits at (none for shelter, where she stands); `yaw` the way she faces.

import { DEFAULT_DOZE_PARAMS, DOZE_PARAM_RANGES } from './dozing.js';

export const DEFAULT_PLACE_PARAMS = {
  ...DEFAULT_DOZE_PARAMS, // dozing on the bales when sleepy (dozing.js)
  fineBelow: 0.05, // rain (0..1) below which a sunny day counts as fine for sitting out
  rainAbove: 0.25, // rain above which they go looking for cover
  dryBelow: 0.08, // rain below which they come out of the barn again
  shelterWeight: 1, // how much she cares for the barn doorway out of the rain (a cab is weighed against it, chooser.js)
  darkAbove: 0.6, // how dark (0 day, 1 night) before she wants to go in, and won't come out again
  goInWeight: 1, // how much she cares for going in out of the dark (weighed against a cab with the heater on and the rest)
  dryDelayMin: 15, // seconds after it dries off before she comes out
  dryDelayMax: 45,
  shelterFrom: 150, // metres: how far away she'll still run to the barn from (anywhere on the farm)
  restFrom: 45, // metres: how far she'll walk to sit somewhere
  restStayMin: 60, // seconds she sits out for
  restStayMax: 180,
};

export const PLACE_PARAM_RANGES = {
  ...DOZE_PARAM_RANGES,
  fineBelow: [0, 0.5, 0.01],
  rainAbove: [0.05, 1, 0.01],
  dryBelow: [0, 0.5, 0.01],
  shelterWeight: [0, 3, 0.05],
  darkAbove: [0, 1, 0.01],
  goInWeight: [0, 3, 0.05],
  dryDelayMin: [0, 120, 1],
  dryDelayMax: [0, 240, 1],
  shelterFrom: [10, 300, 5],
  restFrom: [5, 150, 5],
  restStayMin: [10, 600, 5],
  restStayMax: [10, 900, 5],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Whether it's a nice day for sitting out: a sunny kind of day, and dry. */
export function isFine(weatherName, rain, p = DEFAULT_PLACE_PARAMS) {
  return (weatherName === 'sunny' || weatherName === 'sunny intervals') && rain < p.fineBelow;
}

/**
 * The nearest free spot of these kinds within `range` of her, or null. `taken` is
 * a Set of spot ids someone's using or heading for; ties go to the first listed.
 */
export function nearestSpot(spots, kinds, from, taken, range) {
  let best = null;
  let bestD = range;
  for (const s of spots) {
    if (!kinds.includes(s.kind) || taken.has(s.id)) continue;
    const d = dist(s, from);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** How long she sits out for. */
export function restStay(p, random = Math.random) {
  return p.restStayMin + random() * Math.max(0, p.restStayMax - p.restStayMin);
}

export class Places {
  constructor(params = { ...DEFAULT_PLACE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.dryFor = {}; // girl id -> seconds it's been dry while she's at the barn
    this.delay = {}; // girl id -> how long she'll wait before acting
    this.taken = new Set();
  }

  /**
   * One step. `ctx`:
   *   rain: 0..1
   *   dark: 0 (day) to 1 (night)
   *   spots: [{ id, kind, x, z, ... }]
   *   girls: [{ id, x, z, state, spot }]
   *     state: 'idle' (stood about), 'resting' (at a spot, free to be moved), 'busy' (anything else)
   *     spot: the spot she's at or heading for, if any
   * Returns actions: { girl, do: 'leave' } (come out of the barn once it's dry). Going in is an offer (offers, take).
   */
  update(dt, ctx) {
    const p = this.p;
    this.taken = new Set(ctx.girls.map((g) => g.spot?.id).filter(Boolean));
    const actions = [];
    for (const g of ctx.girls) {
      const atShelter = g.spot?.kind === 'shelter';
      if (ctx.rain > p.rainAbove) {
        this.dryFor[g.id] = 0;
        delete this.delay[g.id];
      } else {
        if (!atShelter || g.state !== 'resting' || ctx.rain > p.dryBelow || (ctx.dark ?? 0) > p.darkAbove) {
          this.dryFor[g.id] = 0;
          continue;
        }
        this.dryFor[g.id] = (this.dryFor[g.id] ?? 0) + dt;
        this.delay[g.id] ??= p.dryDelayMin + this.random() * (p.dryDelayMax - p.dryDelayMin);
        if (this.dryFor[g.id] >= this.delay[g.id]) {
          this.dryFor[g.id] = 0;
          delete this.delay[g.id];
          actions.push({ girl: g.id, do: 'leave' });
        }
      }
    }
    return actions;
  }

  /**
   * The barn doorway for each girl who could run for it now (the same `ctx` as update): [{ key: 'shelterBarn', girl, spot, weight }]
   * for the chooser. Only in the rain, for a girl stood about or sat out somewhere (not one already in the dry), to a free spot in range.
   */
  offers(ctx) {
    const p = this.p;
    const raining = ctx.rain > p.rainAbove;
    const dark = (ctx.dark ?? 0) > p.darkAbove;
    const taken = new Set(ctx.girls.map((g) => g.spot?.id).filter(Boolean));
    const out = [];
    // A warm, bright, dry afternoon: a girl stood about can doze on a free bale (what she wants is the chooser's: her sleepiness).
    if (ctx.fine && !dark && (ctx.sun ?? 0) >= p.dozeSunAbove) {
      for (const g of ctx.girls) {
        if (g.state !== 'idle') continue;
        const spot = nearestSpot(ctx.spots, ['bale'], g, taken, p.restFrom);
        if (spot) out.push({ key: 'doze', girl: g.id, spot, weight: g.dozeWeight ?? 1 });
      }
    }
    if (!raining && !dark) return out;
    for (const g of ctx.girls) {
      if (g.spot?.kind === 'shelter' || g.state === 'busy') continue;
      const spot = nearestSpot(ctx.spots, ['shelter'], g, taken, p.shelterFrom);
      if (!spot) continue;
      if (raining) out.push({ key: 'shelterBarn', girl: g.id, spot, weight: p.shelterWeight });
      else out.push({ key: 'goIn', girl: g.id, spot, weight: p.goInWeight });
    }
    return out;
  }

  /** She chose to run for it (or go in out of the dark), or to doze: returns the action the game carries out, { girl, do: 'shelter' | 'doze', spot, dark }. */
  take(offer) {
    this.taken.add(offer.spot.id);
    if (offer.key === 'doze') return { girl: offer.girl, do: 'doze', spot: offer.spot };
    return { girl: offer.girl, do: 'shelter', spot: offer.spot, dark: offer.key === 'goIn' };
  }
}
