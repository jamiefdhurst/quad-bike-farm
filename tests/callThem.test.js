import { describe, it, expect } from 'vitest';
import { callThem, callSummary, DEFAULT_CALL_PARAMS as P, CALL_PARAM_RANGES } from '../src/npc/callThem.js';
import { yourAsks } from '../src/npc/yourAsks.js';

const girl = (id, distance, free = true) => ({ id, distance, free });

describe('calling them', () => {
  it('has a range for every param', () => {
    expect(Object.keys(CALL_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });
  it('a girl you can walk to comes, one further off answers where she is, and one out of earshot does not hear', () => {
    const a = callThem([girl('amy', 30), girl('jess', 100)]);
    expect(a).toEqual([{ id: 'amy', answer: 'come' }, { id: 'jess', answer: 'here' }]);
    expect(callThem([girl('amy', P.earshot + 1)])[0].answer).toBe('deaf');
    expect(callThem([girl('amy', P.comeWithin)])[0].answer).toBe('come');
  });
  it('a girl who cannot be broken off hears it and stays at it', () => {
    expect(callThem([girl('amy', 10, false)])[0].answer).toBe('busy');
  });
  it('says nobody hears only when no one did', () => {
    expect(callSummary(callThem([girl('amy', 500), girl('jess', 400)]))).toBe('nobody hears you');
    expect(callSummary(callThem([girl('amy', 500), girl('jess', 10)]))).toBe(null);
  });
  it('is on your wheel on foot and on a quad', () => {
    expect(yourAsks({ riding: false, near: {} }).map((a) => a.id)).toContain('call');
    expect(yourAsks({ riding: true, near: {} }).map((a) => a.id)).toContain('call');
  });
});
