// The hum of a wheel bearing running dry (#326): a low drone that rises with road speed, louder the worse the bearing, heard from the wheel it is in.
// Pure, so a test can hold the pitch, the level and the place; rideAudio.js plays it.

export const DEFAULT_BEARING_HUM_PARAMS = {
  baseHz: 70, // the hum at a crawl
  hzPerMetre: 11, // Hz it rises per m/s of road speed
  maxHz: 260, // where it stops climbing
  minSpeed: 0.4, // m/s under which the wheel is not turning enough to hum
  fullSpeed: 8, // m/s at which it reaches its full level
  minLevel: 0.15, // how bad the bearing is when it starts (faults.js), which the hum is quiet at
};

/**
 * The hum's pitch and level, 0 gain when the fault isn't there or the wheel isn't turning.
 * @param {{ speed: number, level: number, started: boolean }} state  road speed (m/s), the fault's level (0..1), whether it has started
 * @param {number} volume  the Sound tuning's bearingVolume
 * @returns {{ freq: number, gain: number }}
 */
export function bearingHum(state, volume = 1, params = DEFAULT_BEARING_HUM_PARAMS) {
  const speed = Math.abs(state.speed ?? 0);
  if (!state.started || !(state.level > 0) || speed < params.minSpeed) return { freq: params.baseHz, gain: 0 };
  const freq = Math.min(params.maxHz, params.baseHz + params.hzPerMetre * speed);
  const turning = Math.min(1, speed / params.fullSpeed);
  const worse = Math.min(1, Math.max(0, state.level));
  return { freq, gain: volume * worse * worse * (0.3 + 0.7 * turning) * turning };
}

/**
 * Where the hum comes from: the faulty wheel's place on the ground, so it is loudest on its side and at its end.
 * @param {{ x: number, z: number }} wheel  the wheel's place in the vehicle's layout (x positive is the rider's left, z forward)
 * @param {{ x: number, y: number, z: number }} position  the vehicle's
 * @param {number} yaw  heading, as the vehicle's yaw: forward is (sin yaw, cos yaw)
 */
export function humSource(wheel, position, yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { x: position.x + wheel.z * s + wheel.x * c, y: position.y, z: position.z + wheel.z * c - wheel.x * s };
}
