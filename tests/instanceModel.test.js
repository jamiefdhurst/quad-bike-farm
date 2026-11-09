import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { instanceModel } from '../src/world/assets.js';

const model = () => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  return root;
};

describe('instanceModel', () => {
  it('places a model at every matrix it is given', () => {
    const at = (x, z) => new THREE.Matrix4().makeTranslation(x, 0, z);
    const group = instanceModel(model(), [at(0, 0), at(5, 5), at(500, 500)]);
    const placed = group.children.reduce((n, tile) => n + tile.count, 0);
    expect(placed).toBe(3);
  });

  it('copes with nothing to place: an empty group, and no console error for the smoke test to fail on', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const group = instanceModel(model(), []);
    expect(group.children).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
