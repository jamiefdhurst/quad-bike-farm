// What a quad's wheels are rolling on, and when it knocks, lands or splashes,
// for the ride sounds (rideAudio.js). Pure logic, no Web Audio.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Surface under a point, as shares that add up to 1: grass, dirt (the track
 * and the worn yard), mud (the wet ground round a puddle) and water (in one).
 * @param {object} world  Anything with mudAt(x, z), heights.puddles and layout.
 */
export function createSurfaceSampler(world) {
  const layout = world.layout;
  const puddles = world.heights?.puddles ?? [];
  const R = layout.puddleRadius ?? 1.7;
  const yard = layout.yard;
  return function surfaceAt(x, z) {
    let near = Infinity;
    for (const p of puddles) near = Math.min(near, Math.hypot(x - p.x, z - p.z));
    // The water's edge is at about 0.8 of the hollow's radius; the ground round it is churned to mud.
    const water = 1 - smoothstep(0.6 * R, 0.85 * R, near);
    const mud = (1 - smoothstep(0.9 * R, 1.6 * R, near)) * (1 - water);
    let dirt = world.mudAt(x, z);
    if (yard) dirt = Math.max(dirt, 1 - smoothstep(yard.radius * 0.45, yard.radius * 0.75, Math.hypot(x - yard.x, z - yard.z)));
    const dry = 1 - water - mud;
    return { grass: (1 - dirt) * dry, dirt: dirt * dry, mud, water };
  };
}

/**
 * Turns suspension movement into sound events, one physics step at a time:
 *  - knock: a wheel's suspension compressing hard (a bump), or one wheel touching down
 *  - land: the whole quad coming down after being in the air
 *  - bump: small knocks from uneven ground, every so many metres, more on the track
 *  - splash: a wheel hitting water at speed
 * Strengths are roughly 0..1, more for big hits. Events collect in `events`
 * until taken.
 */
export class RideEvents {
  constructor(params, { random = Math.random } = {}) {
    this.params = params;
    this.random = random;
    this.events = [];
    this.prevSusp = null;
    this.wheelAir = [0, 0, 0, 0]; // seconds each wheel has been off the ground
    this.wheelWet = [0, 0, 0, 0];
    this.cooldown = [0, 0, 0, 0];
    this.airTime = 0; // seconds with every wheel off the ground
    this.fallSpeed = 0; // fastest downward speed while in the air
    this.distance = 0; // metres since the last ground bump
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {{suspension:number, contact:boolean, water?:number}[]} s.wheels
   * @param {number} s.vy      Body vertical velocity, m/s.
   * @param {number} s.speed   Ground speed, m/s.
   * @param {object} s.surface Shares from createSurfaceSampler, averaged under the wheels.
   * @param {number[]} [s.jolts]  Ground jolts the vibration model gave this step; used instead of our own bumps if given.
   */
  step(dt, { wheels, vy, speed, surface, jolts }) {
    const p = this.params;
    const r = this.random;
    const n = wheels.length;
    if (!this.prevSusp) this.prevSusp = wheels.map((w) => w.suspension);
    const anyContact = wheels.some((w) => w.contact);

    if (!anyContact) {
      this.airTime += dt;
      this.fallSpeed = Math.max(this.fallSpeed, -vy);
    }
    const landing = anyContact && this.airTime >= p.landMinAir;

    for (let i = 0; i < n; i++) {
      const w = wheels[i];
      this.cooldown[i] = Math.max(0, this.cooldown[i] - dt);
      // Positive while the suspension is being pushed up into the body.
      const compress = (this.prevSusp[i] - w.suspension) / dt;
      this.prevSusp[i] = w.suspension;
      if (landing) {
        // The landing thud covers every wheel coming down and the suspension soaking it up.
        this.cooldown[i] = p.landQuiet;
      } else if (w.contact && this.wheelAir[i] >= p.touchdownMinAir) {
        // One wheel coming back down after a hop.
        const k = Math.max(compress, -vy) / p.knockFullSpeed;
        if (k > 0.05 && this.cooldown[i] <= 0) this.push('knock', Math.min(1.5, k), i);
        this.cooldown[i] = Math.max(this.cooldown[i], p.knockCooldown);
      } else if (w.contact && compress > p.knockThreshold && this.cooldown[i] <= 0) {
        this.push('knock', Math.min(1.5, (compress - p.knockThreshold) / p.knockFullSpeed + 0.1), i);
        this.cooldown[i] = p.knockCooldown;
      }
      this.wheelAir[i] = w.contact ? 0 : this.wheelAir[i] + dt;

      // Into the water at speed.
      const wet = w.contact ? w.water ?? 0 : 0;
      if (wet > 0.5 && this.wheelWet[i] <= 0.5 && speed > p.splashMinSpeed) {
        this.push('splash', Math.min(1.5, speed / p.splashFullSpeed), i);
      }
      this.wheelWet[i] = wet;
    }

    if (landing) {
      const impact = Math.max(this.fallSpeed, -vy);
      this.push('land', Math.min(1.5, impact / p.landFullSpeed));
    }
    if (anyContact) {
      this.airTime = 0;
      this.fallSpeed = 0;
    }

    // Small stuff the physics terrain is too smooth to have: stones, ruts, tussocks.
    if (jolts) {
      for (const k of jolts) this.push('bump', Math.min(1.5, k));
    } else if (anyContact && speed > 0.5) {
      const perMetre = p.bumpsPerMetreGrass + (p.bumpsPerMetreTrack - p.bumpsPerMetreGrass) * (surface.dirt + surface.mud);
      this.distance += speed * dt * perMetre;
      const size = Math.min(1.2, speed / p.bumpFullSpeed);
      while (this.distance >= 1) {
        this.distance -= 0.5 + r();
        // Mostly small, the odd big one.
        this.push('bump', size * (0.25 + r() * r()));
      }
    }
  }

  push(type, strength, wheel = -1) {
    this.events.push({ type, strength, wheel });
  }

  /** Returns and clears the events collected so far. */
  take() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
