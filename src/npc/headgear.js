// Helmets and goggles. Four hooks by the barn's south wall hold Amy's helmet, Jess's, yours, and your goggles. You take yours down and put
// them on with E; riding an open vehicle without a helmet gets a nag from Amy, and goggles keep most of the mud off your view (effects/lensMud.js).
// Each girl fetches her own helmet from the hooks (an offer, so the chooser weighs it), puts it on to ride an open vehicle, and takes it off
// again a lot: left on the seat she got off, or dropped on the ground. Next time she gets on she picks it up from wherever it lies near her.
// Pure logic: the game says where the girls and the vehicles are and does the walking, the drawing and the talking this module asks for.

export const DEFAULT_HEADGEAR_PARAMS = {
  startAfter: 25, // seconds into the game before a girl thinks of fetching her helmet
  weight: 1, // how much she cares for fetching it once she has none (times her own helmetWeight, and weighed by chooser.js)
  range: 140, // metres: how far she'll walk to the hooks for it
  timeout: 60, // seconds she has to get to the hooks before it's forgotten
  pickUpRange: 30, // metres: a helmet she left lying this close is picked up as she gets on
  footMax: 90, // seconds she keeps it on, stood about on foot, before it comes off and goes on the ground
  dropSpeed: 2.5, // m/s: a helmet left on the seat falls off once the vehicle goes faster than this
  helmetFit: 1.35, // how big a girl's helmet is against her measured head (her hair stands out from it)
  helmetLift: 0, // metres up (or down) from where it sits on her head
  goggleGuard: 0.85, // how much mud your goggles keep off your view (0 none, 1 all)
  nagAfter: 6, // seconds riding bare-headed, moving, before Amy says something
  nagEvery: 140, // seconds between her nags
  nagSpeed: 2, // m/s: slower than this you're not really riding
  nagRange: 30, // metres: how close she has to be to see
  praiseFavour: 1, // favour with Amy for putting your helmet on (once a ride)
};

export const HEADGEAR_PARAM_RANGES = {
  startAfter: [0, 600, 5],
  weight: [0, 3, 0.05],
  range: [10, 300, 5],
  timeout: [10, 180, 5],
  pickUpRange: [2, 100, 1],
  footMax: [10, 600, 5],
  dropSpeed: [0.5, 10, 0.5],
  helmetFit: [0.8, 2, 0.05],
  helmetLift: [-0.05, 0.08, 0.005],
  goggleGuard: [0, 1, 0.05],
  nagAfter: [0, 60, 1],
  nagEvery: [10, 600, 5],
  nagSpeed: [0.5, 10, 0.5],
  nagRange: [5, 100, 1],
  praiseFavour: [0, 5, 0.5],
};

/** Where a girl's helmet can be. */
export const PLACES = ['rack', 'head', 'seat', 'ground'];

export class Headgear {
  constructor(params = { ...DEFAULT_HEADGEAR_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.girls = {}; // id -> { place, vehicle (when on a seat), x, z (where it lies), riding, onFoot }
    this.pending = {}; // id -> { until }: on her way to the hooks
    this.forced = {}; // id -> 'fetch' | 'hang': the debug panel wants her to, whenever she's free
    this.you = { helmet: false, goggles: false };
    this.sinceNag = 1e9;
    this.bareFor = 0;
    this.praised = false;
  }

  girl(id) {
    return (this.girls[id] ??= { place: 'rack', vehicle: null, x: 0, z: 0, riding: false, onFoot: 0 });
  }

  /** Whether her helmet is on her head. */
  wearing(id) {
    return this.girl(id).place === 'head';
  }

  /** What is hanging on the hooks, for drawing: the girls' ids whose helmets are there, then 'you' and 'goggles' if yours are. */
  onHooks() {
    const ids = Object.keys(this.girls).filter((id) => this.girls[id].place === 'rack');
    if (!this.you.helmet) ids.push('you');
    if (!this.you.goggles) ids.push('goggles');
    return ids;
  }

  /** Where her helmet is, for the debug panel and console. */
  describe(id) {
    const g = this.girl(id);
    const where = { rack: 'on the hooks', head: 'on her head', seat: `on the seat of ${g.vehicle}`, ground: 'on the ground' }[g.place];
    return this.pending[id] ? `${where}, she is on her way to the hooks` : where;
  }

  // The girls ---------------------------------------------------------------

  /** She has her helmet on (from the hooks, or picked up). */
  put(id) {
    const g = this.girl(id);
    g.place = 'head';
    g.vehicle = null;
    g.onFoot = 0;
    delete this.pending[id];
  }

  /** It's on the ground where she is, or on a vehicle's seat, or back on the hooks. */
  leave(id, place, spot = {}) {
    const g = this.girl(id);
    g.place = place;
    g.vehicle = place === 'seat' ? spot.vehicle ?? null : null;
    g.x = spot.x ?? g.x;
    g.z = spot.z ?? g.z;
    g.onFoot = 0;
    delete this.pending[id];
  }

  cancel(id) {
    delete this.pending[id];
  }

  /** The debug panel: send her to fetch hers if it's on the hooks, or to hang it back up if she has it. Returns which. */
  toggle(id) {
    this.forced[id] = this.girl(id).place === 'rack' ? 'fetch' : 'hang';
    return this.forced[id];
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, free, riding, vehicle, x, z, leave, ground }]   riding: sat on or driving an open vehicle (vehicle is its id);
   *                                                                 leave: chance she takes it off on getting off; ground: of those, dropped not put on the seat
   *   vehicles: { id: { speed } }
   *   hooks: { x, z }
   * Returns events: { type: 'don', girl, from }, { type: 'doff', girl, place: 'seat' | 'ground', vehicle }, { type: 'drop', girl, x, z },
   * { type: 'fetch', girl } and { type: 'hang', girl } (she is to go to the hooks and do it).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const [id, job] of Object.entries(this.pending)) if (this.clock > job.until) delete this.pending[id];
    for (const c of ctx.girls) {
      const g = this.girl(c.id);
      const was = g.riding;
      g.riding = !!c.riding;
      if (g.riding && !was && g.place !== 'head') {
        // Getting on: her helmet goes on if it's lying near enough (on a seat, it's the vehicle's position that counts).
        const at = g.place === 'seat' ? ctx.vehicles?.[g.vehicle] ?? null : g.place === 'ground' ? g : null;
        const near = at && Math.hypot((at.x ?? c.x) - c.x, (at.z ?? c.z) - c.z) <= p.pickUpRange;
        if (near || (g.place === 'seat' && g.vehicle === c.vehicle)) {
          events.push({ type: 'don', girl: c.id, from: g.place });
          this.put(c.id);
        }
      } else if (!g.riding && was && g.place === 'head') {
        // Getting off: usually it comes straight off again.
        if (this.random() < (c.leave ?? 0.5)) {
          const onGround = this.random() < (c.ground ?? 0.3) || !c.vehicle;
          events.push({ type: 'doff', girl: c.id, place: onGround ? 'ground' : 'seat', vehicle: onGround ? null : c.vehicle });
          this.leave(c.id, onGround ? 'ground' : 'seat', { vehicle: c.vehicle, x: c.x, z: c.z });
        }
      }
      if (g.place === 'head' && !g.riding) {
        g.onFoot += dt;
        if (g.onFoot > p.footMax) {
          events.push({ type: 'doff', girl: c.id, place: 'ground', vehicle: null });
          this.leave(c.id, 'ground', { x: c.x, z: c.z });
        }
      }
      // A helmet left on a seat falls off once the vehicle is going.
      if (g.place === 'seat') {
        const v = ctx.vehicles?.[g.vehicle];
        if (v && Math.abs(v.speed) > p.dropSpeed) {
          events.push({ type: 'drop', girl: c.id, x: v.x, z: v.z });
          this.leave(c.id, 'ground', { x: v.x, z: v.z });
        }
      }
      if (!c.free || this.pending[c.id]) continue;
      const forced = this.forced[c.id];
      if (forced === 'hang' && g.place !== 'rack') {
        delete this.forced[c.id];
        this.pending[c.id] = { until: this.clock + p.timeout, kind: 'hang' };
        events.push({ type: 'hang', girl: c.id });
      } else if (forced === 'fetch' && g.place === 'rack') {
        delete this.forced[c.id];
        this.pending[c.id] = { until: this.clock + p.timeout, kind: 'fetch' };
        events.push({ type: 'fetch', girl: c.id });
      }
    }
    return events;
  }

  /**
   * A fetch for each free girl whose helmet is on the hooks (the same `ctx` as update): [{ key: 'helmet', girl, weight }] for the chooser.
   * Not before the start, nor for a girl too far from the hooks or one on her way already.
   */
  offers(ctx) {
    const p = this.p;
    if (this.clock < p.startAfter) return [];
    return ctx.girls
      .filter((c) => c.free && !c.riding && !this.pending[c.id] && this.girl(c.id).place === 'rack' && Math.hypot(ctx.hooks.x - c.x, ctx.hooks.z - c.z) <= p.range)
      .map((c) => ({ key: 'helmet', girl: c.id, weight: p.weight * (c.weight ?? 1) }));
  }

  /** She chose to fetch it: books it and returns the event the game acts on, { type: 'fetch', girl }. */
  take(offer) {
    this.pending[offer.girl] = { until: this.clock + this.p.timeout, kind: 'fetch' };
    return { type: 'fetch', girl: offer.girl };
  }

  // You ----------------------------------------------------------------------

  /** E at the hook: put yours on or hang it up. Returns whether it's on now. */
  toggleHelmet() {
    this.you.helmet = !this.you.helmet;
    if (this.you.helmet) this.praised = false;
    return this.you.helmet;
  }

  toggleGoggles() {
    this.you.goggles = !this.you.goggles;
    return this.you.goggles;
  }

  /** How much of the mud your goggles keep off (0 without them). */
  guard() {
    return this.you.goggles ? this.p.goggleGuard : 0;
  }

  /**
   * One step of Amy noticing. `ctx`: { riding: on an open vehicle, speed, girls: [{ id, nags, canRemark, dist }] }.
   * Returns { type: 'nag', girl } when a girl who minds tells you off for the bare head, { type: 'praise', girl } the first time she sees
   * it on, or null.
   */
  watch(dt, ctx) {
    const p = this.p;
    this.sinceNag += dt;
    const near = (ctx.girls ?? []).filter((c) => c.nags && c.canRemark && c.dist <= p.nagRange);
    if (!ctx.riding || Math.abs(ctx.speed) < p.nagSpeed) {
      this.bareFor = 0;
      return null;
    }
    if (this.you.helmet) {
      this.bareFor = 0;
      if (!this.praised && near[0]) {
        this.praised = true;
        return { type: 'praise', girl: near[0].id };
      }
      return null;
    }
    this.praised = true; // no praise for a helmet you only put on the next time you're asked
    this.bareFor += dt;
    if (this.bareFor >= p.nagAfter && this.sinceNag >= p.nagEvery && near[0]) {
      this.sinceNag = 0;
      this.bareFor = 0;
      return { type: 'nag', girl: near[0].id };
    }
    return null;
  }

  // The farm remembers (farm/farmState.js) -------------------------------------

  capture() {
    return { helmet: this.you.helmet, goggles: this.you.goggles };
  }

  restore(s) {
    this.you.helmet = !!s?.helmet;
    this.you.goggles = !!s?.goggles;
    this.praised = true; // already wearing it on a fresh day: nothing to praise
  }
}
