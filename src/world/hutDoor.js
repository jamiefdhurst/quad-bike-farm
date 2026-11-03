// The shepherd's hut door: a half-stable pair of leaves that swing together on their hinges. Pure: no Three.js. hutHost.js turns E and the girls
// into open() and shut(), and sets the leaves' angle and the doorway's collider from this each frame.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

/** How far the leaves swing from shut to open, in radians (hutBuild.js's pose for the leaves against the wall). */
export const DOOR_OPEN_ANGLE = 1.75;

/** Whether the girls would shut the hut up when they have left it: it is raining, or too dark to leave the door open on. */
export function wantsShut({ rain, darkness }, p) {
  return rain >= p.shutRain || darkness >= p.shutDarkness;
}

export class HutDoor {
  constructor(params) {
    this.p = params;
    this.isOpen = true; // as the hut was built: both leaves back against the wall
    this.swing = 1; // 0 shut .. 1 open, eased
    this.t = 1; // where the swing is heading
  }

  /** Starts it swinging. Returns whether that changed anything. */
  setOpen(open) {
    if (open === this.isOpen) return false;
    this.isOpen = open;
    return true;
  }

  update(dt) {
    const target = this.isOpen ? 1 : 0;
    const step = dt / Math.max(0.05, this.p.doorSeconds);
    this.t = clamp(this.t + clamp(target - this.t, -step, step), 0, 1);
    this.swing = smoothstep(this.t);
  }

  /** The leaves' rotation about their hinges (y, radians): 0 shut across the doorway. */
  get angle() {
    return -DOOR_OPEN_ANGLE * this.swing;
  }

  /** Whether the doorway is blocked. It blocks from the moment it starts to shut, and not until it has swung clear of the doorway. */
  get blocking() {
    return this.t < 0.6;
  }
}
