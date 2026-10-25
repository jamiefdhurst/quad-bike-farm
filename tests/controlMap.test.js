import { describe, it, expect } from 'vitest';
import { CONTEXTS, entries } from '../src/input/controlMap.js';
import { ACTION_CODES, keyLabel } from '../src/input/keyMap.js';
import { CONTROLS } from '../src/hud/controls.js';

const all = entries();

describe('the control map', () => {
  it('gives a key one meaning per mode in each context', () => {
    const seen = new Map();
    const clashes = [];
    for (const e of all) {
      const k = `${e.id}/${e.key}/${e.mode}`;
      if (seen.has(k)) clashes.push(`${k}: "${seen.get(k)}" and "${e.what}"`);
      seen.set(k, e.what);
    }
    expect(clashes).toEqual([]);
  });

  it('uses only press and hold, and says what each key does', () => {
    for (const e of all) {
      expect(['press', 'hold']).toContain(e.mode);
      expect(e.what.length).toBeGreaterThan(2);
    }
  });

  it('places every remappable key in at least one context', () => {
    const placed = new Set(all.map((e) => e.key));
    expect(ACTION_CODES.filter((c) => !placed.has(c))).toEqual([]);
  });

  it('keeps B for leaving, backing out and cancelling, and G for putting down', () => {
    const bad = all.filter((e) => e.key === 'KeyB' && e.id === 'screen' && !/close|back/i.test(e.what));
    expect(bad).toEqual([]);
    // Outside the vehicle's own controls, B never does anything but leave, and E never closes a screen.
    for (const e of all) {
      if (e.key === 'KeyB' && e.id !== 'ride') expect(e.what).toMatch(/close|back|leave/i);
      if (e.key === 'KeyE' && e.id === 'screen') expect(e.what).not.toMatch(/close|leave/i);
      if (e.key === 'KeyG' && e.id !== 'ride') expect(e.what).toMatch(/put down/i);
    }
  });

  it('is named by every key the help page shows', () => {
    const known = new Set([...all.map((e) => keyLabel(e.key)), 'Shift', 'Alt', 'Esc', '`', '\\', 'Start', 'Select']);
    const padOnly = /gamepad/i;
    const unknown = [];
    for (const section of CONTROLS) {
      if (padOnly.test(section.title)) continue;
      for (const line of section.lines) {
        for (const m of line.matchAll(/<kbd>([^<]+)<\/kbd>/g)) {
          const label = m[1].replace(/&larr;|&rarr;/g, '').trim();
          if (label && !known.has(label) && !ACTION_CODES.map(keyLabel).includes(label)) unknown.push(`${section.title}: ${label}`);
        }
      }
    }
    expect([...new Set(unknown)]).toEqual([]);
  });

  it('names a piece of #416 for anything the game does not do yet', () => {
    const pieces = new Set(['wheel', 'photo']);
    for (const e of all) if (e.moves) expect(pieces.has(e.moves)).toBe(true);
    expect(Object.keys(CONTEXTS)).toEqual(['foot', 'ride', 'back', 'screen', 'photo', 'anytime']);
  });
});
