// The bell on the post beside the barn doors: ring it and the girls come back to the barn (game.js ringBell). Pure: the swing
// and when the clapper strikes (BellSwing), and the sound of one strike as samples (bellStrike). The model is in bellBuild.js,
// the sound's playback in audio/bellAudio.js.

export const DEFAULT_BELL_PARAMS = {
  pitch: 560, // Hz, the bell's prime: a small brass yard bell
  ringSeconds: 3.5, // how long one strike's sound lasts before it's cut
  volume: 0.8, // of one full strike, before distance
  refDistance: 8, // m: full volume within this, falling off as 1/distance past it (heard well across the yard)
  swingPeriod: 0.9, // s, one full swing there and back on its bracket
  swingDecay: 1.6, // s, how fast the swing dies away (time constant)
  kick: 0.5, // rad of swing one pull of the rope gives
  maxSwing: 0.75, // rad, the most it swings however often you pull
  strikeBelow: 0.1, // rad: a swing smaller than this doesn't throw the clapper over, so it falls silent
};

export const BELL_PARAM_RANGES = {
  pitch: [300, 1200, 10],
  ringSeconds: [1, 6, 0.1],
  volume: [0, 1.5, 0.05],
  refDistance: [1, 30, 0.5],
  swingPeriod: [0.4, 2, 0.05],
  swingDecay: [0.4, 5, 0.1],
  kick: [0.1, 1, 0.05],
  maxSwing: [0.2, 1.2, 0.05],
  strikeBelow: [0.02, 0.4, 0.01],
};

/**
 * The bell swinging on its bracket, a damped pendulum. Each pull of the rope pushes it the way it's already going (so pulling
 * again while it rings keeps it going), up to `maxSwing`. The clapper strikes at each end of the swing while the swing is
 * still bigger than `strikeBelow`, harder the wider it swings.
 */
export class BellSwing {
  constructor(params = DEFAULT_BELL_PARAMS) {
    this.p = params;
    this.angle = 0;
    this.speed = 0; // rad/s
  }

  get omega() {
    return (2 * Math.PI) / this.p.swingPeriod;
  }

  /** How wide it's swinging now (rad), from where it is and how fast it's going. */
  get amplitude() {
    return Math.hypot(this.angle, this.speed / this.omega);
  }

  get ringing() {
    return this.amplitude > this.p.strikeBelow;
  }

  /** A pull on the rope. */
  ring() {
    const w = this.omega;
    const dir = this.speed < 0 ? -1 : 1;
    this.speed += dir * this.p.kick * w;
    const a = this.amplitude;
    if (a > this.p.maxSwing) {
      // Too wide: keep where it is in the swing and take the excess off its speed.
      const room = Math.max(0, this.p.maxSwing ** 2 - this.angle ** 2);
      this.speed = dir * Math.sqrt(room) * w;
    }
  }

  /** Moves the swing on; returns the strength (0 to 1) of each strike in this step. */
  update(dt) {
    const strikes = [];
    const w = this.omega;
    const damp = 2 / this.p.swingDecay; // the amplitude decays as e^(-t / swingDecay)
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const before = this.speed;
      this.speed += (-w * w * this.angle - damp * this.speed) * h;
      this.angle += this.speed * h;
      // At the end of a swing it stops and turns back, which throws the clapper against the side.
      if (before !== 0 && Math.sign(before) !== Math.sign(this.speed) && Math.abs(this.angle) > this.p.strikeBelow) {
        strikes.push(Math.min(1, Math.abs(this.angle) / this.p.maxSwing));
      }
    }
    if (!this.ringing && Math.abs(this.speed) < 1e-3) this.angle = this.speed = 0;
    return strikes;
  }
}

// A cast bell's partials, as multiples of its prime, with how loud each starts and how long it rings (s). The hum is an octave
// under, the minor-third tierce gives it the bell sound, and the high ones are the clang that dies first.
const PARTIALS = [
  [0.5, 0.35, 2.4],
  [1, 0.6, 1.8],
  [1.19, 0.45, 1.3],
  [1.5, 0.25, 1.0],
  [2, 0.7, 0.9],
  [2.51, 0.3, 0.55],
  [2.66, 0.25, 0.45],
  [3.01, 0.2, 0.3],
  [4.16, 0.15, 0.15],
];

/**
 * One strike of the bell, as mono samples peaking at 1. Each partial is a pair of sines a fraction of a hertz apart, so it
 * beats and shimmers as a real bell does, plus a few milliseconds of tick for the clapper hitting.
 */
export function bellStrike(sampleRate, { pitch, ringSeconds }, random = Math.random) {
  const n = Math.floor(sampleRate * ringSeconds);
  const out = new Float32Array(n);
  for (const [ratio, amp, decay] of PARTIALS) {
    const f = pitch * ratio;
    if (f >= sampleRate / 2) continue;
    const beat = 0.3 + random() * 0.8;
    const phase = random() * Math.PI * 2;
    const k1 = (2 * Math.PI * (f - beat / 2)) / sampleRate;
    const k2 = (2 * Math.PI * (f + beat / 2)) / sampleRate;
    const fall = 1 / (decay * sampleRate);
    for (let i = 0; i < n; i++) out[i] += amp * Math.exp(-i * fall) * 0.5 * (Math.sin(k1 * i + phase) + Math.sin(k2 * i));
  }
  const tick = Math.floor(sampleRate * 0.004);
  for (let i = 0; i < tick && i < n; i++) out[i] += (random() * 2 - 1) * 0.5 * (1 - i / tick);
  // A short fade at the end, so cutting it off doesn't click.
  const tail = Math.min(n, Math.floor(sampleRate * 0.05));
  for (let i = 0; i < tail; i++) out[n - 1 - i] *= i / tail;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak;
  return out;
}
