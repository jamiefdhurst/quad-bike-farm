import { USE_CUES } from '../audio/useAudio.js';

/**
 * What an interactable gives back when you use it (.claude/rules/controls.md, "Every act"). Each says one of:
 *   a cue from audio/useAudio.js   the dispatcher plays that small sound (pickUp, putDown, latch, paper)
 *   'own'                          the act already makes its own sound and shows its own change (a bell, an engine, a purchase's chink)
 *   'hold'                         E does nothing on a press; holding it works the thing, and the hold has the sound (pouring, forking)
 * or a function giving one of those, for an interactable whose act depends on what you hold. Pure.
 */
export const FEEDBACK = [...USE_CUES, 'own', 'hold'];

/** Whether `f` is something an interactable may declare. */
export function validFeedback(f) {
  return typeof f === 'function' || FEEDBACK.includes(f);
}

/** The cue to play for an interactable after E is pressed on it, or null when it makes its own sound. */
export function cueFor(item) {
  const f = typeof item.feedback === 'function' ? item.feedback() : item.feedback;
  return USE_CUES.includes(f) ? f : null;
}
