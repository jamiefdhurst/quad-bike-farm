// How a bale trailer follows the tractor. Pure (no Three.js), so it's tested without the game (tests/trailer.test.js).
// It isn't a physics body: the axle is dragged along behind the hitch pin on a rigid drawbar, which is all that gives the off-tracking
// swing on a corner, and the body rides on springs on the axle so a girl sat on top is thrown about by the ground.

export const DEFAULT_TRAILER_PARAMS = {
  drawLength: 2.6, // metres from the hitch ring to the axle
  hitchRange: 1.1, // how close the drawbar pin has to be to the ring to hook on
  wheelTrack: 1.9, // metres between the wheels, for the roll
  springRate: 140, // the body on its springs, per second squared
  springDamping: 7, // per second; low enough to bounce a few times
  yawSmoothing: 6, // per second: how fast the turn rate settles, so one noisy frame doesn't read as a lurch
  jackknifeAngle: 1.05, // radians (about 60 degrees) between puller and trailer at which the drawbar jams against the puller
};

export const TRAILER_PARAM_RANGES = {
  drawLength: [1.5, 4, 0.05],
  hitchRange: [0.3, 3, 0.05],
  wheelTrack: [1, 3, 0.05],
  springRate: [20, 400, 5],
  springDamping: [1, 30, 0.5],
  yawSmoothing: [1, 30, 0.5],
  jackknifeAngle: [0.4, 1.5, 0.05],
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Drags the axle point along behind the hitch: it ends up exactly `length` back from the hitch, on the line to where it was.
 * @returns {{ x: number, z: number, yaw: number }} the new axle position and the way the trailer points (toward the hitch)
 */
export function followHitch(axle, hitch, length, yawNow = 0) {
  const dx = hitch.x - axle.x;
  const dz = hitch.z - axle.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return { x: axle.x, z: axle.z, yaw: yawNow };
  const ux = dx / d;
  const uz = dz / d;
  return { x: hitch.x - ux * length, z: hitch.z - uz * length, yaw: Math.atan2(ux, uz) };
}

/**
 * Moves the hitch from `from` to `to` with the axle rolling only along the trailer's own heading, which is what a real trailer does.
 * Going forward that pulls it straight behind; reversing, any sideways error grows (the axle is pushed, not pulled), which is the
 * jack-knife. The step is split so a long move is still followed along the heading. The trailer points from axle toward hitch.
 * @returns {{ x: number, z: number, yaw: number }}
 */
export function rollAxle(axle, yaw, from, to, length, maxStep = 0.12) {
  let { x, z } = axle;
  let heading = yaw;
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  if (dist > 3) return followHitch({ x, z }, to, length, yaw); // moved by something else (a respawn): just put it behind
  const steps = Math.min(40, Math.max(1, Math.ceil(dist / maxStep)));
  for (let i = 1; i <= steps; i++) {
    const hx = from.x + ((to.x - from.x) * i) / steps;
    const hz = from.z + ((to.z - from.z) * i) / steps;
    const ux = Math.sin(heading);
    const uz = Math.cos(heading);
    const wx = hx - x;
    const wz = hz - z;
    const along = wx * ux + wz * uz;
    const across = Math.max(-length, Math.min(length, wx * uz - wz * ux)); // how far the hitch is off the axle's line
    const s = along - Math.sqrt(length * length - across * across); // the axle rolls this far along its heading
    x += ux * s;
    z += uz * s;
    heading = Math.atan2(hx - x, hz - z);
  }
  return { x, z, yaw: heading };
}

/** Where the tractor's drawbar pin is on the ground plan, `back` metres behind its middle along its heading. */
export function pinPosition(x, z, yaw, back) {
  return { x: x - Math.sin(yaw) * back, z: z - Math.cos(yaw) * back };
}

/**
 * The sideways push on somebody sat at lateral position `seatX` (metres, left positive) on a trailer going at `speed` and turning at
 * `omega` (radians a second, left positive): positive when it shoves her toward her own edge, so toward the outside of the bend.
 */
export function edgePush(speed, omega, seatX) {
  return speed * omega * (seatX < 0 ? 1 : -1); // a left turn throws everyone toward the right (negative x)
}

export class TrailerMotion {
  constructor(params = { ...DEFAULT_TRAILER_PARAMS }) {
    this.p = params;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.y = 0;
    this.pitch = 0;
    this.roll = 0;
    this.omega = 0; // smoothed turn rate, left positive
    this.speed = 0; // ground speed of the axle
    this.heave = 0; // the body's height on its springs above the axle (metres)
    this.heaveVel = 0;
    this.jolt = 0; // how hard the body is being thrown about now (metres a second of vertical speed)
    this.lastGround = null;
    this.lastGroundVel = 0;
    this.lastPin = null; // where the hitch was last step
    this.hitchAngle = 0; // trailer yaw less puller yaw, left positive; 0 is straight behind
    this.jammed = false; // folded up against the puller until it is pulled forward
    this.justJammed = false; // true for the step it folded, for the game to react to once
  }

  /** Places it with its axle at (x, z) pointing `yaw`, standing still. */
  place(x, z, yaw, ground) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.omega = 0;
    this.speed = 0;
    this.heave = this.heaveVel = this.jolt = 0;
    this.lastGround = null;
    this.lastPin = null;
    this.hitchAngle = 0;
    this.jammed = this.justJammed = false;
    this.sampleGround(ground, 0, null);
  }

  /** Swings it to `angle` radians off straight behind a puller pointing `pullerYaw` with its pin at `pin` (the debug panel's jack-knife and unjam). */
  setHitchAngle(angle, pullerYaw, pin) {
    this.yaw = wrap(pullerYaw + angle);
    this.x = pin.x - Math.sin(this.yaw) * this.p.drawLength;
    this.z = pin.z - Math.cos(this.yaw) * this.p.drawLength;
    this.lastPin = { x: pin.x, z: pin.z };
    this.hitchAngle = angle;
    this.jammed = false;
  }

  /** The hitch ring's place on the ground plan, ahead of the axle. */
  ring() {
    return { x: this.x + Math.sin(this.yaw) * this.p.drawLength, z: this.z + Math.cos(this.yaw) * this.p.drawLength };
  }

  /**
   * One step, hitched to a pin at `pin` ({ x, z, y } with y the pin's height).
   * @param {(x: number, z: number) => number} ground  terrain height
   * @param {number} [pullerYaw]  the way the puller points; with it the hitch can fold (jack-knife) and jam, without it the axle is
   *   simply dragged behind the pin
   */
  update(dt, pin, ground, pullerYaw) {
    if (dt <= 0) return;
    const p = this.p;
    const before = { x: this.x, z: this.z };
    const yawBefore = this.yaw;
    const next = pullerYaw === undefined ? followHitch(this, pin, p.drawLength, this.yaw) : rollAxle(this, this.yaw, this.lastPin ?? this.ring(), pin, p.drawLength);
    this.lastPin = { x: pin.x, z: pin.z };
    this.x = next.x;
    this.z = next.z;
    this.yaw = next.yaw;
    this.justJammed = false;
    if (pullerYaw === undefined) {
      this.hitchAngle = 0;
      this.jammed = false;
    } else {
      const free = wrap(this.yaw - pullerYaw);
      const limit = p.jackknifeAngle;
      if (Math.abs(free) > limit) {
        // Folded against the puller: held at the limit, rigid, until pulled forward enough to straighten it.
        if (!this.jammed) this.justJammed = true;
        this.jammed = true;
        this.yaw = wrap(pullerYaw + Math.sign(free) * limit);
        this.x = pin.x - Math.sin(this.yaw) * p.drawLength;
        this.z = pin.z - Math.cos(this.yaw) * p.drawLength;
      } else this.jammed = false;
      this.hitchAngle = wrap(this.yaw - pullerYaw);
    }
    this.speed = Math.hypot(this.x - before.x, this.z - before.z) / dt;
    const rate = wrap(this.yaw - yawBefore) / dt;
    // Yaw is measured from +z toward +x, which is a turn to the left, so a positive change is leftward.
    this.omega += (rate - this.omega) * Math.min(1, p.yawSmoothing * dt);
    this.sampleGround(ground, dt, pin);
  }

  /** Sits the body on the ground under it (height, pitch, roll) and springs it. */
  sampleGround(ground, dt, pin) {
    const p = this.p;
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    const half = p.wheelTrack / 2;
    // The wheels are either side of the axle along the trailer's own left, (cos, -sin).
    const left = ground(this.x + c * half, this.z - s * half);
    const right = ground(this.x - c * half, this.z + s * half);
    const under = (left + right) / 2;
    this.roll = Math.atan2(left - right, p.wheelTrack);
    const ringGround = pin ? pin.y : ground(this.x + s * p.drawLength, this.z + c * p.drawLength);
    this.pitch = Math.atan2(ringGround - under, p.drawLength);
    // The springs are driven by the axle's vertical acceleration.
    if (this.lastGround !== null && dt > 0) {
      const v = (under - this.lastGround) / dt;
      const a = (v - this.lastGroundVel) / dt;
      this.lastGroundVel = v;
      // Ground roughness at a crawl or a standstill shouldn't kick it: only what the wheels really did.
      const kick = Math.max(-40, Math.min(40, a));
      this.heaveVel += (-p.springRate * this.heave - p.springDamping * this.heaveVel - kick) * dt;
      this.heave += this.heaveVel * dt;
      this.heave = Math.max(-0.25, Math.min(0.25, this.heave));
      this.jolt = Math.abs(this.heaveVel);
    }
    this.lastGround = under;
    this.y = under;
  }
}
