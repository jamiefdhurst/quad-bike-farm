import { describe, it, expect } from 'vitest';
import { isShowDay, isShowEve, judgeQuad, noteText, previewText, showSpeech, rosetteSvg, rivalEntries, placeOf, rosetteFor, slowRace, runShow, ShowKeeper, showCard, DEFAULT_SHOW_PARAMS as P, SHOW_PARAM_RANGES } from '../src/farm/showDay.js';
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
    expect(judgeQuad({}, P)).toMatchObject({ clean: 10, tidy: 10, running: 10, total: 30 });
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

const you = (quad = {}, label = 'the red quad') => ({ id: 'you', name: 'You', label, quad });
const amy = (quad = {}) => ({ id: 'amy', name: 'Amy', label: 'the blue quad', quad });
const jess = (quad = {}) => ({ id: 'jess', name: 'Jess', label: 'the green quad', quad });
const MUDDY = { mud: 1, bodyWear: 1, engineWear: 1, faults: 3 };

describe('the show', () => {
  it('gives a spotless quad a first and a muddy wreck a lower place', () => {
    const good = runShow({ entries: [you()], farmSeed: 5, date: dateOf(30), rnd: 0.1 });
    expect(good.place).toBe(1);
    expect(good.race.winner).toBe('amy');
    const bad = runShow({ entries: [you(MUDDY)], farmSeed: 5, date: dateOf(30), rnd: 0.9 });
    expect(bad.place).toBeGreaterThan(1);
    expect(bad.race.winner).toBe('jess');
    expect(slowRace(0.5).loser).toBe('jess');
  });
  it('ranks the girls with you and the rivals, ties going to you then the girls', () => {
    const s = runShow({ entries: [you(), amy(), jess(MUDDY)], farmSeed: 5, date: dateOf(30), rnd: 0.1 });
    expect(s.entries).toBe(3 + P.rivals);
    expect(s.ranking.map((r) => r.place)).toEqual(s.ranking.map((_, i) => i + 1));
    expect(s.ranking[0].id).toBe('you');
    expect(s.ranking[1].id).toBe('amy');
    expect(s.girls.amy.place).toBe(2);
    expect(s.girls.jess.place).toBeGreaterThan(2);
  });
  it('with no quad there is no place but the girls still race', () => {
    const s = runShow({ entries: [], farmSeed: 5, date: dateOf(30), rnd: 0.5 });
    expect(s.place).toBeNull();
    expect(showCard(s).headline).toMatch(/did not enter/);
  });
  it('the card says what you got, why, and who won', () => {
    const s = runShow({ entries: [you({ mud: 0.25, mudBody: 0.05, mudWheels: 0.25 }), amy(), jess()], farmSeed: 5, date: dateOf(30), rnd: 0.1 });
    const c = showCard(s);
    expect(c.headline).toMatch(/^(First|Second|Third|Fourth|Highly commended)/);
    expect(c.lines[0]).toBe('Clean 5: mud on the wheels');
    expect(c.lines[1]).toBe('Tidy 10: spotless');
    expect(c.ranking.filter((r) => r.you).length).toBe(1);
    expect(c.race).toBe('Amy won the slow race. Jess put a foot down.');
    expect(c.rosette).toBe(s.rosette.rosette);
  });
});

describe('the judge\'s reasons and the preview', () => {
  it('names what cost marks', () => {
    const m = judgeQuad({ mud: 0.5, bodyWear: 0.5, damage: 2, engineWear: 0.5, fouling: 0.5, faults: 2, battery: 0.1 }, P);
    expect(m.notes.clean).toEqual(['mud on the body', 'mud on the wheels']);
    expect(m.notes.tidy).toEqual(['a worn body', '2 punctures or bent parts']);
    expect(m.notes.running).toEqual(['a worn engine', 'a fouled plug', '2 faults', 'a flat battery']);
    expect(noteText([])).toBe('spotless');
  });
  it('previews the worst mark', () => {
    expect(previewText('the red quad', judgeQuad({ mud: 0.25 }, P))).toBe('the red quad would get 25 of 30 now; clean loses most (mud on the body and mud on the wheels)');
    expect(previewText('the red quad', judgeQuad({}, P))).toBe('the red quad would get 30 of 30 now');
  });
});

describe('the rivals get better', () => {
  it('by rivalYearly a year, capped at 29', () => {
    const y1 = rivalEntries(7, dateOf(30), P);
    const y3 = rivalEntries(7, dateOf(30 + 365 * 2), P);
    const sum = (a) => a.reduce((t, r) => t + r.total, 0);
    expect(sum(y3)).toBeGreaterThan(sum(y1));
    for (const r of rivalEntries(7, dateOf(30 + 365 * 40), P)) expect(r.total).toBeLessThanOrEqual(29);
  });
});

describe('who says what over the card', () => {
  const speak = (entries, rnd) => showSpeech(runShow({ entries, farmSeed: 5, date: dateOf(30), rnd }), 3);
  it('has both girls speak of the race, then the best girl ahead of you', () => {
    const t = speak([you(MUDDY), amy(), jess()], 0.1);
    expect(t.slice(0, 2)).toEqual([{ girl: 'amy', situation: 'showSlowWon', at: 0 }, { girl: 'jess', situation: 'showSlowLost', at: 3 }]);
    expect(t[2]).toEqual({ girl: 'amy', situation: 'showAheadOfYou', at: 6 });
  });
  it('has the worst girl behind you remark if you beat them both', () => {
    const t = speak([you(), amy(MUDDY), jess({ mud: 0.5 })], 0.9);
    expect(t[2].situation).toBe('showBehindYou');
    expect(t[2].girl).toBe('amy');
  });
  it('says nothing more if you did not enter or no girl entered', () => {
    expect(speak([], 0.1).length).toBe(2);
    expect(speak([you()], 0.1).length).toBe(2);
  });
});

describe('what the farm keeps', () => {
  it('keeps a rosette a day, replaces a second go and round-trips', () => {
    const k = new ShowKeeper(P);
    const s = runShow({ entries: [you()], farmSeed: 5, date: dateOf(30), rnd: 0.1 });
    k.add(30, dateOf(30), s);
    k.add(30, dateOf(30), s);
    expect(k.results.length).toBe(1);
    expect(k.judgedOn(30)).toBe(true);
    expect(k.wins()).toBe(1);
    const j = new ShowKeeper(P);
    j.restore(JSON.parse(JSON.stringify(k.toJSON())));
    expect(j.shelf()[0].place).toBe(1);
    expect(j.recordLine()).toMatchObject({ set: true, text: '1 first, 1 placed' });
    expect(new ShowKeeper(P).recordLine()).toMatchObject({ set: false, text: 'not yet' });
    expect(rosetteSvg(0xc0281c)).toContain('#c0281c');
    j.restore('rubbish');
    expect(j.results.length).toBe(1);
  });
  it('ignores a no-entry result and caps the list', () => {
    const k = new ShowKeeper({ ...P, keptResults: 3 });
    k.add(1, dateOf(1), runShow({ entries: [], farmSeed: 1, date: dateOf(1), rnd: 0 }));
    expect(k.results.length).toBe(0);
    for (let d = 1; d <= 5; d++) k.add(d, dateOf(d), runShow({ entries: [you()], farmSeed: 1, date: dateOf(d), rnd: 0 }));
    expect(k.results.map((r) => r.day)).toEqual([3, 4, 5]);
  });
});
