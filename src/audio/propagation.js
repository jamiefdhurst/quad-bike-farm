// How a quad's sound gets from the quad to your ears: the time it takes to
// travel (which is what makes a passing quad drop in pitch), a little treble
// lost to the air over distance, then HRTF panning and distance rolloff.
//
// Doppler comes from the travel time rather than from a computed pitch factor.
// Each quad's sound runs through a delay line set to distance / speed of sound;
// as the distance shrinks the delay shortens and everything in it (engine,
// tyres, splashes, thuds) plays slightly fast, and slower as it grows. The
// pitch heard is 1 - d(delay)/dt, which for a quad coming straight at you at v
// is 1 + v/c, the same as c / (c - v) to within a hundredth of a percent at
// these speeds. The quad you're riding has no delay.

export const SPEED_OF_SOUND = 343;
// Long enough for a quad at the far end of the farm; anything further is inaudible anyway.
const MAX_DELAY = 2;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Textbook Doppler factor for a moving source and listener: (c + vl) / (c + vs),
 * where vl is the listener's speed towards the source and vs the source's speed
 * away from the listener. For checking and logging; the sound itself uses the
 * delay line below.
 */
export function dopplerFactor(listenerPos, listenerVel, sourcePos, sourceVel, c = SPEED_OF_SOUND) {
  const dx = sourcePos.x - listenerPos.x;
  const dy = sourcePos.y - listenerPos.y;
  const dz = sourcePos.z - listenerPos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return 1;
  const ux = dx / d;
  const uy = dy / d;
  const uz = dz / d;
  const vs = sourceVel.x * ux + sourceVel.y * uy + sourceVel.z * uz;
  const vl = listenerVel.x * ux + listenerVel.y * uy + listenerVel.z * uz;
  return (c + vl) / Math.max(1, c + vs);
}

/** Low-pass cutoff standing in for air absorption: full range close by, losing treble with distance. */
export function airCutoff(distance, halfDistance, maxHz = 20000) {
  if (!(halfDistance > 0)) return maxHz;
  return maxHz / (1 + distance / halfDistance);
}

/**
 * Travel time from a source to the listener, smoothed so jitter in the camera
 * and teleports (getting on and off) don't warble the pitch. Pure logic.
 */
export class TravelDelay {
  constructor() {
    this.delay = null; // seconds
    this.rate = 0; // d(delay)/dt
  }

  /**
   * @param {number} dt
   * @param {number} distance  Metres from source to listener (0 for the quad you're on).
   * @param {object} p
   * @param {number} p.speedOfSound  m/s
   * @param {number} p.dopplerAmount 1 is real, 0 none (no delay at all), 2 twice as strong
   * @param {number} p.dopplerMaxSpeed  Fastest closing speed believed, m/s; quicker changes are spread out.
   * @param {number} p.dopplerSmoothing Seconds; time constant for following the distance.
   * @returns {number} the pitch factor heard this step (1 - d(delay)/dt)
   */
  update(dt, distance, p) {
    const target = clamp((distance * p.dopplerAmount) / p.speedOfSound, 0, MAX_DELAY);
    if (this.delay === null || dt <= 0) {
      this.delay = target;
      this.rate = 0;
      return 1;
    }
    // Follow the distance with a little lag, but never faster than a believable closing speed.
    const k = 1 - Math.exp(-dt / Math.max(1e-3, p.dopplerSmoothing));
    const maxRate = (p.dopplerMaxSpeed * Math.max(p.dopplerAmount, 1e-3)) / p.speedOfSound;
    const step = clamp((target - this.delay) * k, -maxRate * dt, maxRate * dt);
    this.delay += step;
    this.rate = step / dt;
    return this.pitch;
  }

  get pitch() {
    return 1 - this.rate;
  }
}

/**
 * One quad's output chain: input → travel delay → air absorption → panner →
 * master. Engine and ride sounds both feed `input`.
 */
export class SoundPath {
  constructor(hub, { refDistance, rolloff }) {
    const ctx = hub.ctx;
    this.hub = hub;
    this.input = ctx.createGain();
    this.delayNode = ctx.createDelay(MAX_DELAY);
    this.delayNode.delayTime.value = 0;
    this.air = ctx.createBiquadFilter();
    this.air.type = 'lowpass';
    this.air.frequency.value = 20000;
    this.air.Q.value = 0.6;
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = refDistance;
    this.panner.rolloffFactor = rolloff;
    this.panner.maxDistance = 600;
    this.input.connect(this.delayNode).connect(this.air).connect(this.panner).connect(hub.master);
    this.travel = new TravelDelay();
    this.schedTime = 0;
    this.distance = 0;
  }

  /**
   * Call once a frame.
   * @param {number} dt
   * @param {object} source   World position { x, y, z }.
   * @param {boolean} onBoard The listener is riding this quad: no travel time, no Doppler.
   */
  update(dt, source, onBoard) {
    const hub = this.hub;
    const ctx = hub.ctx;
    const sp = hub.params;
    const now = ctx.currentTime;
    const l = hub.listenerPosition;
    const distance = l ? Math.hypot(source.x - l.x, source.y - l.y, source.z - l.z) : 0;
    this.distance = distance;
    const doppler = sp.doppler && !onBoard;
    this.pitch = this.travel.update(dt, doppler ? distance : 0, sp);

    // Ramp the delay frame to frame on a schedule that advances with game time,
    // like the engine's pulses, so the slope (the pitch) is steady between frames.
    const param = this.delayNode.delayTime;
    if (this.schedTime < now || this.schedTime > now + 0.3) {
      this.schedTime = now + sp.latency;
      param.cancelScheduledValues(now);
      param.setValueAtTime(this.travel.delay, now);
    }
    this.schedTime += dt;
    param.linearRampToValueAtTime(this.travel.delay, this.schedTime);

    const cutoff = onBoard ? 20000 : airCutoff(distance, sp.airAbsorptionDistance);
    this.air.frequency.setTargetAtTime(cutoff, now, 0.05);

    const pn = this.panner;
    if (pn.positionX) {
      pn.positionX.setTargetAtTime(source.x, now, 0.02);
      pn.positionY.setTargetAtTime(source.y, now, 0.02);
      pn.positionZ.setTargetAtTime(source.z, now, 0.02);
    } else {
      pn.setPosition(source.x, source.y, source.z);
    }
  }
}
