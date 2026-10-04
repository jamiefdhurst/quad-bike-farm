// Single-cylinder four-stroke engine model. Pure logic with no rendering or
// audio dependencies, so it can be unit tested and shared by the vibration and
// audio systems, which both consume the firing pulses it emits.
//
// The heart of it is the mixture: choke supplies enrichment, a cold engine
// needs enrichment, and the difference decides whether it catches, how it
// idles, how rough it runs and whether it fouls its plug and dies.

import { DEFAULT_ENGINE_PARAMS } from './engineParams.js';

export const EngineState = Object.freeze({
  OFF: 'off',
  IGNITION: 'ignition',
  CRANKING: 'cranking',
  RUNNING: 'running',
  STALLED: 'stalled',
});

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

export class EngineModel {
  /**
   * @param {object} [params]  Overrides for DEFAULT_ENGINE_PARAMS. The object is
   *                           copied, so pass the live object via `this.params` to tune.
   * @param {object} [options]
   * @param {() => number} [options.random]  Source of randomness in [0, 1), injectable for tests.
   */
  constructor(params = {}, { random = Math.random } = {}) {
    this.params = { ...DEFAULT_ENGINE_PARAMS, ...params };
    this.random = random;

    this.state = EngineState.OFF;
    this.rpm = 0;
    this.temperature = clamp(this.params.initialTemperature, 0, 1);
    this.fouling = 0;

    // Last inputs, kept for readouts.
    this.choke = 0;
    this.throttle = 0;
    this.load = 0;
    this.fuel = 1; // float bowl level, 0..1

    // Derived values, refreshed every step.
    this.mixture = 0;
    this.roughness = 0;
    this.power = 0;
    this.idleTarget = 0;
    this.targetRpm = 0;

    this.time = 0;
    this.cyclePhase = 0;
    this.cycleLength = 1;
    this.huntPhase = 0;
    this.huntNoise = 0;

    /** Events from the last update: { type, t, reason? }. t is seconds into that update. */
    this.events = [];
    this.pendingEvents = []; // raised between updates, e.g. by the ignition switch
    this.updating = false;
    /** Firing pulses from the last update: { t, type: 'fire'|'misfire'|'sputter'|'compression', strength, period }. */
    this.pulses = [];
  }

  get ignitionOn() {
    return this.state !== EngineState.OFF;
  }

  get isRunning() {
    return this.state === EngineState.RUNNING;
  }

  get coldLightOn() {
    return this.ignitionOn && this.temperature < this.params.warmLightThreshold;
  }

  setIgnition(on) {
    if (on === this.ignitionOn) return;
    if (on) {
      this.state = EngineState.IGNITION;
      this.emit('ignitionOn');
    } else {
      if (this.state === EngineState.RUNNING) this.emit('shutdown');
      this.state = EngineState.OFF;
      this.emit('ignitionOff');
    }
  }

  toggleIgnition() {
    this.setIgnition(!this.ignitionOn);
  }

  setTemperature(t) {
    this.temperature = clamp(t, 0, 1);
  }

  /**
   * Advance the model.
   * @param {number} dt seconds
   * @param {object} controls
   * @param {boolean} [controls.starter]  Starter button held.
   * @param {number}  [controls.throttle] 0..1
   * @param {number}  [controls.choke]    0..1
   * @param {number}  [controls.load]     0..1 drivetrain drag, e.g. braking with the clutch engaged.
   * @param {number}  [controls.fuel]     0..1 carburettor float bowl level; it starves below fuelStarveLevel.
   */
  update(dt, { starter = false, throttle = 0, choke = 0, load = 0, fuel = 1 } = {}) {
    this.events.length = 0;
    this.pulses.length = 0;
    this.events.push(...this.pendingEvents);
    this.pendingEvents.length = 0;
    this.throttle = clamp(throttle, 0, 1);
    this.choke = clamp(choke, 0, 1);
    this.load = clamp(load, 0, 1);
    this.fuel = clamp(fuel, 0, 1);
    if (dt <= 0) return;

    const steps = Math.max(1, Math.ceil(dt / this.params.maxStep));
    const h = dt / steps;
    this.updating = true;
    for (let i = 0; i < steps; i++) {
      this.stepT = i * h;
      this.step(h, starter);
    }
    this.updating = false;
  }

  // Internal ------------------------------------------------------------

  step(h, starter) {
    const p = this.params;
    this.time += h;

    this.updateStarter(starter);
    this.updateTemperature(h);
    this.updateMixture();

    switch (this.state) {
      case EngineState.CRANKING:
        this.stepCranking(h);
        break;
      case EngineState.RUNNING:
        this.stepRunning(h);
        break;
      default:
        this.stepStopped(h);
    }

    this.fouling = clamp(this.fouling, 0, 1);
    this.rpm = clamp(this.rpm, 0, p.maxRpm);
  }

  updateStarter(starter) {
    const canCrank = this.state === EngineState.IGNITION || this.state === EngineState.STALLED;
    if (starter && canCrank) {
      this.state = EngineState.CRANKING;
      this.emit('starterOn');
    } else if (!starter && this.state === EngineState.CRANKING) {
      this.state = EngineState.IGNITION;
      this.emit('starterOff');
    }
  }

  updateTemperature(h) {
    const p = this.params;
    if (this.state === EngineState.RUNNING) {
      const rpmNorm = clamp((this.rpm - p.idleRpmWarm) / (p.maxRpm - p.idleRpmWarm), 0, 1);
      this.temperature += (h / p.warmUpSeconds) * (1 + p.warmUpRpmBoost * rpmNorm);
    } else {
      this.temperature -= (h * this.temperature) / p.coolDownSeconds;
    }
    this.temperature = clamp(this.temperature, 0, 1);
  }

  updateMixture() {
    const p = this.params;
    const need = p.coldEnrichmentNeed * (1 - this.temperature);
    const supplied = p.chokeEnrichment * this.choke * (1 - p.throttleChokeRelief * this.throttle);
    // A draining float bowl leans the mixture out, whatever the choke is doing.
    const starve = clamp((p.fuelStarveLevel - this.fuel) / p.fuelStarveLevel, 0, 1);
    this.mixture = supplied - need - p.starveLean * starve;
    this.lean = Math.max(0, -this.mixture);
    this.rich = Math.max(0, this.mixture - p.richTolerance);

    const coldness = 1 - this.temperature;
    this.roughness = clamp(
      p.baseRoughness +
        p.coldRoughness * coldness +
        p.leanRoughness * this.lean +
        p.richRoughness * this.rich +
        p.foulRoughness * this.fouling,
      0,
      1,
    );
    this.power = clamp(
      1 -
        p.coldPowerLoss * coldness -
        p.leanPowerLoss * this.lean -
        p.richPowerLoss * this.rich -
        p.foulPowerLoss * this.fouling,
      p.minPower,
      1,
    );
  }

  stepCranking(h) {
    const p = this.params;
    // The starter labours just before each compression stroke (the cycle wraps
    // at 1), then surges once it's over the top, so cranking is uneven.
    const toCompression = this.cyclePhase - 0.92;
    const dip = p.crankCompressionDip * Math.exp(-((toCompression / p.crankDipWidth) ** 2));
    this.rpm += (p.crankRpm * (1 - dip) - this.rpm) * Math.min(1, p.crankSpinUpRate * h);
    // Cranking rich floods it; cranking with the throttle open blows it clear.
    this.fouling += (this.rich * p.crankFoulRate - this.throttle * p.crankClearRate) * h;

    if (this.advanceCycle(h)) {
      const t = this.cycleT;
      const width = this.mixture < 0 ? p.catchLeanWidth : p.catchRichWidth;
      const chance =
        p.catchChance *
        lerp(p.catchColdFactor, 1, this.temperature) *
        Math.exp(-((this.mixture / width) ** 2)) *
        (1 - this.fouling) *
        (this.fuel > 0.02 ? 1 : 0);

      if (this.random() < chance) {
        this.state = EngineState.RUNNING;
        this.rpm = Math.max(this.rpm, p.catchRpm);
        this.pushPulse(t, 'fire', 1.2);
        this.emit('caught', t);
      } else if (this.random() < Math.min(1, chance * 2)) {
        // Nearly caught: a weak, uneven fire that doesn't sustain.
        this.pushPulse(t, 'sputter', 0.3 + 0.3 * this.random());
      } else {
        this.pushPulse(t, 'compression', 0.5);
      }
    }
  }

  stepRunning(h) {
    const p = this.params;
    const T = this.temperature;

    // Rich running hunts: the idle wanders with a slow swing plus noise.
    this.huntPhase += 2 * Math.PI * p.huntFrequency * h;
    this.huntNoise += (this.random() * 2 - 1) * 3 * h - this.huntNoise * 1.5 * h;
    const hunt = p.huntRpm * this.rich * (0.7 * Math.sin(this.huntPhase) + this.huntNoise);

    this.idleTarget =
      p.idleRpmWarm +
      p.chokeIdleRpm * this.choke * lerp(p.chokeIdleColdFactor, 1, T) -
      p.leanIdleDrop * this.lean +
      hunt;
    this.targetRpm = Math.min(p.maxRpm, this.idleTarget + this.throttle * (p.maxRpm - this.idleTarget));

    const rate = this.rpm < this.targetRpm ? p.rpmRiseRate * this.power : p.rpmFallRate;
    this.rpm += ((this.targetRpm - this.rpm) * rate - this.load * p.loadDragRpm) * h;

    // Fouling builds while rich and clears otherwise, faster with throttle.
    if (this.rich > 0) {
      this.fouling += this.rich * p.foulRate * h;
    } else {
      this.fouling -= p.foulClearRate * (1 + p.foulClearThrottleBoost * this.throttle) * h;
    }

    if (this.advanceCycle(h)) {
      const t = this.cycleT;
      const misfireChance = p.misfireBase + p.misfireRoughness * this.roughness ** 2;
      if (this.random() < misfireChance) {
        this.rpm -= p.misfireRpmDrop;
        this.pushPulse(t, 'misfire', 0.15);
      } else {
        const strength = 1 + (this.random() * 2 - 1) * p.pulseStrengthJitter * this.roughness;
        this.rpm += (strength - 1) * p.pulseRpmKick;
        this.pushPulse(t, 'fire', strength);
      }
    }

    if (this.fuel <= 0.001) {
      this.stall('noFuel');
    } else if (this.fouling >= 1) {
      this.stall('flooded');
    } else if (this.rpm < p.stallRpm) {
      this.stall('lowRpm');
    }
  }

  stepStopped(h) {
    const p = this.params;
    this.rpm -= (this.rpm * p.spinDownRate + p.spinDownFriction) * h;
    this.rpm = Math.max(0, this.rpm);
    this.fouling -= p.foulClearRateStopped * h;
    this.idleTarget = 0;
    this.targetRpm = 0;
    // The last few compression strokes as it coasts to a stop.
    if (this.rpm > 80 && this.advanceCycle(h)) {
      this.pushPulse(this.cycleT, 'compression', Math.min(0.8, this.rpm / 1500));
    }
  }

  /** Advances the four-stroke cycle; returns true if a cycle completed this step. */
  advanceCycle(h) {
    // One power stroke every two revolutions.
    const cyclesPerSecond = this.rpm / 120;
    const before = this.cyclePhase;
    this.cyclePhase += (h * cyclesPerSecond) / this.cycleLength;
    if (this.cyclePhase < 1) return false;

    // Time within the current update at which the cycle completed.
    const frac = (1 - before) / (this.cyclePhase - before);
    this.cycleT = this.stepT + frac * h;
    this.cyclePhase -= 1;
    this.cycleLength = 1 + (this.random() * 2 - 1) * this.params.cycleJitter * this.roughness;
    return true;
  }

  /**
   * Records a pulse. `period` is how long until the next one is due at the
   * current rpm, including this cycle's random variation, so sound can be
   * fitted to the cycle it belongs to.
   */
  pushPulse(t, type, strength) {
    this.pulses.push({ t, type, strength, period: (this.cycleLength * 120) / Math.max(this.rpm, 60) });
  }

  stall(reason) {
    this.state = EngineState.STALLED;
    this.lastStallReason = reason;
    this.emit('stalled', this.stepT, reason);
  }

  emit(type, t, reason) {
    const e = { type, t: this.updating ? (t ?? this.stepT) : 0 };
    if (reason) e.reason = reason;
    (this.updating ? this.events : this.pendingEvents).push(e);
  }
}
