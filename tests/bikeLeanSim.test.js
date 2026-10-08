import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { QuadPhysics } from '../src/vehicle/quadPhysics.js';
import { MOTO_LAYOUT } from '../src/vehicle/miniMotoModel.js';
import { BikeLean, DEFAULT_BIKE_PARAMS } from '../src/vehicle/bikeLean.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';

// The mini moto's real physics on flat ground with the lean model driving it, the way quad.js does, without Three.js.
const moto = EXTRA_SPECS.find((s) => s.id === 'moto');
const DT = 1 / 60;

function ride(plan, { grip = 1, safe = false, seconds = 8 } = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0).setFriction(1));
  const params = { ...DEFAULT_VEHICLE_PARAMS, ...moto.vehicle };
  const phys = new QuadPhysics(world, RAPIER, params, { x: 0, y: 0.4, z: 0, yaw: 0 }, 1, MOTO_LAYOUT);
  const bike = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
  const log = { maxLean: 0, yaw0: 0, fell: false, upright: 1, speed: 0, minUp: 1 };
  let speed = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * DT;
    const c = plan(t, speed);
    const { lean, rate } = phys.lean();
    const maxSteer = (params.maxSteerDeg * Math.PI) / 180;
    const out = bike.update(DT, {
      lean, leanRate: rate, speed: phys.forwardSpeed, bars: c.bars, barAngle: c.bars * maxSteer * 0.5, throttle: c.throttle, brake: c.brake, grip, safe, gentle: false,
    });
    phys.gripMul = phys.wheels.map((w) => (w.front ? out.frontGrip : out.rearGrip));
    phys.applyControls({ driveForce: c.throttle * params.maxDriveForce * Math.max(0, 1 - speed / moto.vehicle.maxSpeed), brake: c.brake * 0.6, steer: out.steer, dt: DT });
    phys.rollTorque(out.rollTorque, DT);
    phys.update(DT);
    world.step();
    speed = phys.forwardSpeed;
    log.maxLean = Math.max(log.maxLean, Math.abs(lean));
    log.minUp = Math.min(log.minUp, Math.cos(lean));
    if (bike.fallen) log.fell = true;
  }
  log.speed = speed;
  log.final = { lean: phys.lean().lean, y: phys.body.translation().y, angY: phys.body.angvel().y };
  log.bike = bike;
  return log;
}

describe('the mini moto on two wheels', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('stays up parked, and rolling straight', () => {
    const a = ride(() => ({ bars: 0, throttle: 0, brake: 0 }), { seconds: 4 });
    expect(a.fell).toBe(false);
    expect(a.maxLean).toBeLessThan(0.05);
    const b = ride(() => ({ bars: 0, throttle: 1, brake: 0 }), { seconds: 6 });
    expect(b.fell).toBe(false);
    expect(b.speed).toBeGreaterThan(5);
    expect(b.maxLean).toBeLessThan(0.08);
  });

  it('leans into a corner and turns on the lean', () => {
    const l = ride((t, v) => ({ bars: t > 4 ? 0.7 : 0, throttle: v < 8 ? 1 : 0.5, brake: 0 }), { seconds: 9 });
    expect(l.fell).toBe(false);
    expect(l.final.lean).toBeGreaterThan(0.2); // leaning left
    expect(l.final.angY).toBeGreaterThan(0.2); // and turning left
    const r = ride((t, v) => ({ bars: t > 4 ? -0.7 : 0, throttle: v < 8 ? 1 : 0.5, brake: 0 }), { seconds: 9 });
    expect(r.final.lean).toBeLessThan(-0.2);
    expect(r.final.angY).toBeLessThan(-0.2);
  });

  it('tucks the front if you grab the brake mid-corner', () => {
    const t = ride((s, v) => ({ bars: s > 4 ? 0.9 : 0, throttle: v < 8 && s < 6 ? 1 : 0, brake: s > 6 ? 1 : 0 }), { seconds: 10 });
    expect(t.fell).toBe(true);
  });

  it('goes down on slippery ground where grass would hold', () => {
    const plan = (s, v) => ({ bars: s > 4 ? 1 : 0, throttle: v < 8 ? 1 : 0.2, brake: 0 });
    expect(ride(plan, { grip: 1, seconds: 10 }).fell).toBe(false);
    expect(ride(plan, { grip: 0.25, seconds: 10 }).fell).toBe(true);
  });

  it('is held up regardless when nobody can fall off it', () => {
    const t = ride((s, v) => ({ bars: s > 4 ? 0.9 : 0, throttle: v < 8 && s < 6 ? 1 : 0, brake: s > 6 ? 1 : 0 }), { seconds: 10, safe: true });
    expect(t.fell).toBe(false);
  });
});
