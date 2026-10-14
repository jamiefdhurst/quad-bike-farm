import { describe, it, expect } from 'vitest';
import { dayRecap, todaysLog, DayRecap } from '../src/farm/dayRecap.js';
import { DEFAULT_FARM_PARAMS } from '../src/farm/farmSave.js';
import { formatEntry } from '../src/workshop/logbook.js';

const p = DEFAULT_FARM_PARAMS;

describe('the day recap card', () => {
  it('keeps the last few log lines and counts the rest', () => {
    const entries = Array.from({ length: 9 }, (_, i) => `line ${i}`);
    const r = dayRecap({ day: 4, entries }, p);
    expect(r.title).toBe('Day 4');
    expect(r.log).toHaveLength(p.recapLogLines);
    expect(r.log.at(-1)).toBe('line 8');
    expect(r.logMore).toBe(9 - p.recapLogLines);
  });

  it('lists what was ticked off today with the running total', () => {
    const r = dayRecap({ day: 2, ticked: ['Airborne', 'Stuck fast'], score: { count: 14, totalCount: 60 } }, p);
    expect(r.ticked).toEqual(['Airborne', 'Stuck fast']);
    expect(r.total).toBe('14 of 60 on the bucket list');
  });

  it('says how far you rode and how often you stuck, only when worth saying', () => {
    expect(dayRecap({ day: 1, metres: 20 }, p).facts).toEqual([]);
    expect(dayRecap({ day: 1, metres: 1840, bogs: 2 }, p).facts).toEqual(['1.8 km ridden', 'stuck 2 times']);
    expect(dayRecap({ day: 1, metres: 300, bogs: 1 }, p).facts).toEqual(['300 m ridden', 'stuck once']);
  });

  it("leaves out earlier days' entries and the buzz ranking", () => {
    const entries = [
      { time: 10, quad: 'Red', text: 'oil topped up', by: null, day: 3 },
      { time: -1, quad: 'Blue', text: 'belt slipping', by: null, day: 2, old: true },
      { time: 20, quad: null, text: 'Buzz ranking: Red', by: null, day: 3, ranking: true },
    ];
    expect(todaysLog(entries, formatEntry, 3)).toEqual(['0:10  Red, oil topped up.']);
  });

  it('ignores a press until the lock is over, then dismisses once', () => {
    const c = new DayRecap();
    expect(c.active).toBe(false);
    c.open();
    expect(c.dismiss(p)).toBe(false);
    c.update(p.recapLock + 0.1);
    expect(c.dismiss(p)).toBe(true);
    expect(c.active).toBe(false);
    expect(c.dismiss(p)).toBe(false);
  });
});
