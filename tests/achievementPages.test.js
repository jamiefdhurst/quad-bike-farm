import { describe, it, expect } from 'vitest';
import { paginate, spreads } from '../src/achievements/pages.js';
import { Achievements } from '../src/achievements/achievements.js';

const item = (group, i, available = true) => ({ id: `${group}${i}`, group, name: `n${i}`, hint: 'h', points: 1, done: false, available });

describe('notebook pages', () => {
  it('never puts more than the row limit on a page and keeps every available entry once', () => {
    const entries = new Achievements({ fleet: ['farm300', 'bruin', 'hartley', 'yak', 'tor'] }).entries();
    const pages = paginate(entries, 11);
    for (const p of pages) expect(p.lines.length).toBeLessThanOrEqual(11);
    const ids = pages.flatMap((p) => p.lines.filter((l) => l.entry).map((l) => l.entry.id));
    expect(ids).toEqual(entries.filter((e) => e.available).map((e) => e.id));
  });

  it('starts every page with a heading, marking a group that runs on', () => {
    const entries = [...Array.from({ length: 8 }, (_, i) => item('A', i)), ...Array.from({ length: 4 }, (_, i) => item('B', i))];
    const pages = paginate(entries, 6);
    for (const p of pages) expect(p.lines[0].heading).toBeDefined();
    expect(pages[1].lines[0].heading).toBe('A (cont.)');
  });

  it('does not leave a heading stranded at the foot of a page', () => {
    const entries = [...Array.from({ length: 4 }, (_, i) => item('A', i)), item('B', 0), item('B', 1)];
    const pages = paginate(entries, 6);
    expect(pages[0].lines.at(-1).entry).toBeDefined();
    expect(pages[1].lines[0].heading).toBe('B');
  });

  it('leaves out unavailable entries and pairs pages into spreads', () => {
    const pages = paginate([item('A', 0), item('A', 1, false)], 6);
    expect(pages[0].lines).toHaveLength(2);
    expect(spreads([1, 2, 3])).toEqual([[1, 2], [3, null]]);
  });
});

describe('notebook pages, groups kept whole', () => {
  it('starts a short group on a new page rather than splitting it', () => {
    const entries = [...Array.from({ length: 3 }, (_, i) => item('A', i)), ...Array.from({ length: 4 }, (_, i) => item('B', i))];
    const pages = paginate(entries, 7);
    expect(pages).toHaveLength(2);
    expect(pages[1].lines.map((l) => l.heading ?? 'x')).toEqual(['B', 'x', 'x', 'x', 'x']);
  });
});
