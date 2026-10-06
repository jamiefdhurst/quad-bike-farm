// Every tunable number in the engine model. Units are in the key names or the
// comments. Ranges are [min, max, step] for the debug panel.

import { DEFAULT_KNACK_PARAMS, KNACK_RANGES } from './knack.js';

export const DEFAULT_ENGINE_PARAMS = {
  // A quad's knack for starting (knack.js)
  ...DEFAULT_KNACK_PARAMS,

  // Cycle: 4 fires every two revolutions, 2 fires every revolution.
  strokes: 4,

  // Speeds
  maxRpm: 6200, // full throttle: through the CVT a utility quad holds its revs around here under load
  redlineRpm: 5800,
  idleRpmWarm: 1150, // steady idle, warm, no choke
  stallRpm: 350, // below this the engine dies
  crankRpm: 320, // starter motor speed
  batteryIgnitionDrain: 0.0021, // battery (0..1) lost per second with the ignition on and the engine not running (flat in about 8 minutes)
  batteryCrankDrain: 0.0125, // lost per second on the starter (about 8 s of cranking per 10%)
  batteryChargeRate: 0.0017, // gained per second while it runs (flat to full in about 10 minutes)
  batteryWeakBelow: 0.6, // below this the starter turns slower
  batteryDeadBelow: 0.25, // below this the starter only clicks
  weakCrankFactor: 0.4, // the starter's speed, as a fraction of normal, just above dead
  batteryDashOutBelow: 0.1, // below this the dash lights go out
  pullStart: false, // has a recoil pull-start as well as the starter (the two-strokes)
  pullSeconds: 0.9, // how long one good yank turns it over
  pullRpmFactor: 1.1, // a perfect yank's speed, as a fraction of the starter's
  pullGoodMin: 0.45, // seconds holding the cord before the yank that count as a proper pull...
  pullGoodMax: 1.0, // ...up to here; shorter is weak, longer is a botched yank
  pullLateMax: 1.6, // held longer than this and it's the weakest it gets
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

  // Labouring under drive load (hills, mud, pulling away). A full load pulls the
  // revs this fraction of the way from where the throttle wants them down to idle.
  lugDepth: 0.5,
  lugWeakness: 1.1, // extra pull per unit of power lost (cold, choked, fouled), with the square of the climbing or ploughing load: past 1 in all it drags a weak engine below idle and stalls it
  lugStallGain: 3, // dragged past idle, the revs fall this many idles per unit of lugging beyond 1
  lugRoughness: 0.35, // extra roughness per unit of lugging when stone cold, fading as it warms

  // Temperature (0 = stone cold, 1 = fully warm)
  warmUpSeconds: 150, // running at idle from cold to fully warm
  warmUpRpmBoost: 2.0, // extra warming at high rpm (fraction of the base rate): flat out it warms about three times as fast as at idle
  warmUpLoadBoost: 1.5, // and more again pulling hard under load (climbing, mud, pulling away)
  coolDownSeconds: 900, // exponential time constant when off
  barnWarmFloor: 0.25, // temperature (0..1) a switched-off engine only cools down to in the barn (it never warms up by itself)
  barnCoolFactor: 2.5, // how many times slower it cools in the barn, out of the wind and rain
  warmLightThreshold: 0.65, // dash cold light goes out above this

  // Mixture. mixture = choke enrichment - enrichment the engine needs.
  // Positive is rich, negative is lean.
  coldEnrichmentNeed: 1.0, // enrichment needed at temperature 0, falls to 0 when warm
  chokeEnrichment: 1.0, // enrichment from full choke
  throttleChokeRelief: 0.3, // opening the throttle dilutes the choke this much
  richTolerance: 0.25, // rich mixture tolerated before it starts fouling
  mixtureTrim: 0, // carburettor jetting: added to the mixture all the time, positive richer (set from the toolbox)

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
  roughHunt: 0.32, // a fully rough engine's idle hunts by about this fraction of its idle (it grows with roughness squared)
  roughHuntFrequency: 0.7, // Hz
  wearPerMinute: 0.012, // roughness gained per minute of idling; more when it's worked hard
  wearWorkBoost: 2, // flat out it wears this much faster again
  wearMax: 1, // run long and hard enough, any engine wears to fully rough
  // Badly in need of a service it turns erratic, from erraticFrom up to fully
  // rough (its condition: build roughness plus wear, not cold or mixture):
  erraticFrom: 0.8,
  stumbleRate: 0.45, // per second at worst: it starts a run of misfires...
  stumbleRunMin: 2, // ...this many cycles long...
  stumbleRunMax: 6,
  stumblePower: 0.3, // ...with only this much of its power while it stumbles
  stumbleStallChance: 0.015, // at worst, the chance a stumble is one it doesn't come back from
  backfireChance: 0.28, // catching again after a stumble, the chance it does so with a bang
  surgeRate: 0.25, // per second at worst: the idle flares up...
  surgeRpm: 0.5, // ...by this fraction of its idle, dying away over a second or so
  erraticHunt: 0.18, // a fast, irregular wander on top of the rough hunt, as a fraction of idle

  // Firing pulses
  cycleJitter: 0.18, // cycle length variation at full roughness
  pulseStrengthJitter: 0.45, // pulse strength variation at full roughness
  misfireBase: 0.002, // misfire chance per cycle when smooth
  misfireRoughness: 0.18, // extra misfire chance at full roughness (scaled by roughness squared)
  misfireRpmDrop: 140, // rpm lost on a misfire
  pulseRpmKick: 90, // rpm swing from pulse strength variation

  // Two-stroke character (leave at 0 for a four-stroke)
  skipChance: 0, // at light throttle and low revs, chance each other firing is skipped (the "ring-ding")
  skipThrottle: 0.2, // only below this throttle
  skipRpm: 4000, // and below these revs
  idleFoulRate: 0, // plug fouling per second while idling (oily two-stroke plugs load up); throttle clears it

  // Oil in the petrol (see lubrication.js). The fraction is of the tank: 0.02 is 50:1.
  oilGood: 0.02, // a two-stroke is fully lubricated at this fraction of oil in its fuel
  oilRichFrom: 0.04, // a two-stroke starts to smoke and foul above this
  oilRichFull: 0.1, // and is as bad as it gets here
  oilFourStrokeFrom: 0.004, // a four-stroke burning any oil smokes and fouls from here
  oilFourStrokeFull: 0.02, // and is as bad as it gets here
  oilFoulRate: 0.15, // plug fouling per second at full excess oil, on top of any other
  oilRichRoughness: 0.2, // roughness at full excess oil
  seizeSeconds: 70, // flat out on straight petrol it seizes in about this long (idling takes lubeIdleWork times longer)
  lubeIdleWork: 0.15, // how hard an idling engine works the oil, against 1 flat out
  overheatSeconds: 12, // how quickly the extra heat from poor lubrication builds and fades
  seizeWear: 0.3, // wear left behind after a seized engine is freed (a service clears it)
  nipFrom: 0.55, // scuffing this far towards seizing, it starts to tighten up
  nipRoughness: 0.45, // roughness when nearly seized
  nipPowerLoss: 0.6, // power lost when nearly seized
  beltFlareRpm: 1800, // rpm a fully slipping drive belt lets the revs run on past what the load would hold, at full throttle
  dirtRoughness: 0.3, // roughness added by a fully dirty carb
  dirtPowerLoss: 0.25, // power lost to a fully dirty carb

  // Heat (see heat.js). Running heat is 0..1 above a normal warm engine; soak is the heat held in the metal.
  waterCooled: false, // a radiator and a fan: the heat stays low and the fan cuts in and out
  heatSun: 0.75, // heat load of a full-sun day
  heatWork: 0.5, // heat load of working flat out
  heatAirCool: 1.2, // heat carried off by full airflow, which needs about airflowSpeed
  airflowSpeed: 8, // ground speed in m/s that gives full airflow
  heatRiseSeconds: 240, // time constant of heating up (an air-cooled engine idling in full sun is pinking in about four minutes)
  heatFallSeconds: 90, // and of cooling down
  heatWaterScale: 0.6, // the water-cooled engine feels this much of the load
  fanOnAt: 0.28, // the radiator fan cuts in above this heat
  fanOffAt: 0.12, // and out below this
  fanCooling: 0.7, // heat carried off by the fan
  pinkFrom: 0.45, // pinking starts at this heat
  pinkRoughness: 0.3, // roughness at full pinking
  pinkPowerLoss: 0.25, // power lost at full pinking
  pinkRate: 14, // rattles a second at full pinking under load
  heatGaugeWater: 0.25, // how much of its heat the water-cooled one's gauge shows
  soakIdle: 0.25, // heat held in the metal by an engine just idling, against 1 flat out
  soakRiseSeconds: 60, // how fast the metal heats up
  soakFallSeconds: 240, // and how long it takes to shed it (running, or switched off)
  tickFrom: 0.3, // an engine switched off ticks as it cools from this much soak
  coolTickRate: 1.1, // ticks a second when it's as hot as it gets
  hotStartFrom: 0.5, // a carburettor this heat-soaked starts to boil its fuel
  hotStartRich: 0.6, // how much richer it starts at full soak
  hotStartThrottleRelief: 0.7, // holding the throttle open takes this much of that away

  // Popping on the overrun: unburnt fuel going off in the pipe when the throttle's shut at speed
  popFromRpm: 3200, // only above these revs
  popThrottle: 0.05, // and with the throttle shut to below this
  popBase: 0.12, // chance each firing at full propensity and full revs
  popProne: 0.03, // how readily a healthy engine pops (the two-strokes and lean-jetted quads are higher, in their specs)
  popLean: 1.0, // propensity added per unit of leanness
  popWear: 0.8, // propensity added by a fully worn engine
  popHeat: 0.4, // propensity added by running hot

  // Silencer off (a toolbox job)
  silencerPower: 0.08, // power gained with the silencer off
  silencerPop: 0.5, // overrun propensity added with it off (open pipe, so it crackles)

  // Run-on: switched off hot, worn or lean, it chugs on for a few beats
  runOnBase: 0, // chance of running on from a healthy, cool engine
  runOnHot: 0.55, // chance added by a fully heat-soaked engine
  runOnWear: 0.6, // by a fully worn one
  runOnLean: 0.5, // by running lean
  runOnCyclesMin: 3, // firings it runs on for, at the least
  runOnCyclesMax: 15, // and at the most (the worse it is, the longer)

  // Drowning it: a deep puddle taken too fast (see water.js)
  waterDepthFrom: 0.35, // puddle depth (0..1) under the wheels below which no water gets in
  waterSafeSpeed: 3, // m/s: slower than this it wades through without a drop
  waterFullSpeed: 10, // m/s at which it takes in the most
  waterGulpRate: 6, // water taken in per second at full depth and speed (a puddle is only about a quarter of a second long at speed)
  waterDrainRunning: 0.03, // per second it drains while running (it blows out)
  waterDrainThrottle: 0.05, // extra per second with the throttle wide open
  waterDrainOff: 0.022, // per second it drains standing about, so about 45 s to clear
  waterRoughness: 0.9, // roughness added by a full load of water
  waterPowerLoss: 0.7, // power lost to it
  waterMisfire: 0.6, // extra chance of a misfire on each firing at full water
  waterStallAt: 0.65, // above this it may stall
  waterStallChance: 0.25, // chance of stalling on each firing once past that
  waterNoStart: 0.15, // wetter than this it won't catch (fades out to nothing at this level)

  // Fuel starvation, from the carburettor float bowl level (0..1)
  fuelStarveLevel: 0.65, // below this bowl level the mixture starts to go lean
  starveLean: 1.1, // how lean it goes as the bowl empties

  // Integration
  maxStep: 1 / 240,
  initialTemperature: 0,
};

export const ENGINE_PARAM_RANGES = {
  ...KNACK_RANGES,
  strokes: [2, 4, 2],
  skipChance: [0, 1, 0.01],
  skipThrottle: [0, 1, 0.01],
  skipRpm: [500, 10000, 50],
  idleFoulRate: [0, 0.05, 0.0005],
  maxRpm: [5000, 12000, 100],
  redlineRpm: [4000, 11000, 100],
  idleRpmWarm: [800, 2500, 10],
  stallRpm: [200, 1200, 10],
  crankRpm: [100, 600, 10],
  batteryIgnitionDrain: [0, 0.02, 0.0001],
  batteryCrankDrain: [0, 0.1, 0.0005],
  batteryChargeRate: [0, 0.02, 0.0001],
  batteryWeakBelow: [0.1, 1, 0.01],
  batteryDeadBelow: [0, 0.6, 0.01],
  weakCrankFactor: [0.05, 1, 0.01],
  batteryDashOutBelow: [0, 0.3, 0.01],
  pullSeconds: [0.2, 3, 0.05],
  pullRpmFactor: [0.3, 2, 0.05],
  pullGoodMin: [0.1, 1.5, 0.05],
  pullGoodMax: [0.3, 3, 0.05],
  pullLateMax: [0.5, 4, 0.05],
  crankSpinUpRate: [1, 60, 0.5],
  crankCompressionDip: [0, 0.9, 0.01],
  crankDipWidth: [0.01, 0.3, 0.005],
  catchRpm: [800, 3000, 10],
  spinDownRate: [0.5, 10, 0.1],
  spinDownFriction: [0, 1000, 10],
  rpmRiseRate: [0.5, 15, 0.1],
  rpmFallRate: [0.5, 15, 0.1],
  loadDragRpm: [0, 6000, 50],
  lugDepth: [0, 1, 0.01],
  lugWeakness: [0, 3, 0.01],
  lugStallGain: [0, 10, 0.1],
  lugRoughness: [0, 1, 0.01],
  warmUpSeconds: [10, 600, 5],
  warmUpRpmBoost: [0, 6, 0.05],
  warmUpLoadBoost: [0, 6, 0.05],
  coolDownSeconds: [30, 3600, 10],
  barnWarmFloor: [0, 0.8, 0.01],
  barnCoolFactor: [1, 8, 0.1],
  warmLightThreshold: [0, 1, 0.01],
  coldEnrichmentNeed: [0, 2, 0.01],
  chokeEnrichment: [0, 2, 0.01],
  throttleChokeRelief: [0, 1, 0.01],
  richTolerance: [0, 1, 0.01],
  mixtureTrim: [-0.5, 0.5, 0.01],
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
  baseRoughness: [0, 1, 0.01],
  roughHunt: [0, 1, 0.01],
  roughHuntFrequency: [0.05, 5, 0.05],
  wearPerMinute: [0, 0.2, 0.001],
  wearWorkBoost: [0, 10, 0.1],
  wearMax: [0, 1, 0.01],
  erraticFrom: [0, 1, 0.01],
  stumbleRate: [0, 3, 0.01],
  stumbleStallChance: [0, 0.5, 0.005],
  stumbleRunMin: [1, 10, 1],
  stumbleRunMax: [1, 20, 1],
  stumblePower: [0, 1, 0.01],
  backfireChance: [0, 1, 0.01],
  surgeRate: [0, 3, 0.01],
  surgeRpm: [0, 2, 0.05],
  erraticHunt: [0, 1, 0.01],
  cycleJitter: [0, 0.6, 0.01],
  pulseStrengthJitter: [0, 1, 0.01],
  misfireBase: [0, 0.1, 0.001],
  misfireRoughness: [0, 1, 0.01],
  misfireRpmDrop: [0, 600, 5],
  pulseRpmKick: [0, 400, 5],
  oilGood: [0.005, 0.1, 0.001],
  oilRichFrom: [0, 0.2, 0.001],
  oilRichFull: [0.01, 0.3, 0.001],
  oilFourStrokeFrom: [0, 0.05, 0.001],
  oilFourStrokeFull: [0.005, 0.1, 0.001],
  oilFoulRate: [0, 1, 0.01],
  oilRichRoughness: [0, 1, 0.01],
  seizeSeconds: [5, 600, 5],
  lubeIdleWork: [0, 1, 0.01],
  overheatSeconds: [1, 60, 1],
  seizeWear: [0, 1, 0.01],
  nipFrom: [0, 0.95, 0.01],
  nipRoughness: [0, 1, 0.01],
  nipPowerLoss: [0, 1, 0.01],
  beltFlareRpm: [0, 4000, 50],
  dirtRoughness: [0, 1, 0.01],
  dirtPowerLoss: [0, 1, 0.01],
  waterCooled: [0, 1, 1],
  heatSun: [0, 2, 0.01],
  heatWork: [0, 2, 0.01],
  heatAirCool: [0, 3, 0.05],
  airflowSpeed: [1, 20, 0.5],
  heatRiseSeconds: [10, 900, 5],
  heatFallSeconds: [10, 900, 5],
  heatWaterScale: [0, 1, 0.01],
  fanOnAt: [0, 1, 0.01],
  fanOffAt: [0, 1, 0.01],
  fanCooling: [0, 2, 0.01],
  pinkFrom: [0, 0.95, 0.01],
  pinkRoughness: [0, 1, 0.01],
  pinkPowerLoss: [0, 1, 0.01],
  pinkRate: [0, 40, 1],
  heatGaugeWater: [0, 1, 0.01],
  soakIdle: [0, 1, 0.01],
  soakRiseSeconds: [5, 600, 5],
  soakFallSeconds: [30, 1800, 10],
  tickFrom: [0, 0.95, 0.01],
  coolTickRate: [0, 5, 0.05],
  hotStartFrom: [0, 0.95, 0.01],
  hotStartRich: [0, 1.5, 0.01],
  hotStartThrottleRelief: [0, 1, 0.01],
  popFromRpm: [1000, 8000, 50],
  popThrottle: [0, 0.3, 0.01],
  popBase: [0, 1, 0.01],
  popProne: [0, 1, 0.01],
  popLean: [0, 3, 0.05],
  popWear: [0, 3, 0.05],
  silencerPower: [0, 0.3, 0.01],
  silencerPop: [0, 2, 0.01],
  popHeat: [0, 3, 0.05],
  runOnBase: [0, 1, 0.01],
  runOnHot: [0, 1, 0.01],
  runOnWear: [0, 1, 0.01],
  runOnLean: [0, 1, 0.01],
  runOnCyclesMin: [0, 30, 1],
  runOnCyclesMax: [0, 60, 1],
  waterDepthFrom: [0, 0.9, 0.01],
  waterSafeSpeed: [0, 15, 0.5],
  waterFullSpeed: [1, 25, 0.5],
  waterGulpRate: [0, 10, 0.1],
  waterDrainRunning: [0, 0.5, 0.005],
  waterDrainThrottle: [0, 0.5, 0.005],
  waterDrainOff: [0, 0.5, 0.002],
  waterRoughness: [0, 1, 0.01],
  waterPowerLoss: [0, 1, 0.01],
  waterMisfire: [0, 1, 0.01],
  waterStallAt: [0.1, 1, 0.01],
  waterStallChance: [0, 1, 0.01],
  waterNoStart: [0.02, 1, 0.01],
  fuelStarveLevel: [0.05, 1, 0.01],
  starveLean: [0, 3, 0.05],
};
