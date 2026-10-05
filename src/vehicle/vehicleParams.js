// Chassis, suspension, tyres and drivetrain. Ranges are [min, max, step].

export const DEFAULT_VEHICLE_PARAMS = {
  // Chassis
  mass: 300, // kg, bike plus rider
  centreOfMassY: -0.08, // metres relative to the chassis origin; lower is more stable
  rollInertia: 55, // kg m^2 around the forward axis
  pitchInertia: 95,
  yawInertia: 115,
  linearDamping: 0.05,
  angularDamping: 0.6,

  // Suspension and wheels
  wheelRadius: 0.3,
  suspensionRestLength: 0.24,
  suspensionStiffness: 28,
  suspensionCompression: 2.6,
  suspensionRelaxation: 2.2,
  maxSuspensionTravel: 0.2,
  maxSuspensionForce: 30000,
  grassFrictionSlip: 2.2,
  mudFrictionSlip: 1.25,
  sideFrictionStiffness: 0.9,

  // Steering
  maxSteerDeg: 32,
  steerRate: 3.5, // 1/s, how fast the bars follow input
  steerSpeedReduction: 0.06, // less lock at speed: max / (1 + k * speed)

  // Drivetrain: automatic with a centrifugal clutch and CVT
  maxDriveForce: 2000, // newtons at the wheels, full throttle, peak torque
  maxSpeed: 17, // m/s forwards (about 38 mph)
  maxReverseSpeed: 4, // m/s
  reverseThrottle: 0.5, // fraction of throttle available in reverse
  reverseDelay: 0.35, // seconds holding S at a stop before it reverses
  clutchEngageRpm: 1900, // clutch starts to bite
  clutchFullRpm: 3400, // clutch fully locked
  couplingRpm: 2600, // above this with the bike moving, the drivetrain drags on the engine
  coupledReleaseSpeed: 0.4, // m/s, drivetrain decouples below this
  idleTorque: 0.15, // fraction of torque at closed throttle (cold idle creep)
  powerbandRpm: 0, // 0 for a flat torque curve; otherwise power comes on hard around these revs (two-strokes)
  torqueBelowBand: 0.45, // fraction of torque below the power band
  drivePowerFloor: 0.4, // drive force keeps this much even when the engine is weak, so a cold bike is sluggish rather than useless
  engineBrakeForce: 300, // newtons at closed throttle with the clutch locked
  brakeLoadSpeed: 0.8, // m/s; braking load on the engine fades out below this as the bike stops

  // Brakes
  maxBrake: 13, // Rapier wheel brake impulse
  parkingBrake: 6,
  rollingResistance: 0.4, // brake impulse always applied, so it coasts to a stop

  // Nobody on it: jump off at speed and it carries on, holding speed and steering
  cruiseGain: 0.35, // throttle per m/s below the speed it had when you got off
  cruiseIntegral: 0.3, // throttle per m/s per second, to settle on that speed
  ghostStuckSpeed: 0.3, // fraction of that speed; below this it's stuck against something...
  ghostStuckTime: 3, // ...and after this many seconds stuck it lets go of the throttle
};

export const VEHICLE_PARAM_RANGES = {
  mass: [100, 800, 5],
  centreOfMassY: [-0.4, 0.4, 0.01],
  rollInertia: [10, 300, 1],
  pitchInertia: [10, 300, 1],
  yawInertia: [10, 300, 1],
  linearDamping: [0, 1, 0.01],
  angularDamping: [0, 5, 0.05],
  wheelRadius: [0.2, 0.45, 0.01],
  suspensionRestLength: [0.05, 0.5, 0.01],
  suspensionStiffness: [5, 100, 0.5],
  suspensionCompression: [0.1, 10, 0.05],
  suspensionRelaxation: [0.1, 10, 0.05],
  maxSuspensionTravel: [0.02, 0.5, 0.01],
  maxSuspensionForce: [1000, 100000, 500],
  grassFrictionSlip: [0.2, 10, 0.05],
  mudFrictionSlip: [0.2, 10, 0.05],
  sideFrictionStiffness: [0.1, 3, 0.05],
  maxSteerDeg: [5, 50, 0.5],
  steerRate: [0.5, 20, 0.1],
  steerSpeedReduction: [0, 0.5, 0.005],
  maxDriveForce: [200, 8000, 50],
  maxSpeed: [3, 40, 0.5],
  maxReverseSpeed: [1, 10, 0.1],
  reverseThrottle: [0.1, 1, 0.05],
  reverseDelay: [0, 2, 0.05],
  clutchEngageRpm: [800, 5000, 50],
  clutchFullRpm: [1000, 7000, 50],
  couplingRpm: [800, 6000, 50],
  coupledReleaseSpeed: [0, 3, 0.05],
  idleTorque: [0, 1, 0.01],
  powerbandRpm: [0, 10000, 50],
  torqueBelowBand: [0, 1, 0.01],
  drivePowerFloor: [0, 1, 0.01],
  engineBrakeForce: [0, 2000, 10],
  brakeLoadSpeed: [0.5, 10, 0.1],
  maxBrake: [0, 100, 0.5],
  parkingBrake: [0, 50, 0.5],
  rollingResistance: [0, 3, 0.05],
  cruiseGain: [0, 2, 0.01],
  cruiseIntegral: [0, 1, 0.01],
  ghostStuckSpeed: [0, 1, 0.05],
  ghostStuckTime: [0.5, 15, 0.5],
};
