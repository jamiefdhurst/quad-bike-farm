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
  riderTopple: 90, // kg m: the rider's weight up on the seat, toppling it on a slope (vehicle/topple.js); 0 where the chassis already has it
  backTopple: 0.8, // someone on the back adds this much of the rider's toppling again

  // Suspension and wheels
  wheelRadius: 0.3,
  suspensionRestLength: 0.24,
  suspensionStiffness: 28,
  suspensionCompression: 2.6,
  suspensionRelaxation: 2.2,
  maxSuspensionTravel: 0.2,
  maxSuspensionForce: 30000,
  grassFrictionSlip: 2.2,
  mudFrictionSlip: 0.7, // the wet track
  puddleFrictionSlip: 0.42,
  sideFrictionStiffness: 0.9,

  // Traction and wheelspin, see traction.js
  fourWheelDrive: 1, // 1 drives all four wheels, 0 the rear axle only
  driveGrip: 1.3, // drive force the tyres can take, as a multiple of grip times load
  spinRange: 0.6, // asking this much more than the grip (0.6 = 60%) spins them flat out
  spinRiseRate: 12, // 1/s
  spinFallRate: 5, // 1/s
  spinDriveLoss: 0.2, // fraction of the drive lost with the wheels spinning flat out
  spinSideLoss: 0.15, // fraction of sideways grip lost by spinning wheels
  spinSlipSpeed: 8, // m/s the tyres turn faster than the ground at full spin and throttle

  // Steering
  maxSteerDeg: 32,
  steerRate: 3.5, // 1/s, how fast the bars follow input
  steerSpeedReduction: 0.06, // less lock at speed: max / (1 + k * speed)
  rackSteerLoss: 0.08, // fraction of steering lock lost with a girl sat on the front rack

  // Drivetrain: automatic with a centrifugal clutch and CVT
  maxDriveForce: 2000, // newtons at the wheels, full throttle, peak torque
  maxSpeed: 17, // m/s forwards (about 38 mph)
  maxReverseSpeed: 4, // m/s
  reverseThrottle: 0.5, // fraction of throttle available in reverse
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
  overrunBrake: 0.5, // fraction of engineBrakeForce that carries on once the revs drop, while it's coupled to a rolling bike

  // Load on the engine (see engineLoad.js)
  cvtShiftSpeed: 3, // m/s; below this the CVT is in its lowest ratio and pulling away loads the engine fully
  launchLoad: 1, // share of the effort spent getting the bike moving that the engine feels when pulling away...
  cruiseAccelLoad: 0.15, // ...and once the CVT is shifting up (climbing, mud and obstacles always count in full)
  mudLoad: 0.12, // extra load from churning through mud, at full mud
  // The engine load takes wheelspin from the physics (traction.js); these two are its fallback without it.
  tyreGrip: 0.75, // drive force each tyre can put down per newton pressing it into grass...
  mudGrip: 0.42, // ...and in mud; asking for more spins it and the revs flare
  loadSmoothing: 0.08, // seconds; smoothing on the drive force and the acceleration it makes
  overrunRpmPerMs: 70, // throttle shut and coupled, the wheels hold the engine this many rpm over idle per m/s...
  overrunMaxRpm: 1400, // ...up to this

  // Brakes
  maxBrake: 13, // Rapier wheel brake impulse
  parkingBrake: 6,
  parkedHoldSpeed: 0.15, // m/s; parked and slower than this, it's held still so it doesn't creep down slopes
  rollingResistance: 0.4, // brake impulse always applied, so it coasts to a stop

  // Nobody on it: jump off at speed and it carries on, holding speed and steering
  cruiseGain: 0.35, // throttle per m/s below the speed it had when you got off
  cruiseIntegral: 0.3, // throttle per m/s per second, to settle on that speed
  ghostStuckSpeed: 0.3, // fraction of that speed; below this it's stuck against something...
  revHoldMin: 0.15, // least throttle you had open, getting off a quad stood still, for it to stay revving on its own
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
  riderTopple: [0, 300, 5],
  backTopple: [0, 2, 0.05],
  wheelRadius: [0.2, 0.45, 0.01],
  suspensionRestLength: [0.05, 0.5, 0.01],
  suspensionStiffness: [5, 100, 0.5],
  suspensionCompression: [0.1, 10, 0.05],
  suspensionRelaxation: [0.1, 10, 0.05],
  maxSuspensionTravel: [0.02, 0.5, 0.01],
  maxSuspensionForce: [1000, 100000, 500],
  grassFrictionSlip: [0.2, 10, 0.05],
  mudFrictionSlip: [0.2, 10, 0.05],
  puddleFrictionSlip: [0.1, 10, 0.02],
  fourWheelDrive: [0, 1, 1],
  driveGrip: [0.2, 4, 0.05],
  spinRange: [0.05, 3, 0.05],
  spinRiseRate: [0.5, 40, 0.5],
  spinFallRate: [0.5, 40, 0.5],
  spinDriveLoss: [0, 0.9, 0.01],
  spinSideLoss: [0, 0.9, 0.01],
  spinSlipSpeed: [0, 20, 0.5],
  sideFrictionStiffness: [0.1, 3, 0.05],
  maxSteerDeg: [5, 50, 0.5],
  steerRate: [0.5, 20, 0.1],
  steerSpeedReduction: [0, 0.5, 0.005],
  rackSteerLoss: [0, 0.5, 0.01],
  maxDriveForce: [200, 8000, 50],
  maxSpeed: [3, 40, 0.5],
  maxReverseSpeed: [1, 10, 0.1],
  reverseThrottle: [0.1, 1, 0.05],
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
  overrunBrake: [0, 1, 0.01],
  cvtShiftSpeed: [0.5, 10, 0.1],
  launchLoad: [0, 1.5, 0.01],
  cruiseAccelLoad: [0, 1, 0.01],
  mudLoad: [0, 1, 0.01],
  tyreGrip: [0.1, 2, 0.01],
  mudGrip: [0.1, 2, 0.01],
  loadSmoothing: [0.02, 1, 0.01],
  overrunRpmPerMs: [0, 300, 5],
  overrunMaxRpm: [0, 4000, 50],
  maxBrake: [0, 100, 0.5],
  parkingBrake: [0, 50, 0.5],
  parkedHoldSpeed: [0, 1, 0.01],
  rollingResistance: [0, 3, 0.05],
  cruiseGain: [0, 2, 0.01],
  cruiseIntegral: [0, 1, 0.01],
  ghostStuckSpeed: [0, 1, 0.05],
  revHoldMin: [0, 1, 0.05],
  ghostStuckTime: [0.5, 15, 0.5],
};
