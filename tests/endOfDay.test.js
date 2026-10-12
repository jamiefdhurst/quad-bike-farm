import { describe, it, expect } from 'vitest';
import { endOfDay, DayFade } from '../src/farm/endOfDay.js';
import { DEFAULT_FARM_PARAMS } from '../src/farm/farmSave.js';

const p = DEFAULT_FARM_PARAMS;
const home = [{ name: 'Amy', home: true }, { name: 'Jess', home: true }];
const base = { hour: 18, seeded: false, canSave: true, girls: home, day: 3 };

describe('calling it a day', () => {
  it('lets you in the evening with both girls at the barn', () => {
    const r = endOfDay(base, p);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('day 3 ends');
    expect(r.text).toContain('day 4 starts');
  });

  it('says how early it is, and when', () => {
    const r = endOfDay({ ...base, hour: 12 }, p);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('17:00');
    expect(endOfDay({ ...base, hour: p.endDayHour }, p).ok).toBe(true);
  });

  it('wants the girls in first, and names the one who is not', () => {
    const one = endOfDay({ ...base, girls: [home[0], { name: 'Jess', home: false }] }, p);
    expect(one.ok).toBe(false);
    expect(one.text).toContain('Jess');
    const both = endOfDay({ ...base, girls: home.map((g) => ({ ...g, home: false })) }, p);
    expect(both.ok).toBe(false);
    expect(both.text).toContain('bell');
  });

  it('does not carry a seeded game, or one the browser will not save, to another day', () => {
    expect(endOfDay({ ...base, seeded: true }, p).ok).toBe(false);
    expect(endOfDay({ ...base, canSave: false }, p).ok).toBe(false);
  });

  it('works on after midnight, the night going on', () => {
    expect(endOfDay({ ...base, hour: 25.5 }, p).ok).toBe(true);
  });
});

describe('the fade to the next day', () => {
  it('does nothing until it starts', () => {
    const f = new DayFade();
    expect(f.active).toBe(false);
    expect(f.update(5, p)).toEqual({ alpha: 0, done: false });
  });

  it('goes black over the fade, holds, then is done', () => {
    const f = new DayFade();
    f.start();
    expect(f.active).toBe(true);
    expect(f.update(p.endDayFade / 2, p).alpha).toBeCloseTo(0.5);
    expect(f.update(p.endDayFade / 2, p)).toEqual({ alpha: 1, done: false });
    expect(f.update(p.endDayHold - 0.01, p).done).toBe(false);
    expect(f.update(0.02, p).done).toBe(true);
  });

  it('starting again while it runs does not restart it', () => {
    const f = new DayFade();
    f.start();
    f.update(1, p);
    f.start();
    expect(f.update(0, p).alpha).toBeCloseTo(1 / p.endDayFade);
  });
});
