import { describe, it, expect } from 'vitest';
import { FallingOut, DEFAULT_FALLING_OUT_PARAMS } from '../src/npc/fallingOut.js';

const make = (over = {}) => new FallingOut(['amy', 'jess'], { ...DEFAULT_FALLING_OUT_PARAMS, ...over }, () => 0.5);
const later = (f, t = 200) => f.update(t);

describe('falling out', () => {
  it('builds up friction and falls out at the threshold, not before the grace period', () => {
    const f = make();
    expect(f.add('borrow', 'jess')).toBeNull(); // too early in the game
    f.clock = 200;
    const e = f.add('race', 'amy'); // 5 + 3.5 >= 8
    expect(e).toEqual({ type: 'fellOut', kind: 'race', fault: 'amy' });
    expect(f.active).toBe(true);
  });

  it('one dig is not enough, and friction drains away', () => {
    const f = make();
    later(f);
    expect(f.add('digs')).toBeNull();
    f.update(400);
    expect(f.friction).toBe(0);
    for (let i = 0; i < 3; i++) expect(f.add('digs')).toBeNull();
    expect(f.active).toBe(false);
  });

  it('makes up on its own after the duration, with the one at fault saying sorry', () => {
    const f = make();
    later(f);
    f.add('borrow', 'jess');
    f.add('race', 'jess');
    expect(f.remaining).toBe(300);
    expect(f.update(299)).toBeNull();
    expect(f.update(2)).toEqual({ type: 'madeUp', sorry: 'jess' });
    expect(f.active).toBe(false);
  });

  it('cannot fall out again straight after making up', () => {
    const f = make();
    later(f);
    f.begin('digs', 'amy');
    f.update(1000);
    expect(f.add('borrow')).toBeNull();
    expect(f.add('borrow')).toBeNull();
    expect(f.active).toBe(false);
    f.update(200);
    expect(f.add('borrow')?.type).toBe('fellOut');
  });

  it('runs down faster while they are stood together', () => {
    const f = make();
    f.begin('digs', 'amy');
    f.update(10, true);
    expect(f.remaining).toBe(300 - 40);
  });

  it('siding with a girl needs her side first and keeps them apart longer', () => {
    const f = make();
    f.begin('race', 'amy');
    expect(f.wantsToTell('amy')).toBe(true);
    expect(f.sideWith('amy')).toBe(false);
    f.tell('amy');
    expect(f.wantsToTell('amy')).toBe(false);
    expect(f.sideWith('amy')).toBe(true);
    expect(f.remaining).toBe(360);
  });

  it('a nudge takes a bite, and both within the window makes them up', () => {
    const f = make();
    f.begin('digs', 'amy');
    expect(f.nudge('amy')).toBeNull();
    expect(f.remaining).toBeCloseTo(300 * 0.65);
    f.update(10);
    expect(f.nudge('jess')?.type).toBe('madeUp');
    expect(f.active).toBe(false);
  });

  it('nudges too far apart do not make them up', () => {
    const f = make();
    f.begin('digs', 'amy');
    f.nudge('amy');
    f.update(60);
    expect(f.nudge('jess')).toBeNull();
    expect(f.active).toBe(true);
  });

  it('ignores friction while already fallen out', () => {
    const f = make();
    f.begin('digs', 'amy');
    expect(f.add('borrow')).toBeNull();
    expect(f.friction).toBe(0);
  });
});

describe('falling out lines', async () => {
  const { CHARACTERS } = await import('../src/npc/characters.js');
  const { BANTER } = await import('../src/npc/banterLines.js');
  const { BANTER_TIMING } = await import('../src/npc/banter.js');
  const { Companion } = await import('../src/npc/companion.js');

  it('each girl has her side for every cause, and a reply to being sided with or nudged', () => {
    for (const ch of Object.values(CHARACTERS)) {
      for (const s of ['sideRace', 'sideBorrow', 'sideDigs', 'sideThanks', 'nudged']) {
        const lines = ch.lines[s].lines;
        expect(lines.length, `${ch.id} ${s}`).toBeGreaterThanOrEqual(3);
        for (const l of lines) expect(l, l).not.toMatch(/\b(he|they)\b|—/i);
      }
    }
  });

  it('every kind of row and every apology has an exchange, and the banter kinds have timing', () => {
    for (const when of ['fellOut', 'fallenOut', 'madeUp']) expect(BANTER_TIMING[when], when).toBeDefined();
    const has = (when, roles) => BANTER.some((e) => e.when === when && Object.entries(roles).every(([k, v]) => e.roles?.[k] === v));
    for (const [kind, fault] of [['race', 'amy'], ['race', 'jess'], ['borrow', 'jess'], ['borrow', 'amy'], ['digs', 'amy'], ['digs', 'jess']]) expect(has('fellOut', { kind, fault }), `${kind} ${fault}`).toBe(true);
    for (const sorry of ['amy', 'jess']) expect(has('madeUp', { sorry }), sorry).toBe(true);
    expect(BANTER.filter((e) => e.when === 'fallenOut').length).toBeGreaterThanOrEqual(5);
  });

  it('a girl fallen out will not get on a quad her friend has claimed', () => {
    const quad = {};
    const friend = { claimedQuad: quad };
    const her = { fallenOut: () => true, others: () => [friend] };
    expect(Companion.prototype.avoidsFriendOn.call(her, quad)).toBe(true);
    expect(Companion.prototype.avoidsFriendOn.call(her, {})).toBe(false);
    her.fallenOut = () => false;
    expect(Companion.prototype.avoidsFriendOn.call(her, quad)).toBe(false);
  });
});
