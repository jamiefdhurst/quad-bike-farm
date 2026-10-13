import { describe, it, expect } from 'vitest';
import { Thunderstorm, DEFAULT_THUNDER_PARAMS, THUNDER_PARAM_RANGES } from '../src/world/thunder.js';
import { Weather, WEATHER_KINDS, pickWeatherKind } from '../src/world/weather.js';
import { dealShift, SHIFTS, DEFAULT_FORECAST_PARAMS } from '../src/world/forecast.js';

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const run = (t, seconds, storm = 1) => {
  const events = [];
  for (let s = 0; s < seconds; s += 0.05) events.push(...t.update(0.05, storm));
  return events;
};

describe('the storm as a weather kind', () => {
  it('is rare, heavy and windy, and is thundery only while it is the kind', () => {
    expect(WEATHER_KINDS.storm.weight).toBeLessThan(WEATHER_KINDS.snow.weight);
    expect(WEATHER_KINDS.storm.rain).toBeGreaterThan(WEATHER_KINDS.rain.rain);
    expect(WEATHER_KINDS.storm.wind).toBeGreaterThan(WEATHER_KINDS.rain.wind);
    expect(new Weather('storm').storm).toBe(1);
    expect(new Weather('rain').storm).toBe(0);
  });

  it('can be rolled', () => {
    const seen = new Set();
    const random = seeded(11);
    for (let i = 0; i < 4000; i++) seen.add(pickWeatherKind(random));
    expect(seen.has('storm')).toBe(true);
  });

  it('eases in and out as the weather turns to it and from it', () => {
    const w = new Weather('rain');
    w.beginShift('storm', 100);
    w.update(50);
    expect(w.storm).toBeGreaterThan(0.3);
    expect(w.storm).toBeLessThan(0.7);
    const v = new Weather('storm');
    v.beginShift('rain', 100);
    v.update(50);
    expect(v.storm).toBeGreaterThan(0.3);
    expect(v.storm).toBeLessThan(0.7);
    v.update(60);
    expect(v.storm).toBe(0);
  });

  it('always blows over, and sooner than other weather turns', () => {
    expect(SHIFTS.storm).toBeTruthy();
    const p = DEFAULT_FORECAST_PARAMS;
    for (let i = 1; i < 100; i++) {
      const s = dealShift('storm', 10, seeded(i), p);
      expect(s).not.toBeNull();
      expect(s.at).toBeGreaterThanOrEqual(10 + p.stormEarliest);
      expect(s.at).toBeLessThanOrEqual(10 + p.stormLatest + 0.25);
      expect(['rain', 'drizzle', 'overcast']).toContain(s.to);
    }
  });
});

describe('lightning and thunder', () => {
  it('flashes, then thunders after the time sound takes', () => {
    const t = new Thunderstorm({ ...DEFAULT_THUNDER_PARAMS }, seeded(3));
    const s = t.strike(686);
    expect(t.events[0].type).toBe('flash');
    const events = run(t, 5, 0);
    expect(events.find((e) => e.type === 'thunder')).toBeTruthy();
    expect(t.clock).toBeGreaterThan(s.thunderAt);
    expect(s.thunderAt - s.born).toBeCloseTo(686 / DEFAULT_THUNDER_PARAMS.soundSpeed, 5);
  });

  it('lights the sky at the flash and fades to nothing', () => {
    const t = new Thunderstorm({ ...DEFAULT_THUNDER_PARAMS }, seeded(4));
    t.strike(150);
    t.update(0.01, 0);
    expect(t.flash).toBeGreaterThan(0.5);
    run(t, 3, 0);
    expect(t.flash).toBeLessThan(0.01);
  });

  it('a near strike is brighter and louder than a far one', () => {
    const t = new Thunderstorm({ ...DEFAULT_THUNDER_PARAMS }, seeded(5));
    const near = t.strike(150);
    const far = t.strike(3000);
    expect(near.power).toBeGreaterThan(far.power);
    expect(Thunderstorm.loudness(150)).toBeGreaterThan(Thunderstorm.loudness(3000));
    expect(Thunderstorm.cracks(150)).toBe(true);
    expect(Thunderstorm.cracks(3000)).toBe(false);
  });

  it('strikes at the height of a storm, not when it is not stormy', () => {
    const calm = new Thunderstorm({ ...DEFAULT_THUNDER_PARAMS }, seeded(6));
    expect(run(calm, 300, 0).length).toBe(0);
    const storm = new Thunderstorm({ ...DEFAULT_THUNDER_PARAMS }, seeded(6));
    const flashes = run(storm, 300, 1).filter((e) => e.type === 'flash').length;
    expect(flashes).toBeGreaterThan(300 / DEFAULT_THUNDER_PARAMS.gapMax - 1);
    expect(flashes).toBeLessThan(300 / DEFAULT_THUNDER_PARAMS.gapMin + 1);
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_THUNDER_PARAMS)) expect(THUNDER_PARAM_RANGES[k]).toBeTruthy();
  });
});

describe('the girls in a storm', async () => {
  const { drivingMethods } = await import('../src/npc/companionDriving.js');
  const { CHARACTERS } = await import('../src/npc/characters.js');
  const { NOTICE_KINDS, DEFAULT_NOTICE_PARAMS } = await import('../src/npc/attention.js');
  const { reactionTo } = await import('../src/npc/reactions.js');

  it('Amy will not ride or drive in one, Jess will, and neither does until it comes', () => {
    const girl = (stormWont, inStorm) => ({ params: { stormWont }, inStorm, refusesStorm: drivingMethods.refusesStorm });
    expect(girl(1, true).refusesStorm()).toBe(true);
    expect(girl(1, false).refusesStorm()).toBe(false);
    expect(girl(0, true).refusesStorm()).toBe(false);
    expect(CHARACTERS.find((c) => c.id === 'amy').params.stormWont).toBe(1);
    expect(CHARACTERS.find((c) => c.id === 'jess').params.stormWont ?? 0).toBe(0);
  });

  it('thunder is a notice that startles her only when it is close', () => {
    expect(NOTICE_KINDS.thunder).toBeTruthy();
    expect(DEFAULT_NOTICE_PARAMS.thunder).toBeGreaterThan(0);
    const can = () => true;
    const p = { reactStartleChance: 1 };
    const at = { x: 0, y: 0, z: 0 };
    expect(reactionTo({ kind: 'thunder', ...at, strength: 1.4 }, { distance: 20, can, current: null }, p)?.type).toBe('flinch');
    expect(reactionTo({ kind: 'thunder', ...at, strength: 0.3 }, { distance: 20, can, current: null }, p)).toBeNull();
  });
});
