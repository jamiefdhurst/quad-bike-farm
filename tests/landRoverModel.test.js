import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { archPanel, LANDY_LAYOUT } from '../src/vehicle/landRoverModel.js';

describe('Land Rover wheel arches', () => {
  const wheel = LANDY_LAYOUT.wheels[0];
  const centreY = wheel.radius + 0.2; // tyre radius plus the suspension's rest length: the wheel's height above the ground
  const make = (x, yBottom, yTop, z0, z1, zc) => {
    const g = new THREE.Group();
    archPanel(x, 0.04, yBottom, yTop, z0, z1, zc, new THREE.MeshBasicMaterial(), g);
    const geo = g.children[0].geometry;
    geo.computeBoundingBox();
    return geo;
  };

  it('is a panel of the size asked for, centred on x', () => {
    const b = make(0.82, 0.78, 1.28, -1.95, -0.65, -1.115).boundingBox;
    expect(b.min.x).toBeCloseTo(0.8, 5);
    expect(b.max.x).toBeCloseTo(0.84, 5);
    expect(b.min.y).toBeCloseTo(0.78, 5);
    expect(b.max.y).toBeCloseTo(1.28, 5);
    expect(b.min.z).toBeCloseTo(-1.95, 5);
    expect(b.max.z).toBeCloseTo(-0.65, 5);
  });

  it('keeps every part of the panel outside the tyre, so the wheel shows through the arch', () => {
    for (const [yBottom, z0, z1, zc] of [[0.78, -1.95, -0.65, -1.115], [0.75, 0.7, 1.6, 1.115]]) {
      const pos = make(0.82, yBottom, 1.28, z0, z1, zc).attributes.position;
      for (let i = 0; i < pos.count; i++) {
        expect(Math.hypot(pos.getZ(i) - zc, pos.getY(i) - centreY)).toBeGreaterThan(wheel.radius + 0.02);
      }
    }
  });
});
