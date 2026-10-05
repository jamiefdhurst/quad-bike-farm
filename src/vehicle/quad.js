import * as THREE from 'three';
import { buildQuadModel, poseSuspension, setHeadlights } from './quadModel.js';
import { FuelSystem } from './fuelSystem.js';
import { QuadPhysics, WHEELS, SUSPENSION_TOP_Y } from './quadPhysics.js';
import { Drivetrain } from './drivetrain.js';
import { CruiseControl } from './cruise.js';

// Height of the ground below the chassis origin with the bike at rest.
const GROUND_OFFSET = -0.36;
const CHOKE_STEP = 0.1;
const CHOKE_MORE_KEY = 'KeyQ';
const CHOKE_LESS_KEY = 'KeyZ';
// Holding a choke key steps again after this delay, then at this interval.
const CHOKE_REPEAT_DELAY = 0.35;
const CHOKE_REPEAT_INTERVAL = 0.12;

/**
 * The quad as a game object: rider controls, drivetrain, Rapier physics and
 * the visual model, with the engine model plugged in from outside.
 */
export class Quad {
  /**
   * @param {object} opts
   * @param {string} opts.label   How it's referred to in prompts, e.g. "red quad".
   * @param {object} opts.spawn   { x, z, yaw } where it starts.
   * @param {number} [opts.bodyColor]
   * @param {string} [opts.dashStyle]  'classic', 'modern' or 'sport'.
   * @param {string} [opts.style]      Body style, see buildQuadModel.
   * @param {object} opts.fuelParams   See fuelSystem.js.
   */
  constructor({ scene, physics, RAPIER, world, engine, params, label = 'quad', spawn, bodyColor, dashStyle, style, fuelParams }) {
    this.world = world;
    this.engine = engine;
    this.params = params;
    this.label = label;
    this.spawn = spawn;

    this.model = buildQuadModel({ bodyColor, dashStyle, style });
    this.dash = this.model.userData.dash;
    this.fuel = new FuelSystem(fuelParams);
    this.tripMiles = 0;
    scene.add(this.model);
    const part = (name) => this.model.getObjectByName(name);
    this.body = part('body');
    this.bodyRoot = part('bodyRoot');
    this.bodyRoot.position.y = GROUND_OFFSET;
    this.handlebars = part('handlebars');
    this.handlebarsBase = this.handlebars.position.clone();
    this.fuelTap = part('fuelTap');
    this.chokeLever = part('chokeLever');
    this.riderHands = part('riderHands');
    this.cameraAnchor = part('cameraAnchor');
    this.pillionAnchor = part('pillionAnchor') ?? null; // none on a single-seater
    this.riderAnchor = part('riderAnchor');
    this.exhaustTip = part('exhaustTip');
    this.wheels = WHEELS.map((w) => ({ ...w, object: part(w.name), spin: part(w.name).getObjectByName('spin') }));
    // Wheel centre heights in bodyRoot space, for posing the suspension arms.
    this.wheelHeights = WHEELS.map(() => 0);

    // Invisible box used for "look at it and press E". Reaches about 1.45 m
    // off the ground so it's easy to target from a few metres away.
    this.proxy = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 1.45, 2.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.position.y = GROUND_OFFSET + 1.45 / 2;
    this.model.add(this.proxy);

    const s = spawn;
    this.physics = new QuadPhysics(physics, RAPIER, params, {
      x: s.x,
      y: world.heightAt(s.x, s.z) - GROUND_OFFSET + 0.05,
      z: s.z,
      yaw: s.yaw,
    });
    this.drivetrain = new Drivetrain(params);
    this.cruise = new CruiseControl(params);

    // Controls, set by the rider.
    this.rider = null;
    this.input = null;
    this.remoteInput = null; // set while someone on foot is looking at the bike
    this.helperStarter = false; // she's holding the starter button
    this.driver = null; // someone else at the controls (her), see setDriver()
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.reverse = false;
    this.reverseTimer = 0;
    this.choke = 0;
    this.starter = false;
    this.displayChoke = 0;
    this.displayRpm = 0;
    // Set while it carries on with nobody on it: { steer, stuckTime }, see carryOn().
    this.ghost = null;

    this.prevPos = new THREE.Vector3();
    this.currPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.currQuat = new THREE.Quaternion();
    this.recordTransform();
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
    this.model.position.copy(this.currPos);
    this.model.quaternion.copy(this.currQuat);
  }

  get hasPillion() {
    return !!this.pillionAnchor;
  }

  get forwardSpeed() {
    return this.physics.forwardSpeed;
  }

  get speed() {
    return this.physics.speed;
  }

  get position() {
    return this.model.position;
  }

  get velocity() {
    return this.physics.body.linvel();
  }

  get yaw() {
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
    return Math.atan2(fwd.x, fwd.z);
  }

  /** True when the bike is on its side or roof. */
  get isTipped() {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.currQuat);
    return up.y < 0.45;
  }

  setRider(rider, input) {
    this.rider = rider;
    this.input = input;
    this.riderHands.visible = !!rider;
    this.ghost = null;
    if (!rider) {
      this.throttle = 0;
      this.starter = false;
    }
  }

  /**
   * Someone other than the player at the controls: an object whose `controls`
   * ({ throttle, brake, steer, starter, reverse }, throttle and brake 0..1,
   * steer -1..1 positive left) are read each physics step in place of the
   * rider's keys. The player getting on takes over from it. Pass null to clear.
   */
  setDriver(driver) {
    this.driver = driver;
    this.ghost = null;
    if (!driver && !this.input) {
      this.throttle = 0;
      this.starter = false;
      this.reverse = false;
    }
  }

  /** True while it's driving itself after the rider jumped off. */
  get isGhostRiding() {
    return !!this.ghost;
  }

  /**
   * The rider has just jumped off at speed: hold the speed and steering it had,
   * as if the throttle and bars were stuck where they were. Physics does the
   * rest. Lets go when it tips, stalls or gets stuck. Call after setRider(null).
   * Returns whether it carried on.
   */
  carryOn(throttle = 0) {
    if (this.rider || !this.engine.isRunning || this.isTipped) return false;
    const speed = Math.abs(this.forwardSpeed);
    if (speed < 0.5) return false;
    this.cruise.engage(speed, throttle);
    this.ghost = { steer: this.steer, stuckTime: 0 };
    return true;
  }

  /** Lets go of the stuck throttle and bars; it coasts and parks like any riderless quad. */
  releaseGhost() {
    this.ghost = null;
    this.throttle = 0;
  }

  /** Cruise throttle for this step, or null once it's time to let go. */
  ghostThrottle(dt, fwd) {
    const p = this.params;
    const g = this.ghost;
    if (this.isTipped || !this.engine.isRunning) return null;
    // Moving the other way to the way it was going (bounced off something) counts as stuck.
    const along = this.reverse ? -fwd : fwd;
    g.stuckTime = along < this.cruise.target * p.ghostStuckSpeed ? g.stuckTime + dt : 0;
    if (g.stuckTime > p.ghostStuckTime) return null;
    return this.cruise.update(dt, along, this.reverse ? p.reverseThrottle : 1);
  }

  /**
   * Lets someone standing next to the bike work the ignition, starter and choke
   * while looking at it. Pass null when they look away.
   */
  setRemote(input) {
    this.remoteInput = input;
  }

  /** Discrete inputs (key presses), handled once per frame, from the rider or someone beside the bike. */
  handleFrameInput(dt) {
    const input = this.input ?? this.remoteInput;
    if (!input) return;
    if (this.input) input.takeWheelSteps();
    if (input.wasPressed('KeyK')) this.engine.toggleIgnition();
    if (input.wasPressed('KeyF')) this.fuel.cycleTap();
    this.chokeKey(dt, input, CHOKE_MORE_KEY, 1);
    this.chokeKey(dt, input, CHOKE_LESS_KEY, -1);
    if (input.wasPressed('KeyT') && this.isTipped) this.rightItself();
  }

  /** One choke step per press, repeating while the key is held. */
  chokeKey(dt, input, code, direction) {
    const timers = (this.chokeTimers ??= {});
    let step = false;
    if (input.wasPressed(code)) {
      step = true;
      timers[code] = CHOKE_REPEAT_DELAY;
    } else if (input.isDown(code)) {
      timers[code] -= dt;
      if (timers[code] <= 0) {
        step = true;
        timers[code] += CHOKE_REPEAT_INTERVAL;
      }
    }
    if (step) {
      this.choke = Math.round(THREE.MathUtils.clamp(this.choke + direction * CHOKE_STEP, 0, 1) * 10) / 10;
    }
  }

  fixedUpdate(dt) {
    const p = this.params;
    const fwd = this.forwardSpeed;
    let throttleInput = 0;
    let brakeInput = 0;
    let steerInput = 0;

    if (this.input) {
      const input = this.input;
      const w = input.isDown('KeyW');
      const s = input.isDown('KeyS');
      steerInput = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
      this.starter = input.isDown('KeyR');

      if (w) {
        if (this.reverse && fwd < -0.3) brakeInput = 1;
        else {
          this.reverse = false;
          throttleInput = 1;
        }
      }
      if (s) {
        if (!this.reverse && fwd > 0.5) {
          brakeInput = 1;
          this.reverseTimer = 0;
        } else {
          this.reverseTimer += dt;
          if (this.reverseTimer > p.reverseDelay) this.reverse = true;
          if (this.reverse) throttleInput = p.reverseThrottle;
          else brakeInput = 1;
        }
      } else {
        this.reverseTimer = 0;
      }
    } else {
      // Someone beside the bike can still hold the starter.
      this.starter = (!!this.remoteInput && this.remoteInput.isDown('KeyR')) || this.helperStarter;
      if (this.driver) {
        const c = this.driver.controls;
        if (!!c.reverse !== this.reverse && Math.abs(fwd) < 0.3) this.reverse = !!c.reverse;
        throttleInput = c.throttle;
        brakeInput = c.brake;
        steerInput = c.steer;
        this.starter ||= !!c.starter;
      } else if (this.ghost) {
        const cruise = this.ghostThrottle(dt, fwd);
        if (cruise === null) this.releaseGhost();
        else throttleInput = cruise;
      }
    }

    this.throttle = throttleInput;
    this.brake = brakeInput;

    if (this.ghost) {
      // The bars stay where they were left.
      this.steer = this.ghost.steer;
    } else {
      // Steering lock reduces with speed.
      const maxSteer = ((p.maxSteerDeg * Math.PI) / 180) / (1 + p.steerSpeedReduction * Math.abs(fwd));
      this.steer += (steerInput * maxSteer - this.steer) * Math.min(1, p.steerRate * dt);
    }

    const e = this.engine;
    this.drivetrain.update({
      rpm: e.rpm,
      power: e.power,
      running: e.isRunning,
      throttle: this.throttle,
      brake: this.brake,
      forwardSpeed: fwd,
      reverse: this.reverse,
      maxRpm: e.params.maxRpm,
    });

    let brake = this.brake * p.maxBrake;
    // Nobody on it (and not carrying on by itself): the parking brake holds it.
    const idle = (!this.input && !this.ghost && !this.driver) || (throttleInput === 0 && Math.abs(fwd) < 0.5);
    if (idle) brake = Math.max(brake, p.parkingBrake);
    brake = Math.max(brake, p.rollingResistance);
    // Wheel brakes alone let a parked quad creep down a slope, so a stationary one is held.
    this.physics.setParked(idle && throttleInput === 0 && Math.abs(fwd) < 0.3);

    this.physics.applyControls({
      driveForce: this.drivetrain.driveForce,
      brake,
      steer: this.steer,
      mudAt: (x, z) => this.world.mudAt(x, z),
    });
    this.physics.update(dt);
  }

  /** Record the chassis transform after the physics step, for interpolation. */
  recordTransform() {
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
    const t = this.physics.body.translation();
    const r = this.physics.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currQuat.set(r.x, r.y, r.z, r.w);
  }

  /** Burns fuel for this frame and refills the float bowl from the tank. */
  updateFuel(dt) {
    const e = this.engine;
    this.fuel.update(dt, { rpm: e.rpm, throttle: e.throttle, choke: e.choke, running: e.isRunning });
  }

  /** Engine controls for this frame. */
  engineControls() {
    return {
      starter: this.starter,
      throttle: this.throttle,
      choke: this.choke,
      load: this.drivetrain.engineLoad,
      fuel: this.fuel.bowlLevel,
    };
  }

  update(dt, alpha, vibration) {
    this.model.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.model.quaternion.slerpQuaternions(this.prevQuat, this.currQuat, alpha);

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const st = this.physics.wheelState(i);
      w.object.position.set(w.x, SUSPENSION_TOP_Y - st.suspension, w.z);
      w.object.rotation.y = st.steering;
      w.spin.rotation.x = st.rotation;
      this.wheelHeights[i] = w.object.position.y - GROUND_OFFSET;
    }
    poseSuspension(this.model, this.wheelHeights);

    // Vibration rocks the sprung body and shakes the bars on top of steering.
    const v = vibration;
    this.body.position.set(0, v ? v.body.heave : 0, 0);
    this.body.rotation.set(v ? v.body.pitch : 0, 0, v ? v.body.roll : 0);
    this.handlebars.position.copy(this.handlebarsBase);
    if (v) this.handlebars.position.add(new THREE.Vector3(v.bars.x, v.bars.y, 0));
    this.handlebars.rotation.set(0, this.steer * 0.85 + (v ? v.bars.yaw : 0), v ? v.bars.roll : 0);

    this.updateDash(dt);
  }

  updateDash(dt) {
    const e = this.engine;
    const speed = Math.abs(this.forwardSpeed);
    this.tripMiles += (speed * dt) / 1609.34;
    const f = this.fuel;
    this.dash.update({
      rpm: e.rpm,
      maxRpm: e.params.maxRpm,
      redline: e.params.redlineRpm,
      speedMph: speed > 0.2 ? speed * 2.237 : 0,
      fuelLevel: f.level,
      reserveLevel: f.params.reserveLitres / f.params.tankCapacity,
      tap: f.tap,
      coldLight: e.coldLightOn,
      ignition: e.ignitionOn,
      tripMiles: this.tripMiles,
      reverse: this.reverse,
    });
    setHeadlights(this.model, e.ignitionOn);

    this.displayChoke += (this.choke - this.displayChoke) * Math.min(1, 12 * dt);
    // Off: lever forward. Full: pulled back towards the rider.
    this.chokeLever.rotation.x = 0.5 - this.displayChoke * 1.45;
    // Fuel tap: forward for ON, down for RESERVE, back for OFF.
    const tapAngle = { on: 0, reserve: Math.PI / 2, off: Math.PI }[f.tap];
    this.fuelTap.rotation.x += (tapAngle - this.fuelTap.rotation.x) * Math.min(1, 15 * dt);
  }

  rightItself() {
    const p = this.currPos;
    const yaw = this.yaw;
    this.physics.reset(p.x, this.world.heightAt(p.x, p.z) - GROUND_OFFSET + 0.3, p.z, yaw);
    this.recordTransform();
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
  }

  /** World position at a local offset from the chassis (x left, z forward). */
  localToWorld(x, y, z) {
    return this.model.localToWorld(new THREE.Vector3(x, y, z));
  }
}

export { GROUND_OFFSET };
