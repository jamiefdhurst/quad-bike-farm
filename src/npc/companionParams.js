export const DEFAULT_COMPANION_PARAMS = {
  outfit: 'farmPolo', // a key of OUTFITS in outfit.js
  height: 1.5, // metres, the model is scaled to this
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

  // Talking (companionVoice.js, lines in voiceLines.js)
  voice: true, // she talks at all
  captions: true, // show what she says on screen
  chattiness: 1, // 2 talks about twice as often, 0 only answers you
  voiceMinGap: 7, // seconds of quiet after she speaks before she'll speak unprompted
  voiceVolume: 1, // spoken lines
  voiceSoundVolume: 1, // sighs, hums, laughs
  speechRate: 1.0, // browser speech only, for lines not yet recorded
  speechPitch: 1.05, // browser speech only
  voiceRange: 25, // metres; further away you can't hear her
  voiceFastSpeed: 13, // m/s riding pillion before she tells you to slow down (about 29 mph)
  voiceRoughAccel: 9, // m/s^2 of vertical jolting before she complains it's rough
  voiceWaitAfter: 25, // seconds of nothing happening before she gets bored
};

export const COMPANION_PARAM_RANGES = {
  height: [1.4, 1.95, 0.01],
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
  chattiness: [0, 3, 0.05],
  voiceMinGap: [0, 30, 0.5],
  voiceVolume: [0, 1, 0.01],
  voiceSoundVolume: [0, 2, 0.01],
  speechRate: [0.5, 2, 0.01],
  speechPitch: [0, 2, 0.01],
  voiceRange: [2, 100, 1],
  voiceFastSpeed: [3, 25, 0.5],
  voiceRoughAccel: [1, 40, 0.5],
  voiceWaitAfter: [5, 120, 1],
};
