import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { archPanel, buildLandRoverModel, poseLandyControls, LANDY_LAYOUT, LANDY_BELTS, TUB_FLOOR } from '../src/vehicle/landRoverModel.js';
import { poseUtvBelts } from '../src/vehicle/utvModel.js';

// A canvas that accepts every drawing call and does nothing, so the model (whose dash and trim are drawn on canvases) builds in node.
function fakeCanvas() {
  const ctx = new Proxy({ canvas: null }, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
  return { width: 0, height: 0, getContext: () => ctx, style: {} };
}

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
      const pos = make(0.82, yBottom, 1.38, z0, z1, zc).attributes.position;
      for (let i = 0; i < pos.count; i++) {
        expect(Math.hypot(pos.getZ(i) - zc, pos.getY(i) - centreY)).toBeGreaterThan(wheel.radius + 0.02);
      }
    }
  });
});

describe('Land Rover model', () => {
  let model;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    model = buildLandRoverModel({});
    model.updateMatrixWorld(true);
  });

  const box = (name) => new THREE.Box3().setFromObject(model.getObjectByName(name));

  it('has the parts the rest of the game looks for', () => {
    for (const n of ['bodyRoot', 'riderAnchor', 'seatMid', 'seatLeft', 'towHitch', 'crankHole', 'cameraAnchor', 'parkBrakeLever', 'chokeKnob', 'handThrottleKnob', 'gearLever']) {
      expect(model.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has a belt for each seat, stowed or worn, that the UTV\'s pose code can switch', () => {
    for (const seat of Object.keys(LANDY_BELTS)) expect(model.getObjectByName(`belt_${seat}`).getObjectByName('worn')).toBeTruthy();
    poseUtvBelts(model, { driver: true, mid: false, left: true });
    expect(model.getObjectByName('belt_driver').getObjectByName('worn').visible).toBe(true);
    expect(model.getObjectByName('belt_mid').getObjectByName('worn').visible).toBe(false);
    expect(model.getObjectByName('belt_mid').getObjectByName('stowed').visible).toBe(true);
  });

  it('puts the tub floor above the wheels, so no tyre pokes through it', () => {
    expect(LANDY_LAYOUT.wheels[2].radius + 0.2 + 0.38).toBeLessThan(TUB_FLOOR);
  });

  it('pulls the choke and hand throttle knobs out on shafts that stay in the dash, and lifts the handbrake', () => {
    const lever = model.getObjectByName('parkBrakeLever');
    const off = lever.rotation.x;
    for (let i = 0; i < 40; i++) poseLandyControls(model, { choke: 1, hand: 1, park: true });
    expect(lever.rotation.x).toBeLessThan(off - 1);
    const knob = model.getObjectByName('chokeKnob');
    expect(knob.position.z).toBeCloseTo(0.4 - 0.1, 5);
    // Fully out, the shaft's back end is still well inside the dash (the shelf's face is at z 0.4), so it never floats free.
    knob.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(knob).max.z).toBeGreaterThan(0.4 + 0.05);
  });
});
