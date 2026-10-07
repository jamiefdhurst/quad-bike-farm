import { describe, it, expect } from 'vitest';
import { Creep, creepSpeed, mayCreep, distanceToHedge, DEFAULT_CREEP_PARAMS as P } from '../src/vehicle/creep.js';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS } from '../src/vehicle/manualDrivetrain.js';

const base = { attended: false, running: true, gear: 1, hand: 0.15 };

describe('when it creeps', () => {
  it('needs nobody on it, running, in first and the throttle open', () => {
    expect(mayCreep(base)).toBe(true);
    expect(mayCreep({ ...base, attended: true })).toBe(false);
    expect(mayCreep({ ...base, running: false })).toBe(false);
    expect(mayCreep({ ...base, gear: 2 })).toBe(false);
    expect(mayCreep({ ...base, gear: 0 })).toBe(false);
    expect(mayCreep({ ...base, gear: -1 })).toBe(false);
    expect(mayCreep({ ...base, hand: 0.01 })).toBe(false);
  });

  it('not with the parking brake on, tipped over or on the winch', () => {
    for (const over of [{ parkBrake: true }, { tipped: true }, { towed: true }]) expect(mayCreep({ ...base, ...over })).toBe(false);
  });
});

describe('how fast', () => {
  it('goes with the hand throttle, a trickle at the start setting and never faster than first gear', () => {
    expect(creepSpeed(0.15)).toBeLessThan(1);
    expect(creepSpeed(0.6)).toBeGreaterThan(creepSpeed(0.15));
    expect(creepSpeed(1)).toBeLessThanOrEqual(DEFAULT_GEARBOX_PARAMS.topSpeed1);
  });

  it('has a floor, and none at all with the throttle shut', () => {
    expect(creepSpeed(P.minHand)).toBe(P.minSpeed);
    expect(creepSpeed(0)).toBe(0);
  });
});

describe('the creep itself', () => {
  it('holds the limit while allowed and drops it when not', () => {
    const c = new Creep();
    expect(c.update(0.1, { allowed: true, hand: 0.5, speed: 1 })).toMatchObject({ creeping: true, limit: creepSpeed(0.5) });
    expect(c.update(0.1, { allowed: false, hand: 0.5, speed: 1 })).toMatchObject({ creeping: false, limit: 0, stall: false });
  });

  it('stalls once it has been held up long enough, and not before', () => {
    const c = new Creep();
    let stalled = false;
    let t = 0;
    for (; t < P.stuckTime - 0.5; t += 0.1) stalled ||= c.update(0.1, { allowed: true, hand: 0.15, speed: 0 }).stall;
    expect(stalled).toBe(false);
    for (; t < P.stuckTime + 1; t += 0.1) stalled ||= c.update(0.1, { allowed: true, hand: 0.15, speed: 0 }).stall;
    expect(stalled).toBe(true);
  });

  it('does not stall while it is moving', () => {
    const c = new Creep();
    for (let t = 0; t < 60; t += 0.1) expect(c.update(0.1, { allowed: true, hand: 0.15, speed: 0.3 }).stall).toBe(false);
  });
});

describe('how far to the hedge', () => {
  it('is the distance along the heading to the edge of the square', () => {
    expect(distanceToHedge(0, 0, 0, 80)).toBeCloseTo(80);
    expect(distanceToHedge(0, 50, 0, 80)).toBeCloseTo(30);
    expect(distanceToHedge(0, 0, Math.PI, 80)).toBeCloseTo(80);
    expect(distanceToHedge(60, 0, Math.PI / 2, 80)).toBeCloseTo(20);
    expect(distanceToHedge(0, 0, Math.PI / 4, 80)).toBeCloseTo(80 * Math.SQRT2);
  });
});

describe('the gearbox with a speed limit', () => {
  const driveAt = (limit) => {
    const d = new ManualDrivetrain({ idleTorque: 0.15, drivePowerFloor: 0.2, maxDriveForce: 1000, coupledReleaseSpeed: 1, brakeLoadSpeed: 1, engineBrakeForce: 0 }, DEFAULT_GEARBOX_PARAMS);
    d.gear = 1;
    return (speed) => {
      for (let i = 0; i < 100; i++) d.update({ dt: 0.02, power: 1, running: true, throttle: 0.5, brake: 0, forwardSpeed: speed, speedLimit: limit });
      return d.driveForce;
    };
  };

  it('pulls from rest but stops pulling at the limit', () => {
    const at = driveAt(0.4);
    expect(at(0)).toBeGreaterThan(0);
    expect(at(0.4)).toBe(0);
    expect(at(0.2)).toBeLessThan(at(0));
  });

  it('is the gear that limits it when there is no limit', () => {
    const at = driveAt(Infinity);
    expect(at(0.4)).toBeGreaterThan(0);
    expect(at(DEFAULT_GEARBOX_PARAMS.topSpeed1)).toBe(0);
  });
});
