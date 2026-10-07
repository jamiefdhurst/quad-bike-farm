import { describe, it, expect } from 'vitest';
import { LPlates, DEFAULT_LPLATE_PARAMS as P, meanSkill } from '../src/npc/lPlates.js';

const ctx = (over = {}) => ({ amyFree: true, jessFree: true, amyByQuad: true, hasQuad: true, confidence: 0.4, tractorFree: true, ...over });
const make = (random = () => 0, over = {}) => new LPlates({ ...P, ...over }, random);
function run(l, seconds, c = ctx()) {
  const events = [];
  for (let t = 0; t < seconds; t += 1) events.push(...l.update(1, c));
  return events.map((e) => e.type);
}

describe('Jess making them', () => {
  it('waits, then tapes them to Amy\'s quad', () => {
    const l = make(() => 0, { peelMin: 1000, peelMax: 1000 });
    expect(run(l, P.firstAfter - 5)).toEqual([]);
    expect(run(l, 20)).toEqual(['jessTape']);
    expect(l.where).toBe('quad');
  });

  it('does nothing without a quad of Amy\'s or while she is busy', () => {
    for (const c of [ctx({ hasQuad: false }), ctx({ jessFree: false })]) expect(run(make(), P.firstAfter + 100, c)).toEqual([]);
  });
});

describe('Amy and the plates', () => {
  it('peels them off once she is by her quad, and they come back later', () => {
    const l = make(() => 0, { backGapMin: 100, backGapMax: 100 });
    const seen = run(l, P.firstAfter + P.peelMin + 10);
    expect(seen).toEqual(['jessTape', 'amyPeel']);
    expect(l.where).toBe('none');
    expect(run(l, 90)).toEqual([]);
    expect(run(l, 20)).toEqual(['jessTape']);
    expect(l.tapes).toBe(2);
  });

  it('leaves them alone while she is nowhere near the quad', () => {
    const l = make();
    run(l, P.firstAfter + 5);
    expect(run(l, 500, ctx({ amyByQuad: false }))).toEqual([]);
    expect(l.where).toBe('quad');
  });

  it('puts them on the tractor once she is confident, and then they stay there', () => {
    const l = make();
    run(l, P.firstAfter + 5);
    const seen = run(l, 20, ctx({ confidence: P.confident }));
    expect(seen).toEqual(['amyStick']);
    expect(l.where).toBe('tractor');
    expect(run(l, 2000, ctx({ confidence: 1 }))).toEqual([]);
    expect(l.where).toBe('tractor');
  });

  it('does not until Jess has made them, or while the tractor is spoken for', () => {
    expect(run(make(), 50, ctx({ confidence: 1 }))).toEqual([]);
    const l = make(() => 0, { peelMin: 1000, peelMax: 1000 });
    run(l, P.firstAfter + 5);
    expect(run(l, 50, ctx({ confidence: 1, tractorFree: false }))).toEqual([]);
  });
});

describe('meanSkill', () => {
  it('averages her levels', () => {
    expect(meanSkill({ a: 0.2, b: 0.6 })).toBeCloseTo(0.4);
    expect(meanSkill(undefined)).toBe(0.5);
  });
});
