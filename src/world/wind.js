// The wind. The weather kind says how windy the day is (weather.wind, 1 being an ordinary overcast day); this adds which way it blows,
// that it veers a little and that it comes in gusts. Everything that moves in the wind reads it from here: the smoke, the dust, the
// rain and snow, the hedges and trees, the hay door's shutter and the loose hay in the loft. Pure; the game ticks it.

export const DEFAULT_WIND_PARAMS = {
  drift: 0.76, // m/s the smoke drifts at a wind scale of 1 (the old fixed breeze, 0.7 and 0.3)
  gustiness: 0.7, // how much the gusts add to the day's wind (0 is a steady wind)
  gustEvery: 12, // average seconds between gusts
  gustSeconds: 5, // how long a gust lasts, from the first push to dying away
  veer: 0.25, // radians the direction wanders either side of the day's, over a minute or two
  swayHedge: 0.14, // metres the top of a hedge leans over in an ordinary wind
  swayTree: 0.6, // metres the top of a tree leans over in an ordinary wind
  shutterPush: 3, // how hard the wind throws the hay door's shutter (radians a second squared per unit of wind)
  shutterSpring: 1.6, // how hard its latch pulls it back shut
  shutterDamping: 0.9, // how quickly it settles
  shutterBounce: 0.35, // how much of its speed it keeps off the frame or the wall
  shutterOpen: 1.75, // radians it can swing open before the wall stops it
  bangSpeed: 0.8, // radians a second it must hit the frame at to bang
  hayWind: 1.25, // how strong a gust (the day's wind times the gust) must be to blow loose hay out of the loft door
  hayEvery: 90, // seconds before more hay can blow out
};

export const WIND_PARAM_RANGES = {
  drift: [0, 3, 0.02],
  gustiness: [0, 2, 0.05],
  gustEvery: [2, 60, 1],
  gustSeconds: [1, 20, 0.5],
  veer: [0, 1.5, 0.05],
  swayHedge: [0, 0.6, 0.01],
  swayTree: [0, 2, 0.05],
  shutterPush: [0, 10, 0.1],
  shutterSpring: [0.1, 8, 0.1],
  shutterDamping: [0, 4, 0.05],
  shutterBounce: [0, 0.9, 0.05],
  shutterOpen: [0.5, 2.5, 0.05],
  bangSpeed: [0.1, 4, 0.05],
  hayWind: [0.3, 3, 0.05],
  hayEvery: [5, 600, 5],
};

const TAU = Math.PI * 2;

export class Wind {
  /** `heading` is the way the day's wind blows towards, radians from +z towards +x (as a girl's heading). */
  constructor(random = Math.random, heading = 0, p = { ...DEFAULT_WIND_PARAMS }) {
    this.random = random;
    this.p = p;
    this.base = heading;
    this.heading = heading;
    this.veerTarget = 0;
    this.veerIn = 20;
    this.gust = 0; // 0..1 the gust now
    this.gustAge = Infinity; // seconds since it began
    this.nextGust = 3 + random() * p.gustEvery;
    this.scale = 1; // the weather's wind
    this.hayCool = 0;
  }

  /** How strong the wind is now, as a multiple of the day's ordinary wind: the weather's, with a gust on top, never below a calm. */
  get strength() {
    return Math.max(0, this.scale * (1 + this.p.gustiness * (1.5 * this.gust - 0.3)));
  }

  /** The wind's velocity in m/s on the ground: x east, z south, as the smoke and rain drift. */
  get x() {
    return Math.sin(this.heading) * this.p.drift * this.strength;
  }

  get z() {
    return Math.cos(this.heading) * this.p.drift * this.strength;
  }

  /** Turns the day's wind to blow towards `heading` at once (the console). */
  setHeading(heading) {
    this.base = this.heading = heading;
    this.veerTarget = 0;
  }

  /** Starts a gust now (the console). */
  blowGust() {
    this.gustAge = 0;
    this.nextGust = this.p.gustEvery * (0.5 + this.random());
  }

  /** Moves the wind on. `scale` is the weather's wind. Returns true on the second a gust begins. */
  update(dt, scale) {
    const p = this.p;
    this.scale = scale;
    let began = false;
    this.veerIn -= dt;
    if (this.veerIn <= 0) {
      this.veerIn = 40 + this.random() * 80;
      this.veerTarget = (this.random() * 2 - 1) * p.veer;
    }
    this.heading += (this.base + this.veerTarget - this.heading) * Math.min(1, dt / 25);
    this.nextGust -= dt;
    if (this.nextGust <= 0) {
      this.blowGust();
      began = true;
    }
    this.gustAge += dt;
    // A gust comes on fast and dies away slowly: up over the first fifth of it, then down.
    const k = this.gustAge / Math.max(0.1, p.gustSeconds);
    this.gust = k >= 1 ? 0 : k < 0.2 ? k / 0.2 : (1 - k) / 0.8;
    this.hayCool = Math.max(0, this.hayCool - dt);
    return began;
  }

  /** The wind along a direction (a heading, radians from +z towards +x): positive when it blows that way, in the same units as `strength`. */
  along(heading) {
    return (Math.sin(this.heading) * Math.sin(heading) + Math.cos(this.heading) * Math.cos(heading)) * this.strength;
  }

  /** Whether loose hay blows out of the loft door now: a strong gust blowing out of it (towards `outHeading`), once in a while. */
  hayBlows(outHeading) {
    if (this.hayCool > 0 || this.along(outHeading) < this.p.hayWind) return false;
    this.hayCool = this.p.hayEvery;
    return true;
  }
}

/** A heading for the day, from a random stream. Spread over the whole compass. */
export function pickHeading(random = Math.random) {
  return random() * TAU;
}

/**
 * The hay door's shutter on its hinge: 0 shut against the frame, up to `shutterOpen` flat against the wall. The wind blowing out of
 * the door (`push` positive) throws it open, the latch pulls it back, and it bangs shut or against the wall if it comes in fast.
 */
export class Shutter {
  constructor(p = { ...DEFAULT_WIND_PARAMS }) {
    this.p = p;
    this.angle = 0;
    this.speed = 0;
  }

  /** Returns the bang, if it made one: { strength } 0..1, else null. `push`: the wind along the door's outward direction. */
  update(dt, push) {
    const p = this.p;
    // Not much pushes it open in a light breeze: it takes a real wind to lift the latch.
    const force = Math.max(0, Math.abs(push) - 0.5) * Math.sign(push) * p.shutterPush;
    let bang = null;
    // Small steps keep a fast shutter from passing through the frame.
    const steps = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.speed += (force - p.shutterSpring * this.angle - p.shutterDamping * this.speed) * h;
      this.angle += this.speed * h;
      if (this.angle < 0) {
        if (-this.speed > p.bangSpeed) bang = { strength: Math.min(1, -this.speed / 3) };
        this.angle = 0;
        this.speed = -this.speed * p.shutterBounce;
      } else if (this.angle > p.shutterOpen) {
        if (this.speed > p.bangSpeed) bang = { strength: Math.min(1, this.speed / 3) };
        this.angle = p.shutterOpen;
        this.speed = -this.speed * p.shutterBounce;
      }
    }
    return bang;
  }
}
