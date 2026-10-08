import { describe, it, expect } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';

// A kinematic capsule moved by hand onto a dynamic body, as a girl walking into a quad does.
async function shoved(solverGroups) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const quad = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 1), quad);
  const girl = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(3, 0, 0));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.25), girl);
  if (solverGroups !== undefined) collider.setSolverGroups(solverGroups);
  for (let i = 0; i < 60; i++) {
    girl.setNextKinematicTranslation({ x: 3 - i * 0.05, y: 0, z: 0 });
    world.step();
  }
  return Math.abs(quad.translation().x);
}

describe('companion collider', () => {
  it('shoves a quad by default', async () => {
    expect(await shoved()).toBeGreaterThan(0.1);
  });
  it('leaves the quad where it is with no contact forces', async () => {
    expect(await shoved(0xffff0000)).toBeLessThan(0.01);
  });
});
