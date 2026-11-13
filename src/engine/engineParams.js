// Every tunable number in the engine model. Units are in the key names or the
// comments. Ranges are [min, max, step] for the debug panel.

import { DEFAULT_KNACK_PARAMS, KNACK_RANGES } from './knack.js';
import { DEFAULT_SLAP_PARAMS, SLAP_RANGES } from './pistonSlap.js';
import { DEFAULT_CHARGING_PARAMS, CHARGING_PARAM_RANGES } from './charging.js';
import { DEFAULT_TIMING_PARAMS, TIMING_PARAM_RANGES } from './ignitionTiming.js';

export const DEFAULT_ENGINE_PARAMS = {
  // A quad's knack for starting (knack.js)
  ...DEFAULT_KNACK_PARAMS,
  ...DEFAULT_SLAP_PARAMS,
  ...DEFAULT_TIMING_PARAMS,
  manualTiming: false, // an advance-retard lever on the bars (ignitionTiming.js): the old bike's starting ritual
  tickler: false, // a tickler on the carb (the old bike): a press floods a little fuel in, to start it cold without a choke
  tickleAmount: 0.45, // how much one press adds to what is in the float bowl, in enrichment terms
  tickleRich: 0.9, // mixture enrichment per unit of it, as if it were choke
  tickleSeconds: 45, // seconds a unit takes to drain off or burn away when it is standing
  tickleRunFactor: 5, // and how many times quicker while it runs
  tickleFloodAbove: 1.4, // past this much in, it is flooded: the plug is wet and it will not catch
  tickleFoulRate: 0.12, // fouling per second at twice that
  kickStart: false, // its pull is a kickstart pedal: held down for a swing, and it can kick back with the lever advanced

  // What running does to the battery (charging.js)
  ...DEFAULT_CHARGING_PARAMS,

  // Cycle: 4 fires every two revolutions, 2 fires every revolution.
  strokes: 4,
  cylinders: 1, // firings per cycle, evenly spaced: each one a pulse (the Tor's or Crag's four), so a misfire or a lumpy beat is one of them, not the whole cycle

  // Speeds
  maxRpm: 6200, // full throttle: through the CVT a utility quad holds its revs around here under load
  redlineRpm: 5800,
  idleRpmWarm: 1150, // steady idle, warm, no choke
  stallRpm: 350, // below this the engine dies
  crankRpm: 320, // starter motor speed
  batteryIgnitionDrain: 0.0021, // battery (0..1) lost per second with the ignition on and the engine not running (flat in about 8 minutes)
  batteryCrankDrain: 0.0125, // lost per second on the starter (about 8 s of cranking per 10%)
  batteryChargeRate: 0.0017, // gained per second at full alternator output (flat to full in about 10 minutes revved; slower at idle, see charging.js)
  chillChoke: 0.5, // extra choke a cold engine needs on the coldest day (times 1 + this), see Weather.chill
  chillChokeFlow: 0.9, // share of that extra the choke can deliver, so full choke still starts a frozen engine (1 = as easily as a mild cold one)
  chillWarmUp: 0.6, // longer a cold engine takes to warm up on the coldest day (times 1 + this)
  chillBattery: 1, // faster the battery drains (ignition and starter) on the coldest day (times 1 + this)
  chillGlow: 0.5, // longer the glow plugs take on the coldest day (times 1 + this)
  batteryWeakBelow: 0.6, // below this the starter turns slower
  batteryDeadBelow: 0.25, // below this the starter only clicks
  weakCrankFactor: 0.4, // the starter's speed, as a fraction of normal, just above dead
  batteryDashOutBelow: 0.1, // below this the dash lights go out
  terminalsSlowFrom: 0.25, // corroded battery posts (0..1) from this level starve the starter, so it turns slower, though the battery is fine
  terminalsClickAt: 0.7, // and from this level it only clicks, as a flat battery does (the dash and lamps stay bright)
  terminalsCrankFloor: 0.35, // the starter's speed, as a fraction of normal, just under the click
  pullStart: false, // has a recoil pull-start as well as the starter (the two-strokes)
  crankHandle: false, // its pull is a starting handle at the front (the Tor or Crag): each swing sounds a clunk, not the starter
  noStarter: false, // no starter motor at all, only the cord (the mini moto)
  pullSeconds: 0.9, // how long one good yank turns it over
  pullRpmFactor: 1.1, // a perfect yank's speed, as a fraction of the starter's
  pullGoodMin: 0.45, // seconds holding the cord before the yank that count as a proper pull...
  pullGoodMax: 1.0, // ...up to here; shorter is weak, longer is a botched yank
  pullLateMax: 1.6, // held longer than this and it's the weakest it gets
  rollMinFraction: 0.08, // bump-start: the wheels turn it over at all from this fraction of full-throttle revs in the gear (src/engine/bumpStart.js)
  rollFullFraction: 0.35, // ...as fast as a starter would from this fraction (about 1.7 m/s in second on the quads)
  rollClutchMin: 0.5, // the clutch has to be at least this far out for the wheels to turn it
  rollCatchTwoStroke: 1, // how readily it fires turned by the wheels, against the starter: a two-stroke...
  rollCatchFourStroke: 0.55, // ...a four-stroke
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
  jet: 0, // two-strokes: main jet size fitted, in whole sizes from stock (the jet kit in the toolbox), positive bigger
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
  wearColdBoost: 6, // revved hard while it's cold, it wears this much faster again
  wearColdBelow: 0.5, // engine temperature (0 cold, 1 warm) under which revving it counts as thrashing it
  wearOverRevBoost: 30, // per unit of revs over designRpm: flat out, 10% over wears twice as fast as at its design top, 30% over four times
  designRpm: 0, // the full-throttle revs it was built for (set each game from its top); 0 means maxRpm, so no over-rev wear
  runInSeconds: 600, // a rebuilt engine wants this long running before it's thrashed (idling counts for runInIdleShare of it)
  runInIdleShare: 0.5, // how much of the running-in clock ticks while it only idles
  runInGentleRpm: 0.6, // revs (0 idle, 1 flat out) up to which it's still being run in gently
  runInWearBoost: 5, // thrashed flat out while it's new, it wears this much faster again
  runInScarPerMinute: 0.012, // permanent roughness left per minute of thrashing it while it's new
  runInScarMax: 0.1, // the most roughness a thrashed running-in leaves behind for good (a service doesn't clear it)
  runInNoticeFrom: 0.15, // the girls only say something while it still has this much of its running in to do
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
  roughRevFade: 0, // share of its build and wear roughness its firings lose once revved up: a lumpy single evens out (faults don't)
  roughRevSmoothRpm: 3500, // rpm by which that's done, easing in from its idle
  pulseRpmKick: 90, // rpm swing from pulse strength variation

  // Two-stroke character (leave at 0 for a four-stroke)
  skipChance: 0, // at light throttle and low revs, chance each other firing is skipped (the "ring-ding")
  skipThrottle: 0.2, // only below this throttle
  skipRpm: 4000, // and below these revs
  idleFoulRate: 0, // plug fouling per second while idling (oily two-stroke plugs load up); throttle clears it
  additiveFoulCut: 0.85, // share of the idle and excess-oil plug fouling that plug-saver in the fuel stops, at full strength (vehicle/plugAdditive.js)

  // The orange's coolant leak (see coolant.js). Levels run 1 full to 0 dry.
  coolantLeakRun: 0.00035, // level lost a second while running at a leak multiplier of 1 (about 48 minutes from full to dry)
  coolantParkedLeak: 0.25, // the share of that it weeps while parked with the metal still hot
  coolantWeepSoak: 0.3, // soak over which a parked engine is still hot enough to weep
  coolantLeakChance: 0.5, // the chance of the orange having a leak at all in a given game
  coolantLeakMin: 0.6, // the leak this game is this many times the rate, at least...
  coolantLeakMax: 1.4, // ...and at most
  thermostatChance: 0.2, // the chance a water-cooled engine starts the game with its thermostat stuck shut
  thermostatStickPerHour: 0.25, // and the chance, an hour of running, that a good one sticks
  thermostatMin: 0.55, // how far shut it sticks: this much at least (1 is fully shut)...
  thermostatBlock: 0.95, // share of the radiator's cooling a fully shut thermostat takes away
  thermostatFlushSeconds: 6, // seconds of pouring coolant through a cold, stopped engine to free it
  hotFrom: 0.5, // a water-cooled engine's heat from which it is running too hot: it loses power and runs rough
  hotPowerLoss: 0.55, // power lost at the top of that
  hotRoughness: 0.25, // roughness at the top of that
  hotStallAt: 0.95, // heat at which it gives up and stalls
  hotRestartBelow: 0.4, // heat it has to cool to before it will start again
  coolantStartMin: 0.55, // it starts the game this full, at least...
  coolantStartMax: 0.95, // ...and at most
  coolantPuddleFrom: 0.92, // level under which a damp patch grows while it leaks
  coolantPuddleGrow: 0.01, // patch growth a second while leaking, as a fraction of full size
  coolantPuddleFade: 0.003, // and how fast it dries
  coolantOkAt: 0.5, // level at and above which the radiator does all its cooling
  coolantEmptyAt: 0.1, // level at which it does none
  coolantSteamBelow: 0.4, // level under which it can steam when it's hot
  coolantSteamHeat: 0.35, // heat from which steam shows
  coolantBoilHeat: 0.5, // heat over which a low engine boils over...
  coolantBoilEffect: 0.5, // ...once the radiator's down to this share of its cooling
  coolantBoilLeft: 0.06, // level left after a boil-over
  coolantBoilSteamSeconds: 14, // how long the steam from a boil-over takes to die away
  // Jetting a two-stroke (see jetting.js). Sizes are jet sizes either side of stock.
  jetRefCelsius: 12, // the stock jet is right at this temperature
  jetPerDegree: 0.12, // sizes bigger the day wants per degree colder (smaller per degree hotter)
  jetMixture: 0.06, // mixture added per size too big (taken per size too small)
  jetLeanSafe: 1, // sizes too small before it's lean enough to hurt
  jetLeanFull: 3, // sizes too small at which it's as lean as it gets
  jetSeizeSeconds: 160, // flat out at full lean, it seizes in about this long (idling takes lubeIdleWork times longer)
  jetTrueWithin: 0.25, // sizes either way of the right one that count as spot on
  jetTrueFade: 1, // sizes out at which the spot-on bonus has gone
  jetPower: 0.06, // power gained when spot on, on top of everything else
  jetRoughness: 0.05, // roughness taken off when spot on
  // The day's air (see airDensity.js): cold dry air is dense, warm muggy air thin.
  airRefDamp: 0.4, // how damp the air is (0..1) on the day the stock tune is right for
  airPerDegree: 0.006, // density gained per degree colder than jetRefCelsius
  airPerDamp: 0.15, // density lost per whole unit of damp above airRefDamp, at the reference temperature (warmer air holds more of it)
  airPower: 0.6, // power gained per unit of density (dense air burns more fuel a stroke)
  airLean: 0.4, // mixture lost per unit of density on a carburettor with a fixed jet (an injected engine and a diesel keep theirs)
  jetPerDamp: 0.5, // sizes smaller a two-stroke wants per whole unit of damp above airRefDamp
  // The big-bore kit (see bigBore.js), fitted at the bench. Only the yellow has one to fit.
  boreKit: 0, // 1 if a big-bore kit is made for this engine
  borePower: 0.18, // power gained with the kit fitted well
  boreHeat: 0.45, // extra heat from working, as a share (heat load of work is this much more)
  boreWear: 1.6, // extra wear: it wears this much faster again (2.6 times the usual)
  boreJet: 0.6, // sizes bigger a jet it wants for the day, on top of what the weather wants
  // Oil in the petrol (see lubrication.js). The fraction is of the tank: 0.02 is 50:1.
  oilGood: 0.02, // a two-stroke is fully lubricated at this fraction of oil in its fuel
  oilRichFrom: 0.04, // a two-stroke starts to smoke and foul above this
  oilRichFull: 0.1, // and is as bad as it gets here
  oilFourStrokeFrom: 0.004, // a four-stroke burning any oil smokes and fouls from here
  oilFourStrokeFull: 0.02, // and is as bad as it gets here
  sumpOkLevel: 0.25, // a four-stroke is fully lubricated with its sump this far up (1 is the top mark); under it, it's starved like a two-stroke on straight petrol
  sumpTickFrom: 0.28, // under this sump level the tappets start to tick...
  sumpTickFull: 0.1, // ...and tick as loud as they get at this
  tickRoughness: 0.12, // roughness when the tappets tick as loud as they get (a low sump)
  tickRate: 9, // tappet ticks a second at full tick, at idle
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
  leakLean: 0.25, // mixture leaned by a fully split intake boot at idle (less as the throttle opens, when the vacuum is lower)
  leakHunt: 0.22, // idle hunt of a fully split boot, as a fraction of idle rpm: a slow rise and fall, mostly at idle
  leakHuntFrequency: 0.45, // Hz of that hunt
  popLeak: 0.6, // overrun pop propensity added by a fully split boot (it sucks air in with the throttle shut)
  valveTightPowerLoss: 0.3, // power lost to valves set fully too tight (they don't seat)
  valveLoosePowerLoss: 0.05, // and to valves fully too loose (they open late)
  valveTightHot: 2, // times as much extra hot-start richness tight valves add to a heat-soaked engine
  clogRich: 0.3, // mixture added by a fully clogged air filter (it chokes the air, so it runs rich: past richTolerance it smokes and fouls)
  carbIcePowerLoss: 0.55, // power lost to a carb iced solid (a damp, cold day at steady part throttle; a blip clears it)
  clogPowerLoss: 0.3, // top-end power lost to a fully clogged air filter (it's the revs it can't breathe for)

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
  steamFrom: 0.7, // running heat from which a wisp of steam shows
  steamCooking: 0.5, // how much steam a fully cooking engine gives (1 is as much as the orange's boil-over)
  steamWetFrom: 0.3, // metal heat (running heat or soak) from which rain steams off it: just idling doesn't
  steamWet: 0.9, // steam from rain on fully hot metal
  steamWetGround: 0.4, // wet ground counts for this much of falling rain
  condenseAirBelow: 12, // air temperature (°C) below which a cold exhaust shows vapour at all
  condenseAirFull: 0, // and the air temperature at which it shows most
  condenseWarmAt: 0.6, // engine warmth (0..1) from which the exhaust has dried out
  condenseDripFrom: 0.2, // condensation level from which water drips out of the tip
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

  // Spitting back through the carb: a lean, cold engine with the throttle snapped open
  spitBase: 0.8, // chance a snap spits back at full propensity (0 turns it off)
  spitLeanFrom: 0.05, // leanness below this never spits
  spitLeanFull: 0.35, // and this lean is as bad as it gets
  spitColdBelow: 0.7, // temperature (0..1) it has to be under; the colder, the likelier
  spitSnapStep: 0.4, // how far the throttle has to jump above its recent self to count as snapped
  spitSnapTo: 0.6, // and open at least this far
  spitFollow: 0.15, // seconds the recent throttle takes to catch up
  spitCooldown: 1.5, // seconds before it can spit again

  // Silencer off (a toolbox job)
  silencerPower: 0.08, // power gained with the silencer off
  silencerBlowPerMinute: 0.05, // two-strokes only: how much of the silencer's packing blows out per minute at full revs (a third of that idling)
  silencerBlownLoud: 0.6, // how loud a fully blown silencer is, as a share of one taken off
  silencerPop: 0.5, // overrun propensity added with it off (open pipe, so it crackles)

  // Run-on: switched off hot, worn or lean, it chugs on for a few beats
  runOnBase: 0, // chance of running on from a healthy, cool engine
  runOnHot: 0.55, // chance added by a fully heat-soaked engine
  runOnWear: 0.6, // by a fully worn one
  runOnLean: 0.5, // by running lean
  runOnCyclesMin: 3, // firings it runs on for, at the least
  runOnCyclesMax: 15, // and at the most (the worse it is, the longer)

  // Drowning it: a deep puddle taken too fast (see water.js)
  waterDepthFrom: 0.55, // puddle depth (0..1) under the wheels below which no water gets in (small puddles are shallower than this)
  waterSafeSpeed: 4, // m/s: slower than this it wades through without a drop
  waterFullSpeed: 10, // m/s at which it takes in the most
  waterGulpRate: 3.5, // water taken in per second at full depth and speed (a puddle is only about a quarter of a second long at speed)
  waterDeepRate: 1.4, // water taken in per second in the river's deep water, at any speed (it is deeper than the intake, so about half a second to stall it)
  waterDrainRunning: 0.03, // per second it drains while running (it blows out)
  waterDrainThrottle: 0.05, // extra per second with the throttle wide open
  waterDrainOff: 0.022, // per second it drains standing about, so about 45 s to clear
  waterRoughness: 0.9, // roughness added by a full load of water
  waterPowerLoss: 0.7, // power lost to it
  waterMisfire: 0.6, // extra chance of a misfire on each firing at full water
  waterStallAt: 0.75, // above this it may stall
  waterStallChance: 0.25, // chance of stalling on each firing once past that
  waterNoStart: 0.15, // wetter than this it won't catch (fades out to nothing at this level)

  // A diesel (the tractor): see compression.js
  compressionIgnition: false, // true: catches on glow plugs and compression rather than the mixture, the key doesn't stop it, a knob does
  injected: false, // true: petrol injection (Jess's Griffin): it meters what a cold engine needs itself, so no choke and no boiling carb
  coldIdleRpm: 0, // an injected engine's own fast idle, stone cold, falling away as it warms (the choke's lift on a carb)
  runsOnDiesel: false, // red diesel is its fuel, so it doesn't soak it up like a petrol engine
  keyStops: false, // a diesel whose key stops it (the UTV's), where the tractor's carries on until its knob is pulled
  petrolFussy: false, // a diesel that soaks up petrol the way the quads soak up diesel (the UTV's): the same soak numbers below, from the petrol share of the tank
  glowSeconds: 7, // seconds the glow plugs take to heat from cold, on a stone cold engine
  glowCoolSeconds: 14, // seconds they take to cool again
  glowWarmAbove: 0.6, // engine temperature above which it needs no glow at all
  glowColdCatch: 0.04, // fraction of its chance of catching that it keeps, cranked cold on unheated plugs
  // Red diesel in the tank (see diesel.js): it soaks the engine and only a drain at the toolbox clears it
  dieselPotency: 2.5, // soak aimed for per unit of diesel in the fuel (so 40% diesel is as bad as it gets)
  dieselSoakRate: 0.04, // per second the soak climbs toward that while running, so about 25 s to the worst
  dieselRoughness: 0.8, // roughness added by a full soak
  dieselPowerLoss: 0.6, // power lost to it
  dieselMisfire: 0.5, // extra chance of a misfire on each firing at full soak
  dieselStallAt: 0.5, // above this it may stall (past dieselNoStart, so a stalled one never restarts)
  dieselStallChance: 0.1, // chance of stalling on each firing once past that
  // Water in the fuel that got past the sediment bowl (see fuelWater.js): worse as there is more, gone when a drain and clean fuel clear it
  fuelWaterRoughness: 0.6, // roughness added by water at its worst
  fuelWaterPowerLoss: 0.5, // power lost to it
  fuelWaterMisfire: 0.45, // extra chance of a misfire on each firing at its worst
  fuelWaterStallAt: 0.45, // above this it may cut out
  fuelWaterStallChance: 0.08, // chance of cutting out on each firing once past that
  fuelWaterStartFrom: 0.5, // from here a start gets harder
  // Waxed diesel in a hard frost (see dieselWax.js): a diesel only; it clears as the fuel warms
  waxRoughness: 0.5, // roughness added by wax at its worst
  waxPowerLoss: 0.65, // power lost to it
  waxMisfire: 0.3, // extra chance of a misfire on each firing at its worst
  waxStallAt: 0.5, // above this it may starve and cut out
  waxStallChance: 0.1, // chance of cutting out on each firing once past that
  waxStartFrom: 0.35, // from here a start gets harder, and at full wax it will not catch at all
  dieselStartFrom: 0.15, // from here it starts to catch less
  dieselNoStart: 0.45, // soaked this far it won't catch at all

  // Fuel starvation, from the carburettor float bowl level (0..1)
  fuelStarveLevel: 0.65, // below this bowl level the mixture starts to go lean
  starveLean: 1.1, // how lean it goes as the bowl empties

  // Integration
  maxStep: 1 / 240,
  initialTemperature: 0,
};

export const ENGINE_PARAM_RANGES = {
  ...CHARGING_PARAM_RANGES,
  ...KNACK_RANGES,
  ...SLAP_RANGES,
  ...TIMING_PARAM_RANGES,
  strokes: [2, 4, 2],
  cylinders: [1, 8, 1],
  skipChance: [0, 1, 0.01],
  skipThrottle: [0, 1, 0.01],
  skipRpm: [500, 10000, 50],
  idleFoulRate: [0, 0.05, 0.0005],
  additiveFoulCut: [0, 1, 0.01],
  maxRpm: [2000, 12000, 100],
  redlineRpm: [1800, 11000, 100],
  idleRpmWarm: [300, 2500, 10],
  stallRpm: [200, 1200, 10],
  crankRpm: [100, 600, 10],
  batteryIgnitionDrain: [0, 0.02, 0.0001],
  batteryCrankDrain: [0, 0.1, 0.0005],
  chillChoke: [0, 2, 0.05],
  chillChokeFlow: [0, 1, 0.05],
  chillWarmUp: [0, 3, 0.05],
  chillBattery: [0, 4, 0.05],
  chillGlow: [0, 3, 0.05],
  batteryChargeRate: [0, 0.02, 0.0001],
  batteryWeakBelow: [0.1, 1, 0.01],
  batteryDeadBelow: [0, 0.6, 0.01],
  weakCrankFactor: [0.05, 1, 0.01],
  batteryDashOutBelow: [0, 0.3, 0.01],
  terminalsSlowFrom: [0, 0.9, 0.01],
  terminalsClickAt: [0.1, 1, 0.01],
  terminalsCrankFloor: [0.05, 1, 0.01],
  rollMinFraction: [0.01, 0.3, 0.01],
  rollFullFraction: [0.1, 1, 0.01],
  rollClutchMin: [0, 0.95, 0.05],
  rollCatchTwoStroke: [0, 1.5, 0.05],
  rollCatchFourStroke: [0, 1.5, 0.05],
  pullSeconds: [0.2, 3, 0.05],
  tickleAmount: [0, 1, 0.05],
  tickleRich: [0, 3, 0.1],
  tickleSeconds: [5, 120, 5],
  tickleRunFactor: [1, 20, 1],
  tickleFloodAbove: [0.5, 3, 0.1],
  tickleFoulRate: [0, 1, 0.01],
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
  coldIdleRpm: [0, 1500, 10],
  chokeEnrichment: [0, 2, 0.01],
  throttleChokeRelief: [0, 1, 0.01],
  richTolerance: [0, 1, 0.01],
  mixtureTrim: [-0.5, 0.5, 0.01],
  jet: [-3, 3, 1],
  borePower: [0, 0.5, 0.01],
  boreHeat: [0, 2, 0.05],
  boreWear: [0, 6, 0.1],
  boreJet: [0, 3, 0.1],
  coolantLeakRun: [0, 0.005, 0.00005],
  coolantParkedLeak: [0, 1, 0.05],
  coolantWeepSoak: [0, 1, 0.05],
  coolantLeakChance: [0, 1, 0.05],
  coolantLeakMin: [0, 3, 0.1],
  coolantLeakMax: [0, 3, 0.1],
  thermostatChance: [0, 1, 0.05],
  thermostatStickPerHour: [0, 2, 0.05],
  thermostatMin: [0, 1, 0.05],
  thermostatBlock: [0, 1, 0.05],
  thermostatFlushSeconds: [1, 30, 1],
  hotFrom: [0, 1, 0.05],
  hotPowerLoss: [0, 1, 0.05],
  hotRoughness: [0, 1, 0.05],
  hotStallAt: [0.5, 1, 0.01],
  hotRestartBelow: [0, 1, 0.05],
  coolantStartMin: [0, 1, 0.05],
  coolantStartMax: [0, 1, 0.05],
  coolantPuddleFrom: [0, 1, 0.01],
  coolantPuddleGrow: [0, 0.1, 0.001],
  coolantPuddleFade: [0, 0.05, 0.0005],
  coolantOkAt: [0, 1, 0.05],
  coolantEmptyAt: [0, 1, 0.05],
  coolantSteamBelow: [0, 1, 0.05],
  coolantSteamHeat: [0, 1, 0.05],
  coolantBoilHeat: [0, 1, 0.05],
  coolantBoilEffect: [0, 1, 0.05],
  coolantBoilLeft: [0, 0.3, 0.01],
  coolantBoilSteamSeconds: [1, 60, 1],
  jetRefCelsius: [0, 25, 0.5],
  jetPerDegree: [0, 0.4, 0.01],
  jetMixture: [0, 0.3, 0.005],
  jetLeanSafe: [0, 3, 0.1],
  jetLeanFull: [0.5, 5, 0.1],
  jetSeizeSeconds: [20, 600, 10],
  jetTrueWithin: [0, 1, 0.05],
  jetTrueFade: [0.1, 3, 0.05],
  jetPower: [0, 0.2, 0.005],
  jetRoughness: [0, 0.3, 0.005],
  airRefDamp: [0, 1, 0.05],
  airPerDegree: [0, 0.02, 0.0005],
  airPerDamp: [0, 0.3, 0.005],
  airPower: [0, 2, 0.05],
  airLean: [0, 1.5, 0.05],
  jetPerDamp: [0, 2, 0.05],
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
  wearColdBoost: [0, 10, 0.1],
  runInSeconds: [30, 1800, 30],
  runInIdleShare: [0, 1, 0.05],
  runInGentleRpm: [0.2, 0.95, 0.05],
  runInWearBoost: [0, 12, 0.5],
  runInScarPerMinute: [0, 0.1, 0.002],
  runInScarMax: [0, 0.3, 0.01],
  runInNoticeFrom: [0, 1, 0.05],
  wearColdBelow: [0.1, 1, 0.05],
  wearOverRevBoost: [0, 40, 0.5],
  designRpm: [0, 12000, 100],
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
  roughRevFade: [0, 1, 0.01],
  roughRevSmoothRpm: [1000, 10000, 50],
  pulseRpmKick: [0, 400, 5],
  oilGood: [0.005, 0.1, 0.001],
  oilRichFrom: [0, 0.2, 0.001],
  oilRichFull: [0.01, 0.3, 0.001],
  oilFourStrokeFrom: [0, 0.05, 0.001],
  oilFourStrokeFull: [0.005, 0.1, 0.001],
  sumpOkLevel: [0.02, 0.6, 0.01],
  sumpTickFrom: [0.05, 0.6, 0.01],
  sumpTickFull: [0.01, 0.4, 0.01],
  tickRoughness: [0, 0.5, 0.01],
  tickRate: [0, 30, 0.5],
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
  leakLean: [0, 1, 0.01],
  leakHunt: [0, 1, 0.01],
  leakHuntFrequency: [0.05, 3, 0.05],
  popLeak: [0, 3, 0.05],
  valveTightPowerLoss: [0, 1, 0.01],
  valveLoosePowerLoss: [0, 0.5, 0.01],
  valveTightHot: [0, 6, 0.1],
  clogRich: [0, 1, 0.01],
  carbIcePowerLoss: [0, 1, 0.01],
  clogPowerLoss: [0, 1, 0.01],
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
  steamFrom: [0, 1, 0.01],
  steamCooking: [0, 1, 0.01],
  steamWetFrom: [0, 1, 0.01],
  steamWet: [0, 1, 0.01],
  steamWetGround: [0, 1, 0.01],
  condenseAirBelow: [0, 25, 0.5],
  condenseAirFull: [-10, 15, 0.5],
  condenseWarmAt: [0.1, 1, 0.01],
  condenseDripFrom: [0, 1, 0.01],
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
  silencerBlowPerMinute: [0, 0.5, 0.005],
  silencerBlownLoud: [0, 1, 0.05],
  silencerPop: [0, 2, 0.01],
  popHeat: [0, 3, 0.05],
  spitBase: [0, 1, 0.05],
  spitLeanFrom: [0, 0.5, 0.01],
  spitLeanFull: [0.1, 1, 0.01],
  spitColdBelow: [0.1, 1, 0.05],
  spitSnapStep: [0.1, 1, 0.05],
  spitSnapTo: [0.2, 1, 0.05],
  spitFollow: [0.05, 0.5, 0.01],
  spitCooldown: [0, 10, 0.1],
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
  waterDeepRate: [0, 5, 0.1],
  waterDrainRunning: [0, 0.5, 0.005],
  waterDrainThrottle: [0, 0.5, 0.005],
  waterDrainOff: [0, 0.5, 0.002],
  waterRoughness: [0, 1, 0.01],
  waterPowerLoss: [0, 1, 0.01],
  waterMisfire: [0, 1, 0.01],
  waterStallAt: [0.1, 1, 0.01],
  waterStallChance: [0, 1, 0.01],
  waterNoStart: [0.02, 1, 0.01],
  glowSeconds: [1, 30, 0.5],
  glowCoolSeconds: [1, 60, 0.5],
  glowWarmAbove: [0.1, 1, 0.01],
  glowColdCatch: [0, 1, 0.01],
  dieselPotency: [0.5, 10, 0.1],
  dieselSoakRate: [0.002, 0.5, 0.002],
  dieselRoughness: [0, 1, 0.01],
  dieselPowerLoss: [0, 1, 0.01],
  dieselMisfire: [0, 1, 0.01],
  dieselStallAt: [0.1, 1, 0.01],
  dieselStallChance: [0, 1, 0.01],
  fuelWaterRoughness: [0, 1, 0.01],
  fuelWaterPowerLoss: [0, 1, 0.01],
  fuelWaterMisfire: [0, 1, 0.01],
  fuelWaterStallAt: [0.1, 1, 0.01],
  fuelWaterStallChance: [0, 1, 0.01],
  fuelWaterStartFrom: [0, 1, 0.01],
  waxRoughness: [0, 1, 0.01],
  waxPowerLoss: [0, 1, 0.01],
  waxMisfire: [0, 1, 0.01],
  waxStallAt: [0.1, 1, 0.01],
  waxStallChance: [0, 1, 0.01],
  waxStartFrom: [0, 1, 0.01],
  dieselStartFrom: [0, 1, 0.01],
  dieselNoStart: [0.05, 1, 0.01],
  fuelStarveLevel: [0.05, 1, 0.01],
  starveLean: [0, 3, 0.05],
};
