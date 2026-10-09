import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { EngineModel } from '../engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS, ENGINE_PARAM_RANGES } from '../engine/engineParams.js';
import { TorqueRock } from '../vibration/torqueRock.js';
import { VibrationModel } from '../vibration/vibrationModel.js';
import { DEFAULT_VIBRATION_PARAMS, VIBRATION_PARAM_RANGES } from '../vibration/vibrationParams.js';
import { EngineAudio } from '../audio/engineAudio.js';
import { RideAudio } from '../audio/rideAudio.js';
import { DEFAULT_AUDIO_PARAMS, AUDIO_PARAM_RANGES } from '../audio/audioParams.js';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS, SMOKE_PARAM_RANGES } from '../effects/exhaustSmoke.js';
import { DustCloud } from '../effects/dustCloud.js';
import { QuadMud, DEFAULT_MUD_PARAMS, MUD_PARAM_RANGES, MUD_STATE_RANGES } from '../effects/quadMud.js';
import { Quad } from './quad.js';
import { DEFAULT_VEHICLE_PARAMS, VEHICLE_PARAM_RANGES } from './vehicleParams.js';
import { FAULT_PARAM_RANGES } from './faults.js';
import { DEFAULT_FUEL_PARAMS, FUEL_PARAM_RANGES } from './fuelSystem.js';
import { DEFAULT_CONTROLS_PARAMS, CONTROLS_PARAM_RANGES } from './controls.js';
import { DEFAULT_GEARBOX_PARAMS, GEARBOX_PARAM_RANGES } from './manualDrivetrain.js';
import { SHIFTER_PARAM_RANGES } from './autoShifter.js';
import { buildAtcModel, ATC_LAYOUT, ATC_GROUND_OFFSET, ATC_PROXY } from './atcModel.js';
import { buildMiniMotoModel, MOTO_LAYOUT, MOTO_GROUND_OFFSET, MOTO_PROXY } from './miniMotoModel.js';
import { buildTractorModel, TRACTOR_LAYOUT, TRACTOR_GROUND_OFFSET, TRACTOR_PROXY } from './tractorModel.js';
import { buildUtvModel, UTV_LAYOUT, UTV_GROUND_OFFSET, UTV_PROXY, UTV_STAND } from './utvModel.js';
import { buildLandRoverModel, LANDY_LAYOUT, LANDY_GROUND_OFFSET, LANDY_PROXY, LANDY_STAND } from './landRoverModel.js';
import { CrankHandle, DEFAULT_CRANK_PARAMS, CRANK_PARAM_RANGES } from './crankHandle.js';

import { hotSteam } from '../engine/heat.js';

// Where steam leaves the orange's radiator, in the model's own space, and what the steam looks like: pale, quick and rising.
const RADIATOR_AT = { x: 0, y: 0.68, z: 0.86 };
const STEAM_SMOKE = { opacity: 1.2, maxPerSecond: 40, lifeMin: 0.8, lifeMax: 2.4, startSize: 0.1, endSize: 1.0, exitSpeed: 1.6, drag: 1.4, buoyancy: 1.1 };

/**
 * Everything one quad needs, built from a spec in quadSpecs.js: the engine
 * model, the bike and its physics, vibration, exhaust smoke and engine sound. The tractor (a spec with `tractor: true`) is built the same
 * way with its own body, wheel layout and a clutch and gearbox in place of the CVT.
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
      scale: spec.scale,
      solo: spec.solo,
      plateNumber: spec.plateNumber,
      reverseStyle: spec.reverseStyle,
      chokeStyle: spec.chokeStyle,
      tapStyle: spec.tapStyle,
      drive: spec.driveSwitch ? { lock: !!spec.diffLock } : null,
      controlsParams: { ...DEFAULT_CONTROLS_PARAMS },
      fuelParams: { ...DEFAULT_FUEL_PARAMS, ...spec.fuel },
      ...((spec.tractor || spec.manual) && { gearbox: { ...DEFAULT_GEARBOX_PARAMS, ...spec.gearbox } }),
      ...(spec.miniMoto && {
        build: ({ dashStyle }) => buildMiniMotoModel({ bodyColor: spec.bodyColor, dashStyle }),
        layout: MOTO_LAYOUT,
        groundOffset: MOTO_GROUND_OFFSET,
        proxy: MOTO_PROXY,
        wheelShake: spec.wheelShake,
      }),
      ...(spec.threeWheeler && {
        build: ({ dashStyle }) => buildAtcModel({ bodyColor: spec.bodyColor, dashStyle, chokeStyle: spec.chokeStyle }),
        layout: ATC_LAYOUT,
        groundOffset: ATC_GROUND_OFFSET,
        proxy: ATC_PROXY,
        wheelShake: spec.wheelShake,
      }),
      ...(spec.tractor && {
        tractor: true,
        build: ({ dashStyle }) => buildTractorModel({ bodyColor: spec.bodyColor, dashStyle }),
        layout: TRACTOR_LAYOUT,
        groundOffset: TRACTOR_GROUND_OFFSET,
        proxy: TRACTOR_PROXY,
        wheelShake: spec.wheelShake,
        steadyLights: spec.steadyLights,
        noHeadlight: spec.noHeadlight,
      }),
      ...(spec.utv && {
        build: ({ dashStyle }) => buildUtvModel({ bodyColor: spec.bodyColor, dashStyle }),
        layout: UTV_LAYOUT,
        groundOffset: UTV_GROUND_OFFSET,
        proxy: UTV_PROXY,
        wheelShake: spec.wheelShake,
        steadyLights: spec.steadyLights,
        driverStand: UTV_STAND.driver,
        benchStand: UTV_STAND.left,
        lightSwitch: true, // P cycles off, dipped and main beam (lightSwitch.js)
        utv: true,
      }),
      ...(spec.landRover && {
        build: ({ dashStyle }) => buildLandRoverModel({ bodyColor: spec.bodyColor, dashStyle, variant: spec.defender ? 'defender' : 'series' }),
        layout: LANDY_LAYOUT,
        groundOffset: LANDY_GROUND_OFFSET,
        proxy: LANDY_PROXY,
        wheelShake: spec.wheelShake,
        steadyLights: spec.steadyLights,
        landRover: true,
        driverStand: LANDY_STAND.driver,
        benchStand: LANDY_STAND.left,
        handLever: !spec.defender, // the Series' hand throttle knob on its dash
        crank: spec.defender ? null : new CrankHandle({ ...DEFAULT_CRANK_PARAMS }), // and its starting handle
      }),
    });
    this.quad.unit = this;
    this.torqueRock = new TorqueRock();
    this.vibration = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS, ...spec.vibration });
    this.airbox = new THREE.Vector3(); // scratch: where a spit back puffs from, under the seat
    this.smoke = new ExhaustSmoke(scene, (x, z) => world.heightAt(x, z), { ...DEFAULT_SMOKE_PARAMS, ...spec.smoke });
    // The orange's radiator steams when it's low on coolant (a second smoke system, white, rising from the front).
    if (this.engine.params.waterCooled) {
      this.steam = new ExhaustSmoke(scene, (x, z) => world.heightAt(x, z), { ...DEFAULT_SMOKE_PARAMS, ...STEAM_SMOKE });
      this.radiator = new THREE.Vector3();
    }
    this.scene = scene;
    this.world = world;
    this.engineAt = new THREE.Vector3(); // scratch: where a hot engine's steam leaves
    this.dustAt = new THREE.Vector3(); // scratch: where dust lifts, behind the quad
    this.dustCloud = new DustCloud(scene, (x, z) => world.heightAt(x, z), world.dustParams);
    this.mud = new QuadMud({ scene, world, quad: this.quad, sport: spec.style?.startsWith('sport'), params: { ...DEFAULT_MUD_PARAMS, ...spec.mud } });
    // The mud coat swaps every body material for a copy, so the seat's frost has to tint that copy.
    const seat = this.quad.model.userData.seatMaterial;
    const seatCopy = seat && this.mud.coat?.bodyCopies?.get(seat);
    if (seatCopy) this.quad.seatMaterial = seatCopy;
    this.audio = new EngineAudio(audioHub, { ...DEFAULT_AUDIO_PARAMS, ...spec.audio });
    this.ride = new RideAudio(audioHub, this, world);
    this.listenerOnBoard = false; // set by the game while you're riding this one

    const folder = this.name;
    registerTuning(`${folder}/Engine`, this.engine.params, ENGINE_PARAM_RANGES);
    registerTuning(`${folder}/Controls`, this.quad.controlsParams, CONTROLS_PARAM_RANGES);
    registerTuning(`${folder}/Vibration`, this.vibration.params, VIBRATION_PARAM_RANGES);
    registerTuning(`${folder}/Audio`, this.audio.params, AUDIO_PARAM_RANGES);
    registerTuning(`${folder}/Smoke`, this.smoke.params, SMOKE_PARAM_RANGES);
    registerTuning(`${folder}/Mud`, this.mud.params, MUD_PARAM_RANGES);
    registerTuning(`${folder}/Mud on it`, this.mud.state, MUD_STATE_RANGES);
    registerTuning(`${folder}/Fuel`, this.quad.fuel.params, FUEL_PARAM_RANGES);
    registerTuning(`${folder}/Faults`, this.quad.faults.params, FAULT_PARAM_RANGES);
    if (this.quad.crank) registerTuning(`${folder}/Starting handle`, this.quad.crank.p, CRANK_PARAM_RANGES);
    if (this.quad.manual) {
      registerTuning(`${folder}/Gearbox`, this.quad.gearbox, GEARBOX_PARAM_RANGES);
      if (!this.quad.tractor) registerTuning(`${folder}/Her gear changes`, this.quad.shifter.params, SHIFTER_PARAM_RANGES);
    }
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
    // A sharp blip on a standing quad (parking brake on, or nobody driving it) twists it on its springs.
    const q = this.quad;
    const standing = q.parkBrake || (!q.rider && !q.driver);
    this.vibration.torqueKick(this.torqueRock.update(dt, q.throttle || q.helperThrottle, this.engine.isRunning && Math.abs(q.speed) < 0.5 && standing, this.vibration.params));
    // Ground jolts only show from outside: with you on it, it shakes as it always has.
    this.vibration.update(dt, this.engine, this.quad.rider || this.quad.driver || this.quad.passenger ? 0 : this.quad.speed);
    // The cattle grid shakes it ridden or not.
    if (this.ride?.grid) this.vibration.gridJolts(dt, this.quad.speed, this.ride.gridShare, this.ride.grid.pitch);
    this.quad.update(dt, alpha, this.vibration);
    this.smoke.update(dt, this.engine, this.quad.exhaustTip, this.quad.velocity);
    for (const e of this.engine.events) {
      // The airbox is under the seat: a puff comes up from there, not the pipe.
      if (e.type === 'spitBack' && this.quad.riderAnchor) this.smoke.spit(this.quad.riderAnchor.getWorldPosition(this.airbox), this.quad.velocity, e.strength);
    }
    if (this.steam) {
      this.quad.model.localToWorld(this.radiator.set(RADIATOR_AT.x, RADIATOR_AT.y, RADIATOR_AT.z));
      this.steam.steam(dt, this.radiator, this.engine.steam, this.quad.velocity);
    }
    this.updateHotSteam(dt);
    this.mud.update(dt);
    this.updateDust(dt);
    this.audio.onBoard = this.listenerOnBoard;
    this.audio.update(dt, this.engine, this.quad.position);
    this.ride.update(dt);
  }

  /**
   * Steam off a hot engine (engine/heat.js hotSteam): a wisp when it's cooking, and more when rain falls on a hot one out in the open.
   * It has its own smoke system, made the first time any is wanted so the quads that never get hot don't carry one.
   */
  updateHotSteam(dt) {
    const e = this.engine;
    const w = this.world.weather;
    const level = hotSteam({ running: e.isRunning, heat: e.heat, soak: e.soak, rain: w?.rain ?? 0, wet: w?.wet ?? 0, covered: !!this.world.covered?.(this.quad.position.x, this.quad.position.z) }, e.params);
    if (level <= 0.005 && !this.heatSteam) return;
    if (!this.heatSteam) {
      this.heatSteam = new ExhaustSmoke(this.scene, (x, z) => this.world.heightAt(x, z), { ...DEFAULT_SMOKE_PARAMS, ...STEAM_SMOKE });
      if (this.viewport) this.heatSteam.setViewport(...this.viewport);
    }
    // From under the seat, where the engine sits on a quad; the exhaust end for the ones with no seat anchor.
    (this.quad.riderAnchor ?? this.quad.exhaustTip ?? this.quad.model).getWorldPosition(this.engineAt);
    this.engineAt.y += 0.1;
    this.heatSteam.steam(dt, this.engineAt, level, this.quad.velocity);
  }

  /** Dust lifted off dry stubble behind the quad (world/dust.js). */
  updateDust(dt) {
    const q = this.quad;
    this.dustAt.set(q.position.x - Math.sin(q.yaw) * 0.9, 0, q.position.z - Math.cos(q.yaw) * 0.9);
    this.dustCloud.update(dt, q.dust, this.dustAt, q.velocity);
  }

  setViewport(heightPx, fovDeg) {
    this.smoke.setViewport(heightPx, fovDeg);
    this.steam?.setViewport(heightPx, fovDeg);
    this.heatSteam?.setViewport(heightPx, fovDeg);
    this.viewport = [heightPx, fovDeg];
    this.mud.setViewport(heightPx, fovDeg);
    this.dustCloud.setViewport(heightPx, fovDeg);
  }

  /** Puts the bike back where it started, on its wheels. */
  resetToSpawn(world) {
    const s = this.quad.spawn;
    this.quad.physics.reset(s.x, world.heightAt(s.x, s.z) - this.quad.groundOffset * this.quad.scale + 0.15, s.z, s.yaw);
  }
}
