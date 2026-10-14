import { describe, it, expect } from 'vitest';
import { askProblems, askLine, ASK_KINDS, GIRLS_NEEDED } from '../src/npc/asking.js';

const girl = (id, extra = {}) => ({ id, name: id[0].toUpperCase() + id.slice(1), free: true, why: 'free', ...extra });
const ctx = (extra = {}) => ({ girls: [girl('amy'), girl('jess')], options: { amy: ['a', 'b'], jess: ['a', 'b'] }, busy: null, riding: true, distinct: true, ...extra });

describe('askProblems', () => {
  it('has nothing to say when it can happen', () => {
    for (const k of ASK_KINDS) expect(askProblems(k, ctx())).toEqual([]);
  });

  it('says who is busy and with what', () => {
    const c = ctx({ girls: [girl('amy', { free: false, why: 'carrying something' }), girl('jess')] });
    expect(askProblems('race', c)).toEqual(['Amy is carrying something']);
    expect(askProblems('drag', c)).toEqual([]); // Jess will do for a drag run
    expect(askProblems('climb', c)).toEqual([]);
  });

  it('needs both for the lap race, one for the others', () => {
    expect(GIRLS_NEEDED).toEqual({ race: 2, drag: 1, climb: 1, cones: 1 });
    const c = ctx({ options: { amy: [], jess: ['a'] } });
    expect(askProblems('race', c)).toEqual(['Amy has no quad she can take']);
    expect(askProblems('climb', c)).toEqual([]);
  });

  it('says so when neither has a quad or both are busy', () => {
    const c = ctx({ girls: [girl('amy', { free: false, why: 'driving' }), girl('jess')], options: { amy: ['a'], jess: [] } });
    expect(askProblems('drag', c)).toEqual(['Amy is driving', 'Jess has no quad she can take']);
  });

  it('says when they would be fighting over one quad', () => {
    expect(askProblems('race', ctx({ distinct: false }))).toEqual(['there are not two different quads for them']);
  });

  it('needs you on a quad for the races but not the climb, and reports a busy farm', () => {
    expect(askProblems('race', ctx({ riding: false }))).toEqual(['you need to be on a quad']);
    expect(askProblems('climb', ctx({ riding: false }))).toEqual([]);
    expect(askProblems('drag', ctx({ busy: 'there is a race on' }))).toEqual(['there is a race on']);
  });

  it('puts it in a line', () => {
    expect(askLine('climb', ['Jess is walking somewhere'])).toBe('The hill climb: Jess is walking somewhere');
    expect(askLine('drag', [])).toBe('The drag race: nothing in the way');
  });
});
