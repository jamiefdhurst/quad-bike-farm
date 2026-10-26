import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { part } from '../src/vehicle/part.js';

function model() {
  const root = new THREE.Group();
  const arm = new THREE.Group();
  arm.name = 'arm';
  const lever = new THREE.Object3D();
  lever.name = 'lever';
  arm.add(lever);
  root.add(arm);
  return { root, arm, lever };
}

describe('part', () => {
  it('finds a named part and gives the same one again without searching', () => {
    const { root, lever } = model();
    expect(part(root, 'lever', 0)).toBe(lever);
    let searches = 0;
    const search = root.getObjectByName.bind(root);
    root.getObjectByName = (n) => (searches++, search(n));
    expect(part(root, 'lever', 10)).toBe(lever);
    expect(searches).toBe(0);
  });

  it('looks for a part that was not there again after a second, not before', () => {
    const { root, arm } = model();
    expect(part(root, 'catch', 0)).toBeUndefined();
    const fitted = new THREE.Object3D();
    fitted.name = 'catch';
    arm.add(fitted);
    expect(part(root, 'catch', 500)).toBeUndefined();
    expect(part(root, 'catch', 1000)).toBe(fitted);
  });

  it('looks again at once when a part has come off and another with its name has been fitted', () => {
    const { root, arm, lever } = model();
    expect(part(root, 'lever', 0)).toBe(lever);
    lever.removeFromParent();
    const next = new THREE.Object3D();
    next.name = 'lever';
    arm.add(next);
    expect(part(root, 'lever', 1)).toBe(next);
  });

  it('keeps each model\'s parts to itself', () => {
    const a = model();
    const b = model();
    expect(part(a.root, 'lever', 0)).toBe(a.lever);
    expect(part(b.root, 'lever', 0)).toBe(b.lever);
  });
});
