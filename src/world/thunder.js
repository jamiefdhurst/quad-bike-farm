// Lightning and thunder in a storm (weather kind 'storm'). A strike is somewhere out in the hills: its flash lights the whole sky at
// once, and the thunder follows after the time sound takes to cover the distance, louder and sharper the nearer it was. Nothing is ever
// struck and nothing is hurt: it is a thing to see, hear and be startled by. Pure logic: the game feeds it the storm's strength and
// turns its flash into light and its thunder into sound and a notice for the girls.

export const DEFAULT_THUNDER_PARAMS = {
  gapMin: 7, // seconds between strikes at the height of a storm...
  gapMax: 35, // ...picked between these each time (longer as the storm eases, see update)
  nearChance: 0.2, // chance a strike is close enough to crack rather than rumble
  nearMin: 90, // metres: the closest a strike is
  nearMax: 500,
  farMax: 3200, // metres: the furthest
  soundSpeed: 343, // m/s: how fast the thunder travels, so the gap between flash and sound is the distance over this
  flashSeconds: 0.07, // seconds a flicker of lightning takes to fade
  flickerMax: 3, // most flickers in one strike
  flashPower: 1, // how bright the flash is, 0..1 scale on the light the game adds
  startAfter: 10, // seconds into a storm before the first strike
};

export const THUNDER_PARAM_RANGES = {
  gapMin: [1, 60, 1],
  gapMax: [2, 120, 1],
  nearChance: [0, 1, 0.05],
  nearMin: [20, 300, 5],
  nearMax: [100, 1500, 10],
  farMax: [500, 8000, 100],
  soundSpeed: [100, 1000, 10],
  flashSeconds: [0.02, 0.4, 0.01],
  flickerMax: [1, 5, 1],
  flashPower: [0, 2, 0.05],
  startAfter: [0, 120, 1],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Thunderstorm {
  constructor(params = { ...DEFAULT_THUNDER_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.next = params.startAfter; // when the next strike is (on the storm's own clock, which runs all the time)
    this.strikes = []; // flashes under way: { distance, bearing, power, born, flickers: [offsets], thunderAt, sounded }
    this.events = []; // { type: 'flash' | 'thunder', strike } this step
    this.flash = 0; // 0..1 how bright the sky is from lightning right now
    this.lastStrike = null; // the most recent one, for the panel
  }

  /** A strike at `distance` metres (random if left out) on the `bearing` (radians, random if left out): flash now, thunder in a while. */
  strike(distance, bearing = this.random() * Math.PI * 2) {
    const p = this.p;
    const near = distance === undefined ? this.random() < p.nearChance : distance <= p.nearMax;
    const d = distance ?? (near ? p.nearMin + (p.nearMax - p.nearMin) * this.random() : p.nearMax + (p.farMax - p.nearMax) * Math.pow(this.random(), 0.8));
    const flickers = [0];
    const count = 1 + Math.floor(this.random() * p.flickerMax);
    for (let i = 1; i < count; i++) flickers.push(flickers[i - 1] + 0.06 + 0.12 * this.random());
    const s = {
      distance: d,
      bearing,
      power: clamp(1.15 - d / (p.farMax * 0.8), 0.12, 1) * p.flashPower,
      born: this.clock,
      flickers,
      thunderAt: this.clock + d / p.soundSpeed,
      sounded: false,
    };
    this.strikes.push(s);
    this.lastStrike = s;
    this.events.push({ type: 'flash', strike: s });
    return s;
  }

  /** How loud a strike's thunder is, 0..1: 1 close by, falling away with distance. */
  static loudness(distance, p = DEFAULT_THUNDER_PARAMS) {
    return clamp(1.1 - distance / (p.farMax * 0.7), 0.1, 1);
  }

  /** Whether the thunder cracks (close) rather than rumbles. */
  static cracks(distance, p = DEFAULT_THUNDER_PARAMS) {
    return distance <= p.nearMax;
  }

  /**
   * @param {number} dt
   * @param {number} storm  0..1 how thundery it is (weather.storm): no new strikes below a fifth, rarer as it eases
   */
  update(dt, storm) {
    const p = this.p;
    this.events.length = 0;
    this.clock += dt;
    if (storm > 0.2 && this.clock >= this.next) {
      this.strike();
      this.next = this.clock + (p.gapMin + (p.gapMax - p.gapMin) * this.random()) / Math.max(0.3, storm);
    } else if (storm <= 0.2 && this.next < this.clock + p.startAfter) {
      this.next = this.clock + p.startAfter; // the first strike of a storm waits a bit
    }
    let flash = 0;
    for (const s of this.strikes) {
      const age = this.clock - s.born;
      for (const off of s.flickers) if (age >= off) flash = Math.max(flash, s.power * Math.exp(-(age - off) / p.flashSeconds));
      if (!s.sounded && this.clock >= s.thunderAt) {
        s.sounded = true;
        this.events.push({ type: 'thunder', strike: s });
      }
    }
    this.strikes = this.strikes.filter((s) => !s.sounded || this.clock - s.born < 1);
    this.flash = clamp(flash, 0, 1);
    return this.events;
  }
}
