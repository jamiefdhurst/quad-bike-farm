import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { hotSteam, heatTarget, pinkLevel, gaugeHeat, stepSoak, coolTickRate, hotStartRich, airflow } from '../src/engine/heat.js';
import { Weather, WEATHER_KINDS } from '../src/world/weather.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { tempGaugeFraction, HOT_FROM } from '../src/vehicle/tempGauge.js';

const P = DEFAULT_ENGINE_PARAMS;
const WATER = { ...P, waterCooled: true };
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (params = {}) => new EngineModel(params, { random: seeded(11) });

/** A warm engine running for `seconds`; returns it, with the events counted by type. */
function run(e, seconds, controls) {
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  const counts = {};
  for (let t = 0; t < seconds; t += 0.1) {
    e.update(0.1, controls);
    for (const ev of e.events) counts[ev.type] = (counts[ev.type] ?? 0) + 1;
  }
  return counts;
}

describe('running heat', () => {
  it('builds idling in full sun, but not on a dull day or riding along', () => {
    expect(heatTarget({ ambient: 1, work: 0.1, speed: 0, fan: false }, P)).toBeGreaterThan(P.pinkFrom);
    expect(heatTarget({ ambient: 0.3, work: 0.1, speed: 0, fan: false }, P)).toBeLessThan(P.pinkFrom);
    expect(heatTarget({ ambient: 1, work: 1, speed: P.airflowSpeed, fan: false }, P)).toBeLessThan(0.1);
    expect(airflow(-P.airflowSpeed * 2, P)).toBe(1);
  });

  it('has an air-cooled engine pinking after a few minutes idling in the sun', () => {
    const e = make();
    const sunny = { ambient: 1 };
    const pinkAt = (limit) => {
      const at = make();
      at.setTemperature(1);
      at.setIgnition(true);
      for (let t = 0; t < 10 && !at.isRunning; t += 0.05) at.update(0.05, { starter: true, choke: 0.3 });
      for (let t = 0; t < limit; t += 0.5) {
        at.update(0.5, sunny);
        if (at.pink > 0) return t;
      }
      return Infinity;
    };
    const t = pinkAt(900);
    expect(t).toBeGreaterThan(120);
    expect(t).toBeLessThan(420);
    const counts = run(e, 600, sunny);
    expect(e.pink).toBeGreaterThan(0.3);
    expect(counts.pink).toBeGreaterThan(20);
  });

  it('runs rougher and weaker for it, and the dash needle goes into the red', () => {
    const cool = make();
    const hot = make();
    run(cool, 60, { ambient: 0, throttle: 0.5 });
    run(hot, 600, { ambient: 1, throttle: 0.5 });
    expect(hot.roughness).toBeGreaterThan(cool.roughness + 0.1);
    expect(hot.power).toBeLessThan(cool.power - 0.1);
    expect(tempGaugeFraction(hot.temperature, true, hot.gaugeHeat)).toBeGreaterThan(HOT_FROM);
    expect(tempGaugeFraction(cool.temperature, true, cool.gaugeHeat)).toBeLessThan(HOT_FROM);
  });

  it('heats crawling through mud with the throttle open, and riding at speed clears it', () => {
    const e = make();
    run(e, 400, { ambient: 0.7, throttle: 0.8, driveLoad: 0.8, speed: 1 });
    expect(e.pink).toBeGreaterThan(0);
    for (let t = 0; t < 300; t += 0.1) e.update(0.1, { ambient: 0.7, throttle: 0.8, driveLoad: 0.3, speed: 9 });
    expect(e.heat).toBeLessThan(0.1);
    expect(e.pink).toBe(0);
  });

  it('has the water-cooled fan cut in and out, and never pink', () => {
    const e = make({ waterCooled: true });
    const fan = [];
    e.setTemperature(1);
    e.setIgnition(true);
    for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
    for (let t = 0; t < 900; t += 0.1) {
      e.update(0.1, { ambient: 1 });
      fan.push(e.fan);
      expect(e.pink).toBe(0);
    }
    const flips = fan.filter((f, i) => i > 0 && f !== fan[i - 1]).length;
    expect(flips).toBeGreaterThanOrEqual(2);
    expect(fan.some((f) => f)).toBe(true);
    expect(fan.some((f) => !f)).toBe(true);
    expect(e.gaugeHeat).toBeLessThan(HOT_FROM / 2);
    expect(WATER.waterCooled).toBe(true);
  });

  it('only gives the orange a radiator', () => {
    const water = QUAD_SPECS.filter((s) => s.engine?.waterCooled);
    expect(water.map((s) => s.name)).toEqual(['Orange quad']);
  });

  it('shows the worse of poor lubrication and heat on the gauge', () => {
    expect(gaugeHeat(0.6, 0.2, P)).toBe(0.6);
    expect(gaugeHeat(0, 0.8, P)).toBe(0.8);
    expect(gaugeHeat(0, 0.8, WATER)).toBeCloseTo(0.8 * WATER.heatGaugeWater);
  });

  it('measures pinking from the threshold', () => {
    expect(pinkLevel(P.pinkFrom, P)).toBe(0);
    expect(pinkLevel(1, P)).toBe(1);
  });
});

describe('heat soak, ticking and hot starts', () => {
  it('soaks with work and sheds it when off', () => {
    let soak = 0;
    for (let t = 0; t < 120; t += 0.1) soak = stepSoak(soak, 0.1, { running: true, work: 1, heat: 0 }, P);
    expect(soak).toBeGreaterThan(0.8);
    for (let t = 0; t < 1200; t += 0.1) soak = stepSoak(soak, 0.1, { running: false, work: 0, heat: 0 }, P);
    expect(soak).toBeLessThan(0.1);
  });

  it('ticks as a thrashed engine cools after switching off, and not after idling', () => {
    const ticks = (work) => {
      const e = make();
      run(e, 150, { throttle: work, driveLoad: work, ambient: 0.4, speed: 6 });
      e.setIgnition(false);
      let n = 0;
      for (let t = 0; t < 120; t += 0.1) {
        e.update(0.1, {});
        n += e.events.filter((x) => x.type === 'coolTick').length;
      }
      return n;
    };
    expect(ticks(1)).toBeGreaterThan(30);
    expect(ticks(0)).toBeLessThan(5);
  });

  it('ticks less and less, then stops, as it cools', () => {
    const e = make();
    run(e, 150, { throttle: 1, driveLoad: 1, ambient: 0.4, speed: 6 });
    e.setIgnition(false);
    const count = (secs) => {
      let n = 0;
      for (let t = 0; t < secs; t += 0.1) {
        e.update(0.1, {});
        n += e.events.filter((x) => x.type === 'coolTick').length;
      }
      return n;
    };
    const early = count(60);
    count(300);
    const late = count(60);
    expect(late).toBeLessThan(early / 2);
    count(900);
    expect(count(60)).toBe(0);
    expect(coolTickRate(0, P)).toBe(0);
  });

  it('starts rich when hot, less so with the throttle held open, and normally once cooled', () => {
    const mixture = (soak, throttle) => {
      const e = make();
      e.setTemperature(1);
      e.soak = soak;
      e.setIgnition(true);
      e.update(0.05, { throttle });
      return e.mixture;
    };
    expect(mixture(1, 0)).toBeGreaterThan(mixture(0, 0) + 0.4);
    expect(mixture(1, 1)).toBeLessThan(mixture(1, 0) - 0.3);
    expect(mixture(0.2, 0)).toBeCloseTo(mixture(0, 0));
    expect(hotStartRich(1, 0, P)).toBe(P.hotStartRich);
  });

  it('floods a hot restart that keeps its choke on, which holding the throttle open avoids', () => {
    const crank = (throttle, choke) => {
      const e = make();
      e.setTemperature(1);
      e.soak = 1;
      e.setIgnition(true);
      let caught = false;
      for (let t = 0; t < 4; t += 0.02) {
        e.update(0.02, { starter: true, throttle, choke });
        if (e.isRunning) caught = true;
      }
      return { fouling: e.fouling, caught };
    };
    expect(crank(0, 1).fouling).toBeGreaterThan(crank(1, 0).fouling);
  });
});

describe('the day\'s warmth', () => {
  it('is highest on a sunny day, and the rain takes it off', () => {
    const w = (kind) => new Weather(kind, () => 0.5).warmth;
    expect(w('sunny')).toBeCloseTo(1);
    for (const kind of Object.keys(WEATHER_KINDS)) expect(w(kind)).toBeLessThanOrEqual(w('sunny'));
    expect(w('sunny')).toBeGreaterThan(w('overcast'));
    const wet = new Weather('sunny', () => 0.5);
    wet.rain = 1;
    expect(wet.warmth).toBeLessThan(0.3);
  });
});

describe('steam off a hot engine', () => {
  const P = DEFAULT_ENGINE_PARAMS;
  const base = { running: true, heat: 0, soak: 0, rain: 0, wet: 0, covered: false };

  it('is none for an engine that is not hot', () => {
    expect(hotSteam(base, P)).toBe(0);
    expect(hotSteam({ ...base, heat: 0.5, soak: 0.5 }, P)).toBe(0);
  });

  it('shows a thin wisp from one that is cooking, thicker the hotter, and only while it runs', () => {
    const warm = hotSteam({ ...base, heat: 0.8 }, P);
    const cooking = hotSteam({ ...base, heat: 1 }, P);
    expect(warm).toBeGreaterThan(0);
    expect(cooking).toBeGreaterThan(warm);
    expect(cooking).toBeLessThanOrEqual(P.steamCooking + 1e-9);
    expect(hotSteam({ ...base, running: false, heat: 1 }, P)).toBe(0);
  });

  it('steams when rain falls on hot metal, running or just switched off, more with more rain and more heat', () => {
    const light = hotSteam({ ...base, soak: 0.8, rain: 0.3 }, P);
    expect(light).toBeGreaterThan(0);
    expect(hotSteam({ ...base, soak: 0.8, rain: 0.9 }, P)).toBeGreaterThan(light);
    expect(hotSteam({ ...base, soak: 1, rain: 0.3 }, P)).toBeGreaterThan(light);
    expect(hotSteam({ ...base, running: false, soak: 0.8, rain: 0.9 }, P)).toBeGreaterThan(0);
  });

  it('does not steam from a merely idling engine in the rain, or out of the rain, or under cover', () => {
    expect(hotSteam({ ...base, soak: P.soakIdle, rain: 1 }, P)).toBe(0);
    expect(hotSteam({ ...base, soak: 1 }, P)).toBe(0);
    expect(hotSteam({ ...base, soak: 1, rain: 1, covered: true }, P)).toBe(0);
  });

  it('counts wet ground for less than falling rain', () => {
    const ground = hotSteam({ ...base, soak: 1, wet: 1 }, P);
    expect(ground).toBeGreaterThan(0);
    expect(ground).toBeLessThan(hotSteam({ ...base, soak: 1, rain: 1 }, P));
  });
});
