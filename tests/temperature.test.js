import { describe, it, expect } from 'vitest';
import { Weather, WEATHER_KINDS, TEMPERATURE_BANDS, pickTemperature, chillOf, bandOf, MILD_C, COLDEST_C } from '../src/world/weather.js';
import { EngineModel, EngineState } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';
import { frostAfter, frostedColour } from '../src/vehicle/seatFrost.js';
import { createRandom } from '../src/core/random.js';
import { AMY_TEMPERATURE_LINES, JESS_TEMPERATURE_LINES } from '../src/npc/temperatureLines.js';

const many = (n, f) => Array.from({ length: n }, (_, i) => f(createRandom(i + 1)));
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('the day\'s temperature', () => {
  it('stays inside the bands and is to the nearest half degree', () => {
    for (const kind of Object.keys(WEATHER_KINDS)) {
      for (const t of many(300, (r) => pickTemperature(kind, r))) {
        expect(t).toBeGreaterThanOrEqual(-5);
        expect(t).toBeLessThanOrEqual(22);
        expect(t * 2).toBe(Math.round(t * 2));
        expect(Object.values(TEMPERATURE_BANDS).some(([lo, hi]) => t >= lo && t <= hi)).toBe(true);
      }
    }
  });

  it('allows frost only on dry days and warmth only with sun, and a sunny day can reach 22', () => {
    for (const kind of ['rain', 'drizzle']) for (const t of many(500, (r) => pickTemperature(kind, r))) expect(t).toBeGreaterThan(0);
    for (const t of many(500, (r) => pickTemperature('overcast', r))) expect(t).toBeLessThan(15);
    const sunny = many(1000, (r) => pickTemperature('sunny', r));
    expect(Math.max(...sunny)).toBe(22);
    expect(Math.min(...sunny)).toBeLessThanOrEqual(-4);
    expect(sunny.filter((t) => t >= 16).length).toBeGreaterThan(250);
  });

  it('repeats for a seed, and a forced temperature is kept', () => {
    expect(pickTemperature('sunny', createRandom(4))).toBe(pickTemperature('sunny', createRandom(4)));
    expect(new Weather('sunny', createRandom(1), -3).temperature).toBe(-3);
  });

  it('has no chill from mild up, and full chill on the coldest day', () => {
    expect(chillOf(MILD_C)).toBe(0);
    expect(chillOf(22)).toBe(0);
    expect(chillOf(COLDEST_C)).toBe(1);
    expect(chillOf(-20)).toBe(1);
    expect(chillOf(3.5)).toBeCloseTo(0.5, 5);
    expect(new Weather('sunny', createRandom(1), 0).chill).toBeGreaterThan(0.6);
  });

  it('names the bands and frosts the seats below freezing only', () => {
    expect(['frosty', 'cold', 'mild', 'warm'].map((b, i) => bandOf([-3, 4, 11, 20][i]))).toEqual(['frosty', 'cold', 'mild', 'warm']);
    const w = (t) => new Weather('sunny', createRandom(1), t);
    expect(w(4).frost).toBe(0);
    expect(w(1).frost).toBe(0);
    expect(w(0).frost).toBeGreaterThan(0.3);
    expect(w(-5).frost).toBe(1);
    expect(w(-2).frost).toBeGreaterThan(w(0).frost);
  });

  it('takes the edge off the sun when frosty and keeps the old warmth at mild', () => {
    const sunny = (t) => new Weather('sunny', createRandom(1), t).warmth;
    expect(sunny(MILD_C)).toBe(1);
    expect(sunny(-5)).toBeLessThan(1);
    const dull = (t) => new Weather('overcast', createRandom(1), t).warmth;
    expect(dull(22)).toBeGreaterThan(dull(MILD_C));
  });
});

describe('what the cold does to an engine', () => {
  const engine = () => new EngineModel({ ...P }, { random: seeded(3) });
  const run = (e, seconds, controls) => {
    for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, { fuel: 1, ...controls });
  };

  it('needs more choke', () => {
    const mild = engine();
    const frosty = engine();
    run(mild, 0.5, { chill: 0 });
    run(frosty, 0.5, { chill: 1 });
    expect(frosty.mixture).toBeLessThan(mild.mixture); // the same choke leaves it leaner, so it wants more
  });

  it('drains the battery faster on the starter and with the key on', () => {
    const drained = (chill, controls) => {
      const e = engine();
      e.setIgnition(true);
      run(e, 3, { chill, ...controls });
      return 1 - e.battery;
    };
    expect(drained(1, { starter: true })).toBeGreaterThan(drained(0, { starter: true }) * 1.5);
    expect(drained(1, {})).toBeGreaterThan(drained(0, {}) * 1.5);
  });

  it('warms up slower', () => {
    const warmed = (chill) => {
      const e = engine();
      e.setIgnition(true);
      for (let t = 0; t < 12 && e.state !== EngineState.RUNNING; t += 1 / 60) e.update(1 / 60, { starter: true, fuel: 1, choke: 0.6, chill });
      const t0 = e.temperature;
      run(e, 30, { chill, choke: 0.3 });
      return e.temperature - t0;
    };
    expect(warmed(1)).toBeLessThan(warmed(0));
  });

  it('heats the glow plugs slower', () => {
    const glow = (chill) => {
      const e = new EngineModel({ ...P, compressionIgnition: true, runsOnDiesel: true, coldEnrichmentNeed: 0 }, { random: seeded(3) });
      e.setIgnition(true);
      run(e, P.glowSeconds * 0.8, { chill });
      return e.glow;
    };
    expect(glow(1)).toBeLessThan(glow(0));
    expect(glow(0)).toBeGreaterThan(0.7);
  });
});

describe('seat frost', () => {
  it('stays on an empty seat and clears from a sat-on one', () => {
    expect(frostAfter(1, false, 100)).toBe(1);
    expect(frostAfter(1, true, 1)).toBeLessThan(1);
    expect(frostAfter(1, true, 100)).toBe(0);
  });

  it('tints the seat towards white with frost', () => {
    expect(frostedColour(0x141414, 0)).toBe(0x141414);
    expect(frostedColour(0x141414, 1)).toBe(0xdfe9ee);
    const half = frostedColour(0x141414, 0.5);
    expect((half >> 16) & 255).toBeGreaterThan(0x14);
    expect((half >> 16) & 255).toBeLessThan(0xdf);
  });
});

describe('temperature lines', () => {
  it('has them all for both girls, with no em dashes', () => {
    for (const k of ['weatherFrost', 'weatherCold', 'weatherWarm', 'seatFrosty']) {
      expect(AMY_TEMPERATURE_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_TEMPERATURE_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_TEMPERATURE_LINES[k].lines, ...JESS_TEMPERATURE_LINES[k]]) expect(l).not.toMatch(/—/);
    }
  });
});
