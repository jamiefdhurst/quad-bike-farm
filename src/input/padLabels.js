// What a prompt says on a gamepad. The interaction prompts are written with keyboard letters; when you last used a pad, `padPrompt`
// rewrites their keys as the button that does the same thing where you are (the maps are the ones in gamepad.js, footKeys and
// rideKeys). A key with no button of its own is on the ring (R3). Pure, so tests/padLabels.test.js can hold it to gamepad.js.

import { radialItems } from './gamepad.js';

// Key code -> button, per place. 'foot' is on foot; 'ride' is driving, or on the back.
export const PAD_BUTTONS = {
  foot: { KeyE: 'A', KeyG: 'B', Enter: 'RB', KeyX: 'X', Space: 'Y', KeyV: 'LT', ArrowLeft: 'D-pad left', ArrowRight: 'D-pad right' },
  ride: { KeyE: 'B', Enter: 'A', KeyL: 'X', Space: 'Y', KeyB: 'RB', KeyC: 'L3', KeyW: 'RT', KeyS: 'LT' },
};

/** The code a prompt's key letter stands for: 'G' is KeyG, '6' Digit6, 'Enter' itself. */
export function keyCode(label) {
  if (/^[A-Z]$/.test(label)) return `Key${label}`;
  if (/^[0-9]$/.test(label)) return `Digit${label}`;
  return label;
}

/** The button for a key label ('E', 'Enter') where you are ('foot' or 'ride'), or null if it has none, or the ring is where it lives. */
export function padButton(label, mode) {
  const code = keyCode(label);
  const own = PAD_BUTTONS[mode]?.[code];
  if (own) return own;
  return radialItems(mode).some((i) => i.key === code) ? 'R3 ring' : null;
}

/**
 * A normalised prompt (interaction/prompt.js) with its keys as buttons: `keyLabel` is the main key's button (the HUD draws it in place
 * of E or Enter) and the chips' keys are changed in the same way. A key with no button stays as the letter it is.
 */
export function padPrompt(p, mode) {
  if (!p || !mode) return p;
  const out = { ...p, keys: p.keys.map(([key, label]) => [padButton(key, mode) ?? key, label]) };
  if (p.action) {
    const b = padButton(p.key ?? 'E', mode);
    if (b) out.keyLabel = p.hold ? `hold ${b}` : b;
  }
  return out;
}
