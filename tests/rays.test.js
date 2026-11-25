import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { quickRays } from './helpers/rays.js';
import { loadDonors, buildDonor } from './helpers/rustyDamage.js';

// The quicker rays the model tests fire (tests/helpers/rays.js, #1183) must find what three's own raycast finds, or a hole test could pass
// over a hole.

describe('quick rays', () => {
  beforeAll(loadDonors);

  // Every hit of a ray through the model's meshes, as where in the model the mesh is, the face, the distance and the point.
  const hits = (meshes, order, origin, dir, far) => {
    const rc = new THREE.Raycaster(origin, dir, 0, far);
    return rc.intersectObjects(meshes, false).map((h) => `${order.get(h.object)} ${h.faceIndex} ${h.distance.toFixed(9)} ${h.point.toArray().map((v) => v.toFixed(9)).join(',')}`);
  };

  it('finds the same hits in the same order as three, on a quad of large merged meshes, near and far, from outside it and from within', () => {
    const plain = new THREE.Group().add(buildDonor('bruin', null)); // (buildDonor makes its meshes quick: undo that for the plain one)
    plain.traverse((o) => { if (o.isMesh) delete o.raycast; });
    const quick = new THREE.Group().add(quickRays(buildDonor('bruin', null)));
    for (const g of [plain, quick]) {
      g.position.set(4, 0.3, -2);
      g.rotation.set(0.05, 1.1, -0.04);
      g.updateMatrixWorld(true);
    }
    const orders = [plain, quick].map((g) => {
      const m = new Map();
      let i = 0;
      g.traverse((o) => m.set(o, i++));
      return m;
    });
    const meshes = [plain, quick].map((g) => {
      const out = [];
      g.traverse((o) => { if (o.isMesh && !o.isSprite) out.push(o); });
      return out;
    });
    let quicker = 0;
    quick.traverse((o) => { if (o.isMesh && Object.hasOwn(o, 'raycast')) quicker++; });
    expect(quicker, 'meshes made quick').toBeGreaterThan(10);
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let hit = 0;
    for (let i = 0; i < 1500; i++) {
      const inside = i % 3 === 0;
      const origin = inside ? new THREE.Vector3(4 + (r() - 0.5) * 1.2, 0.3 + r() * 1.2, -2 + (r() - 0.5) * 2) : new THREE.Vector3(4 + (r() - 0.5) * 8, r() * 3, -2 + (r() - 0.5) * 8);
      const dir = new THREE.Vector3(4 + (r() - 0.5) * 1.6, 0.3 + r() * 1.1, -2 + (r() - 0.5) * 2.2).sub(origin).normalize(); // most aimed through the quad
      if (i % 5 === 0) dir.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const far = i % 2 ? Infinity : 0.05 + r() * 2;
      const a = hits(meshes[0], orders[0], origin, dir, far);
      expect(hits(meshes[1], orders[1], origin, dir, far), `ray ${i}`).toEqual(a);
      if (a.length) hit++;
    }
    expect(hit).toBeGreaterThan(500); // most of them through something
  });
});
