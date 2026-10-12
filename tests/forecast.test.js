import { describe, it, expect } from 'vitest';
import { Forecast, dealShift, SHIFTS, SYMBOLS, SKY_RANK, KIND_WARMTH, DEFAULT_FORECAST_PARAMS, isWorse } from '../src/world/forecast.js';
import { Weather, WEATHER_KINDS } from '../src/world/weather.js';
import { baroReading } from '../src/world/weatherStation.js';

function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('the forecast', () => {
  it('only turns the weather to believable things, and never from or to snow', () => {
    for (const [from, table] of Object.entries(SHIFTS)) {
      expect(WEATHER_KINDS[from]).toBeTruthy();
      for (const to of Object.keys(table)) {
        expect(WEATHER_KINDS[to]).toBeTruthy();
        expect(to).not.toBe(from);
        expect(to).not.toBe('snow');
        expect(to).not.toBe('fog');
      }
    }
    expect(SHIFTS.snow).toBeUndefined();
    expect(SHIFTS.fog.sunny).toBeGreaterThan(0); // fog burns off
    expect(SHIFTS.sunny.fog).toBeUndefined(); // and never rolls in
    for (const k of Object.keys(WEATHER_KINDS)) expect(SYMBOLS[k] && SKY_RANK[k] !== undefined && KIND_WARMTH[k] !== undefined).toBeTruthy();
  });

  it('turns about as often as asked, inside the hours it is allowed', () => {
    const random = seeded(5);
    let turns = 0;
    for (let i = 0; i < 2000; i++) {
      const s = dealShift('sunny', 9, random);
      if (!s) continue;
      turns++;
      expect(s.at).toBeGreaterThanOrEqual(9 + DEFAULT_FORECAST_PARAMS.shiftEarliest);
      expect(s.at).toBeLessThanOrEqual(9 + DEFAULT_FORECAST_PARAMS.shiftLatest);
    }
    expect(turns / 2000).toBeCloseTo(DEFAULT_FORECAST_PARAMS.shiftChance, 1);
    expect(dealShift('snow', 9, random, DEFAULT_FORECAST_PARAMS, true)).toBeNull();
  });

  it('is repeatable from a seed, and the turn starts once at its hour', () => {
    const a = new Forecast('sunny', 9, seeded(11), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 1 });
    const b = new Forecast('sunny', 9, seeded(11), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 1 });
    expect(a.shift).toEqual(b.shift);
    expect(a.update(a.shift.at - 0.01)).toBeNull();
    const turn = a.update(a.shift.at);
    expect(turn).toMatchObject({ from: 'sunny', to: a.shift.to });
    expect(a.update(a.shift.at + 1)).toBeNull();
  });

  it('is right about whether the weather turns about as often as its accuracy', () => {
    const p = { ...DEFAULT_FORECAST_PARAMS };
    const random = seeded(23);
    let right = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const f = new Forecast('fair', 10, random, p);
      if ((f.told === null) === (f.shift === null) && f.told === f.shift) right++;
    }
    expect(right / n).toBeCloseTo(p.accuracy, 1);
  });

  it('shows three slots, says nothing different for a day that stays, and fades the ones gone by', () => {
    const f = new Forecast('sunny', 9, seeded(3), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 0, accuracy: 1 });
    const board = f.board(13);
    expect(board.map((s) => s.label)).toEqual(['Morning', 'Afternoon', 'Evening']);
    expect(board.every((s) => s.kind === 'sunny' && s.symbol === 'sun')).toBe(true);
    expect(board.map((s) => s.past)).toEqual([true, false, false]);
    expect(board.map((s) => s.now)).toEqual([false, true, false]);
    expect(f.promise()).toBeNull();
  });

  it('puts a promised turn on the board from its hour, and says whether it is for the worse', () => {
    const f = new Forecast('sunny', 9, seeded(3), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 1, accuracy: 1, shiftEarliest: 4, shiftLatest: 4 });
    expect(f.shift.at).toBe(13);
    const board = f.board(9);
    expect(board[0].kind).toBe('sunny');
    expect(board[1].kind).toBe(f.shift.to); // the afternoon's middle is 14:30
    expect(f.promise()).toEqual({ worse: isWorse('sunny', f.shift.to), to: f.shift.to });
  });

  it('has a wrong board say no change when one comes, and a change when none does', () => {
    const wrongTurns = new Forecast('sunny', 9, seeded(3), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 1, accuracy: 0 });
    expect(wrongTurns.told).toBeNull();
    expect(wrongTurns.update(wrongTurns.shift.at)).toMatchObject({ told: false });
    const wrongStays = new Forecast('sunny', 9, seeded(3), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 0, accuracy: 0 });
    expect(wrongStays.shift).toBeNull();
    expect(wrongStays.told).not.toBeNull();
    expect(wrongStays.update(30)).toBeNull();
  });

  it('stays out of it when the weather was forced or set by hand', () => {
    const f = new Forecast('rain', 9, seeded(3), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 1, accuracy: 1 }, { frozen: true });
    expect(f.shift).toBeNull();
    expect(f.promise()).toBeNull();
    const g = new Forecast('rain', 9, seeded(3), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 1, accuracy: 1 });
    g.cancel();
    expect(g.update(30)).toBeNull();
    expect(g.promise()).toBeNull();
  });

  it('can be turned now, from whatever the weather is, and not from snow', () => {
    const f = new Forecast('sunny', 9, seeded(3), { ...DEFAULT_FORECAST_PARAMS, shiftChance: 0 });
    const turn = f.turnNow('rain', 11, seeded(4));
    expect(turn).toMatchObject({ from: 'rain' });
    expect(f.turnNow('snow', 12, seeded(4))).toBeNull();
  });
});

describe('the weather turning', () => {
  it('blends the sky across, then lands on the new kind', () => {
    const w = new Weather('sunny', seeded(2), 14);
    const sunny = w.skyParams().cloudCover;
    expect(w.beginShift('overcast', 100, { warmth: -2 })).toBe(true);
    expect(w.kind).toBe('overcast');
    let last = sunny;
    for (let i = 0; i < 50; i++) {
      w.update(1);
      const c = w.skyParams().cloudCover;
      if (i < 40) expect(c).toBeGreaterThanOrEqual(last - 1e-9);
      last = c;
    }
    expect(w.mix).toBeLessThan(1);
    expect(w.from).toBe('sunny');
    for (let i = 0; i < 60; i++) w.update(1);
    expect(w.from).toBeNull();
    expect(w.mix).toBe(1);
    expect(w.skyParams().cloudCover).toBeCloseTo(WEATHER_KINDS.overcast.sky.cloudCover, 1);
  });

  it('brings the rain on part-way through and moves the day\'s warmest by the amount given', () => {
    const w = new Weather('sunny', seeded(2), 14);
    w.beginShift('rain', 200, { warmth: -3 });
    for (let i = 0; i < 20; i++) w.update(1);
    expect(w.rain).toBe(0); // the sky is turning first
    for (let i = 0; i < 400; i++) w.update(1);
    expect(w.rain).toBeGreaterThan(0.3);
    expect(w.peak).toBeCloseTo(11, 5);
  });

  it('does not turn to what it already is or to something unknown, and a set kind ends a turn', () => {
    const w = new Weather('rain', seeded(2), 10);
    expect(w.beginShift('rain', 10)).toBe(false);
    expect(w.beginShift('hail', 10)).toBe(false);
    w.beginShift('drizzle', 100, { warmth: 2 });
    w.setKind('fog');
    expect(w.from).toBeNull();
    w.update(10);
    expect(w.peak).toBe(10);
  });

  it('has the glass move with the sky and fall ahead of the rain', () => {
    const before = baroReading('sunny', 0, 0);
    const mid = baroReading('rain', 0, 0, 'sunny', 0.3);
    const after = baroReading('rain', 0, 0, 'sunny', 1);
    expect(mid).toBeLessThan(before);
    expect(after).toBeLessThan(mid);
    expect(baroReading('rain', 0, 0)).toBeCloseTo(after, 6);
  });
});
