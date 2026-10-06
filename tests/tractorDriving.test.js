import { describe, it, expect } from 'vitest';
import { EngineModel, EngineState } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS } from '../src/vehicle/manualDrivetrain.js';
import { TRACTOR_SPEC } from '../src/vehicle/quadSpecs.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { existsSync } from 'node:fs';
import { AUDIO_PARAM_RANGES } from '../src/audio/audioParams.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const DT = 1 / 60;

/** A warm, idling tractor with the clutch down and nothing in gear. */
function warmTractor(seed = 1) {
  const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...TRACTOR_SPEC.engine, initialTemperature: 1 }, { random: seeded(seed) });
  engine.setIgnition(true);
  for (let t = 0; t < 4 && !engine.isRunning; t += DT) engine.update(DT, { starter: true, fuel: 1 });
  for (let t = 0; t < 2; t += DT) engine.update(DT, { fuel: 1 });
  const drive = new ManualDrivetrain({ ...DEFAULT_VEHICLE_PARAMS, ...TRACTOR_SPEC.vehicle }, DEFAULT_GEARBOX_PARAMS);
  return { engine, drive };
}

/** Selects a gear with the clutch down, then lets it up and holds a throttle, with the tractor standing still. Returns whether it stalled. */
function pullAway(gear, throttle, seed = 1) {
  const { engine, drive } = warmTractor(seed);
  const step = (clutchHeld, thr) => {
    drive.update({ dt: DT, clutchHeld, power: engine.power, running: engine.isRunning, throttle: thr, brake: 0, forwardSpeed: 0 });
    engine.update(DT, { fuel: 1, throttle: thr, load: drive.engineLoad });
  };
  for (let t = 0; t < 0.5; t += DT) step(true, 0);
  drive.select(gear);
  for (let t = 0; t < 4; t += DT) step(false, throttle);
  return { stalled: engine.state === EngineState.STALLED, rpm: engine.rpm };
}

describe('pulling away on the tractor', () => {
  it('is easy in first, even with no throttle', () => {
    for (let seed = 1; seed <= 5; seed++) expect(pullAway(1, 0, seed).stalled).toBe(false);
  });

  it('stalls in third from rest with the throttle shut', () => {
    expect(pullAway(3, 0).stalled).toBe(true);
  });

  it('is saved in third by a handful of throttle', () => {
    expect(pullAway(3, 0.6).stalled).toBe(false);
  });

  it('copes in second with a little throttle', () => {
    expect(pullAway(2, 0.25).stalled).toBe(false);
  });
});

describe('the tractor spec', () => {
  it('is a diesel with a manual gearbox, on red diesel', () => {
    expect(TRACTOR_SPEC.engine.compressionIgnition).toBe(true);
    expect(TRACTOR_SPEC.engine.runsOnDiesel).toBe(true);
    expect(new FuelSystem({ ...DEFAULT_FUEL_PARAMS, ...TRACTOR_SPEC.fuel }).diesel).toBe(1);
  });

  it('names a dash style and a sound bank that exist', () => {
    expect(DASH_STYLES).toContain(TRACTOR_SPEC.dashStyle);
    expect(AUDIO_PARAM_RANGES.recBank).toContain(TRACTOR_SPEC.audio.recBank);
    expect(existsSync(`public/audio/${TRACTOR_SPEC.audio.recBank}.json`)).toBe(true);
  });

  it('idles inside its range and above the safe idle', () => {
    expect(TRACTOR_SPEC.idleRange[0]).toBeGreaterThanOrEqual(TRACTOR_SPEC.safeIdle);
  });
});

describe('the tractor idling', () => {
  const idleSpread = (temperature) => {
    const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...TRACTOR_SPEC.engine, baseRoughness: 0.08, initialTemperature: temperature }, { random: seeded(7) });
    engine.setIgnition(true);
    for (let t = 0; t < 8 && !engine.isRunning; t += DT) engine.update(DT, { starter: true, fuel: 1 });
    for (let t = 0; t < 3; t += DT) engine.update(DT, { fuel: 1 });
    let lo = Infinity;
    let hi = 0;
    for (let t = 0; t < 30; t += DT) {
      engine.update(DT, { fuel: 1 });
      lo = Math.min(lo, engine.rpm);
      hi = Math.max(hi, engine.rpm);
    }
    return { lo, hi, running: engine.isRunning };
  };

  it('holds a steady rpm, warm or cold, dead steady', () => {
    for (const temperature of [1, 0.3]) {
      const { lo, hi, running } = idleSpread(temperature);
      expect(running).toBe(true);
      expect(hi - lo).toBeLessThan(5);
    }
  });
});

describe('no fuel tap, and a hand throttle that starts at a working speed', () => {
  it('always feeds the engine from the whole tank, whatever the tap says', () => {
    const f = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, ...TRACTOR_SPEC.fuel });
    f.setLitres(2);
    expect(f.reachable).toBe(2);
    expect(f.cycleTap()).toBe('on');
    expect(f.reachable).toBe(2);
  });

  it('idles low, and the hand throttle is left a little open at the start', () => {
    expect(TRACTOR_SPEC.engine.idleRpmWarm).toBeLessThanOrEqual(500);
    expect(DEFAULT_GEARBOX_PARAMS.handStart).toBeGreaterThan(0);
    const e = TRACTOR_SPEC.engine;
    const start = e.idleRpmWarm + DEFAULT_GEARBOX_PARAMS.handStart * (e.maxRpm - e.idleRpmWarm);
    expect(start).toBeGreaterThan(600);
    expect(start).toBeLessThan(800);
  });
});
