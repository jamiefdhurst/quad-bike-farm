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
  dismountSpeed: 1.4, // m/s, roughly walking pace
  rideYawLimit: 110, // degrees either side when seated
  ridePitchUp: 60,
  ridePitchDown: 65,
  rideCameraShake: 1.0, // multiplier on the vibration camera output
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
  rideYawLimit: [30, 170, 1],
  ridePitchUp: [10, 89, 1],
  ridePitchDown: [10, 89, 1],
  rideCameraShake: [0, 3, 0.05],
};
