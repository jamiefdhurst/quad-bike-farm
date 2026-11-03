import { describe, it, expect } from 'vitest';
import { DrivingTest, DEFAULT_DRIVING_TEST_PARAMS, DRIVING_TEST_PARAM_RANGES } from '../src/npc/drivingTest.js';

const make = (random = () => 0, p = {}) => new DrivingTest({ ...DEFAULT_DRIVING_TEST_PARAMS, ...p }, random);
const sit = (t, day, secs = 60) => t.update(secs, { day, hour: 10, besideHer: true });

describe('Amy driving test', () => {
  it('has a range for every param', () => {
    expect(Object.keys(DRIVING_TEST_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_DRIVING_TEST_PARAMS).sort());
  });

  it('counts a practice only after you have sat beside her long enough', () => {
    const t = make();
    expect(t.update(10, { day: 1, hour: 10, besideHer: true })).toEqual([]);
    expect(t.update(1, { day: 1, hour: 10, besideHer: false })).toEqual([]);
    expect(t.sat).toBe(0);
    expect(sit(t, 1)[0]).toMatchObject({ type: 'practice', n: 1 });
  });

  it('counts at most one practice a day', () => {
    const t = make();
    sit(t, 1);
    t.goBegan();
    expect(sit(t, 1)).toEqual([]);
    expect(t.practices).toBe(1);
    expect(t.wantsPractice(1)).toBe(false);
    expect(t.wantsPractice(2)).toBe(true);
  });

  it('books the test after the last practice she needs', () => {
    const t = make(() => 0);
    for (let d = 1; d <= 3; d++) sit(t, d), t.goBegan();
    const ev = sit(t, 4);
    expect(ev.map((e) => e.type)).toEqual(['practice', 'booked']);
    expect(t.stage).toBe('booked');
    expect(t.testDay).toBe(4 + DEFAULT_DRIVING_TEST_PARAMS.bookGapMin);
  });

  it('is nervous the evening before, once', () => {
    const t = make();
    t.stage = 'booked';
    t.testDay = 6;
    expect(t.update(1, { day: 5, hour: 12 })).toEqual([]);
    expect(t.update(1, { day: 5, hour: 18 })).toEqual([{ type: 'nervous', girl: 'amy' }]);
    expect(t.update(1, { day: 5, hour: 19 })).toEqual([]);
  });

  it('goes away on the test morning, and comes back with a result', () => {
    const t = make(() => 0);
    t.stage = 'booked';
    t.testDay = 6;
    expect(t.startDay(5)).toEqual([]);
    expect(t.startDay(6)[0]).toMatchObject({ type: 'leaves' });
    expect(t.away).toBe(true);
    expect(t.update(10, { day: 6, hour: 9 })).toEqual([]);
    expect(t.update(200, { day: 6, hour: 9, skill: 0.5 })[0]).toMatchObject({ type: 'passed' });
    expect(t.passed).toBe(true);
    expect(t.away).toBe(false);
  });

  it('a test day missed is taken on the next morning', () => {
    const t = make();
    t.stage = 'booked';
    t.testDay = 3;
    expect(t.startDay(5)[0]).toMatchObject({ type: 'leaves' });
  });

  it('chance rises with skill and stays between 0 and 1', () => {
    const t = make();
    expect(t.chance(1)).toBeGreaterThan(t.chance(0));
    expect(t.chance(0.5)).toBeCloseTo(0.7, 5);
    expect(make(() => 0, { passBase: 2 }).chance(1)).toBe(1);
  });

  it('a fail sends her back for fewer practices, and she can fail again', () => {
    const t = make(() => 0.99);
    t.stage = 'booked';
    t.testDay = 2;
    t.startDay(2);
    const ev = t.update(500, { day: 2, hour: 9, skill: 0.5 });
    expect(ev[0]).toMatchObject({ type: 'failed', fails: 1 });
    expect(t.stage).toBe('learning');
    expect(t.need).toBe(DEFAULT_DRIVING_TEST_PARAMS.retryPractices);
    sit(t, 3);
    t.goBegan();
    expect(sit(t, 4).map((e) => e.type)).toEqual(['practice', 'booked']);
    t.startDay(t.testDay);
    expect(t.update(500, { day: 9, hour: 9, skill: 0 })[0]).toMatchObject({ type: 'failed', fails: 2 });
  });

  it('once passed, nothing more happens', () => {
    const t = make();
    t.reset('passed');
    expect(sit(t, 1)).toEqual([]);
    expect(t.startDay(9)).toEqual([]);
    expect(t.wantsPractice(1)).toBe(false);
    expect(t.skip(1)).toEqual([]);
  });

  it('skip carries on to the next beat', () => {
    const t = make();
    expect(t.skip(1)[0]).toMatchObject({ type: 'practice' });
    t.stage = 'booked';
    t.testDay = 9;
    expect(t.skip(2)[0]).toMatchObject({ type: 'leaves' });
    expect(t.skip(2)[0]).toMatchObject({ type: 'passed' });
  });

  it('is kept and restored, and ignores junk', () => {
    const t = make(() => 0);
    t.stage = 'booked';
    t.testDay = 7;
    t.practices = 4;
    t.fails = 1;
    const back = make();
    back.restore(JSON.parse(JSON.stringify(t.capture())));
    expect(back.capture()).toEqual(t.capture());
    const odd = make();
    odd.restore({ stage: 'nonsense', practices: 'x', fails: 2 });
    expect(odd.stage).toBe('learning');
    expect(odd.practices).toBe(0);
    expect(odd.fails).toBe(2);
    odd.restore(undefined);
  });

  it('describes where she is', () => {
    const t = make();
    expect(t.describe(1)).toContain('0 of 4');
    t.stage = 'booked';
    t.testDay = 1;
    expect(t.describe(1)).toContain('today');
  });
});
