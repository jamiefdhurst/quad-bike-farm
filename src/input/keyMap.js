// Remappable keys. The game reads keys by the code they have on a standard keyboard ('KeyE', 'Space'), and the pad hands in the same
// codes, so those codes are the actions. A rebinding is a physical key standing in for an action's code, applied in Input.onKeyDown;
// nothing else in the game knows about it. Pure, so it is tested (tests/keyMap.test.js).

export const KEYS_STORAGE_KEY = 'quadBikeFarmKeys';
export const KEYS_EVENT = 'quadbikekeyschange';

// The keys that can be moved, in the order the editor lists them: [game code, what it does]. A key that does several things in different
// places (E, G) lists the main ones. Esc, Tab, Enter, the arrows, the tuning panel and console keys and Shift/Alt are fixed.
export const ACTIONS = [
  { group: 'Moving and riding', keys: [
    ['KeyW', 'Walk forwards, throttle'],
    ['KeyS', 'Walk back, brake'],
    ['KeyA', 'Walk left, steer left'],
    ['KeyD', 'Walk right, steer right'],
    ['Space', 'Parking brake, handbrake'],
    ['KeyC', 'Look back (hold)'],
    ['KeyV', 'Lean in to the dash, push a quad (hold)'],
    ['KeyB', 'Reverse'],
    ['KeyT', 'Right a tipped quad, tip a tub, fold ramps or the sprayer boom'],
  ] },
  { group: 'Using things', keys: [
    ['KeyE', 'Interact, sit, hook on or off, get off'],
    ['KeyG', 'Put down what you hold, 2WD or 4WD'],
    ['KeyX', 'Wind the winch, wipe your view'],
    ['KeyY', 'Dipstick, tickle the old bike’s carb'],
    ['KeyJ', 'Hook a trailer on or off, from the seat'],
    ['KeyL', 'Horn (hold)'],
    ['Digit7', 'Raise the camera'],
    ['Digit8', 'Photo mode'],
    ['Digit6', 'Wave'],
  ] },
  { group: 'Engine and gearbox', keys: [
    ['KeyK', 'Ignition, key'],
    ['KeyR', 'Crank (hold)'],
    ['KeyP', 'Lights, starting handle'],
    ['Digit9', 'Spotlamps (once fitted at the bench)'],
    ['KeyQ', 'More choke, hand throttle'],
    ['KeyZ', 'Less choke'],
    ['KeyF', 'Fuel tap'],
    ['KeyO', 'Pull-start, stop knob (tractor)'],
    ['KeyU', 'Diff lock'],
    ['Digit0', 'Neutral'],
    ['Digit1', 'Gear 1'],
    ['Digit2', 'Gear 2'],
    ['Digit3', 'Gear 3'],
    ['Digit4', 'Gear 4'],
    ['Digit5', 'Gear 5'],
  ] },
  { group: 'Switches and the cab', keys: [
    ['Comma', 'Left indicator'],
    ['Period', 'Right indicator'],
    ['Equal', 'Hazards'],
    ['Semicolon', 'Seat belt'],
    ['KeyI', 'Radio'],
    ['BracketRight', 'Raise the bale arms, hand throttle out, advance the old bike’s spark'],
    ['BracketLeft', 'Lower the bale arms, hand throttle in, retard the old bike’s spark'],
  ] },
  { group: 'Screens', keys: [
    ['KeyH', 'Help'],
    ['KeyM', 'Farm map'],
    ['KeyN', 'Mute'],
  ] },
];

export const ACTION_CODES = ACTIONS.flatMap((g) => g.keys.map(([code]) => code));
const NAMES = new Map(ACTIONS.flatMap((g) => g.keys));
export const actionName = (code) => NAMES.get(code) ?? code;

// Keys a physical key can't be taken from or given to an action: the game and the browser use them as they are.
const FIXED = new Set([
  'Escape', 'Tab', 'Enter', 'Backquote', 'Backslash', 'IntlBackslash', 'Backspace', 'CapsLock', 'ContextMenu',
  'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
export const canBind = (physical) => typeof physical === 'string' && physical.length > 0 && !FIXED.has(physical) && !/^F\d+$/.test(physical);

const LABELS = { Space: 'Space', Comma: ',', Period: '.', Equal: '=', Semicolon: ';', BracketLeft: '[', BracketRight: ']', Minus: '-', Quote: "'",
  Slash: '/', Backquote: '`', Backslash: '\\' };

/** What a key is called on the keycap, as the help page writes it: 'KeyE' is E, 'Digit5' is 5. */
export function keyLabel(code) {
  if (LABELS[code]) return LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}

/** The physical key that does `code` now. */
export const physicalFor = (bindings, code) => bindings?.[code] ?? code;

/**
 * Bindings are { action code: physical key } for the ones moved. Moving one onto a key another action holds swaps them, so no two
 * actions ever share a key; moving it onto a key no action uses leaves its old key doing nothing. Returns a new object.
 */
export function rebind(bindings, code, physical) {
  if (!ACTION_CODES.includes(code) || !canBind(physical)) return { ...bindings };
  const next = { ...bindings };
  const old = physicalFor(next, code);
  if (physical === old) return next;
  const holder = ACTION_CODES.find((c) => c !== code && physicalFor(next, c) === physical);
  if (holder) next[holder] = old;
  next[code] = physical;
  for (const c of Object.keys(next)) if (next[c] === c) delete next[c];
  return next;
}

/** Puts one action, or all of them, back where they started. */
export function resetBindings(bindings, code) {
  if (!code) return {};
  const next = { ...bindings };
  const mine = physicalFor(next, code);
  if (mine === code) return next;
  return rebind(next, code, code);
}

/** Keeps only what could be a set of bindings: known actions on usable keys. Replayed through rebind, so none share a key. */
export function cleanBindings(raw) {
  if (!raw || typeof raw !== 'object') return {};
  let out = {};
  for (const [code, physical] of Object.entries(raw)) out = rebind(out, code, physical);
  return out;
}

/**
 * Physical key -> the code the game reads. A key not in the map is itself; a key that is null did something that has moved and does
 * nothing now.
 */
export function makeKeyMap(bindings) {
  const map = new Map();
  for (const code of ACTION_CODES) {
    const physical = physicalFor(bindings, code);
    if (physical !== code) map.set(physical, code);
  }
  for (const code of ACTION_CODES) if (physicalFor(bindings, code) !== code && !map.has(code)) map.set(code, null);
  return map;
}

/** The game's code for a physical key under `map` (null: it does nothing now). */
export function translate(map, physical) {
  return map.has(physical) ? map.get(physical) : physical;
}

/**
 * The help page's HTML with each <kbd> of a moved key showing the key that does it now (the caller leaves out the pad's section: its
 * buttons are not keys).
 */
export function relabelKbd(html, bindings) {
  const byLabel = new Map();
  for (const code of ACTION_CODES) {
    const physical = physicalFor(bindings, code);
    if (physical !== code) byLabel.set(keyLabel(code), keyLabel(physical));
  }
  if (!byLabel.size) return html;
  return html.replace(/<kbd>([^<]+)<\/kbd>/g, (m, text) => (byLabel.has(text) ? `<kbd>${byLabel.get(text)}</kbd>` : m));
}

/** The browser's localStorage, or null where it can't be had (a private window, blocked site data, tests). */
export function keyStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadBindings(storage) {
  try {
    return cleanBindings(JSON.parse(storage?.getItem(KEYS_STORAGE_KEY) ?? 'null'));
  } catch {
    return {};
  }
}

export function saveBindings(storage, bindings) {
  try {
    if (Object.keys(bindings).length) storage?.setItem(KEYS_STORAGE_KEY, JSON.stringify(bindings));
    else storage?.removeItem(KEYS_STORAGE_KEY);
  } catch {
    // not kept
  }
}
