// The bonfire: hedge cuttings carried to a pile, three bundles of them, lit with a lighter, burning for a good while and dying to embers
// and ash. Rain puts it out, damp air makes it smoky and a gale blows it out. Pure logic, no Three.js: the game feeds it the weather and
// draws what it says (world/bonfireView.js). Tested in tests/bonfire.test.js.

export const DEFAULT_BONFIRE_PARAMS = {
  heapsNeeded: 3, // bundles of brushwood on the pile before it can be lit
  growSeconds: 25, // from the lighter to a full blaze
  burnSeconds: 540, // a full blaze lasts this long (damp air burns it away faster)
  dieSeconds: 70, // and it then takes this long to die down to embers
  rainDamp: 0.06, // rain above this makes it smoky and burns it down faster
  rainOut: 0.4, // rain above this puts it out
  windOut: 5, // m/s of wind above this blows it out, unless it has really caught
  dampBurn: 2.5, // how much faster damp air burns it down (times)
  warmRange: 4.5, // metres: stood this close to a good blaze you feel it
  lightsAt: 0.4, // how far up the blaze must be to count (to warm hands, to want to sit by it)
  lightCandela: 90, // the glow it throws, at the full blaze at night (a point light made at the start, only dimmed)
  lightReach: 24, // metres: the glow is gone by here
  dangerRange: 1.4, // metres: a vehicle this close to a lit fire gets a warning
};

export const BONFIRE_PARAM_RANGES = {
  heapsNeeded: [1, 6, 1],
  growSeconds: [3, 120, 1],
  burnSeconds: [30, 2400, 10],
  dieSeconds: [10, 400, 5],
  rainDamp: [0, 0.5, 0.01],
  rainOut: [0.05, 1, 0.01],
  windOut: [1, 15, 0.5],
  dampBurn: [1, 8, 0.1],
  warmRange: [1.5, 10, 0.5],
  lightsAt: [0.05, 1, 0.05],
  lightCandela: [0, 600, 5],
  lightReach: [6, 60, 1],
  dangerRange: [0.5, 4, 0.1],
};

export class Bonfire {
  constructor(params = { ...DEFAULT_BONFIRE_PARAMS }) {
    this.p = params;
    this.piled = 0; // bundles on the pile
    this.state = 'none'; // 'none' (nothing to see but the ring), 'built', 'lit', 'ash'
    this.t = 0; // seconds since it was lit
    this.fuel = 0; // seconds of full blaze left
    this.intensity = 0; // 0..1: how big the blaze is
    this.damp = false; // smoky: it's damp out
  }

  get built() {
    return this.piled >= this.p.heapsNeeded;
  }

  get burning() {
    return this.state === 'lit';
  }

  /** A good blaze, worth sitting by and warming your hands at. */
  get blazing() {
    return this.burning && this.intensity >= this.p.lightsAt;
  }

  /** Whether another bundle can go on the pile (a burnt-out ring takes a new pile). */
  canAdd() {
    return this.state !== 'lit' && !(this.state === 'built' && this.built);
  }

  /** A bundle goes on. Returns true if it did. The first onto old ash clears the ash. */
  addHeap() {
    if (!this.canAdd()) return false;
    if (this.state === 'ash') {
      this.piled = 0;
      this.intensity = 0;
    }
    this.piled += 1;
    this.state = 'built';
    return true;
  }

  canLight(rain = 0) {
    return this.state === 'built' && this.built && rain < this.p.rainOut;
  }

  /** The lighter. Returns true if it caught. */
  light(rain = 0) {
    if (!this.canLight(rain)) return false;
    this.state = 'lit';
    this.t = 0;
    this.fuel = this.p.burnSeconds;
    this.intensity = 0;
    return true;
  }

  /** Puts it out where it is (the debug panel, the rain). It is left as ash. */
  putOut() {
    if (this.state !== 'lit') return false;
    this.state = 'ash';
    this.intensity = 0;
    return true;
  }

  /** Nearer than `range` metres to the middle and the fire is going: close enough to warm hands. */
  warms(distance) {
    return this.blazing && distance <= this.p.warmRange;
  }

  /**
   * One step. `w`: { rain (0..1), wind (m/s) }. Returns events: { type: 'out', why: 'rain' | 'wind' | 'burntOut' } when it goes out. While it
   * burns `smoke` says how much (0..1) and `damp` whether it is smoky.
   */
  update(dt, w) {
    const p = this.p;
    if (this.state !== 'lit') {
      this.damp = false;
      return [];
    }
    this.t += dt;
    this.damp = w.rain > p.rainDamp;
    if (w.rain >= p.rainOut) {
      this.putOut();
      return [{ type: 'out', why: 'rain' }];
    }
    if (w.wind >= p.windOut && this.intensity < 0.7) {
      this.putOut();
      return [{ type: 'out', why: 'wind' }];
    }
    const grow = Math.min(1, this.t / p.growSeconds);
    this.fuel -= dt * (this.damp ? p.dampBurn : 1);
    const fade = this.fuel < 0 ? Math.max(0, 1 + this.fuel / p.dieSeconds) : 1;
    this.intensity = grow * fade;
    if (fade <= 0) {
      this.state = 'ash';
      this.intensity = 0;
      return [{ type: 'out', why: 'burntOut' }];
    }
    return [];
  }

  /** How much smoke it makes: more as it catches and as it dies, and a lot more damp. */
  get smoke() {
    if (this.state !== 'lit') return 0;
    return Math.min(1, this.intensity * (this.damp ? 1.6 : 0.7) + (this.intensity < 0.5 ? 0.15 : 0));
  }

  /** Back to a bare ring. */
  reset() {
    this.piled = 0;
    this.state = 'none';
    this.t = 0;
    this.fuel = 0;
    this.intensity = 0;
    this.damp = false;
  }

  /** Builds the whole pile at once (the debug panel). */
  buildAll() {
    this.reset();
    while (this.addHeap());
  }
}

/** The log seats round the fire, as { x, z, yaw } (yaw: the way a girl sat on it faces, which is at the fire). */
export function logSeats(site, count = 4) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = Math.PI / 4 + (i * 2 * Math.PI) / count;
    const x = site.x + Math.sin(a) * site.seatRadius;
    const z = site.z + Math.cos(a) * site.seatRadius;
    out.push({ x, z, yaw: Math.atan2(site.x - x, site.z - z) });
  }
  return out;
}
