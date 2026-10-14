import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { measureModel, proportionErrors } from '../src/vehicle/detail/realSizes.js';

describe('measuring a model against its real size', () => {
  // A box body 2 m long, 1 m wide, from 0.3 to 1.2 m up, on four wheels 0.6 m across at a 1.4 m wheelbase and 1 m track.
  const model = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 2).translate(0, 0.75, 0), new THREE.MeshStandardMaterial());
  model.add(body);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 9), new THREE.MeshBasicMaterial()); // a headlight beam: not counted
  model.add(beam);
  for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const w = new THREE.Group();
    w.name = name;
    const spin = new THREE.Group();
    spin.name = 'spin';
    spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial()));
    w.add(spin);
    model.add(w);
  }
  const layout = { wheels: [{ x: 0.5, z: 0.7 }, { x: -0.5, z: 0.7 }, { x: 0.5, z: -0.7 }, { x: -0.5, z: -0.7 }] };

  it('measures the body, the wheels where the layout puts them, and the tyres', () => {
    const m = measureModel(model, layout);
    expect(m.length).toBeCloseTo(2);
    expect(m.width).toBeCloseTo(1.2); // the tyres stand out past the body
    expect(m.height).toBeCloseTo(1.2);
    expect(m.wheelbase).toBeCloseTo(1.4);
    expect(m.track).toBeCloseTo(1);
    expect(m.tyre).toBeCloseTo(0.6);
  });

  it('compares shape, not size: the same vehicle at twice the size is in proportion', () => {
    const real = { length: 4000, width: 2400, height: 2400, wheelbase: 2800, track: 2000, tyre: 1200 };
    for (const e of Object.values(proportionErrors(measureModel(model, layout), real))) expect(Math.abs(e)).toBeLessThan(1e-6);
    const long = proportionErrors(measureModel(model, layout), { ...real, length: 3000 });
    expect(long.length).toBeCloseTo(4000 / 3000 - 1);
  });
});
