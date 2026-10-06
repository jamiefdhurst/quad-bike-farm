import { describe, it, expect } from 'vitest';
import { EngineModel, EngineState } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS } from '../src/vehicle/manualDrivetrain.js';
import { AutoShifter, DEFAULT_SHIFTER_PARAMS } from '../src/vehicle/autoShifter.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const DT = 1 / 60;
const manualSpecs = QUAD_SPECS.filter((s) => s.manual);

function warm(spec, seed = 1) {
  const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine, initialTemperature: 1 }, { random: seeded(seed) });
  engine.setIgnition(true);
  for (let t = 0; t < 6 && !engine.isRunning; t += DT) engine.update(DT, { starter: true, fuel: 1 });
  for (let t = 0; t < 2; t += DT) engine.update(DT, { fuel: 1 });
  const params = { ...DEFAULT_VEHICLE_PARAMS, ...spec.vehicle };
  return { engine, drive: new ManualDrivetrain(params, { ...DEFAULT_GEARBOX_PARAMS, ...spec.gearbox }), params };
}

describe('the manual quads', () => {
  it('are the red, green and yellow, each with four gears that climb to its top speed', () => {
    expect(manualSpecs.map((s) => s.id).sort()).toEqual(['green', 'red', 'yellow']);
    for (const spec of manualSpecs) {
      const { drive, params } = warm(spec);
      expect(drive.gearbox.gears).toBe(4);
      const tops = [1, 2, 3, 4].map((g) => drive.topSpeed(g));
      expect([...tops].sort((a, b) => a - b)).toEqual(tops);
      expect(tops[3]).toBeCloseTo(params.maxSpeed, 5);
      expect(drive.select(5)).toBe('same');
    }
  });

  it('pull away in first without stalling, even with no throttle', () => {
    for (const spec of manualSpecs) {
      for (let seed = 1; seed <= 4; seed++) {
        const { engine, drive } = warm(spec, seed);
        const step = (clutchHeld) => {
          drive.update({ dt: DT, clutchHeld, power: engine.power, running: engine.isRunning, throttle: 0, brake: 0, forwardSpeed: 0, rpm: engine.rpm });
          engine.update(DT, { fuel: 1, throttle: 0, load: drive.engineLoad });
        };
        for (let t = 0; t < 0.5; t += DT) step(true);
        drive.select(1);
        for (let t = 0; t < 4; t += DT) step(false);
        expect(engine.state, spec.id).not.toBe(EngineState.STALLED);
      }
    }
  });

  it('stall when slowed in a high gear with the clutch out and no throttle, but not in first or with throttle held', () => {
    const stalls = (spec, gear, frac, throttle) => {
      const { engine, drive } = warm(spec);
      drive.setGear(gear);
      const v = drive.topSpeed(gear) * frac;
      for (let t = 0; t < 4; t += DT) {
        drive.update({ dt: DT, clutchHeld: false, power: engine.power, running: engine.isRunning, throttle, brake: 0, forwardSpeed: v, rpm: engine.rpm });
        engine.update(DT, { fuel: 1, throttle, load: drive.engineLoad });
        if (engine.state === EngineState.STALLED) return true;
      }
      return false;
    };
    for (const spec of manualSpecs) {
      for (const gear of [3, 4]) expect(stalls(spec, gear, 0.15, 0), `${spec.id} g${gear}`).toBe(true);
      for (const frac of [0, 0.15, 0.5]) expect(stalls(spec, 1, frac, 0), `${spec.id} first at ${frac}`).toBe(false);
      for (const gear of [2, 3, 4]) expect(stalls(spec, gear, 0.15, 0.6), `${spec.id} g${gear} with throttle`).toBe(false);
      expect(stalls(spec, 4, 0.8, 0), `${spec.id} g4 up to speed`).toBe(false);
    }
  });

  it('a gear is capped by the quad top speed, so a limiter still limits', () => {
    const { drive, params } = warm(manualSpecs[0]);
    params.maxSpeed = 10;
    expect(drive.topSpeed(4)).toBe(10);
  });
});

describe('the girls shifting', () => {
  const drive = new ManualDrivetrain({ ...DEFAULT_VEHICLE_PARAMS }, { ...DEFAULT_GEARBOX_PARAMS, ...manualSpecs[0].gearbox });
  const base = { gears: 4, topSpeed: (g) => drive.topSpeed(g), brake: 0, reverse: false };

  /** Runs the shifter for a few seconds against a fixed driver, applying its lever moves to a gear the way Quad does. */
  function settle(shifter, gear, input, seconds = 2) {
    let out = { gear, clutch: false };
    for (let t = 0; t < seconds; t += DT) {
      out = shifter.update(DT, { ...base, ...input, gear });
      gear = out.gear;
    }
    return out;
  }

  it('takes first from neutral when she opens the throttle, with a dip of the clutch', () => {
    const s = new AutoShifter();
    const first = s.update(DT, { ...base, gear: 0, speed: 0, throttle: 0.5 });
    expect(first).toEqual({ gear: 0, clutch: true });
    expect(settle(new AutoShifter(), 0, { speed: 0, throttle: 0.5 }).gear).toBe(1);
  });

  it('changes up through the gears as it speeds up, and down as it slows', () => {
    expect(settle(new AutoShifter(), 1, { speed: 4.2, throttle: 0.8 }).gear).toBe(2);
    expect(settle(new AutoShifter(), 3, { speed: 17, throttle: 1 }).gear).toBe(4);
    expect(settle(new AutoShifter(), 4, { speed: 3, throttle: 0.2 }).gear).toBe(1);
  });

  it('holds the clutch down for the change, and the lever moves part way through', () => {
    const s = new AutoShifter();
    const seen = [];
    let gear = 1;
    for (let t = 0; t < 0.6; t += DT) {
      const out = s.update(DT, { ...base, gear, speed: 4.3, throttle: 0.9 });
      seen.push(out.clutch);
      gear = out.gear;
    }
    expect(seen[0]).toBe(true);
    expect(gear).toBe(2);
    expect(seen[seen.length - 1]).toBe(false);
  });

  it('dips the clutch rather than stalling when she stops, and goes into reverse only once stopped', () => {
    expect(settle(new AutoShifter(), 1, { speed: 0.1, throttle: 0, brake: 1 }).clutch).toBe(true);
    expect(settle(new AutoShifter(), 2, { speed: 5, throttle: 0, reverse: true }).gear).not.toBe(-1);
    expect(settle(new AutoShifter(), 0, { speed: 0, throttle: 0.4, reverse: true }).gear).toBe(-1);
  });

  it('has the same tunables as the defaults say', () => {
    expect(new AutoShifter().params).toBe(DEFAULT_SHIFTER_PARAMS);
  });
});
