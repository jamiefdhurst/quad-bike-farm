// Turns the engine's individual firing pulses into motion for the bike body,
// the handlebars and the rider's head. Each pulse is a kick with a slightly
// random direction into a damped oscillator, so it reads as one thumping
// cylinder rather than a smooth sine wave. Riding along, the ground adds its
// own jolts, more and harder the faster it goes. Pure logic, no Three.js.

import { DEFAULT_VIBRATION_PARAMS } from './vibrationParams.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const SUBSTEP = 1 / 600;

class Oscillator {
  constructor() {
    this.x = 0;
    this.v = 0;
  }

  kick(dv) {
    this.v += dv;
  }

  step(h, freq, damping) {
    const w = 2 * Math.PI * freq;
    // Semi-implicit Euler is stable at this substep for the frequencies we use.
    this.v += (-w * w * this.x - 2 * damping * w * this.v) * h;
    this.x += this.v * h;
  }
}

export class VibrationModel {
  constructor(params = { ...DEFAULT_VIBRATION_PARAMS }, { random = Math.random } = {}) {
    this.params = params;
    this.random = random;
    this.osc = {
      heave: new Oscillator(),
      pitch: new Oscillator(),
      roll: new Oscillator(),
      barsX: new Oscillator(),
      barsY: new Oscillator(),
      barsYaw: new Oscillator(),
      barsRoll: new Oscillator(),
      camX: new Oscillator(),
      camY: new Oscillator(),
      camZ: new Oscillator(),
      camPitch: new Oscillator(),
      camRoll: new Oscillator(),
    };
    this.body = { heave: 0, pitch: 0, roll: 0 };
    this.bars = { x: 0, y: 0, yaw: 0, roll: 0 };
    this.camera = { x: 0, y: 0, z: 0, pitch: 0, roll: 0 };
    this.intensity = 0; // smoothed 0..1-ish shake level, handy for HUD and debugging
    this.groundDistance = 0; // metres travelled since the last ground jolt
  }

  /** How much of a full kick survives at this rpm. */
  rpmFactor(rpm, floor) {
    const p = this.params;
    const over = Math.max(0, rpm - p.idleRpm) / p.smoothRpmRange;
    return floor + (1 - floor) / (1 + over * over * 2.5);
  }

  /**
   * @param {number} dt
   * @param {object} engine  Anything with rpm, roughness and pulses[{t, type, strength}].
   * @param {number} [speed]  Ground speed in m/s, for jolts from the ground.
   */
  update(dt, engine, speed = 0) {
    const p = this.params;
    const pulses = engine.pulses;
    const bodyFactor = this.rpmFactor(engine.rpm, p.highRpmFloor);
    const barsFactor = this.rpmFactor(engine.rpm, p.barsHighRpmFloor);
    const roughBoost = 1 + p.roughnessGain * engine.roughness;

    let pulseIndex = 0;
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / steps;
    let kickSum = 0;
    for (let s = 0; s < steps; s++) {
      const tEnd = (s + 1) * h;
      while (pulseIndex < pulses.length && pulses[pulseIndex].t <= tEnd) {
        kickSum += this.kick(pulses[pulseIndex++], bodyFactor, barsFactor, roughBoost);
      }
      this.integrate(h);
    }
    // Any pulses timestamped at the very end.
    while (pulseIndex < pulses.length) {
      kickSum += this.kick(pulses[pulseIndex++], bodyFactor, barsFactor, roughBoost);
    }
    this.groundJolts(dt, speed);

    const o = this.osc;
    this.body.heave = o.heave.x;
    this.body.pitch = o.pitch.x;
    this.body.roll = o.roll.x;
    this.bars.x = o.barsX.x;
    this.bars.y = o.barsY.x;
    this.bars.yaw = o.barsYaw.x;
    this.bars.roll = o.barsRoll.x;
    this.camera.x = o.camX.x;
    this.camera.y = o.camY.x;
    this.camera.z = o.camZ.x;
    this.camera.pitch = o.camPitch.x;
    this.camera.roll = o.camRoll.x;

    const rate = dt > 0 ? kickSum / dt : 0;
    this.intensity += (clamp(rate / 20, 0, 2) - this.intensity) * Math.min(1, 4 * dt);
  }

  kick(pulse, bodyFactor, barsFactor, roughBoost) {
    const p = this.params;
    const r = this.random;
    let typeScale = 1;
    if (pulse.type === 'compression') typeScale = p.compressionScale;
    else if (pulse.type === 'sputter') typeScale = p.sputterScale;
    else if (pulse.type === 'misfire') typeScale = p.misfireScale;

    const base = p.pulseGain * pulse.strength * typeScale * roughBoost;
    const body = base * bodyFactor;
    const bars = base * barsFactor;
    const j = p.directionJitter;
    // Mostly the same direction each time with some variation, plus random sign on the side-to-side parts.
    const vary = () => 1 - j * 0.5 + j * r();
    const side = () => (r() * 2 - 1) * (0.4 + 0.6 * j);

    const o = this.osc;
    o.heave.kick(body * p.heaveGain * vary());
    o.pitch.kick(body * p.pitchGain * vary());
    o.roll.kick(body * p.rollGain * side());
    o.barsX.kick(bars * p.barsGain * side());
    o.barsY.kick(bars * p.barsGain * vary());
    o.barsYaw.kick(bars * p.barsRotGain * side() * 0.3);
    o.barsRoll.kick(bars * p.barsRotGain * side());
    o.camX.kick(body * p.cameraGain * side());
    o.camY.kick(body * p.cameraGain * vary());
    o.camZ.kick(body * p.cameraGain * side() * 0.5);
    o.camPitch.kick(body * p.cameraRotGain * side());
    o.camRoll.kick(body * p.cameraRotGain * side());
    return body;
  }

  /**
   * Uneven ground: a jolt every so many metres, harder with speed, mostly small
   * with the odd big one. They land between physics bumps, which the terrain is
   * too smooth to give at this scale.
   */
  groundJolts(dt, speed) {
    const p = this.params;
    if (speed < 0.3 || p.groundGain <= 0) return;
    this.groundDistance += speed * dt;
    const spacing = 1 / p.groundJoltsPerMetre;
    const size = p.groundGain * Math.min(1.5, speed / p.groundFullSpeed);
    const o = this.osc;
    const r = this.random;
    const sign = () => (r() < 0.5 ? -1 : 1);
    while (this.groundDistance >= spacing) {
      this.groundDistance -= spacing * (0.5 + r());
      const k = size * (0.3 + r() * r() * 1.7);
      o.heave.kick(k * p.heaveGain * sign());
      o.pitch.kick(k * p.pitchGain * sign());
      o.roll.kick(k * p.rollGain * sign());
      o.barsX.kick(k * p.barsGain * 0.5 * sign());
      o.barsRoll.kick(k * p.barsRotGain * 0.5 * sign());
      o.camY.kick(k * p.cameraGain * sign());
      o.camPitch.kick(k * p.cameraRotGain * sign());
      o.camRoll.kick(k * p.cameraRotGain * sign());
    }
  }

  integrate(h) {
    const p = this.params;
    const o = this.osc;
    o.heave.step(h, p.heaveFreq, p.heaveDamping);
    o.pitch.step(h, p.pitchFreq, p.pitchDamping);
    o.roll.step(h, p.rollFreq, p.rollDamping);
    o.barsX.step(h, p.barsFreq, p.barsDamping);
    o.barsY.step(h, p.barsFreq * 1.13, p.barsDamping);
    o.barsYaw.step(h, p.barsFreq * 0.8, p.barsDamping);
    o.barsRoll.step(h, p.barsFreq * 0.9, p.barsDamping);
    o.camX.step(h, p.cameraFreq, p.cameraDamping);
    o.camY.step(h, p.cameraFreq * 1.2, p.cameraDamping);
    o.camZ.step(h, p.cameraFreq * 0.9, p.cameraDamping);
    o.camPitch.step(h, p.cameraFreq * 1.1, p.cameraDamping);
    o.camRoll.step(h, p.cameraFreq * 0.85, p.cameraDamping);
  }
}
