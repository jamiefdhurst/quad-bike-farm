import { describe, it, expect } from 'vitest';
import { Traction, surfaceGrip, isDriven } from '../src/vehicle/traction.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';

const params = { ...DEFAULT_VEHICLE_PARAMS };
const yellow = { ...DEFAULT_VEHICLE_PARAMS, ...QUAD_SPECS.find((s) => s.id === 'hornet').vehicle };
const FRONT = [true, true, false, false];

/** Four wheels on one surface; loads front-light as when accelerating hard. */
function wheels(p, mud, puddle, loads = [350, 350, 900, 900]) {
  return loads.map((load, i) => ({ driven: isDriven(p, FRONT[i]), load, grip: surfaceGrip(p, mud, puddle), contact: true }));
}

function settle(t, p, force, ws, seconds = 1) {
  for (let s = 0; s < seconds * 60; s++) t.update(1 / 60, force, ws, p);
  return t;
}

describe('surface grip', () => {
  it('is grippiest on grass, less on the track and least in a puddle', () => {
    const grass = surfaceGrip(params, 0, 0);
    const track = surfaceGrip(params, 1, 0);
    const puddle = surfaceGrip(params, 1, 1);
    expect(grass).toBe(params.grassFrictionSlip);
    expect(track).toBe(params.mudFrictionSlip);
    expect(puddle).toBe(params.puddleFrictionSlip);
    expect(track).toBeLessThan(grass * 0.5);
    expect(puddle).toBeLessThan(track * 0.7);
  });

  it('blends across the edge of the track', () => {
    const half = surfaceGrip(params, 0.5, 0);
    expect(half).toBeGreaterThan(params.mudFrictionSlip);
    expect(half).toBeLessThan(params.grassFrictionSlip);
  });
});

describe('traction', () => {
  it('passes the whole drive force through on grass without spinning', () => {
    const t = settle(new Traction(), params, 2000, wheels(params, 0, 0));
    expect(t.spin).toBe(0);
    const total = t.forces.reduce((a, f) => a + f, 0);
    expect(total).toBeCloseTo(2000, 3);
  });

  it('shares the drive by grip, so the loaded rear wheels take most of it', () => {
    const t = settle(new Traction(), params, 2000, wheels(params, 0, 0));
    expect(t.forces[2]).toBeGreaterThan(t.forces[0] * 2);
  });

  it('drives only the rear wheels on the yellow quad', () => {
    const t = settle(new Traction(), yellow, 2500, wheels(yellow, 0, 0));
    expect(t.forces[0]).toBe(0);
    expect(t.forces[1]).toBe(0);
    expect(t.forces[2] + t.forces[3]).toBeCloseTo(2500, 3);
  });

  it('lets the yellow quad spin its rear wheels on the track at full power, and more in a puddle', () => {
    const track = settle(new Traction(), yellow, 2500, wheels(yellow, 1, 0));
    const puddle = settle(new Traction(), yellow, 2500, wheels(yellow, 1, 1));
    expect(track.spin).toBeGreaterThan(0.1);
    expect(puddle.spin).toBeGreaterThan(track.spin);
    // Spinning loses drive and sideways grip on the driven wheels only.
    expect(track.forces[2] + track.forces[3]).toBeLessThan(2500);
    expect(track.grips[2]).toBeLessThan(yellow.mudFrictionSlip);
    expect(track.grips[0]).toBeCloseTo(yellow.mudFrictionSlip, 5);
  });

  it('keeps the four-wheel-drive quads from spinning on the track', () => {
    const t = settle(new Traction(), params, 2000, wheels(params, 1, 0));
    expect(t.spin).toBe(0);
  });

  it('stops spinning once the throttle comes off', () => {
    const t = settle(new Traction(), yellow, 2500, wheels(yellow, 1, 1));
    expect(t.spin).toBeGreaterThan(0.5);
    settle(t, yellow, 300, wheels(yellow, 1, 1), 2);
    expect(t.spin).toBeLessThan(0.01);
  });

  it('spins freely in the air', () => {
    const ws = wheels(yellow, 0, 0).map((w) => ({ ...w, contact: false, load: 0 }));
    const t = settle(new Traction(), yellow, 1000, ws);
    expect(t.spin).toBeGreaterThan(0.9);
    expect(t.spinSlip(yellow)).toBeGreaterThan(0);
  });
});
