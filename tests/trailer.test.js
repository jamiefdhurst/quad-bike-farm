import { describe, it, expect } from 'vitest';
import { followHitch, pinPosition, edgePush, TrailerMotion, DEFAULT_TRAILER_PARAMS as P } from '../src/vehicle/trailer.js';

const flat = () => 0;
const make = () => {
  const t = new TrailerMotion({ ...P });
  t.place(0, -P.drawLength, 0, flat); // pointing +z, ring at the origin
  return t;
};

describe('following the hitch', () => {
  it('keeps the axle one drawbar length from the hitch, on the line to where it was', () => {
    const r = followHitch({ x: 0, z: 0 }, { x: 3, z: 4 }, 2.5);
    expect(Math.hypot(3 - r.x, 4 - r.z)).toBeCloseTo(2.5);
    expect(r.x / r.z).toBeCloseTo(0.75);
    expect(r.yaw).toBeCloseTo(Math.atan2(3, 4));
  });

  it('keeps its heading if the hitch is exactly on the axle', () => {
    expect(followHitch({ x: 1, z: 1 }, { x: 1, z: 1 }, 2, 0.7).yaw).toBe(0.7);
  });

  it('finds the pin behind a tractor', () => {
    const pin = pinPosition(10, 10, 0, 1.5);
    expect(pin.x).toBeCloseTo(10);
    expect(pin.z).toBeCloseTo(8.5);
  });
});

describe('trailer motion', () => {
  it('tracks straight behind a tractor driving straight, without turning or bouncing', () => {
    const t = make();
    for (let i = 0; i < 300; i++) t.update(1 / 60, { x: 0, z: i / 60 * 3, y: 0 }, flat);
    expect(t.speed).toBeCloseTo(3, 1);
    expect(Math.abs(t.omega)).toBeLessThan(1e-6);
    expect(t.jolt).toBeLessThan(1e-6);
    expect(t.x).toBeCloseTo(0, 5);
  });

  it('swings round after the tractor in a left turn, and the turn rate comes out left positive', () => {
    const t = make();
    let x = 0;
    let z = 0;
    let yaw = 0;
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      yaw += (0.4 / 60); // a steady left turn at 0.4 rad/s
      x += Math.sin(yaw) * 3 / 60;
      z += Math.cos(yaw) * 3 / 60;
      t.update(1 / 60, { x, z, y: 0 }, flat);
      peak = Math.max(peak, t.omega);
    }
    expect(t.omega).toBeCloseTo(0.4, 1);
    expect(t.yaw).toBeLessThan(yaw); // it's cutting in behind the tractor
    expect(peak).toBeLessThan(0.5);
  });

  it('is thrown about by a bump and settles again', () => {
    const t = make();
    let peak = 0;
    const bumpy = (x, z) => (z > 5 && z < 5.4 ? 0.2 : 0);
    for (let i = 0; i < 400; i++) {
      t.update(1 / 60, { x: 0, z: (i / 60) * 4, y: 0 }, bumpy);
      peak = Math.max(peak, t.jolt);
    }
    expect(peak).toBeGreaterThan(0.3);
    expect(t.jolt).toBeLessThan(0.05);
  });

  it('pitches up when the hitch is on higher ground, and rolls toward a high left wheel', () => {
    const t = make();
    t.update(1 / 60, { x: 0, z: 0, y: 0.5 }, flat);
    expect(t.pitch).toBeGreaterThan(0.1);
    const t2 = make();
    t2.update(1 / 60, { x: 0, z: 0, y: 0 }, (x) => (x > 0 ? 0.3 : 0)); // yaw 0: +x is the trailer's left
    expect(t2.roll).toBeGreaterThan(0.1);
  });
});

describe('the push on a girl', () => {
  it('shoves everyone toward the right in a left turn, so the girl on the right feels it toward her edge', () => {
    expect(edgePush(5, 0.5, -0.5)).toBeCloseTo(2.5);
    expect(edgePush(5, 0.5, 0.5)).toBeCloseTo(-2.5);
  });
  it('swaps in a right turn and is nothing going straight', () => {
    expect(edgePush(5, -0.5, 0.5)).toBeCloseTo(2.5);
    expect(edgePush(5, 0, 0.5)).toBeCloseTo(0);
  });
});
