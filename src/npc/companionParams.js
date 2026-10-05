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
  probeDistance: 1.4, // how far ahead to look for obstacles
  standOffset: 1.15, // metres to the side of the quad when standing next to it
  mountDuration: 1.2, // seconds to climb on
  dismountDuration: 1.0,
  legSpread: 0.38, // radians each thigh swings out to straddle the seat
  seatRaise: 0.06, // metres, fine-tunes how high she sits on the pillion
  seatForward: 0.0, // metres, fine-tunes where she sits along the seat
  rideBounce: 1.0, // how much her upper body reacts to the bike's vibration
  maxMountSpeed: 0.3, // m/s, waits for the quad to stop before climbing on

  // Glancing at the player
  glanceEveryMin: 4, // seconds between glances
  glanceEveryMax: 11,
  glanceHoldMin: 1.5, // seconds she keeps looking
  glanceHoldMax: 3.5,
  glanceRange: 14, // metres; further than this she doesn't bother
  lookSpeed: 3, // 1/s, how fast her head turns in and out

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
  boredWhim: 0.6, // how much the odds of what she does next are reshuffled each time (log scale)
  wanderFarChance: 0.25, // a longer stroll, two and a half times as far
  boredMountChance: 0.3, // gets on a quad to wait (she stays on it)
  placedPatienceMin: 240, // seconds sat on the back where you put her (nobody riding) before she gives up and gets off
  placedPatienceMax: 420,
  boredGetOffChance: 0.6, // sat on the back by her own choice and bored of it, the chance she gets off (each time she gets bored)
  boredStartChance: 0.2, // has a go at starting one
  boredDriveChance: 0.25, // has a little drive on one; otherwise she wanders off for a look round
  wanderMin: 6, // metres
  wanderMax: 18,

  // Driving a quad herself (herDriving.js)
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
  driveForgetChokeChance: 0.45, // she pushes the choke off as she sets off, cold or not
  driveMaxStalls: 2, // stalls before she gives up on it
  driveBackChance: 0.4, // when she's done, the chance she moves onto the back to wait rather than getting off
  driveKeyOffChance: 0.05, // getting off after a drive, the chance she switches it off (she nearly always leaves it running)
  driveSeatRaise: 0.04, // metres, fine-tunes how high she sits on the front seat
  driveSeatForward: 0.0, // metres, fine-tunes where she sits along it
  followGap: 8, // metres behind you she likes to be, following you on another quad
  followMinGap: 4, // closer than this she stops
  followCatchUp: 0.6, // m/s faster per metre further back than that
  followMaxSpeed: 10, // m/s she'll go to keep up at middling confidence (careful slower, confident quicker)
  followMaxThrottle: 0.9,
  followScareSpeed: 15, // following, she minds speed much less
  followGiveUpMin: 30, // seconds after you've got off your quad before she stops following...
  followGiveUpMax: 90,
  followDriveOnChance: 0.35, // ...and then the chance she drives about on her own rather than stopping (more when confident)
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
  voiceWaitAfter: 25, // seconds of nothing happening before she gets bored
  takeOverAfterMin: 8, // left on a quad driving itself and hating it, seconds before she climbs forward to sort it out
  takeOverAfterMax: 18,
  takeOverDriveChance: 0.45, // and then the chance she drives it about herself rather than stopping it and getting off
  ghostFunChance: 0.4, // when you leave her on a quad driving itself: the chance she enjoys it rather than panics
  voiceShakeLevel: 0.95, // how hard the seat has to shake (about 0.6 at a warm idle, 1 to 2 cold) before she mentions it
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
  standOffset: [0.6, 3, 0.05],
  mountDuration: [0.2, 4, 0.05],
  dismountDuration: [0.2, 4, 0.05],
  legSpread: [0, 1, 0.01],
  seatRaise: [-0.3, 0.3, 0.005],
  seatForward: [-0.3, 0.3, 0.005],
  rideBounce: [0, 4, 0.05],
  maxMountSpeed: [0, 3, 0.05],
  glanceEveryMin: [0.5, 30, 0.5],
  glanceEveryMax: [0.5, 60, 0.5],
  glanceHoldMin: [0.2, 10, 0.1],
  glanceHoldMax: [0.2, 15, 0.1],
  glanceRange: [1, 50, 0.5],
  lookSpeed: [0.3, 10, 0.1],
  fidgetEveryMin: [0.5, 30, 0.5],
  fidgetEveryMax: [0.5, 60, 0.5],
  fidgetScale: [0, 3, 0.05],
  boredAfterMin: [5, 600, 1],
  boredSpread: [0, 1.5, 0.05],
  boredWaitFloor: [1, 120, 1],
  boredWaitCeiling: [10, 900, 5],
  restlessDrift: [0, 0.2, 0.005],
  boredWhim: [0, 2, 0.05],
  boredJoinChance: [0, 2, 0.05],
  wanderFarChance: [0, 1, 0.05],
  boredAfterMax: [5, 900, 1],
  boredMountChance: [0, 1, 0.05],
  placedPatienceMin: [10, 1800, 5],
  placedPatienceMax: [10, 3600, 5],
  boredGetOffChance: [0, 1, 0.05],
  boredStartChance: [0, 1, 0.05],
  boredDriveChance: [0, 1, 0.05],
  wanderMin: [1, 50, 0.5],
  wanderMax: [1, 80, 0.5],
  followGap: [2, 40, 0.5],
  followMinGap: [1, 20, 0.5],
  followCatchUp: [0, 3, 0.05],
  followMaxSpeed: [1, 25, 0.5],
  followMaxThrottle: [0.1, 1, 0.01],
  followScareSpeed: [2, 30, 0.5],
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
  driveForgetChokeChance: [0, 1, 0.05],
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
  voiceWaitAfter: [5, 120, 1],
  takeOverAfterMin: [1, 120, 1],
  takeOverAfterMax: [1, 240, 1],
  takeOverDriveChance: [0, 1, 0.05],
  ghostFunChance: [0, 1, 0.05],
  voiceShakeLevel: [0.1, 5, 0.05],
};
