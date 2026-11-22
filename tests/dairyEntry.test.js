import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { neighbourFarmShape } from '../src/world/neighbourFarm.js';
import { createRandom } from '../src/core/random.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';

// The dairy's colliders in a real Rapier world with the player's capsule and character controller set up as player.js does (the pattern of hutEntry.test.js):
// the capsule is walked in at the bulk tank room's door and the collecting yard's gap in its rails, and at the walls and rails where it must be stopped.
const HALF_HEIGHT = 0.55;
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
const GRAVITY = DEFAULT_PLAYER_PARAMS.gravity;
const S = neighbourFarmShape(LAYOUT);
const GROUND = 3;
let world;

beforeAll(async () => {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const dairy = await import('../src/world/dairyKit.js');
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(S.yard.minX + 50, GROUND - 0.5, S.yard.minZ + 50));
  const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) =>
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
  const dm = dairy.dairyMaterials(createRandom(2), new THREE.MeshStandardMaterial());
  const deps = { fixedBox };
  dairy.buildParlour(S.parlour, GROUND, dm, deps);
  dairy.buildCollectingYard(S.collecting, S.parlour, GROUND, dm, deps);
  dairy.buildTankRoom(S.tankRoom, S.parlour, GROUND, dm, deps);
  dairy.buildSlurryStore(S.slurry, GROUND, dm, deps);
});

/** Walks a capsule from (sx, sz) towards (tx, tz) for ten seconds and says where it ends and how high it stands. */
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
  return { x: p.x, z: p.z, y: p.y - HALF_HEIGHT - CAPSULE_RADIUS - GROUND };
}

describe('the dairy: getting in and being stopped', () => {
  const r = S.tankRoom;
  const southOuter = r.z + r.halfZ;

  it('lets a walking player in at the tank room\'s door, over its step and onto the floor, as far as the tank', () => {
    const end = walk(r.x, southOuter + 3, r.x, r.z - 1);
    expect(end.z).toBeLessThan(southOuter - 0.4); // through the doorway, inside the walls
    expect(end.z).toBeGreaterThan(r.z - r.halfZ + 0.25); // not through the back wall
    expect(end.y).toBeGreaterThan(0.03); // up on the floor (4 cm), not at the foot of the step
    expect(end.y).toBeLessThan(0.08);
    expect(Math.abs(end.x - r.x)).toBeLessThan(0.3); // straight through the middle of the doorway
  });

  it('stops you at the tank, with the aisle in front of it to stand in', () => {
    const end = walk(r.x - 0.4, southOuter + 3, r.x - 0.4, r.z - r.halfZ);
    expect(end.z).toBeGreaterThan(r.z - 0.45 + 0.78); // not inside the tank's side, 0.78 m out from its middle
    expect(end.z).toBeLessThan(southOuter - 0.4); // but in the room
  });

  it('stops you at the tank room\'s walls and the parlour\'s, which have no way in', () => {
    expect(walk(r.x + r.halfX + 3, r.z, r.x, r.z).x).toBeGreaterThan(r.x + r.halfX); // the east wall
    const p = S.parlour;
    expect(walk(p.x - 4.5, p.z + p.halfZ + 3, p.x - 4.5, p.z).z).toBeGreaterThan(p.z + p.halfZ - 0.1); // the south wall, between the two cow gates
    expect(walk(p.x + 5, p.z - p.halfZ - 3, p.x + 5, p.z).z).toBeLessThan(p.z - p.halfZ + 0.1); // the north wall
  });

  it('lets the herd\'s way in: you walk in through the collecting yard\'s west gap, and the rails stop you on the east, south and the west beside the gap', () => {
    const c = S.collecting;
    const inside = walk(c.minX - 4, c.gap.z, c.maxX - 4, c.gap.z);
    expect(inside.x).toBeGreaterThan(c.minX + 3); // well in
    expect(walk(c.minX + 8, c.maxZ - 4, c.minX + 8, c.maxZ + 3).z).toBeLessThan(c.maxZ); // the south rails
    expect(walk(c.maxX - 4, c.gap.z, c.maxX + 3, c.gap.z).x).toBeLessThan(c.maxX); // the east rails
    expect(walk(c.minX - 3, c.gap.z + c.gap.width / 2 + 2.5, c.minX + 5, c.gap.z + c.gap.width / 2 + 2.5).x).toBeLessThan(c.minX + 0.2); // the west rails beside the gap
  });

  it('stops you at the slurry store\'s ring wall all the way round', () => {
    const s = S.slurry;
    for (const a of [0, 1.1, 2.4, 3.6, 5]) {
      const end = walk(s.x + Math.cos(a) * (s.r + 4), s.z + Math.sin(a) * (s.r + 4), s.x, s.z);
      expect(Math.hypot(end.x - s.x, end.z - s.z), `from ${a}`).toBeGreaterThan(s.r);
    }
  });
});
