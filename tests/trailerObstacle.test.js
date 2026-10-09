import { describe, it, expect } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { obstacleBox, towedBy, TrailerObstacle, BALE_TRAILER_FOOTPRINT } from '../src/vehicle/trailerObstacle.js';

describe('obstacleBox', () => {
  it('sits over the bed, ahead of the axle when the trailer points along +z', () => {
    const b = obstacleBox(BALE_TRAILER_FOOTPRINT, { x: 10, z: 5, y: 2, yaw: 0 });
    expect(b.x).toBeCloseTo(10);
    expect(b.z).toBeCloseTo(5 + (1.5 - 1.7) / 2);
    expect(b.half.z).toBeCloseTo(1.6);
    expect(b.half.x).toBe(1);
  });
  it('turns with the trailer', () => {
    const b = obstacleBox({ halfWidth: 1, rearZ: 0, frontZ: 4 }, { x: 0, z: 0, y: 0, yaw: Math.PI / 2 });
    expect(b.x).toBeCloseTo(2);
    expect(b.z).toBeCloseTo(0);
  });
});

describe('towedBy', () => {
  const quad = {};
  const hitched = { obstacle: { collider: { handle: 7 } }, hitched: true, puller: quad };
  it('ignores only the trailer the quad is towing', () => {
    expect(towedBy([hitched], 7, quad)).toBe(true);
    expect(towedBy([hitched], 7, {})).toBe(false);
    expect(towedBy([{ ...hitched, hitched: false }], 7, quad)).toBe(false);
    expect(towedBy([{ ...hitched, puller: undefined, tractor: quad }], 7, quad)).toBe(true);
  });
});

describe('in Rapier', () => {
  it('is hit by a ray but does not shove a quad', async () => {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const quad = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.5, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 1), quad);
    const ob = new TrailerObstacle({ physics: world, RAPIER, footprint: { halfWidth: 1, rearZ: -1, frontZ: 1 } });
    for (let i = 0; i < 30; i++) {
      ob.sync({ x: 0, z: 0, y: 0, yaw: 0 }); // overlapping the quad
      world.step();
    }
    expect(Math.abs(quad.translation().x) + Math.abs(quad.translation().z)).toBeLessThan(0.01);
    ob.sync({ x: 10, z: 0, y: 0, yaw: 0 });
    world.step();
    const hit = world.castRay(new RAPIER.Ray({ x: 4, y: 0.55, z: 0 }, { x: 1, y: 0, z: 0 }), 20, true);
    expect(hit.timeOfImpact).toBeCloseTo(5, 1);
  });
});
