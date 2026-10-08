import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { attachKeepingSize } from '../src/npc/attachKeepingSize.js';

describe('attachKeepingSize', () => {
  it('does not let a drifted parent quaternion compound into the child scale', () => {
    const scene = new THREE.Object3D();
    const car = new THREE.Object3D();
    scene.add(car);
    const girl = new THREE.Object3D();
    for (let i = 0; i < 5; i++) {
      car.quaternion.set(0, 0.7071 * 1.01, 0, 0.7071 * 1.01); // not normalised, as a long-running physics body can be
      car.updateMatrixWorld(true);
      car.add(girl);
      attachKeepingSize(scene, girl);
      expect(girl.scale.x).toBe(1);
      expect(girl.scale.y).toBe(1);
      expect(girl.scale.z).toBe(1);
    }
  });

  it('plain attach does bake the stretch in', () => {
    const scene = new THREE.Object3D();
    const car = new THREE.Object3D();
    scene.add(car);
    car.quaternion.set(0, 0.7071 * 1.05, 0, 0.7071 * 1.05);
    const girl = new THREE.Object3D();
    car.add(girl);
    car.updateMatrixWorld(true);
    scene.attach(girl);
    expect(girl.scale.x).not.toBeCloseTo(1, 3);
  });
});
