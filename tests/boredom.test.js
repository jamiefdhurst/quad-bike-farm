import { describe, it, expect } from 'vitest';
import { nextBoredWait, driftRestlessness, boredOdds, driveAppetite, BORED_NORM } from '../src/npc/boredom.js';
import { choose } from '../src/npc/chooser.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';

const P = DEFAULT_COMPANION_PARAMS;

function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const percentile = (list, q) => [...list].sort((a, b) => a - b)[Math.floor(q * (list.length - 1))];

describe('her boredom', () => {
  it('waits a widely different time each go, mostly half a minute to a minute and a half', () => {
    const random = seeded();
    const waits = Array.from({ length: 2000 }, () => nextBoredWait(P, 1, random));
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(P.boredWaitFloor);
    expect(Math.max(...waits)).toBeLessThanOrEqual(P.boredWaitCeiling);
    expect(percentile(waits, 0.05)).toBeLessThan(28);
    expect(percentile(waits, 0.95)).toBeGreaterThan(130);
    expect(percentile(waits, 0.25)).toBeGreaterThan(30);
    expect(percentile(waits, 0.75)).toBeLessThan(100);
  });

  it('gets bored sooner when restless', () => {
    const calm = Array.from({ length: 500 }, (_, i) => nextBoredWait(P, 0.6, seeded(i + 1)));
    const restless = Array.from({ length: 500 }, (_, i) => nextBoredWait(P, 1.8, seeded(i + 1)));
    expect(percentile(restless, 0.5)).toBeLessThan(percentile(calm, 0.5) / 2);
  });

  it('drifts in restlessness, within bounds', () => {
    const random = seeded(3);
    let r = 1;
    let lo = 1;
    let hi = 1;
    for (let i = 0; i < 20 * 60 * 10; i++) {
      r = driftRestlessness(r, 0.1, P, random);
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    expect(lo).toBeGreaterThanOrEqual(0.5);
    expect(hi).toBeLessThanOrEqual(2);
    expect(hi - lo).toBeGreaterThan(0.5);
  });

  it('picks driving far more often the more confident she is, through the chooser, and only what she is offered', () => {
    // Bored through and through, a little excited, with a quad to get on, start or drive: what the chooser picks from her odds.
    const needs = { warmth: 0, company: 0, excitement: 0.3, rest: 0, purpose: 1 };
    const offersFor = (confidence, kinds = ['mount', 'start', 'drive', 'wander']) => {
      const odds = boredOdds(P, { confidence });
      return kinds.map((key) => ({ key, weight: odds[key] / BORED_NORM }));
    };
    const share = (confidence) => {
      const random = seeded(11);
      let drives = 0;
      for (let i = 0; i < 4000; i++) if (choose(needs, offersFor(confidence), P, random).pick?.key === 'drive') drives++;
      return drives / 4000;
    };
    const careful = share(0);
    const bold = share(1);
    expect(careful).toBeLessThan(0.12);
    expect(bold).toBeGreaterThan(0.45);
    expect(driveAppetite(1)).toBeGreaterThan(driveAppetite(0.5) * 2.5);
    const random = seeded(5);
    // On its own, wandering is all she'll do (now, or at her next think if the whim puts it under the bar).
    for (let i = 0; i < 500; i++) expect([undefined, 'wander']).toContain(choose(needs, offersFor(1, ['wander']), P, random).pick?.key);
  });

  it('does something different from one time to the next', () => {
    const random = seeded(9);
    const odds = boredOdds(P, { confidence: 0.5 });
    const offers = ['mount', 'start', 'drive', 'wander'].map((key) => ({ key, weight: odds[key] / BORED_NORM }));
    const picks = Array.from({ length: 400 }, () => choose({ purpose: 1, excitement: 0.2 }, offers, P, random).pick?.key);
    for (const choice of ['mount', 'start', 'drive', 'wander']) expect(picks.filter((c) => c === choice).length).toBeGreaterThan(30);
  });
});

describe('buzz-seeking', () => {
  it('a girl keen on the shake picks a rough quad when one is about', () => {
    const p = { ...DEFAULT_COMPANION_PARAMS, boredBuzzChance: 5, boredMountChance: 0, boredStartChance: 0, boredDriveChance: 0 };
    const odds = boredOdds(p);
    const offers = ['buzz', 'wander'].map((key) => ({ key, weight: odds[key] / BORED_NORM }));
    let buzz = 0;
    for (let i = 0; i < 200; i++) if (choose({ purpose: 1, excitement: 0.3 }, offers, p).pick?.key === 'buzz') buzz++;
    expect(buzz).toBeGreaterThan(150);
  });

  it('Jess is keener than Amy, and the default is off', () => {
    expect(CHARACTERS.find((c) => c.id === 'jess').params.boredBuzzChance).toBeGreaterThan(CHARACTERS.find((c) => c.id === 'amy').params.boredBuzzChance);
    expect(DEFAULT_COMPANION_PARAMS.boredBuzzChance).toBe(0);
  });
});
