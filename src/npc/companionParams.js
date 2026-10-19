export const DEFAULT_COMPANION_PARAMS = {
  outfit: 'farmPolo', // a key of OUTFITS in outfit.js
  height: 1.5, // metres, the model is scaled to this
  // Figure (figure.js), 0 = the model as shipped
  bust: 1.0, // fuller bust
  waist: 1.0, // narrower waist
  hips: 1.0, // wider hips
  walkSpeed: 1.3, // m/s
  walkAnimSpeed: 1.25, // m/s the walking clip looks right at, so its playback rate can match
  turnRate: 5, // 1/s
  arriveRadius: 0.18, // metres
  probeDistance: 2.2, // how far ahead to look for obstacles
  probeWidth: 0.4, // how far out either side of her middle the extra probes go, so she clears a corner
  avoidHold: 2, // seconds she keeps to a way round something before looking at the straight line again
  standOffset: 1.15, // metres to the side of the quad when standing next to it
  mountDuration: 1.8, // seconds to get on a quad: a leg over, or sat back onto it
  dismountDuration: 1.4,
  legSpread: 0.38, // radians each thigh swings out to straddle the seat
  seatRaise: 0.06, // metres, fine-tunes how high she sits on the pillion
  seatForward: 0.0, // metres, fine-tunes where she sits along the seat
  rackSeatRaise: 0.06, // metres, fine-tunes how high she sits on the front rack
  rackSeatForward: 0.0, // metres, fine-tunes where she sits along the front rack
  rackLegSpread: 0.3, // fraction of legSpread on the front rack, where she sits with her legs nearly together
  rideBounce: 1.0, // how much her upper body reacts to the bike's vibration
  maxMountSpeed: 0.3, // m/s, waits for the quad to stop before climbing on

  // Glancing at the player
  // What she looks at (attention.js): each thing is scored, she looks at the best, holds it, tires of it and comes back to it.
  attentionYou: 0.7, // how much you catch her eye close by...
  attentionFavour: 0.8, // ...and that much more again (times her warmth, 0..1) the more she likes you
  attentionFriend: 0.45, // the other girl
  attentionSpeaker: 0.6, // extra for whoever is talking
  attentionTalking: 3, // you talking to her: she looks at you and doesn't tire of it
  attentionVehicles: 0.6, // a moving vehicle at full interest...
  attentionVehicleSpeed: 4, // ...which is this fast (m/s) or more
  attentionEngines: 1, // how much engine noises catch her ear (a start, a stall, a backfire, revving)
  attentionFocus: 0.55, // what she's busy with (the quad she's starting, the road when driving), times the state's own weight
  attentionIntent: 2, // where she's about to walk, just before she sets off
  attentionIdle: 0.3, // gazing about at nothing in particular, when nothing else is worth more
  attentionGazeSpread: 0.9, // radians either side of ahead that she gazes about
  attentionMin: 0.12, // anything scoring less isn't worth turning her head for
  attentionDwell: 0.8, // seconds she holds a look before something only a little better takes it
  attentionSwitch: 0.3, // how much better (a fraction) something must be to take her eye after that
  attentionStartle: 1.2, // a sudden thing this strong turns her head at once
  attentionHabit: 3, // seconds of looking at one thing that halve her interest in it
  attentionRecover: 10, // seconds for that tiredness to fade once she looks away
  attentionFov: 1.1, // radians either side of ahead that she sees properly...
  attentionBehind: 0.1, // ...falling to this share of interest straight behind her (sounds she hears from anywhere)
  attentionRange: 30, // metres; people and moving vehicles further than this go unnoticed
  attentionBodyAfter: 1.5, // seconds a look past her shoulder is held before she turns to face it (stood about)
  attentionBodyYaw: 1.1, // radians off her facing that count as past her shoulder
  lookLead: 0.6, // seconds she looks where she's going before setting off from standing
  lookSweep: 7, // 1/s, how fast her eyes move from one thing to the next
  lookSpeed: 3, // 1/s, how fast her head turns in and out
  // How she reacts with her body (reactions.js): the chances and the size of it.
  radioKeen: 0.5, // how much she likes the radio on in a cab: above 0.5 she switches it on and turns it up, below she turns it down and off (radioTaste.js)
  reactEarsChance: 0.5, // revs right beside her: the chance she covers her ears
  reactStartleChance: 0.7, // a pheasant bursting out of the hedge near her: the chance she jumps
  reactCheerChance: 0.6, // someone landing a jump she can see: the chance she cheers
  forecastChat: 0.5, // reading the forecast board: the chance she mentions what it says early in the game
  reactWaveChance: 0.4, // someone going by on the lane or coming in at the gate: the chance she waves
  photoPose: 1, // when you raise the camera: how likely she is to pose nicely (against her face and palm weights)
  photoFace: 0.3, // ... to pull a face
  photoPalm: 0.2, // ... to put a hand up and tell you to put it away
  reactCheerArms: 0.7, // how she cheers: under 0.5 a clap, above it arms up (and how high)
  reactFlinch: 1, // how big her flinch is

  // Fidgeting while seated on the quad
  fidgetEveryMin: 3, // seconds between fidgets
  fidgetEveryMax: 8,
  fidgetScale: 1, // overall size of the movements

  // Doing things on her own when left standing about
  ownMind: true,
  boredAfterMin: 30, // seconds standing about before she does something: her usual wait is the middle of these...
  boredAfterMax: 90,
  boredSpread: 0.55, // ...spread widely either side of it (log scale: 0.55 puts two in three waits within 0.6 to 1.7 times it)
  boredWaitFloor: 12, // seconds, however restless
  boredWaitCeiling: 200,
  restlessDrift: 0.03, // how fast her restlessness (0.5 to 2, shortening the waits) wanders up and down
  boredJoinChance: 0.5, // her friend's about to set off on a quad: how much she fancies hopping on the back (weighed against the others)
  pairWeight: 1, // how keen she is to go and stand with her friend when she wants company (pair.js; weighed against the others)
  tagWeight: 1, // how keen she is to tag along when her friend sets off on foot for a look round, a sit or a cup of tea
  benchSlip: 0, // the chance, working at the bench on her own, that she makes a hash of it and hands it to you to finish
  dareWeight: 0, // how keen she is to dare you to something daft (dares.js)
  benchWeight: 0, // how keen she is to work on a quad at the barn bench on her own (girlBench.js)
  helmetWeight: 1, // how keen she is to fetch her helmet from the hooks (headgear.js)
  helmetLeave: 0.6, // the chance she takes it off again on getting off a vehicle
  helmetGround: 0.3, // and of those, that she drops it on the ground rather than leaving it on the seat
  helmetSize: 1, // her helmet's size against the tuning's fit: her hair stands out from her head more or less
  helmetRaise: 0, // metres her helmet sits above where it would, over her hair
  helmetNags: 0, // 1 if she tells you off for riding without one
  stormWont: 0, // 1 if she won't ride or drive in a thunderstorm (Jess would go out in it)
  carGoWeight: 0, // how keen she is to take her own car down the road and back (carGo.js)
  phoneWeight: 0, // how keen she is to wander off and take a call when her phone goes (phoneCalls.js)
  phoneMoodChance: 0.3, // the chance a call she takes is bad news and leaves her in a mood
  phoneMoodSeconds: 240, // how long that mood takes to lift
  generatorWeight: 0, // how keen she is to go and pull the generator's cord when the barn is dark or the charger is waiting on it (generatorStart.js)
  trailerGuideWeight: 0, // how keen she is to walk round behind the trailer and guide you back when you reverse it
  workLightWeight: 0, // how keen she is to bring a vehicle round to light what you're at in the dark without being asked (workLight.js)
  // What she wants (needs.js), each 0 met to 1 pressing, and how she chooses what to do about it (chooser.js).
  chooseWhim: 0.6, // how much the scores of what she might do are reshuffled each time she chooses (log scale)
  chooseMin: 0.5, // she only takes the best thing she could do if it scores at least this
  thinkEvery: 2, // seconds between her weighing up what to do, while she's free (a little more or less each time)
  needColdRise: 0.025, // warmth: per second at the day's full chill, outside
  needWetRise: 0.035, // and this much more per second when it's raining on her
  needWarmFall: 0.06, // per second warming up (hands over an engine, a running cab, the barn roof); a third of it on a mild day anyway
  needLonelyRise: 0.004, // company: per second with nobody within needLonelyRange
  needLonelyRange: 15, // metres
  needCompanyFall: 0.03, // per second with someone within needCloseRange (or riding with her)
  needCloseRange: 6, // metres
  needThrillRise: 0.002, // excitement: per second, all the time
  needThrillFall: 0.06, // per second at full thrill (going fast, a hard shake)
  needTireRise: 0.003, // rest: per second on the go
  needRestFall: 0.03, // per second sitting down
  needSleepRise: 0.0012, // sleepiness: per second, all the time (half as much again on the go); dozing is the only cure
  needSleepFall: 0.012, // per second dozing on the bales
  dozeWeight: 1, // how keen she is to doze on the bales when she's sleepy (dozing.js; weighed by the chooser like any offer)
  dozeMinds: 0, // 1 if being woken rudely costs you her favour and gets a sulk (Amy), 0 if she laughs it off (Jess)
  napProne: 1, // how readily she drops off on the back of a smooth ride (backNap.js): 1 is average, 0 never
  sleepySlowThink: 2, // when she's as sleepy as she gets she thinks this much more slowly (1 + this times her sleepiness)
  sleepyLazy: 0.6, // and anything but a doze is this much less attractive to her (1 - this times her sleepiness)
  paceHurry: 1.25, // times her walking speed hurrying (out of the rain, after her friend; intent.js), and she may jog
  paceBrisk: 1.1, // going briskly (off for a drive, a jump, to show off)
  paceDawdle: 0.7, // dawdling (off for a look round, to sit down)
  paceTired: 0.85, // times her speed when she's as tired as she gets
  paceExcited: 1.1, // and when she's as keyed up as she gets
  resumeFor: 120, // seconds she stays keen on something you stopped her on her way to
  resumeBoost: 1.8, // and how much keener
  planChance: 0.2, // the chance that taking up one thing she strings a second on after it and says so (plans.js)
  planMin: 0.2, // and the second must score at least this against what she still wants
  planFor: 150, // seconds she keeps a plan before dropping it
  memoryStrength: 1, // how hard what happened bears on her feeling for it (memory.js: bogged, tipped, won, lost)
  memoryMin: 0.5, // the warest she gets of something (times its weight)
  memoryMax: 1.6, // and the keenest
  memoryFade: 0.0005, // how fast a feeling eases back to nothing, a second (about 15 minutes for a bad bog)
  memoryLineAt: 0.2, // how far from 1 before she says so when she picks it
  memoryLineChance: 0.3, // and how often she does
  moodSeconds: 180, // how slowly her mood follows how her needs have been (mood.js): about this many seconds to settle
  moodBase: 0.2, // where it settles with nothing wanted
  moodUnease: 1.6, // how far pressing needs pull it down (cold and bored most)
  moodCompany: 0.15, // and being with someone lifts the level it settles at
  moodWarm: 0.15, // and so does warming up on a cold day
  moodThrillLift: 0.012, // per second at full thrill, a good ride lifts it straight away
  moodLowAt: -0.35, // below this she's in a low spell (short with you, slower, less keen)
  moodHighAt: 0.45, // above this a high one
  moodPace: 0.15, // times her walking speed at the extremes (1 plus or minus this)
  moodKeenLow: 0.7, // times how keen she is on anything not urgent, in the lowest mood
  moodKeenHigh: 1.15, // and in the highest
  moodRemarkGap: 240, // seconds between her remarking on a change in mood
  moodCurtChance: 0.6, // chance she answers you shortly when you ask her something in a low mood
  needBusyFall: 0.05, // something to do: per second it fades while she's busy (it builds at her boredom wait's pace while she stands about)
  wanderFarChance: 0.25, // a longer stroll, two and a half times as far
  boredRestChance: 0.35, // on a fine day, goes and sits on the bales or the fence (weighed against the others; only when there's a spot)
  boredMountChance: 0.3, // gets on a quad to wait (she stays on it)
  placedPatienceMin: 240, // seconds sat on the back where you put her (nobody riding) before she gives up and gets off
  placedPatienceMax: 420,
  boredGetOffWeight: 1, // sat on the back by her own choice, how keen she is to get off once she wants something to do (chooser.js)
  boredDoughnutChance: 0, // the chance, when bored, she takes a quad off and spins doughnuts in the field (Jess)
  boredJumpChance: 0, // the chance, when bored, she takes a quad off to jump the ramp in the field (jumps.js)
  boredShowOffChance: 0, // the chance, when bored and you're near, she takes a quad off to wheelie or skid past you (showOff.js)
  boredBuzzChance: 0, // the chance, when bored, she goes and sits on the back of a rough quad for the shake (Jess readily, Amy rarely)
  buzzWear: 0.3, // engine wear (0..1) from which a quad is rough enough for her to seek out
  boredLineUpChance: 0.1, // the chance, when bored, she moves the quads into a neat row in front of the barn (lineUp.js)
  lineUpCrookedChance: 0, // when she does, the chance it is just the one quad, parked crooked on purpose (Jess)
  nickChance: 0, // how much she is the sort to nick a quad you got off with the engine running (Jess), times nicking.js's chance
  parkSpeed: 2.2, // m/s she drives a quad into place at
  parkArriveRadius: 0.5, // metres from the slot she stops
  parkStageRadius: 1.8, // metres from the point in line with the slot that counts as reached
  boredStartChance: 0.2, // has a go at starting one
  boredDriveChance: 0.25, // has a little drive on one; otherwise she wanders off for a look round
  wanderMin: 6, // metres
  wanderMax: 18,

  // Driving a quad herself (herDriving.js)
  towHorizon: 1.8, // seconds ahead she brakes for steering a dead quad on the tow rope: longer is earlier, safer braking
  towDistractChance: 0.02, // chance each second she looks away from the rope for a moment, with no steering or braking
  driveConfidence: 0.5, // her usual confidence driving, 0 careful to 1 confident; a fright knocks it, a good go builds it
  driveMoodSwing: 0.35, // how much it varies from one go to the next
  driveSpeedMin: 2, // m/s she's happy at (4.5 to 8 mph) at middling confidence
  driveSpeedMax: 3.5,
  driveScareSpeed: 5.5, // m/s; faster than this and she's had enough
  driveMaxThrottle: 0.38, // the most throttle she'll give it
  driveThrottleBase: 0.18, // about where the clutch starts to bite
  driveThrottleGain: 0.05, // throttle per m/s under the speed she wants
  driveThrottleIntegral: 0.04, // and per m/s second, when it's not getting there
  driveBrakeMargin: 0.8, // m/s over before she brakes
  driveBrakeFirm: 0.25, // how hard she brakes pulling up (0..1); harder when she's scared
  driveJerk: 0.35, // how unsteady her throttle hand is
  driveSteerGain: 1.4, // steering per radian off course
  driveOverSteerRate: 0.15, // chance per second, in a turn, that she yanks the bars too far
  driveLoopRadiusMin: 5, // metres; her loop is a rough circle this size through where she starts
  driveLoopRadiusMax: 9,
  driveWaypointsMin: 4,
  driveWaypointsMax: 6,
  driveArriveRadius: 2.2,
  driveCornerAccel: 3.5, // m/s2 she's happy to corner at (more when confident); she slows and eases the bars to keep to it
  drivePauseChance: 0.3, // at each waypoint, the chance she brakes to a stop for a moment
  drivePauseMin: 1.5, // seconds
  drivePauseMax: 4,
  driveSettleMin: 1.5, // seconds letting it tick over before she sets off
  driveSettleMax: 4,
  driveForMin: 45, // seconds of driving before she's had enough
  driveForMax: 85,
  driveScaredChance: 0.4, // she stops because she's scared rather than bored
  faultNoticeFrom: 0.3, // how bad a developing fault (puncture, slipping belt, sticking cable, dirty carb) has to be before she notices it
  diagnoseAccuracy: 0.9, // how often her guess at what's wrong with a running quad is right
  diagnoseChance: 0.03, // per second stood by a running quad, that she says what she thinks is wrong with it
  diagnoseColdBelow: 0.35, // engine temperature (0 cold, 1 warm) under which it sounds cold
  diagnoseRichFrom: 0.2, // how rich the mixture has to be before it sounds rich
  diagnoseFoulFrom: 0.35, // how fouled the plug has to be before it sounds like it
  thrashColdBelow: 0.4, // engine temperature (0 cold, 1 warm) under which hard riding counts as thrashing it
  thrashWork: 0.6, // how hard it's working (0..1) before she calls it thrashing
  parkBrakeChance: 0.9, // getting off a quad she was driving, the chance she pulls the parking brake on (an empty quad only holds on a slope if she does)
  remembers4wd: 0.4, // taking the wheel of a quad with a 2WD / 4WD switch left in 2WD, the chance she remembers to put it in 4WD (else she finds out in the mud)
  rockPrankWeight: 0, // how keen she is to reach over and blip the quad her friend is sat on running, stood next to it (0: never; chooser.js)
  rockPrankRange: 3.5, // metres from that quad she has to be
  thrashChance: 0.15, // per second she can see a quad being thrashed cold, that she says something
  blameWearFrom: 0.15, // wear a quad needs before she says who's worn it out
  blameChance: 0.02, // per second stood by a worn quad, that she says who did it
  leftRunningChance: 0.05, // per second stood by a quad left running, that she says who left it
  leftRunningRange: 8, // metres: how near she has to be to take notice of it
  blownNoticeAt: 0.4, // how blown out a running two-stroke's silencer packing has to be before she says it's getting loud (Amy notices first)
  dripSmellChance: 0.15, // per second stood by a quad with a dripping carb, that she says she can smell petrol
  recoilSpeed: 3.2, // m/s she jumps back from a boil-over, easing off over recoilSeconds
  recoilSeconds: 0.5, // how long the jump back takes
  coolantSeeRange: 6, // metres: how near she has to be to notice a damp patch under the orange, or steam off it
  spitHearRange: 12, // metres: how near she has to be to react to a quad spitting back through its carb
  spitSayChance: 0.6, // the chance she says something about one she only heard
  coolantJumpRange: 7, // metres: how near she has to be to a boil-over to jump back from it
  dripSmellRange: 4, // metres: how near she has to be to smell it
  joyRise: 0.15, // per second her mood follows more of the quads running...
  joyFall: 0.05, // ...and fewer
  sadOnStall: 0.4, // how much a stall she saw dampens her (0..1)...
  sadOnStallRiding: 0.8, // ...or one under her
  sadFade: 0.012, // per second she gets over it
  stallConfidenceKnock: 0.04, // what a stall under her does to her driving confidence
  startUrge: 1.5, // extra keenness to start a quad that's off, when none are running (the bored 'start' weight is times 1 plus this times the share not running)
  keyOffCut: 0.8, // how far her happiness at a running quad cuts the chance she switches an idling one off
  likeRunningChance: 0.08, // per second near a running quad, with most going, that she says she likes it
  wishRunningChance: 0.04, // the same, with most of them off, wishing they were all going
  buzzFrom: 0.5, // body-shake level at which the seat feels good to her
  buzzCap: 2, // the most shake that counts, so a rattling quad isn't worth unlimited
  buzzSaysAfter: 25, // shake-seconds on a quad before she says she loves it
  buzzSwitchLead: 40, // shake-seconds one quad must lead her favourite by to take over as her favourite
  sideSaddleChance: 0.35, // each time she gets on the back, that she sits side-saddle
  sideSaddleTurn: 1.0, // radians her hips turn towards the side her legs hang
  sideSaddleTwist: 0.8, // fraction of that turn her back twists back to face forward
  exhaustSideChance: 0, // getting off a quad, that she swings off the exhaust side when the other is free (Amy never does)
  burnFrom: 0.35, // pipe heat (0..1) under which a leg against it doesn't hurt
  burnChance: 0, // that her leg catches the hot pipe when she does get off that side (Amy holds her leg clear)
  slipMinSpeed: 3, // m/s under which she can't slip
  slipLateral: 5, // m/s^2 of sideways push she takes before she starts to slide, side-saddle with nothing to hold
  slipBump: 25, // m/s^2 up a bump or landing she takes the same way
  slipBackedOff: 0.5, // how much of a push counts when it's the way she has the seat behind her
  slipHoldingGrip: 1.6, // times the limits when her arms are round you
  slipRate: 0.8, // per second, per unit over the limit, that she slides
  slipRecover: 0.5, // per second she gets herself back
  slipWobbleAt: 0.5, // slip at which she yelps
  quirkChance: 0.04, // per second stood by a quad she knows a quirk of (three times that as you get on it), that she warns you of it
  historyChance: 0.02, // per second stood by a quad, that she brings up something she knows of its history (who had it, a fault, tinkering)
  diagnoseWearFrom: 0.2, // how worn the engine has to be before it sounds tired
  startPullWhenFlat: 0, // chance that on a flat battery she has a go at the pull-start (two-strokes) instead of giving up
  driveForgetChokeChance: 0.45, // she pushes the choke off as she sets off, cold or not
  raceGridRadius: 3.5, // metres from the grid point at which she counts as on it, in a race (wider than a waypoint, so she doesn't circle it)
  keepRidingAfter: 0.3, // chance she carries on driving when doughnuts, the ramp, showing off or a convoy is over, instead of pulling up and getting off
  raceGridYaw: 0.6, // radians off the track's direction she may be pointing on the grid before she goes round again to face it
  backOffsToGiveUp: 5, // backing off the same thing this many times in a row and she gives up and gets off
  backOffRadius: 6, // metres: backing off again within this of the last time counts as the same spot
  backOffLonger: 0.5, // each time she backs off the same thing she reverses this much longer again (0.5: half as long again)
  backOffLook: 6, // metres: how far she looks to either side to see which way the nose should swing as she backs away
  backOffWithin: 25, // seconds: and within this long of it
  driveMaxStalls: 2, // stalls before she gives up on it
  driveBackChance: 0.4, // when she's done, the chance she moves onto the back to wait rather than getting off
  driveKeyOffChance: 0.05, // getting off after a drive, the chance she switches it off (she nearly always leaves it running)
  driveSeatRaise: 0.04, // metres, fine-tunes how high she sits on the front seat
  driveSeatForward: 0.0, // metres, fine-tunes where she sits along it
  followGap: 8, // metres behind you she likes to be, following you on another quad
  followMinGap: 4, // closer than this she stops
  followSmokeGap: 1.8, // her gap behind a two-stroke, as a multiple of followGap (Amy hates the smoke; Jess is under 1)
  followDustGap: 2.2, // her gap behind a quad throwing up dust, as a multiple of followGap (Amy drops well back; Jess is under 1)
  followDustLevel: 0.25, // how thick (0..1) the lead's dust has to be before she minds
  dustCoughWithin: 12, // metres: closer than this behind a dusty quad she coughs (the voice spaces it out)
  followCatchUp: 0.6, // m/s faster per metre further back than that
  followMaxSpeed: 10, // m/s she'll go to keep up at middling confidence (careful slower, confident quicker)
  followMaxThrottle: 0.9,
  followScareSpeed: 15, // following, she minds speed much less
  followGiveUpMin: 30, // seconds after you've got off your quad before she stops following...
  followGiveUpMax: 90,
  followDriveOnChance: 0.35, // ...and then the chance she drives about on her own rather than stopping (more when confident)
  overtakeChance: 0, // per second, once she's been stuck behind a slow pace long enough: the chance she overtakes you out of impatience (Jess)
  overtakeAfter: 20, // seconds behind a pace under overtakeBelow before she's impatient
  overtakeBelow: 6, // m/s: a pace she finds too slow to follow
  overtakeSpeedUp: 4, // m/s faster than whoever she's passing
  overtakeAhead: 12, // metres ahead of them she goes to before she stops and waits
  overtakeGloatRange: 10, // metres: when they get this close she looks pleased with herself
  overtakeWait: 30, // seconds she waits ahead at the most
  followFarGap: 45, // metres; further behind than this and she shouts after you
  friendRideMin: 90, // seconds she drives her friend about, once she's on the back...
  friendRideMax: 200, // ...then they both get off
  rideLoopScale: 2.5, // giving you a ride, her loops are this much bigger
  offerRideWaitMin: 6, // seconds you've sat on the back of a parked quad before a girl offers to drive you...
  offerRideWaitMax: 25,
  offerRideRestMin: 45, // ...and after a ride, how long before anyone offers again
  offerRideRestMax: 120,
  offerRideForMin: 60, // seconds she drives you about before she's bored and gets off, unasked...
  offerRideForMax: 150,
  offerRideGiveUp: 25, // ...and how long she waits for you to be on the back before giving up
  driveTalkRange: 14, // metres; you can talk to her from this far while she's driving

  askOffAfterMin: 120, // seconds on the back before she asks if she can get off (or, riding, if you can stop soon)
  askOffAfterMax: 240,
  askOffAgainMin: 60, // and between asks if you don't answer
  askOffAgainMax: 150,
  keyOffChance: 0.05, // sat on the back of a quad left running, the chance she switches it off this time (rarely)
  keyOffAfterMin: 60, // and how long she sits there first, seconds
  keyOffAfterMax: 180,

  // Talking (companionVoice.js, lines in voiceLines.js)
  voice: true, // she talks at all
  captions: true, // show what she says on screen
  chattiness: 1, // 2 talks about twice as often, 0 only answers you
  voiceMinGap: 7, // seconds of quiet after she speaks before she'll speak unprompted
  voiceVolume: 1, // spoken lines
  voiceSoundVolume: 1, // sighs, hums, laughs
  speechRate: 1.0, // browser speech only, for lines not yet recorded
  speechPitch: 1.05, // browser speech only
  voiceRange: 25, // metres; further away you can't hear her (twice that for a shout)
  voiceRaisePerMetre: 0.12, // she speaks up the further away you are: this much louder per metre beyond 4 m
  voiceRaiseMax: 2.5, // up to this many times louder
  shoutGain: 1.6, // shouted lines (voiceLines.js `shout: true`) are this much louder again, and fade less with distance
  voiceFastSpeed: 13, // m/s riding pillion before she tells you to slow down (about 29 mph)
  voiceRoughAccel: 9, // m/s^2 of vertical jolting before she complains it's rough
  voiceHardBrakeDecel: 6, // m/s^2 of slowing on the back that counts as braking hard...
  voiceHardBrakeTime: 0.4, // ...kept up this many seconds...
  voiceHardBrakeShed: 2.5, // ...and this many m/s lost, so a quick dab isn't one
  voiceHardBrakeMinSpeed: 4, // m/s it has to start from
  voiceSteepUpY: 0.88, // on the back, the quad's up vector this far from upright (about 28 degrees) and she says it's too steep
  voiceWaitAfter: 25, // seconds of nothing happening before she gets bored
  takeOverAfterMin: 8, // left on a quad driving itself and hating it, seconds before she climbs forward to sort it out
  takeOverAfterMax: 18,
  takeOverDriveChance: 0.45, // and then the chance she drives it about herself rather than stopping it and getting off
  ghostFunChance: 0.4, // when you leave her on a quad driving itself: the chance she enjoys it rather than panics
  voiceShakeLevel: 0.95, // how hard the seat has to shake (about 0.6 at a warm idle, 1 to 2 cold) before she mentions it
  voiceWobbleRef: 0.006, // metres of seat heave that make a hard shake for her voice (a warm idle is about 0.002 to 0.004)
  voiceWobbleCents: 45, // pitch swing of her voice at that shake, in cents (100 is a semitone)
  voiceWobbleLevel: 0.22, // and the swing in its loudness, as a share of the volume
  voiceWobbleDepth: 1, // how much she lets it through: 1 is just the seat, Jess plays it up on purpose, 0 is off
};

export const COMPANION_PARAM_RANGES = {
  height: [1.4, 1.95, 0.01],
  bust: [0, 2, 0.05],
  waist: [0, 2, 0.05],
  hips: [0, 2, 0.05],
  walkSpeed: [0.3, 3, 0.05],
  walkAnimSpeed: [0.3, 3, 0.05],
  turnRate: [0.5, 20, 0.1],
  arriveRadius: [0.05, 1, 0.01],
  probeDistance: [0.3, 4, 0.05],
  probeWidth: [0, 1, 0.05],
  avoidHold: [0, 6, 0.1],
  standOffset: [0.6, 3, 0.05],
  mountDuration: [0.2, 4, 0.05],
  dismountDuration: [0.2, 4, 0.05],
  legSpread: [0, 1, 0.01],
  seatRaise: [-0.3, 0.3, 0.005],
  seatForward: [-0.3, 0.3, 0.005],
  rackSeatRaise: [-0.3, 0.3, 0.005],
  rackSeatForward: [-0.3, 0.3, 0.005],
  rackLegSpread: [0, 1, 0.01],
  rideBounce: [0, 4, 0.05],
  maxMountSpeed: [0, 3, 0.05],
  attentionYou: [0, 3, 0.05],
  attentionFavour: [0, 3, 0.05],
  attentionFriend: [0, 3, 0.05],
  attentionSpeaker: [0, 3, 0.05],
  attentionTalking: [0, 6, 0.1],
  attentionVehicles: [0, 3, 0.05],
  attentionVehicleSpeed: [0.5, 15, 0.5],
  attentionEngines: [0, 3, 0.05],
  attentionFocus: [0, 3, 0.05],
  attentionIntent: [0, 6, 0.1],
  attentionIdle: [0, 2, 0.05],
  attentionGazeSpread: [0, 1.6, 0.05],
  attentionMin: [0, 1, 0.01],
  attentionDwell: [0, 4, 0.05],
  attentionSwitch: [0, 2, 0.05],
  attentionStartle: [0.2, 4, 0.05],
  attentionHabit: [0.5, 20, 0.5],
  attentionRecover: [1, 60, 1],
  attentionFov: [0.3, 3, 0.05],
  attentionBehind: [0, 1, 0.05],
  attentionRange: [5, 80, 1],
  attentionBodyAfter: [0.2, 6, 0.1],
  attentionBodyYaw: [0.3, 3, 0.05],
  lookLead: [0, 2, 0.05],
  lookSweep: [0.5, 20, 0.5],
  lookSpeed: [0.3, 10, 0.1],
  radioKeen: [0, 1, 0.05],
  reactEarsChance: [0, 1, 0.05],
  reactStartleChance: [0, 1, 0.05],
  reactCheerChance: [0, 1, 0.05],
  forecastChat: [0, 1, 0.05],
  reactWaveChance: [0, 1, 0.05],
  photoPose: [0, 2, 0.05],
  photoFace: [0, 2, 0.05],
  photoPalm: [0, 2, 0.05],
  reactCheerArms: [0, 1, 0.05],
  reactFlinch: [0, 2, 0.05],
  fidgetEveryMin: [0.5, 30, 0.5],
  fidgetEveryMax: [0.5, 60, 0.5],
  fidgetScale: [0, 3, 0.05],
  boredAfterMin: [5, 600, 1],
  boredSpread: [0, 1.5, 0.05],
  boredWaitFloor: [1, 120, 1],
  boredWaitCeiling: [10, 900, 5],
  restlessDrift: [0, 0.2, 0.005],
  chooseWhim: [0, 2, 0.05],
  chooseMin: [0, 2, 0.01],
  thinkEvery: [0.2, 10, 0.1],
  needColdRise: [0, 0.2, 0.001],
  needWetRise: [0, 0.2, 0.001],
  needWarmFall: [0, 0.5, 0.005],
  needLonelyRise: [0, 0.05, 0.0005],
  needLonelyRange: [3, 60, 1],
  memoryStrength: [0, 3, 0.05],
  memoryMin: [0.1, 1, 0.05],
  memoryMax: [1, 3, 0.05],
  memoryFade: [0, 0.01, 0.0001],
  memoryLineAt: [0.05, 0.6, 0.05],
  memoryLineChance: [0, 1, 0.05],
  needCompanyFall: [0, 0.3, 0.005],
  needCloseRange: [1, 20, 0.5],
  needThrillRise: [0, 0.05, 0.0005],
  needThrillFall: [0, 0.5, 0.005],
  needTireRise: [0, 0.05, 0.0005],
  needRestFall: [0, 0.3, 0.005],
  needSleepRise: [0, 0.01, 0.0001],
  needSleepFall: [0, 0.1, 0.001],
  dozeWeight: [0, 3, 0.05],
  dozeMinds: [0, 1, 1],
  napProne: [0, 3, 0.05],
  sleepySlowThink: [0, 6, 0.1],
  sleepyLazy: [0, 1, 0.05],
  paceHurry: [1, 2, 0.05],
  paceBrisk: [1, 2, 0.05],
  paceDawdle: [0.3, 1, 0.05],
  paceTired: [0.3, 1, 0.05],
  paceExcited: [1, 2, 0.05],
  resumeFor: [0, 600, 10],
  resumeBoost: [1, 5, 0.1],
  planChance: [0, 1, 0.05],
  planMin: [0, 1, 0.05],
  planFor: [10, 600, 10],
  moodSeconds: [10, 900, 10],
  moodBase: [-0.5, 1, 0.05],
  moodUnease: [0, 3, 0.05],
  moodCompany: [0, 0.5, 0.01],
  moodWarm: [0, 0.5, 0.01],
  moodThrillLift: [0, 0.1, 0.001],
  moodLowAt: [-1, 0, 0.05],
  moodHighAt: [0, 1, 0.05],
  moodPace: [0, 0.4, 0.01],
  moodKeenLow: [0.2, 1, 0.05],
  moodKeenHigh: [1, 2, 0.05],
  moodRemarkGap: [0, 900, 10],
  moodCurtChance: [0, 1, 0.05],
  needBusyFall: [0, 0.5, 0.005],
  boredJoinChance: [0, 2, 0.05],
  pairWeight: [0, 3, 0.05],
  tagWeight: [0, 3, 0.05],
  benchSlip: [0, 1, 0.05],
  dareWeight: [0, 3, 0.05],
  benchWeight: [0, 3, 0.05],
  helmetWeight: [0, 3, 0.05],
  helmetLeave: [0, 1, 0.05],
  helmetGround: [0, 1, 0.05],
  helmetSize: [0.7, 1.6, 0.05],
  helmetRaise: [-0.05, 0.08, 0.005],
  helmetNags: [0, 1, 1],
  stormWont: [0, 1, 1],
  carGoWeight: [0, 3, 0.05],
  phoneWeight: [0, 3, 0.05],
  phoneMoodChance: [0, 1, 0.05],
  phoneMoodSeconds: [10, 900, 10],
  generatorWeight: [0, 3, 0.05],
  trailerGuideWeight: [0, 3, 0.05],
  workLightWeight: [0, 3, 0.05],
  wanderFarChance: [0, 1, 0.05],
  boredAfterMax: [5, 900, 1],
  boredRestChance: [0, 2, 0.05],
  boredMountChance: [0, 1, 0.05],
  placedPatienceMin: [10, 1800, 5],
  placedPatienceMax: [10, 3600, 5],
  boredGetOffWeight: [0, 3, 0.05],
  boredDoughnutChance: [0, 1, 0.05],
  boredJumpChance: [0, 1, 0.05],
  boredShowOffChance: [0, 1, 0.05],
  boredBuzzChance: [0, 1, 0.01],
  buzzWear: [0, 1, 0.05],
  boredLineUpChance: [0, 1, 0.05],
  lineUpCrookedChance: [0, 1, 0.05],
  nickChance: [0, 1, 0.05],
  parkSpeed: [0.5, 5, 0.1],
  parkArriveRadius: [0.2, 2, 0.1],
  parkStageRadius: [0.5, 4, 0.1],
  boredStartChance: [0, 1, 0.05],
  boredDriveChance: [0, 1, 0.05],
  wanderMin: [1, 50, 0.5],
  wanderMax: [1, 80, 0.5],
  followGap: [2, 40, 0.5],
  followMinGap: [1, 20, 0.5],
  followSmokeGap: [0.3, 4, 0.05],
  followDustGap: [0.3, 4, 0.05],
  followDustLevel: [0, 1, 0.05],
  dustCoughWithin: [0, 40, 0.5],
  followCatchUp: [0, 3, 0.05],
  followMaxSpeed: [1, 25, 0.5],
  followMaxThrottle: [0.1, 1, 0.01],
  followScareSpeed: [2, 30, 0.5],
  overtakeChance: [0, 1, 0.01],
  overtakeAfter: [1, 120, 1],
  overtakeBelow: [1, 20, 0.5],
  overtakeSpeedUp: [0.5, 15, 0.5],
  overtakeAhead: [4, 50, 1],
  overtakeGloatRange: [3, 40, 1],
  overtakeWait: [3, 120, 1],
  followFarGap: [5, 200, 1],
  followGiveUpMin: [5, 600, 5],
  friendRideMin: [10, 900, 5],
  friendRideMax: [10, 1200, 5],
  followGiveUpMax: [5, 900, 5],
  followDriveOnChance: [0, 1, 0.05],
  rideLoopScale: [1, 6, 0.1],
  offerRideWaitMin: [1, 120, 1],
  offerRideWaitMax: [1, 180, 1],
  offerRideRestMin: [5, 600, 5],
  offerRideRestMax: [5, 900, 5],
  offerRideForMin: [10, 600, 5],
  offerRideForMax: [10, 900, 5],
  offerRideGiveUp: [5, 120, 1],
  towHorizon: [0.3, 5, 0.1],
  towDistractChance: [0, 0.3, 0.005],
  driveConfidence: [0, 1, 0.01],
  driveMoodSwing: [0, 1, 0.01],
  driveSpeedMin: [0.5, 8, 0.1],
  driveSpeedMax: [0.5, 10, 0.1],
  driveScareSpeed: [1, 15, 0.1],
  driveMaxThrottle: [0.05, 1, 0.01],
  driveThrottleBase: [0, 0.5, 0.01],
  driveThrottleGain: [0, 1, 0.01],
  driveThrottleIntegral: [0, 0.5, 0.005],
  driveBrakeMargin: [0, 3, 0.05],
  driveBrakeFirm: [0.05, 1, 0.01],
  driveJerk: [0, 1, 0.01],
  driveSteerGain: [0.2, 5, 0.05],
  driveOverSteerRate: [0, 2, 0.01],
  driveLoopRadiusMin: [3, 30, 0.5],
  driveLoopRadiusMax: [3, 40, 0.5],
  driveWaypointsMin: [2, 10, 1],
  driveWaypointsMax: [2, 12, 1],
  driveArriveRadius: [0.5, 6, 0.1],
  driveCornerAccel: [1, 10, 0.1],
  drivePauseChance: [0, 1, 0.05],
  drivePauseMin: [0, 15, 0.5],
  drivePauseMax: [0, 20, 0.5],
  driveSettleMin: [0, 15, 0.5],
  driveSettleMax: [0, 20, 0.5],
  driveForMin: [5, 300, 1],
  driveForMax: [5, 400, 1],
  driveScaredChance: [0, 1, 0.05],
  faultNoticeFrom: [0, 1, 0.05],
  diagnoseAccuracy: [0, 1, 0.05],
  diagnoseChance: [0, 0.3, 0.005],
  diagnoseColdBelow: [0, 1, 0.05],
  diagnoseRichFrom: [0, 0.9, 0.05],
  diagnoseFoulFrom: [0, 0.9, 0.05],
  diagnoseWearFrom: [0, 0.9, 0.05],
  thrashColdBelow: [0, 1, 0.05],
  thrashWork: [0, 1, 0.05],
  parkBrakeChance: [0, 1, 0.05],
  remembers4wd: [0, 1, 0.05],
  rockPrankWeight: [0, 3, 0.05],
  rockPrankRange: [1, 10, 0.5],
  thrashChance: [0, 1, 0.01],
  blameWearFrom: [0, 0.9, 0.05],
  blameChance: [0, 0.3, 0.005],
  leftRunningChance: [0, 0.5, 0.01],
  leftRunningRange: [2, 30, 1],
  blownNoticeAt: [0, 1, 0.05],
  dripSmellChance: [0, 1, 0.01],
  recoilSpeed: [0, 8, 0.1],
  recoilSeconds: [0.1, 2, 0.05],
  coolantSeeRange: [1, 15, 0.5],
  spitHearRange: [2, 30, 1],
  spitSayChance: [0, 1, 0.05],
  coolantJumpRange: [1, 15, 0.5],
  dripSmellRange: [1, 15, 0.5],
  joyRise: [0, 1, 0.01],
  joyFall: [0, 1, 0.01],
  sadOnStall: [0, 1, 0.05],
  sadOnStallRiding: [0, 1, 0.05],
  sadFade: [0, 0.2, 0.002],
  stallConfidenceKnock: [0, 0.3, 0.01],
  startUrge: [0, 5, 0.1],
  keyOffCut: [0, 1, 0.05],
  likeRunningChance: [0, 0.5, 0.01],
  wishRunningChance: [0, 0.5, 0.01],
  buzzFrom: [0, 2, 0.05],
  buzzCap: [0.5, 5, 0.1],
  buzzSaysAfter: [0, 300, 5],
  buzzSwitchLead: [0, 600, 10],
  sideSaddleChance: [0, 1, 0.05],
  sideSaddleTurn: [0, 1.5, 0.05],
  sideSaddleTwist: [0, 1, 0.05],
  exhaustSideChance: [0, 1, 0.05],
  burnFrom: [0, 1, 0.05],
  burnChance: [0, 1, 0.05],
  slipMinSpeed: [0, 15, 0.5],
  slipLateral: [1, 20, 0.5],
  slipBump: [5, 80, 1],
  slipBackedOff: [0, 1, 0.05],
  slipHoldingGrip: [1, 4, 0.1],
  slipRate: [0.05, 5, 0.05],
  slipRecover: [0, 3, 0.05],
  slipWobbleAt: [0.1, 0.95, 0.05],
  quirkChance: [0, 0.5, 0.005],
  historyChance: [0, 0.3, 0.005],
  startPullWhenFlat: [0, 1, 0.05],
  driveForgetChokeChance: [0, 1, 0.05],
  raceGridRadius: [1, 10, 0.5],
  keepRidingAfter: [0, 1, 0.05],
  raceGridYaw: [0.1, 1.5, 0.05],
  backOffsToGiveUp: [2, 12, 1],
  backOffRadius: [1, 20, 0.5],
  backOffWithin: [5, 120, 1],
  backOffLonger: [0, 2, 0.1],
  backOffLook: [2, 15, 0.5],
  driveMaxStalls: [0, 6, 1],
  driveBackChance: [0, 1, 0.05],
  driveKeyOffChance: [0, 1, 0.05],
  driveSeatRaise: [-0.3, 0.3, 0.005],
  driveSeatForward: [-0.3, 0.3, 0.005],
  driveTalkRange: [2, 40, 0.5],
  askOffAfterMin: [5, 900, 1],
  askOffAfterMax: [5, 1200, 1],
  askOffAgainMin: [5, 900, 1],
  askOffAgainMax: [5, 1200, 1],
  keyOffChance: [0, 1, 0.01],
  keyOffAfterMin: [1, 600, 1],
  keyOffAfterMax: [1, 900, 1],
  chattiness: [0, 3, 0.05],
  voiceMinGap: [0, 30, 0.5],
  voiceVolume: [0, 1, 0.01],
  voiceSoundVolume: [0, 2, 0.01],
  speechRate: [0.5, 2, 0.01],
  speechPitch: [0, 2, 0.01],
  voiceRange: [2, 100, 1],
  voiceRaisePerMetre: [0, 1, 0.01],
  voiceRaiseMax: [1, 6, 0.05],
  shoutGain: [1, 4, 0.05],
  voiceFastSpeed: [3, 25, 0.5],
  voiceRoughAccel: [1, 40, 0.5],
  voiceHardBrakeDecel: [1, 20, 0.5],
  voiceHardBrakeTime: [0, 2, 0.05],
  voiceHardBrakeShed: [0, 10, 0.25],
  voiceHardBrakeMinSpeed: [0, 15, 0.5],
  voiceSteepUpY: [0.6, 1, 0.01],
  voiceWaitAfter: [5, 120, 1],
  takeOverAfterMin: [1, 120, 1],
  takeOverAfterMax: [1, 240, 1],
  takeOverDriveChance: [0, 1, 0.05],
  ghostFunChance: [0, 1, 0.05],
  voiceShakeLevel: [0.1, 5, 0.05],
  voiceWobbleRef: [0.001, 0.02, 0.001],
  voiceWobbleCents: [0, 200, 1],
  voiceWobbleLevel: [0, 0.8, 0.01],
  voiceWobbleDepth: [0, 4, 0.05],
};
