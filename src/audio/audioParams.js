// Sound tuning. Ranges are [min, max, step].

// Shared by everything: one per game.
export const DEFAULT_SOUND_PARAMS = {
  masterVolume: 0.8,
  muted: false,
  latency: 0.05, // seconds between the simulation and the sound, so pulses can be placed exactly
  ambientVolume: 0.05,
  pourVolume: 0.12,
  hoseVolume: 0.1,
  rainVolume: 0.09,

  // How each quad's sound reaches you (propagation.js)
  doppler: true, // passing quads rise and fall in pitch
  dopplerAmount: 1, // 1 is real; more exaggerates it
  speedOfSound: 343, // m/s
  dopplerMaxSpeed: 40, // m/s; distance changes faster than this (getting on and off) are smoothed out
  dopplerSmoothing: 0.08, // seconds
  airAbsorptionDistance: 40, // metres at which the air has halved the treble cutoff (20 kHz close by)

  // Ride sounds besides the engine (rideAudio.js), all per quad and positioned at it
  rideVolume: 1, // all of them together
  rideFullSpeed: 12, // m/s at which the tyre sounds reach their set levels
  rollVolume: 0.35, // low rumble of the tyres on any surface
  tyreSquealVolume: 0.5, // tyres squealing on the tarmac, sliding or braking hard
  grassVolume: 0.05, // grass swishing past
  dirtVolume: 0.5, // grit and crunch on the track and the yard
  mudVolume: 0.7, // squelches round the puddles
  waterVolume: 0.08, // water churning round the wheels in a puddle
  splashVolume: 0.9, // hitting a puddle
  beltBingVolume: 0.16, // the UTV's seat belt reminder, a soft bong
  indicatorVolume: 0.05, // the indicator relay's tick and tock
  useVolume: 0.35, // the small sounds of picking up, putting down, switching and opening boards
  knockVolume: 0.5, // suspension knocking over a bump or a wheel touching down
  bumpVolume: 0.18, // small knocks from uneven ground
  gridVolume: 1.2, // the cattle grid's rumble and bar knocks, over the road's own rumble
  landVolume: 0.4, // coming down after a jump
  rattleVolume: 0.06, // racks and bodywork rattling
  rattleThreshold: 0.3, // knocks harder than this rattle the racks
  rattleChance: 0.5, // chance a full-size bump rattles them
  rideWindVolume: 0.3, // wind past the rider's ears at rideWindFullSpeed (only on the quad you ride)
  rideWindFullSpeed: 15, // m/s
  hornVolume: 1, // every horn, on top of its own level (npc/horns.js says how loud each is)

  // When the suspension makes a sound (rideEvents.js)
  knockThreshold: 0.5, // m/s of suspension compression before it knocks
  knockFullSpeed: 2, // m/s more than that for a full knock
  knockCooldown: 0.12, // seconds before the same wheel can knock again
  touchdownMinAir: 0.06, // seconds a wheel must be off the ground for its touchdown to knock
  landMinAir: 0.25, // seconds with all four wheels off the ground for a landing
  landFullSpeed: 4, // m/s falling for a full landing thud
  landQuiet: 0.3, // seconds after a landing before the suspension knocks again
  bumpsPerMetreGrass: 0.15, // small knocks from uneven ground while ridden
  bumpsPerMetreTrack: 0.4,
  bumpFullSpeed: 10, // m/s for full-size small knocks
  splashMinSpeed: 1.2, // m/s into a puddle for a splash
  splashFullSpeed: 8,
};

export const SOUND_PARAM_RANGES = {
  pourVolume: [0, 1, 0.01],
  hoseVolume: [0, 1, 0.01],
  rainVolume: [0, 1, 0.01],
  masterVolume: [0, 2, 0.01],
  latency: [0.02, 0.2, 0.005],
  ambientVolume: [0, 0.5, 0.005],
  dopplerAmount: [0, 5, 0.05],
  speedOfSound: [50, 1000, 1],
  dopplerMaxSpeed: [5, 150, 1],
  dopplerSmoothing: [0.01, 0.5, 0.005],
  airAbsorptionDistance: [0, 300, 1],
  rideVolume: [0, 3, 0.01],
  rideFullSpeed: [2, 30, 0.5],
  rollVolume: [0, 2, 0.01],
  tyreSquealVolume: [0, 2, 0.01],
  grassVolume: [0, 1, 0.005],
  dirtVolume: [0, 2, 0.01],
  mudVolume: [0, 2, 0.01],
  waterVolume: [0, 1, 0.005],
  splashVolume: [0, 3, 0.01],
  beltBingVolume: [0, 0.3, 0.005],
  indicatorVolume: [0, 0.15, 0.005],
  useVolume: [0, 1, 0.01],
  knockVolume: [0, 2, 0.01],
  bumpVolume: [0, 2, 0.01],
  gridVolume: [0, 4, 0.05],
  landVolume: [0, 3, 0.01],
  rattleVolume: [0, 1, 0.005],
  rattleThreshold: [0, 2, 0.01],
  rattleChance: [0, 1, 0.01],
  rideWindVolume: [0, 2, 0.01],
  rideWindFullSpeed: [2, 40, 0.5],
  hornVolume: [0, 2, 0.05],
  knockThreshold: [0.05, 5, 0.05],
  knockFullSpeed: [0.2, 10, 0.1],
  knockCooldown: [0, 0.5, 0.01],
  touchdownMinAir: [0, 0.5, 0.01],
  landMinAir: [0.05, 1.5, 0.01],
  landFullSpeed: [0.5, 15, 0.1],
  landQuiet: [0, 1, 0.01],
  bumpsPerMetreGrass: [0, 5, 0.05],
  bumpsPerMetreTrack: [0, 5, 0.05],
  bumpFullSpeed: [1, 30, 0.5],
  splashMinSpeed: [0, 10, 0.1],
  splashFullSpeed: [1, 20, 0.5],
};

// One per engine. Sent to its AudioWorklet (engineWorklet.js) each frame.
export const DEFAULT_AUDIO_PARAMS = {
  engineSound: 'pulse', // 'pulse' (revs built from recorded idle firings), 'recorded' (idle and rev recordings) or 'synth' (fully synthesised)

  // Recorded engine
  recBank: 'engine-bank', // which recordings: 'engine-bank' (four-stroke quads), 'engine-bank-plover' (the old bike's 1938 two-stroke), 'engine-bank-2t' (two-stroke dirt bikes), 'engine-bank-50' (the kids' 50cc scooter two-stroke), 'engine-bank-tractor' (the diesel tractor), 'engine-bank-moto' (the mini moto's Derbi 50), 'engine-bank-atc' (the ATC's Piaggio Ape), 'engine-bank-utv' (the UTV's Gator diesel), 'engine-bank-green' (a Ténéré 250 into a Honda ATV), 'engine-bank-yellow' (a DT 125 into a CR85), 'engine-bank-landy' (the Land Rover's old four), 'engine-bank-fiesta' and 'engine-bank-corsa' (the girls' cars) or 'engine-bank-tractor-eq' (another old tractor, for later)
  recIdleSource: 'quad', // which recorded idle: 'quad' (the main quad), 'rev' (the ATV rev recording, or the CRM250 in the two-stroke bank) or 'third' (the CRF250, four-stroke bank)
  recVolume: 0.6,
  recThrottleLoudness: 0.15, // extra loudness with the throttle open (the rev recording is already louder up the range)
  recRevGain: 0.75, // level of the rev recordings relative to idle
  recBlendLo: 1500, // rpm where the rev recording starts to blend in over the idle recording
  recBlendHi: 2100, // rpm where it has fully taken over
  recToneClosed: 6000, // Hz low-pass with the throttle shut
  recToneOpen: 16000, // Hz low-pass at full throttle
  recMisfireAttack: 0.25, // a misfire's missing bang: level of the opening thump
  recMisfireBody: 0.7, // and of the rest of its cycle, so the engine never goes silent
  recFollow: 0.08, // carry on through the recording while the next recorded pulse is within this rpm ratio (log), rather than jumping
  recLevelling: 0.5, // 0 leaves each recorded pulse's loudness alone; 1 makes every pulse of a kind equally loud
  recMinGrainMs: 32, // at higher revs a grain spans several recorded firings, at least this long
  recOverlap: 0.05, // each pulse runs this much longer than its cycle, so a late next pulse overlaps rather than leaving a gap
  // 'pulse' sound: every firing is a recorded idle firing, cut off when the next one fires
  pulsePitchFollow: 0, // 0 keeps each firing at its recorded speed however high the revs; 1 squeezes it to fit the cycle (like 'recorded')
  pulseRefRpm: 1200, // engine rpm (roughly its idle) where the rev loudness and EQ below start
  pulseRevLoudness: 0.4, // each firing gets louder with revs, (rpm / pulseRefRpm) to this power
  pulseLoudnessCap: 2.5, // but never more than this many times louder
  pulseEqRange: 4500, // rpm above pulseRefRpm over which the rev EQ comes in fully
  pulseLowCut: 16, // dB less deep thump at high revs
  pulseMidBoost: 8, // dB more mid-range rasp at high revs
  pulseMidFreq: 1500, // Hz, centre of that rasp
  pulseMidQ: 0.4, // narrower above 1, wider below
  pulseTone: 6000, // Hz low-pass, which tames the edges where firings are cut short
  pulseCrossfade: 0.4, // fraction of a cycle each firing fades out over as the next starts
  pulseStretch: 1, // a firing recorded faster than the engine turns is stretched to fill its cycle by natural ** this: 1 fills it (lower pitch), 0 plays it at its own speed with a gap
  pulseRevLo: 0, // rpm where the pulse sound starts blending into the bank's real rev firings (0 with pulseRevHi: revs only from idle)
  pulseRevHi: 0, // rpm where they've fully taken over
  pulseSlowest: 0.45, // the slowest a firing is ever stretched to; any slower and it stops short of the next, leaving a gap
  pulseDivide: 1, // sound only every Nth firing, stretched over N: 2 plays the recording at half its pace and an octave down
  pulseRevGain: 1, // level of those rev firings against the idle ones
  pulseRevFollow: 0, // read on through the rev recording while its next firing is within this rpm ratio (log); 0 picks each afresh
  pulseCleanUp: 1.3, // idles cut in slices (the moto's and ATC's two-strokes): above this multiple of the recorded idle speed only the bangs play, so it fires every turn
  pulseDrive: 0.6, // extra drive into the soft clipper at full throttle
  pulseBoomCut: 0, // dB taken out of a boom in the recording itself (a body resonance), at every rpm; 0 leaves it alone
  pulseBoomFreq: 110, // Hz, the middle of that boom
  pulseDrone: 0, // dB of low boost for a big-bore exhaust's drone (Jess's Corsa), fullest at idle and half of it high up the revs; 0 leaves it alone
  pulseDroneFreq: 80, // Hz, the middle of that drone
  recStarterVolume: 0.9,
  recShutdownVolume: 0.9,
  // A turbocharger (engineWorklet.js turboSample): off unless turboVolume is above 0 (the 200TDi).
  turboVolume: 0, // level of its whistle and air at full boost
  turboFromRpm: 1500, // rpm where it starts to make boost
  turboFullRpm: 3400, // and where it makes all it will
  turboSpoolUp: 0.9, // seconds it takes to come up to boost (the lag)
  turboSpoolDown: 0.6, // and to run down again
  turboMinHz: 2200, // the whistle's pitch with a little boost
  turboMaxHz: 6800, // and at full boost
  turboHiss: 0.6, // the rush of air under the whistle, against it
  turboFlutter: 0.5, // the chatter back through it when you shut the throttle on boost

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
  spitVolume: 0.45, // a lean cold engine spitting back through the carb: a softer, lower whuff than a pop

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
  slapVolume: 0.1, // a worn piston's hollow clack while the engine is cold
  pingVolume: 0.12, // pinking and the metal ticking as it cools
  silencerLoud: 2.5, // how much louder the exhaust is with the silencer off (the output's tanh squashes the top, so it needs plenty)
  silencerBright: 0.8, // and how much more open its tone is
  fanVolume: 0.05, // the water-cooled quad's radiator fan

  coughVolume: 0.9,
  drive: 1.8, // final soft clipping

  // Positional
  refDistance: 2.5,
  rolloff: 1.1,
};

export const AUDIO_PARAM_RANGES = {
  engineSound: ['pulse', 'recorded', 'synth'],
  pulsePitchFollow: [0, 1, 0.01],
  pulseRefRpm: [500, 4000, 10],
  pulseRevLoudness: [-1, 2, 0.01],
  pulseLoudnessCap: [1, 10, 0.05],
  pulseEqRange: [500, 10000, 50],
  pulseLowCut: [0, 30, 0.5],
  pulseMidBoost: [0, 20, 0.5],
  pulseMidFreq: [200, 5000, 10],
  pulseMidQ: [0.2, 4, 0.01],
  pulseTone: [1000, 20000, 100],
  pulseCrossfade: [0.05, 1, 0.01],
  pulseStretch: [0, 1, 0.01],
  pulseRevLo: [0, 12000, 50],
  pulseRevHi: [0, 12000, 50],
  pulseSlowest: [0.1, 1, 0.01],
  pulseDivide: [1, 4, 1],
  pulseRevGain: [0, 3, 0.01],
  pulseRevFollow: [0, 0.4, 0.005],
  pulseCleanUp: [1, 4, 0.05],
  pulseDrive: [0, 4, 0.01],
  pulseBoomCut: [0, 18, 0.5],
  pulseBoomFreq: [40, 400, 5],
  pulseDrone: [0, 18, 0.5],
  pulseDroneFreq: [30, 300, 5],
  recBank: ['engine-bank', 'engine-bank-2t', 'engine-bank-50', 'engine-bank-tractor', 'engine-bank-moto', 'engine-bank-atc', 'engine-bank-plover', 'engine-bank-utv', 'engine-bank-green', 'engine-bank-yellow', 'engine-bank-landy', 'engine-bank-tdi', 'engine-bank-fiesta', 'engine-bank-corsa'],
  recIdleSource: ['quad', 'rev', 'third'],
  recVolume: [0, 3, 0.01],
  recThrottleLoudness: [0, 3, 0.01],
  recRevGain: [0, 2, 0.01],
  recBlendLo: [500, 5000, 10],
  recBlendHi: [600, 6000, 10],
  recToneClosed: [500, 20000, 50],
  recToneOpen: [500, 20000, 50],
  recMisfireAttack: [0, 1, 0.01],
  recMisfireBody: [0, 1.5, 0.01],
  recFollow: [0, 0.4, 0.005],
  recLevelling: [0, 1, 0.01],
  recMinGrainMs: [0, 120, 1],
  recOverlap: [0, 0.3, 0.005],
  recStarterVolume: [0, 3, 0.01],
  recShutdownVolume: [0, 3, 0.01],
  turboVolume: [0, 0.3, 0.002],
  turboFromRpm: [500, 4000, 50],
  turboFullRpm: [1000, 6000, 50],
  turboSpoolUp: [0.05, 3, 0.05],
  turboSpoolDown: [0.05, 3, 0.05],
  turboMinHz: [500, 6000, 50],
  turboMaxHz: [1000, 12000, 50],
  turboHiss: [0, 2, 0.05],
  turboFlutter: [0, 2, 0.05],
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
  spitVolume: [0, 2, 0.01],
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
  slapVolume: [0, 1, 0.01],
  pingVolume: [0, 1, 0.01],
  silencerLoud: [0, 6, 0.05],
  silencerBright: [0, 3, 0.05],
  fanVolume: [0, 0.3, 0.005],
  coughVolume: [0, 2, 0.01],
  drive: [0.5, 6, 0.05],
  refDistance: [0.5, 20, 0.1],
  rolloff: [0, 4, 0.05],
};
