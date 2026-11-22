import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { headlessContext } from './helpers/worldModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { roadNetwork } from '../src/world/roads.js';
import { turnRoundLines } from '../src/world/turnRound.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';

// What the Moor is built from (#713): no two faces of a model on one plane (looks.md), and the ridge wall in a real Rapier world: a walking player
// is stopped by it only after crossing the stile's turn-round line, and nothing at all gets through it along its whole length.
const two = LAYOUT;
const M = two.moor;
const HALF_HEIGHT = 0.55;
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
let moor;
let kit;

beforeAll(async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  moor = await import('../src/world/moorProps.js');
  kit = await import('../src/world/roadSigns.js');
});

describe('the Moor\'s models', () => {
  const random = () => 0.5;
  it.each([
    ['the trig pillar', () => moor.buildTrigPillar(random)],
    ['the cairn', () => moor.buildCairn(random)],
    ['a cattle grid', () => moor.buildMoorGrid({ random }, 1.6)],
    ['a bridle gate', () => moor.buildBridleGate(random)],
    ['the ladder stile', () => kit.buildLadderStile(random)],
  ])('%s has no two faces on one plane', (_, make) => {
    const group = make();
    group.updateMatrixWorld(true);
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });

  it('has a trig pillar 1.2 m high with a brass plate on top', () => {
    const g = moor.buildTrigPillar(random);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.y - box.min.y).toBeGreaterThan(1.15);
    expect(box.max.y - box.min.y).toBeLessThan(1.35);
    expect(g.children.some((c) => c.material?.metalness > 0.5 && c.position.y > 1.2)).toBe(true);
  });

  it('has a grid with steel bars over a pit between two concrete sills, and a stile over a wall 1.35 m high', () => {
    const grid = moor.buildMoorGrid({ random }, 1.6);
    expect(grid.children.some((c) => c.isInstancedMesh && c.count > 15)).toBe(true);
    const stile = kit.buildLadderStile(random, 1.35, 0.6);
    const box = new THREE.Box3().setFromObject(stile);
    expect(box.max.y).toBeGreaterThan(2.2); // posts and a handrail above the platform
    expect(box.min.x).toBeLessThan(-1.2); // a ladder out each side
    expect(box.max.x).toBeGreaterThan(1.2);
  });
});

describe('the ridge wall in a physics world', () => {
  let world;
  let ground;
  beforeAll(async () => {
    await RAPIER.init();
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    ground = heights.heightAt(M.stile.at[0], M.stile.at[1]);
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    // A level floor under the wall at the stile's height: the test is about the wall and the line, not the lie of the land.
    world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 600).setTranslation(M.stile.at[0], ground - 0.5, M.stile.at[1]));
    const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
    const c = { ...headlessContext(), layout: two, heights: { ...heights, heightAt: () => ground, moor: heights.moor }, fixedBox, physics: world, RAPIER };
    c.scene.add = () => {};
    moor.buildMoorProps(c);
    world.step(); // the colliders are in the query pipeline once the world has stepped
  });

  it('stops every ray across it, the whole length of the common, at the height of a quad\'s wheels and a rider', () => {
    let missed = 0;
    for (const y of [0.3, 0.8, 1.2]) {
      for (let z = M.bounds.minZ + 2; z < M.bounds.maxZ - 2; z += 2) {
        const wallX = M.wall.points.reduce((best, p, i, a) => {
          if (i === a.length - 1) return best;
          const q = a[i + 1];
          return z >= p[1] && z <= q[1] ? p[0] + ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]) : best;
        }, null);
        if (wallX === null) continue;
        const hit = world.castRay(new RAPIER.Ray({ x: wallX + 3, y: ground + y, z }, { x: -1, y: 0, z: 0 }), 6, true);
        if (!hit) missed++;
      }
    }
    expect(missed).toBe(0);
  });

  it('lets a walking player reach the stile\'s turn-round line before the wall stops them', () => {
    const net = roadNetwork(two);
    const line = turnRoundLines(net, two.turnRound, two.ground).find((l) => l.id === 'moor-stile');
    const start = { x: M.stile.at[0] + 6, z: M.stile.at[1] };
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, ground + 0.05 + HALF_HEIGHT + CAPSULE_RADIUS, start.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
    const ctl = world.createCharacterController(0.03);
    ctl.setUp({ x: 0, y: 1, z: 0 });
    ctl.enableAutostep(0.35, 0.2, false);
    ctl.enableSnapToGround(0.4);
    let minX = Infinity;
    for (let i = 0; i < 600; i++) {
      ctl.computeColliderMovement(collider, { x: -WALK / 60, y: -1 / 60, z: 0 });
      const m = ctl.computedMovement();
      const t = body.translation();
      body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
      world.step();
      minX = Math.min(minX, body.translation().x);
    }
    expect(minX).toBeLessThan(line.point.x - 0.05); // across the line...
    expect(minX).toBeGreaterThan(M.stile.at[0]); // ...and never through the wall
  });
});
