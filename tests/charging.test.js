import { describe, it, expect } from 'vitest';
import { alternatorOutput, netCharge, tooWeakToRun, lowBatteryStallRate, lampSupply, DEFAULT_CHARGING_PARAMS as C } from '../src/engine/charging.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';

const IDLE = 1150;
const MAX = 6200;
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('charging follows the revs', () => {
  it('gives a share at idle and everything a little way up', () => {
    expect(alternatorOutput(IDLE, IDLE, MAX)).toBeCloseTo(C.batteryChargeIdle);
    expect(alternatorOutput(MAX, IDLE, MAX)).toBe(1);
    expect(alternatorOutput(2000, IDLE, MAX)).toBeGreaterThan(alternatorOutput(1500, IDLE, MAX));
  });

  it('at idle with the lamps on it barely holds even; revving it charges', () => {
    const idle = netCharge(IDLE, IDLE, MAX, 1, P.batteryChargeRate);
    expect(Math.abs(idle)).toBeLessThan(0.0002);
    const revved = netCharge(3000, IDLE, MAX, 1, P.batteryChargeRate);
    expect(revved).toBeGreaterThan(0.001);
    expect(netCharge(IDLE, IDLE, MAX, 0, P.batteryChargeRate)).toBeGreaterThan(idle); // the lamps cost
  });

  it('a flat battery takes about ten minutes to fill revved, and far longer at idle', () => {
    const revved = 1 / netCharge(3000, IDLE, MAX, 0, P.batteryChargeRate);
    expect(revved).toBeGreaterThan(8 * 60);
    expect(revved).toBeLessThan(14 * 60);
    expect(1 / netCharge(IDLE, IDLE, MAX, 0, P.batteryChargeRate)).toBeGreaterThan(revved * 3);
  });

  it('a weak battery cannot keep it going at idle but can if the revs are held', () => {
    expect(tooWeakToRun(0.3, IDLE, IDLE)).toBe(true);
    expect(tooWeakToRun(0.3, IDLE * 1.5, IDLE)).toBe(false);
    expect(tooWeakToRun(0.6, IDLE, IDLE)).toBe(false);
    expect(lowBatteryStallRate(0.3, IDLE, IDLE)).toBeGreaterThan(0);
    expect(lowBatteryStallRate(0.05, IDLE, IDLE)).toBeGreaterThan(lowBatteryStallRate(0.35, IDLE, IDLE));
    expect(lowBatteryStallRate(0.3, 2000, IDLE)).toBe(0);
  });

  it('the lamps dim on a weak battery at idle and come back with the revs or a charge', () => {
    const weakIdle = lampSupply(0.2, IDLE, IDLE, MAX);
    expect(weakIdle).toBeLessThan(0.75);
    expect(lampSupply(0.2, 3500, IDLE, MAX)).toBeGreaterThan(weakIdle);
    expect(lampSupply(0.9, IDLE, IDLE, MAX)).toBe(1);
  });
});

describe('the engine on a weak battery', () => {
  const running = (battery, rpm) => {
    const e = new EngineModel({}, { random: seeded(3) });
    e.state = 'running';
    e.setIgnition(true);
    e.battery = battery;
    e.rpm = rpm;
    return e;
  };

  it('charges faster revved than idling, and the lamps slow it', () => {
    const a = running(0.5, IDLE);
    const b = running(0.5, 3000);
    a.updateBattery(10);
    b.updateBattery(10);
    expect(b.battery).toBeGreaterThan(a.battery);
    const lit = running(0.5, IDLE);
    lit.lightLoad = 1;
    lit.updateBattery(10);
    expect(lit.battery).toBeLessThan(a.battery);
  });

  it('dies at idle on a flat-ish battery (a petrol with a starter), and not when the revs are held', () => {
    const dies = running(0.15, IDLE);
    let stalled = false;
    for (let t = 0; t < 60 && !stalled; t += 0.1) {
      dies.rpm = IDLE;
      dies.state = 'running';
      dies.updateBattery(0.1);
      stalled = dies.state !== 'running';
    }
    expect(stalled).toBe(true);
    const held = running(0.15, 2500);
    for (let t = 0; t < 60; t += 0.1) held.updateBattery(0.1);
    expect(held.state).toBe('running');
  });

  it('a diesel, and an engine with no starter motor, carry on regardless', () => {
    for (const params of [{ compressionIgnition: true }, { noStarter: true }]) {
      const e = new EngineModel(params, { random: seeded(5) });
      e.state = 'running';
      e.battery = 0.05;
      e.rpm = IDLE;
      for (let t = 0; t < 60; t += 0.1) e.updateBattery(0.1);
      expect(e.state).toBe('running');
    }
  });
});
