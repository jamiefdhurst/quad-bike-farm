import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { hotSteam, pinkLevel, pinkHeat, pinkWork, coolTickRate, hotStartRich, airflow, condensation } from '../src/engine/heat.js';
import { soakLevel } from '../src/engine/thermal.js';
import { heatLevel, metalTarget, fuelHeat, finCooling } from '../src/engine/thermal.js';
import { Weather, WEATHER_KINDS } from '../src/world/weather.js';
import { QUAD_SPECS, EXTRA_SPECS, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC, PLOVER_SPEC } from '../src/vehicle/quadSpecs.js';
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
    // The °C an air-cooled engine's metal settles at, and the 0..1 heat that is.
    const settlesC = ({ ambient, rpmNorm = 0.1, load = 0, speed = 0 }) => metalTarget({ air: 12, ambient, fuel: fuelHeat({ rpmNorm, load }, P), cooling: finCooling({ rpmNorm, speed }, P) }, P);
    expect(settlesC({ ambient: 1 })).toBeGreaterThan(P.pinkFromC);
    expect(settlesC({ ambient: 0.3 })).toBeLessThan(P.pinkFromC);
    expect(heatLevel(settlesC({ ambient: 1, rpmNorm: 0.6, speed: P.airflowSpeed }), 0, P)).toBeLessThan(0.1);
    expect(airflow(-P.airflowSpeed * 2, P)).toBe(1);
  });

  it('has an air-cooled engine hot after a few minutes idling in the sun, but pinking only once it is made to work', () => {
    const at = make();
    at.setTemperature(1);
    at.setIgnition(true);
    for (let t = 0; t < 10 && !at.isRunning; t += 0.05) at.update(0.05, { starter: true, choke: 0.3 });
    let hotAt = Infinity;
    for (let t = 0; t < 900; t += 0.5) {
      at.update(0.5, { ambient: 1 });
      if (hotAt === Infinity && at.metalC > P.pinkFromC) hotAt = t;
      expect(at.pink).toBe(0); // idling, however hot
    }
    expect(hotAt).toBeGreaterThan(120);
    expect(hotAt).toBeLessThan(420);
    let pinks = 0;
    for (let t = 0; t < 30; t += 0.1) {
      at.update(0.1, { ambient: 1, throttle: 1, driveLoad: 0.8 }); // pulling away
      pinks += at.events.filter((x) => x.type === 'pink').length;
    }
    expect(at.pink).toBeGreaterThan(0.1);
    expect(pinks).toBeGreaterThan(5);
  });

  it('runs rougher and weaker for it, and the dash needle goes into the red', () => {
    const cool = make();
    const hot = make();
    run(cool, 60, { ambient: 0, throttle: 0.9, driveLoad: 1 });
    run(hot, 600, { ambient: 1, throttle: 0.9, driveLoad: 1 });
    expect(hot.roughness).toBeGreaterThan(cool.roughness + 0.1);
    expect(hot.power).toBeLessThan(cool.power - 0.1);
    expect(tempGaugeFraction(hot.gauge, true, hot.overheat)).toBeGreaterThan(HOT_FROM);
    expect(tempGaugeFraction(cool.gauge, true, cool.overheat)).toBeLessThan(HOT_FROM);
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
    expect(tempGaugeFraction(e.gauge, true, e.overheat)).toBeLessThan(HOT_FROM);
    expect(WATER.waterCooled).toBe(true);
  });

  it('gives the orange and the Bruin a radiator among the girls\' quads', () => {
    const water = QUAD_SPECS.filter((s) => s.engine?.waterCooled);
    expect(water.map((s) => s.id).sort()).toEqual(['adder', 'bruin']);
  });

  it('measures pinking from the temperature of the metal and how hard it is working', () => {
    expect(pinkHeat(P.pinkFromC, P)).toBe(0);
    expect(pinkHeat(P.pinkFromC - 20, P)).toBe(0);
    expect(pinkHeat(P.pinkFromC + P.pinkSpanC / 2, P)).toBeCloseTo(0.5);
    expect(pinkHeat(P.pinkFromC + P.pinkSpanC, P)).toBe(1);
    const hot = P.pinkFromC + P.pinkSpanC;
    expect(pinkLevel(hot, pinkWork({ rpmNorm: 0, load: 0 }, P), P)).toBe(0); // idling
    expect(pinkLevel(hot, pinkWork({ rpmNorm: 1, load: 0 }, P), P)).toBeCloseTo(P.pinkRevShare); // revved free
    expect(pinkWork({ rpmNorm: P.pinkRevFrom, load: 0 }, P)).toBe(0); // a fast idle
    expect(pinkLevel(hot, pinkWork({ rpmNorm: 0.4, load: 1 }, P), P)).toBe(1); // pulling hard
    expect(pinkLevel(P.pinkFromC - 5, 1, P)).toBe(0);
  });

  it('pinks a running engine working with its metal past the pinking temperature, whatever the coolant', () => {
    const e = make();
    run(e, 1, {});
    e.metalC = P.pinkFromC - 3;
    e.update(0.05, {});
    expect(e.pink).toBe(0);
    e.metalC = P.pinkFromC + 15;
    e.update(0.05, {});
    expect(e.pink).toBe(0); // idling
    for (let t = 0; t < 2; t += 0.05) {
      e.metalC = P.pinkFromC + 15;
      e.update(0.05, { throttle: 1, driveLoad: 1 });
    }
    expect(e.pink).toBeGreaterThan(0.2);
  });

  it('puts the red on an air-cooled gauge where pinking starts, and lubrication pushes the needle on up', () => {
    const e = make();
    run(e, 1, {});
    e.metalC = P.pinkFromC - 2;
    expect(tempGaugeFraction(e.gauge)).toBeLessThan(HOT_FROM);
    e.metalC = P.pinkFromC + 2;
    expect(tempGaugeFraction(e.gauge)).toBeGreaterThan(HOT_FROM);
    e.metalC = P.warmC;
    expect(tempGaugeFraction(e.gauge, true, 0.6)).toBeGreaterThan(tempGaugeFraction(e.gauge, true, 0));
  });
});

describe('heat soak, ticking and hot starts', () => {
  it('soaks with work and sheds it when off, as its metal heats and cools (#865)', () => {
    const e = make();
    run(e, 150, { throttle: 1, ambient: 0.4 });
    expect(e.soak).toBeGreaterThan(0.7);
    expect(e.soak).toBeCloseTo(soakLevel(e.metalC, P));
    e.setIgnition(false);
    for (let t = 0; t < 1200; t += 0.1) e.update(0.1, {});
    expect(e.soak).toBeLessThan(0.1);
  });

  it('ticks as a thrashed engine cools after switching off, and not after idling', () => {
    const ticks = (work) => {
      const e = make();
      run(e, 150, { throttle: work, ambient: 0.4 }); // revved hard standing still: riding along, the wind keeps an air-cooled engine's metal down
      e.setIgnition(false);
      let n = 0;
      for (let t = 0; t < 120; t += 0.1) {
        e.update(0.1, {});
        n += e.events.filter((x) => x.type === 'coolTick').length;
      }
      return n;
    };
    expect(ticks(1)).toBeGreaterThan(8);
    expect(ticks(0)).toBeLessThan(2);
  });

  it('ticks less and less, then stops, as it cools', () => {
    const e = make();
    run(e, 150, { throttle: 1, ambient: 0.4 });
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
    expect(hotSteam({ ...base, soak: soakLevel(P.coolantWarmC + P.metalOverC, P), rain: 1 }, P)).toBe(0); // a warm radiator engine's metal, idling
    expect(hotSteam({ ...base, soak: 1 }, P)).toBe(0);
    expect(hotSteam({ ...base, soak: 1, rain: 1, covered: true }, P)).toBe(0);
  });

  it('counts wet ground for less than falling rain', () => {
    const ground = hotSteam({ ...base, soak: 1, wet: 1 }, P);
    expect(ground).toBeGreaterThan(0);
    expect(ground).toBeLessThan(hotSteam({ ...base, soak: 1, rain: 1 }, P));
  });
});

describe('condensation in a cold exhaust', () => {
  const at = (temperature, dayTemp, running = true) => condensation({ running, temperature, dayTemp }, P);
  it('needs a cold engine in cold air', () => {
    expect(at(0.1, 2)).toBeGreaterThan(0.5);
    expect(at(0.1, 20)).toBe(0);
    expect(at(0.9, 2)).toBe(0);
  });
  it('fades as the engine warms or the air does', () => {
    expect(at(0.1, 2)).toBeGreaterThan(at(0.4, 2));
    expect(at(0.1, 2)).toBeGreaterThan(at(0.1, 9));
  });
  it('stops when the engine is off', () => {
    expect(at(0.1, 2, false)).toBe(0);
  });
});

// Each air-cooled vehicle heats in its own time, and only some of them pink (#861).
const EVERY_SPEC = [...QUAD_SPECS, ...EXTRA_SPECS, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC, PLOVER_SPEC].filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i);
const spec = (id) => EVERY_SPEC.find((s) => s.id === id);

/** A warm, running engine from a vehicle's spec on a day of `dayTemp` °C (a pull-start one started as if pulled). */
function vehicleEngine(s, dayTemp = 12) {
  const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...s.engine }, { random: seeded(5) });
  const diesel = s.engine.runsOnDiesel ? 1 : 0;
  const noStarter = e.params.noStarter;
  e.params.noStarter = false;
  e.dayTemp = dayTemp;
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 4; t += 0.05) e.update(0.05, { diesel, dayTemp }); // (the glow plugs)
  for (let t = 0; t < 20 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: diesel ? 0 : 0.15, diesel, dayTemp });
  e.params.noStarter = noStarter;
  expect(e.isRunning, s.id).toBe(true);
  return { e, diesel };
}

/** Seconds held flat out standing still until the metal reaches the pinking temperature, or Infinity. */
function timeToPinkC(s, { ambient = 0.5, dayTemp = 12, limit = 900 } = {}) {
  const { e } = vehicleEngine(s, dayTemp);
  for (let t = 0; t < limit; t += 0.5) {
    if (s.engine.strokes === 2) e.fouling = 0; // (a two-stroke held flat out oils its plug: not what this is about)
    e.update(0.5, { throttle: 1, ambient, dayTemp });
    if (e.metalC >= e.params.pinkFromC) return t;
  }
  return Infinity;
}

const PINK_TIMES = [['hornet', 120], ['asp', 120], ['tz65', 120], ['t185', 120], ['plover', 120], ['farm300', 240], ['rb300', 240], ['ursa', 240], ['shepherd', 240]];

describe('each air-cooled engine heats its own way (#861)', () => {
  for (const [id, seconds] of PINK_TIMES) {
    it(`${id}: held open standing still on a mild 12 °C day, reaches the pinking temperature in about ${seconds / 60} minutes`, () => {
      const t = timeToPinkC(spec(id));
      expect(t).toBeGreaterThan(seconds * 0.75);
      expect(t).toBeLessThan(seconds * 1.25);
    });
  }

  it('has the Clipper, cooled by its flywheel fan, get there only in full sun', () => {
    expect(timeToPinkC(spec('clipper'))).toBe(Infinity);
    expect(timeToPinkC(spec('clipper'), { ambient: 0.8 })).toBe(Infinity);
    expect(timeToPinkC(spec('clipper'), { ambient: 1 })).toBeLessThan(400);
  });

  it('gets the little two-strokes there sooner than the farm four-strokes', () => {
    expect(timeToPinkC(spec('hornet'))).toBeLessThan(timeToPinkC(spec('farm300')));
    expect(timeToPinkC(spec('asp'))).toBeLessThan(timeToPinkC(spec('rb300')));
  });

  it('gives every air-cooled petrol engine a pinkProne, 0 on the Plover and the Clipper', () => {
    for (const s of EVERY_SPEC) {
      const p = { ...DEFAULT_ENGINE_PARAMS, ...s.engine };
      if (p.waterCooled || p.compressionIgnition) continue;
      expect(s.engine.pinkProne, s.id).toBeGreaterThanOrEqual(0);
      expect(s.engine.pinkProne, s.id).toBeLessThanOrEqual(1);
    }
    expect(spec('plover').engine.pinkProne).toBe(0);
    expect(spec('clipper').engine.pinkProne).toBe(0);
  });
});

describe('who pinks, run hot and hard (#861)', () => {
  /** Every vehicle run hard with its engine hot: whether it pinked, and whether it lost power to the heat. */
  const hotAndHard = (s) => {
    const { e, diesel } = vehicleEngine(s, 25);
    let pinks = 0;
    let hotWork = 0;
    for (let t = 0; t < 20; t += 0.1) {
      e.metalC = Math.max(e.metalC, e.params.pinkFromC + 40);
      if (e.params.waterCooled) e.coolantC = Math.max(e.coolantC, e.params.hotFromC + 5);
      if (s.engine.strokes === 2) e.fouling = 0;
      e.update(0.1, { throttle: 1, driveLoad: 1, ambient: 1, dayTemp: 25, diesel });
      pinks += e.events.filter((x) => x.type === 'pink').length;
      hotWork = Math.max(hotWork, e.hotWork);
    }
    return { pinks, hotWork, p: e.params };
  };

  for (const s of EVERY_SPEC) {
    it(`${s.id}: pinks only if it is air-cooled petrol and prone to it`, () => {
      const { pinks, hotWork, p } = hotAndHard(s);
      const shouldPink = !p.waterCooled && !p.compressionIgnition && p.pinkProne > 0;
      if (shouldPink) expect(pinks).toBeGreaterThan(5);
      else expect(pinks).toBe(0);
      if (!p.waterCooled && !p.compressionIgnition) expect(hotWork).toBeGreaterThan(0.5); // too hot and working, it loses power whether it rattles or not
    });
  }

  it('has a hot engine idling not pink or lose power, and the same engine pulling away do both', () => {
    for (const [id] of PINK_TIMES) {
      const { e } = vehicleEngine(spec(id), 25);
      let idlePinks = 0;
      for (let t = 0; t < 20; t += 0.1) {
        e.metalC = e.params.pinkFromC + 30;
        if (spec(id).engine.strokes === 2) e.fouling = 0;
        e.update(0.1, { ambient: 1, dayTemp: 25 });
        idlePinks += e.events.filter((x) => x.type === 'pink').length;
      }
      expect(idlePinks, id).toBe(0);
      expect(e.hotWork, id).toBe(0);
      const idlePower = e.power;
      let pulling = 0;
      for (let t = 0; t < 3; t += 0.1) {
        e.metalC = e.params.pinkFromC + 30;
        e.update(0.1, { ambient: 1, dayTemp: 25, throttle: 1, driveLoad: 0.8 });
        pulling += e.events.filter((x) => x.type === 'pink').length;
      }
      expect(e.hotWork, id).toBeGreaterThan(0.3);
      if (spec(id).engine.pinkProne > 0) expect(pulling, id).toBeGreaterThan(0);
      else expect(pulling, id).toBe(0);
      void idlePower;
    }
  });
});
