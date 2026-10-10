import { describe, it, expect } from 'vitest';
import { REACTIONS, NOTICE_REACTIONS, reactionTo, reactionWeight, mayInterrupt } from '../src/npc/reactions.js';
import { NOTICE_KINDS } from '../src/npc/attention.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';

const n = (kind, o = {}) => ({ kind, x: 0, y: 1, z: 5, strength: 1, ...o });
const ctx = (o = {}) => ({ distance: 3, own: false, can: () => true, current: null, ...o });
const always = () => 0;
const never = () => 0.999;

describe('which notices make her react', () => {
  it('only names kinds attention knows and reactions that exist', () => {
    for (const [kind, rule] of Object.entries(NOTICE_REACTIONS)) {
      expect(NOTICE_KINDS[kind], kind).toBeTruthy();
      expect(REACTIONS[rule.reaction], rule.reaction).toBeTruthy();
      if (typeof rule.chance === 'string') expect(P[rule.chance], rule.chance).toBeTypeOf('number');
    }
  });

  it('flinches at a backfire close by, not one across the farm', () => {
    expect(reactionTo(n('backfire'), ctx(), P, always)).toMatchObject({ type: 'flinch', from: { x: 0, z: 5 } });
    expect(reactionTo(n('backfire'), ctx({ distance: 60 }), P, always)).toBe(null);
  });

  it('covers her ears only for hard revving right beside her, as often as her chance says', () => {
    expect(reactionTo(n('rev', { strength: 1.2 }), ctx(), P, always)?.type).toBe('coverEars');
    expect(reactionTo(n('rev', { strength: 0.6 }), ctx(), P, always)).toBe(null);
    expect(reactionTo(n('rev', { strength: 1.2 }), ctx({ distance: 9 }), P, always)).toBe(null);
    expect(reactionTo(n('rev', { strength: 1.2 }), ctx(), P, never)).toBe(null);
  });

  it("doesn't cheer the jump she's on, or cover her ears at her own quad", () => {
    expect(reactionTo(n('jump'), ctx({ distance: 10 }), P, always)?.type).toBe('cheer');
    expect(reactionTo(n('jump'), ctx({ distance: 10, own: true }), P, always)).toBe(null);
    expect(reactionTo(n('rev', { strength: 1.2 }), ctx({ own: true }), P, always)).toBe(null);
  });

  it("only does what she's free to", () => {
    expect(reactionTo(n('lurch'), ctx({ can: (t) => t !== 'stepBack' }), P, always)).toBe(null);
    expect(reactionTo(n('lurch'), ctx(), P, always)?.type).toBe('stepBack');
  });

  it('ignores kinds with no reaction', () => {
    expect(reactionTo(n('engineStart'), ctx(), P, always)).toBe(null);
  });

  it('gives Jess the cheers and Amy the covered ears', () => {
    const amy = { ...P, ...CHARACTERS.find((c) => c.id === 'amy').params };
    const jess = { ...P, ...CHARACTERS.find((c) => c.id === 'jess').params };
    expect(jess.reactCheerChance).toBeGreaterThan(amy.reactCheerChance);
    expect(amy.reactEarsChance).toBeGreaterThan(jess.reactEarsChance);
  });
});

describe('one reaction at a time', () => {
  it('lets a stronger one take over, not a weaker one, until the first is easing off', () => {
    expect(mayInterrupt('stepBack', { type: 'flinch', t: 0.1 })).toBe(true);
    expect(mayInterrupt('cheer', { type: 'flinch', t: 0.1 })).toBe(false);
    const f = REACTIONS.flinch;
    expect(mayInterrupt('cheer', { type: 'flinch', t: f.seconds - f.fall + 0.01 })).toBe(true);
    expect(mayInterrupt('cheer', null)).toBe(true);
  });
});

describe('how it shows over time', () => {
  it('comes up quickly, holds and eases off to nothing', () => {
    const r = REACTIONS.coverEars;
    expect(reactionWeight('coverEars', 0)).toBe(0);
    expect(reactionWeight('coverEars', r.rise)).toBeCloseTo(1);
    expect(reactionWeight('coverEars', r.seconds / 2)).toBeCloseTo(1);
    expect(reactionWeight('coverEars', r.seconds - r.fall / 2)).toBeLessThan(1);
    expect(reactionWeight('coverEars', r.seconds)).toBe(0);
    expect(reactionWeight('nonsense', 0.5)).toBe(0);
  });
});
