import { describe, it, expect } from 'vitest';
import { calendarPage } from '../src/world/wallCalendar.js';
import { farmDate, MONTH_DAYS } from '../src/world/seasons.js';

describe('calendarPage', () => {
  it('crosses off the days gone, circles today and leaves the rest', () => {
    const date = farmDate({ start: 40, day: 1 }); // 10 February
    const p = calendarPage(date);
    expect(p.month).toBe('February');
    expect(p.cells.filter((c) => c.state === 'past')).toHaveLength(date.dom - 1);
    expect(p.cells.filter((c) => c.state === 'today').map((c) => c.label)).toEqual([date.dom]);
    expect(p.cells).toHaveLength(MONTH_DAYS[1]);
  });

  it('has the real number of days in the month and puts the days under the right weekdays', () => {
    const a = calendarPage(farmDate({ start: 0, day: 1 }));
    expect(a.cells).toHaveLength(31);
    for (const c of a.cells) expect(c.column).toBe((a.cells[0].column + c.label - 1) % 7);
    expect(Math.max(...a.cells.map((c) => c.row))).toBeLessThanOrEqual(5);
  });

  it('turns the page at the end of the month and the year at the end of December', () => {
    const last = farmDate({ start: 30, day: 1 }); // 31 January
    expect(farmDate({ start: 30, day: 2 }).monthName).toBe('February');
    expect(calendarPage(last).cells.at(-1).state).toBe('today');
    expect(calendarPage(farmDate({ start: 364, day: 2 }))).toMatchObject({ month: 'January', year: 2 });
  });
});

describe('the show on the calendar', () => {
  it('marks only the last Sunday of the month', async () => {
    const { farmDate } = await import('../src/world/seasons.js');
    for (let n = 1; n <= 365; n++) {
      const page = calendarPage(farmDate({ start: 0, day: n }));
      const shows = page.cells.filter((c) => c.show);
      expect(shows.length).toBe(1);
      expect(shows[0].column).toBe(6);
      expect(shows[0].n + 7).toBeGreaterThan(page.cells.length);
    }
  });
});
