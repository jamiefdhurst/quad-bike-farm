import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { QuadPhysics } from '../src/vehicle/quadPhysics.js';
import { ATC_LAYOUT } from '../src/vehicle/atcModel.js';
import { RiderLean, DEFAULT_RIDER_LEAN_PARAMS } from '../src/vehicle/riderLean.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';

// The old three-wheeler's real physics on flat ground, with the rider's weight shift applied the way quad.js does, without Three.js.
const atc = EXTRA_SPECS.find((s) => s.id === 'atc');
const DT = 1 / 60;

/** Rolls in at `speed` and puts the bars over (ramped in over `ramp` s), holding the speed with the throttle. Returns how far over it got. */
function corner(speed, { lean = true, ramp = 0.3, bars = 1, seconds = 5 } = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(0, -0.5, 0).setFriction(1));
  const params = { ...DEFAULT_VEHICLE_PARAMS, ...atc.vehicle, };
  const phys = new QuadPhysics(world, RAPIER, params, { x: 0, y: 0.4, z: 0, yaw: 0 }, 1, ATC_LAYOUT);
  const rider = new RiderLean({ ...DEFAULT_RIDER_LEAN_PARAMS });
  for (let i = 0; i < 60; i++) { phys.applyControls({ driveForce: 0, brake: 0, steer: 0, dt: DT }); phys.update(DT); world.step(); } // settle
  phys.body.setLinvel({ x: 0, y: 0, z: speed }, true);
  let maxRoll = 0;
  const maxSteer = (params.maxSteerDeg * Math.PI) / 180;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * DT;
    const b = bars * Math.min(1, t / ramp);
    const v = phys.forwardSpeed;
    const wheel = (b * maxSteer) / (1 + params.steerSpeedReduction * Math.abs(v));
    phys.applyControls({ driveForce: Math.max(0, (speed - v) * 400), brake: 0, steer: wheel, dt: DT });
    const torque = rider.update(DT, { bars: b, speed: v, aboard: lean, girl: false });
    phys.rollTorque(torque, DT);
    phys.update(DT);
    world.step();
    maxRoll = Math.max(maxRoll, Math.abs(phys.lean().lean));
  }
  return maxRoll;
}

describe('the old three-wheeler cornering', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const OVER = 60 * (Math.PI / 180); // past this it is going over

  it('is fine in a slow corner, with or without leaning', () => {
    expect(corner(6, { lean: false })).toBeLessThan(OVER);
    expect(corner(6)).toBeLessThan(OVER);
  });

  it('goes over if you sit still in a fast corner', () => {
    expect(corner(9, { lean: false })).toBeGreaterThan(OVER);
    expect(corner(10, { lean: false })).toBeGreaterThan(OVER);
  });

  it('stays up in the same corner once the rider leans in', () => {
    expect(corner(9)).toBeLessThan(OVER);
    expect(corner(11)).toBeLessThan(OVER);
  });

  it('still goes over if it is taken too fast even with the lean', () => {
    expect(corner(14)).toBeGreaterThan(OVER);
  });

  it('stays up going straight', () => {
    expect(corner(12, { bars: 0 })).toBeLessThan(0.1);
  });
});
