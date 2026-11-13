import { describe, it, expect } from 'vitest';
import { Briefing, planBriefing, worstTrouble, yesterdayOf, weatherSituation, DEFAULT_BRIEFING_PARAMS, BRIEFING_PARAM_RANGES } from '../src/npc/briefing.js';
import { agendaKey } from '../src/npc/agenda.js';

const day = (over = {}) => ({ weather: { kind: 'sunny', band: 'mild', rain: 0, storm: 0 }, promise: null, trouble: null, agendas: { amy: 'tea', jess: 'ramp' }, ...over });

describe('weatherSituation', () => {
  it('puts storm and rain before temperature, and a mild grey day is grey', () => {
    expect(weatherSituation({ kind: 'grey', band: 'frosty', rain: 0.5, storm: 0 })).toBe('weatherRain');
    expect(weatherSituation({ kind: 'storm', band: 'mild', rain: 1, storm: 1 })).toBe('weatherStorm');
    expect(weatherSituation({ kind: 'grey', band: 'cold', rain: 0, storm: 0 })).toBe('weatherCold');
    expect(weatherSituation({ kind: 'overcast', band: 'mild', rain: 0, storm: 0 })).toBe('weatherGrey');
    expect(weatherSituation(null)).toBe(null);
  });
});

describe('worstTrouble', () => {
  const faults = (levels) => ({ started: Object.fromEntries(Object.keys(levels).map((k) => [k, true])), levels });
  it('names the quad with the worst started fault, if it is bad enough', () => {
    const f = { farm300: faults({ belt: 0.3 }), bruin: faults({ chain: 0.7 }), rb300: { started: {}, levels: { belt: 0.9 } } };
    expect(worstTrouble(f, ['belt', 'chain'], 0.25)).toBe('bruin');
    expect(worstTrouble(f, ['belt', 'chain'], 0.8)).toBe(null);
  });
});

describe('planBriefing', () => {
  it('opens, gives the weather, then what is wrong or that nothing is, then each girl\'s plan', () => {
    const keys = planBriefing(day()).map((s) => `${s.girl}:${s.key}`);
    expect(keys).toEqual(['amy:briefingOpen', 'amy:weatherSunny', 'amy:briefingAllWell', `amy:${agendaKey('tea')}`, `jess:${agendaKey('ramp')}`]);
  });
  it('adds the board and names the quad playing up', () => {
    const steps = planBriefing(day({ promise: { worse: true }, trouble: 'rb300' }));
    expect(steps.map((s) => s.key)).toContain('forecastWorse');
    expect(steps.find((s) => s.key === 'briefingTrouble').quad).toBe('rb300');
    expect(steps.map((s) => s.key)).not.toContain('briefingAllWell');
  });
  it('skips a girl with nothing in mind', () => {
    expect(planBriefing(day({ agendas: { amy: null, jess: null } })).some((s) => s.agenda)).toBe(false);
  });
});

describe('Briefing', () => {
  const p = { ...DEFAULT_BRIEFING_PARAMS };
  const steps = [{ girl: 'amy', key: 'a' }, { girl: 'jess', key: 'b' }];
  it('is due once after briefingAfter seconds, and not when off', () => {
    const b = new Briefing(p);
    expect(b.due(p.briefingAfter - 1)).toBe(false);
    expect(b.due(2)).toBe(true);
    b.begin(steps);
    expect(b.due(100)).toBe(false);
    expect(new Briefing({ ...p, briefingOn: 0 }).due(1000)).toBe(false);
  });
  it('says a part at a time, waiting for quiet and the gap, then finishes', () => {
    const b = new Briefing(p);
    b.begin(steps);
    const can = () => true;
    expect(b.next(0.1, false, can)).toBe(null);
    expect(b.next(0.1, true, can).key).toBe('a');
    expect(b.next(0.1, true, can)).toBe(null); // the gap
    expect(b.next(p.briefingGap, true, can).key).toBe('b');
    expect(b.next(0.1, true, can)).toBe(null);
    expect(b.active).toBe(false);
  });
  it('drops a part nobody can say for briefingGiveUp seconds', () => {
    const b = new Briefing(p);
    b.begin(steps);
    expect(b.next(p.briefingGiveUp, true, (g) => g === 'jess')).toBe(null);
    expect(b.next(0.1, true, (g) => g === 'jess').key).toBe('b');
  });
  it('has a range for every param', () => {
    for (const k of Object.keys(DEFAULT_BRIEFING_PARAMS)) expect(BRIEFING_PARAM_RANGES[k]).toBeTruthy();
  });
});

describe('yesterdayOf', () => {
  const key = { keyOn: true, running: false, engine: {} };
  it('says nothing on a new farm or a quiet night', () => {
    expect(yesterdayOf(null)).toEqual([]);
    expect(yesterdayOf({ girls: { fallenOut: false }, vehicles: { farm300: { keyOn: false, running: false } } })).toEqual([]);
  });
  it('has Jess cut in on a falling-out that was not made up', () => {
    expect(yesterdayOf({ girls: { fallenOut: true } }).map((s) => `${s.girl}:${s.key}`)).toEqual(['amy:briefingYesterdayFallenOut', 'jess:briefingYesterdayFallenOut']);
  });
  it('mentions a key left on with the engine stopped, but not a running engine or a battery out of the quad', () => {
    expect(yesterdayOf({ vehicles: { farm300: key } }).map((s) => s.key)).toEqual(['briefingYesterdayKey']);
    expect(yesterdayOf({ vehicles: { farm300: { ...key, running: true } } })).toEqual([]);
    expect(yesterdayOf({ vehicles: { farm300: { ...key, engine: { batteryOut: true } } } })).toEqual([]);
  });
  it('keeps to the most telling, and counts a falling-out as one thing', () => {
    const save = { girls: { fallenOut: true }, vehicles: { farm300: key } };
    expect(yesterdayOf(save).map((s) => s.key)).toEqual(['briefingYesterdayFallenOut', 'briefingYesterdayFallenOut', 'briefingYesterdayKey']);
    expect(yesterdayOf(save, 1).map((s) => s.key)).toEqual(['briefingYesterdayFallenOut', 'briefingYesterdayFallenOut']);
  });
  it('goes into the briefing after the opener and before the weather', () => {
    const keys = planBriefing(day({ yesterday: yesterdayOf({ vehicles: { farm300: key } }) })).map((s) => s.key);
    expect(keys.slice(0, 3)).toEqual(['briefingOpen', 'briefingYesterdayKey', 'weatherSunny']);
  });
});
