import { describe, it, expect } from 'vitest';
import { createRandom } from '../src/core/random.js';
import {
  SEASONS, MONTH_DAYS, YEAR_DAYS, farmDate, startDayOfYear, dateToday, daylightFor, daylightParams, summerness,
  weatherWeights, temperatureBandWeights, groundFor,
} from '../src/world/seasons.js';
import { pickWeatherKind, pickTemperature, WEATHER_KINDS, TEMPERATURE_BANDS } from '../src/world/weather.js';
import { DEFAULT_DAYLIGHT_PARAMS } from '../src/world/daylight.js';
import { dustLevel, DEFAULT_DUST_PARAMS } from '../src/world/dust.js';

describe('the farm calendar', () => {
  it('has the real months and a 365 day year', () => {
    expect(MONTH_DAYS.reduce((a, b) => a + b, 0)).toBe(YEAR_DAYS);
    expect(farmDate({ start: 0, day: 1 })).toMatchObject({ month: 0, dom: 1, monthName: 'January', season: 'winter', year: 1 });
    expect(farmDate({ start: 0, day: 32 })).toMatchObject({ monthName: 'February', dom: 1 });
    expect(farmDate({ start: 0, day: 60 })).toMatchObject({ monthName: 'March', dom: 1 }); // no 29th of February
    expect(farmDate({ start: 364, day: 1 })).toMatchObject({ monthName: 'December', dom: 31 });
    expect(farmDate({ start: 364, day: 2 })).toMatchObject({ monthName: 'January', dom: 1, year: 2 });
  });

  it('goes through the four seasons in order over a year', () => {
    const seen = [];
    for (let d = 1; d <= YEAR_DAYS; d++) {
      const s = farmDate({ start: 59, day: d }).season; // starts 1 March
      if (seen.at(-1) !== s) seen.push(s);
    }
    expect(seen).toEqual(['spring', 'summer', 'autumn', 'winter']);
  });

  it('starts a farm on a date dealt from its seed, the same every time and different between farms', () => {
    expect(startDayOfYear(123, createRandom)).toBe(startDayOfYear(123, createRandom));
    const starts = new Set();
    for (let i = 1; i <= 200; i++) {
      const s = startDayOfYear(i * 7919, createRandom);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(YEAR_DAYS);
      starts.add(s);
    }
    expect(starts.size).toBeGreaterThan(100);
    const seasons = new Set(Array.from({ length: 200 }, (_, i) => dateToday({ farmSeed: i * 7919, day: 1, createRandom }).season));
    expect(seasons.size).toBe(4);
  });

  it('can be forced to a season, and keeps to it', () => {
    for (const s of SEASONS) expect(dateToday({ farmSeed: 1, day: 5, forced: s, createRandom }).season).toBe(s);
    expect(dateToday({ farmSeed: 1, day: 5, forced: 'nonsense', createRandom }).season).toBe(dateToday({ farmSeed: 1, day: 5, createRandom }).season);
  });
});

describe('the daylight through the year', () => {
  it('is shortest in January and longest in July, with nothing odd between', () => {
    const len = (d) => daylightFor(d).sunset - daylightFor(d).sunrise;
    expect(len(354)).toBeLessThan(7.9);
    expect(len(171)).toBeGreaterThan(16);
    expect(len(287)).toBeGreaterThan(9);
    expect(len(287)).toBeLessThan(11);
    for (let d = 1; d < YEAR_DAYS; d++) expect(Math.abs(len(d) - len(d - 1))).toBeLessThan(0.3);
    expect(summerness(171)).toBeGreaterThan(0.99);
    expect(summerness(354)).toBeLessThan(0.01);
  });

  it('keeps a game from starting in the dark', () => {
    for (let d = 0; d < YEAR_DAYS; d += 5) {
      const p = daylightParams(DEFAULT_DAYLIGHT_PARAMS, { dayOfYear: d });
      expect(p.startLatest).toBeLessThanOrEqual(p.sunset - 1.5);
      expect(p.startEarliest).toBeLessThan(p.startLatest);
    }
  });
});

describe('what a season does to the day', () => {
  const count = (season, kind) => {
    const r = createRandom(5);
    let n = 0;
    for (let i = 0; i < 6000; i++) if (pickWeatherKind(r, weatherWeights(season)) === kind) n++;
    return n;
  };

  it('has snow in winter and never in summer', () => {
    expect(count('winter', 'snow')).toBeGreaterThan(count('autumn', 'snow') * 5);
    expect(count('summer', 'snow')).toBe(0);
  });

  it('has more rain and fog in the autumn and winter than in summer, and more storms in summer', () => {
    expect(count('autumn', 'rain')).toBeGreaterThan(count('summer', 'rain'));
    expect(count('winter', 'fog')).toBeGreaterThan(count('summer', 'fog'));
    expect(count('summer', 'storm')).toBeGreaterThan(count('winter', 'storm'));
  });

  it('is warm in summer and never frosty, and cold in winter and never warm', () => {
    const temps = (season) => {
      const r = createRandom(9);
      return Array.from({ length: 2000 }, () => pickTemperature('sunny', r, temperatureBandWeights(season)));
    };
    const summer = temps('summer');
    const winter = temps('winter');
    expect(Math.min(...summer)).toBeGreaterThan(TEMPERATURE_BANDS.cold[0]);
    expect(Math.max(...summer)).toBeGreaterThan(22);
    expect(Math.max(...winter)).toBeLessThanOrEqual(TEMPERATURE_BANDS.mild[1]);
    expect(Math.min(...winter)).toBeLessThan(0);
    expect(winter.filter((t) => t > 15).length).toBe(0);
  });

  it('never makes a hot day without the summer, and a plain pick is as it was', () => {
    const r = createRandom(2);
    for (let i = 0; i < 1000; i++) expect(pickTemperature('sunny', r)).toBeLessThanOrEqual(TEMPERATURE_BANDS.warm[1]);
  });

  it('only has weights for weather kinds that exist', () => {
    for (const s of SEASONS) for (const k of Object.keys(weatherWeights(s))) expect(WEATHER_KINDS[k]).toBeTruthy();
  });

  it('keeps winter ground damper and summer stubble dustier', () => {
    expect(groundFor('winter').wet).toBeGreaterThan(groundFor('summer').wet);
    const p = { ...DEFAULT_DUST_PARAMS };
    const dry = (season) => dustLevel({ ...p, seasonDust: groundFor(season).dust }, 0.6, 0, 8);
    expect(dry('summer')).toBeGreaterThan(dry('autumn'));
    expect(dry('winter')).toBeLessThan(dry('spring'));
    expect(dustLevel(p, 1, 0, 100)).toBeLessThanOrEqual(1);
  });
});

describe('what the girls say about the time of year', () => {
  it('has a line for each season for both girls, in British English with no em dashes', async () => {
    const { VOICE_LINES } = await import('../src/npc/voiceLines.js');
    const { JESS_LINES } = await import('../src/npc/jessLines.js');
    const { SEASON_SITUATIONS } = await import('../src/npc/seasonLines.js');
    for (const season of SEASONS) {
      const key = SEASON_SITUATIONS[season];
      const amy = VOICE_LINES[key].lines;
      const jess = JESS_LINES[key].lines ?? JESS_LINES[key];
      expect(amy.length).toBeGreaterThan(0);
      expect(jess.length).toBeGreaterThan(0);
      for (const l of [...amy, ...jess]) expect(l).not.toMatch(/—|\b(he|she|they)\b/i);
    }
  });
});
