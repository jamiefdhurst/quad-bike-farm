import { describe, it, expect } from 'vitest';
import { stepCanWater, settleWater, fuelWaterLevel, sedimentText, DEFAULT_FUEL_WATER_PARAMS as W } from '../src/vehicle/fuelWater.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { fuelText } from '../src/engine/diesel.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const run = (fuel, seconds, burn = { rpm: 2500, throttle: 0.4, choke: 0, running: true }) => {
  for (let t = 0; t < seconds; t += 0.1) fuel.update(0.1, burn);
};

describe('a can left out in the rain', () => {
  it('collects water only when it is exposed and the rain is hard enough', () => {
    expect(stepCanWater(0, 100, { rain: 1, exposed: false })).toBe(0);
    expect(stepCanWater(0, 100, { rain: 0.1, exposed: true })).toBe(0);
    expect(stepCanWater(0, 100, { rain: 1, exposed: true })).toBeCloseTo(100 * W.canRainRate, 6);
  });

  it('stops at the most a can takes in', () => {
    expect(stepCanWater(0.11, 1e6, { rain: 1, exposed: true })).toBe(W.canMaxWater);
  });
});

describe('the sediment bowl on the tap', () => {
  it('catches most of the water while it has room, and fills as it does', () => {
    const r = settleWater(0, 0.02);
    expect(r.passed).toBeCloseTo(0.02 * (1 - W.bowlCatch), 6);
    expect(r.sediment).toBeCloseTo((0.02 * W.bowlCatch) / W.bowlLitres, 6);
  });

  it('lets everything by once it is full', () => {
    const r = settleWater(1, 0.02);
    expect(r.sediment).toBe(1);
    expect(r.passed).toBe(0.02);
  });

  it('puts a level on the engine in proportion to the water reaching the carb', () => {
    expect(fuelWaterLevel(0)).toBe(0);
    expect(fuelWaterLevel(W.fullAt / 2)).toBeCloseTo(0.5, 6);
    expect(fuelWaterLevel(1)).toBe(1);
  });

  it('says how full it is', () => {
    expect(sedimentText(0)).toBe('clear');
    expect(sedimentText(1)).toBe('full of water');
  });
});

describe('water in a tank', () => {
  const wet = (water) => new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startLitres: 12, startWater: water, startTap: 'reserve' });

  it('mixes in from a can, and a clean can dilutes it', () => {
    const f = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startLitres: 4, startTap: 'on' });
    f.add(4, 0, 0, 0.1);
    expect(f.water).toBeCloseTo(0.05, 6);
    f.add(4, 0, 0, 0);
    expect(f.water).toBeCloseTo(0.4 / 12, 6);
  });

  it('settles in the bowl first, with the carb clean until the bowl is full, then the water gets through', () => {
    const f = wet(0.08);
    run(f, 20);
    expect(f.sediment).toBeGreaterThan(0);
    expect(f.bowlWater).toBeLessThan(0.02);
    run(f, 300);
    expect(f.sediment).toBeGreaterThan(0.95);
    run(f, 100);
    expect(f.bowlWater).toBeGreaterThan(0.05);
  });

  it('keeps clean fuel clean', () => {
    const f = wet(0);
    run(f, 120);
    expect(f.sediment).toBe(0);
    expect(f.bowlWater).toBe(0);
    expect(f.hasWater).toBe(false);
  });

  it('is cured by draining at the tap, at the cost of a little fuel', () => {
    const f = wet(0.08);
    run(f, 600);
    expect(f.hasWater).toBe(true);
    const before = f.litres;
    const lost = f.drainSediment();
    expect(lost).toBeCloseTo(W.drainLoss, 6);
    expect(f.litres).toBeCloseTo(before - lost, 6);
    expect(f.hasWater).toBe(false);
    run(f, 60);
    expect(f.bowlWater).toBe(0);
  });

  it('the toolbox drain of the whole tank clears it too', () => {
    const f = wet(0.08);
    run(f, 600);
    f.drain();
    expect(f.hasWater).toBe(false);
  });
});

describe('what it does to the engine', () => {
  const idle = (fuelWater, seconds, seed = 3) => {
    const e = new EngineModel({ ...P }, seeded(seed));
    e.setIgnition(true);
    e.state = 'running';
    e.rpm = P.idleRpmWarm;
    e.setTemperature(1);
    let stalled = false;
    for (let t = 0; t < seconds; t += 1 / 60) {
      e.update(1 / 60, { fuelWater, fuel: 1 });
      if (e.state === 'stalled') stalled = true;
    }
    return { e, stalled };
  };

  it('misfires and cuts out on a lot of it, but not on none', () => {
    expect(idle(0, 60).stalled).toBe(false);
    expect(idle(1, 60).stalled).toBe(true);
  });

  it('records why it stopped, for what the girls say', () => {
    expect(idle(1, 60).e.lastStallReason).toBe('fuelWater');
  });

  it('runs rougher and weaker as it gets wetter', () => {
    const dry = idle(0, 1).e;
    const wetter = idle(0.4, 1).e;
    expect(wetter.roughness).toBeGreaterThan(dry.roughness);
  });
});

describe('what the fuel is called', () => {
  it('mentions the water in a can that has some', () => {
    expect(fuelText(0, 0, 0.06)).toBe('straight petrol, with 6% water in it');
    expect(fuelText(0, 0, 0)).toBe('straight petrol');
  });
});
