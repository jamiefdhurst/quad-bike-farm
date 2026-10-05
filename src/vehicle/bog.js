// Getting stuck in a bog. In deep mud a quad loses most of its grip and sinks:
// slowly sitting there, quickly with its wheels spinning. Sunk in, the mud's
// suction holds it against anything the tyres can push, so past `stuckAt` it
// won't drive out. Rocking it (forwards, backwards, forwards...) works it loose
// a little each time, but only while it isn't in too deep; deeper than that it
// needs pulling out (the green quad's winch). Moving through or out of the mud
// at a decent pace, it rides back up. Pure logic.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const DEFAULT_BOG_PARAMS = {
  gripLoss: 0.7, // grip lost in the middle of a bog (0..1)
  digRate: 0.1, // sink per second per m/s of wheelspin (churning in it is about 4.5 m/s)
  settleRate: 0.012, // sink per second just sitting in it
  climbRate: 0.05, // rise per second per m/s of real movement
  outRate: 0.5, // rise per second once clear of the bog
  suction: 1.1, // holding force at full sink, as a fraction of the quad's weight
  stuckAt: 0.55, // sunk this far, it won't drive out by itself
  rockRelief: 0.07, // loosened each time the drive changes direction in it...
  rockLimit: 0.85, // ...but only while it's sunk less than this
  sinkDepth: 0.16, // metres the quad sits lower when fully sunk
  drag: 1.0, // mud dragging at the tyres: newtons per kg per m/s in the middle of a bog
};

export const BOG_PARAM_RANGES = {
  gripLoss: [0, 1, 0.01],
  digRate: [0, 1, 0.005],
  settleRate: [0, 0.2, 0.001],
  climbRate: [0, 1, 0.005],
  outRate: [0, 3, 0.05],
  suction: [0, 3, 0.05],
  stuckAt: [0.1, 1, 0.01],
  rockRelief: [0, 0.3, 0.005],
  rockLimit: [0.1, 1, 0.01],
  sinkDepth: [0, 0.5, 0.01],
  drag: [0, 3, 0.05],
};

/** Grip multiplier for a wheel in a bog this deep (0 none, 1 the middle). */
export function bogGrip(bog, p = DEFAULT_BOG_PARAMS) {
  return 1 - p.gripLoss * clamp(bog, 0, 1);
}

export class Bog {
  constructor(params = { ...DEFAULT_BOG_PARAMS }) {
    this.p = params;
    this.sink = 0; // 0 free .. 1 sunk to the axles
    this.lastDrive = 0; // direction of the last real push, for rocking
    this.rocks = 0; // times it's been rocked this time in
  }

  /** Sunk too far to drive out by itself. */
  get stuck() {
    return this.sink >= this.p.stuckAt;
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {number} s.bog    0..1, how deep a bog it's sitting in
   * @param {number} s.spin   m/s the driven wheels are turning over the ground beyond rolling
   * @param {number} s.speed  m/s it's actually moving over the ground
   * @param {number} s.drive  signed drive force being asked for (only its sign and whether it's pushing matter)
   */
  update(dt, { bog = 0, spin = 0, speed = 0, drive = 0 }) {
    const p = this.p;
    if (bog <= 0.02) {
      this.sink = Math.max(0, this.sink - p.outRate * dt);
      this.rocks = 0;
      this.lastDrive = 0;
      return this.sink;
    }
    const down = bog * (p.digRate * Math.abs(spin) + p.settleRate);
    const up = p.climbRate * Math.max(0, speed - 0.3);
    this.sink = clamp(this.sink + (down - up) * dt, 0, bog);
    // Rocking: each change of direction while pushing works it loose a bit.
    const dir = Math.abs(drive) > 1 ? Math.sign(drive) : 0;
    if (dir && this.lastDrive && dir !== this.lastDrive && this.sink < p.rockLimit) {
      this.sink = Math.max(0, this.sink - p.rockRelief);
      this.rocks++;
    }
    if (dir) this.lastDrive = dir;
    return this.sink;
  }

  /** Newtons of mud dragging at it going through a bog this deep at `speed` m/s. */
  dragForce(bog, mass, speed) {
    return this.p.drag * Math.max(0, bog) * mass * speed;
  }

  /** Newtons of suction holding it in, for a quad of `mass` kg. */
  holdForce(mass) {
    const s = this.sink / this.p.stuckAt;
    return this.p.suction * mass * 9.81 * Math.min(1, s * s);
  }
}
