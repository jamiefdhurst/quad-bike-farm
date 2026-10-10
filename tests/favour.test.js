import { describe, it, expect } from 'vitest';
import { Favour, DEFAULT_FAVOUR_PARAMS as P } from '../src/npc/favour.js';
import { pickOfferer } from '../src/npc/rideOffer.js';
import { boredOdds, BORED_NORM } from '../src/npc/boredom.js';
import { choose } from '../src/npc/chooser.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { BANTER } from '../src/npc/banterLines.js';
import { CHARACTERS } from '../src/npc/characters.js';

const make = () => new Favour(['amy', 'jess'], { ...P });

function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('who you favour', () => {
  it('starts even, with nobody favoured or neglected', () => {
    const f = make();
    expect(f.standing('amy')).toBe(0);
    expect(f.mood('jess')).toBe('even');
    expect(f.rivalry()).toBeNull();
    expect(f.refuseChance('amy')).toBe(0);
  });

  it('favours the one you spend time with and neglects the other', () => {
    const f = make();
    f.add('amy', 8);
    expect(f.mood('amy')).toBe('favoured');
    expect(f.mood('jess')).toBe('neglected');
    expect(f.rivalry()).toEqual({ favoured: 'amy', other: 'jess' });
  });

  it('keeps it even when you treat them the same', () => {
    const f = make();
    f.add('amy', 10);
    f.add('jess', 10);
    expect(f.mood('amy')).toBe('even');
  });

  it('keeps scores within bounds', () => {
    const f = make();
    f.add('amy', 1000);
    f.add('jess', -1000);
    expect(f.scores.amy).toBe(P.maxScore);
    expect(f.scores.jess).toBe(-P.maxScore);
    expect(f.standing('amy')).toBe(1);
    expect(f.standing('jess')).toBe(-1);
  });

  it('fades back to nothing, from either side, without overshooting', () => {
    const f = make();
    f.add('amy', 5);
    f.add('jess', -5);
    for (let t = 0; t < 3600; t++) f.update(1);
    expect(f.scores.amy).toBe(0);
    expect(f.scores.jess).toBe(0);
  });

  it('ignores a girl it does not know', () => {
    const f = make();
    f.add('nobody', 5);
    expect(f.scores.nobody).toBeUndefined();
  });

  it('makes the favoured girl warmer and the neglected one quiet', () => {
    const f = make();
    f.add('amy', 20);
    expect(f.warmth('amy')).toBeCloseTo(P.warmthBoost, 5);
    expect(f.warmth('jess')).toBe(0);
    expect(make().warmth('amy')).toBe(1);
  });

  it('only turns a girl down when she is neglected, and never always', () => {
    const f = make();
    f.add('amy', 20);
    expect(f.refuseChance('amy')).toBe(0);
    expect(f.refuseChance('jess')).toBeGreaterThan(0);
    expect(f.refuseChance('jess')).toBeLessThanOrEqual(P.refuseMax);
    expect(P.refuseMax).toBeLessThan(1);
  });

  it('lets a favoured girl offer rides more often than a neglected one', () => {
    const f = make();
    f.add('amy', 20);
    const random = seeded(3);
    const wins = { amy: 0, jess: 0 };
    for (let i = 0; i < 2000; i++) {
      const girls = [
        { id: 'amy', distance: 5, favour: f.offerWeight('amy') },
        { id: 'jess', distance: 5, favour: f.offerWeight('jess') },
      ];
      wins[pickOfferer(girls, random).id]++;
    }
    expect(wins.amy).toBeGreaterThan(wins.jess * 3);
    expect(wins.jess).toBeGreaterThan(0);
  });

  it('sends a neglected girl off on a quad by herself more often', () => {
    const f = make();
    f.add('amy', 20);
    const count = (sulk) => {
      const random = seeded(11);
      let drives = 0;
      for (let i = 0; i < 2000; i++) {
        const odds = boredOdds(DEFAULT_COMPANION_PARAMS, { confidence: 0.5, sulk });
        const offers = ['drive', 'mount', 'start'].map((key) => ({ key, weight: odds[key] / BORED_NORM }));
        if (choose({ purpose: 1, excitement: 0.2 }, offers, DEFAULT_COMPANION_PARAMS, random).pick?.key === 'drive') drives++;
      }
      return drives;
    };
    expect(f.sulkDrive('amy')).toBe(1);
    expect(f.sulkDrive('jess')).toBeGreaterThan(2);
    expect(count(f.sulkDrive('jess'))).toBeGreaterThan(count(1) * 1.4);
  });
});

describe('the favour exchanges', () => {
  const favour = BANTER.filter((e) => e.when === 'favoured');

  it('exist for each girl being the favoured one', () => {
    for (const id of CHARACTERS.map((c) => c.id)) {
      expect(favour.filter((e) => e.roles.favoured === id).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('only have the two girls speaking', () => {
    for (const e of favour) {
      for (const [speaker, text] of e.lines) {
        expect(['amy', 'jess']).toContain(speaker);
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });
});
