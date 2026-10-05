export const DEFAULT_PLAYER_PARAMS = {
  walkSpeed: 2.2, // m/s
  jogSpeed: 4.4, // m/s with Shift
  acceleration: 10, // 1/s, how quickly speed follows input
  gravity: 20, // m/s^2 (a little heavier than real for snappier landings)
  mouseSensitivity: 0.0022, // radians per pixel
  eyeHeight: 1.62, // above the feet
  headBobWalk: 0.03, // metres
  headBobJog: 0.055,
  headBobRate: 1.9, // steps per metre travelled
  interactRange: 3.2, // metres
  dismountSpeed: 1.4, // m/s, roughly walking pace; faster than this you jump off and the quad carries on
  mountSpeed: 3, // m/s; you can hop on a moving quad up to this, if you can catch it
  leapSideSpeed: 2.6, // m/s you push yourself out sideways jumping off at speed
  leapCarry: 0.5, // fraction of the quad's velocity you keep when you jump off
  leapHop: 1.6, // m/s upwards as you jump
  stumbleTime: 0.9, // seconds you're off balance after jumping off at full speed
  stumbleDecel: 9, // m/s^2 you slow down at while stumbling
  stumbleFullSpeed: 12, // m/s; jumping off at this speed or faster is the full stumble
  stumbleDip: 0.32, // metres the camera drops on landing at full stumble
  stumbleRoll: 14, // degrees the camera rolls as you jump at full stumble
  rideYawLimit: 160, // degrees either side when seated, enough to look back at a passenger
  ridePitchUp: 60,
  ridePitchDown: 65,
  rideCameraShake: 1.0, // multiplier on the vibration camera output
  lookBackYaw: 205, // degrees you turn round (past 180 to see back across the seat from out over your shoulder) holding C (or the middle mouse button) while riding
  lookBackPitch: -10, // degrees, a little down toward a passenger
  lookBackShift: 0.28, // metres your head moves out over the shoulder as you twist round
  lookBackTime: 0.35, // seconds to turn round, and back again
  lookBackFreedom: 35, // degrees the mouse can move the view while turned round
};

export const PLAYER_PARAM_RANGES = {
  walkSpeed: [0.5, 5, 0.1],
  jogSpeed: [1, 10, 0.1],
  acceleration: [1, 40, 0.5],
  gravity: [5, 40, 0.5],
  mouseSensitivity: [0.0005, 0.006, 0.0001],
  eyeHeight: [1.2, 2, 0.01],
  headBobWalk: [0, 0.15, 0.005],
  headBobJog: [0, 0.2, 0.005],
  headBobRate: [0.5, 4, 0.05],
  interactRange: [1, 6, 0.1],
  dismountSpeed: [0.2, 5, 0.1],
  mountSpeed: [0, 8, 0.1],
  leapSideSpeed: [0, 8, 0.1],
  leapCarry: [0, 1, 0.05],
  leapHop: [0, 5, 0.1],
  stumbleTime: [0, 3, 0.05],
  stumbleDecel: [1, 30, 0.5],
  stumbleFullSpeed: [3, 25, 0.5],
  stumbleDip: [0, 1, 0.01],
  stumbleRoll: [0, 45, 1],
  rideYawLimit: [30, 170, 1],
  ridePitchUp: [10, 89, 1],
  ridePitchDown: [10, 89, 1],
  rideCameraShake: [0, 3, 0.05],
  lookBackYaw: [60, 240, 1],
  lookBackPitch: [-60, 30, 1],
  lookBackShift: [0, 0.4, 0.01],
  lookBackTime: [0.05, 1.5, 0.05],
  lookBackFreedom: [0, 90, 1],
};
