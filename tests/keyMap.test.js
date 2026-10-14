import { describe, it, expect } from 'vitest';
import {
  ACTIONS, ACTION_CODES, KEYS_STORAGE_KEY, canBind, cleanBindings, keyLabel, loadBindings, makeKeyMap, rebind, relabelKbd, resetBindings,
  saveBindings, translate,
} from '../src/input/keyMap.js';
import { CONTROLS } from '../src/hud/controls.js';
import { helpHtml } from '../src/hud/hud.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m };
};

describe('remappable keys', () => {
  it('lists each action once, and none of the fixed keys', () => {
    expect(new Set(ACTION_CODES).size).toBe(ACTION_CODES.length);
    for (const c of ACTION_CODES) expect(canBind(c)).toBe(true);
    expect(ACTIONS.length).toBeGreaterThan(3);
  });

  it('does nothing different until a key is moved', () => {
    const map = makeKeyMap({});
    expect(translate(map, 'KeyE')).toBe('KeyE');
    expect(translate(map, 'Escape')).toBe('Escape');
  });

  it('swaps two actions when the new key is in use', () => {
    const b = rebind({}, 'KeyE', 'KeyJ');
    // J was the hitch's, so this swaps them
    const map = makeKeyMap(b);
    expect(translate(map, 'KeyJ')).toBe('KeyE');
    expect(translate(map, 'KeyE')).toBe('KeyJ');
    const free = rebind({}, 'KeyE', 'KeyW');
    expect(translate(makeKeyMap(free), 'KeyW')).toBe('KeyE');
    const toUnused = rebind({}, 'KeyE', 'KeyB');
    expect(translate(makeKeyMap(toUnused), 'KeyB')).toBe('KeyE');
  });

  it('leaves the old key doing nothing when the new one belonged to no action', () => {
    const b = rebind({}, 'KeyE', 'Slash');
    const map = makeKeyMap(b);
    expect(translate(map, 'Slash')).toBe('KeyE');
    expect(translate(map, 'KeyE')).toBeNull();
  });

  it('never lets two actions share a key', () => {
    let b = {};
    for (const [code, key] of [['KeyE', 'KeyG'], ['KeyG', 'KeyX'], ['KeyX', 'KeyE'], ['Space', 'KeyE'], ['KeyW', 'Slash']]) b = rebind(b, code, key);
    const physical = ACTION_CODES.map((c) => b[c] ?? c);
    expect(new Set(physical).size).toBe(physical.length);
    const map = makeKeyMap(b);
    for (const c of ACTION_CODES) expect(translate(map, b[c] ?? c)).toBe(c);
  });

  it('refuses keys the game keeps', () => {
    for (const k of ['Escape', 'Tab', 'Enter', 'ShiftLeft', 'ArrowUp', 'Backquote', 'F5', '']) {
      expect(canBind(k)).toBe(false);
      expect(rebind({}, 'KeyE', k)).toEqual({});
    }
    expect(rebind({}, 'Escape', 'KeyJ')).toEqual({});
  });

  it('puts one or all back', () => {
    const b = rebind(rebind({}, 'KeyE', 'KeyG'), 'KeyX', 'Slash');
    expect(resetBindings(b)).toEqual({});
    const one = resetBindings(b, 'KeyE');
    expect(one.KeyE).toBeUndefined();
    expect(one.KeyX).toBe('Slash');
    expect(Object.keys(one)).not.toContain('KeyG');
  });

  it('keeps what was saved and drops what is junk', () => {
    const s = fakeStorage();
    const b = rebind({}, 'KeyE', 'KeyG');
    saveBindings(s, b);
    expect(loadBindings(s)).toEqual(b);
    saveBindings(s, {});
    expect(s.m.has(KEYS_STORAGE_KEY)).toBe(false);
    s.setItem(KEYS_STORAGE_KEY, '{not json');
    expect(loadBindings(s)).toEqual({});
    expect(cleanBindings({ KeyE: 'Escape', Nonsense: 'KeyA', KeyG: 'KeyX', KeyY: 5 })).toEqual({ KeyG: 'KeyX', KeyX: 'KeyG' });
    expect(loadBindings(null)).toEqual({});
  });

  it('writes a key as it is on the keycap', () => {
    expect(keyLabel('KeyE')).toBe('E');
    expect(keyLabel('Digit5')).toBe('5');
    expect(keyLabel('Semicolon')).toBe(';');
    expect(keyLabel('Space')).toBe('Space');
  });

  it('shows the moved keys on the help page, but not on the pad section', () => {
    const b = rebind({}, 'KeyE', 'KeyG');
    const plain = helpHtml({});
    const moved = helpHtml(b);
    expect(moved).not.toBe(plain);
    expect(relabelKbd('<kbd>E</kbd> use <kbd>G</kbd> drop <kbd>Z</kbd>', b)).toBe('<kbd>G</kbd> use <kbd>E</kbd> drop <kbd>Z</kbd>');
    const pad = CONTROLS.find((s) => s.title === 'On a gamepad');
    for (const line of pad.lines) expect(moved).toContain(line);
  });

  it('has a name for every key the help page tells the player to press', () => {
    const named = new Set(ACTION_CODES.map(keyLabel));
    const fixed = new Set(['Shift', 'Alt', 'Esc', 'Tab', 'Enter', '`', '\\', 'Start', 'Select', 'L3', 'R3', 'LT', 'RT', 'LB', 'RB', 'A', 'B', 'X', 'Y', 'D-pad', '&larr;', '&rarr;', 'D-pad up', 'down']);
    const missing = new Set();
    for (const s of CONTROLS.filter((c) => c.title !== 'On a gamepad')) {
      for (const line of s.lines) for (const m of line.matchAll(/<kbd>([^<]+)<\/kbd>/g)) if (!named.has(m[1]) && !fixed.has(m[1])) missing.add(m[1]);
    }
    expect([...missing]).toEqual([]);
  });
});
