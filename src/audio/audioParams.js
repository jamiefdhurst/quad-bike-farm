// Sound tuning. Ranges are [min, max, step].

// Shared by everything: one per game.
export const DEFAULT_SOUND_PARAMS = {
  masterVolume: 0.8,
  muted: false,
  latency: 0.05, // seconds between the simulation and the sound, so pulses can be placed exactly
  ambientVolume: 0.05,
};

export const SOUND_PARAM_RANGES = {
  masterVolume: [0, 2, 0.01],
  latency: [0.02, 0.2, 0.005],
  ambientVolume: [0, 0.5, 0.005],
};

// One per engine. Sent to its AudioWorklet (engineWorklet.js) each frame.
export const DEFAULT_AUDIO_PARAMS = {
  engineSound: 'recorded', // 'recorded' (real recorded pulses) or 'synth' (fully synthesised)

  // Recorded engine
  recIdleSource: 'quad', // which recording idle pulses come from: 'quad' (the main quad) or 'rev' (the rev-sweep machine)
  recVolume: 0.6,
  recThrottleLoudness: 0.15, // extra loudness with the throttle open (the rev recording is already louder up the range)
  recBlendLo: 1500, // rpm where the rev recording starts to blend in over the idle recording
  recBlendHi: 2100, // rpm where it has fully taken over
  recToneClosed: 6000, // Hz low-pass with the throttle shut
  recToneOpen: 16000, // Hz low-pass at full throttle
  recMisfireAttack: 0.25, // a misfire's missing bang: level of the opening thump
  recMisfireBody: 0.7, // and of the rest of its cycle, so the engine never goes silent
  recOverlap: 0.05, // each pulse runs this much longer than its cycle, so a late next pulse overlaps rather than leaving a gap
  recStarterVolume: 0.9,
  recShutdownVolume: 0.9,

  // Everything below is the synthesised engine

  // Combustion pulses
  exhaustVolume: 0.9,
  pulseBase: 0.45, // pulse pressure at closed throttle
  throttlePressure: 0.7, // extra pressure at full throttle
  blowdownMs: 2.6, // sharpness of the bang as the exhaust valve opens
  turbulence: 0.35, // hiss in each pulse
  turbulenceThrottle: 1.5, // extra rasp at full throttle
  combustionJitter: 0.18, // random pulse-to-pulse strength variation, always present
  densityRefRpm: 1200, // pulses at or below this rpm play at full strength
  densityComp: 0.55, // how much each pulse is scaled down as revs rise (0 = not at all)

  // Exhaust pipe (resonates at odd multiples of 343 / (4 x length) Hz)
  pipeLength: 1.15, // metres
  pipeReflection: 0.72, // how much bounces back from the open end
  pipeDamping: 0.45, // 0..1, higher keeps more top end in the reflections

  // Silencer
  mufflerDirect: 0.55,
  mufflerFreqA: 165, // Hz, the body's boom
  mufflerQA: 2.2,
  mufflerGainA: 1.4,
  mufflerFreqB: 480,
  mufflerQB: 3,
  mufflerGainB: 0.6,
  toneBase: 700, // Hz low-pass at idle
  toneRpm: 0.25, // extra Hz per rpm
  toneThrottle: 2200, // extra Hz at full throttle

  // Overrun pops on a closed throttle
  popChance: 0.12,
  popMinRpm: 2800,
  popVolume: 0.5,

  // Mechanical
  mechVolume: 0.012, // valvetrain and piston clatter
  intakeVolume: 0.12,
  intakeFreq: 420,
  valveTickVolume: 0.05,
  gearWhineVolume: 0.006,
  gearTeeth: 23,

  // Starter motor
  starterVolume: 0.5,
  starterRatio: 18, // motor turns per crank turn
  commutatorSegments: 8,
  starterGearTeeth: 48, // ring gear teeth, sets the mesh rattle rate
  starterBrush: 0.2,
  starterMesh: 0.25,
  starterDip: 0.45, // extra audible slowdown on each compression stroke
  solenoidVolume: 0.5,

  coughVolume: 0.9,
  drive: 1.8, // final soft clipping

  // Positional
  refDistance: 2.5,
  rolloff: 1.1,
};

export const AUDIO_PARAM_RANGES = {
  engineSound: ['recorded', 'synth'],
  recIdleSource: ['quad', 'rev'],
  recVolume: [0, 3, 0.01],
  recThrottleLoudness: [0, 3, 0.01],
  recBlendLo: [500, 5000, 10],
  recBlendHi: [600, 6000, 10],
  recToneClosed: [500, 20000, 50],
  recToneOpen: [500, 20000, 50],
  recMisfireAttack: [0, 1, 0.01],
  recMisfireBody: [0, 1.5, 0.01],
  recOverlap: [0, 0.3, 0.005],
  recStarterVolume: [0, 3, 0.01],
  recShutdownVolume: [0, 3, 0.01],
  exhaustVolume: [0, 3, 0.01],
  pulseBase: [0, 2, 0.01],
  throttlePressure: [0, 3, 0.01],
  blowdownMs: [0.2, 8, 0.05],
  turbulence: [0, 2, 0.01],
  turbulenceThrottle: [0, 5, 0.05],
  combustionJitter: [0, 1, 0.01],
  densityRefRpm: [300, 4000, 10],
  densityComp: [0, 1.5, 0.01],
  pipeLength: [0.3, 3, 0.01],
  pipeReflection: [0, 0.95, 0.01],
  pipeDamping: [0.05, 1, 0.01],
  mufflerDirect: [0, 2, 0.01],
  mufflerFreqA: [40, 600, 1],
  mufflerQA: [0.3, 10, 0.1],
  mufflerGainA: [0, 4, 0.01],
  mufflerFreqB: [100, 3000, 5],
  mufflerQB: [0.3, 10, 0.1],
  mufflerGainB: [0, 4, 0.01],
  toneBase: [100, 6000, 10],
  toneRpm: [0, 2, 0.01],
  toneThrottle: [0, 10000, 50],
  popChance: [0, 1, 0.01],
  popMinRpm: [1000, 8000, 50],
  popVolume: [0, 2, 0.01],
  mechVolume: [0, 0.2, 0.001],
  intakeVolume: [0, 1, 0.005],
  intakeFreq: [100, 2000, 10],
  valveTickVolume: [0, 0.5, 0.005],
  gearWhineVolume: [0, 0.1, 0.001],
  gearTeeth: [5, 60, 1],
  starterVolume: [0, 2, 0.01],
  starterRatio: [4, 30, 0.5],
  commutatorSegments: [2, 24, 1],
  starterGearTeeth: [10, 120, 1],
  starterBrush: [0, 2, 0.01],
  starterMesh: [0, 2, 0.01],
  starterDip: [0, 1, 0.01],
  solenoidVolume: [0, 2, 0.01],
  coughVolume: [0, 2, 0.01],
  drive: [0.5, 6, 0.05],
  refDistance: [0.5, 20, 0.1],
  rolloff: [0, 4, 0.05],
};
