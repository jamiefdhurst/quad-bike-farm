import { describe, it, expect } from 'vitest';
import { padButton, padPrompt, keyCode, PAD_BUTTONS } from '../src/input/padLabels.js';
import { normalisePrompt } from '../src/interaction/prompt.js';
import { PadController, PAD } from '../src/input/gamepad.js';

const pad = (down = []) => ({
  connected: true,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })),
  axes: [0, 0, 0, 0],
});
const held = (mode, button, ctx = {}) => new PadController().update(pad([PAD[button]]), 0.016, { mode, ...ctx }).held;

describe('prompts on a gamepad', () => {
  it('names the button that does what E does, where you are', () => {
    expect(padButton('E', 'foot')).toBe('A');
    expect(padButton('E', 'ride')).toBe('B');
    expect(padButton('Enter', 'foot')).toBe('RB');
    expect(padButton('Enter', 'ride')).toBe('A');
    expect(padButton('G', 'foot')).toBe('B');
  });

  it('sends a key with no button to the ring, and leaves one that is on neither', () => {
    expect(padButton('T', 'foot')).toBe('R3 ring');
    expect(padButton('J', 'ride')).toBe('R3 ring');
    expect(padButton('Q', 'ride')).toBe('R3 ring');
    expect(padButton('F9', 'foot')).toBeNull();
  });

  it('turns a prompt into buttons, with hold and the chips', () => {
    const p = normalisePrompt({ text: 'Hold E to fill the sprayer (40%)   ·   G put the hose back' });
    expect(padPrompt(p, 'foot')).toEqual({ action: 'Fill the sprayer (40%)', hold: true, keyLabel: 'hold A', keys: [['B', 'Put the hose back']] });
    expect(padPrompt(normalisePrompt({ action: 'Talk to Amy', key: 'Enter' }), 'foot').keyLabel).toBe('RB');
    expect(padPrompt(normalisePrompt({ action: 'Get off', keys: [['C', 'Look back']] }), 'ride')).toMatchObject({ keyLabel: 'B', keys: [['L3', 'Look back']] });
  });

  it('leaves the keyboard prompt alone when no pad is in use', () => {
    const p = normalisePrompt('Pick up the hose');
    expect(padPrompt(p, null)).toBe(p);
  });

  it('keeps an info line as it is', () => {
    expect(padPrompt(normalisePrompt({ text: 'The jerry can is full' }), 'foot')).toEqual({ info: 'The jerry can is full', keys: [] });
  });

  it('says only what gamepad.js really does', () => {
    // Every button named here must hold that key in that place.
    const ctx = { ride: { seat: 'pillion' } };
    const buttonOf = (name) => (name === 'L3' ? 'L3' : name);
    for (const [mode, map] of Object.entries(PAD_BUTTONS)) {
      for (const [code, button] of Object.entries(map)) {
        if (button.startsWith('D-pad')) continue;
        expect(held(mode, buttonOf(button), ctx[mode]).has(code), `${mode} ${button} -> ${code}`).toBe(true);
      }
    }
  });

  it('reads key labels as codes', () => {
    expect(keyCode('G')).toBe('KeyG');
    expect(keyCode('6')).toBe('Digit6');
    expect(keyCode('Enter')).toBe('Enter');
  });
});
