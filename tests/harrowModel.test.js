import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildHarrowModel, poseHarrow, HARROW_SPEC } from '../src/vehicle/harrowModel.js';
import { DEFAULT_HARROW_PARAMS } from '../src/world/harrowing.js';
import { buildAllModels } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

let model;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the lamps' and plates' textures
  model = buildHarrowModel();
});

const world = () => {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
};
const matBox = () => {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model.getObjectByName('lattice'));
};

describe('the chain harrows model', () => {
  it('keeps what the game looks it up by: the body, the wheels with their spin and the mat', () => {
    for (const n of ['body', 'wheelLeft', 'wheelRight', 'mat', 'lattice']) expect(model.getObjectByName(n), n).toBeTruthy();
    for (const n of ['wheelLeft', 'wheelRight']) expect(model.getObjectByName(n).getObjectByName('spin'), n).toBeTruthy();
  });

  it('is a mat 3 to 4 m across, as long as the spec says, with pointed tines lying just on the ground when it is down', () => {
    poseHarrow(model, { down: 1 });
    const m = matBox();
    expect(m.max.x - m.min.x).toBeGreaterThan(3);
    expect(m.max.x - m.min.x).toBeLessThan(4);
    expect(m.max.z - m.min.z).toBeGreaterThan(HARROW_SPEC.matLength - 0.4);
    expect(m.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(m.min.y).toBeLessThan(0.02);
    expect(m.max.y).toBeLessThan(0.3);
  });

  it('puts the middle of the mat where the harrowing rules drag it, behind the axle', () => {
    poseHarrow(model, { down: 1 });
    const m = matBox();
    expect((m.min.z + m.max.z) / 2).toBeCloseTo(-DEFAULT_HARROW_PARAMS.matBehind, 0);
    expect(m.max.x + m.min.x).toBeCloseTo(0, 1);
    expect(DEFAULT_HARROW_PARAMS.workWidth).toBeCloseTo(HARROW_SPEC.matWidth, 1);
  });

  it('lifts the mat clear of the ground when the tines are raised, with the carrier staying put', () => {
    poseHarrow(model, { down: 1 });
    const carrier = world();
    poseHarrow(model, { down: 0 });
    const up = matBox();
    expect(up.min.y).toBeGreaterThan(0.25);
    expect(up.max.y).toBeLessThan(2.4);
    const wheel = new THREE.Box3().setFromObject(model.getObjectByName('wheelLeft'));
    expect(wheel.min.y).toBeLessThan(0.02);
    expect(carrier.max.z).toBeGreaterThan(HARROW_SPEC.drawLength - 0.2); // the coupling stands out at the front
  });

  it('is the same pose however many times it is set, and halfway in between', () => {
    poseHarrow(model, { down: 0.5 });
    const half = matBox().min.y;
    poseHarrow(model, { down: 0.5 });
    expect(matBox().min.y).toBeCloseTo(half, 6);
    poseHarrow(model, { down: 1 });
    expect(half).toBeGreaterThan(matBox().min.y);
  });

  it('has no faces fighting over the same plane in the mat, the chains and the drag bar (the carrier is the sprayer\'s kit of trailer parts)', () => {
    poseHarrow(model, { down: 1 });
    const mat = new THREE.Group();
    mat.name = 'harrowMat';
    mat.add(model.getObjectByName('mat').clone());
    expect(coplanarOverlaps(mat, { textured: true })).toEqual([]);
  });

  it('costs few draw calls: the carrier, the hangings, the mat and a mesh a wheel', () => {
    let meshes = 0;
    model.traverse((o) => {
      if (o.isMesh) meshes++;
    });
    expect(meshes).toBeLessThanOrEqual(6);
  });

  it('stays light enough to draw: a few thousand triangles for the mat in one mesh', () => {
    let tris = 0;
    let meshes = 0;
    model.getObjectByName('lattice').traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    expect(meshes).toBe(1);
    expect(tris).toBeLessThan(8000);
  });
});
