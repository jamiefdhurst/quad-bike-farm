// Rapier side of the quad: a dynamic chassis and a ray-cast vehicle controller.
// No rendering here; quad.js mirrors this into the scene.

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
  constructor(physics, RAPIER, params, spawn) {
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
      RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(0, c.y, 0).setFriction(0.6),
      this.body,
    );

    this.vehicle = physics.createVehicleController(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    for (const w of WHEELS) {
      this.vehicle.addWheel(
        { x: w.x, y: SUSPENSION_TOP_Y, z: w.z },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        params.suspensionRestLength,
        params.wheelRadius,
      );
    }
    this.applyParams();
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
   * @param {(x:number, z:number) => number} [c.mudAt]  Surface lookup for per-wheel grip.
   */
  applyControls({ driveForce, brake, steer, mudAt }) {
    const p = this.params;
    for (let i = 0; i < WHEELS.length; i++) {
      this.vehicle.setWheelEngineForce(i, driveForce / 4);
      this.vehicle.setWheelBrake(i, brake);
      this.vehicle.setWheelSteering(i, WHEELS[i].front ? steer : 0);
      if (mudAt) {
        const contact = this.vehicle.wheelIsInContact(i) ? this.vehicle.wheelContactPoint(i) : null;
        const mud = contact ? mudAt(contact.x, contact.z) : 0;
        this.vehicle.setWheelFrictionSlip(i, p.grassFrictionSlip + (p.mudFrictionSlip - p.grassFrictionSlip) * mud);
      }
    }
  }

  /** Must run every fixed step before the physics world steps. */
  update(dt) {
    this.vehicle.updateVehicle(dt);
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
      rotation: this.vehicle.wheelRotation(i) ?? 0,
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
