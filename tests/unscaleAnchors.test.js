import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { unscaleAnchors, SEAT_ANCHOR_NAMES } from '../src/vehicle/unscaleAnchors.js';

describe('unscaleAnchors', () => {
  it('leaves a girl on any seat at full size under a scaled model', () => {
    const model = new THREE.Object3D();
    model.scale.setScalar(1.15);
    const root = new THREE.Object3D();
    model.add(root);
    for (const name of SEAT_ANCHOR_NAMES) {
      const a = new THREE.Object3D();
      a.name = name;
      root.add(a);
    }
    unscaleAnchors(model, 1.15);
    model.updateMatrixWorld(true);
    for (const name of ['seatLeft', 'seatMid', 'bedSeat', 'riderAnchor']) {
      expect(model.getObjectByName(name).matrixWorld.getMaxScaleOnAxis()).toBeCloseTo(1, 6);
    }
  });
});
