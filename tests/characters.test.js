import { describe, it, expect } from 'vitest';
import { CHARACTERS, linesFor } from '../src/npc/characters.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';
import { Companion } from '../src/npc/companion.js';

describe('characters', () => {
  it('only give their own lines for situations that exist, keeping cooldowns and shouts', () => {
    for (const situation of Object.keys(JESS_LINES)) expect(VOICE_LINES, situation).toHaveProperty(situation);
    const lines = linesFor({ leftBehind: ['Oi!'] });
    expect(lines.leftBehind.lines).toEqual(['Oi!']);
    expect(lines.leftBehind.cooldown).toBe(VOICE_LINES.leftBehind.cooldown);
    expect(lines.leftBehind.shout).toBe(VOICE_LINES.leftBehind.shout);
    expect(lines.rideFun).toBe(VOICE_LINES.rideFun);
  });

  it('have different names and voice banks', () => {
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(CHARACTERS.length);
    expect(new Set(CHARACTERS.map((c) => c.voiceBank)).size).toBe(CHARACTERS.length);
  });
});

describe('two companions and one quad', () => {
  const claimed = Object.getOwnPropertyDescriptor(Companion.prototype, 'claimedQuad').get;
  const fake = (state, data, quad) => {
    const c = { quad, fsm: { name: state, data, is: (...names) => names.includes(state) } };
    Object.defineProperty(c, 'claimedQuad', { get: () => claimed.call(c) });
    return c;
  };
  const q = { label: 'red' };

  it('a quad is hers while she is heading to it, starting it or on it', () => {
    expect(fake('idle', null, q).claimedQuad).toBe(null);
    expect(fake('walking', { goal: 'wander' }, q).claimedQuad).toBe(null);
    expect(fake('walking', { goal: 'stand' }, q).claimedQuad).toBe(null);
    for (const goal of ['mount', 'start', 'drive']) expect(fake('walking', { goal }, q).claimedQuad).toBe(q);
    for (const state of ['starting', 'mounting', 'seated', 'driving', 'shuffling', 'dismounting']) expect(fake(state, null, q).claimedQuad).toBe(q);
  });

  it('the other one leaves it alone', () => {
    const other = fake('seated', null, q);
    const me = { others: () => [other] };
    expect(Companion.prototype.takenByOther.call(me, q)).toBe(true);
    expect(Companion.prototype.takenByOther.call(me, { label: 'blue' })).toBe(false);
  });
});
