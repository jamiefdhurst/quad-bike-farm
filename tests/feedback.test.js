import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FEEDBACK, validFeedback, cueFor } from '../src/interaction/feedback.js';
import { USE_CUES, useSamples } from '../src/audio/useAudio.js';

// .claude/rules/controls.md: using anything makes a sound and shows a change.
describe('what an interactable gives back', () => {
  it('accepts a cue, own, hold or a function, and nothing else', () => {
    for (const f of FEEDBACK) expect(validFeedback(f)).toBe(true);
    expect(validFeedback(() => 'latch')).toBe(true);
    expect(validFeedback(undefined)).toBe(false);
    expect(validFeedback('click')).toBe(false);
  });

  it('plays a cue only for a cue', () => {
    expect(cueFor({ feedback: 'pickUp' })).toBe('pickUp');
    expect(cueFor({ feedback: 'own' })).toBe(null);
    expect(cueFor({ feedback: 'hold' })).toBe(null);
  });

  it('asks a function what you hold now', () => {
    let holding = true;
    const item = { feedback: () => (holding ? 'putDown' : 'pickUp') };
    expect(cueFor(item)).toBe('putDown');
    holding = false;
    expect(cueFor(item)).toBe('pickUp');
  });

  it('is declared by every interactable registered in the source', () => {
    for (const path of ['src/game.js', 'src/workshop/sparesShelf.js', 'src/world/villageHost.js', 'src/world/trafficHost.js']) {
      const src = readFileSync(path, 'utf8');
      const interacts = src.match(/\binteract: /g)?.length ?? 0;
      const declared = src.match(/\bfeedback: /g)?.length ?? 0;
      // A registration is an `interact:` with a `feedback:` beside it; the one in the JSDoc of interaction.js is not counted here.
      expect(declared, path).toBeGreaterThanOrEqual(interacts);
    }
  });
});

describe('the small sounds', () => {
  for (const kind of USE_CUES) {
    it(`${kind} is a short, audible, quiet-enough sound that is the same every time`, () => {
      const a = useSamples(kind, 44100);
      expect(a.length).toBeGreaterThan(2000);
      expect(a.length).toBeLessThan(44100 * 0.5);
      const peak = a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThan(1.2);
      expect(Array.from(useSamples(kind, 44100).slice(0, 50))).toEqual(Array.from(a.slice(0, 50)));
    });
  }
});
