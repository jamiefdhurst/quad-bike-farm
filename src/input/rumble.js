// Gamepad rumble, pure (no DOM): the seat's vibration (vibration/vibrationModel.js) turned into the pad's two motors. The big, low one
// carries what the whole machine feels (the engine's beat, the ground's jolts); the small, high one carries the buzz in the bars.
// `Rumble.update` takes one frame's vibration and says what the motors should do, or null when they should be still.

export const DEFAULT_RUMBLE_PARAMS = {
  enabled: 1, // 1 for rumble, 0 for none (some players find it tiring, and it is a drain on a wireless pad)
  strength: 1, // overall scale on both motors
  engineGain: 0.7, // low motor from the engine's beat: the smoothed shake level (about 0.5 at idle) times this
  groundGain: 0.5, // low motor kick for a ground jolt (one of a normal size is about 1)
  jolt: 0.18, // seconds a ground jolt's kick takes to die away
  barsGain: 1.5, // high motor from the bars' buzz: how fast they move (about 0.13 m/s at idle, 0.5 at the hardest) times this
  barsSmooth: 14, // how quickly the buzz follows the bars (per second); higher is twitchier
  pillionFeels: 0.6, // the share of the low motor you feel on the back, or any seat that isn't the rider's (no bars to hold)
  interval: 0.06, // seconds between updates sent to the pad; each replaces the last, and the browser stops one that is not renewed
};

export const RUMBLE_RANGES = {
  enabled: [0, 1, 1],
  strength: [0, 1.5, 0.05],
  engineGain: [0, 1.5, 0.05],
  groundGain: [0, 1.5, 0.05],
  jolt: [0.05, 0.6, 0.01],
  barsGain: [0, 4, 0.1],
  barsSmooth: [2, 40, 1],
  pillionFeels: [0, 1, 0.05],
  interval: [0.03, 0.2, 0.01],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Rumble {
  constructor(params = { ...DEFAULT_RUMBLE_PARAMS }) {
    this.params = params;
    this.low = 0; // what the big motor is at now (0..1)
    this.high = 0;
    this.kick = 0; // the ground jolts' share of the low motor, dying away
    this.buzz = 0; // the bars' share of the high motor, smoothed
    this.last = null; // the bars last frame, to find how fast they move
    this.since = 0;
  }

  /** Lets go of everything (off the vehicle, paused, no pad). */
  reset() {
    this.low = this.high = this.kick = this.buzz = this.since = 0;
    this.last = null;
  }

  /**
   * @param {number} dt
   * @param {object|null} vib  The ridden vehicle's VibrationModel (intensity, jolts, bars), or null when not riding.
   * @param {object} [opts]  { rider }: true when in the rider's seat, where the bars are in your hands.
   * @returns {{ low: number, high: number, duration: number }|null}  What to send to the pad now, or null if not yet time (or nothing to do).
   */
  update(dt, vib, { rider = true } = {}) {
    const p = this.params;
    if (!vib || !p.enabled || p.strength <= 0) {
      const was = this.low > 0 || this.high > 0;
      this.reset();
      return was ? { low: 0, high: 0, duration: 0 } : null;
    }
    let jolts = 0;
    for (const k of vib.jolts ?? []) jolts += Math.max(0, k);
    this.kick = Math.max(this.kick * Math.exp(-dt / Math.max(0.01, p.jolt)), clamp01(jolts * p.groundGain));

    const b = vib.bars ?? { x: 0, y: 0 };
    if (this.last && dt > 0) {
      const speed = Math.hypot(b.x - this.last.x, b.y - this.last.y) / dt;
      this.buzz += (clamp01(speed * p.barsGain) - this.buzz) * Math.min(1, p.barsSmooth * dt);
    }
    this.last = { x: b.x, y: b.y };

    const share = rider ? 1 : p.pillionFeels;
    this.low = clamp01((clamp01((vib.intensity ?? 0) * p.engineGain) + this.kick) * p.strength * share);
    this.high = rider ? clamp01(this.buzz * p.strength) : 0;

    this.since += dt;
    if (this.since < p.interval) return null;
    this.since = 0;
    // Overlap the next update a little so there is no gap between them.
    return { low: this.low, high: this.high, duration: Math.round(p.interval * 1500) };
  }
}

/** Plays an effect on the first connected pad that can rumble, if any. Returns whether it did. */
export function playRumble(effect, list) {
  const pad = [...(list ?? [])].find((g) => g && g.connected && g.vibrationActuator?.playEffect);
  if (!pad) return false;
  const act = pad.vibrationActuator;
  if (!effect.duration) {
    act.reset?.();
    return true;
  }
  // 'dual-rumble': the strong magnitude drives the big, low motor; the weak one the small, high one.
  act.playEffect('dual-rumble', { startDelay: 0, duration: effect.duration, strongMagnitude: effect.low, weakMagnitude: effect.high });
  return true;
}
