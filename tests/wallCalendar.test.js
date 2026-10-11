import { describe, it, expect } from 'vitest';
import { calendarPage, DAYS_PER_PAGE, MONTHS } from '../src/world/wallCalendar.js';

describe('calendarPage', () => {
  it('crosses off the days gone, circles today and leaves the rest', () => {
    const p = calendarPage(3);
    expect(p.cells.filter((c) => c.state === 'past').map((c) => c.label)).toEqual([1, 2]);
    expect(p.cells.filter((c) => c.state === 'today').map((c) => c.label)).toEqual([3]);
    expect(p.cells.filter((c) => c.state === 'future')).toHaveLength(DAYS_PER_PAGE - 3);
    expect(p.month).toBe(MONTHS[0]);
  });

  it('turns the page after a full month and counts the days from one again', () => {
    const p = calendarPage(DAYS_PER_PAGE + 1);
    expect(p.month).toBe(MONTHS[1]);
    expect(p.cells[0].state).toBe('today');
    expect(p.cells.some((c) => c.state === 'past')).toBe(false);
  });

  it('keeps the last day of a page on that page', () => {
    const p = calendarPage(DAYS_PER_PAGE);
    expect(p.month).toBe(MONTHS[0]);
    expect(p.cells.at(-1).state).toBe('today');
  });

  it('starts a new year after the last month', () => {
    expect(calendarPage(MONTHS.length * DAYS_PER_PAGE + 1)).toMatchObject({ month: MONTHS[0], year: 2 });
  });

  it('copes with a missing day', () => {
    expect(calendarPage(undefined).cells[0].state).toBe('today');
  });
});
