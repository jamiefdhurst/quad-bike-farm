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

describe('a shirt and tie', () => {
  it('is dealt about one day in ten for each girl, white or pale blue', async () => {
    const { SHIRT_COLOURS } = await import('../src/npc/outfits.js');
    for (const g of CHARACTERS.filter((c) => c.outfitOdds)) expect(tally(g.outfitOdds, { warm: false }).shirtTie).toBeCloseTo(0.1, 1);
    const random = createRandom(9);
    const colours = new Set();
    for (let i = 0; i < 200; i++) colours.add(dealOutfit(random, { shirtTie: 1 }).shirt);
    expect([...colours].sort()).toEqual(SHIRT_COLOURS.map((s) => s.colour).sort());
  });

  it('is mostly done right up on Amy and mostly loosened on Jess, with the knot 4 to 6 cm down and one or two undone', () => {
    const loose = (id) => {
      const g = CHARACTERS.find((c) => c.id === id);
      const random = createRandom(4);
      let n = 0;
      for (let i = 0; i < 1000; i++) {
        const o = dealOutfit(random, { shirtTie: 1 }, { tieLoose: g.tieLooseChance });
        expect(o.tieDrop).toBeGreaterThanOrEqual(0.04);
        expect(o.tieDrop).toBeLessThanOrEqual(0.06);
        expect([1, 2]).toContain(o.shirtOpen);
        expect(o.popped).toBe(false);
        if (o.tieLoose) n++;
      }
      return n / 1000;
    };
    expect(loose('amy')).toBeLessThan(0.35);
    expect(loose('jess')).toBeGreaterThan(0.65);
  });

  it('is worn over the polo about half the time, and says what she has on', () => {
    const random = createRandom(13);
    let over = 0;
    for (let i = 0; i < 1000; i++) if (dealOutfit(random, { shirtTie: 1 }).shirtOverPolo) over++;
    expect(over / 1000).toBeCloseTo(0.5, 1);
    expect(describeOutfit({ kind: 'shirtTie', shirt: '#c4d7ec', shirtOverPolo: true, tieLoose: true })).toBe('a pale blue shirt and tie over her polo, the tie loosened');
    expect(describeOutfit({ kind: 'shirtTie', shirt: '#f4f3ef' })).toBe('a white shirt and tie, done right up');
  });

  it('takes its place from its own stream, so every other day she wears what she always would have', () => {
    const a = createRandom(21);
    const b = createRandom(21);
    const extra = createRandom(99);
    let swapped = 0;
    for (let i = 0; i < 500; i++) {
      const before = dealOutfit(a, ODDS, { warm: true, extra: Math.random });
      const after = dealOutfit(b, { ...ODDS, shirtTie: 0.1 }, { warm: true, extra });
      if (after.kind === 'shirtTie') swapped++;
      else expect(after.kind).toBe(before.kind);
    }
    expect(swapped / 500).toBeCloseTo(0.1, 1);
  });

  it('is offered to both girls in the outfit picker', () => {
    for (const g of CHARACTERS.filter((c) => c.outfitOdds)) expect(outfitsFor(g.outfitOdds)).toContain('shirtTie');
  });

  it('has her say why the first time you talk to her that day, and only then', async () => {
    const { outfitRemark } = await import('../src/npc/outfits.js');
    const { AMY_OUTFIT_LINES, JESS_OUTFIT_LINES } = await import('../src/npc/outfitLines.js');
    expect(outfitRemark({ kind: 'shirtTie' }, 3, undefined)).toBe('shirtTie');
    expect(outfitRemark({ kind: 'shirtTie' }, 3, 3)).toBe(null);
    expect(outfitRemark({ kind: 'shirtTie' }, 4, 3)).toBe('shirtTie');
    expect(outfitRemark({ kind: 'polo' }, 3, undefined)).toBe(null);
    expect(AMY_OUTFIT_LINES.shirtTie.lines.every((l) => /town/.test(l))).toBe(true);
    expect(JESS_OUTFIT_LINES.shirtTie.length).toBeGreaterThan(0);
  });
});
