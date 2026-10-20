// Rapier side of the quad: a dynamic chassis and a ray-cast vehicle controller.
// No rendering here; quad.js mirrors this into the scene.

import { Traction, surfaceGrip, isDriven } from './traction.js';
import { bogGrip } from './bog.js';
import { toppleTorque } from './topple.js';

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

// Where the wheels, their suspension mounts and the bodywork box are. The tractor brings its own: a longer wheelbase, big rear wheels
// and small front ones (a wheel's own `radius` and mount height `y` override the vehicle's wheelRadius and `topY`).
export const QUAD_LAYOUT = { wheels: WHEELS, topY: SUSPENSION_TOP_Y, chassis: CHASSIS_COLLIDER };

export class QuadPhysics {
  /** `scale` shrinks the whole chassis (the kids' quad): wheel positions, suspension mount and bodywork box. */
  constructor(physics, RAPIER, params, spawn, scale = 1, layout = QUAD_LAYOUT) {
    this.scale = scale;
    this.layout = layout;
    this.wheels = layout.wheels;
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
    const c = layout.chassis;
    this.collider = physics.createCollider(
      RAPIER.ColliderDesc.cuboid(c.hx * scale, c.hy * scale, c.hz * scale).setTranslation(0, c.y * scale, 0).setFriction(0.6),
      this.body,
    );

    // Per wheel, for the engine load: { force, mud, contact }. See wheelLoads().
    this.wheelMud = this.wheels.map(() => 0);
    this.wheelLoadState = this.wheels.map(() => ({ force: 0, mud: 0, contact: false }));

    this.vehicle = physics.createVehicleController(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    for (const w of this.wheels) {
      this.vehicle.addWheel(
        { x: w.x * scale, y: (w.y ?? layout.topY) * scale, z: w.z * scale },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        params.suspensionRestLength,
        w.radius ? w.radius * scale : params.wheelRadius, // a layout's own wheel is model-sized, like its mount: scaled with it
      );
    }
    // What each wheel is standing on, refreshed every step (see applyControls).
    this.wheelInfo = this.wheels.map((w) => ({
      contact: false,
      point: { x: 0, y: 0, z: 0 },
      mud: 0,
      puddle: 0,
      ice: 0, // how much of the puddle under it is frozen, 0..1
      load: 0,
      grip: params.grassFrictionSlip,
      driven: false,
      spinAngle: 0, // extra wheel rotation from wheelspin, radians
    }));
    this.traction = new Traction(this.wheels.length);
    this.driveSign = 1;
    this.applyParams();
  }

  /** Wheel i's radius in the physics: the layout's own (scaled with the chassis), or the vehicle's. */
  wheelRadius(i) {
    const r = this.wheels[i].radius;
    return r ? r * this.scale : this.params.wheelRadius;
  }

  /** While parked, a nearly stationary quad is held where it is (see update). */
  bogSpin = 0;

  setParked(parked) {
    this.parked = parked;
  }

  /** The ground's drag as a factor on grass (stubble and tarmac roll easier): scales the body's linear damping. */
  setGroundDrag(factor) {
    if (Math.abs(factor - (this.groundDrag ?? 1)) < 0.02) return;
    this.groundDrag = factor;
    this.body.setLinearDamping(this.params.linearDamping * factor);
  }

  /** Pushes the current params into Rapier; call after tuning. */
  applyParams() {
    const p = this.params;
    this.body.setLinearDamping(p.linearDamping * (this.groundDrag ?? 1));
    this.body.setAngularDamping(p.angularDamping);
    this.collider.setMassProperties(
      p.mass,
      { x: 0, y: p.centreOfMassY, z: 0 },
      { x: p.pitchInertia, y: p.yawInertia, z: p.rollInertia },
      { x: 0, y: 0, z: 0, w: 1 },
    );
    for (let i = 0; i < this.wheels.length; i++) {
      this.vehicle.setWheelRadius(i, this.wheelRadius(i));
      this.vehicle.setWheelSuspensionRestLength(i, p.suspensionRestLength);
      this.vehicle.setWheelSuspensionStiffness(i, p.suspensionStiffness * (this.wheels[i].stiffness ?? 1) * (this.tyres?.stiffness(i) ?? 1));
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
   * @param {(x:number, z:number) => number} [c.iceAt]  How much of that water is frozen over, 0..1 (world/puddleIce.js), and `iceGrip` the friction slip on it.
   * @param {(x:number, z:number) => {grip:number}} [c.feelAt]  The ground's grip as a factor on grass (tarmac, stubble: world/surfaces.js).
   * @param {(x:number, z:number) => number} [c.tarmacAt]  0..1 tarmac, kept per wheel for the tyre squeal.
   * @param {number} [c.dt]
   */
  applyControls({ driveForce, brake, steer, mudAt, puddleAt, iceAt, iceGrip = 0.14, bogAt, feelAt, tarmacAt, wet = 0, dt = 1 / 60 }) {
    const p = this.params;
    const v = this.vehicle;
    // Grip under each wheel, from where it touched down last step.
    for (let i = 0; i < this.wheels.length; i++) {
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
      w.ice = w.contact && iceAt ? iceAt(w.point.x, w.point.z) : 0;
      w.puddle *= 1 - w.ice; // a quad on ice is not in the water
      w.load = w.contact ? (v.wheelSuspensionForce(i) ?? 0) : 0;
      w.tarmac = w.contact && tarmacAt ? tarmacAt(w.point.x, w.point.z) : 0;
      const firm = w.contact && feelAt ? feelAt(w.point.x, w.point.z).grip : 1;
      w.grip = surfaceGrip(p, w.mud, w.puddle, firm) * (w.contact && bogAt ? bogGrip(bogAt(w.point.x, w.point.z)) : 1);
      if (w.ice > 0) w.grip += (iceGrip - w.grip) * w.ice; // glass
      // Wet ground is slipperier, and wet mud more so.
      w.grip *= 1 - wet * (0.15 + 0.15 * w.mud);
      // This wheel's tyre: its pressure, brand and tread (tyres.js).
      if (this.tyres) w.grip *= this.tyres.grip(i, w.mud, w.puddle);
      if (this.strengthGrip) w.grip *= 1 + this.strengthGrip.mud * w.mud + this.strengthGrip.tarmac * w.tarmac; // its hidden strength (strength.js)
      // Puddles are mud too, as far as the engine's concerned.
      this.wheelMud[i] = Math.max(w.mud, w.puddle);
      w.driven = this.wheels[i].driven !== false && (!this.wheels[i].front || (this.frontDriven ?? isDriven(p, true)));
    }
    const t = this.traction.update(dt, driveForce, this.wheelInfo, p);
    if (Math.abs(driveForce) > 1) this.driveSign = Math.sign(driveForce);
    for (let i = 0; i < this.wheels.length; i++) {
      v.setWheelEngineForce(i, t.forces[i]);
      v.setWheelBrake(i, brake);
      v.setWheelSteering(i, this.wheels[i].front ? steer : 0);
      v.setWheelFrictionSlip(i, t.grips[i] * (this.wheels[i].gripScale ?? 1) * (this.gripMul?.[i] ?? 1));
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
    this.wheelInfo.forEach((w, i) => {
      if (w.driven) w.spinAngle = (w.spinAngle + (spin * this.params.wheelRadius) / this.wheelRadius(i)) % (Math.PI * 2);
    });
    // The raycast wheels' brakes can't quite hold it on a slope: it creeps a metre
    // or so a minute. Parked and all but still, its sideways and along-the-ground
    // drift is cancelled; it can still settle and bounce up and down.
    if (this.parked) {
      const v = this.body.linvel();
      if (Math.hypot(v.x, v.z) < this.params.parkedHoldSpeed) this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      // And it doesn't slowly turn on the spot either (a heavy one on a slope, wheels locked, would swing round a few degrees a minute).
      const w = this.body.angvel();
      if (Math.abs(w.y) < PARKED_YAW_HOLD && Math.hypot(v.x, v.z) < this.params.parkedHoldSpeed) this.body.setAngvel({ x: w.x, y: 0, z: w.z }, true);
    }
  }

  /** Shoves it along its own length towards `target` m/s (negative is backwards), the way someone pushing it on foot would. */
  pushAlong(target, dt) {
    const q = this.body.rotation();
    // Its forward axis (+z) in the world, flattened onto the ground.
    const fx = 2 * (q.x * q.z + q.w * q.y);
    const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    const n = Math.hypot(fx, fz) || 1;
    const v = this.body.linvel();
    const gap = target - (v.x * fx + v.z * fz) / n;
    const k = Math.min(1, 6 * dt);
    this.body.setLinvel({ x: v.x + (fx / n) * gap * k, y: v.y, z: v.z + (fz / n) * gap * k }, true);
  }

  /** How hard each wheel is pressed into the ground (N), how muddy it is there, and whether it's touching. */
  wheelLoads() {
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheelLoadState[i];
      w.contact = this.vehicle.wheelIsInContact(i);
      w.force = w.contact ? (this.vehicle.wheelSuspensionForce(i) ?? 0) : 0;
      w.mud = this.wheelMud[i];
    }
    return this.wheelLoadState;
  }

  /** True while none of the wheels is on the ground (off a ramp, over a crest). */
  get airborne() {
    for (let i = 0; i < this.wheels.length; i++) if (this.vehicle.wheelIsInContact(i)) return false;
    return true;
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

  /** The riders' weight leaning it further over on a slope: `load` kg m (vehicle/topple.js), applied for one step of `dt`. */
  topple(load, dt) {
    const r = this.body.rotation();
    // The chassis's up vector: the quaternion applied to (0, 1, 0).
    const up = { x: 2 * (r.x * r.y - r.w * r.z), y: 1 - 2 * (r.x * r.x + r.z * r.z), z: 2 * (r.y * r.z + r.w * r.x) };
    const t = toppleTorque(up, load);
    this.body.applyTorqueImpulse({ x: t.x * dt, y: 0, z: t.z * dt }, true);
  }

  /** How far over it is leaning, radians, positive to the left, and how fast it is going over (a two-wheeler's balance, bikeLean.js). */
  lean() {
    const r = this.body.rotation();
    // The chassis's left (+x) axis and forward (+z) axis in the world.
    const left = { x: 1 - 2 * (r.y * r.y + r.z * r.z), y: 2 * (r.x * r.y + r.w * r.z), z: 2 * (r.x * r.z - r.w * r.y) };
    const fwd = { x: 2 * (r.x * r.z + r.w * r.y), y: 2 * (r.y * r.z - r.w * r.x), z: 1 - 2 * (r.x * r.x + r.y * r.y) };
    const w = this.body.angvel();
    // World up seen from the chassis points to its right when it leans left, so the lean is minus the up-axis's left component.
    return { lean: -Math.asin(Math.max(-1, Math.min(1, left.y))), rate: -(w.x * fwd.x + w.y * fwd.y + w.z * fwd.z), fwd };
  }

  /** Rolls the chassis about its own forward axis: `torque` N m, positive leaning it left, for one step of `dt`. */
  rollTorque(torque, dt) {
    const { fwd } = this.lean();
    const t = -torque * dt; // leaning left is a turn the other way about +z
    this.body.applyTorqueImpulse({ x: fwd.x * t, y: fwd.y * t, z: fwd.z * t }, true);
  }

  /** Puts the bike back on its wheels at a spot, e.g. after a rollover. */
  /** Holds the body at a pose, still, every step (a quad strapped on a trailer, or on its ramps). */
  pin(pos, quat) {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  reset(x, y, z, yaw) {
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation(yawQuat(yaw), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
}

const PARKED_YAW_HOLD = 0.6; // rad/s: a parked quad turning slower than this is stopped

function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}
