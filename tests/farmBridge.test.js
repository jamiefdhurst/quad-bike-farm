import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { FARM_BRIDGE_SIZE } from '../src/world/farmBridge.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';

// The farm bridge (#689) on the new farm's river: its model and its colliders, walked over in a real Rapier world with the player's capsule.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const spec = two.farmBridge;
const HALF_HEIGHT = 0.55;
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
const GRAVITY = DEFAULT_PLAYER_PARAMS.gravity;
const GROUND = 1;
let group;
let world;
let z0;

const heights = () => {
  const real = createTerrainHeight(two, new Track(two.trackPoints));
  return { ...real, heightAt: () => GROUND, brook: { zAt: () => spec.z } };
};

beforeAll(async () => {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildFarmBridge } = await import('../src/world/farmBridge.js');
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(spec.x, GROUND - 0.5, spec.z));
  const fixedBox = (x, y, z, hx, hy, hz) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  z0 = spec.z;
  group = buildFarmBridge({ layout: two, scene: new THREE.Scene(), heights: heights(), fixedBox, random });
});

/** Walks the capsule from (x, z) towards (tx, tz) for a while and says where it ends up. */
function walk(from, to, steps = 500) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(from.x, GROUND + 0.05 + HALF_HEIGHT + CAPSULE_RADIUS, from.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
  const ctl = world.createCharacterController(0.03);
  ctl.setUp({ x: 0, y: 1, z: 0 });
  ctl.enableAutostep(0.35, 0.2, false);
  ctl.enableSnapToGround(0.4);
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  let vy = 0;
  let grounded = false;
  for (let i = 0; i < steps; i++) {
    vy = grounded ? -1 : vy - GRAVITY / 60;
    ctl.computeColliderMovement(collider, { x: ((to.x - from.x) / len) * (WALK / 60), y: vy / 60, z: ((to.z - from.z) / len) * (WALK / 60) });
    const m = ctl.computedMovement();
    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    world.step();
    grounded = ctl.computedGrounded();
  }
  const end = body.translation();
  world.removeCharacterController(ctl);
  world.removeRigidBody(body);
  return end;
}

describe('the farm bridge', () => {
  it('stands over the river\'s head at plan (424, 572), a sleeper deck about 3.6 by 7 m', () => {
    expect(group.name).toBe('farmBridge');
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    expect(size.z).toBeGreaterThan(FARM_BRIDGE_SIZE.length);
    expect(size.x).toBeGreaterThan(FARM_BRIDGE_SIZE.width);
    expect(box.min.x).toBeLessThan(spec.x);
    expect(box.max.x).toBeGreaterThan(spec.x);
    expect(size.y).toBeGreaterThan(1.1); // the rails stand a metre over the deck
  });
  it('is held to a mesh a material, not hundreds of parts', () => {
    const meshes = [];
    group.traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes.length).toBeLessThanOrEqual(14);
  });
  it('has no two faces on one plane', () => {
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });
  it('lets a walking player on at one end and over to the other, and keeps them off the side', () => {
    const half = FARM_BRIDGE_SIZE.length / 2;
    const end = walk({ x: spec.x, z: z0 - half - 3 }, { x: spec.x, z: z0 + half + 3 }, 400);
    expect(end.z).toBeGreaterThan(z0 + half); // across it, not stopped by the end or the rails
    const side = walk({ x: spec.x, z: z0 }, { x: spec.x + 5, z: z0 }, 300);
    expect(side.x).toBeLessThan(spec.x + FARM_BRIDGE_SIZE.width / 2); // stopped at the rail
    expect(side.x).toBeGreaterThan(spec.x + 1);
  });
});
