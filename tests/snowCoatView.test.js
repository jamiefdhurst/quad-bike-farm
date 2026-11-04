import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { coatTree, WorldSnow } from '../src/world/snowCoatView.js';
import { snowUniforms } from '../src/world/snowCoat.js';

const mesh = (y, material = new THREE.MeshStandardMaterial(), size = 2) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
  m.position.set(0, y, 0);
  return m;
};

describe('coatTree', () => {
  it('coats a roof but not a floor indoors, glass, a lamp, the girls or a subtree that owns its snow', () => {
    const root = new THREE.Group();
    const roof = mesh(6);
    const floor = mesh(0.5, new THREE.MeshStandardMaterial(), 0.5);
    const glass = mesh(6, new THREE.MeshStandardMaterial({ transparent: true }));
    const lamp = mesh(6, new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 2 }));
    const girl = new THREE.SkinnedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    const owned = new THREE.Group();
    const car = mesh(6);
    owned.add(car);
    owned.userData.snowOwn = true;
    root.add(roof, floor, glass, lamp, girl, owned);
    const covered = (x, z) => Math.abs(x) < 5 && Math.abs(z) < 5; // everything here is under a roof
    // The roof is 8 m up, the floor low; indoors is only for what is low.
    expect(coatTree(root, snowUniforms(), { covered })).toBe(1);
    expect(roof.material.userData.snowCoat).toBe(true);
    expect(floor.material.userData.snowCoat).toBeUndefined();
    expect(car.material.userData.snowCoat).toBeUndefined();
  });
  it('coats a low mesh in the open', () => {
    const root = new THREE.Group();
    const post = mesh(0.5);
    root.add(post);
    expect(coatTree(root, snowUniforms(), { covered: () => false })).toBe(1);
  });
});

describe('WorldSnow', () => {
  it('feeds the uniforms from the cover', () => {
    const w = new WorldSnow();
    w.update(1, 0.5);
    expect(w.uniforms.uSnowTops.value).toBeGreaterThan(0.5);
    expect(w.uniforms.uSnowWet.value).toBe(0);
  });
});
