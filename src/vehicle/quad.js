import * as THREE from 'three';
import { buildQuadModel, setHeadlights, DIAL_START_ANGLE, DIAL_SWEEP, DIAL_MAX_RPM } from './quadModel.js';
import { QuadPhysics, WHEELS, SUSPENSION_TOP_Y } from './quadPhysics.js';
import { Drivetrain } from './drivetrain.js';

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
  constructor({ scene, physics, RAPIER, world, engine, params }) {
    this.world = world;
    this.engine = engine;
    this.params = params;

    this.model = buildQuadModel();
    scene.add(this.model);
    const part = (name) => this.model.getObjectByName(name);
    this.body = part('body');
    this.bodyRoot = part('bodyRoot');
    this.bodyRoot.position.y = GROUND_OFFSET;
    this.handlebars = part('handlebars');
    this.handlebarsBase = this.handlebars.position.clone();
    this.rpmNeedle = part('rpmNeedle');
    this.tempLight = part('tempLight');
    this.ignitionLight = part('ignitionLight');
    this.chokeLever = part('chokeLever');
    this.riderHands = part('riderHands');
    this.cameraAnchor = part('cameraAnchor');
    this.pillionAnchor = part('pillionAnchor');
    this.riderAnchor = part('riderAnchor');
    this.exhaustTip = part('exhaustTip');
    this.wheels = WHEELS.map((w) => ({ ...w, object: part(w.name), spin: part(w.name).getObjectByName('spin') }));

    // Invisible box used for "look at it and press E". Reaches about 1.45 m
    // off the ground so it's easy to target from a few metres away.
    this.proxy = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 1.45, 2.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.position.y = GROUND_OFFSET + 1.45 / 2;
    this.model.add(this.proxy);

    const s = world.spawn.quad;
    this.physics = new QuadPhysics(physics, RAPIER, params, {
      x: s.x,
      y: world.heightAt(s.x, s.z) - GROUND_OFFSET + 0.05,
      z: s.z,
      yaw: s.yaw,
    });
    this.drivetrain = new Drivetrain(params);

    // Controls, set by the rider.
    this.rider = null;
    this.input = null;
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.reverse = false;
    this.reverseTimer = 0;
    this.choke = 0;
    this.starter = false;
    this.displayChoke = 0;
    this.displayRpm = 0;

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
    if (!rider) {
      this.throttle = 0;
      this.starter = false;
    }
  }

  /** Discrete inputs (key presses), handled once per frame. */
  handleFrameInput(dt) {
    if (!this.input) return;
    const input = this.input;
    input.takeWheelSteps();
    if (input.wasPressed('KeyK')) this.engine.toggleIgnition();
    this.chokeKey(dt, CHOKE_MORE_KEY, 1);
    this.chokeKey(dt, CHOKE_LESS_KEY, -1);
    if (input.wasPressed('KeyT') && this.isTipped) this.rightItself();
  }

  /** One choke step per press, repeating while the key is held. */
  chokeKey(dt, code, direction) {
    const timers = (this.chokeTimers ??= {});
    let step = false;
    if (this.input.wasPressed(code)) {
      step = true;
      timers[code] = CHOKE_REPEAT_DELAY;
    } else if (this.input.isDown(code)) {
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
      this.starter = false;
    }

    this.throttle = throttleInput;
    this.brake = brakeInput;

    // Steering lock reduces with speed.
    const maxSteer = ((p.maxSteerDeg * Math.PI) / 180) / (1 + p.steerSpeedReduction * Math.abs(fwd));
    this.steer += (steerInput * maxSteer - this.steer) * Math.min(1, p.steerRate * dt);

    const e = this.engine;
    this.drivetrain.update({
      rpm: e.rpm,
      power: e.power,
      running: e.isRunning,
      throttle: this.throttle,
      brake: this.brake,
      forwardSpeed: fwd,
      reverse: this.reverse,
    });

    let brake = this.brake * p.maxBrake;
    const idle = !this.input || (throttleInput === 0 && Math.abs(fwd) < 0.5);
    if (idle) brake = Math.max(brake, p.parkingBrake);
    brake = Math.max(brake, p.rollingResistance);

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

  /** Engine controls for this frame. */
  engineControls() {
    return {
      starter: this.starter,
      throttle: this.throttle,
      choke: this.choke,
      load: this.drivetrain.engineLoad,
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
    }

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
    // Needle has a little lag like a real cable-driven gauge.
    this.displayRpm += (e.rpm - this.displayRpm) * Math.min(1, 14 * dt);
    const frac = THREE.MathUtils.clamp(this.displayRpm / DIAL_MAX_RPM, 0, 1);
    this.rpmNeedle.rotation.z = -(DIAL_START_ANGLE + DIAL_SWEEP * frac);

    this.tempLight.material.color.setHex(e.coldLightOn ? 0x2f7bff : 0x1a1a1a);
    this.ignitionLight.material.color.setHex(e.ignitionOn ? 0x33dd44 : 0x1a1a1a);
    setHeadlights(this.model, e.ignitionOn);

    this.displayChoke += (this.choke - this.displayChoke) * Math.min(1, 12 * dt);
    // Off: lever forward. Full: pulled back towards the rider.
    this.chokeLever.rotation.x = 0.5 - this.displayChoke * 1.45;
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
