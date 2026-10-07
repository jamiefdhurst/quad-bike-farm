// Standing still on a slope. Pressing the character controller into the ground each step (a small downward speed, to stay grounded) makes
// Rapier slide it a little along any slope, a creep of a few millimetres a second that mounts up (measured: 6 mm/s at 30 degrees, half a
// metre in a minute on a steep bank). So when you are grounded, not pressing a key and all but stopped, you are held where you are and not
// pushed into the slope at all. Pure logic.

export const STILL_BELOW = 0.05; // m/s, horizontal speed under which no key down counts as standing still

/**
 * @param {{ moving: boolean, speed: number, grounded: boolean, stumbling?: boolean }} s  `moving`: a movement key is down; `speed`: horizontal m/s
 * @returns {{ still: boolean, pressDown: number }}  still: hold where you stand (no horizontal move, speed zeroed); pressDown: the downward speed to ask for while grounded
 */
export function standing({ moving, speed, grounded, stumbling = false }) {
  const still = grounded && !moving && !stumbling && speed < STILL_BELOW;
  return { still, pressDown: still ? 0 : -1 };
}
