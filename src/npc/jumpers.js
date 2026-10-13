// Jumpers from the barn. There are two on a rail in the barn, grey and beige, oversized and dull, and neither girl likes
// them. When the day has been cold or wet for a while a girl stood about goes and puts one on; once it has been warm and
// dry for a while she goes back and hangs it up. Pure logic: the game says what the weather and the girls are doing, does
// the walking and the dressing this module asks for, and tells it back what happened.

export const DEFAULT_JUMPER_PARAMS = {
  startAfter: 40, // seconds into the game before anyone feels the cold
  coldFor: 25, // seconds a girl has felt cold (or wet) before she goes for one
  warmFor: 60, // seconds of warm, dry weather before she takes it off again
  weight: 1, // how much she cares for fetching a jumper once she's cold enough to want one (chooser.js weighs it)
  coldBelow: 0.5, // weather warmth (0..1) under which it's cold (overcast, drizzle, rain, fog)
  wetAbove: 0.25, // rain (0..1) above which she's wet
  range: 140, // metres: how far she'll walk to the barn for it
  timeout: 60, // seconds she has to get to the rail before it's forgotten
};

export const JUMPER_PARAM_RANGES = {
  startAfter: [0, 600, 10],
  coldFor: [0, 300, 5],
  warmFor: [0, 600, 5],
  weight: [0, 3, 0.05],
  coldBelow: [0, 1, 0.05],
  wetAbove: [0, 1, 0.05],
  range: [10, 300, 5],
  timeout: [10, 180, 5],
};

/** The jumpers on the rail, by where they hang, and the colours they have unless the farm deals others (dealJumperColours). */
export const JUMPERS = [
  { id: 'left', color: '#7b7d80' },
  { id: 'right', color: '#b7a98c' },
];

/** What the farm's jumpers can be knitted in: dull, practical colours, grey and beige among them. */
export const JUMPER_PALETTE = [
  { name: 'grey', color: '#7b7d80' },
  { name: 'beige', color: '#b7a98c' },
  { name: 'navy', color: '#3d4a62' },
  { name: 'bottle green', color: '#3f5a46' },
  { name: 'burgundy', color: '#6c3439' },
  { name: 'mustard', color: '#b08b42' },
  { name: 'oatmeal', color: '#cfc4a8' },
  { name: 'charcoal', color: '#4b4c50' },
  { name: 'heather blue', color: '#6b7c93' },
  { name: 'rust', color: '#8d5337' },
  { name: 'moss', color: '#6d7442' },
];

/** The farm's jumpers' colours, a different pair for each farm (from its own stream of the farm seed, so it's the same every day). */
export function dealJumperColours(random, count = JUMPERS.length) {
  const left = JUMPER_PALETTE.slice();
  const out = [];
  for (let i = 0; i < count && left.length; i++) out.push(left.splice(Math.floor(random() * left.length), 1)[0].color);
  return out;
}

/** Whether it's a day for a jumper: cold or wet. */
export function isJumperWeather(weather, p) {
  return weather.warmth < p.coldBelow || weather.rain > p.wetAbove;
}

export class Jumpers {
  constructor(params = { ...DEFAULT_JUMPER_PARAMS }, random = Math.random, colours = null) {
    this.p = params;
    // The jumpers on this farm's rail: the same places, in the colours it dealt.
    this.list = JUMPERS.map((j, i) => ({ ...j, color: colours?.[i] ?? j.color }));
    this.random = random;
    this.clock = 0;
    this.worn = {}; // girl id -> jumper id she has on
    this.pending = {}; // girl id -> { kind: 'fetch' | 'hang', jumper, until }
    this.coldFor = {}; // girl id -> seconds she has been cold
    this.warmFor = {}; // girl id -> seconds she has been warm while wearing one
    this.forced = false; // fetch one at the first chance (the debug panel)
    this.asked = {}; // girl id -> 'fetch' | 'hang': the debug panel wants her to, whatever the weather
    this.manual = new Set(); // girls whose jumper was asked for, who keep it on until asked to take it off
  }

  /** Jumpers not on a girl and not about to be. */
  free() {
    const taken = new Set([...Object.values(this.worn), ...Object.values(this.pending).filter((j) => j.kind === 'fetch').map((j) => j.jumper)]);
    return this.list.filter((j) => !taken.has(j.id));
  }

  /** Jumpers on the rail for drawing: not worn, though one being fetched still hangs there until she lifts it. */
  onRail() {
    const worn = new Set(Object.values(this.worn));
    return this.list.filter((j) => !worn.has(j.id));
  }

  /** The colour a jumper is knitted in. */
  colourOf(id) {
    return this.list.find((j) => j.id === id)?.color ?? null;
  }

  /** The debug panel: send her for a jumper if she has none, or to hang hers up if she has. Returns which. */
  toggle(girl) {
    this.asked[girl] = this.worn[girl] ? 'hang' : 'fetch';
    return this.asked[girl];
  }

  /** She got there and put it on. */
  dressed(girl, jumper) {
    delete this.pending[girl];
    this.worn[girl] = jumper;
    this.warmFor[girl] = 0;
  }

  /** She got there and hung it up. */
  hung(girl) {
    this.manual.delete(girl);
    delete this.pending[girl];
    delete this.worn[girl];
    this.coldFor[girl] = 0;
  }

  /** She couldn't get there (something else came up): forget it. */
  cancel(girl) {
    delete this.pending[girl];
  }

  /**
   * One step. `ctx`:
   *   weather: { warmth, rain }
   *   girls: [{ id, free, x, z }]     free: stood about with nothing on
   *   rail: { x, z }                  where the jumpers hang
   * Returns events: { type: 'fetch', girl, jumper } and { type: 'hang', girl, jumper }: she is to go to the rail and do it.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const cold = isJumperWeather(ctx.weather, p);
    for (const [girl, job] of Object.entries(this.pending)) if (this.clock > job.until) delete this.pending[girl];
    for (const g of ctx.girls) {
      const wearing = this.worn[g.id];
      if (wearing) {
        this.warmFor[g.id] = cold ? 0 : (this.warmFor[g.id] ?? 0) + dt;
      } else {
        this.coldFor[g.id] = cold ? (this.coldFor[g.id] ?? 0) + dt : 0;
      }
      if (!g.free || this.pending[g.id]) continue;
      const asked = this.asked[g.id];
      if (asked === 'hang' && wearing) {
        delete this.asked[g.id];
        this.manual.delete(g.id);
        this.pending[g.id] = { kind: 'hang', jumper: wearing, until: this.clock + p.timeout };
        events.push({ type: 'hang', girl: g.id, jumper: wearing });
        continue;
      }
      if (asked === 'fetch' && !wearing && this.free().length) {
        delete this.asked[g.id];
        this.manual.add(g.id);
        const jumper = this.free()[0];
        this.pending[g.id] = { kind: 'fetch', jumper: jumper.id, until: this.clock + p.timeout };
        events.push({ type: 'fetch', girl: g.id, jumper: jumper.id });
        continue;
      }
      if (wearing) {
        if (this.manual.has(g.id)) continue;
        if (this.warmFor[g.id] >= p.warmFor) {
          this.pending[g.id] = { kind: 'hang', jumper: wearing, until: this.clock + p.timeout };
          events.push({ type: 'hang', girl: g.id, jumper: wearing });
        }
        continue;
      }
      // Fetching one is an offer (offers, take); only the debug panel's forced one starts here.
      if (!this.forced || Math.hypot(ctx.rail.x - g.x, ctx.rail.z - g.z) > p.range || !this.free()[0]) continue;
      this.forced = false;
      events.push(this.take({ girl: g.id, jumper: this.free()[0].id }));
    }
    return events;
  }

  /**
   * A jumper for each free girl who has been cold a while and has none on (the same `ctx` as update): [{ key: 'jumper', girl, jumper,
   * weight }] for the chooser. Not before the start, nor for a girl too far from the rail or one on her way already.
   */
  offers(ctx) {
    const p = this.p;
    if (this.clock < p.startAfter || !this.free()[0]) return [];
    return ctx.girls
      .filter((g) => g.free && !this.pending[g.id] && !this.worn[g.id] && (this.coldFor[g.id] ?? 0) >= p.coldFor && Math.hypot(ctx.rail.x - g.x, ctx.rail.z - g.z) <= p.range)
      .map((g) => ({ key: 'jumper', girl: g.id, jumper: this.free()[0].id, weight: p.weight }));
  }

  /** She chose to fetch one: books it and returns the event the game acts on, { type: 'fetch', girl, jumper }. */
  take(offer) {
    const jumper = this.free().find((j) => j.id === offer.jumper) ?? this.free()[0];
    if (!jumper) return null;
    this.pending[offer.girl] = { kind: 'fetch', jumper: jumper.id, until: this.clock + this.p.timeout };
    return { type: 'fetch', girl: offer.girl, jumper: jumper.id };
  }
}
