import { describe, expect, it } from 'vitest';
import { voiceWobble } from '../src/npc/voiceWobble.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';

const p = DEFAULT_COMPANION_PARAMS;

describe('voice wobble', () => {
  it('leaves her voice alone on a still seat', () => {
    expect(voiceWobble(0, p)).toEqual({ cents: 0, gain: 1 });
  });

  it('follows the seat both ways, pitch and level together', () => {
    const up = voiceWobble(0.004, p);
    const down = voiceWobble(-0.004, p);
    expect(up.cents).toBeGreaterThan(0);
    expect(down.cents).toBeCloseTo(-up.cents);
    expect(up.gain).toBeGreaterThan(1);
    expect(down.gain).toBeLessThan(1);
  });

  it('stays within bounds however hard it shakes', () => {
    const hard = voiceWobble(0.5, p);
    expect(hard.cents).toBe(p.voiceWobbleCents * 2);
    expect(hard.gain).toBeLessThanOrEqual(1.7);
    expect(voiceWobble(-0.5, p).gain).toBeGreaterThanOrEqual(0.3);
  });

  it('is off at depth 0 and stronger at higher depth', () => {
    expect(voiceWobble(0.004, { ...p, voiceWobbleDepth: 0 })).toEqual({ cents: 0, gain: 1 });
    expect(voiceWobble(0.004, { ...p, voiceWobbleDepth: 2 }).cents).toBeCloseTo(voiceWobble(0.004, p).cents * 2);
  });

  it('has Jess playing it up on purpose', () => {
    expect(CHARACTERS.find((c) => c.id === 'jess').params.voiceWobbleDepth).toBeGreaterThan(p.voiceWobbleDepth);
  });
});
