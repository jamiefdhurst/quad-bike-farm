import { describe, it, expect } from 'vitest';
import { dealOutfit, describeOutfit, outfitsFor, OVER_POLO_COLOURS, PLAID_PALETTE } from '../src/npc/outfits.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { createRandom } from '../src/core/random.js';

const ODDS = { polo: 0.5, plaid: 0.3, doublePolo: 0.15, cropTop: 0.05 };

function tally(odds, opts, n = 4000) {
  const random = createRandom(7);
  const count = {};
  for (let i = 0; i < n; i++) {
    const o = dealOutfit(random, odds, opts);
    count[o.kind] = (count[o.kind] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / n]));
}

describe('dealing the day\'s outfit', () => {
  it('follows the odds: mostly a polo, then plaid, then two polos, and the odd crop-top on a warm day', () => {
    const t = tally(ODDS, { warm: true });
    expect(t.polo).toBeCloseTo(0.5, 1);
    expect(t.plaid).toBeCloseTo(0.3, 1);
    expect(t.doublePolo).toBeCloseTo(0.15, 1);
    expect(t.cropTop).toBeGreaterThan(0.02);
    expect(t.cropTop).toBeLessThan(0.09);
  });

  it('never deals a crop-top on a day that is not warm: its share goes to the polo', () => {
    const t = tally(ODDS, { warm: false });
    expect(t.cropTop ?? 0).toBe(0);
    expect(t.polo).toBeCloseTo(0.55, 1);
  });

  it('gives Amy no crop-top even on a warm day, and Jess the odd one', () => {
    const amy = CHARACTERS.find((c) => c.id === 'amy');
    const jess = CHARACTERS.find((c) => c.id === 'jess');
    expect(tally(amy.outfitOdds, { warm: true }).cropTop ?? 0).toBe(0);
    expect(tally(jess.outfitOdds, { warm: true }).cropTop).toBeGreaterThan(0);
  });

  it('is the same for the same stream, and deals a white or black over-polo and a plaid from the palette', () => {
    const a = dealOutfit(createRandom(3), ODDS, { warm: true, popped: 0.5 });
    expect(dealOutfit(createRandom(3), ODDS, { warm: true, popped: 0.5 })).toEqual(a);
    expect(OVER_POLO_COLOURS).toContain(a.over);
    expect(PLAID_PALETTE.map((q) => q.colours)).toContainEqual(a.plaid);
  });

  it('never pops a crop-top\'s collar (it has none), and says what she has on', () => {
    const random = createRandom(11);
    for (let i = 0; i < 200; i++) {
      const o = dealOutfit(random, { cropTop: 1 }, { warm: true, popped: 1 });
      expect(o.popped).toBe(false);
    }
    expect(describeOutfit({ kind: 'plaid', plaid: PLAID_PALETTE[0].colours, plaidOpen: true })).toBe('a red and black plaid shirt, open over her polo');
    expect(describeOutfit({ kind: 'doublePolo', over: OVER_POLO_COLOURS[1], popped: true })).toBe('two polos (black over hers), collars popped');
  });
});

describe('buttons and who may wear what', () => {
  it('deals the polo under a second one and a buttoned plaid their own buttons, each within her range', () => {
    const random = createRandom(5);
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const o = dealOutfit(random, ODDS, { underOpen: [0, 4], plaidButtons: [0, 3] });
      expect(o.underOpen).toBeGreaterThanOrEqual(0);
      expect(o.underOpen).toBeLessThanOrEqual(4);
      expect(o.plaidButtons).toBeLessThanOrEqual(3);
      seen.add(o.plaidButtons);
    }
    expect(seen.has(0)).toBe(true); // done right up, sometimes
  });

  it('only lets a girl with a chance of it wear the crop-top', () => {
    const amy = CHARACTERS.find((c) => c.id === 'amy');
    const jess = CHARACTERS.find((c) => c.id === 'jess');
    expect(outfitsFor(amy.outfitOdds)).not.toContain('cropTop');
    expect(outfitsFor(jess.outfitOdds)).toContain('cropTop');
  });
});
