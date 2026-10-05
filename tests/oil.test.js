import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { mixOil, ratioText, lubeFactor, oilExcess, nipping } from '../src/engine/lubrication.js';
import { tempGaugeFraction, WARM_AT } from '../src/vehicle/tempGauge.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const P = DEFAULT_ENGINE_PARAMS;
const twoStroke = (params = {}) => new EngineModel({ strokes: 2, ...params }, { random: seeded(7) });

/** Starts it and runs it for `seconds` at the given throttle on the given oil; stops early if it seizes. */
function ride(e, seconds, { oil, throttle = 0.9, driveLoad = 0.5 }) {
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 12 && !e.isRunning; t += 1 / 60) e.update(1 / 60, { starter: true, choke: 0.5, oil });
  for (let t = 0; t < seconds && !e.seized; t += 1 / 60) {
    e.update(1 / 60, { throttle: e.isRunning ? throttle : 0, driveLoad, oil });
    if (e.state === 'stalled' && !e.seized) e.update(1 / 60, { starter: true, oil });
  }
}

describe('mixing oil', () => {
  it('works out the fraction of the blend', () => {
    expect(mixOil(10, 0.02, 10, 0)).toBeCloseTo(0.01);
    expect(mixOil(0, 0, 5, 0.02)).toBeCloseTo(0.02);
    expect(mixOil(0, 0, 0, 0)).toBe(0);
  });
  it('says what a mix is', () => {
    expect(ratioText(0)).toBe('straight petrol');
    expect(ratioText(0.02)).toBe('pre-mix 50:1');
  });
  it('a tank takes the oil of what is poured in', () => {
    const f = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startLitres: 4, startOil: 0.02 });
    f.add(4, 0);
    expect(f.oil).toBeCloseTo(0.01);
    f.add(2, 0.02);
    expect(f.oil).toBeCloseTo((8 * 0.01 * 0 + 8 * 0.01 + 2 * 0.02) / 10, 4);
  });
  it('lube and excess scale as expected', () => {
    expect(lubeFactor(0, 0.02)).toBe(0);
    expect(lubeFactor(0.01, 0.02)).toBeCloseTo(0.5);
    expect(lubeFactor(0.05, 0.02)).toBe(1);
    expect(oilExcess(0.02, 2, P)).toBe(0);
    expect(oilExcess(P.oilRichFull, 2, P)).toBe(1);
    expect(oilExcess(0.02, 4, P)).toBe(1);
    expect(oilExcess(0, 4, P)).toBe(0);
    expect(nipping(0.4, 0.55)).toBe(0);
    expect(nipping(1, 0.55)).toBe(1);
  });
});

describe('a two-stroke on the wrong oil', () => {
  it('runs hot and seizes on straight petrol, and then will not turn over', () => {
    const e = twoStroke();
    ride(e, 300, { oil: 0 });
    expect(e.seized).toBe(true);
    expect(e.state).toBe('stalled');
    expect(e.rpm).toBe(0);
    e.update(1 / 60, { starter: true, oil: 0.02 });
    e.update(1 / 60, { starter: true, oil: 0.02 });
    expect(e.state).not.toBe('cranking');
    expect(e.pull(0.7)).toBeNull();
  });
  it('heats up and nips up before it seizes', () => {
    const e = twoStroke();
    ride(e, 40, { oil: 0 });
    expect(e.overheat).toBeGreaterThan(0.3);
    ride(e, 40, { oil: 0 });
    expect(e.nip).toBeGreaterThan(0);
    expect(e.power).toBeLessThan(1);
  });
  it('is fine for a long time on proper pre-mix', () => {
    const e = twoStroke();
    ride(e, 600, { oil: 0.02 });
    expect(e.seized).toBe(false);
    expect(e.scuff).toBe(0);
    expect(e.overheat).toBeLessThan(0.01);
  });
  it('takes far longer to seize idling than flat out', () => {
    const hard = twoStroke();
    ride(hard, 30, { oil: 0 });
    const idle = twoStroke();
    ride(idle, 30, { oil: 0, throttle: 0, driveLoad: 0 });
    expect(idle.scuff).toBeLessThan(hard.scuff / 2);
  });
  it('is freed by stripping it down, leaving wear', () => {
    const e = twoStroke();
    ride(e, 300, { oil: 0 });
    const before = e.wear;
    expect(e.freeSeized()).toBe(true);
    expect(e.seized).toBe(false);
    expect(e.wear).toBeCloseTo(before + P.seizeWear);
    expect(e.freeSeized()).toBe(false);
    e.update(1 / 60, { starter: true, oil: 0.02 });
    e.update(1 / 60, { starter: true, oil: 0.02 });
    expect(e.state).toBe('cranking');
  });
  it('a four-stroke never seizes, whatever is in it', () => {
    const e = new EngineModel({ strokes: 4 }, { random: seeded(3) });
    ride(e, 200, { oil: 0 });
    expect(e.seized).toBe(false);
    expect(e.overheat).toBe(0);
  });
});

describe('too much oil', () => {
  it('fouls the plug and smokes on a two-stroke with far too much', () => {
    const e = twoStroke();
    ride(e, 20, { oil: 0.1, throttle: 0, driveLoad: 0 });
    expect(e.oilRich).toBe(1);
    expect(e.fouling).toBeGreaterThan(0.1);
  });
  it('is the same for any pre-mix in a four-stroke', () => {
    const e = new EngineModel({ strokes: 4 }, { random: seeded(3) });
    ride(e, 20, { oil: 0.02, throttle: 0, driveLoad: 0 });
    expect(e.oilRich).toBe(1);
  });
  it('proper pre-mix in a two-stroke is clean', () => {
    const e = twoStroke();
    ride(e, 20, { oil: 0.02 });
    expect(e.oilRich).toBe(0);
  });
});

describe('the temperature gauge', () => {
  it('goes into the red when it runs hot for want of oil', () => {
    expect(tempGaugeFraction(1, true, 0)).toBe(WARM_AT);
    expect(tempGaugeFraction(1, true, 1)).toBeCloseTo(1);
    expect(tempGaugeFraction(1, false, 1)).toBe(0);
  });
});
