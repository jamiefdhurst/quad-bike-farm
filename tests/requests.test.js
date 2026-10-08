import { describe, it, expect } from 'vitest';
import { Requests, DEFAULT_REQUEST_PARAMS } from '../src/npc/requests.js';

const P = DEFAULT_REQUEST_PARAMS;
const girl = (over = {}) => ({ id: 'amy', x: 5, z: 0, free: true, favourite: 'red', ...over });
const ctx = (over = {}) => ({
  you: { x: 0, z: 0, onFoot: true },
  girls: [girl()],
  quads: [{ id: 'red', x: 3, z: 3, muddy: 0.8, speed: 0, ridden: false, pillion: null }],
  can: { x: 40, z: 40, held: false },
  bales: [{ x: 100, z: 100 }],
  ...over,
});
const make = () => new Requests({ ...P, chance: 1 }, () => 0);
/** Steps to just past the first delay, returning events. */
const wait = (r, c, seconds = P.firstDelay + 6) => {
  const events = [];
  for (let t = 0; t < seconds; t++) events.push(...r.update(1, c));
  return events.flat();
};

describe('Requests', () => {
  it('asks nothing before the first delay', () => {
    const r = make();
    expect(wait(r, ctx(), P.firstDelay - 10)).toEqual([]);
  });
  it('asks to wash her favourite quad when it is muddy', () => {
    const r = make();
    const events = wait(r, ctx({ bales: [] , can: { x: 0, z: 1, held: false } }));
    expect(events[0]).toMatchObject({ type: 'ask', request: { girl: 'amy', kind: 'wash', quad: 'red' } });
    expect(r.openFor('amy')).not.toBeNull();
  });
  it('does not ask for a wash of a clean quad, or while you are riding, or when she is busy or far', () => {
    const clean = ctx({ bales: [], can: { x: 0, z: 1, held: false } });
    clean.quads[0].muddy = 0.1;
    expect(wait(make(), clean)).toEqual([]);
    expect(wait(make(), ctx({ you: { x: 0, z: 0, onFoot: false } }))).toEqual([]);
    expect(wait(make(), ctx({ girls: [girl({ free: false })] }))).toEqual([]);
    expect(wait(make(), ctx({ girls: [girl({ x: 60 })] }))).toEqual([]);
  });
  it('has one open request per girl and spaces them out', () => {
    const r = make();
    const c = ctx();
    expect(wait(r, c).filter((e) => e.type === 'ask')).toHaveLength(1);
    expect(wait(r, c, 60).filter((e) => e.type === 'ask')).toHaveLength(0);
  });
  it('counts washing the quad as done, and clears any grudge', () => {
    const r = make();
    const c = ctx({ bales: [], can: { x: 0, z: 1, held: false } });
    wait(r, c);
    r.grudges.amy = { kind: 'can', until: 1e9, told: false };
    c.quads[0].muddy = 0.02;
    const events = r.update(1, c);
    expect(events[0].type).toBe('done');
    expect(r.openFor('amy')).toBeNull();
    expect(r.grudge('amy')).toBeNull();
  });
  it('counts the can as fetched when it is by her, held or put down', () => {
    const r = make();
    const c = ctx({ quads: [], bales: [] });
    wait(r, c);
    expect(r.openFor('amy')?.kind).toBe('can');
    c.can = { x: 5, z: 1, held: true };
    c.you = { x: 3, z: 0, onFoot: true };
    expect(r.update(1, c)[0]?.type).toBe('done');
  });
  it('does not count a held can when you are far from her', () => {
    const r = make();
    const c = ctx({ quads: [], bales: [] });
    wait(r, c);
    c.can = { x: 5, z: 1, held: true };
    c.you = { x: 50, z: 0, onFoot: true };
    expect(r.update(1, c)).toEqual([]);
  });
  it('counts the bales as done with her on the back of your quad, stopped near them', () => {
    const r = make();
    const c = ctx({ quads: [{ id: 'blue', x: 3, z: 3, hasPillion: true, muddy: 0, speed: 0, ridden: false, pillion: null }], can: { x: 0, z: 1, held: false }, bales: [{ x: 50, z: 50 }] });
    wait(r, c);
    expect(r.openFor('amy')?.kind).toBe('bales');
    c.quads[0] = { ...c.quads[0], x: 52, z: 48, ridden: true, pillion: 'amy', speed: 5 };
    expect(r.update(1, c)).toEqual([]); // still moving
    c.quads[0].speed = 0.1;
    expect(r.update(1, c)[0]?.type).toBe('done');
  });
  it('lapses after a while, leaves a grudge, and the grudge fades', () => {
    const r = make();
    const c = ctx({ bales: [], can: { x: 0, z: 1, held: false } });
    wait(r, c);
    const events = wait(r, c, P.expireAfter + 5).filter((e) => e.type === 'lapsed');
    expect(events).toHaveLength(1);
    expect(r.grudge('amy')?.kind).toBe('wash');
    expect(r.refuseChance('amy')).toBe(P.grudgeRefuse);
    c.quads[0].muddy = 0.1; // nothing more to ask about while we wait out the grudge
    wait(r, c, P.grudgeFor + 5);
    expect(r.grudge('amy')).toBeNull();
    expect(r.refuseChance('amy')).toBe(0);
  });
});

describe('Requests.joiner', () => {
  const open = () => {
    const r = make();
    r.open.push({ girl: 'amy', kind: 'bales', since: 0 });
    return r;
  };
  const c = (over = {}) => ({ you: { x: 0, z: 0 }, girls: [girl()], ridden: { id: 'red', hasPillion: true, pillion: null }, ...over });
  it('sends the girl who asked once you have been on the quad a moment', () => {
    const r = open();
    expect(r.joiner(0.5, c())).toBe(null);
    expect(r.joiner(P.joinDelay, c())).toBe('amy');
    expect(r.joiner(1, c())).toBe(null); // only once per quad
  });
  it('does nothing on foot, with a taken seat, a busy or distant girl, or no open request', () => {
    expect(open().joiner(5, c({ ridden: null }))).toBe(null);
    expect(open().joiner(5, c({ ridden: { id: 'red', hasPillion: true, pillion: 'jess' } }))).toBe(null);
    expect(open().joiner(5, c({ ridden: { id: 'red', hasPillion: false, pillion: null } }))).toBe(null);
    expect(open().joiner(5, c({ girls: [girl({ free: false })] }))).toBe(null);
    expect(open().joiner(5, c({ girls: [girl({ x: 100 })] }))).toBe(null);
    expect(make().joiner(5, c())).toBe(null);
  });
  it('sends her again on a different quad', () => {
    const r = open();
    r.joiner(5, c());
    r.joiner(1, c({ ridden: null }));
    expect(r.joiner(5, c({ ridden: { id: 'blue', hasPillion: true, pillion: null } }))).toBe('amy');
  });
});
