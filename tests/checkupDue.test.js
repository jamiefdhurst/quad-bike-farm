import { describe, expect, it } from 'vitest';
import { due, lastDate } from '../tools/checkupDue.mjs';

describe('check-up reminder', () => {
  it("reads a log's last entry", () => {
    expect(lastDate('# Tidies\n\n- 2026-10-18, abc: first\n- 2026-10-25, def: second\n')).toBe('2026-10-25');
    expect(lastDate('# Tidies\n')).toBe(null);
  });

  it('is due only after a week, or when never run', () => {
    const logs = { '/tidy check': '- 2026-10-25, abc: x', '/perf check': '- 2026-10-17, abc: x' };
    expect(due(logs, '2026-11-01')).toEqual([{ name: '/perf check', days: 15 }]);
    expect(due(logs, '2026-11-02').map((d) => d.name)).toEqual(['/tidy check', '/perf check']);
    expect(due({ '/tidy check': null }, '2026-11-01')[0].days).toBe(Infinity);
  });
});
