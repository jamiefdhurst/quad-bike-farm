export const DEFAULT_COMPANION_PARAMS = {
  height: 1.66, // metres, the model is scaled to this
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
};
