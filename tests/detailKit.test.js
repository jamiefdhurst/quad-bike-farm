import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { boltGeometry, boltCircle, boltRow, boltsMesh, BOLT_KINDS } from '../src/vehicle/detail/fixings.js';
import { cablePath, cableGeometry, hoseGeometry, pathLength } from '../src/vehicle/detail/cables.js';
import { discGeometry, caliperGeometry, drumGeometry } from '../src/vehicle/detail/brakes.js';

const box = (g) => {
  g.computeBoundingBox();
  return g.boundingBox;
};

describe('fixings', () => {
  it('every kind of bolt stands on y = 0, head up, about its size across', () => {
    for (const kind of BOLT_KINDS) {
      for (const washer of [true, false]) {
        const b = box(boltGeometry({ size: 0.012, kind, washer }));
        expect(b.min.y, kind).toBeCloseTo(0, 6);
        expect(b.max.y, kind).toBeGreaterThan(0.004);
        expect(b.max.x - b.min.x, kind).toBeLessThan(0.012 * 2.1);
      }
    }
  });

  it('places bolts round a circle and along a row', () => {
    const c = boltCircle(5, 0.1);
    expect(c).toHaveLength(5);
    for (const p of c) expect(Math.hypot(p[0], p[1])).toBeCloseTo(0.1);
    const r = boltRow([0, 0, 0], [1, 0, 0], 3, 0.1);
    expect(r.map((p) => p[0])).toEqual([0.1, 0.5, 0.9].map((x) => expect.closeTo(x)));
    expect(boltRow([0, 0, 0], [1, 0, 0], 1)[0][0]).toBeCloseTo(0.5);
  });

  it('a row of bolts is one mesh, heads facing the way asked', () => {
    const m = boltsMesh(boltRow([0, 0, 0], [0.5, 0, 0], 4), [0, 0, 1], new THREE.MeshStandardMaterial());
    const b = box(m.geometry);
    expect(b.min.z).toBeCloseTo(0, 5);
    expect(b.max.z).toBeGreaterThan(0.004);
  });
});

describe('cables', () => {
  it('runs through its anchors and sags between them', () => {
    const anchors = [[0, 1, 0], [1, 1, 0], [1, 0.5, 1]];
    const path = cablePath(anchors, { sag: 0.05, steps: 8 });
    expect(path[0]).toEqual([0, 1, 0]);
    expect(path[8].map((v) => +v.toFixed(6))).toEqual([1, 1, 0]);
    expect(path[path.length - 1].map((v) => +v.toFixed(6))).toEqual([1, 0.5, 1]);
    const level = cablePath([[0, 1, 0], [1, 1, 0]], { sag: 0.05, steps: 8 });
    expect(level[4][1]).toBeCloseTo(0.95); // the middle of a level metre hangs 5 cm
    expect(pathLength(path)).toBeGreaterThan(1 + Math.hypot(0.5, 1));
  });

  it('a cable sweeps into a tube, a hose gets clamps at both ends', () => {
    expect(cableGeometry([[0, 0, 0], [0, 0, 1]], 0.003).attributes.position.count).toBeGreaterThan(0);
    const { hose, clamps } = hoseGeometry([[0, 0, 0], [0.3, 0.1, 0]], 0.012, { ribbed: true });
    expect(hose.attributes.position.count).toBeGreaterThan(0);
    const b = box(clamps);
    expect(b.max.x - b.min.x).toBeGreaterThan(0.25);
    expect(() => cablePath([[0, 0, 0]])).toThrow();
  });
});

describe('brakes', () => {
  it('a disc is its radius, thin across the axle; a wave disc stays inside it', () => {
    for (const wave of [false, true]) {
      const { disc, dark } = discGeometry({ r: 0.09, wave });
      const b = box(disc);
      expect(b.max.y).toBeLessThanOrEqual(0.0901);
      expect(b.max.y).toBeGreaterThan(0.08);
      expect(b.max.x - b.min.x).toBeLessThan(0.02);
      expect(dark).toBeTruthy();
    }
  });

  it('a caliper sits over the disc edge, the drum within its fins', () => {
    const c = box(caliperGeometry({ r: 0.09, angle: 0 }));
    expect(c.max.y).toBeGreaterThan(0.09);
    expect(c.min.y).toBeLessThan(0.09);
    const { drum, plate } = drumGeometry({ r: 0.085 });
    expect(box(drum).max.y).toBeLessThan(0.085 * 1.1);
    expect(plate.attributes.position.count).toBeGreaterThan(0);
  });
});
