// Places to be. On a fine day a bored girl might go and sit on the straw bales or
// the paddock fence rather than only wait at a quad; when the rain sets in, any
// girl who's about heads for the barn doorway and stays there till it dries off.
// Pure logic: the game says what the weather and the girls are doing and where
// the spots are, and does the walking and sitting this module asks for.
//
// A spot is { id, kind: 'bale' | 'fence' | 'shelter', x, z, yaw, seat? }. `seat` is the
// height she sits at (none for shelter, where she stands); `yaw` the way she faces.

export const DEFAULT_PLACE_PARAMS = {
  fineBelow: 0.05, // rain (0..1) below which a sunny day counts as fine for sitting out
  rainAbove: 0.25, // rain above which they go looking for cover
  dryBelow: 0.08, // rain below which they come out of the barn again
  shelterDelayMin: 4, // seconds after the rain sets in before a girl makes a run for it
  shelterDelayMax: 18,
  dryDelayMin: 15, // seconds after it dries off before she comes out
  dryDelayMax: 45,
  shelterFrom: 150, // metres: how far away she'll still run to the barn from (anywhere on the farm)
  restFrom: 45, // metres: how far she'll walk to sit somewhere
  restStayMin: 60, // seconds she sits out for
  restStayMax: 180,
};

export const PLACE_PARAM_RANGES = {
  fineBelow: [0, 0.5, 0.01],
  rainAbove: [0.05, 1, 0.01],
  dryBelow: [0, 0.5, 0.01],
  shelterDelayMin: [0, 60, 1],
  shelterDelayMax: [0, 120, 1],
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
    this.rainFor = {}; // girl id -> seconds it's been raining hard enough while she's about
    this.dryFor = {}; // girl id -> seconds it's been dry while she's at the barn
    this.delay = {}; // girl id -> how long she'll wait before acting
    this.taken = new Set();
  }

  /**
   * One step. `ctx`:
   *   rain: 0..1
   *   spots: [{ id, kind, x, z, ... }]
   *   girls: [{ id, x, z, state, spot }]
   *     state: 'idle' (stood about), 'resting' (at a spot, free to be moved), 'busy' (anything else)
   *     spot: the spot she's at or heading for, if any
   * Returns actions: { girl, do: 'shelter', spot } (go and stand in the dry) or { girl, do: 'leave' } (come out).
   */
  update(dt, ctx) {
    const p = this.p;
    this.taken = new Set(ctx.girls.map((g) => g.spot?.id).filter(Boolean));
    const actions = [];
    for (const g of ctx.girls) {
      const atShelter = g.spot?.kind === 'shelter';
      if (ctx.rain > p.rainAbove) {
        this.dryFor[g.id] = 0;
        if (atShelter || g.state === 'busy') {
          this.rainFor[g.id] = 0;
          continue;
        }
        this.rainFor[g.id] = (this.rainFor[g.id] ?? 0) + dt;
        this.delay[g.id] ??= p.shelterDelayMin + this.random() * (p.shelterDelayMax - p.shelterDelayMin);
        if (this.rainFor[g.id] < this.delay[g.id]) continue;
        const spot = nearestSpot(ctx.spots, ['shelter'], g, this.taken, p.shelterFrom);
        if (!spot) continue;
        this.taken.add(spot.id);
        this.rainFor[g.id] = 0;
        delete this.delay[g.id];
        actions.push({ girl: g.id, do: 'shelter', spot });
      } else {
        this.rainFor[g.id] = 0;
        delete this.delay[g.id];
        if (!atShelter || g.state !== 'resting' || ctx.rain > p.dryBelow) {
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
}
