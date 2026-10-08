// Free-fly for the console (`fly`): no gravity and no walls, WASD along where you are looking, Space up, C down, Shift fast. Pure, so
// it is tested; Player.fixedUpdate applies it when `flying` is on.

export const DEFAULT_FLIGHT_PARAMS = {
  speed: 12, // m/s
  fastSpeed: 60, // m/s with Shift held
};

/**
 * The velocity to fly at.
 * @param {{ forward: number, right: number, up: number }} keys  each -1, 0 or 1
 * @param {number} yaw    the player's view yaw (0 looks down -z)
 * @param {number} pitch  the view pitch, radians, up positive
 * @param {boolean} fast
 * @returns {{ x: number, y: number, z: number }}
 */
export function flightVelocity(keys, yaw, pitch, fast, p = DEFAULT_FLIGHT_PARAMS) {
  const speed = fast ? p.fastSpeed : p.speed;
  // Forward goes where the nose points, up and down included; sideways stays level.
  const fx = -Math.sin(yaw) * Math.cos(pitch);
  const fy = Math.sin(pitch);
  const fz = -Math.cos(yaw) * Math.cos(pitch);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let x = fx * keys.forward + rx * keys.right;
  let y = fy * keys.forward + keys.up;
  let z = fz * keys.forward + rz * keys.right;
  const len = Math.hypot(x, y, z);
  if (len > 1) {
    x /= len;
    y /= len;
    z /= len;
  }
  return { x: x * speed, y: y * speed, z: z * speed };
}
