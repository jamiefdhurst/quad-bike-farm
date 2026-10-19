import { describe, it, expect } from 'vitest';
import { Memory, OUTCOMES, REMEMBERED_KINDS } from '../src/npc/memory.js';
import { OFFER_KINDS, scoreOffer } from '../src/npc/chooser.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';
import { captureGirls, restoreGirls } from '../src/farm/farmState.js';
import { DEFAULT_FARM_PARAMS as F } from '../src/farm/farmSave.js';

describe('what she remembers', () => {
  it('only touches offer kinds there are', () => {
    for (const k of REMEMBERED_KINDS) expect(OFFER_KINDS[k], k).toBeTruthy();
  });

  it('is wary after a bog and keen after a win, and ignores an outcome it does not know', () => {
    const m = new Memory();
    expect(m.weight('drive')).toBe(1);
    m.note('bogged', P);
    expect(m.weight('drive')).toBeLessThan(1);
    m.note('raceWon', P);
    expect(m.weight('race')).toBeGreaterThan(1);
    expect(m.note('nonsense', P)).toBe(false);
  });

  it('stays within her limits however much goes wrong', () => {
    const m = new Memory();
    for (let i = 0; i < 40; i++) m.note('tipped', P);
    expect(m.weight('drive')).toBe(P.memoryMin);
    for (let i = 0; i < 40; i++) m.note('raceWon', P);
    expect(m.weight('race')).toBe(P.memoryMax);
  });

  it('drifts back to nothing, and the one who forgets quicker is back sooner', () => {
    const slow = new Memory();
    const quick = new Memory();
    slow.note('bogged', P);
    quick.note('bogged', P);
    slow.update(300, P);
    quick.update(300, { ...P, memoryFade: P.memoryFade * 2 });
    expect(quick.weight('drive')).toBeGreaterThan(slow.weight('drive'));
    slow.update(5000, P);
    expect(slow.weight('drive')).toBe(1);
    expect(slow.feel).toEqual({});
  });

  it('nudges what an offer scores', () => {
    const needs = { excitement: 1, purpose: 1 };
    const m = new Memory();
    const base = scoreOffer({ key: 'race', weight: 1 }, needs);
    m.note('raceWon', P);
    expect(scoreOffer({ key: 'race', weight: m.weight('race') }, needs)).toBeGreaterThan(base);
  });

  it('says wary or keen only past the line', () => {
    const m = new Memory();
    expect(m.attitude('drive', P)).toBe(0);
    m.note('tipped', P);
    expect(m.attitude('drive', P)).toBe(-1);
    m.note('conesClean', P);
    m.note('conesClean', P);
    expect(m.attitude('cones', P)).toBe(1);
  });

  it('every outcome changes something', () => {
    for (const [k, v] of Object.entries(OUTCOMES)) expect(Object.keys(v).length, k).toBeGreaterThan(0);
  });
});

describe('what she remembers overnight', () => {
  const girls = () => ({
    favour: { ids: [], scores: {} },
    fallingOut: { friction: 0, active: false },
    skills: { ids: [], levels: {} },
    romance: { ids: [], girls: {} },
    companions: ['amy', 'jess'].map((id) => ({ character: { id }, params: P, memory: new Memory() })),
  });

  it('carries at half strength, and an older save without it loads', () => {
    const a = girls();
    a.companions[0].memory.feel.drive = 0.6;
    a.companions[1].memory.feel.race = 1.4;
    const saved = JSON.parse(JSON.stringify(captureGirls(a)));
    const b = girls();
    restoreGirls(b, saved, F);
    expect(b.companions[0].memory.weight('drive')).toBeCloseTo(1 - 0.4 * F.memoryKept);
    expect(b.companions[1].memory.weight('race')).toBeCloseTo(1 + 0.4 * F.memoryKept);
    expect(b.companions[0].memory.weight('race')).toBe(1);
    delete saved.memories;
    const c = girls();
    restoreGirls(c, saved, F);
    expect(c.companions[0].memory.feel).toEqual({});
  });

  it('ignores junk in a save', () => {
    const m = new Memory();
    m.restore({ drive: 'x', nope: 0.5, race: NaN, climb: 0.7 }, 1, P);
    expect(m.feel).toEqual({ climb: 0.7 });
  });
});
