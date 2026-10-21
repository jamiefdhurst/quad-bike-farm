import { describe, it, expect } from 'vitest';
import { isShowDay, isShowEve, judgeQuad, rivalEntries, placeOf, rosetteFor, slowRace, runShow, ShowKeeper, showCard, DEFAULT_SHOW_PARAMS as P, SHOW_PARAM_RANGES } from '../src/farm/showDay.js';
import { farmDate } from '../src/world/seasons.js';

const dateOf = (n) => farmDate({ start: 0, day: n });

describe('which day is the show', () => {
  it('is the last Sunday of each month and the Saturday before is the eve', () => {
    const shows = [];
    for (let n = 1; n <= 365; n++) if (isShowDay(dateOf(n))) shows.push(dateOf(n));
    expect(shows.length).toBe(12);
    const months = new Set(shows.map((d) => d.month));
    expect(months.size).toBe(12);
    for (let n = 1; n <= 365; n++) {
      if (isShowEve(dateOf(n))) expect(isShowDay(dateOf(n + 1))).toBe(true);
      if (isShowDay(dateOf(n))) expect(isShowEve(dateOf(n - 1))).toBe(true);
    }
  });
  it('has a param range for every param', () => {
    for (const k of Object.keys(P)) expect(SHOW_PARAM_RANGES[k], k).toBeTruthy();
  });
});

describe('judging', () => {
  it('gives a spotless quad ten for everything', () => {
    expect(judgeQuad({}, P)).toEqual({ clean: 10, tidy: 10, running: 10, total: 30 });
  });
  it('marks mud, wear, damage and faults down independently', () => {
    const m = judgeQuad({ mud: 0.25, bodyWear: 0.5, damage: 1, engineWear: 0.4, faults: 1 }, P);
    expect(m.clean).toBe(5);
    expect(m.tidy).toBe(5);
    expect(m.running).toBe(6);
    expect(judgeQuad({ mud: 1, bodyWear: 1, damage: 5, engineWear: 1, faults: 9, battery: 0 }, P).total).toBe(0);
  });
  it('a flat battery costs a mark', () => {
    expect(judgeQuad({ battery: 0.1 }, P).running).toBe(9);
  });
});

describe('the other entries', () => {
  it('are the same every time for a farm and month, best first and within range', () => {
    const a = rivalEntries(1234, dateOf(30), P);
    expect(rivalEntries(1234, dateOf(30), P)).toEqual(a);
    expect(rivalEntries(1234, dateOf(60), P)).not.toEqual(a);
    expect(a.length).toBe(P.rivals);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].total).toBeGreaterThanOrEqual(P.rivalMin);
      expect(a[i].total).toBeLessThanOrEqual(P.rivalMax);
      if (i) expect(a[i - 1].total).toBeGreaterThanOrEqual(a[i].total);
    }
  });
  it('places you, a tie going to you', () => {
    const r = [{ total: 20 }, { total: 15 }];
    expect(placeOf(25, r)).toBe(1);
    expect(placeOf(20, r)).toBe(1);
    expect(placeOf(16, r)).toBe(2);
    expect(placeOf(3, r)).toBe(3);
    expect(rosetteFor(9).label).toBe('Highly commended');
  });
});

describe('the show', () => {
  it('gives a full house a first and a muddy wreck a lower place', () => {
    const good = runShow({ quad: { label: 'the red quad' }, farmSeed: 5, date: dateOf(30), rnd: 0.1 });
    expect(good.place).toBe(1);
    expect(good.race.winner).toBe('amy');
    const bad = runShow({ quad: { label: 'the red quad', mud: 1, bodyWear: 1, engineWear: 1, faults: 3 }, farmSeed: 5, date: dateOf(30), rnd: 0.9 });
    expect(bad.place).toBeGreaterThan(1);
    expect(bad.race.winner).toBe('jess');
    expect(slowRace(0.5).loser).toBe('jess');
  });
  it('with no quad there is no place but the girls still race', () => {
    const s = runShow({ quad: null, farmSeed: 5, date: dateOf(30), rnd: 0.5 });
    expect(s.place).toBeNull();
    expect(showCard(s).headline).toMatch(/did not enter/);
  });
  it('the card says what you got and who won', () => {
    const s = runShow({ quad: { label: 'the red quad' }, farmSeed: 5, date: dateOf(30), rnd: 0.1 });
    const c = showCard(s);
    expect(c.headline).toBe('First of 5: the red quad');
    expect(c.race).toBe('Amy won the slow race. Jess put a foot down.');
  });
});

describe('what the farm keeps', () => {
  it('keeps a rosette a day, replaces a second go and round-trips', () => {
    const k = new ShowKeeper(P);
    const s = runShow({ quad: { label: 'x' }, farmSeed: 5, date: dateOf(30), rnd: 0.1 });
    k.add(30, dateOf(30), s);
    k.add(30, dateOf(30), s);
    expect(k.results.length).toBe(1);
    expect(k.judgedOn(30)).toBe(true);
    expect(k.wins()).toBe(1);
    const j = new ShowKeeper(P);
    j.restore(JSON.parse(JSON.stringify(k.toJSON())));
    expect(j.shelf()[0].place).toBe(1);
    j.restore('rubbish');
    expect(j.results.length).toBe(1);
  });
  it('ignores a no-entry result and caps the list', () => {
    const k = new ShowKeeper({ ...P, keptResults: 3 });
    k.add(1, dateOf(1), runShow({ quad: null, farmSeed: 1, date: dateOf(1), rnd: 0 }));
    expect(k.results.length).toBe(0);
    for (let d = 1; d <= 5; d++) k.add(d, dateOf(d), runShow({ quad: { label: 'x' }, farmSeed: 1, date: dateOf(d), rnd: 0 }));
    expect(k.results.map((r) => r.day)).toEqual([3, 4, 5]);
  });
});
