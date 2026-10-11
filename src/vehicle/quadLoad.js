// A quad going up the bale trailer's ramps, riding on it and coming off again. Pure logic, no Three.js: the game poses the quad from
// `z`, `lat` and `heading` (vehicle/hayTrailer.js) and it is tested in tests/quadLoad.test.js.
//
// Everything is in the trailer's own frame: z along it (positive toward the tractor), x across it, in metres. The trailer's back end is
// at `rearZ`; the ramps reach from there down to the ground at `footZ`. The quad is not a physics body while it is in here: it is moved
// by hand along the ramp, by the winch or by someone pushing, and rolls back down if nobody holds it.
//
//   approach   the winch is dragging it across the ground to the foot of the ramp
//   ramp       on the ramp, going up or down (held by the winch, or just pushed and ready to roll back)
//   aboard     on the bed; unstrapped it slides about when the trailer speeds up or brakes

export const DEFAULT_LOAD_PARAMS = {
  rampLength: 2.4, // metres along each ramp
  rampSeconds: 1.4, // folding them down or up
  winchSpeed: 0.7, // m/s the winch reels a quad up the ramp, or pays it out
  winchReach: 7, // metres from the foot of the ramp that the winch takes a quad from
  approachSpeed: 1.1, // m/s the cable drags it across the ground to the ramp first
  pushSpeed: 0.55, // m/s someone pushing it up the ramp by hand manages
  captureRange: 1.5, // pushed to within this of the foot of the ramp, straight on, it starts up
  alignTolerance: 0.4, // radians off straight on that still starts up the ramp
  sideTolerance: 0.7, // metres off the ramp's middle that still starts up
  rollBackMax: 3, // m/s the most it runs back down the ramp when nobody has it
  slipAccel: 2.2, // m/s squared of the trailer speeding up or braking that an unstrapped quad holds against
  slideDrag: 2.5, // m/s squared that slows a sliding quad
  slipGain: 0.8, // how much of the push over that it slides
  bedFrontStop: 0.35, // the quad's nose can't go past this z (the winch and the bales are beyond it)
};

export const LOAD_PARAM_RANGES = {
  rampLength: [1.8, 3.2, 0.05],
  rampSeconds: [0.3, 4, 0.1],
  winchSpeed: [0.2, 2, 0.05],
  winchReach: [2, 15, 0.5],
  approachSpeed: [0.3, 3, 0.05],
  pushSpeed: [0.1, 1.5, 0.05],
  captureRange: [0.5, 3, 0.1],
  alignTolerance: [0.1, 1, 0.05],
  sideTolerance: [0.2, 1.2, 0.05],
  rollBackMax: [0.5, 8, 0.1],
  slipAccel: [0.5, 8, 0.1],
  slideDrag: [0.5, 8, 0.1],
  slipGain: [0.1, 3, 0.1],
  bedFrontStop: [-1, 1, 0.05],
};

const GRAVITY = 9.81;

/** The bed's geometry in the trailer's frame, for a ramp of this length. */
export function rampGeometry(rearZ, bedY, rampLength) {
  const rise = Math.min(bedY, rampLength * 0.95);
  const run = Math.sqrt(rampLength * rampLength - rise * rise);
  return { rearZ, bedY, rise, run, footZ: rearZ - run, angle: Math.asin(rise / rampLength) };
}

/** Height of the surface at z: the ground at the foot, up the ramp, then the bed. */
export function surfaceAt(g, z) {
  if (z <= g.footZ) return 0;
  if (z >= g.rearZ) return g.bedY;
  return ((z - g.footZ) / g.run) * g.rise;
}

/** Height of the quad's middle and its nose-up pitch when its middle is at z (the axles half a wheelbase either side). */
export function loadPose(g, z, halfBase = 0.55) {
  const front = surfaceAt(g, z + halfBase);
  const back = surfaceAt(g, z - halfBase);
  return { y: (front + back) / 2, pitch: Math.atan2(front - back, halfBase * 2) };
}

/**
 * Whether a quad at `local` ({ x, z, heading } in the trailer's frame, heading from +z toward +x) is lined up on the foot of the ramp
 * and close enough to start up it by being pushed. `facing` is 1 if its nose points up the ramp, -1 if its tail does.
 */
export function canCapture(g, local, p = DEFAULT_LOAD_PARAMS) {
  const off = Math.atan2(Math.sin(local.heading), Math.cos(local.heading)); // off the trailer's own direction, -pi..pi
  const facing = Math.cos(off) >= 0 ? 1 : -1;
  const crooked = Math.abs(facing === 1 ? off : Math.atan2(Math.sin(off - Math.PI), Math.cos(off - Math.PI)));
  const ok = crooked <= p.alignTolerance && Math.abs(local.x) <= p.sideTolerance && local.z >= g.footZ - p.captureRange && local.z <= g.footZ + 0.6;
  return { ok, facing };
}

/** Whether a quad is somewhere the winch can fetch it from: behind the trailer, within reach of the foot of the ramp. */
export function inWinchReach(g, local, p = DEFAULT_LOAD_PARAMS) {
  return local.z < g.rearZ && Math.hypot(local.x, local.z - g.footZ) <= p.winchReach;
}

/** The load's strap also needs a dead quad: not running, nobody on it, not tipped, not stuck, not being towed by anything else. */
export function mayLoad(q) {
  if (q.running) return 'It is running: switch it off first';
  if (q.occupied) return 'Somebody is on it';
  if (q.tipped) return 'Right it first';
  if (q.excluded) return 'Too big for the trailer';
  if (q.hooked) return 'Unhook it first';
  return null;
}

export class QuadLoad {
  /**
   * @param {object} g  rampGeometry()
   * @param {object} start  where the quad is now, { x, z, heading }, in the trailer's frame
   * @param {object} opts  { mode: 'approach' | 'ramp', facing, halfLen, held }
   */
  constructor(g, start, { mode = 'approach', facing = 1, halfLen = 0.9, held = false } = {}, params = DEFAULT_LOAD_PARAMS) {
    this.g = g;
    this.p = params;
    this.mode = mode;
    this.facing = facing;
    this.halfLen = halfLen;
    this.held = held; // the winch has it: it stays where it is when nobody reels
    this.x = start.x;
    this.z = start.z;
    this.heading = start.heading; // in the trailer's frame, tidied up as it comes in
    this.vz = 0;
    this.strapped = false;
    this.down = false; // going down the ramp (paying out), so reaching the foot lets it go
  }

  get aboardZ() {
    return this.g.rearZ + this.halfLen;
  }

  get frontStop() {
    return this.p.bedFrontStop - this.halfLen;
  }

  /** The heading it ends up at on the ramp: straight along the trailer, nose up or tail up. */
  get targetHeading() {
    return this.facing === 1 ? 0 : Math.PI;
  }

  /**
   * One step. `ctx`: winch (+1 reeling in, -1 paying out, 0), push (+1 shoved up the ramp, -1 down, 0), accel (the trailer's
   * acceleration along itself, m/s squared, forward positive), rampOpen (they are all the way down).
   * @returns {string[]} events: 'aboard', 'released' (let go at the foot), 'rolledOff' (slid or ran off the back), 'thump' (hit the front stop), 'caught' (the winch has taken up)
   */
  step(dt, ctx) {
    const events = [];
    const p = this.p;
    if (this.mode === 'approach') {
      if (ctx.winch < 0) {
        events.push('released');
        return events;
      }
      if (ctx.winch > 0) this.drag(dt, p.approachSpeed);
      if (Math.hypot(this.x, this.z - this.g.footZ) < 0.05) {
        this.mode = 'ramp';
        this.z = this.g.footZ;
        this.x = 0;
        this.heading = this.targetHeading;
        events.push('caught');
      }
      return events;
    }
    if (this.mode === 'ramp') {
      if (ctx.winch) this.held = true;
      const slope = this.g.rise / this.g.run;
      if (ctx.winch) {
        this.vz = ctx.winch * p.winchSpeed;
        this.down = ctx.winch < 0;
      } else if (this.held) this.vz = 0;
      else if (ctx.push > 0) {
        this.vz = p.pushSpeed;
        this.down = false;
      } else {
        // Nobody has it: it runs back down, the slope pulling at it.
        this.vz = Math.max(-p.rollBackMax, this.vz - GRAVITY * (slope / Math.sqrt(1 + slope * slope)) * dt);
        if (this.vz > 0) this.vz = 0;
        this.down = true;
      }
      this.z += this.vz * dt;
      this.x *= Math.max(0, 1 - 6 * dt);
      this.heading = this.towardHeading(dt);
      if (this.z >= this.aboardZ) {
        this.z = this.aboardZ;
        this.mode = 'aboard';
        this.vz = 0;
        this.held = false;
        this.down = false;
        events.push('aboard');
      } else if (this.z <= this.g.footZ && this.vz <= 0 && this.down) {
        this.z = this.g.footZ;
        events.push('released');
      }
      return events;
    }
    // Aboard.
    this.heading = this.towardHeading(dt);
    if (this.strapped) {
      this.vz = 0;
      return events;
    }
    if (ctx.winch < 0 && ctx.rampOpen) {
      this.mode = 'ramp';
      this.held = true;
      this.down = true;
      return events;
    }
    // Unstrapped it keeps going while the trailer speeds up or brakes under it: forward when braking, back when pulling away.
    const over = Math.abs(ctx.accel) - p.slipAccel;
    if (over > 0) this.vz += -Math.sign(ctx.accel) * over * p.slipGain * dt * 4;
    const drag = Math.min(Math.abs(this.vz), p.slideDrag * dt);
    this.vz -= Math.sign(this.vz) * drag;
    this.z += this.vz * dt;
    if (this.z >= this.frontStop) {
      if (this.vz > 0.6) events.push('thump');
      this.z = this.frontStop;
      this.vz = 0;
    }
    if (this.z < this.aboardZ) {
      if (ctx.rampOpen) {
        // Out of the back and down the ramp, with whatever speed it had.
        this.mode = 'ramp';
        this.held = false;
        this.down = true;
        events.push('slid');
      } else {
        if (this.vz < -0.6) events.push('thump');
        this.z = this.aboardZ;
        this.vz = 0;
      }
    }
    return events;
  }

  /** Eases the heading round to straight along the trailer (the short way). */
  towardHeading(dt) {
    const d = Math.atan2(Math.sin(this.targetHeading - this.heading), Math.cos(this.targetHeading - this.heading));
    return this.heading + d * Math.min(1, 5 * dt);
  }

  /** The winch drags it toward the foot of the ramp, nose first, turning it round as it comes. */
  drag(dt, speed) {
    const dx = -this.x;
    const dz = this.g.footZ - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    this.heading = this.towardHeading(dt);
  }

  /** The strap: only aboard, and not while it is sliding. Returns a note if it can't. */
  toggleStrap() {
    if (this.mode !== 'aboard') return 'Get it all the way up first';
    if (!this.strapped && Math.abs(this.vz) > 0.1) return 'Let it settle first';
    this.strapped = !this.strapped;
    return null;
  }

  /** Whether the ramps may be folded up: not with a quad on them or being dragged to them. */
  get blocksRamp() {
    return this.mode !== 'aboard';
  }
}
