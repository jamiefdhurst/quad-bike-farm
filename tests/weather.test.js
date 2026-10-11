import { describe, it, expect } from 'vitest';
import { Weather, WEATHER_KINDS, pickWeatherKind, pickTemperature } from '../src/world/weather.js';

function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('the weather', () => {
  it('can be any kind, picked by weight', () => {
    const random = seeded(3);
    const counts = {};
    for (let i = 0; i < 4000; i++) {
      const k = pickWeatherKind(random);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const [k, def] of Object.entries(WEATHER_KINDS)) expect(counts[k] / 4000).toBeCloseTo(def.weight, 1);
  });

  it('has showers come and go on a showery day, and stays dry on a sunny one', () => {
    const run = (kind, seed) => {
      const w = new Weather(kind, seeded(seed));
      let wet = 0;
      let dry = 0;
      for (let t = 0; t < 3600; t++) {
        w.update(1);
        if (w.rain > 0.25) wet++;
        else dry++;
        expect(w.rain).toBeGreaterThanOrEqual(0);
        expect(w.rain).toBeLessThanOrEqual(1);
      }
      return { wet, dry };
    };
    const sunny = run('sunny', 1);
    expect(sunny.wet).toBe(0);
    const drizzle = run('drizzle', 2);
    expect(drizzle.wet).toBeGreaterThan(300);
    expect(drizzle.dry).toBeGreaterThan(300);
  });

  it('wets the ground in rain and dries it slowly after', () => {
    const w = new Weather('fair', seeded(5));
    w.wet = 0;
    w.target = w.rain = 1;
    w.nextChange = 1e9;
    for (let t = 0; t < 60; t++) w.update(1);
    expect(w.wet).toBeGreaterThan(0.9);
    w.target = w.rain = 0;
    for (let t = 0; t < 120; t++) w.update(1);
    expect(w.wet).toBeGreaterThan(0.6);
  });

  it('darkens the sky and thickens the fog while it rains', () => {
    const w = new Weather('sunny', seeded(9));
    const clear = w.skyParams();
    w.rain = 0.8;
    const showery = w.skyParams();
    expect(showery.sunIntensity).toBeLessThan(clear.sunIntensity);
    expect(showery.fogDensity).toBeGreaterThan(clear.fogDensity);
    expect(showery.horizonColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(showery.horizonColor).not.toBe(clear.horizonColor);
  });
});
