import { describe, it, expect } from 'vitest';
import { count, line, origin, phaseLine, report, weekEnds } from '../tools/issueCount.mjs';

const now = new Date('2026-11-25T12:00:00Z');
const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
const issue = (number, milestone, opened, closed = null, body = '') => ({ number, milestone, createdAt: daysAgo(opened), closedAt: closed == null ? null : daysAgo(closed), body });

describe('where an issue came from', () => {
  it('reads a recheck from the words the commands file it with', () => {
    for (const body of ['Found by `/recheck` of #690.', 'From the recheck of #912 (PR #1145).', 'What is wrong. A recheck of #691 (PR #1068) found the gap.',
      'It reaches 2.8 m (found by the #691 recheck).', "Jamie, 20 November 2026, on #689's recheck: the track."]) {
      expect(origin(body)).toBe('recheck');
    }
  });

  it('reads a walk, a split, and anything else as new', () => {
    expect(origin("Found on Jamie's walk of Hollow Wood (#1201).")).toBe('walk');
    expect(origin("From Jamie's walk of the barn (19 November).")).toBe('walk');
    expect(origin('The gate sticks. Found testing #1153.')).toBe('walk');
    expect(origin('It is not clear what order the gates go in. (Walk of Home Ground, #669.)')).toBe('walk');
    expect(origin('Found by the review of #568 (merged in #959): the drive.')).toBe('recheck');
    expect(origin("From #671's review of Hollow Wood: the bogs.")).toBe('new');
    expect(origin('Split out of #222, which keeps the tools on the right part.')).toBe('split');
    expect(origin('Part of the split of #681 (too big for one session): the fields.')).toBe('split');
    expect(origin('A pig with split trotters.')).toBe('new');
    expect(origin(undefined)).toBe('new');
  });

  it("doesn't take a passing mention for where it came from", () => {
    expect(origin('Where the opened ones came from (a recheck, a walk, a split, new).')).toBe('new');
    expect(origin('Ride it at a walking pace. The rest is split into #816 and #817.')).toBe('new');
  });

  it('takes the first that matches, in the order recheck, walk, split', () => {
    expect(origin("Split out of #685.\n\nFound by the recheck of #672.")).toBe('recheck');
    expect(origin("Split out of #685.\n\nFound on Jamie's walk of the pit.")).toBe('walk');
  });
});

describe('the count by milestone', () => {
  const milestones = ['2 · The farmstead', '1 · The new map', '13 · Polish'];
  const issues = [
    issue(1, '1 · The new map', 30), // open all along
    issue(2, '1 · The new map', 3, null, 'Found by the recheck of #9.'), // opened this week
    issue(3, '1 · The new map', 5, 1, "Found on Jamie's walk of the lane."), // opened and closed this week
    issue(4, '1 · The new map', 20, 2), // closed this week
    issue(5, '2 · The farmstead', 10, 5), // opened last week, closed this week
    issue(6, null, 2, null, 'Split out of #4.'),
    issue(7, '0 · Foundations', 40, 3), // a closed milestone: only in All
  ];

  it('has a row for each open milestone in run order, then no milestone, then all', () => {
    expect(count(issues, milestones, { now }).map((r) => r.milestone)).toEqual(['1 · The new map', '2 · The farmstead', '13 · Polish', 'No milestone', 'All']);
    expect(count(issues.filter((i) => i.milestone), milestones, { now }).map((r) => r.milestone).at(-2)).toBe('13 · Polish');
  });

  it('counts open, opened by origin and closed in the last 7 days', () => {
    const [map, farmstead, polish, none, all] = count(issues, milestones, { now });
    expect(map).toMatchObject({ openBefore: 2, open: [2], closed: [2] });
    expect(map.opened[0]).toEqual({ total: 2, recheck: 1, walk: 1, split: 0, new: 0 });
    expect(farmstead).toMatchObject({ openBefore: 1, open: [0], closed: [1] });
    expect(polish).toMatchObject({ openBefore: 0, open: [0], closed: [0] });
    expect(none.opened[0]).toMatchObject({ total: 1, split: 1 });
    expect(all).toMatchObject({ openBefore: 4, open: [3], closed: [4] });
  });

  it('prints a line for each with the change on the week', () => {
    const rows = count(issues, milestones, { now });
    expect(line(rows[0])).toBe('1 · The new map: 2 open (level on the week); 2 opened (1 recheck, 1 walk), 2 closed in the last 7 days');
    expect(line(rows[1])).toBe('2 · The farmstead: 0 open (down 1 on the week); 0 opened (none), 1 closed in the last 7 days');
    const text = report(rows, { now }).split('\n');
    expect(text[0]).toBe('Issues by milestone, the 7 days to 25 Nov:');
    expect(text).toHaveLength(rows.length + 1);
  });

  it('gives the trend week by week, oldest first, with --weeks', () => {
    expect(weekEnds(now, 2).map((d) => d.toISOString())).toEqual([daysAgo(7), now.toISOString()]);
    const rows = count(issues, milestones, { now, weeks: 2 });
    expect(rows[1]).toMatchObject({ open: [1, 0], closed: [0, 1] });
    expect(rows[1].opened.map((w) => w.total)).toEqual([1, 0]);
    expect(line(rows[0])).toBe('1 · The new map: open 2, 2; opened 0, 2 (1 recheck, 1 walk); closed 0, 2');
    expect(report(rows, { now, weeks: 2 }).split('\n')[0]).toBe('Issues by milestone, the 2 weeks to 18 Nov, 25 Nov, oldest first:');
  });

  it("names the current phase's line: the earliest milestone with an open issue", () => {
    const rows = count(issues, milestones, { now });
    expect(phaseLine(rows, issues, now)).toBe(`Current phase, ${line(rows[0])}`);
    const later = issues.filter((i) => i.milestone !== '1 · The new map');
    expect(phaseLine(count(later, milestones, { now }), later, now)).toBe('No open milestone has an open issue.');
  });
});
