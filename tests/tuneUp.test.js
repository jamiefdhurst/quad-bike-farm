import { describe, it, expect } from 'vitest';
import { QUAD_SPECS, TRACTOR_SPEC, UTV_SPEC } from '../src/vehicle/quadSpecs.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { applyIdle, CLUTCH_MARGIN_RPM } from '../src/vehicle/quadVariation.js';
import {
  DEFAULT_TUNE_PARAMS as P,
  captureStock,
  stockSettings,
  isStock,
  limits,
  clampSettings,
  nudge,
  applyTune,
} from '../src/vehicle/tuneUp.js';

/** A quad's params as the game sets them up, with this game's idle. */
function quad(index, idle, spec = QUAD_SPECS[index]) {
  const target = {
    engine: { ...DEFAULT_ENGINE_PARAMS, ...spec.engine },
    vehicle: { ...DEFAULT_VEHICLE_PARAMS, ...spec.vehicle },
    fuel: { ...DEFAULT_FUEL_PARAMS, ...spec.fuel },
    smoke: { warmDensity: 0.2 },
    spec,
  };
  applyIdle(target.engine, target.vehicle, idle ?? spec.idleRange[0]);
  return target;
}

const snapshot = (t) => JSON.stringify({ e: t.engine, v: t.vehicle, f: t.fuel, s: t.smoke });

describe('tune-up', () => {
  it('stock settings change nothing', () => {
    const t = quad(0, 900);
    const before = snapshot(t);
    const stock = captureStock(t);
    applyTune(t, stock, stockSettings(stock));
    expect(snapshot(t)).toBe(before);
    expect(isStock(stockSettings(stock), stock)).toBe(true);
  });

  it('back to stock restores everything exactly after any changes', () => {
    for (let i = 0; i < QUAD_SPECS.length; i++) {
      const t = quad(i, QUAD_SPECS[i].idleRange[1]);
      const before = snapshot(t);
      const stock = captureStock(t);
      applyTune(t, stock, { idle: stock.engine.idleRpmWarm - 150, mixture: -2, limiter: 3, clutch: 3, tyres: 3 });
      expect(snapshot(t)).not.toBe(before);
      applyTune(t, stock, { idle: 9999, mixture: 3, limiter: 1, clutch: -2, tyres: 6 });
      applyTune(t, stock, stockSettings(stock));
      expect(snapshot(t)).toBe(before);
    }
  });

  it('never lets the warm idle below the safe minimum, even run lean', () => {
    for (let i = 0; i < QUAD_SPECS.length; i++) {
      const t = quad(i, QUAD_SPECS[i].safeIdle + 100);
      const stock = captureStock(t);
      let s = stockSettings(stock);
      s = { ...s, mixture: -P.leanClicks };
      for (let k = 0; k < 40; k++) s = nudge(s, 'idle', -1, stock);
      const used = applyTune(t, stock, s);
      expect(used.idle).toBe(QUAD_SPECS[i].safeIdle);
      // What it actually idles at once the lean drop is taken off the screw.
      const leanDrop = -t.engine.mixtureTrim * t.engine.leanIdleDrop;
      expect(t.engine.idleRpmWarm - leanDrop).toBeCloseTo(QUAD_SPECS[i].safeIdle, 5);
      // The stall point is scaled to the idle it runs at, as for a stock quad at that idle.
      const base = { ...DEFAULT_ENGINE_PARAMS, ...QUAD_SPECS[i].engine };
      expect(t.engine.stallRpm).toBe(Math.round((base.stallRpm * QUAD_SPECS[i].safeIdle) / base.idleRpmWarm));
    }
  });

  it('always keeps the clutch clear of the idle, so it cannot creep', () => {
    for (let i = 0; i < QUAD_SPECS.length; i++) {
      for (const idle of QUAD_SPECS[i].idleRange) {
        const t = quad(i, idle);
        const stock = captureStock(t);
        let s = stockSettings(stock);
        for (let k = 0; k < 10; k++) s = nudge(s, 'clutch', -1, stock);
        for (let k = 0; k < 40; k++) s = nudge(s, 'idle', 1, stock);
        applyTune(t, stock, s);
        expect(t.vehicle.clutchEngageRpm).toBeGreaterThanOrEqual(t.engine.idleRpmWarm + CLUTCH_MARGIN_RPM);
        for (let k = 0; k < 10; k++) s = nudge(s, 'clutch', -1, stock);
        applyTune(t, stock, s);
        expect(t.vehicle.clutchEngageRpm).toBeGreaterThanOrEqual(s.idle + CLUTCH_MARGIN_RPM);
        expect(t.vehicle.clutchFullRpm - t.vehicle.clutchEngageRpm).toBe(stock.vehicle.clutchFullRpm - stock.vehicle.clutchEngageRpm);
      }
    }
  });

  it('taking the limiter off raises the top speed by 15 to 25 percent', () => {
    const t = quad(0, 900);
    const stock = captureStock(t);
    let s = stockSettings(stock);
    for (let k = 0; k < 10; k++) s = nudge(s, 'limiter', 1, stock);
    expect(s.limiter).toBe(P.limiterTurns);
    applyTune(t, stock, s);
    const gain = t.vehicle.maxSpeed / stock.vehicle.maxSpeed - 1;
    expect(gain).toBeGreaterThanOrEqual(0.15);
    expect(gain).toBeLessThanOrEqual(0.25);
    expect(t.engine.maxRpm).toBeGreaterThan(stock.engine.maxRpm);
    expect(t.fuel.burnPerRev).toBeGreaterThan(stock.fuel.burnPerRev);
  });

  it('lean is thriftier with more drive, rich is thirstier and smokier', () => {
    const t = quad(1, 1200);
    const stock = captureStock(t);
    applyTune(t, stock, { ...stockSettings(stock), mixture: -2 });
    expect(t.engine.mixtureTrim).toBeLessThan(0);
    expect(t.fuel.burnPerRev).toBeLessThan(stock.fuel.burnPerRev);
    expect(t.vehicle.maxDriveForce).toBeGreaterThan(stock.vehicle.maxDriveForce);
    expect(t.engine.warmUpSeconds).toBeLessThan(stock.engine.warmUpSeconds);
    applyTune(t, stock, { ...stockSettings(stock), mixture: 3 });
    expect(t.engine.mixtureTrim).toBeGreaterThan(t.engine.richTolerance); // runs rich even warm
    expect(t.fuel.burnPerRev).toBeGreaterThan(stock.fuel.burnPerRev);
    expect(t.smoke.warmDensity).toBeGreaterThan(stock.smoke.warmDensity);
    applyTune(t, stock, { ...stockSettings(stock), mixture: 2 });
    expect(t.engine.mixtureTrim).toBeLessThan(t.engine.richTolerance); // two clicks is only richer from cold
  });

  it('steps from stock and lands back on the same values coming back from a limit', () => {
    const t = quad(0, 873);
    const stock = captureStock(t);
    let s = stockSettings(stock);
    s = nudge(s, 'idle', -1, stock);
    expect(s.idle).toBe(823);
    for (let k = 0; k < 20; k++) s = nudge(s, 'idle', -1, stock);
    expect(s.idle).toBe(650);
    s = nudge(s, 'idle', 1, stock);
    expect(s.idle).toBe(673);
    s = nudge(stockSettings(stock), 'tyres', -1, stock);
    expect(s.tyres).toBe(3.5);
  });

  it('clamps out-of-range settings', () => {
    const t = quad(2, 1500);
    const stock = captureStock(t);
    const s = clampSettings({ idle: 100, mixture: -10, limiter: 10, clutch: -10, tyres: 0 }, stock);
    expect(s.idle).toBe(limits('idle', s, stock)[0]);
    expect(s.mixture).toBe(-P.leanClicks);
    expect(s.limiter).toBe(P.limiterTurns);
    expect(s.tyres).toBe(P.minPsi);
    expect(stock.vehicle.clutchEngageRpm + s.clutch * P.clutchStep).toBeGreaterThanOrEqual(s.idle + CLUTCH_MARGIN_RPM);
  });
});

describe('tune-up on the diesels', () => {
  for (const [name, spec] of [['hartley', TRACTOR_SPEC], ['UTV', UTV_SPEC]]) {
    it(`takes the ${name}'s idle screw up and down within its safe range and puts stock back`, () => {
      const t = quad(0, undefined, spec);
      const before = snapshot(t);
      const stock = captureStock(t);
      const [lo, hi] = limits('idle', stockSettings(stock), stock);
      expect(hi).toBeGreaterThan(lo);
      let s = stockSettings(stock);
      for (let i = 0; i < 30; i++) s = nudge(s, 'idle', 1, stock);
      applyTune(t, stock, s);
      expect(s.idle).toBeLessThanOrEqual(hi);
      for (let i = 0; i < 60; i++) s = nudge(s, 'idle', -1, stock);
      expect(s.idle).toBeGreaterThanOrEqual(lo);
      applyTune(t, stock, stockSettings(stock));
      expect(snapshot(t)).toBe(before);
    });
  }
});
