import { describe, it, expect } from 'vitest';
import { choose, scoreOffer, mainNeed, describeMind, OFFER_KINDS } from '../src/npc/chooser.js';
import { NEEDS } from '../src/npc/needs.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';

const needs = (o = {}) => ({ warmth: 0, company: 0, excitement: 0, rest: 0, purpose: 0, ...o });
const fixed = { ...P, chooseWhim: 0 };

describe('the chooser', () => {
  it('every kind of offer meets real needs and says what it is', () => {
    for (const [key, kind] of Object.entries(OFFER_KINDS)) {
      expect(kind.label, key).toBeTruthy();
      expect(Object.keys(kind.satisfies).length, key).toBeGreaterThan(0);
      for (const n of Object.keys(kind.satisfies)) expect(NEEDS, `${key} meets "${n}"`).toContain(n);
    }
  });

  it('scores an offer by the needs it meets, times her taste for it', () => {
    expect(scoreOffer({ key: 'warmHands', weight: 1 }, needs({ warmth: 0.6 }))).toBeCloseTo(0.6);
    expect(scoreOffer({ key: 'warmHands', weight: 2 }, needs({ warmth: 0.6 }))).toBeCloseTo(1.2);
    expect(scoreOffer({ key: 'warmHands', weight: 1 }, needs({ purpose: 1 }))).toBe(0);
    expect(scoreOffer({ key: 'nonsense' }, needs({ purpose: 1 }))).toBe(0);
  });

  it('picks what meets her most pressing need', () => {
    const offers = [{ key: 'warmHands', weight: 1 }, { key: 'drive', weight: 1 }];
    expect(choose(needs({ warmth: 0.9, purpose: 0.2 }), offers, fixed).pick.key).toBe('warmHands');
    expect(choose(needs({ excitement: 0.9, purpose: 0.8 }), offers, fixed).pick.key).toBe('drive');
  });

  it('does nothing while nothing presses, or when nothing on offer helps enough', () => {
    const offers = [{ key: 'drive', weight: 1 }];
    expect(choose(needs({ excitement: 0.2, purpose: 0.3 }), offers, fixed).pick).toBe(null);
    expect(choose(needs({ warmth: 0.9 }), offers, fixed).pick).toBe(null);
    expect(choose(needs({ purpose: 1 }), [], fixed).pick).toBe(null);
  });

  it('keeps every score, best first, for the debug panel', () => {
    const { scored } = choose(needs({ warmth: 0.9, purpose: 0.6 }), [{ key: 'wander', weight: 1 }, { key: 'warmHands', weight: 1 }], fixed);
    expect(scored.map((s) => s.offer.key)).toEqual(['warmHands', 'wander']);
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });

  it('a whim now and then puts something else first', () => {
    let seed = 3;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const offers = [{ key: 'drive', weight: 1 }, { key: 'start', weight: 1 }];
    const picks = Array.from({ length: 300 }, () => choose(needs({ purpose: 1, excitement: 0.3 }), offers, P, random).pick?.key);
    expect(picks.filter((k) => k === 'start').length).toBeGreaterThan(20);
    expect(picks.filter((k) => k === 'drive').length).toBeGreaterThan(picks.filter((k) => k === 'start').length);
  });

  it('says what a choice was for: the need it met most', () => {
    expect(mainNeed({ key: 'drive' }, needs({ excitement: 0.9, purpose: 0.2 }))).toBe('excitement');
    expect(mainNeed({ key: 'drive' }, needs({ excitement: 0.1, purpose: 0.9 }))).toBe('purpose');
    expect(mainNeed({ key: 'nonsense' }, needs())).toBe(null);
  });

  it('describes her mind for the debug panel', () => {
    const d = describeMind({ last: { key: 'warmHands', need: 'warmth' }, since: 12.4, scored: [{ key: 'wander', score: 0.31 }], waiting: null, thinkIn: 1.23 });
    expect(d.chose).toBe('warm her hands on an engine, for warmth (12 s ago)');
    expect(d.nearly).toBe('wander off for a look round 0.31');
    expect(d.next).toBe('thinks again in 1.2 s');
    expect(describeMind({ last: null, since: 0, scored: [], waiting: 'driving', thinkIn: 0 })).toEqual({ chose: 'nothing yet', nearly: 'nothing on offer', next: 'not now: driving' });
  });
});
