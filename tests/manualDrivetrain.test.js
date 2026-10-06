import { describe, it, expect } from 'vitest';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS as G, gearLabel } from '../src/vehicle/manualDrivetrain.js';
import { DEFAULT_VEHICLE_PARAMS as V } from '../src/vehicle/vehicleParams.js';

const base = { dt: 1 / 60, clutchHeld: false, power: 1, running: true, throttle: 0, brake: 0, forwardSpeed: 0 };

/** Holds the controls for a number of seconds and returns the drivetrain. */
function run(d, seconds, s) {
  for (let t = 0; t < seconds; t += 1 / 60) d.update({ ...base, ...s });
  return d;
}

describe('the gear lever and clutch pedal', () => {
  it('starts in neutral with the clutch up', () => {
    const d = new ManualDrivetrain(V);
    expect(d.gear).toBe(0);
    expect(d.neutral).toBe(true);
    expect(d.pedal).toBe(0);
  });

  it('only changes into a gear with the clutch down, but finds neutral any time', () => {
    const d = new ManualDrivetrain(V);
    expect(d.select(1)).toBe('clutch');
    expect(d.gear).toBe(0);
    run(d, 0.5, { clutchHeld: true });
    expect(d.select(1)).toBe('ok');
    expect(d.gear).toBe(1);
    expect(d.select(1)).toBe('same');
    run(d, 2, { clutchHeld: false });
    expect(d.select(2)).toBe('clutch');
    expect(d.select(0)).toBe('ok');
  });

  it('presses the pedal fast and lets it up slowly', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.2, { clutchHeld: true });
    expect(d.pedal).toBe(1);
    run(d, 0.2, { clutchHeld: false });
    expect(d.pedal).toBeGreaterThan(0.6);
    run(d, 1, { clutchHeld: false });
    expect(d.pedal).toBe(0);
    expect(d.clutch).toBe(1);
  });

  it('may only crank in neutral or with the clutch down', () => {
    const d = new ManualDrivetrain(V);
    expect(d.mayCrank).toBe(true);
    run(d, 0.5, { clutchHeld: true });
    d.select(2);
    expect(d.mayCrank).toBe(true);
    run(d, 2, {});
    expect(d.mayCrank).toBe(false);
  });

  it('labels the gates', () => {
    expect([-1, 0, 1, 2, 3].map(gearLabel)).toEqual(['R', 'N', '1', '2', '3']);
  });
});

describe('drive', () => {
  const inGear = (gear) => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(gear);
    return d;
  };

  it('gives no drive in neutral or with the clutch down', () => {
    expect(run(new ManualDrivetrain(V), 1, { throttle: 1 }).driveForce).toBe(0);
    const d = inGear(1);
    run(d, 0.2, { clutchHeld: true, throttle: 1 });
    expect(d.driveForce).toBe(0);
  });

  it('is strongest in first and weakest in third at a standstill', () => {
    const force = (gear) => run(inGear(gear), 2, { throttle: 1 }).driveForce;
    expect(force(1)).toBeGreaterThan(force(2));
    expect(force(2)).toBeGreaterThan(force(3));
    expect(force(1)).toBeCloseTo(V.maxDriveForce * G.torque1, -2);
  });

  it('stops pushing at the top speed of the gear', () => {
    const d = inGear(1);
    expect(run(d, 1, { throttle: 1, forwardSpeed: G.topSpeed1 + 0.1 }).driveForce).toBeLessThanOrEqual(0);
    expect(run(d, 1, { throttle: 1, forwardSpeed: G.topSpeed1 * 0.5 }).driveForce).toBeGreaterThan(0);
  });

  it('pushes backwards in reverse', () => {
    expect(run(inGear(-1), 2, { throttle: 1 }).driveForce).toBeLessThan(0);
  });

  it('creeps in first at idle with the clutch out, as a tractor does', () => {
    expect(run(inGear(1), 2, { throttle: 0 }).driveForce).toBeGreaterThan(0);
  });

  it('brakes the engine on a closed throttle while rolling in gear', () => {
    const d = run(inGear(2), 2, { throttle: 0, forwardSpeed: 3 });
    expect(d.driveForce).toBeLessThan(0);
    expect(d.coupled).toBe(true);
  });
});

describe('pulling away', () => {
  const dump = (gear, throttle) => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(gear);
    run(d, 3, { clutchHeld: false, throttle });
    return d.engineLoad;
  };

  it('drags the engine harder the higher the gear', () => {
    expect(dump(1, 0)).toBeLessThan(dump(2, 0));
    expect(dump(2, 0)).toBeLessThan(dump(3, 0));
    expect(dump(3, 0)).toBeGreaterThan(0.9);
  });

  it('is eased by opening the throttle', () => {
    expect(dump(3, 1)).toBeLessThan(dump(3, 0) * 0.2);
  });

  it('eases off as it gets up to speed, and is nothing in neutral', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(3);
    expect(run(d, 2, { forwardSpeed: G.topSpeed3 }).engineLoad).toBeLessThan(0.05);
    d.select(0);
    expect(run(d, 1, {}).engineLoad).toBe(0);
  });

  it('loads the engine when braking in gear while rolling, and not at a standstill', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(2);
    expect(run(d, 2, { forwardSpeed: 3, brake: 1, throttle: 0.5 }).engineLoad).toBeGreaterThan(0.9);
  });

  it('does nothing with the engine stopped', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(1);
    const s = run(d, 2, { running: false, throttle: 1 });
    expect(s.driveForce).toBe(0);
    expect(s.engineLoad).toBe(0);
  });
});
