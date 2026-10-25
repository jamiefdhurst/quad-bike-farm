/**
 * The one prompt. Everything you can use says what it is in the same shape, whatever wrote it:
 *
 *   { action, hold?, keys? }   E (or hold E) does `action`; `keys` are other [key, what it does] chips under it
 *   { info, keys? }            nothing to press: a line saying why not ("The jerry can is full")
 *
 * An interactable's `prompt()` may return a string (an E action), `{ text }` (an info line) or either shape above; older prompts
 * wrote "Hold E to fill it" and "   ·   G put it down" into the text, which is read here so they show the same as the rest.
 * Pure, so tests/prompt.test.js can hold every shape to it.
 */

const SEP = /\s+·\s+/;

const upFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "G put the can down" or "T to tip it" as ['G', 'Put the can down'], or null when the part does not start with a key. */
export function keyChip(part) {
  const m = /^([A-Z0-9])\s+(?:to\s+)?(.+)$/.exec(part.trim());
  return m ? [m[1], upFirst(m[2])] : null;
}

/** Whatever an interactable returned, as { action, hold, keys } or { info, keys }, or null for nothing to show. */
export function normalisePrompt(p) {
  if (!p) return null;
  if (typeof p === 'object' && (p.action || p.info) && !('text' in p)) return { ...p, keys: p.keys ?? [] };
  const act = typeof p === 'string';
  const [first, ...rest] = (act ? p : (p.text ?? '')).split(SEP);
  const keys = [...(p.keys ?? [])];
  const extra = [];
  for (const part of rest) {
    const chip = keyChip(part);
    if (chip) keys.push(chip);
    else extra.push(part);
  }
  const line = [first, ...extra].join(', ');
  if (!line && !keys.length) return null;
  const hold = /^hold e to /i.exec(line);
  if (hold) return { action: upFirst(line.slice(hold[0].length)), hold: true, keys };
  return act ? { action: line, keys } : { info: line, keys };
}

/** A stable string for a normalised prompt, so the HUD only rebuilds it when it changes. */
export function promptSignature(p) {
  return p ? JSON.stringify(p) : '';
}
