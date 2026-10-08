import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cutOutLeaves } from '../src/world/assets.js';

describe('leaf materials', () => {
  it('turns a blended, textured leaf material into a depth-writing cut-out', () => {
    const m = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), transparent: true, depthWrite: false });
    expect(cutOutLeaves(m)).toBe(true);
    expect(m.transparent).toBe(false);
    expect(m.depthWrite).toBe(true);
    expect(m.alphaTest).toBe(0.5);
    expect(m.alphaToCoverage).toBe(true);
  });

  it('leaves opaque materials, and untextured see-through ones, alone', () => {
    const bark = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    expect(cutOutLeaves(bark)).toBe(false);
    expect(bark.alphaTest).toBe(0);
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4 });
    expect(cutOutLeaves(glass)).toBe(false);
    expect(glass.transparent).toBe(true);
  });
});
