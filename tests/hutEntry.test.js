import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { hutShape } from '../src/world/hut.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';

// The hut's colliders in a real Rapier world with the player's capsule and character controller set up as player.js does, and the capsule
// walked from the foot of the steps in at the door: the steps and the doorway must be something a walking player can actually climb and pass.
const HALF_HEIGHT = 0.55;
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
const GRAVITY = DEFAULT_PLAYER_PARAMS.gravity;
let world;
let ground;
const shape = hutShape(LAYOUT);

beforeAll(async () => {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildHut } = await import('../src/world/hutBuild.js');
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
  ground = heights.heightAt(shape.x, shape.z);
  world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(shape.x, ground - 0.5, shape.z));
  const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) =>
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
  buildHut({ layout: LAYOUT, scene: new THREE.Scene(), heights: { heightAt: () => ground }, fixedBox, physics: world, RAPIER, random: () => 0.5 });
});

function walkIn(startLocalX) {
  const start = shape.toWorld(startLocalX, shape.halfLength + 2.5);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, ground + 0.05 + HALF_HEIGHT + CAPSULE_RADIUS, start.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
  const ctl = world.createCharacterController(0.03);
  ctl.setUp({ x: 0, y: 1, z: 0 });
  ctl.enableAutostep(0.35, 0.2, false);
  ctl.enableSnapToGround(0.4);
  ctl.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  ctl.setMinSlopeSlideAngle((60 * Math.PI) / 180);
  const into = shape.toWorld(startLocalX, 0);
  const dirx = into.x - start.x;
  const dirz = into.z - start.z;
  const len = Math.hypot(dirx, dirz);
  let vy = 0;
  let grounded = false;
  let local = null;
  for (let i = 0; i < 600; i++) {
    vy = grounded ? -1 : vy - GRAVITY / 60; // as player.js: pressed into the ground at 1 m/s while grounded
    ctl.computeColliderMovement(collider, { x: (dirx / len) * (WALK / 60), y: vy / 60, z: (dirz / len) * (WALK / 60) });
    const m = ctl.computedMovement();
    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    world.step();
    grounded = ctl.computedGrounded();
    const p = body.translation();
    local = shape.toLocal(p.x, p.z);
    local.y = p.y - HALF_HEIGHT - CAPSULE_RADIUS - ground;
  }
  world.removeCharacterController(ctl);
  world.removeRigidBody(body);
  return local;
}

describe("the shepherd's hut: getting in", () => {
  it('lets a walking player up the steps, through the doorway and onto the floor', () => {
    const end = walkIn(0);
    expect(end.z).toBeLessThan(shape.halfLength - 0.3); // inside the walls
    expect(end.y).toBeGreaterThan(shape.floor - 0.1); // on the floor, not at the foot of the steps
  });
});
