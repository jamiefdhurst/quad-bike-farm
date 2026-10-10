// An engine sits on rubber mounts, so it rocks on its own rather than with the frame. A four on soft mounts shakes the mounts at idle
// and lurches as it starts and stops; a single bolted close to the frame (mountGain 0) thumps the whole frame instead. Worn mounts let
// more of the engine's movement through to the frame and clonk when the throttle goes on or off. Pure logic; the vibration model
// turns it into motion.

export const DEFAULT_MOUNT_PARAMS = {
  mountGain: 0, // share of each firing that shakes the engine on its mounts rather than the frame (0 = thumps the whole frame)
  mountFreq: 11, // Hz; the engine on its rubber, quicker than the frame on its springs
  mountDamping: 0.2, // damping ratio
  mountKick: 1.6, // how hard a firing shakes the engine, against the same firing shaking the frame
  mountPass: 0.5, // share of the engine's movement that gets through good mounts to the frame
  mountCamera: 0.3, // share of that you feel in your head when you're on it
  mountStopKick: 1.2, // rad/s of lurch as the engine stops or starts, for a fully mounted engine (half as much on starting)
  mountWornShare: 0.6, // extra share of each firing the engine takes when the mounts are fully worn
  mountWornPass: 1.2, // extra share that gets through when they are fully worn
  mountClonk: 1.4, // rad/s of clonk going on or off the throttle with fully worn mounts
  mountClonkStep: 0.35, // how far the throttle must move, within mountClonkWindow, to clonk
  mountClonkWindow: 0.2, // seconds the move has to happen in
};

export const MOUNT_PARAM_RANGES = {
  mountGain: [0, 1, 0.05],
  mountFreq: [3, 30, 0.5],
  mountDamping: [0.02, 1, 0.01],
  mountKick: [0, 4, 0.05],
  mountPass: [0, 2, 0.05],
  mountCamera: [0, 1, 0.05],
  mountStopKick: [0, 4, 0.05],
  mountWornShare: [0, 1, 0.05],
  mountWornPass: [0, 3, 0.05],
  mountClonk: [0, 4, 0.05],
  mountClonkStep: [0.1, 1, 0.05],
  mountClonkWindow: [0.05, 0.6, 0.01],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** How much of each firing goes into the engine on its mounts, 0..1+: its fitted share plus what worn mounts add. `wear` is 0..1. */
export function engineShare(wear, p = DEFAULT_MOUNT_PARAMS) {
  return clamp(p.mountGain, 0, 1) + p.mountWornShare * clamp(wear, 0, 1);
}

/** How much of the engine's movement reaches the frame. */
export function passThrough(wear, p = DEFAULT_MOUNT_PARAMS) {
  return p.mountPass + p.mountWornPass * clamp(wear, 0, 1);
}

/** The lurch as the engine stops (`starting` false) or catches (true): bigger the more it is on its mounts, half as big for a start. */
export function lurchKick(wear, starting, p = DEFAULT_MOUNT_PARAMS) {
  return p.mountStopKick * Math.min(1.5, engineShare(wear, p)) * (starting ? 0.5 : 1);
}

/** Spots the throttle going on or off in a hurry, which worn mounts answer with a clonk. */
export class MountClonk {
  constructor() {
    this.lag = 0; // the throttle as it was a moment ago
    this.armed = true;
  }

  /** Returns the kick in rad/s, signed by which way the throttle went (on is nose up), or 0. Only worn mounts clonk. */
  update(dt, throttle, wear, p = DEFAULT_MOUNT_PARAMS) {
    this.lag += (throttle - this.lag) * Math.min(1, dt / Math.max(1e-3, p.mountClonkWindow));
    const move = throttle - this.lag;
    if (Math.abs(move) < p.mountClonkStep * 0.5) this.armed = true;
    if (!this.armed || Math.abs(move) < p.mountClonkStep) return 0;
    this.armed = false;
    return Math.sign(move) * p.mountClonk * clamp(wear, 0, 1) * Math.min(1, Math.abs(move));
  }
}
