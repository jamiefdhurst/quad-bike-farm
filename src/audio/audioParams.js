export const DEFAULT_AUDIO_PARAMS = {
  masterVolume: 0.8,
  muted: false,
  latency: 0.04, // seconds between the simulation and the sound, to schedule pulses evenly

  // Exhaust pulses
  pulseVolume: 0.55,
  pitchBase: 0.75, // playback rate of the thump sample at 0 rpm
  pitchRpmScale: 0.11, // extra playback rate per 1000 rpm
  pitchJitter: 0.35, // pitch variation per pulse at full roughness
  volumeJitter: 0.5, // loudness variation per pulse at full roughness
  decayFraction: 0.18, // decay time constant of each thump, as a fraction of one engine cycle
  maxDecay: 0.06, // seconds, cap on the ring at low rpm
  throttleLoudness: 0.6, // extra loudness with the throttle open
  drive: 2.2, // soft clipping, adds grit
  filterBase: 500, // Hz, exhaust low-pass at idle
  filterRpm: 0.35, // Hz per rpm
  filterThrottle: 1800, // Hz added at full throttle

  // Mechanical and intake noise
  mechVolume: 0.06,
  intakeVolume: 0.08,

  // Starter motor
  starterVolume: 0.22,
  starterBaseHz: 150,
  starterRpmHz: 0.55, // whine Hz per crank rpm

  coughVolume: 0.9,
  ambientVolume: 0.05,

  // Positional
  refDistance: 2.5,
  rolloff: 1.1,
};

export const AUDIO_PARAM_RANGES = {
  masterVolume: [0, 2, 0.01],
  latency: [0.01, 0.2, 0.005],
  pulseVolume: [0, 2, 0.01],
  pitchBase: [0.2, 2, 0.01],
  pitchRpmScale: [0, 0.5, 0.005],
  pitchJitter: [0, 1, 0.01],
  volumeJitter: [0, 1, 0.01],
  decayFraction: [0.03, 0.6, 0.01],
  maxDecay: [0.01, 0.2, 0.005],
  throttleLoudness: [0, 2, 0.01],
  drive: [0.5, 8, 0.1],
  filterBase: [100, 3000, 10],
  filterRpm: [0, 1.5, 0.01],
  filterThrottle: [0, 6000, 50],
  mechVolume: [0, 0.5, 0.005],
  intakeVolume: [0, 0.5, 0.005],
  starterVolume: [0, 1, 0.01],
  starterBaseHz: [40, 600, 5],
  starterRpmHz: [0, 3, 0.05],
  coughVolume: [0, 2, 0.01],
  ambientVolume: [0, 0.5, 0.005],
  refDistance: [0.5, 20, 0.1],
  rolloff: [0, 4, 0.05],
};
