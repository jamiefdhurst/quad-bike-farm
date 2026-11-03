import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TrafficView } from '../src/world/trafficView.js';
import { LANE_TARMAC_LIFT } from '../src/world/props.js';

const body = () => ({ object: new THREE.Object3D(), spec: { offset: -0.35, layout: {} }, wheels: [], spun: 0, lit: 0 });
const place = (view, d) => {
  const b = body();
  view.place(b, { yaw: 0, speed: 0, ...d }, 0, 0.016);
  return b.object.position.y;
};

describe('vehicles on the lane', () => {
  it('stand on the tarmac, not sunk into the ground under it', () => {
    const lane = { x: 206.4, halfWidth: 2.3 };
    const view = new TrafficView(new THREE.Scene(), () => 10, null, null, (x) => (Math.abs(x - lane.x) < lane.halfWidth ? LANE_TARMAC_LIFT : 0));
    expect(place(view, { x: lane.x, z: 0 }) - place(view, { x: lane.x - 20, z: 0 })).toBeCloseTo(LANE_TARMAC_LIFT, 6);
  });

  it('stand on the ground when nothing is laid on it', () => {
    const view = new TrafficView(new THREE.Scene(), () => 10, null);
    expect(place(view, { x: 5, z: 0 })).toBeCloseTo(10.35, 6);
  });
});
