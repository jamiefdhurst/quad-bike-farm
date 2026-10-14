import { describe, it, expect } from 'vitest';
import { groupWheelOptions } from '../src/interaction/wheelGroups.js';

const opt = (label, group) => ({ label, group, run: () => {} });

describe('groupWheelOptions', () => {
  it('folds each group into one slice where its first member was', () => {
    const out = groupWheelOptions([opt('Come here'), opt('Tractor', 'Other vehicles'), opt('Red', 'Quads'), opt('Blue', 'Quads'), opt('UTV', 'Other vehicles'), opt('Stop')]);
    expect(out.map((o) => o.label)).toEqual(['Come here', 'Other vehicles', 'Quads', 'Stop']);
    expect(out[1].children.map((o) => o.label)).toEqual(['Tractor', 'UTV']);
    expect(out[2].children.map((o) => o.label)).toEqual(['Red', 'Blue']);
  });
  it('leaves a group of one as it was, without the tag', () => {
    const out = groupWheelOptions([opt('Come here'), opt('Red', 'Quads')]);
    expect(out.map((o) => o.label)).toEqual(['Come here', 'Red']);
  });
  it('drops the tag from the folded members', () => {
    const out = groupWheelOptions([opt('Red', 'Quads'), opt('Blue', 'Quads')]);
    expect(out[0].children.every((o) => !('group' in o))).toBe(true);
  });
  it('keeps options without a group untouched', () => {
    const a = opt('a');
    expect(groupWheelOptions([a])[0]).toBe(a);
  });
});
