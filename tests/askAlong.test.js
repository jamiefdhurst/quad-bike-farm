import { describe, it, expect } from 'vitest';
import { AskAlong, ALONG_KINDS, DEFAULT_ASK_ALONG_PARAMS as P } from '../src/npc/askAlong.js';
import { AMY_ASK_LINES, JESS_ASK_LINES } from '../src/npc/askAlongLines.js';

const ctx = (o = {}) => ({ distance: 5, youFree: true, company: 1, askChance: 1, fallenOut: false, ...o });
const always = () => 0;
const never = () => 1;
const ready = (random = always) => {
  const a = new AskAlong({ ...P }, random);
  a.update(P.startAfter + 1);
  return a;
};

describe('Asking you along', () => {
  it('only asks about things it has a kind for', () => {
    expect(ready().shouldAsk('amy', 'rest', ctx())).toBe(true);
    expect(ready().shouldAsk('amy', 'wander', ctx())).toBe(false);
  });

  it('waits for the start, you being near and free, and her wanting company', () => {
    expect(new AskAlong({ ...P }, always).shouldAsk('amy', 'rest', ctx())).toBe(false);
    expect(ready().shouldAsk('amy', 'rest', ctx({ distance: P.hearRange + 1 }))).toBe(false);
    expect(ready().shouldAsk('amy', 'rest', ctx({ youFree: false }))).toBe(false);
    expect(ready().shouldAsk('amy', 'rest', ctx({ company: 0 }))).toBe(false);
    expect(ready().shouldAsk('amy', 'rest', ctx({ fallenOut: true }))).toBe(false);
  });

  it('is a chance scaled by how much she wants company and how forward she is', () => {
    expect(ready(never).shouldAsk('amy', 'rest', ctx())).toBe(false);
    expect(ready(() => 0.3).shouldAsk('amy', 'rest', ctx({ company: 0.5 }))).toBe(true);
    expect(ready(() => 0.3).shouldAsk('amy', 'rest', ctx({ company: 0.5, askChance: 0.4 }))).toBe(false);
  });

  it('keeps one ask open at a time and rests after an answer', () => {
    const a = ready();
    a.ask('amy', 'rest');
    expect(a.shouldAsk('jess', 'race', ctx())).toBe(false);
    a.answer('amy', true);
    expect(a.shouldAsk('amy', 'rest', ctx())).toBe(false);
    a.update(P.cooldown + 1);
    expect(a.shouldAsk('amy', 'rest', ctx())).toBe(true);
  });

  it('a yes sets her off with you and pleases her', () => {
    const a = ready();
    a.ask('amy', 'flask');
    expect(a.answer('amy', true)).toMatchObject({ type: 'yes', key: 'flask', favour: P.yesFavour });
    expect(a.pendingFor('amy')).toBeNull();
    expect(a.answer('amy', true)).toBeNull();
  });

  it('a no from a girl who goes anyway is a shrug and no hard feelings', () => {
    const a = ready(always);
    a.ask('jess', 'race');
    expect(a.answer('jess', false, { goesAnyway: 0.9 })).toMatchObject({ type: 'anyway', favour: 0 });
  });

  it('a no from one who does not is a sulk, and she goes alone later', () => {
    const a = ready(never);
    a.ask('amy', 'rest');
    const r = a.answer('amy', false, { goesAnyway: 0.2 });
    expect(r).toMatchObject({ type: 'sulk', favour: P.noFavour, mood: P.sulkSeconds });
    expect(a.update(r.delay - 1)).toEqual([]);
    expect(a.update(2)).toEqual([{ type: 'later', girl: 'amy', key: 'rest' }]);
    expect(a.update(1)).toEqual([]);
  });

  it('a neglected girl sulks harder and goes anyway less', () => {
    const a = ready(() => 0.5);
    a.ask('amy', 'rest');
    expect(a.answer('amy', false, { goesAnyway: 0.6, standing: 0 }).type).toBe('anyway');
    a.update(P.cooldown + 1);
    a.ask('amy', 'rest');
    const r = a.answer('amy', false, { goesAnyway: 0.6, standing: -1 });
    expect(r.type).toBe('sulk');
    expect(r.mood).toBe(P.sulkSeconds * 2);
    expect(r.favour).toBe(P.noFavour * 2);
  });

  it('lapses into a not now', () => {
    const a = ready();
    a.ask('amy', 'fire');
    expect(a.update(P.lapseAfter - 1)).toEqual([]);
    expect(a.update(2)).toEqual([{ type: 'lapsed', girl: 'amy', key: 'fire' }]);
  });

  it('cancel drops the ask and any going later', () => {
    const a = ready(never);
    a.ask('amy', 'rest');
    a.cancel('amy');
    expect(a.pendingFor('amy')).toBeNull();
    a.ask('amy', 'rest');
    a.answer('amy', false, {});
    a.cancel('amy');
    expect(a.update(1000).filter((e) => e.type === 'later')).toEqual([]);
  });

  it('has a line for every kind, and a yes and a no, for both girls', () => {
    for (const k of Object.values(ALONG_KINDS)) {
      expect(AMY_ASK_LINES[k.line]).toBeTruthy();
      expect(JESS_ASK_LINES[k.line]).toBeTruthy();
    }
    for (const key of ['askYes', 'askSulk', 'askAnyway', 'askLater']) {
      expect(AMY_ASK_LINES[key]).toBeTruthy();
      expect(JESS_ASK_LINES[key]).toBeTruthy();
    }
  });
});
