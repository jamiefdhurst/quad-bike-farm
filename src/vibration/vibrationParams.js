// Vibration tuning. Gains are per firing pulse at full strength; the damped
// oscillators turn those kicks into motion. Ranges are [min, max, step].

export const DEFAULT_VIBRATION_PARAMS = {
  // How hard each firing pulse kicks, and how that changes with rpm.
  pulseGain: 1.6, // master gain
  idleRpm: 1700, // full shake at and below this
  smoothRpmRange: 1400, // shake falls away over this many rpm above idle
  highRpmFloor: 0.1, // fraction of the body shake left at high rpm
  barsHighRpmFloor: 0.35, // the bars keep more of a buzz at high rpm
  roughnessGain: 3.0, // extra kick at full roughness
  compressionScale: 0.55, // kicks from compression strokes when cranking or coasting to a stop
  sputterScale: 0.8,
  misfireScale: 0.3, // a misfire is a missing beat, so only a small jolt
  directionJitter: 0.6, // how much each kick's direction varies (0 = always the same)

  // Sprung body on its suspension.
  heaveFreq: 9, // Hz
  heaveDamping: 0.22, // damping ratio
  heaveGain: 0.2, // m/s velocity kick per pulse
  pitchFreq: 7,
  pitchDamping: 0.2,
  pitchGain: 0.4, // rad/s
  rollFreq: 8,
  rollDamping: 0.2,
  rollGain: 0.2,

  // Handlebars on rubber mounts.
  barsFreq: 17,
  barsDamping: 0.14,
  barsGain: 0.18, // m/s
  barsRotGain: 1.0, // rad/s

  // Rider's head, on top of the body motion it already inherits.
  cameraFreq: 5,
  cameraDamping: 0.3,
  cameraGain: 0.06, // m/s
  cameraRotGain: 0.12, // rad/s
};

export const VIBRATION_PARAM_RANGES = {
  pulseGain: [0, 4, 0.05],
  idleRpm: [500, 4000, 50],
  smoothRpmRange: [100, 6000, 50],
  highRpmFloor: [0, 1, 0.01],
  barsHighRpmFloor: [0, 1, 0.01],
  roughnessGain: [0, 5, 0.05],
  compressionScale: [0, 2, 0.05],
  sputterScale: [0, 2, 0.05],
  misfireScale: [0, 2, 0.05],
  directionJitter: [0, 1, 0.01],
  heaveFreq: [1, 30, 0.5],
  heaveDamping: [0.02, 1, 0.01],
  heaveGain: [0, 0.3, 0.005],
  pitchFreq: [1, 30, 0.5],
  pitchDamping: [0.02, 1, 0.01],
  pitchGain: [0, 0.5, 0.005],
  rollFreq: [1, 30, 0.5],
  rollDamping: [0.02, 1, 0.01],
  rollGain: [0, 0.5, 0.005],
  barsFreq: [2, 60, 0.5],
  barsDamping: [0.02, 1, 0.01],
  barsGain: [0, 0.4, 0.005],
  barsRotGain: [0, 2, 0.01],
  cameraFreq: [1, 20, 0.5],
  cameraDamping: [0.02, 1, 0.01],
  cameraGain: [0, 0.3, 0.005],
  cameraRotGain: [0, 0.5, 0.005],
};
