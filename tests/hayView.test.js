import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { tuftSpots } from '../src/world/hayView.js';
import { createRandom } from '../src/core/random.js';

const scales = (rect) => tuftSpots(rect, () => 0, createRandom(7)).map((m) => new THREE.Vector3().setFromMatrixScale(m));

describe('the long grass on a big meadow', () => {
  it('stands wider but no taller than on a small one', () => {
    const small = scales({ minX: 0, maxX: 30, minZ: 0, maxZ: 30 });
    const big = scales({ minX: 0, maxX: 250, minZ: 0, maxZ: 250 }); // over the tuft cap, so thinned
    const tallest = (list) => Math.max(...list.map((v) => v.y));
    const widest = (list) => Math.max(...list.map((v) => v.x));
    expect(widest(big)).toBeGreaterThan(widest(small) * 1.5);
    expect(tallest(big)).toBeLessThanOrEqual(1.3 * 1.25 + 1e-6); // the base size and the stretch alone, not grown with the width
    expect(tallest(big)).toBeLessThan(tallest(small) * 1.1);
  });
});
