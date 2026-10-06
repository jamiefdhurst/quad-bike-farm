import { describe, it, expect } from 'vitest';
import { QuadNames, QUAD_PHRASES, NICKNAMES, expandQuadLines, quadKey, DEFAULT_NAME_PARAMS as P } from '../src/npc/quadNames.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { AMY_QUAD_LINES, JESS_QUAD_LINES } from '../src/npc/quadLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

const ids = ['green', 'yellow', 'red'];
const ctx = (o = {}) => ({ jessFree: true, youNear: true, candidates: ids, ...o });

describe('quad nicknames', () => {
  it('every quad spec has a phrase and nicknames to pick from', () => {
    for (const s of [...QUAD_SPECS, ...EXTRA_SPECS]) {
      expect(QUAD_PHRASES[s.id], s.id).toBeTruthy();
      expect(NICKNAMES[s.id]?.length, s.id).toBeGreaterThan(0);
    }
  });

  it('Jess names the quads one at a time, not before the first delay, and only while she is free with you near', () => {
    const n = new QuadNames(ids, { random: () => 0 });
    expect(n.update(P.firstNameAfter - 1, ctx())).toBeNull();
    expect(n.update(2, ctx({ jessFree: false }))).toBeNull();
    expect(n.update(0.1, ctx({ youNear: false }))).toBeNull();
    const first = n.update(0.1, ctx());
    expect(first).toMatchObject({ type: 'name', specId: 'green', nick: NICKNAMES.green[0] });
    expect(n.nameOf('green')).toBe(NICKNAMES.green[0]);
    expect(n.nameOf('yellow')).toBeNull(); // not yet said
    expect(n.update(1, ctx())).toBeNull(); // the next one waits
    expect(n.update(P.nameEvery, ctx())?.specId).toBe('yellow');
  });

  it('Amy holds out on a nickname for a few mentions, slips once, then uses them', () => {
    const n = new QuadNames(['green'], { params: { ...P, amyHolds: 2 }, random: () => 0 });
    expect(n.refer('amy', 'green').nick).toBeNull(); // not named yet
    n.update(P.firstNameAfter + 1, ctx({ candidates: ['green'] }));
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const r = n.refer('amy', 'green');
      seen.push(r);
      n.mentioned('amy', 'green', r);
    }
    expect(seen.map((r) => r.nick)).toEqual([null, null, 'Grandad', 'Grandad']);
    expect(seen.map((r) => r.slip)).toEqual([false, false, true, false]);
    expect(n.refer('jess', 'green').nick).toBe('Grandad'); // Jess always does
  });

  it('a mention that is not said does not count towards Amy slipping', () => {
    const n = new QuadNames(['green'], { params: { ...P, amyHolds: 1 }, random: () => 0 });
    n.update(P.firstNameAfter + 1, ctx({ candidates: ['green'] }));
    n.refer('amy', 'green');
    n.refer('amy', 'green');
    expect(n.refer('amy', 'green').slip).toBe(false);
  });
});

describe('lines about a quad', () => {
  it('are written for the colour and each nickname, with the quad filled in', () => {
    const lines = expandQuadLines({ x: { cooldown: 5, lines: ['{Q} is here.', 'Look at {q}.'] } });
    expect(lines[quadKey('x', 'green')].lines).toEqual(['The green quad is here.', 'Look at the green quad.']);
    expect(lines[quadKey('x', 'green', 'Grandad')].lines).toEqual(['Grandad is here.', 'Look at Grandad.']);
    expect(lines[quadKey('x', 'yellow', 'the wasp')].lines[1]).toBe('Look at the wasp.');
  });

  it('exist for every quad and nickname, for both girls', () => {
    for (const id of Object.keys(QUAD_PHRASES)) {
      for (const nick of [null, ...NICKNAMES[id]]) {
        for (const kind of ['claim', 'earHard', 'earRough', 'earSteady']) {
          expect(AMY_QUAD_LINES[quadKey(kind, id, nick)]?.lines.length, `amy ${kind} ${id} ${nick}`).toBeGreaterThan(0);
          expect(JESS_QUAD_LINES[quadKey(kind, id, nick)]?.lines.length, `jess ${kind} ${id} ${nick}`).toBeGreaterThan(0);
        }
      }
      for (const nick of NICKNAMES[id]) expect(JESS_QUAD_LINES[quadKey('nameQuad', id, nick)].lines.join(' ')).toContain(nick);
    }
  });

  it('are in the voices, and the girls never call you he, she or they', () => {
    expect(VOICE_LINES[quadKey('claim', 'red')]).toBeTruthy();
    expect(JESS_LINES[quadKey('nameQuad', 'green', 'Grandad')]).toBeTruthy();
    for (const set of [AMY_QUAD_LINES, JESS_QUAD_LINES]) {
      for (const e of Object.values(set)) for (const l of e.lines) expect(l, l).not.toMatch(/\b(he|they)\b/i);
    }
  });
});
