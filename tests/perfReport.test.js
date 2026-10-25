import { describe, expect, it } from 'vitest';
import { change, combineRuns, overBudget, report, verdict } from '../tools/perfReport.mjs';

const spot = (calls, ms, extra = {}) => ({ calls, triangles: 3e6, ms, worstMs: ms * 2, ...extra });

describe('perf report', () => {
  it('keeps the median of each number across runs', () => {
    const m = combineRuns([
      { load: { readyS: 2.0, mb: 30 }, spots: { spawn: spot(2000, 6, { slowest: [{ name: 'a', ms: 1 }] }) } },
      { load: { readyS: 2.4, mb: 30 }, spots: { spawn: spot(2000, 9, { slowest: [{ name: 'b', ms: 1 }] }) } },
      { load: { readyS: 2.2, mb: 30 }, spots: { spawn: spot(2000, 7, { slowest: [{ name: 'c', ms: 1 }] }) } },
    ]);
    expect(m.load.readyS).toBe(2.2);
    expect(m.spots.spawn.ms).toBe(7);
    expect(m.spots.spawn.slowest[0].name).toBe('c'); // from the run nearest the median
  });

  it('calls a change inside the noise the same', () => {
    expect(change(5.1, 5.0, 0.3)).toBe('same'); // within the noise given
    expect(change(4.0, 5.0, 0.3)).toBe('-1, -20%');
    expect(change(5, undefined, 0.3)).toBe('');
  });

  it('says whether a change helped', () => {
    const before = { load: { readyS: 2 }, spots: { spawn: spot(2000, 6) } };
    expect(verdict({ load: { readyS: 2 }, spots: { spawn: spot(1500, 6) } }, before)).toBe('better');
    expect(verdict({ load: { readyS: 2.5 }, spots: { spawn: spot(2000, 6) } }, before)).toBe('worse');
    expect(verdict({ load: { readyS: 2.5 }, spots: { spawn: spot(1500, 6) } }, before)).toBe('mixed');
    expect(verdict({ load: { readyS: 2.1 }, spots: { spawn: spot(2010, 6.8) } }, before)).toBe('same');
  });

  it('flags the local budgets as well as the frame budget', () => {
    const over = overBudget({ load: { readyS: 3 }, spots: { spawn: spot(2700, 9) } });
    expect(over.some((l) => l.includes('calls'))).toBe(true);
    expect(over.some((l) => l.includes('ms a frame'))).toBe(true);
    expect(over.some((l) => l.includes('to Ready'))).toBe(true);
  });

  it('writes a before-and-after table', () => {
    const t = report({ load: { readyS: 2, mb: 30 }, spots: { spawn: spot(1500, 6) } }, { load: { readyS: 2, mb: 30 }, spots: { spawn: spot(2000, 6) } });
    expect(t).toContain('| spawn | 2,000 → 1,500 (-500, -25%)');
    expect(t).toContain('Overall: better.');
  });
});
