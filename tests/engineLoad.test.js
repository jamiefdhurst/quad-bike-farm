import { describe, it, expect } from 'vitest';
import { EngineLoad, tractionFraction } from '../src/vehicle/engineLoad.js';
import { Drivetrain } from '../src/vehicle/drivetrain.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';

const DT = 1 / 60;
const P = DEFAULT_VEHICLE_PARAMS;
const G = 9.81;

const wheels = ({ mass = P.mass, mud = 0, contact = true, front = 1 } = {}) => {
  const each = (mass * G) / 4;
  return [front, front, 2 - front, 2 - front].map((k) => ({ force: contact ? each * k : 0, mud, contact }));
};

/**
 * A quad on a straight slope at full throttle, as a point mass: drive force
 * from the drivetrain, gravity along the slope and a little rolling drag.
 * Returns the load seen at the end and along the way.
 */
function ride({ seconds = 4, slope = 0, mud = 0, throttle = 1, mass = P.mass, contact = true, params = {} } = {}) {
  const p = { ...P, ...params };
  const dt = new Drivetrain(p);
  const load = new EngineLoad(p);
  let v = 0;
  let rpm = 4000;
  const trace = [];
  for (let i = 0; i < seconds / DT; i++) {
    dt.update({ rpm, power: 1, running: true, throttle, brake: 0, forwardSpeed: v, reverse: false, maxRpm: 6200 });
    load.update(DT, {
      throttle,
      brake: 0,
      forwardSpeed: v,
      reverse: false,
      driveForce: dt.driveForce,
      available: dt.available,
      clutch: dt.clutch,
      coupled: dt.coupled,
      mass,
      wheels: wheels({ mass, mud, contact }),
    });
    const resist = mass * G * Math.sin(Math.atan(slope)) + 15 * v;
    const a = contact ? (dt.driveForce - resist) / mass : 0;
    v = Math.max(0, v + a * DT);
    rpm = 6200 * (1 - 0.4 * load.driveLoad);
    trace.push({ v, driveLoad: load.driveLoad, resistLoad: load.resistLoad, grip: load.grip });
  }
  return { v, load, trace };
}

describe('traction', () => {
  it('puts all the force down when the tyres have grip to spare', () => {
    expect(tractionFraction(wheels(), 1500, P)).toBe(1);
  });

  it('spins in mud when asked for more than the mud will take', () => {
    const grass = tractionFraction(wheels(), 2400, P);
    const mud = tractionFraction(wheels({ mud: 1 }), 2400, P);
    expect(mud).toBeLessThan(grass);
    expect(mud).toBeLessThan(0.9);
  });

  it('spins a wheel that has lifted off the ground', () => {
    const w = wheels();
    w[0].contact = false;
    w[0].force = 0;
    expect(tractionFraction(w, 1500, P)).toBeCloseTo(0.75, 5);
  });

  it('gets nothing down in the air', () => {
    expect(tractionFraction(wheels({ contact: false }), 1500, P)).toBe(0);
  });

  it('a light quad spins its wheels sooner than a heavy one', () => {
    expect(tractionFraction(wheels({ mass: 200 }), 2400, P)).toBeLessThan(tractionFraction(wheels({ mass: 320 }), 2400, P));
  });
});

describe('engine load', () => {
  it('is heavy pulling away, then eases off once it gets going on the flat', () => {
    const { trace } = ride({ seconds: 6 });
    const early = Math.max(...trace.slice(0, 30).map((t) => t.driveLoad));
    const cruising = trace.at(-1).driveLoad;
    expect(early).toBeGreaterThan(0.5);
    expect(cruising).toBeLessThan(0.3);
  });

  it('is heavier climbing than on the flat, and the climb is resistance', () => {
    const flat = ride({ seconds: 3 }).load;
    const hill = ride({ seconds: 3, slope: 0.3 }).load;
    expect(hill.driveLoad).toBeGreaterThan(flat.driveLoad + 0.2);
    expect(hill.resistLoad).toBeGreaterThan(0.3);
    expect(flat.resistLoad).toBeLessThan(0.15);
  });

  it('is heavier in mud than on grass, unless the wheels spin', () => {
    const grass = ride({ seconds: 4 }).load;
    const mud = ride({ seconds: 4, mud: 1 }).load;
    expect(mud.resistLoad).toBeGreaterThan(grass.resistLoad);
    // Pulling away hard in mud the wheels spin and the load drops.
    const spin = ride({ seconds: 0.3, mud: 1, params: { mudGrip: 0.2 } }).load;
    const grip = ride({ seconds: 0.3 }).load;
    expect(spin.grip).toBeLessThan(0.6);
    expect(spin.driveLoad).toBeLessThan(grip.driveLoad);
  });

  it('drops to nothing in the air', () => {
    const { load } = ride({ seconds: 1, contact: false });
    expect(load.driveLoad).toBe(0);
    expect(load.grip).toBe(0);
  });

  it('is nothing with the throttle shut', () => {
    const { load } = ride({ seconds: 2, throttle: 0 });
    expect(load.driveLoad).toBe(0);
    expect(load.resistLoad).toBe(0);
  });

  it('turns the engine over a little faster on the overrun, more so as it speeds up', () => {
    const load = new EngineLoad(P);
    const overrun = (speed, extra = {}) =>
      load.update(DT, {
        throttle: 0,
        brake: 0,
        forwardSpeed: speed,
        reverse: false,
        driveForce: 0,
        available: 0,
        clutch: 0,
        coupled: true,
        mass: P.mass,
        wheels: wheels(),
        ...extra,
      }).overrunRpm;
    expect(overrun(5)).toBeGreaterThan(0);
    expect(overrun(10)).toBeGreaterThan(overrun(5));
    expect(overrun(100)).toBe(P.overrunMaxRpm);
    expect(overrun(10, { coupled: false })).toBe(0);
    expect(overrun(10, { brake: 1 })).toBe(0);
    expect(overrun(10, { throttle: 1 })).toBe(0);
  });
});

describe('drivetrain under load', () => {
  const base = { power: 1, running: true, throttle: 1, brake: 0, forwardSpeed: 5, reverse: false, maxRpm: 6200 };

  it('pulls just as hard while the engine labours', () => {
    const free = new Drivetrain(P).update({ ...base, rpm: 5600 });
    const laboured = new Drivetrain(P).update({ ...base, rpm: 2400, lugDrop: 3200 });
    expect(laboured.clutch).toBeCloseTo(free.clutch, 5);
    expect(laboured.driveForce).toBeCloseTo(free.driveForce, 5);
  });

  it('reports the force the engine could give with the clutch locked', () => {
    const d = new Drivetrain(P).update({ ...base, rpm: 1000 });
    expect(d.clutch).toBe(0);
    expect(d.driveForce).toBe(0);
    expect(d.available).toBeGreaterThan(0.7 * P.maxDriveForce);
  });

  it('keeps some engine braking on the overrun once coupled, after the revs drop', () => {
    const d = new Drivetrain(P);
    d.update({ ...base, rpm: 5000, forwardSpeed: 8 });
    expect(d.coupled).toBe(true);
    d.update({ ...base, rpm: 1500, throttle: 0, forwardSpeed: 8 });
    expect(d.driveForce).toBeCloseTo(-P.engineBrakeForce * P.overrunBrake, 5);
    // Not coupled (just rolling), no engine braking at idle revs.
    const rolling = new Drivetrain(P).update({ ...base, rpm: 1500, throttle: 0, forwardSpeed: 8 });
    expect(rolling.driveForce).toBeGreaterThanOrEqual(0);
  });
});
