import { describe, it, expect } from 'vitest';
import { stepDieselSoak, dieselCatchFactor, fuelText } from '../src/engine/diesel.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { JerryCan, DEFAULT_JERRY_CAN_PARAMS } from '../src/items/jerryCan.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('diesel soak', () => {
  it('climbs toward what the diesel in the fuel calls for, only while running or cranking, and never falls', () => {
    expect(stepDieselSoak(0, 10, { diesel: 1, active: false }, P)).toBe(0);
    const s = stepDieselSoak(0, 10, { diesel: 1, active: true }, P);
    expect(s).toBeCloseTo(10 * P.dieselSoakRate, 5);
    expect(stepDieselSoak(0, 1000, { diesel: 0.1, active: true }, P)).toBeCloseTo(0.1 * P.dieselPotency, 5); // 10% diesel soaks to a quarter
    expect(stepDieselSoak(0.5, 100, { diesel: 0, active: true }, P)).toBe(0.5); // turning petrol back in doesn't cure it
    expect(stepDieselSoak(0.9, 100, { diesel: 1, active: true }, P)).toBe(1);
  });

  it('stops it catching once soaked enough', () => {
    expect(dieselCatchFactor(0, P)).toBe(1);
    expect(dieselCatchFactor(P.dieselStartFrom, P)).toBe(1);
    expect(dieselCatchFactor(P.dieselNoStart, P)).toBe(0);
    expect(dieselCatchFactor(1, P)).toBe(0);
  });
});

describe('diesel in the tank', () => {
  it('mixes into the tank by volume and reaches the float bowl, and a drain loses all of it', () => {
    const f = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startLitres: 6, tap: 'on', startTap: 'on' });
    f.add(2, 0, 1); // 2 L of diesel on 6 L of petrol
    f.bowl = 0;
    expect(f.diesel).toBeCloseTo(0.25, 5);
    f.update(5, { rpm: 0, throttle: 0, choke: 0, running: false });
    expect(f.bowlDiesel).toBeGreaterThan(0);
    const lost = f.drain();
    expect(lost).toBeGreaterThan(7);
    expect(f.litres).toBe(0);
    expect(f.diesel).toBe(0);
    expect(f.bowlDiesel).toBe(0);
  });

  it('comes from a can, and fills the can from the bowser', () => {
    const can = { x: 0, z: 0 };
    const c = new JerryCan({ scene: { add() {} }, world: { heightAt: () => 0 }, position: can, params: { ...DEFAULT_JERRY_CAN_PARAMS, startLitres: 0 } });
    c.fill(10, 0, 1);
    expect(c.diesel).toBe(1);
    c.fill(10, 0, 0);
    expect(c.diesel).toBeCloseTo(0.5, 5);
    expect(fuelText(0, 1)).toBe('red diesel');
    expect(fuelText(0, 0.5)).toContain('50% red diesel');
    expect(fuelText(0, 0)).toBe('straight petrol');
  });
});

/** A warm engine running on the given diesel fraction for a while; returns it and whether it was still running at the end. */
function runOn(diesel, seconds) {
  const e = new EngineModel({}, { random: seeded(5) });
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  for (let t = 0; t < seconds; t += 0.05) e.update(0.05, { throttle: 0.3, diesel });
  return e;
}

describe('an engine on diesel', () => {
  it('runs rougher and weaker the longer it has had it, and then dies', () => {
    const clean = runOn(0, 5);
    const early = runOn(0.3, 5);
    const late = runOn(0.3, 30);
    expect(early.dieselSoak).toBeLessThan(late.dieselSoak);
    expect(late.roughness).toBeGreaterThan(early.roughness);
    expect(early.roughness).toBeGreaterThan(clean.roughness);
    expect(late.power).toBeLessThan(clean.power);
    const dead = runOn(0.5, 120);
    expect(dead.isRunning).toBe(false);
    expect(dead.lastStallReason).toBe('diesel');
  });

  it('will not restart until it is cleared, then will', () => {
    const e = runOn(0.5, 120);
    const crank = () => {
      e.setIgnition(true);
      for (let t = 0; t < 8 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3, diesel: 0 });
      return e.isRunning;
    };
    expect(crank()).toBe(false);
    e.dieselSoak = 0;
    e.setTemperature(1);
    expect(crank()).toBe(true);
  });
});
