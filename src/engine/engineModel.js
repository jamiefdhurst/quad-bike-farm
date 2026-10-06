// Single-cylinder four-stroke engine model. Pure logic with no rendering or
// audio dependencies, so it can be unit tested and shared by the vibration and
// audio systems, which both consume the firing pulses it emits.
//
// The heart of it is the mixture: choke supplies enrichment, a cold engine
// needs enrichment, and the difference decides whether it catches, how it
// idles, how rough it runs and whether it fouls its plug and dies.

import { DEFAULT_ENGINE_PARAMS } from './engineParams.js';
import { Knack } from './knack.js';
import { oilExcess, stepLube, nipping } from './lubrication.js';
import { runOnChance, popPropensity } from './runOn.js';
import { stepWater, waterCatchFactor } from './water.js';
import { stepDieselSoak, dieselCatchFactor } from './diesel.js';
import { stepGlow, glowReady, compressionCatchFactor } from './compression.js';
import { offTemperature } from '../world/barn.js';
import { stepHeat, stepSoak, pinkLevel, gaugeHeat, coolTickRate, hotStartRich } from './heat.js';

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
    this.knack = new Knack(this.params);

    this.state = EngineState.OFF;
    this.rpm = 0;
    this.temperature = clamp(this.params.initialTemperature, 0, 1);
    this.fouling = 0;

    // Last inputs, kept for readouts.
    this.choke = 0;
    this.throttle = 0;
    this.load = 0;
    this.driveLoad = 0;
    this.resistLoad = 0;
    this.overrunRpm = 0;
    this.fuel = 1; // float bowl level, 0..1
    this.battery = 1; // charge, 0..1: drained by the ignition and the starter, charged while it runs
    this.pullLeft = 0; // seconds left of a yank on the pull-start
    this.pullStrength = 0; // how good that yank was, 0..1
    this.clickedDead = false; // the starter has clicked for this press
    this.slip = 0; // see update()
    this.dirt = 0;
    this.clog = 0; // 0..1 how clogged the air filter is
    this.oil = this.params.strokes === 2 ? this.params.oilGood : 0; // oil fraction of the fuel it's being fed
    this.oilRich = 0; // 0..1 how much more oil than it can burn clean
    this.overheat = 0; // 0..1 extra heat from poor lubrication, on top of the temperature
    this.scuff = 0; // 0..1 damage from running without oil; at 1 it seizes
    this.nip = 0; // 0..1 how far it's nipping up
    this.silencerOff = false; // a toolbox job: louder, a bit stronger, crackles more
    this.seized = false; // locked solid: nothing turns it until it's stripped down
    this.heat = 0; // 0..1 running too hot (see heat.js)
    this.fan = false; // the radiator fan's on (water-cooled only)
    this.soak = 0; // 0..1 heat held in the metal after work; ticks as it cools, and a hot carb starts rich
    this.speed = 0; // ground speed in m/s, for the airflow
    this.ambient = 0.5; // 0..1 how warm a day it is
    this.sheltered = false; // parked under the barn roof: it cools slowly and never goes stone cold
    this.pink = 0; // 0..1 how badly it's pinking
    this.keyOff = false; // switched off but running on for a few more beats
    this.runOnLeft = 0; // firings left of that
    this.water = 0; // 0..1 water swallowed through the intake (see water.js); it drains, and it won't catch while wet
    this.gulp = 0; // water being taken in right now, per second
    this.diesel = 0; // diesel fraction of the fuel in the carb right now
    this.dieselSoak = 0; // 0..1 how soaked it is with diesel (see diesel.js); only a drain at the toolbox clears it
    this.glow = 0; // 0..1 how hot the glow plugs are (a diesel; see compression.js)
    this.keyPulled = false; // a diesel's key switched off while it runs on: it keeps going until the stop knob
    this.pinkLeft = 0; // rattles owed to the audio
    this.tickLeft = 0; // cooling ticks owed to the audio
    this.motorOn = false; // the starter motor is turning it (not just a yank on the cord)

    // Derived values, refreshed every step.
    this.mixture = 0;
    this.roughness = 0;
    this.power = 0;
    this.idleTarget = 0;
    this.freeTargetRpm = 0; // where the throttle alone would take the revs
    this.targetRpm = 0; // after the drive load and overrun
    this.lug = 0; // how hard it's labouring: 0 free, 1 dragged down to idle

    this.time = 0;
    this.cyclePhase = 0;
    this.cycleLength = 1;
    this.huntPhase = 0;
    this.huntNoise = 0;
    this.roughPhase = 0;
    this.roughNoise = 0;
    this.wear = 0; // roughness built up from running; a service (the toolbox) clears it
    this.erratic = 0; // 0..1 how erratic it's running for want of a service (see erraticFrom)
    this.stumbleLeft = 0; // cycles left of a run of misfires
    this.surge = 0; // rpm of a flare-up at idle, dying away
    this.erraticNoise = 0;

    /** Events from the last update: { type, t, reason? }. t is seconds into that update. */
    this.events = [];
    this.pendingEvents = []; // raised between updates, e.g. by the ignition switch
    this.updating = false;
    /** Firing pulses from the last update: { t, type: 'fire'|'misfire'|'sputter'|'compression', strength, period }. */
    this.pulses = [];
  }

  /** Crank revolutions per firing: 2 for a four-stroke, 1 for a two-stroke. */
  get revsPerCycle() {
    return this.params.strokes === 2 ? 1 : 2;
  }

  get ignitionOn() {
    return this.state !== EngineState.OFF && !this.keyOff && !this.keyPulled;
  }

  /** The glow lamp: a cold diesel with the key on, not running, and the plugs hot enough to start. */
  get glowLamp() {
    return this.params.compressionIgnition && this.ignitionOn && this.state !== EngineState.RUNNING && glowReady(this.glow, this.temperature, this.params);
  }

  /** The pull-out stop knob: shuts a diesel off whatever the key says. Returns false if it wasn't running. */
  stopKnob() {
    if (!this.params.compressionIgnition || this.state !== EngineState.RUNNING) return false;
    this.keyPulled = false;
    this.keyOff = false;
    this.state = EngineState.OFF;
    this.emit('shutdown');
    return true;
  }

  get isRunning() {
    return this.state === EngineState.RUNNING;
  }

  get coldLightOn() {
    return this.ignitionOn && this.temperature < this.params.warmLightThreshold;
  }

  setIgnition(on) {
    if (on === this.ignitionOn) return;
    if (this.params.compressionIgnition) {
      // A diesel's key is only the plugs and the dash: turned off with it running, it carries on.
      if (!on && this.state === EngineState.RUNNING) {
        this.keyPulled = true;
        this.emit('ignitionOff');
        return;
      }
      if (on && this.keyPulled) {
        this.keyPulled = false;
        this.emit('ignitionOn');
        return;
      }
    }
    if (on) {
      if (this.keyOff) {
        // Switched back on while it was still running on: it just carries on.
        this.keyOff = false;
        this.emit('ignitionOn');
        return;
      }
      this.state = EngineState.IGNITION;
      this.emit('ignitionOn');
    } else {
      const chance = this.state === EngineState.RUNNING ? runOnChance(this, this.params) : 0;
      if (chance > 0 && this.random() < chance) {
        // Hot, worn or lean, it keeps firing for a few beats, rougher and slower, before it dies.
        this.keyOff = true;
        this.runOnLeft = Math.round(this.params.runOnCyclesMin + chance * this.random() * (this.params.runOnCyclesMax - this.params.runOnCyclesMin));
        this.emit('ignitionOff');
        return;
      }
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
   * @param {number}  [controls.driveLoad]  0..1 how hard the wheels hold the revs down (pulling away, hills, mud).
   * @param {number}  [controls.resistLoad] 0..1 the part of driveLoad from climbing, mud or being blocked; this is what lugs a weak engine.
   * @param {number}  [controls.slip] 0..1 a slipping drive belt: the revs flare and the load doesn't hold them down.
   * @param {number}  [controls.dirt] 0..1 a dirty carb: lumpy, erratic and short of power.
   * @param {number}  [controls.clog] 0..1 a clogged air filter: runs rich, smokes darker, loses top-end power.
   * @param {number}  [controls.gulp] water going in at the intake, per second (see waterGulp).
   * @param {number}  [controls.speed] ground speed in m/s: the air that cools it.
   * @param {number}  [controls.ambient] 0..1 how warm the day is (sun on the engine).
   * @param {number}  [controls.overrunRpm] rpm above idle the wheels turn it over at with the throttle shut.
   */
  update(dt, { starter = false, throttle = 0, choke = 0, load = 0, fuel = 1, driveLoad = 0, resistLoad = 0, overrunRpm = 0, oil = this.oil, slip = 0, dirt = 0, clog = 0, gulp = 0, diesel = 0, speed = 0, ambient = 0.5, sheltered = false } = {}) {
    this.events.length = 0;
    this.pulses.length = 0;
    this.events.push(...this.pendingEvents);
    this.pendingEvents.length = 0;
    this.throttle = clamp(throttle, 0, 1);
    this.choke = clamp(choke, 0, 1);
    this.load = clamp(load, 0, 1);
    this.fuel = clamp(fuel, 0, 1);
    this.oil = Math.max(0, oil);
    this.slip = clamp(slip, 0, 1);
    this.dirt = clamp(dirt, 0, 1);
    this.clog = clamp(clog, 0, 1);
    this.gulp = Math.max(0, gulp);
    this.diesel = this.params.runsOnDiesel ? 0 : clamp(diesel, 0, 1);
    this.speed = Math.abs(speed);
    this.ambient = clamp(ambient, 0, 1);
    this.sheltered = sheltered;
    this.knack.update(dt, this.throttle, this.state === EngineState.RUNNING);
    this.driveLoad = clamp(driveLoad, 0, 1);
    this.resistLoad = clamp(resistLoad, 0, this.driveLoad);
    this.overrunRpm = Math.max(0, overrunRpm);
    if (dt <= 0) return;

    const steps = Math.max(1, Math.ceil(dt / this.params.maxStep));
    const h = dt / steps;
    this.updating = true;
    // Heat comes and goes over minutes, so it takes one step a frame rather than one per substep.
    this.stepT = 0;
    this.updateHeat(dt);
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
    this.updateBattery(h);
    this.pullLeft = Math.max(0, this.pullLeft - h);
    this.updateTemperature(h);
    this.updateLube(h);
    this.water = stepWater(this.water, h, { gulp: this.gulp, running: this.state === EngineState.RUNNING, throttle: this.throttle }, p);
    this.glow = stepGlow(this.glow, h, p.compressionIgnition && this.ignitionOn && this.state !== EngineState.RUNNING, p);
    this.dieselSoak = stepDieselSoak(this.dieselSoak, h, { diesel: this.diesel, active: this.state === EngineState.RUNNING }, p);
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
    const p = this.params;
    const canTurn = this.state === EngineState.IGNITION || this.state === EngineState.STALLED;
    const canCrank = canTurn && !this.seized;
    const motor = starter && this.battery >= p.batteryDeadBelow && !this.seized;
    const pulling = this.pullLeft > 0;
    // A dead battery: the solenoid clicks and nothing turns.
    if (starter && !motor && canTurn && !this.clickedDead) {
      this.clickedDead = true;
      this.emit('starterClick');
    }
    if (!starter) this.clickedDead = false;
    this.motorOn = motor;
    if ((motor || pulling) && canCrank) {
      this.state = EngineState.CRANKING;
      this.emit('starterOn');
    } else if (!motor && !pulling && this.state === EngineState.CRANKING) {
      this.state = EngineState.IGNITION;
      this.emit('starterOff');
    }
  }

  /** How fast the starter turns as a fraction of normal: slows as the battery goes. */
  get crankFactor() {
    const p = this.params;
    if (this.battery >= p.batteryWeakBelow) return 1;
    const t = clamp((this.battery - p.batteryDeadBelow) / Math.max(0.01, p.batteryWeakBelow - p.batteryDeadBelow), 0, 1);
    return lerp(p.weakCrankFactor, 1, t);
  }

  /** Whether the dash has power to light. */
  get hasPower() {
    return this.ignitionOn && this.battery > this.params.batteryDashOutBelow;
  }

  /** Strips it down and frees it (the toolbox): the scuffing is cleaned off, and a seizure leaves wear behind. */
  freeSeized() {
    if (this.scuff < 0.05 && !this.seized) return false;
    if (this.seized) this.wear = Math.min(this.params.wearMax, this.wear + this.params.seizeWear);
    this.seized = false;
    this.scuff = 0;
    this.overheat = 0;
    return true;
  }

  /** Put charge in (a jump from another quad), or take it out. */
  charge(amount) {
    this.battery = clamp(this.battery + amount, 0, 1);
  }

  /**
   * A yank on the recoil pull-start after holding the cord for `held` seconds.
   * Needs a pull-start, the ignition on and the engine not running. A pull of 0.45 to 1 s is a proper one; shorter is weak
   * and longer a botched yank. Returns the strength (0..1), or null if nothing happened.
   */
  pull(held) {
    const p = this.params;
    if (!p.pullStart) return null;
    if (this.state !== EngineState.IGNITION && this.state !== EngineState.STALLED) return null;
    if (this.seized) return null;
    let strength;
    if (held < p.pullGoodMin) strength = 0.25 + 0.5 * (held / p.pullGoodMin);
    else if (held <= p.pullGoodMax) strength = 1;
    else strength = lerp(1, 0.4, clamp((held - p.pullGoodMax) / Math.max(0.01, p.pullLateMax - p.pullGoodMax), 0, 1));
    this.pullLeft = p.pullSeconds;
    this.pullStrength = strength;
    return strength;
  }

  updateBattery(h) {
    const p = this.params;
    if (this.state === EngineState.RUNNING) this.battery += p.batteryChargeRate * h;
    else if (this.state === EngineState.CRANKING) {
      if (this.motorOn) this.battery -= p.batteryCrankDrain * h;
    } else if (this.state !== EngineState.OFF) this.battery -= p.batteryIgnitionDrain * h;
    this.battery = clamp(this.battery, 0, 1);
  }

  updateTemperature(h) {
    const p = this.params;
    if (this.state === EngineState.RUNNING) {
      // Heat follows how hard it's working: revs, and more again pulling under load.
      const rpmNorm = clamp((this.rpm - p.idleRpmWarm) / (p.maxRpm - p.idleRpmWarm), 0, 1);
      const work = 1 + p.warmUpRpmBoost * rpmNorm + p.warmUpLoadBoost * this.driveLoad * this.throttle;
      this.temperature += (h / p.warmUpSeconds) * work;
      // And it wears: plug, filter and carb slowly go off, faster when it's worked hard.
      // Revving it hard before it's warm is the worst of it.
      const coldThrash = clamp(1 - this.temperature / p.wearColdBelow, 0, 1) * rpmNorm;
      this.wear = Math.min(p.wearMax, this.wear + (h / 60) * p.wearPerMinute * (1 + p.wearWorkBoost * rpmNorm + p.wearColdBoost * coldThrash));
    } else {
      this.temperature = offTemperature(this.temperature, h, p.coolDownSeconds, this.sheltered, { warmFloor: p.barnWarmFloor, coolFactor: p.barnCoolFactor });
    }
    this.temperature = clamp(this.temperature, 0, 1);
  }

  /** How hard it's working, 0 (idling) to 1 (flat out or pulling hard). */
  get work() {
    const p = this.params;
    const rpmNorm = clamp((this.rpm - p.idleRpmWarm) / (p.maxRpm - p.idleRpmWarm), 0, 1);
    return Math.max(rpmNorm, this.driveLoad * this.throttle);
  }

  /** Running hot in the sun or in the mud, the radiator fan, the metal's heat, and the pinking and cooling ticks that go with them. */
  updateHeat(h) {
    const p = this.params;
    const running = this.state === EngineState.RUNNING;
    stepHeat(this, h, { running, ambient: this.ambient, work: this.work, speed: this.speed }, p);
    this.soak = stepSoak(this.soak, h, { running, work: this.work, heat: this.heat }, p);
    this.pink = running && !p.waterCooled ? pinkLevel(this.heat, p) : 0;
    // Rattling under load; the audio plays what's owed (ticks a second, so they land at random times).
    if (this.pink > 0) this.pinkLeft += p.pinkRate * this.pink * (0.2 + 0.8 * this.throttle) * h;
    while (this.pinkLeft >= 1) {
      this.pinkLeft -= 1;
      this.emit('pink', this.random() * h);
    }
    // Switched off hot, the metal ticks as it contracts, slower and slower.
    const tickRate = !running && this.state !== EngineState.CRANKING ? coolTickRate(this.soak, p) : 0;
    if (tickRate > 0) this.tickLeft += tickRate * (0.4 + 1.2 * this.random()) * h;
    else this.tickLeft = 0;
    while (this.tickLeft >= 1) {
      this.tickLeft -= 1;
      this.emit('coolTick', this.random() * h);
    }
  }

  /** What the dash gauge shows above the normal band: poor lubrication, or running hot. */
  get gaugeHeat() {
    return gaugeHeat(this.overheat, this.heat, this.params);
  }

  /** Oil in the fuel: heat and scuffing on straight petrol, smoke and a fouling plug on too much. */
  updateLube(h) {
    const p = this.params;
    const running = this.state === EngineState.RUNNING;
    const rpmNorm = clamp((this.rpm - p.idleRpmWarm) / (p.maxRpm - p.idleRpmWarm), 0, 1);
    const work = p.lubeIdleWork + (1 - p.lubeIdleWork) * Math.max(rpmNorm, this.driveLoad * this.throttle);
    if (p.strokes === 2) {
      if (stepLube(this, h, { oil: this.oil, running, work }, p)) {
        this.rpm = 0;
        this.stall('seized');
        this.emit('seized');
      }
    }
    this.nip = nipping(this.scuff, p.nipFrom);
    this.oilRich = oilExcess(this.oil, p.strokes, p);
  }

  updateMixture() {
    const p = this.params;
    const need = p.coldEnrichmentNeed * (1 - this.temperature);
    const supplied = p.chokeEnrichment * this.choke * (1 - p.throttleChokeRelief * this.throttle);
    // A draining float bowl leans the mixture out, whatever the choke is doing.
    const starve = clamp((p.fuelStarveLevel - this.fuel) / p.fuelStarveLevel, 0, 1);
    // A heat-soaked carburettor boils its fuel, so a hot engine that isn't running starts rich; the throttle open clears it.
    const hot = this.state === EngineState.RUNNING ? 0 : hotStartRich(this.soak, this.throttle, p);
    this.mixture = supplied - need - p.starveLean * starve + p.mixtureTrim + p.clogRich * this.clog + hot;
    this.lean = Math.max(0, -this.mixture);
    this.rich = Math.max(0, this.mixture - p.richTolerance);

    const coldness = 1 - this.temperature;
    // How badly it needs a service: its build roughness plus wear. Past erraticFrom it turns erratic, steeply.
    const condition = clamp(p.baseRoughness + this.wear, 0, 1);
    const e = clamp((condition - p.erraticFrom) / Math.max(0.01, 1 - p.erraticFrom), 0, 1);
    this.erratic = e * e * (3 - 2 * e) * e;
    this.roughness = clamp(
      p.baseRoughness +
        this.wear +
        p.coldRoughness * coldness +
        p.leanRoughness * this.lean +
        p.richRoughness * this.rich +
        p.foulRoughness * this.fouling +
        p.nipRoughness * this.nip +
        p.oilRichRoughness * this.oilRich +
        p.dirtRoughness * this.dirt +
        p.pinkRoughness * this.pink +
        p.waterRoughness * this.water +
        p.dieselRoughness * this.dieselSoak,
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
    this.power *= 1 - p.nipPowerLoss * this.nip;
    this.erratic = Math.max(this.erratic, this.nip * this.nip, this.dirt ** 1.5);
    this.power *= 1 - p.dirtPowerLoss * this.dirt;
    // A clogged filter can't feed the revs: it's the top end that goes.
    this.power *= 1 - p.clogPowerLoss * this.clog * clamp((this.rpm - p.idleRpmWarm) / (p.maxRpm - p.idleRpmWarm), 0, 1) ** 2;
    this.power *= 1 - p.pinkPowerLoss * this.pink;
    this.power *= 1 - p.waterPowerLoss * this.water;
    this.power *= 1 - p.dieselPowerLoss * this.dieselSoak;
    if (this.silencerOff) this.power *= 1 + p.silencerPower;
    // Stumbling, it's got almost nothing.
    if (this.stumbleLeft > 0) this.power *= p.stumblePower;
  }

  stepCranking(h) {
    const p = this.params;
    // The starter labours just before each compression stroke (the cycle wraps
    // at 1), then surges once it's over the top, so cranking is uneven.
    const toCompression = this.cyclePhase - 0.92;
    const dip = p.crankCompressionDip * Math.exp(-((toCompression / p.crankDipWidth) ** 2));
    // The starter turns slower on a weak battery; a yank on the cord goes by how good it was.
    const speed = this.motorOn ? this.crankFactor : this.pullStrength * p.pullRpmFactor;
    this.rpm += (p.crankRpm * speed * (1 - dip) - this.rpm) * Math.min(1, p.crankSpinUpRate * h);
    // Cranking rich floods it; cranking with the throttle open blows it clear.
    this.fouling += (this.rich * p.crankFoulRate - this.throttle * p.crankClearRate) * h;

    if (this.advanceCycle(h)) {
      const t = this.cycleT;
      const width = this.mixture < 0 ? p.catchLeanWidth : p.catchRichWidth;
      let chance =
        p.catchChance *
        lerp(p.catchColdFactor, 1, this.temperature) *
        this.knack.catchFactor(this.temperature) *
        waterCatchFactor(this.water, p) *
        dieselCatchFactor(this.dieselSoak, p) *
        Math.exp(-((this.mixture / width) ** 2)) *
        (1 - this.fouling) *
        clamp(speed, 0, 1) * // turned over too slowly, it won't fire

        (this.fuel > 0.02 ? 1 : 0);
      // A diesel doesn't care about the mixture: it wants hot plugs when it's cold, and turning over fast enough.
      if (p.compressionIgnition) {
        chance = p.catchChance * lerp(p.catchColdFactor, 1, this.temperature) * compressionCatchFactor(this.glow, this.temperature, p) * (1 - this.fouling) * clamp(speed, 0, 1) * (this.fuel > 0.02 ? 1 : 0);
      }

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
    // A rough engine can't hold a steady idle: it hunts up and down, far more so near the top of the range.
    this.roughPhase += 2 * Math.PI * p.roughHuntFrequency * h;
    this.roughNoise += (this.random() * 2 - 1) * 4 * h - this.roughNoise * 1.2 * h;
    const r = this.roughness;
    const roughHunt = p.roughHunt * p.idleRpmWarm * r * r * (0.6 * Math.sin(this.roughPhase) + this.roughNoise) * (1 - 0.7 * this.throttle);
    // Needing a service, the idle won't settle at all: a fast, irregular wander, and flare-ups that die away.
    this.erraticNoise += (this.random() * 2 - 1) * 14 * h - this.erraticNoise * 4 * h;
    this.surge *= Math.exp(-1.4 * h);
    const erratic = (p.erraticHunt * p.idleRpmWarm * this.erratic * this.erraticNoise * 3 + this.surge) * (1 - 0.6 * this.throttle);

    this.idleTarget =
      p.idleRpmWarm +
      p.chokeIdleRpm * this.choke * lerp(p.chokeIdleColdFactor, 1, T) -
      p.leanIdleDrop * this.lean +
      hunt +
      roughHunt +
      erratic;
    this.freeTargetRpm = Math.min(p.maxRpm, this.idleTarget + this.throttle * (p.maxRpm - this.idleTarget));
    // Under load the revs sag towards idle. A weak engine sags further when it's
    // climbing or ploughing (the slipping clutch spares it when pulling away),
    // much more so as that gets heavy, and can be dragged below idle and stall.
    const R = this.resistLoad;
    this.lug = (1 - this.slip) * p.lugDepth * this.driveLoad + p.lugWeakness * (1 - this.power) * R * R;
    // Past idle it gives up quickly rather than hanging on just above stalling.
    const sag = Math.min(1, this.lug) * (this.freeTargetRpm - this.idleTarget);
    const beyond = Math.max(0, this.lug - 1) * p.lugStallGain * this.idleTarget;
    this.targetRpm = Math.max(0, this.freeTargetRpm - sag - beyond);
    // A slipping belt lets the engine run away from the wheels as soon as there's throttle.
    this.targetRpm = Math.min(p.maxRpm, this.targetRpm + p.beltFlareRpm * this.slip * this.throttle);
    if (this.overrunRpm > 0) this.targetRpm = Math.max(this.targetRpm, this.idleTarget + this.overrunRpm);
    // A cold engine labouring runs lumpier.
    this.roughness = clamp(this.roughness + p.lugRoughness * this.lug * (1 - T), 0, 1);

    const rate = this.rpm < this.targetRpm ? p.rpmRiseRate * this.power : p.rpmFallRate;
    this.rpm += ((this.targetRpm - this.rpm) * rate - this.load * p.loadDragRpm) * h;

    // Fouling builds while rich and clears otherwise, faster with throttle.
    if (this.rich > 0) {
      this.fouling += this.rich * p.foulRate * h;
    } else if (p.idleFoulRate > 0 && this.throttle < 0.05) {
      // Oily two-stroke plugs slowly load up at idle until the throttle clears them.
      this.fouling += p.idleFoulRate * h;
    } else {
      this.fouling -= p.foulClearRate * (1 + p.foulClearThrottleBoost * this.throttle) * h;
    }

    this.fouling += this.oilRich * p.oilFoulRate * h;

    if (this.advanceCycle(h)) {
      const t = this.cycleT;
      // Too much water in it: it may just give up.
      if (this.water > p.waterStallAt && this.random() < p.waterStallChance) {
        this.stall('water');
        return;
      }
      if (this.dieselSoak > p.dieselStallAt && this.random() < p.dieselStallChance) {
        this.stall('diesel');
        return;
      }
      // Popping on the overrun: unburnt fuel going off in the pipe with the throttle shut at speed.
      if (this.throttle < p.popThrottle && this.rpm > p.popFromRpm) {
        const rpmK = clamp((this.rpm - p.popFromRpm) / Math.max(1, p.maxRpm - p.popFromRpm), 0, 1);
        const propensity = popPropensity(this, p);
        if (propensity > 0 && this.random() < p.popBase * propensity * (0.3 + rpmK)) {
          this.events.push({ type: 'overrunPop', t, strength: 0.5 + 0.5 * this.random() });
        }
      }
      // Running on with the key off: it labours, misfires and slows until the beats run out.
      if (this.keyOff) {
        this.runOnLeft--;
        this.rpm -= p.misfireRpmDrop * 0.6;
        if (this.runOnLeft <= 0) {
          this.stall('runOn');
          return;
        }
      }
      const misfireChance = this.keyOff ? 0.45 : p.misfireBase + p.misfireRoughness * this.roughness ** 2 + p.waterMisfire * this.water + p.dieselMisfire * this.dieselSoak;
      // Two-strokes at light load skip alternate firings: the ring-ding.
      this.cycleCount = (this.cycleCount ?? 0) + 1;
      const skip =
        p.skipChance > 0 &&
        this.cycleCount % 2 === 0 &&
        this.throttle < p.skipThrottle &&
        this.rpm < p.skipRpm &&
        this.random() < p.skipChance;
      const k = this.erratic;
      // Its stumbles and surges come so many times a second, however fast it's firing.
      const perCycle = 1 / Math.max(1, this.rpm / this.revsPerCycle / 60);
      if (this.stumbleLeft > 0) {
        // In the middle of a stumble: another dead cycle.
        this.stumbleLeft--;
        this.rpm -= p.misfireRpmDrop * 1.2;
        this.pushPulse(t, 'misfire', 0.1);
        if (this.stumbleLeft === 0 && this.dying) {
          this.dying = false;
          this.stall('rough');
          return;
        }
        if (this.stumbleLeft === 0 && this.random() < p.backfireChance) {
          // It catches again with a bang, the unburnt charge going off.
          this.rpm += p.pulseRpmKick * 3;
          this.pushPulse(t, 'fire', 2.6);
          this.emit('backfire', t);
        }
      } else if (k > 0 && this.random() < p.stumbleRate * k * perCycle) {
        this.stumbleLeft = Math.round(p.stumbleRunMin + this.random() * (p.stumbleRunMax - p.stumbleRunMin)) - 1;
        this.dying = this.random() < p.stumbleStallChance * k;
        this.rpm -= p.misfireRpmDrop * 1.2;
        this.pushPulse(t, 'misfire', 0.1);
      } else if (skip) {
        this.rpm -= p.misfireRpmDrop * 0.25;
        this.pushPulse(t, 'misfire', 0.3);
      } else if (this.random() < misfireChance) {
        this.rpm -= p.misfireRpmDrop;
        this.pushPulse(t, 'misfire', 0.15);
      } else {
        const strength = 1 + (this.random() * 2 - 1) * p.pulseStrengthJitter * this.roughness;
        this.rpm += (strength - 1) * p.pulseRpmKick;
        this.pushPulse(t, 'fire', strength);
        if (k > 0 && this.random() < p.surgeRate * k * perCycle) this.surge = p.surgeRpm * p.idleRpmWarm * (0.5 + 0.5 * this.random());
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
    this.freeTargetRpm = 0;
    this.targetRpm = 0;
    this.lug = 0;
    // The last few compression strokes as it coasts to a stop.
    if (this.rpm > 80 && this.advanceCycle(h)) {
      this.pushPulse(this.cycleT, 'compression', Math.min(0.8, this.rpm / 1500));
    }
  }

  /** Advances the four-stroke cycle; returns true if a cycle completed this step. */
  advanceCycle(h) {
    // One power stroke every revolution on a two-stroke, every two on a four-stroke.
    const cyclesPerSecond = this.rpm / this.revsPerCycle / 60;
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
    this.pulses.push({ t, type, strength, period: (this.cycleLength * 60 * this.revsPerCycle) / Math.max(this.rpm, 60) });
  }

  stall(reason) {
    if (this.keyPulled) {
      // A diesel stalling with its key already off: nothing left to switch, it's simply off.
      this.keyPulled = false;
      this.state = EngineState.OFF;
      this.emit('shutdown', this.stepT);
      return;
    }
    if (this.keyOff) {
      // Running on with the key off, it just dies: that's the shutdown.
      this.keyOff = false;
      this.state = EngineState.OFF;
      this.rpm = Math.min(this.rpm, this.params.stallRpm);
      this.emit('shutdown', this.stepT);
      return;
    }
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
