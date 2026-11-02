import { describe, it, expect } from 'vitest';
import { CHARACTERS, linesFor } from '../src/npc/characters.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';
import { Companion } from '../src/npc/companion.js';
import { JESS_ONLY_QUAD_SITUATIONS } from '../src/npc/quadLines.js';
import { JESS_ONLY_SMOKE_SITUATIONS } from '../src/npc/smokeLines.js';
import { JESS_ONLY_DIESEL_SITUATIONS } from '../src/npc/dieselLines.js';
import { JESS_ONLY_LPLATE_SITUATIONS } from '../src/npc/lPlateLines.js';
import { JESS_ONLY_HANDBRAKE_SITUATIONS } from '../src/npc/handbrakeLines.js';
import { JESS_ONLY_FOUR_WD_SITUATIONS } from '../src/npc/fourWdLines.js';
import { JESS_ONLY_DROWNOUT_SITUATIONS } from '../src/npc/drownOutLines.js';
import { JESS_ONLY_DARE_SITUATIONS } from '../src/npc/dareLines.js';
import { JESS_ONLY_CAR_SITUATIONS } from '../src/npc/carLines.js';
import { JESS_ONLY_CONKER_SITUATIONS } from '../src/npc/conkerLines.js';
import { JESS_ONLY_STICKY_SITUATIONS } from '../src/npc/stickyLines.js';

describe('characters', () => {
  it('only give their own lines for situations that exist, keeping cooldowns and shouts', () => {
    for (const situation of Object.keys(JESS_LINES).filter((s) => ![...JESS_ONLY_QUAD_SITUATIONS, ...JESS_ONLY_SMOKE_SITUATIONS, ...JESS_ONLY_DIESEL_SITUATIONS, ...JESS_ONLY_LPLATE_SITUATIONS, ...JESS_ONLY_HANDBRAKE_SITUATIONS, ...JESS_ONLY_FOUR_WD_SITUATIONS, ...JESS_ONLY_DROWNOUT_SITUATIONS, ...JESS_ONLY_DARE_SITUATIONS, ...JESS_ONLY_CAR_SITUATIONS, ...JESS_ONLY_CONKER_SITUATIONS, ...JESS_ONLY_STICKY_SITUATIONS].includes(s))) expect(VOICE_LINES, situation).toHaveProperty(situation);
    const lines = linesFor({ leftBehind: ['Oi!'] });
    expect(lines.leftBehind.lines).toEqual(['Oi!']);
    expect(lines.leftBehind.cooldown).toBe(VOICE_LINES.leftBehind.cooldown);
    expect(lines.leftBehind.shout).toBe(VOICE_LINES.leftBehind.shout);
    expect(lines.rideFun).toBe(VOICE_LINES.rideFun);
  });

  it('each have kind words for you, and never call you he, she or they', () => {
    for (const character of Object.values(CHARACTERS)) {
      const id = character.id;
      for (const situation of ['loveYou', 'careForYou']) {
        const lines = character.lines[situation].lines;
        expect(lines.length, `${id} ${situation}`).toBeGreaterThan(4);
        for (const l of lines) expect(l, l).not.toMatch(/\b(he|she|they)\b/i);
      }
    }
  });

  it('each have lines for being favoured, neglected, turning you down and gloating', () => {
    for (const character of Object.values(CHARACTERS)) {
      for (const situation of ['favouredWarm', 'neglectedSulk', 'refuseRequest', 'gloatTakeOver', 'sulkOff']) {
        const lines = character.lines[situation].lines;
        expect(lines.length, `${character.id} ${situation}`).toBeGreaterThanOrEqual(4);
        // The ones said to you never talk about you as he, she or they (the others are about her friend).
        if (['favouredWarm', 'neglectedSulk'].includes(situation)) {
          for (const l of lines) if (typeof l === 'string') expect(l, l).not.toMatch(/\b(he|she|they)\b/i);
        }
      }
    }
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
