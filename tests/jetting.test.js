import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { idealJet, jetError, leanStarve, jetTrue, jetText, adviceText } from '../src/engine/jetting.js';
import { DEFAULT_TUNE_PARAMS, captureStock, stockSettings, limits, nudge, applyTune } from '../src/vehicle/tuneUp.js';
import { AMY_JET_LINES, JESS_JET_LINES } from '../src/npc/jetLines.js';

const P = DEFAULT_ENGINE_PARAMS;
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (params = {}) => new EngineModel({ strokes: 2, ...params }, { random: seeded(11) });

/** A warm two-stroke on a day of `dayTemp`, run for `seconds` with the throttle at `throttle`; returns it. */
function run(e, seconds, { dayTemp, throttle = 0.9 }) {
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3, dayTemp });
  for (let t = 0; t < seconds; t += 0.1) e.update(0.1, { throttle, driveLoad: throttle, dayTemp });
  return e;
}

describe('the right jet for the day', () => {
  it('is the stock jet at the reference temperature, bigger in the cold and smaller in the heat', () => {
    expect(idealJet(P.jetRefCelsius, P)).toBe(0);
    expect(idealJet(-5, P)).toBeGreaterThan(1.5);
    expect(idealJet(22, P)).toBeLessThan(-1);
    expect(jetError(2, -5, P)).toBeCloseTo(2 - idealJet(-5, P));
  });

  it('only counts as lean enough to hurt past the safe margin, and as spot on only close to it', () => {
    expect(leanStarve(-P.jetLeanSafe, P)).toBe(0);
    expect(leanStarve(-P.jetLeanFull, P)).toBe(1);
    expect(leanStarve(2, P)).toBe(0); // rich is never starved
    expect(jetTrue(0, P)).toBe(1);
    expect(jetTrue(P.jetTrueWithin, P)).toBe(1);
    expect(jetTrue(-P.jetTrueFade, P)).toBe(0);
    expect(jetTrue(0.6, P)).toBeGreaterThan(0);
    expect(jetTrue(0.6, P)).toBeLessThan(1);
  });

  it('is described for the panel', () => {
    expect(jetText(0)).toBe('Stock jet');
    expect(jetText(1)).toBe('1 size bigger');
    expect(jetText(-2)).toBe('2 sizes smaller');
    expect(adviceText(12, P)).toMatch(/stock jet/);
    expect(adviceText(-5, P)).toMatch(/bigger/);
    expect(adviceText(22, P)).toMatch(/smaller/);
  });
});

describe('a two-stroke running on its jet', () => {
  it('makes more power and runs smoother spot on than a size or two out', () => {
    const spotOn = run(make({ jet: 0 }), 5, { dayTemp: 12 });
    const richer = run(make({ jet: 2 }), 5, { dayTemp: 12 });
    const leaner = run(make({ jet: -2 }), 5, { dayTemp: 12 });
    expect(spotOn.power).toBeGreaterThan(richer.power);
    expect(spotOn.power).toBeGreaterThan(leaner.power);
    expect(spotOn.roughness).toBeLessThan(richer.roughness);
    expect(spotOn.roughness).toBeLessThan(leaner.roughness);
  });

  it('wants a different jet on a hot day and a cold one', () => {
    const coldDay = (jet) => run(make({ jet }), 5, { dayTemp: -5 }).power;
    const hotDay = (jet) => run(make({ jet }), 5, { dayTemp: 22 }).power;
    expect(coldDay(2)).toBeGreaterThan(coldDay(0));
    expect(hotDay(-1)).toBeGreaterThan(hotDay(0));
    expect(hotDay(-1)).toBeGreaterThan(hotDay(2));
  });

  it('seizes jetted lean on a cold day, and not when it is jetted right', () => {
    const lean = run(make({ jet: -1 }), 400, { dayTemp: -5 });
    expect(lean.seized).toBe(true);
    const right = run(make({ jet: 2 }), 400, { dayTemp: -5 });
    expect(right.seized).toBe(false);
    expect(right.scuff).toBe(0);
  });

  it('runs hot before it scuffs, and takes much longer to seize than straight petrol', () => {
    const e = run(make({ jet: -1 }), 20, { dayTemp: -5 });
    expect(e.overheat).toBeGreaterThan(0.2);
    expect(e.seized).toBe(false);
    expect(P.jetSeizeSeconds).toBeGreaterThan(P.seizeSeconds);
  });

  it('is left alone on a four-stroke', () => {
    const e = new EngineModel({ strokes: 4, jet: -3 }, { random: seeded(11) });
    run(e, 5, { dayTemp: -5 });
    expect(e.jetErr).toBe(0);
    expect(e.jetOn).toBe(0);
    expect(e.scuff).toBe(0);
  });
});

describe('the jet kit in the toolbox', () => {
  const unit = (strokes) => {
    const engine = { ...P, strokes };
    return {
      engine: { params: engine },
      quad: { params: { clutchEngageRpm: 1800, clutchFullRpm: 3000, couplingRpm: 2500, maxSpeed: 20, maxDriveForce: 1000, grassFrictionSlip: 1, mudFrictionSlip: 1, puddleFrictionSlip: 1, tyreGrip: 1, mudGrip: 1, rollingResistance: 1, suspensionStiffness: 1 }, fuel: { params: { burnPerRev: 1 } } },
      smoke: { params: { warmDensity: 1 } },
      spec: { safeIdle: engine.idleRpmWarm, idleRange: [engine.idleRpmWarm, engine.idleRpmWarm + 200] },
    };
  };
  const target = (u) => ({ engine: u.engine.params, vehicle: u.quad.params, fuel: u.quad.fuel.params, smoke: u.smoke.params, spec: u.spec });

  it('steps a two-stroke a size at a time within its range, and sets and restores the jet', () => {
    const u = unit(2);
    const t = target(u);
    const stock = captureStock(t);
    let s = stockSettings(stock, DEFAULT_TUNE_PARAMS);
    expect(limits('jet', s, stock, DEFAULT_TUNE_PARAMS)).toEqual([-3, 3, 1]);
    s = nudge(s, 'jet', 1, stock, DEFAULT_TUNE_PARAMS);
    s = nudge(s, 'jet', 1, stock, DEFAULT_TUNE_PARAMS);
    applyTune(t, stock, s, DEFAULT_TUNE_PARAMS);
    expect(u.engine.params.jet).toBe(2);
    for (let i = 0; i < 6; i++) s = nudge(s, 'jet', 1, stock, DEFAULT_TUNE_PARAMS);
    expect(s.jet).toBe(3);
    applyTune(t, stock, stockSettings(stock, DEFAULT_TUNE_PARAMS), DEFAULT_TUNE_PARAMS);
    expect(u.engine.params.jet).toBe(0);
  });

  it('has nothing to change on a four-stroke', () => {
    const u = unit(4);
    const stock = captureStock(target(u));
    const s = stockSettings(stock, DEFAULT_TUNE_PARAMS);
    expect(nudge(s, 'jet', 1, stock, DEFAULT_TUNE_PARAMS).jet).toBe(0);
  });
});

describe('what the girls say', () => {
  it('has lines for both situations for both girls', () => {
    for (const k of ['jetLean', 'jetRight']) {
      expect(AMY_JET_LINES[k].lines.length).toBeGreaterThan(2);
      expect(JESS_JET_LINES[k].length).toBeGreaterThan(2);
    }
  });
});
