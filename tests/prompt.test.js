import { describe, it, expect } from 'vitest';
import { normalisePrompt, keyChip } from '../src/interaction/prompt.js';

describe('the one prompt', () => {
  it('reads a string as what E does', () => {
    expect(normalisePrompt('Pick up the hose')).toEqual({ action: 'Pick up the hose', keys: [] });
  });

  it('reads { text } as a line with nothing to press', () => {
    expect(normalisePrompt({ text: 'The jerry can is full' })).toEqual({ info: 'The jerry can is full', keys: [] });
  });

  it('turns "Hold E to ..." into a hold, whichever way it came', () => {
    const want = { action: 'Fill the jerry can (1.0 / 5 L)', hold: true, keys: [] };
    expect(normalisePrompt({ text: 'Hold E to fill the jerry can (1.0 / 5 L)' })).toEqual(want);
    expect(normalisePrompt('Hold E to fill the jerry can (1.0 / 5 L)')).toEqual(want);
  });

  it('takes "   ·   G put it down" off the text into a key chip', () => {
    expect(normalisePrompt({ text: 'Hold E to fill the sprayer (40%)   ·   G put the hose back' })).toEqual({
      action: 'Fill the sprayer (40%)',
      hold: true,
      keys: [['G', 'Put the hose back']],
    });
    expect(normalisePrompt('Hook the tow rope on the Yak   ·   X put it back')).toEqual({
      action: 'Hook the tow rope on the Yak',
      keys: [['X', 'Put it back']],
    });
    expect(normalisePrompt({ text: 'The tub is full of muck   ·   T to tip it' })).toEqual({ info: 'The tub is full of muck', keys: [['T', 'Tip it']] });
  });

  it('keeps a part that is not a key in the line', () => {
    expect(normalisePrompt({ text: 'The Hens: the hens are hungry   ·   bring the feed bucket to feed them' })).toEqual({
      info: 'The Hens: the hens are hungry, bring the feed bucket to feed them',
      keys: [],
    });
  });

  it('passes the structured shapes through', () => {
    expect(normalisePrompt({ action: 'Get off', keys: [['C', 'Look back']] })).toEqual({ action: 'Get off', keys: [['C', 'Look back']] });
    expect(normalisePrompt({ action: 'Fill it', hold: true })).toEqual({ action: 'Fill it', hold: true, keys: [] });
    expect(normalisePrompt({ info: 'Full' })).toEqual({ info: 'Full', keys: [] });
  });

  it('shows nothing for nothing', () => {
    expect(normalisePrompt('')).toBeNull();
    expect(normalisePrompt(null)).toBeNull();
    expect(normalisePrompt({ text: '' })).toBeNull();
  });

  it('only calls a part a key when it starts with one', () => {
    expect(keyChip('G put it down')).toEqual(['G', 'Put it down']);
    expect(keyChip('bring the can')).toBeNull();
    expect(keyChip('Gone')).toBeNull();
  });
});
