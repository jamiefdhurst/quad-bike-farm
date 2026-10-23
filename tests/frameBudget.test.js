import { describe, it, expect } from 'vitest';
import { BUDGETS, KNOWN_OVER, SPOTS, check, summary } from '../tools/frameBudget.mjs';

const under = () => Object.fromEntries(SPOTS.map((s) => [s, { calls: BUDGETS[s].calls - 10, triangles: BUDGETS[s].triangles - 1000 }]));

describe('the frame budget', () => {
  it('passes when every spot is under', () => {
    const r = check(under());
    expect(r.failures).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.rows).toHaveLength(SPOTS.length);
  });

  it('fails a spot over on calls or on triangles, naming it', () => {
    const m = under();
    m.yard = { calls: BUDGETS.yard.calls + 1, triangles: 0 };
    m.wood = { calls: 0, triangles: BUDGETS.wood.triangles + 1 };
    const r = check(m);
    expect(r.failures).toHaveLength(2);
    expect(r.failures[0]).toContain('yard');
    expect(r.failures[1]).toContain('wood');
  });

  it('reports a known overrun without failing on it', () => {
    const m = under();
    m.spawn = { calls: BUDGETS.spawn.calls * 2, triangles: 0 };
    const r = check(m, BUDGETS, ['spawn']);
    expect(r.failures).toEqual([]);
    expect(r.rows.find((x) => x.spot === 'spawn')).toMatchObject({ known: true });
    expect(r.rows.find((x) => x.spot === 'spawn').over).toHaveLength(1);
  });

  it('fails a known overrun once it is struck from the list', () => {
    const m = under();
    m.spawn = { calls: BUDGETS.spawn.calls * 2, triangles: 0 };
    expect(check(m, BUDGETS, []).failures).toHaveLength(1);
  });

  it('lists a spot that was not measured', () => {
    const m = under();
    delete m.village;
    expect(check(m).missing).toEqual(['village']);
  });

  it('keeps spawn at the budget the game has had since it was set', () => {
    expect(BUDGETS.spawn).toEqual({ calls: 2600, triangles: 3.5e6 });
  });

  it('only knows overruns for spots that have a budget', () => {
    for (const k of KNOWN_OVER) expect(BUDGETS[k]).toBeDefined();
  });

  it('prints each spot with the change from main', () => {
    const m = under();
    const main = { ...under(), yard: { calls: m.yard.calls - 100, triangles: m.yard.triangles } };
    const text = summary(m, main);
    expect(text).toContain('| yard |');
    expect(text).toContain('(+100)');
    expect(text).toContain('(same)');
    expect(text).not.toContain('No numbers from main');
  });

  it('says so without main\'s numbers, and flags what is over', () => {
    const m = under();
    m.hilltop = { calls: 1e5, triangles: 1 };
    const text = summary(m);
    expect(text).toContain('No numbers from main');
    expect(text).toContain('Over budget: hilltop');
  });
});
