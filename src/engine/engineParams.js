// Every tunable number in the engine model. Units are in the key names or the
// comments. Ranges are [min, max, step] for the debug panel.

export const DEFAULT_ENGINE_PARAMS = {
  // Speeds
  maxRpm: 8500,
  redlineRpm: 7500,
  idleRpmWarm: 1150, // steady idle, warm, no choke
  stallRpm: 350, // below this the engine dies
  crankRpm: 320, // starter motor speed
  crankSpinUpRate: 25, // 1/s, how quickly crank speed follows the starter (spin-up and compression dips)
  crankCompressionDip: 0.55, // fraction of crank speed lost heaving the piston over compression
  crankDipWidth: 0.08, // width of that slowdown, as a fraction of the cycle
  catchRpm: 1500, // rpm the engine jumps to when it fires up
  spinDownRate: 2.5, // 1/s, exponential spin-down when not running
  spinDownFriction: 250, // rpm/s, extra linear friction during spin-down

  // Throttle response
  rpmRiseRate: 7, // 1/s toward target when below it, scaled by power
  rpmFallRate: 6, // 1/s toward target when above it
  loadDragRpm: 4000, // rpm/s pulled off by a full drivetrain load (heavy braking)

  // Temperature (0 = stone cold, 1 = fully warm)
  warmUpSeconds: 150, // running at idle from cold to fully warm
  warmUpRpmBoost: 0.8, // extra warming at high rpm (fraction of the base rate)
  coolDownSeconds: 900, // exponential time constant when off
  warmLightThreshold: 0.65, // dash cold light goes out above this

  // Mixture. mixture = choke enrichment - enrichment the engine needs.
  // Positive is rich, negative is lean.
  coldEnrichmentNeed: 1.0, // enrichment needed at temperature 0, falls to 0 when warm
  chokeEnrichment: 1.0, // enrichment from full choke
  throttleChokeRelief: 0.3, // opening the throttle dilutes the choke this much
  richTolerance: 0.25, // rich mixture tolerated before it starts fouling

  // Idle target
  chokeIdleRpm: 1500, // idle lift from full choke on a warm engine
  chokeIdleColdFactor: 0.45, // fraction of that lift when cold (it drifts up as it warms)
  leanIdleDrop: 1200, // rpm lost per unit of lean mixture

  // Hunting when rich
  huntRpm: 600, // idle swing per unit of richness
  huntFrequency: 0.6, // Hz

  // Power available (fraction of full torque)
  coldPowerLoss: 0.78,
  leanPowerLoss: 0.8,
  richPowerLoss: 0.5,
  foulPowerLoss: 0.4,
  minPower: 0.1,

  // Plug fouling from running rich. Reaching 1 stalls the engine.
  foulRate: 0.06, // per second per unit of richness while running
  crankFoulRate: 0.12, // per second per unit of richness while cranking (flooding)
  foulClearRate: 0.08, // per second when not rich, at idle
  foulClearThrottleBoost: 2, // clearing multiplier gained at full throttle
  foulClearRateStopped: 0.02, // plugs drying out while not running
  crankClearRate: 0.15, // per second at full throttle while cranking (clearing a flood)

  // Starting
  catchChance: 0.6, // chance per compression stroke with a perfect mixture, warm
  catchColdFactor: 0.75, // catch chance multiplier when stone cold
  catchLeanWidth: 0.35, // mixture width of the catch window on the lean side
  catchRichWidth: 0.45, // and on the rich side

  // Roughness (0 = smooth, 1 = very lumpy)
  coldRoughness: 0.55,
  leanRoughness: 0.8,
  richRoughness: 0.9,
  foulRoughness: 0.5,
  baseRoughness: 0.08, // a single cylinder is never perfectly smooth

  // Firing pulses
  cycleJitter: 0.18, // cycle length variation at full roughness
  pulseStrengthJitter: 0.45, // pulse strength variation at full roughness
  misfireBase: 0.002, // misfire chance per cycle when smooth
  misfireRoughness: 0.18, // extra misfire chance at full roughness (scaled by roughness squared)
  misfireRpmDrop: 140, // rpm lost on a misfire
  pulseRpmKick: 90, // rpm swing from pulse strength variation

  // Integration
  maxStep: 1 / 240,
  initialTemperature: 0,
};

export const ENGINE_PARAM_RANGES = {
  maxRpm: [5000, 12000, 100],
  redlineRpm: [4000, 11000, 100],
  idleRpmWarm: [800, 2500, 10],
  stallRpm: [200, 1200, 10],
  crankRpm: [100, 600, 10],
  crankSpinUpRate: [1, 60, 0.5],
  crankCompressionDip: [0, 0.9, 0.01],
  crankDipWidth: [0.01, 0.3, 0.005],
  catchRpm: [800, 3000, 10],
  spinDownRate: [0.5, 10, 0.1],
  spinDownFriction: [0, 1000, 10],
  rpmRiseRate: [0.5, 15, 0.1],
  rpmFallRate: [0.5, 15, 0.1],
  loadDragRpm: [0, 6000, 50],
  warmUpSeconds: [10, 600, 5],
  warmUpRpmBoost: [0, 3, 0.05],
  coolDownSeconds: [30, 3600, 10],
  warmLightThreshold: [0, 1, 0.01],
  coldEnrichmentNeed: [0, 2, 0.01],
  chokeEnrichment: [0, 2, 0.01],
  throttleChokeRelief: [0, 1, 0.01],
  richTolerance: [0, 1, 0.01],
  chokeIdleRpm: [0, 3000, 10],
  chokeIdleColdFactor: [0, 1, 0.01],
  leanIdleDrop: [0, 3000, 10],
  huntRpm: [0, 2000, 10],
  huntFrequency: [0.05, 3, 0.05],
  coldPowerLoss: [0, 0.9, 0.01],
  leanPowerLoss: [0, 1, 0.01],
  richPowerLoss: [0, 1, 0.01],
  foulPowerLoss: [0, 1, 0.01],
  minPower: [0, 1, 0.01],
  foulRate: [0, 0.5, 0.005],
  crankFoulRate: [0, 1, 0.005],
  foulClearRate: [0, 0.5, 0.005],
  foulClearThrottleBoost: [0, 10, 0.1],
  foulClearRateStopped: [0, 0.2, 0.001],
  crankClearRate: [0, 1, 0.005],
  catchChance: [0, 1, 0.01],
  catchColdFactor: [0, 1, 0.01],
  catchLeanWidth: [0.05, 1.5, 0.01],
  catchRichWidth: [0.05, 1.5, 0.01],
  coldRoughness: [0, 1, 0.01],
  leanRoughness: [0, 2, 0.01],
  richRoughness: [0, 2, 0.01],
  foulRoughness: [0, 2, 0.01],
  baseRoughness: [0, 0.5, 0.01],
  cycleJitter: [0, 0.6, 0.01],
  pulseStrengthJitter: [0, 1, 0.01],
  misfireBase: [0, 0.1, 0.001],
  misfireRoughness: [0, 1, 0.01],
  misfireRpmDrop: [0, 600, 5],
  pulseRpmKick: [0, 400, 5],
};
