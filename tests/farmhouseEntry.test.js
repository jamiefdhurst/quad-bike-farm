import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { neighbourFarmShape } from '../src/world/neighbourFarm.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';

// Her farmhouse's colliders (#910) in a real Rapier world with the player's capsule and character controller set up as player.js does: walked in from the yard through the
// garden's gate to the front door's step, and round the back to the scullery door's step. A capsule does not autostep a tall riser, so the steps must be low enough to climb.
const HALF_HEIGHT = 0.55;
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
const GRAVITY = DEFAULT_PLAYER_PARAMS.gravity;
const S = neighbourFarmShape(LAYOUT);
const H = S.house;
const GROUND = 0;
let world;

beforeAll(async () => {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildFarmhouse } = await import('../src/world/neighbourFarmProps.js');
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(H.x, GROUND - 0.5, H.z));
  const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) =>
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
  buildFarmhouse(S, GROUND, { fixedBox, random: () => 0.5 });
  world.step();
});

/** The capsule from (sx, sz) walked towards (tx, tz) for ten seconds: where it ends and how high its feet are. */
function walk(sx, sz, tx, tz) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sx, GROUND + 0.05 + HALF_HEIGHT + CAPSULE_RADIUS, sz));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
  const ctl = world.createCharacterController(0.03);
  ctl.setUp({ x: 0, y: 1, z: 0 });
  ctl.enableAutostep(0.35, 0.2, false);
  ctl.enableSnapToGround(0.4);
  ctl.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  ctl.setMinSlopeSlideAngle((60 * Math.PI) / 180);
  const len = Math.hypot(tx - sx, tz - sz);
  let vy = 0;
  let grounded = false;
  for (let i = 0; i < 600; i++) {
    vy = grounded ? -1 : vy - GRAVITY / 60;
    ctl.computeColliderMovement(collider, { x: ((tx - sx) / len) * (WALK / 60), y: vy / 60, z: ((tz - sz) / len) * (WALK / 60) });
    const m = ctl.computedMovement();
    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    world.step();
    grounded = ctl.computedGrounded();
  }
  const p = body.translation();
  world.removeCharacterController(ctl);
  world.removeRigidBody(body);
  return { x: p.x, z: p.z, feet: p.y - HALF_HEIGHT - CAPSULE_RADIUS - GROUND };
}

describe('her farmhouse: getting to the doors', () => {
  it('lets a walking player in through the garden gate and up the front step', () => {
    const end = walk(H.door.x, H.garden.minZ - 3, H.door.x, H.door.z + 2);
    expect(end.z).toBeGreaterThan(H.door.z - 1.0); // up at the door, not held at the garden's wall or the gate
    expect(end.z).toBeLessThan(H.door.z);
    expect(end.feet).toBeGreaterThan(0.1); // on the step, not at the foot of it
  });

  it('keeps a player out of the garden anywhere but the gate', () => {
    const end = walk(H.garden.minX + 1.5, H.garden.minZ - 3, H.garden.minX + 1.5, H.door.z);
    expect(end.z).toBeLessThan(H.garden.minZ); // stopped by the wall
  });

  it('lets a walking player round the back to the scullery door and up its step', () => {
    const z = H.leanTo.outer.maxZ;
    const end = walk(H.leanTo.backDoor.x, z + 3, H.leanTo.backDoor.x, z - 2);
    expect(end.z).toBeLessThan(z + 0.5);
    expect(end.z).toBeGreaterThan(z - 0.1);
    expect(end.feet).toBeGreaterThan(0.1);
  });
});
