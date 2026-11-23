// What a quad's wheels are rolling on, and when it knocks, lands or splashes,
// for the ride sounds (rideAudio.js). Pure logic, no Web Audio.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Whether (x, z) is inside a box with a middle, half sizes and a yaw (the barn stands turned a quarter, #682). */
function inBox(x, z, b, margin = 0) {
  const dx = x - b.x;
  const dz = z - b.z;
  const c = Math.cos(b.yaw ?? 0);
  const s = Math.sin(b.yaw ?? 0);
  return Math.abs(dx * c + dz * s) <= b.halfX - margin && Math.abs(-dx * s + dz * c) <= b.halfZ - margin;
}

/**
 * Surface under a point, as shares that add up to 1: grass, dirt (the track and the worn yard), mud (the wet ground round a puddle), water
 * (in one), tarmac (the farm road, unless it's under mud), concrete (the yard's slab and the barn's floor), stone (the farm's stone tracks) and
 * straw (the Dutch barn's floor). Stubble counts as grass. Puddles and mud win over the hard ground, which is why wellies squelch in the yard's low corner.
 * @param {object} world  Anything with mudAt(x, z), heights.puddles and layout; stoneAt(x, z) is optional.
 */
export function createSurfaceSampler(world) {
  const layout = world.layout;
  const puddles = world.heights?.puddles ?? [];
  const R = layout.puddleRadius ?? 1.7;
  const yard = layout.yard;
  const slab = layout.farmstead?.slab;
  const barn = layout.barn?.halfX ? layout.barn : null;
  const dutch = layout.dutchBarn?.halfX ? layout.dutchBarn : null;
  return function surfaceAt(x, z) {
    let near = Infinity;
    for (const p of puddles) near = Math.min(near, Math.hypot(x - p.x, z - p.z));
    // The water's edge is at about 0.8 of the hollow's radius; the ground round it is churned to mud.
    const water = 1 - smoothstep(0.6 * R, 0.85 * R, near);
    const mud = (1 - smoothstep(0.9 * R, 1.6 * R, near)) * (1 - water);
    const hard = slab && x >= slab.minX && x <= slab.maxX && z >= slab.minZ && z <= slab.maxZ ? 1 : barn && inBox(x, z, barn) ? 1 : 0;
    let dirt = world.mudAt(x, z);
    // Where the yard is concrete the old worn-yard blob is gone: the slab is its own surface.
    if (yard && !slab) dirt = Math.max(dirt, 1 - smoothstep(yard.radius * 0.45, yard.radius * 0.75, Math.hypot(x - yard.x, z - yard.z)));
    const dry = 1 - water - mud;
    const tarmac = world.tarmacAt?.(x, z) ?? 0;
    const straw = dutch && inBox(x, z, dutch) ? 1 : 0;
    const stone = Math.min(1, world.stoneAt?.(x, z) ?? 0);
    const concrete = hard * (1 - straw);
    const rest = dry * (1 - concrete - straw); // what the hard floors leave, shared out among the open ground
    const left = rest * (1 - stone);
    return {
      grass: (1 - dirt) * left * (1 - tarmac),
      dirt: dirt * left,
      mud,
      water,
      tarmac: (1 - dirt) * left * tarmac,
      concrete: concrete * dry,
      stone: rest * stone,
      straw: straw * dry,
    };
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
      // Tarmac is smooth: hardly anything to knock.
      const perMetre = (p.bumpsPerMetreGrass + (p.bumpsPerMetreTrack - p.bumpsPerMetreGrass) * (surface.dirt + surface.mud)) * (1 - 0.85 * (surface.tarmac ?? 0));
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
