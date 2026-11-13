import { describe, it, expect } from 'vitest';
import { Radio } from '../src/vehicle/radio.js';
import { RadioTaste, radioMove, applyRadioMove, DEFAULT_RADIO_TASTE_PARAMS as P } from '../src/npc/radioTaste.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

const powered = (on, volume = 0.5) => {
  const r = new Radio('finch');
  r.set(on);
  r.setVolume(volume);
  r.update(100, { power: true });
  return r;
};
const always = () => 0;
const never = () => 0.999;

describe('what a girl does about the radio', () => {
  it('Jess is keen: she switches it on, then turns it up to where she likes it', () => {
    expect(radioMove(0.9, powered(false), P, always)).toBe('on');
    expect(radioMove(0.9, powered(true, 0.5), P, always)).toBe('up');
    expect(radioMove(0.9, powered(true, 1), P, always)).toBe(null);
  });

  it('Amy would rather not: she never switches it on, and turns it down and then off', () => {
    expect(radioMove(0.1, powered(false), P, always)).toBe(null);
    expect(radioMove(0.1, powered(true, 0.8), P, always)).toBe('down');
    expect(radioMove(0.1, powered(true, 0.2), P, always)).toBe('off');
  });

  it('leaves it alone after anyone touched it, and with no power', () => {
    const r = powered(true, 0.8);
    r.louder();
    expect(radioMove(0.1, r, P, always)).toBe(null);
    r.update(P.leaveAlone + 1, { power: true });
    expect(radioMove(0.1, r, P, always)).toBe('down');
    r.update(1, { power: false });
    expect(radioMove(0.1, r, P, always)).toBe(null);
  });

  it('waits until she has been sat in a while, and thinks only now and then', () => {
    const t = new RadioTaste();
    const r = powered(true, 0.8);
    expect(t.update(P.firstAfter - 1, true, 0.1, r, P, always)).toBe(null);
    expect(t.update(1, true, 0.1, r, P, always)).toBe(null);
    expect(t.update(P.checkEvery, true, 0.1, r, P, always)).toBe('down');
    expect(t.update(1, true, 0.1, r, P, always)).toBe(null);
    t.update(1, false, 0.1, r, P, always);
    expect(t.update(1, true, 0.1, r, P, always)).toBe(null); // getting out starts it again
  });

  it('does it and gives the line to say', () => {
    const r = powered(false);
    expect(applyRadioMove('on', r)).toBe('radioOn');
    expect(r.on).toBe(true);
    expect(applyRadioMove('off', r)).toBe('radioOff');
    expect(r.on).toBe(false);
    expect(applyRadioMove(null, r)).toBe(null);
    expect(never()).toBeGreaterThan(0.9);
  });

  it('is in their characters, and both have lines for all four', () => {
    const keen = Object.fromEntries(CHARACTERS.map((c) => [c.id, c.params.radioKeen]));
    expect(keen.jess).toBeGreaterThan(0.5);
    expect(keen.amy).toBeLessThan(0.5);
    for (const s of ['radioOn', 'radioUp', 'radioDown', 'radioOff']) {
      expect(VOICE_LINES[s].lines.length, s).toBeGreaterThan(1);
      expect(JESS_LINES[s].length, s).toBeGreaterThan(1);
      for (const l of [...VOICE_LINES[s].lines, ...JESS_LINES[s]]) expect(l, l).not.toMatch(/—|\b(he|she|they)\b/i);
    }
  });
});
