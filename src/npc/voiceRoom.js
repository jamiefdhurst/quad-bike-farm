import { reverbSend } from '../world/barn.js';

/** What a girl's voice is lowpassed to when nothing is over her head (above hearing, so it does nothing). */
export const VOICE_OPEN_CUTOFF = 20000;

/**
 * How her voice sounds where she is: muffled under her helmet, and rung by the barn when you or she is in it.
 * @param {{helmet: boolean, listenerIn: boolean, sourceIn: boolean}} s  her helmet is on her head; you and her head are inside the barn
 * @param {object} p  her params: voiceHelmetCutoff
 * @param {object} [barn]  the barn's params (reverbWet, reverbWetOutside), as the engines use them
 * @returns {{cutoff: number, send: number}} lowpass in Hz, and the level sent into the barn's echo
 */
export function voiceRoom({ helmet, listenerIn, sourceIn }, p, barn) {
  return { cutoff: helmet ? p.voiceHelmetCutoff : VOICE_OPEN_CUTOFF, send: reverbSend(listenerIn, sourceIn, barn) };
}
