import { describe, it, expect } from 'vitest';
import { EngineModel, EngineState } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS } from '../src/vehicle/manualDrivetrain.js';
import { Drivetrain } from '../src/vehicle/drivetrain.js';
import { QUAD_SPECS, YAK_SPEC, TOR_SPEC } from '../src/vehicle/quadSpecs.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const DT = 1 / 60;
const fuelControls = (spec) => ({ fuel: 1, diesel: spec.engine.petrolFussy ? 1 : 0 });

describe('starting in a hard frost', () => {
  it('works for the green quad, the red quad and the Land Rover with full choke, and the UTV on its glow plugs', () => {
    for (const spec of [QUAD_SPECS.find((s) => s.id === 'rb300'), QUAD_SPECS.find((s) => s.id === 'farm300'), TOR_SPEC, YAK_SPEC]) {
      for (let seed = 1; seed <= 8; seed++) {
        const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine, initialTemperature: 0 }, { random: seeded(seed) });
        engine.setIgnition(true);
        const diesel = !!spec.engine.compressionIgnition;
        if (diesel) for (let t = 0; t < 10; t += DT) engine.update(DT, { ...fuelControls(spec), chill: 1 });
        for (let t = 0; t < 30 && !engine.isRunning; t += DT) {
          engine.update(DT, { ...fuelControls(spec), starter: true, chill: 1, choke: diesel ? 0 : 1 });
        }
        expect(engine.isRunning, `${spec.id} seed ${seed}`).toBe(true);
      }
    }
  });
});

describe('stalling under braking', () => {
  function stops(spec, { gear = 0, temperature = 1, v0 = 10, decel = 5, seed = 1 }) {
    const params = { ...DEFAULT_VEHICLE_PARAMS, ...spec.vehicle };
    const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine, initialTemperature: temperature }, { random: seeded(seed) });
    engine.setIgnition(true);
    for (let t = 0; t < 40 && !engine.isRunning; t += DT) engine.update(DT, { ...fuelControls(spec), starter: true });
    for (let t = 0; t < 3; t += DT) engine.update(DT, fuelControls(spec));
    const manual = !!spec.gearbox;
    const drive = manual ? new ManualDrivetrain(params, { ...DEFAULT_GEARBOX_PARAMS, ...spec.gearbox }) : new Drivetrain(params);
    if (manual) drive.setGear(gear);
    let v = v0;
    const step = (throttle, brake) => {
      drive.update({ dt: DT, clutchHeld: false, power: engine.power, running: engine.isRunning, throttle, brake, forwardSpeed: v, rpm: engine.rpm, maxRpm: engine.params.maxRpm });
      engine.update(DT, { ...fuelControls(spec), throttle, load: drive.engineLoad });
    };
    if (!manual) for (let t = 0; t < 2; t += DT) step(0.7, 0); // under way, so the clutch has locked
    for (let t = 0; t < 8 && v > 0; t += DT) {
      step(0, 1);
      v = Math.max(0, v - decel * DT);
      if (engine.state === EngineState.STALLED) return true;
    }
    return false;
  }

  it('a warm UTV does not stall on a hard stop; a stone-cold one still can', () => {
    for (let seed = 1; seed <= 8; seed++) for (const v0 of [4, 10, 16]) expect(stops(YAK_SPEC, { v0, seed })).toBe(false);
    let cold = 0;
    for (let seed = 1; seed <= 8; seed++) if (stops(YAK_SPEC, { temperature: 0.02, v0: 10, seed })) cold++;
    expect(cold).toBeGreaterThan(0);
  });

  it('a warm Land Rover brakes to a stop in first or second without the clutch, but stalls in third or fourth', () => {
    for (let seed = 1; seed <= 6; seed++) {
      for (const gear of [1, 2]) for (const decel of [3, 8]) expect(stops(TOR_SPEC, { gear, decel, v0: 4, seed }), `g${gear} decel ${decel}`).toBe(false);
      for (const gear of [3, 4]) expect(stops(TOR_SPEC, { gear, decel: 3, v0: 4, seed }), `g${gear}`).toBe(true);
    }
  });
});
