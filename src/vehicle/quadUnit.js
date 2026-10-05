import { registerTuning } from '../core/tuning.js';
import { EngineModel } from '../engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS, ENGINE_PARAM_RANGES } from '../engine/engineParams.js';
import { VibrationModel } from '../vibration/vibrationModel.js';
import { DEFAULT_VIBRATION_PARAMS, VIBRATION_PARAM_RANGES } from '../vibration/vibrationParams.js';
import { EngineAudio } from '../audio/engineAudio.js';
import { RideAudio } from '../audio/rideAudio.js';
import { DEFAULT_AUDIO_PARAMS, AUDIO_PARAM_RANGES } from '../audio/audioParams.js';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS, SMOKE_PARAM_RANGES } from '../effects/exhaustSmoke.js';
import { QuadMud, DEFAULT_MUD_PARAMS, MUD_PARAM_RANGES, MUD_STATE_RANGES } from '../effects/quadMud.js';
import { Quad } from './quad.js';
import { DEFAULT_VEHICLE_PARAMS, VEHICLE_PARAM_RANGES } from './vehicleParams.js';
import { DEFAULT_FUEL_PARAMS, FUEL_PARAM_RANGES } from './fuelSystem.js';

/**
 * Everything one quad needs, built from a spec in quadSpecs.js: the engine
 * model, the bike and its physics, vibration, exhaust smoke and engine sound.
 * Each quad has its own copies of every parameter, tunable in its own folder.
 */
export class QuadUnit {
  constructor({ spec, spawn, scene, physics, RAPIER, world, audioHub }) {
    this.spec = spec;
    this.id = spec.id;
    this.name = spec.name;
    this.label = spec.label;

    this.engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine });
    this.quad = new Quad({
      scene,
      physics,
      RAPIER,
      world,
      engine: this.engine,
      params: { ...DEFAULT_VEHICLE_PARAMS, ...spec.vehicle },
      label: spec.label,
      spawn,
      bodyColor: spec.bodyColor,
      dashStyle: spec.dashStyle,
      style: spec.style,
      fuelParams: { ...DEFAULT_FUEL_PARAMS, ...spec.fuel },
    });
    this.quad.unit = this;
    this.vibration = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS, ...spec.vibration });
    this.smoke = new ExhaustSmoke(scene, (x, z) => world.heightAt(x, z), { ...DEFAULT_SMOKE_PARAMS, ...spec.smoke });
    this.mud = new QuadMud({ scene, world, quad: this.quad, sport: spec.style === 'sport', params: { ...DEFAULT_MUD_PARAMS, ...spec.mud } });
    this.audio = new EngineAudio(audioHub, { ...DEFAULT_AUDIO_PARAMS, ...spec.audio });
    this.ride = new RideAudio(audioHub, this, world);
    this.listenerOnBoard = false; // set by the game while you're riding this one

    const folder = this.name;
    registerTuning(`${folder}/Engine`, this.engine.params, ENGINE_PARAM_RANGES);
    registerTuning(`${folder}/Vibration`, this.vibration.params, VIBRATION_PARAM_RANGES);
    registerTuning(`${folder}/Audio`, this.audio.params, AUDIO_PARAM_RANGES);
    registerTuning(`${folder}/Smoke`, this.smoke.params, SMOKE_PARAM_RANGES);
    registerTuning(`${folder}/Mud`, this.mud.params, MUD_PARAM_RANGES);
    registerTuning(`${folder}/Mud on it`, this.mud.state, MUD_STATE_RANGES);
    registerTuning(`${folder}/Fuel`, this.quad.fuel.params, FUEL_PARAM_RANGES);
    registerTuning(`${folder}/Vehicle`, this.quad.params, VEHICLE_PARAM_RANGES, {
      onChange: () => this.quad.physics.applyParams(),
    });
  }

  fixedUpdate(dt) {
    this.quad.fixedUpdate(dt);
    this.ride.step(dt);
  }

  /** After the physics step. */
  recordTransform() {
    this.quad.recordTransform();
  }

  update(dt, alpha) {
    this.quad.updateFuel(dt);
    this.engine.update(dt, this.quad.engineControls());
    // Ground jolts only show from outside: with you on it, it shakes as it always has.
    this.vibration.update(dt, this.engine, this.quad.rider || this.quad.driver || this.quad.passenger ? 0 : this.quad.speed);
    this.quad.update(dt, alpha, this.vibration);
    this.smoke.update(dt, this.engine, this.quad.exhaustTip, this.quad.velocity);
    this.mud.update(dt);
    this.audio.onBoard = this.listenerOnBoard;
    this.audio.update(dt, this.engine, this.quad.position);
    this.ride.update(dt);
  }

  setViewport(heightPx, fovDeg) {
    this.smoke.setViewport(heightPx, fovDeg);
    this.mud.setViewport(heightPx, fovDeg);
  }

  /** Puts the bike back where it started, on its wheels. */
  resetToSpawn(world) {
    const s = this.quad.spawn;
    this.quad.physics.reset(s.x, world.heightAt(s.x, s.z) + 0.5, s.z, s.yaw);
  }
}
