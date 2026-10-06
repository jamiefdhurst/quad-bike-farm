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
};

export const TRAILER_PARAM_RANGES = {
  drawLength: [1.5, 4, 0.05],
  hitchRange: [0.3, 3, 0.05],
  wheelTrack: [1, 3, 0.05],
  springRate: [20, 400, 5],
  springDamping: [1, 30, 0.5],
  yawSmoothing: [1, 30, 0.5],
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
    this.sampleGround(ground, 0, null);
  }

  /** The hitch ring's place on the ground plan, ahead of the axle. */
  ring() {
    return { x: this.x + Math.sin(this.yaw) * this.p.drawLength, z: this.z + Math.cos(this.yaw) * this.p.drawLength };
  }

  /**
   * One step, hitched to a pin at `pin` ({ x, z, y } with y the pin's height).
   * @param {(x: number, z: number) => number} ground  terrain height
   */
  update(dt, pin, ground) {
    if (dt <= 0) return;
    const p = this.p;
    const before = { x: this.x, z: this.z };
    const yawBefore = this.yaw;
    const next = followHitch(this, pin, p.drawLength, this.yaw);
    this.x = next.x;
    this.z = next.z;
    this.yaw = next.yaw;
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
