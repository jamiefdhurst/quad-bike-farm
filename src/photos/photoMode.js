// Photo mode: the world stands still and the camera flies free. Pure (the game feeds in the keys, the mouse and the ground), tested.
// The movement is the console's free-fly (player/flight.js) with a leash and a floor, so the camera can neither leave the farm nor go
// under it, and a field of view you can zoom.

import { flightVelocity } from '../player/flight.js';

export const DEFAULT_PHOTO_MODE_PARAMS = {
  speed: 5, // m/s
  fastSpeed: 25, // m/s with Shift held
  leash: 40, // metres from where you were when you raised it
  floor: 0.25, // metres kept above the ground
  ceiling: 60, // metres above the ground
  fovMin: 18, // degrees
  fovMax: 90,
  fovStep: 4, // degrees a wheel notch
  lookScale: 1, // times the walking mouse sensitivity
  pngWidth: 1920, // pixels wide of the saved picture (the canvas is copied at this size, cropped to the screen's shape)
};

export const PHOTO_MODE_RANGES = {
  speed: [1, 20, 0.5],
  fastSpeed: [5, 80, 1],
  leash: [10, 150, 5],
  floor: [0.05, 2, 0.05],
  ceiling: [10, 200, 5],
  fovMin: [5, 40, 1],
  fovMax: [50, 120, 1],
  fovStep: [1, 10, 1],
  lookScale: [0.2, 3, 0.1],
  pngWidth: [640, 3840, 160],
};

const DEG = Math.PI / 180;

/** A free camera: where it is, which way it looks and how wide. */
export class PhotoCam {
  constructor(p = DEFAULT_PHOTO_MODE_PARAMS) {
    this.p = p;
    this.pos = { x: 0, y: 0, z: 0 };
    this.anchor = { x: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.fov = 70;
  }

  /** Starts at the eye of whoever raised it. */
  place(pos, yaw, pitch, fov) {
    this.pos = { x: pos.x, y: pos.y, z: pos.z };
    this.anchor = { x: pos.x, z: pos.z };
    this.yaw = yaw;
    this.pitch = pitch;
    this.fov = Math.min(this.p.fovMax, Math.max(this.p.fovMin, fov));
  }

  /**
   * One frame. keys = { forward, right, up } each -1, 0 or 1; look = { x, y } the mouse in radians already scaled; wheel = notches
   * (positive = scroll down = wider); groundAt(x, z) the ground's height.
   */
  step(dt, keys, look, wheel, fast, groundAt) {
    const p = this.p;
    this.yaw -= look.x;
    this.pitch = Math.max(-88 * DEG, Math.min(88 * DEG, this.pitch - look.y));
    this.fov = Math.min(p.fovMax, Math.max(p.fovMin, this.fov + wheel * p.fovStep));
    const v = flightVelocity(keys, this.yaw, this.pitch, fast, { speed: p.speed, fastSpeed: p.fastSpeed });
    this.pos.x += v.x * dt;
    this.pos.y += v.y * dt;
    this.pos.z += v.z * dt;
    // The leash pulls back along the line to where it started.
    const dx = this.pos.x - this.anchor.x;
    const dz = this.pos.z - this.anchor.z;
    const d = Math.hypot(dx, dz);
    if (d > p.leash) {
      this.pos.x = this.anchor.x + (dx / d) * p.leash;
      this.pos.z = this.anchor.z + (dz / d) * p.leash;
    }
    const ground = groundAt(this.pos.x, this.pos.z);
    this.pos.y = Math.min(ground + p.ceiling, Math.max(ground + p.floor, this.pos.y));
  }
}

/** The size to save a picture at: the screen's shape, `width` wide (never bigger than the canvas has). */
export function pngSize(canvasW, canvasH, width) {
  const w = Math.min(width, canvasW);
  return { w: Math.round(w), h: Math.round((w * canvasH) / canvasW) };
}

/** A name for the saved file: the day and the time of day, so a run of them sorts. */
export function pngName(day, timeText, n) {
  return `farm-day${day}-${timeText.replace(':', '')}-${n}.png`;
}
