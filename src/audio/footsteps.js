// Footsteps: when a walker's foot comes down, on what, and how loud it is for the listener. Pure logic, no Web Audio: the hub plays what this
// decides (engineAudio.js `footstep`, samples in footstepSamples.js). Used for you on foot and for each girl walking.

/** The surfaces that have a step sound of their own. */
export const STEP_SURFACES = ['grass', 'dirt', 'mud', 'water', 'tarmac', 'concrete', 'stone', 'straw'];

/** The surface with the biggest share under a foot (ties go to the first in `STEP_SURFACES`). Water is a splash through a puddle, so it counts as mud. */
export function surfaceName(shares) {
  let best = 'grass';
  let top = -1;
  for (const k of STEP_SURFACES) {
    const v = shares?.[k] ?? 0;
    if (v > top + 1e-9) {
      top = v;
      best = k;
    }
  }
  return best === 'water' ? 'mud' : best;
}

/**
 * How loud a step is to the listener, 0 to 1 times `params.footstepVolume`'s own scale: full for you, `footstepGirlGain` for a girl, and a
 * girl fading to nothing at `footstepRange` so she can be heard coming up behind you inside it and not across the yard.
 */
export function stepGain(distance, isGirl, params) {
  if (!isGirl) return 1;
  const range = params.footstepRange;
  if (distance >= range) return 0;
  const fade = 1 - distance / range;
  return params.footstepGirlGain * fade * fade;
}

/**
 * Counts a walker's strides. A foot comes down every `stride` metres of ground covered (longer when jogging), so a slow walk is slow steps and
 * standing still is none. Alternates left and right. One per walker.
 */
export class Footsteps {
  constructor() {
    this.walked = 0;
    this.left = true;
    this.last = null;
  }

  /**
   * @param {{x:number, z:number}} at  where the feet are now
   * @param {{walking:boolean, speed:number}} s  walking is false when riding, in the air or standing; speed in m/s
   * @param {{footstepStride:number, footstepJogStride:number, footstepJogSpeed:number}} p
   * @returns {{left:boolean, strength:number}|null} a step that landed this call, `strength` 0.6 to 1 by how fast
   */
  step(at, { walking, speed }, p) {
    const last = this.last;
    this.last = { x: at.x, z: at.z };
    if (!walking || !last || speed < 0.2) {
      if (!walking) this.walked = 0;
      return null;
    }
    const d = Math.hypot(at.x - last.x, at.z - last.z);
    if (d > 3) return null; // a jump (a teleport, getting off a quad): not a stride
    this.walked += d;
    const stride = speed >= p.footstepJogSpeed ? p.footstepJogStride : p.footstepStride;
    if (this.walked < stride) return null;
    this.walked -= stride;
    this.left = !this.left;
    return { left: this.left, strength: Math.min(1, 0.6 + (0.4 * speed) / p.footstepJogSpeed) };
  }
}
