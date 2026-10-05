// Rapier side of the quad: a dynamic chassis and a ray-cast vehicle controller.
// No rendering here; quad.js mirrors this into the scene.

import { Traction, surfaceGrip, isDriven } from './traction.js';
import { bogGrip } from './bog.js';

// Wheel layout in chassis space (+Z forward, +X to the rider's left).
export const WHEELS = [
  { name: 'wheel_fl', x: 0.48, z: 0.62, front: true },
  { name: 'wheel_fr', x: -0.48, z: 0.62, front: true },
  { name: 'wheel_rl', x: 0.48, z: -0.62, front: false },
  { name: 'wheel_rr', x: -0.48, z: -0.62, front: false },
];
export const SUSPENSION_TOP_Y = 0.1;

// Box roughly the size of the bodywork, so people stop at the fenders.
export const CHASSIS_COLLIDER = { hx: 0.58, hy: 0.2, hz: 1.0, y: 0.15 };

export class QuadPhysics {
  /** `scale` shrinks the whole chassis (the kids' quad): wheel positions, suspension mount and bodywork box. */
  constructor(physics, RAPIER, params, spawn, scale = 1) {
    this.scale = scale;
    this.physics = physics;
    this.RAPIER = RAPIER;
    this.params = params;

    const q = yawQuat(spawn.yaw);
    this.body = physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setRotation(q)
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    const c = CHASSIS_COLLIDER;
    this.collider = physics.createCollider(
      RAPIER.ColliderDesc.cuboid(c.hx * scale, c.hy * scale, c.hz * scale).setTranslation(0, c.y * scale, 0).setFriction(0.6),
      this.body,
    );

    // Per wheel, for the engine load: { force, mud, contact }. See wheelLoads().
    this.wheelMud = WHEELS.map(() => 0);
    this.wheelLoadState = WHEELS.map(() => ({ force: 0, mud: 0, contact: false }));

    this.vehicle = physics.createVehicleController(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    for (const w of WHEELS) {
      this.vehicle.addWheel(
        { x: w.x * scale, y: SUSPENSION_TOP_Y * scale, z: w.z * scale },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        params.suspensionRestLength,
        params.wheelRadius,
      );
    }
    // What each wheel is standing on, refreshed every step (see applyControls).
    this.wheelInfo = WHEELS.map((w) => ({
      contact: false,
      point: { x: 0, y: 0, z: 0 },
      mud: 0,
      puddle: 0,
      load: 0,
      grip: params.grassFrictionSlip,
      driven: false,
      spinAngle: 0, // extra wheel rotation from wheelspin, radians
    }));
    this.traction = new Traction(WHEELS.length);
    this.driveSign = 1;
    this.applyParams();
  }

  /** While parked, a nearly stationary quad is held where it is (see update). */
  bogSpin = 0;

  setParked(parked) {
    this.parked = parked;
  }

  /** Pushes the current params into Rapier; call after tuning. */
  applyParams() {
    const p = this.params;
    this.body.setLinearDamping(p.linearDamping);
    this.body.setAngularDamping(p.angularDamping);
    this.collider.setMassProperties(
      p.mass,
      { x: 0, y: p.centreOfMassY, z: 0 },
      { x: p.pitchInertia, y: p.yawInertia, z: p.rollInertia },
      { x: 0, y: 0, z: 0, w: 1 },
    );
    for (let i = 0; i < WHEELS.length; i++) {
      this.vehicle.setWheelRadius(i, p.wheelRadius);
      this.vehicle.setWheelSuspensionRestLength(i, p.suspensionRestLength);
      this.vehicle.setWheelSuspensionStiffness(i, p.suspensionStiffness);
      this.vehicle.setWheelSuspensionCompression(i, p.suspensionCompression);
      this.vehicle.setWheelSuspensionRelaxation(i, p.suspensionRelaxation);
      this.vehicle.setWheelMaxSuspensionTravel(i, p.maxSuspensionTravel);
      this.vehicle.setWheelMaxSuspensionForce(i, p.maxSuspensionForce);
      this.vehicle.setWheelSideFrictionStiffness(i, p.sideFrictionStiffness);
      this.vehicle.setWheelFrictionSlip(i, p.grassFrictionSlip);
    }
  }

  /**
   * @param {object} c
   * @param {number} c.driveForce  Newtons, positive forwards, split across all four wheels.
   * @param {number} c.brake       Brake impulse per wheel.
   * @param {number} c.steer       Radians, positive turns left.
   * @param {(x:number, z:number) => number} [c.mudAt]     Surface lookup for per-wheel grip, 0..1.
   * @param {(x:number, z:number) => number} [c.puddleAt]  Standing water, 0..1.
   * @param {number} [c.dt]
   */
  applyControls({ driveForce, brake, steer, mudAt, puddleAt, bogAt, wet = 0, dt = 1 / 60 }) {
    const p = this.params;
    const v = this.vehicle;
    // Grip under each wheel, from where it touched down last step.
    for (let i = 0; i < WHEELS.length; i++) {
      const w = this.wheelInfo[i];
      w.contact = v.wheelIsInContact(i);
      if (w.contact) {
        const c = v.wheelContactPoint(i);
        w.point.x = c.x;
        w.point.y = c.y;
        w.point.z = c.z;
      }
      w.mud = w.contact && mudAt ? mudAt(w.point.x, w.point.z) : 0;
      w.puddle = w.contact && puddleAt ? puddleAt(w.point.x, w.point.z) : 0;
      w.load = w.contact ? (v.wheelSuspensionForce(i) ?? 0) : 0;
      w.grip = surfaceGrip(p, w.mud, w.puddle) * (w.contact && bogAt ? bogGrip(bogAt(w.point.x, w.point.z)) : 1);
      // Wet ground is slipperier, and wet mud more so.
      w.grip *= 1 - wet * (0.15 + 0.15 * w.mud);
      // Puddles are mud too, as far as the engine's concerned.
      this.wheelMud[i] = Math.max(w.mud, w.puddle);
      w.driven = isDriven(p, WHEELS[i].front);
    }
    const t = this.traction.update(dt, driveForce, this.wheelInfo, p);
    if (Math.abs(driveForce) > 1) this.driveSign = Math.sign(driveForce);
    for (let i = 0; i < WHEELS.length; i++) {
      v.setWheelEngineForce(i, t.forces[i]);
      v.setWheelBrake(i, brake);
      v.setWheelSteering(i, WHEELS[i].front ? steer : 0);
      v.setWheelFrictionSlip(i, t.grips[i]);
    }
  }

  /** How fast the driven tyres are turning over the ground beyond rolling, m/s (including churning in a bog, `bogSpin`). */
  get spinSlip() {
    return this.traction.spinSlip(this.params) + (this.bogSpin ?? 0);
  }

  /** Must run every fixed step before the physics world steps. */
  update(dt) {
    // A bog's suction (newtons, `hold`) resists it moving over the ground, like static friction.
    if (this.hold > 0) {
      const v = this.body.linvel();
      const h = Math.hypot(v.x, v.z);
      if (h > 1e-4) {
        const j = Math.min(this.hold * dt, this.body.mass() * h);
        this.body.applyImpulse({ x: (-v.x / h) * j, y: 0, z: (-v.z / h) * j }, true);
      }
    }
    this.vehicle.updateVehicle(dt);
    // Spinning wheels turn faster than the ground goes by.
    const spin = (this.driveSign * this.spinSlip * dt) / this.params.wheelRadius;
    for (const w of this.wheelInfo) if (w.driven) w.spinAngle = (w.spinAngle + spin) % (Math.PI * 2);
    // The raycast wheels' brakes can't quite hold it on a slope: it creeps a metre
    // or so a minute. Parked and all but still, its sideways and along-the-ground
    // drift is cancelled; it can still settle and bounce up and down.
    if (this.parked) {
      const v = this.body.linvel();
      if (Math.hypot(v.x, v.z) < this.params.parkedHoldSpeed) this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
    }
  }

  /** How hard each wheel is pressed into the ground (N), how muddy it is there, and whether it's touching. */
  wheelLoads() {
    for (let i = 0; i < WHEELS.length; i++) {
      const w = this.wheelLoadState[i];
      w.contact = this.vehicle.wheelIsInContact(i);
      w.force = w.contact ? (this.vehicle.wheelSuspensionForce(i) ?? 0) : 0;
      w.mud = this.wheelMud[i];
    }
    return this.wheelLoadState;
  }

  /** Signed speed along the chassis forward axis, m/s. */
  get forwardSpeed() {
    return this.vehicle.currentVehicleSpeed();
  }

  get speed() {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /** Suspension length of wheel i, for placing the visual wheel. */
  wheelState(i) {
    return {
      suspension: this.vehicle.wheelSuspensionLength(i) ?? this.params.suspensionRestLength,
      rotation: (this.vehicle.wheelRotation(i) ?? 0) + this.wheelInfo[i].spinAngle,
      steering: this.vehicle.wheelSteering(i) ?? 0,
      contact: this.vehicle.wheelIsInContact(i),
    };
  }

  /** Puts the bike back on its wheels at a spot, e.g. after a rollover. */
  reset(x, y, z, yaw) {
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation(yawQuat(yaw), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
}

function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}
