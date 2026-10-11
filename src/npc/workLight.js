// Lights to work by. After dark, a girl brings a vehicle round to light whatever you're at: she drives it to a few metres off, facing
// you, leaves it running with its lights on, and most of the time moves over to the passenger side (a cab's passenger seat, or the
// back of a quad); otherwise she gets out and stands by it. Ask her from her wheel ("Light me up"), or Amy offers on her own when
// you've been stood at a quad or a gate in the dark for a while (an offer, chooser.js). It ends when you ride off, walk away, or tell
// her that'll do. Pure: the game says who and what is where and does the driving and sitting this asks for.

export const DEFAULT_WORK_LIGHT_PARAMS = {
  darkAbove: 0.6, // how dark before a light is worth bringing
  stand: 6, // metres from you she stops, facing you
  workNear: 3, // metres: you stood this close to a quad or a gate counts as working at it
  workFor: 12, // seconds you've been at it before she offers
  workDrift: 1.5, // metres you can shuffle about and still be at the same thing
  vehicleRange: 70, // metres: she'll fetch a vehicle from this far
  weight: 1, // how keen she is (times her own workLightWeight)
  passengerChance: 0.75, // once it's there, the chance she moves over to the passenger side rather than getting out to stand by it
  walkAway: 25, // metres from the spot you walk before she reckons you're done
  lastsFor: 900, // seconds at most she sits lighting for you
  cooldown: 120, // seconds after one before she offers again
};

export const WORK_LIGHT_PARAM_RANGES = {
  darkAbove: [0, 1, 0.01],
  stand: [3, 15, 0.5],
  workNear: [1, 8, 0.5],
  workFor: [0, 120, 1],
  workDrift: [0.5, 5, 0.25],
  vehicleRange: [10, 200, 5],
  weight: [0, 5, 0.05],
  passengerChance: [0, 1, 0.05],
  walkAway: [5, 80, 1],
  lastsFor: [30, 3600, 30],
  cooldown: [0, 900, 10],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Where she stops to light `target` ({ x, z }) coming from `from` (where the vehicle is now): `p.stand` from it on the side she's
 * coming from, facing it. { x, z, yaw } (yaw as a quad's: atan2 of the way it faces).
 */
export function lightSpot(target, from, p = DEFAULT_WORK_LIGHT_PARAMS) {
  const d = dist(target, from);
  const ux = d > 1e-3 ? (from.x - target.x) / d : 0;
  const uz = d > 1e-3 ? (from.z - target.z) / d : 1;
  const x = target.x + ux * p.stand;
  const z = target.z + uz * p.stand;
  return { x, z, yaw: Math.atan2(target.x - x, target.z - z) };
}

/**
 * The vehicle she'd bring: of `vehicles` ([{ id, x, z, cab (a roof and a passenger seat: the Land Rovers, the UTV), lights (it has
 * working headlamps), free (nobody on it, she may drive it) }]), free ones with lights within range of her, a cab before a quad,
 * then the nearest. Or null.
 */
export function pickVehicle(girl, vehicles, p = DEFAULT_WORK_LIGHT_PARAMS) {
  const ok = vehicles.filter((v) => v.free && v.lights && dist(v, girl) <= p.vehicleRange);
  ok.sort((a, b) => (b.cab ? 1 : 0) - (a.cab ? 1 : 0) || dist(a, girl) - dist(b, girl));
  return ok[0] ?? null;
}

export class WorkLight {
  constructor(p = { ...DEFAULT_WORK_LIGHT_PARAMS }, random = Math.random) {
    this.p = p;
    this.random = random;
    this.clock = 0;
    this.job = null; // { girl, vehicle, spot, target, phase: 'bringing' | 'lighting', since, passenger }
    this.at = null; // what you've been stood at: { x, z, since }
    this.coolUntil = 0;
  }

  get active() {
    return !!this.job;
  }

  /**
   * One step. `ctx`: { dark, you: { x, z, onFoot }, workAt: the quad or gate you're stood at ({ x, z }) or null }. Returns events:
   * { type: 'done', girl, why } when it's over.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    // How long you've been at the same thing, on foot.
    const at = ctx.you.onFoot ? ctx.workAt : null;
    if (!at) this.at = null;
    else if (!this.at || dist(this.at, at) > p.workDrift) this.at = { x: at.x, z: at.z, since: this.clock };
    const job = this.job;
    if (!job) return [];
    job.since += dt;
    let why = null;
    if (!ctx.you.onFoot && job.phase === 'lighting') why = 'rode';
    else if (dist(ctx.you, job.spot) > p.walkAway + p.stand && job.phase === 'lighting') why = 'walked';
    else if (job.since > p.lastsFor) why = 'long';
    if (!why) return [];
    return [this.finish(why)];
  }

  /** It's there: she's lighting now. */
  arrived() {
    if (this.job) this.job.phase = 'lighting';
  }

  /** Over (`why`: 'rode', 'walked', 'long', 'asked', 'failed'): the cooldown starts. Returns the event. */
  finish(why) {
    const job = this.job;
    this.job = null;
    this.coolUntil = this.clock + this.p.cooldown;
    return { type: 'done', girl: job?.girl, vehicle: job?.vehicle, why };
  }

  /**
   * Amy's offer (`ctx` as update, plus girls: [{ id, x, z, free, weight (her workLightWeight) }] and vehicles as pickVehicle): when
   * it's dark and you've been at a quad or a gate on foot for a while. [{ key: 'workLight', girl, vehicle, spot, target, weight }].
   */
  offers(ctx) {
    const p = this.p;
    if (this.job || this.clock < this.coolUntil || (ctx.dark ?? 0) < p.darkAbove || !this.at || this.clock - this.at.since < p.workFor) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || !(g.weight > 0)) continue;
      const plan = this.plan(g, ctx);
      if (plan) out.push({ key: 'workLight', girl: g.id, ...plan, weight: p.weight * g.weight });
    }
    return out;
  }

  /**
   * What she'd do if you asked her now, lighting where you are (`ctx` as offers): { vehicle, spot, target }, or { why } if she can't
   * (it's light enough, there's nothing she can bring, she's already at it).
   */
  ask(girl, ctx) {
    if (this.job) return { why: this.job.girl === girl.id ? 'she is already lighting for you' : 'her friend is already lighting for you' };
    if ((ctx.dark ?? 0) < this.p.darkAbove * 0.5) return { why: 'it is light enough to see' };
    return this.plan(girl, { ...ctx, workAt: { x: ctx.you.x, z: ctx.you.z } }) ?? { why: 'there is nothing with lights she can bring' };
  }

  plan(girl, ctx) {
    const v = pickVehicle(girl, ctx.vehicles, this.p);
    if (!v) return null;
    const target = ctx.workAt ?? { x: ctx.you.x, z: ctx.you.z };
    return { vehicle: v.id, cab: !!v.cab, spot: lightSpot(target, v, this.p), target: { x: target.x, z: target.z } };
  }

  /** She's taking it on (her own offer, or you asked): the job starts. Returns { type: 'bring', girl, vehicle, cab, spot, target, passenger }. */
  take(o) {
    const passenger = this.random() < this.p.passengerChance;
    this.job = { girl: o.girl, vehicle: o.vehicle, spot: o.spot, target: o.target, phase: 'bringing', since: 0, passenger };
    return { type: 'bring', girl: o.girl, vehicle: o.vehicle, cab: !!o.cab, spot: o.spot, target: o.target, passenger };
  }

  /** For the debug panel and the console. */
  describe() {
    const j = this.job;
    if (!j) return this.clock < this.coolUntil ? `no (again in ${Math.round(this.coolUntil - this.clock)} s)` : 'no';
    return `${j.girl} ${j.phase === 'bringing' ? 'bringing' : 'lighting with'} the ${j.vehicle}${j.phase === 'lighting' ? (j.passenger ? ', moved over' : ', stood by it') : ''}`;
  }
}
