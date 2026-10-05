// Her body language riding pillion (pillionPose.js, pillionDynamics.js).
export const DEFAULT_PILLION_PARAMS = {
  // Leaning with the quad
  leanPerAccel: 0.03, // radians of lean into a corner per m/s^2 of sideways acceleration
  leanMax: 0.3, // radians
  tuckPerAccel: 0.012, // radians forward per m/s^2 of acceleration
  brakePerAccel: 0.035, // radians forward per m/s^2 of braking
  pitchMax: 0.35, // radians
  bodyFreq: 1.6, // Hz, how quickly her upper body follows
  bodyDamping: 0.55, // below 1 she overshoots a little and settles
  accelSmoothing: 0.12, // seconds
  // Bumps
  bounce: 0.45, // how much of the seat's vertical jolting reaches her
  bounceFreq: 2.4, // Hz
  bounceDamping: 0.35,
  bounceMax: 0.05, // metres
  bounceSlump: 1.5, // radians forward per metre she's squashed down

  // Holding on
  hugLean: 0.26, // radians forward while her arms are round you
  hugSlide: 0.05, // metres she shuffles forward on the seat, up against your back
  hugAhead: 0.42, // metres ahead of the pillion seat her hands meet
  hugHeight: 0.13, // metres above it
  hugGap: 0.06, // metres either side of the middle for each hand
  gripBlendTime: 0.5, // seconds to move her hands between holds

  // Looking about while riding behind you
  glanceEveryMin: 2.5, // seconds
  glanceEveryMax: 7,
  glanceHoldMin: 1.2,
  glanceHoldMax: 3,
  headSpeed: 4, // 1/s
};

export const PILLION_PARAM_RANGES = {
  leanPerAccel: [0, 0.1, 0.002],
  leanMax: [0, 0.8, 0.01],
  tuckPerAccel: [0, 0.08, 0.002],
  brakePerAccel: [0, 0.1, 0.002],
  pitchMax: [0, 0.8, 0.01],
  bodyFreq: [0.3, 5, 0.05],
  bodyDamping: [0.1, 2, 0.05],
  accelSmoothing: [0.01, 0.5, 0.01],
  bounce: [0, 1.5, 0.01],
  bounceFreq: [0.5, 6, 0.1],
  bounceDamping: [0.05, 2, 0.05],
  bounceMax: [0, 0.15, 0.005],
  bounceSlump: [0, 5, 0.1],
  hugLean: [0, 0.7, 0.01],
  hugSlide: [0, 0.15, 0.005],
  hugAhead: [0.2, 0.7, 0.005],
  hugHeight: [-0.1, 0.4, 0.005],
  hugGap: [0, 0.2, 0.005],
  gripBlendTime: [0.05, 2, 0.05],
  glanceEveryMin: [0.5, 20, 0.5],
  glanceEveryMax: [0.5, 40, 0.5],
  glanceHoldMin: [0.2, 10, 0.1],
  glanceHoldMax: [0.2, 15, 0.1],
  headSpeed: [0.5, 15, 0.1],
};
