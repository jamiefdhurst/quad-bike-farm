import { describe, it, expect } from 'vitest';
import { append, entry, latest, trend } from '../tools/budgetHistory.mjs';

const at = (sha, calls, tri = 3e6) => entry({ sha, label: `merge ${sha}`, at: '2026-10-26' }, { spawn: { calls, triangles: tri }, yard: { calls: calls + 500, triangles: tri } });

describe('the budget history', () => {
  it('rounds the numbers and shortens the commit', () => {
    expect(entry({ sha: 'abcdef0123456', label: 'x', at: 't' }, { spawn: { calls: 1999.6, triangles: 3384000.2 } })).toEqual({ at: 't', sha: 'abcdef0', label: 'x', spots: { spawn: { calls: 2000, triangles: 3384000 } } });
  });

  it('adds to the end, replaces a commit seen before, and keeps only the last few', () => {
    let h = [];
    for (const s of ['aaaaaaa', 'bbbbbbb', 'ccccccc']) h = append(h, at(s, 2000), 2);
    expect(h.map((x) => x.sha)).toEqual(['bbbbbbb', 'ccccccc']);
    h = append(h, at('ccccccc', 2100), 2);
    expect(h.map((x) => x.sha)).toEqual(['bbbbbbb', 'ccccccc']);
    expect(h[1].spots.spawn.calls).toBe(2100);
  });

  it('shows the last ten merges for each spot with the change over them', () => {
    let h = [];
    for (let i = 0; i < 12; i++) h = append(h, at(`sha${String(i).padStart(4, '0')}`, 2000 + i * 10, 3e6 + i * 1e4));
    const t = trend(h, 10);
    expect(t).toContain('Last 10 merges');
    expect(t).toContain('| spawn | 2,020 → 2,110 |');
    expect(t).toContain('+90');
    expect(t).toContain('| yard | 2,520 → 2,610 |');
  });

  it('says nothing until there are two merges to compare', () => {
    expect(trend([at('aaaaaaa', 2000)])).toBe('');
    expect(trend([])).toBe('');
  });

  it('gives the newest merge as main to compare a pull request with', () => {
    expect(latest([])).toBeNull();
    expect(latest(undefined)).toBeNull();
    const h = append(append([], at('aaaaaaa', 2000)), at('bbbbbbb', 2100));
    expect(latest(h)).toEqual({ sha: 'bbbbbbb', spots: { spawn: { calls: 2100, triangles: 3e6 }, yard: { calls: 2600, triangles: 3e6 } } });
  });
});
