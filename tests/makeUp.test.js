import { describe, it, expect } from 'vitest';
import { MakeUp, DEFAULT_MAKE_UP_PARAMS as P } from '../src/npc/makeUp.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { FallingOut } from '../src/npc/fallingOut.js';
import { CHARACTERS } from '../src/npc/characters.js';

const girl = (id, x, o = {}) => ({ id, x, z: 0, free: true, settled: true, quad: null, ...o });
const ctx = (o = {}) => ({ fallenOut: true, since: 60, fault: 'jess', girls: [girl('amy', 0), girl('jess', 10, { quad: 'farm300' })], ...o });
const keys = (out) => out.map((o) => `${o.girl}:${o.key}`);

describe('Making up', () => {
  it('offers nothing unless they are fallen out', () => {
    expect(new MakeUp().offers(ctx({ fallenOut: false }))).toEqual([]);
  });

  it('lets the girl at fault make the first move, and the other only later', () => {
    const m = new MakeUp();
    expect(keys(m.offers(ctx({ since: P.firstAfter - 1 })))).toEqual([]);
    expect(keys(m.offers(ctx({ since: P.firstAfter + 1 })))).toEqual(['jess:makeUpTea', 'jess:makeUpQuad']);
    expect(keys(m.offers(ctx({ since: P.firstAfter + P.otherAfter + 1 })))).toEqual(['amy:makeUpTea', 'jess:makeUpTea', 'jess:makeUpQuad']);
  });

  it('only offers a quad she has to give, and every offer meets a need', () => {
    const out = new MakeUp().offers(ctx({ since: 500 }));
    expect(keys(out)).not.toContain('amy:makeUpQuad');
    expect(out.find((o) => o.key === 'makeUpQuad').quad).toBe('farm300');
    for (const o of out) expect(Object.keys(OFFER_KINDS[o.key].satisfies)).toContain('company');
  });

  it('needs her free and her friend about to walk up to', () => {
    const m = new MakeUp();
    expect(m.offers(ctx({ girls: [girl('amy', 0), girl('jess', 10, { free: false })] }))).toEqual([]);
    expect(m.offers(ctx({ girls: [girl('amy', 0, { settled: false }), girl('jess', 10)] }))).toEqual([]);
    expect(m.offers(ctx({ girls: [girl('amy', 0), girl('jess', P.range + 5)] }))).toEqual([]);
  });

  it('books her on her way, and a turned-down offer is not repeated for a while', () => {
    const m = new MakeUp({ ...P, acceptChance: 0 });
    const [tea] = m.offers(ctx());
    expect(m.take(tea)).toEqual({ type: 'makeUp', how: 'tea', girl: 'jess', friend: 'amy', quad: null });
    expect(m.busy('jess')).toBe(true);
    expect(m.offers(ctx())).toEqual([]);
    expect(m.offered('jess')).toBe(false);
    expect(m.offers(ctx())).toEqual([]);
    m.update(P.refusedCooldown + 1);
    expect(keys(m.offers(ctx()))).toContain('jess:makeUpTea');
  });

  it('takes it when the chance says so, and forgets a job that took too long', () => {
    const m = new MakeUp({ ...P, acceptChance: 1 });
    m.take(m.offers(ctx())[0]);
    expect(m.offered('jess')).toBe(true);
    m.take(m.offers(ctx())[0]);
    m.update(P.handTimeout + 1);
    expect(m.busy('jess')).toBe(false);
  });

  it('can be forced before its time (the debug panel)', () => {
    const m = new MakeUp();
    m.forced = 'amy';
    expect(keys(m.offers(ctx({ since: 0 })))).toEqual(['amy:makeUpTea']);
    m.take(m.offers(ctx({ since: 0 }))[0]);
    expect(m.forced).toBeNull();
  });

  it('never starts anything on its own', () => {
    const m = new MakeUp();
    expect(m.update(1000)).toBeUndefined();
  });

  it('is told how long the falling out has lasted', () => {
    const f = new FallingOut(['amy', 'jess']);
    f.begin('digs', 'amy');
    f.update(30);
    expect(f.elapsed).toBe(30);
    f.end();
    expect(f.elapsed).toBe(0);
  });

  it('has every girl\'s lines for it, in British English and never calling you anything but you', () => {
    for (const ch of Object.values(CHARACTERS)) {
      for (const s of ['makeUpTea', 'makeUpQuad', 'makeUpTaken', 'makeUpRefused', 'makeUpTurnedDown']) {
        const lines = ch.lines[s].lines;
        expect(lines.length, `${ch.id} ${s}`).toBeGreaterThanOrEqual(3);
        for (const l of lines) expect(l, l).not.toMatch(/\b(he|they)\b|—/i);
      }
    }
  });
});
