import { describe, it, expect } from 'vitest';
import { toppleLoad, toppleTorque, tipAngle } from '../src/vehicle/topple.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';

const deg = (r) => (r * 180) / Math.PI;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

describe('the riders toppling a quad on a slope', () => {
  it('counts whoever is aboard', () => {
    const p = { riderTopple: 90, backTopple: 0.8 };
    expect(toppleLoad(p, {})).toBe(0);
    expect(toppleLoad(p, { front: true })).toBe(90);
    expect(toppleLoad(p, { front: true, back: true })).toBeCloseTo(162);
    expect(toppleLoad({ riderTopple: 0, backTopple: 0.8 }, { front: true, back: true })).toBe(0);
  });

  it('does nothing level, and leans it further whichever way it leans', () => {
    const level = toppleTorque({ x: 0, y: 1, z: 0 }, 90);
    expect(level.x).toBeCloseTo(0);
    expect(level.z).toBeCloseTo(0);
    for (const lean of [{ x: 0.3, z: 0 }, { x: -0.3, z: 0 }, { x: 0, z: 0.3 }, { x: 0.2, z: -0.2 }]) {
      const up = { x: lean.x, y: Math.sqrt(1 - lean.x ** 2 - lean.z ** 2), z: lean.z };
      const t = toppleTorque(up, 90);
      // Turning about the torque for a moment moves the up vector further from vertical.
      const d = cross(t, up);
      const after = { x: up.x + d.x * 1e-4, y: up.y + d.y * 1e-4, z: up.z + d.z * 1e-4 };
      expect(after.y / Math.hypot(after.x, after.y, after.z)).toBeLessThan(up.y);
      // And it grows with the lean, not with anything else.
      expect(Math.hypot(t.x, t.z)).toBeCloseTo(90 * 9.81 * Math.hypot(lean.x, lean.z));
    }
  });

  it('tips a ridden quad side-on to the steep banks but not one on its own', () => {
    // A quad: about 300 kg with its centre of mass 0.28 m up, wheels 0.48 m out from the middle and 0.62 m ahead and behind.
    const p = DEFAULT_VEHICLE_PARAMS;
    const m = p.mass;
    const h = 0.36 + p.centreOfMassY;
    expect(deg(tipAngle(m, h, 0.48, 0))).toBeGreaterThan(55);
    const ridden = deg(tipAngle(m, h, 0.48, toppleLoad(p, { front: true })));
    expect(ridden).toBeGreaterThan(34);
    expect(ridden).toBeLessThan(42); // the hill's steep banks peak at about 38 degrees (hill.test.js)
    // Two up, a good deal less.
    expect(deg(tipAngle(m, h, 0.48, toppleLoad(p, { front: true, back: true })))).toBeLessThan(33);
    // Nose-up, it goes over backwards somewhere past the steepest bank.
    const flip = deg(tipAngle(m, h, 0.62, toppleLoad(p, { front: true })));
    expect(flip).toBeGreaterThan(40);
    expect(flip).toBeLessThan(50);
    // The farm's own slopes (about 6 degrees at most) are nowhere near.
    expect(ridden).toBeGreaterThan(6 * 5);
  });
});
