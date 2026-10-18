// Talking on a buzzing seat: her voice wobbles with it. The seat's own heave (vibration/vibrationModel.js, metres, signed) moves
// her pitch and level together, so a slow thump on a cold single comes out as a slow wobble and a fine two-stroke buzz as a flutter,
// like talking on a washing machine. Pure; CompanionVoice feeds it each frame and CompanionSounds applies it to the playing line.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {number} heave  the seat's heave now, metres (positive up)
 * @param {object} p  her params: voiceWobbleRef, voiceWobbleCents, voiceWobbleLevel, voiceWobbleDepth
 * @returns {{ cents: number, gain: number }}  detune to play her line at, and a multiplier on its volume (1 and 0 when still)
 */
export function voiceWobble(heave, p) {
  const s = (heave / p.voiceWobbleRef) * p.voiceWobbleDepth; // 1 is a hard shake
  return {
    cents: clamp(s * p.voiceWobbleCents, -p.voiceWobbleCents * 2, p.voiceWobbleCents * 2),
    gain: clamp(1 + s * p.voiceWobbleLevel, 0.3, 1.7),
  };
}
