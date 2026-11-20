import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { barnShape, barnFrame, barnDoors, localWallBoxes, detourBoxes } from '../src/world/barn.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';

// The barn as one building on the new farm (#818): its size and place on the plan, its one pair of doors, the lamps, and that a walking player can get in at the doors
// and not through a wall.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const L = { ...two, ...two.barnLocal };
const shape = barnShape(L);
const frame = barnFrame(two);
const HALF_HEIGHT = 0.55;
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
const GRAVITY = DEFAULT_PLAYER_PARAMS.gravity;
let built;
let world;
let ground;
const boxes = [];

beforeAll(async () => {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildBarnShed } = await import('../src/world/barnBuild.js');
  const heights = createTerrainHeight(two, new Track(two.trackPoints));
  ground = heights.heightAt(two.barn.x, two.barn.z);
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(two.barn.x, ground - 0.5, two.barn.z));
  const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) => {
    boxes.push({ x, y, z, hx, hy, hz });
    return world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
  };
  built = buildBarnShed({ scene: new THREE.Scene(), layout: two, heights: { heightAt: () => ground }, fixedBox, random: () => 0.5 });
});

describe('the barn on the new farm', () => {
  it('is one building 26 by 18 m filling the plan\'s rectangle, 498 to 524 by 319 to 337', () => {
    const a = frame.toWorld(shape.outer.minX, shape.outer.minZ);
    const b = frame.toWorld(shape.outer.maxX, shape.outer.maxZ);
    const plan = (p) => [p.x + PLAN_ORIGIN[0], p.z + PLAN_ORIGIN[1]];
    expect([plan(a), plan(b)].flat().sort((p, q) => p - q).map((v) => Math.round(v * 10) / 10)).toEqual([319, 337, 498, 524]);
    expect(shape.annex).toBeNull();
    expect(shape.wide).toBe(true);
  });
  it('has one pair of doors, in the long wall on the yard\'s side, wide enough for a tractor, and no hay door or hayloft', () => {
    const doors = barnDoors(L);
    expect(doors.length).toBe(1);
    expect(doors[0].maxZ - doors[0].minZ).toBeGreaterThanOrEqual(5.5);
    expect(doors[0].height).toBeGreaterThanOrEqual(3.6);
    expect(detourBoxes(two).length).toBe(1);
    expect(localWallBoxes(L).map((w) => w.id).sort()).toEqual(['eastNorth', 'eastSouth', 'north', 'south', 'west']);
    expect(two.loft).toBeUndefined();
    expect(built.loft).toBeNull();
    expect(built.hayDoor).toBeNull();
    expect(built.shutter).toBeNull();
  });
  it('hangs six bulbs from three lights, more than the two it had, so that the lit barn is as bright overall', () => {
    expect(built.bulbs.length).toBe(6);
    expect(built.lights.length).toBe(3);
    expect(built.bulbs.length).toBeGreaterThan(2);
    // game.js gives each light 2 x BARN_BULB / lights, so the sum is what two bulbs gave: a bulb's share falls as there are more of them.
    expect(built.lights.length * (2 / built.lights.length)).toBe(2);
    for (const l of built.lights) expect(l.intensity).toBe(0); // dark until the generator runs
  });
  it('has no two faces on one plane, which would flicker', () => {
    const group = built.group;
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.updateMatrixWorld(true);
    // The jack and the axle stands are models of their own (workshop/jackModel.js), looked at with theirs.
    const own = (o) => { for (let q = o; q; q = q.parent) if (q.name === 'trolley-jack' || q.name === 'axle-stand') return true; return false; };
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true, skip: own });
    expect(fights.map((f) => `${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });
});

function walk(startLocal, endLocal) {
  const start = frame.toWorld(startLocal.x, startLocal.z);
  const end = frame.toWorld(endLocal.x, endLocal.z);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, ground + 0.05 + HALF_HEIGHT + CAPSULE_RADIUS, start.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
  const ctl = world.createCharacterController(0.03);
  ctl.setUp({ x: 0, y: 1, z: 0 });
  ctl.enableAutostep(0.35, 0.2, false);
  ctl.enableSnapToGround(0.4);
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const len = Math.hypot(dx, dz);
  let vy = 0;
  let grounded = false;
  for (let i = 0; i < 900; i++) {
    vy = grounded ? -1 : vy - GRAVITY / 60;
    ctl.computeColliderMovement(collider, { x: (dx / len) * (WALK / 60), y: vy / 60, z: (dz / len) * (WALK / 60) });
    const m = ctl.computedMovement();
    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    world.step();
    grounded = ctl.computedGrounded();
  }
  const p = body.translation();
  world.removeCharacterController(ctl);
  world.removeRigidBody(body);
  return frame.toLocal(p.x, p.z);
}

describe('getting into the barn', () => {
  it('lets a walking player in at the doors from the yard, right to the back wall', () => {
    const end = walk({ x: shape.outer.maxX + 4, z: shape.z }, { x: shape.x - 6, z: shape.z });
    expect(end.x).toBeLessThan(shape.x - 5); // through the doorway and across the floor
  });
  it('stops a walking player at the wall beside the doors', () => {
    const end = walk({ x: shape.outer.maxX + 4, z: shape.z + 8 }, { x: shape.x - 6, z: shape.z + 8 });
    expect(end.x).toBeGreaterThan(shape.outer.maxX); // outside the wall, not through it
  });
});

describe('the seats and the desk in the barn', async () => {
  const { barnBaleSeats, insideBarn } = await import('../src/world/barn.js');
  const { DESK } = await import('../src/workshop/deskModel.js');
  const inside = (p, m = 0.5) => insideBarn(two, p.x, p.z, m);
  it('has the girls sit on bale seats scattered inside, not in a row, with no loft seat', () => {
    const seats = barnBaleSeats(two);
    expect(seats.length).toBeGreaterThanOrEqual(4);
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
    for (const s of seats) {
      expect(s.kind).toBe('shelter');
      expect(inside(s, 1), s.id).toBe(true);
      expect(s.seat).toBe(two.baleSeat);
    }
    expect(seats.some((s) => s.kind === 'loft' || /loft/.test(s.id))).toBe(false);
    // Scattered: no two turned the same way, and not all on one line.
    expect(new Set(seats.map((s) => s.yaw.toFixed(2))).size).toBe(seats.length);
    const zs = seats.map((s) => frame.toLocal(s.x, s.z));
    expect(Math.max(...zs.map((p) => p.x)) - Math.min(...zs.map((p) => p.x))).toBeGreaterThan(0.8);
  });
  it('keeps each bale seat 1.5 m from the bench, the desk, the bays and the covered vehicles', () => {
    const local = (o) => ({ x: o.x, z: o.z });
    const things = [local(L.bench), local(L.desk), local(L.bay), local(L.bay2), local(L.rusty), local(L.plover)];
    for (const [x, z] of L.barnBaleSpots) for (const t of things) expect(Math.hypot(x - t.x, z - t.z)).toBeGreaterThan(1.5);
  });
  it('stands the desk against the back wall facing the doors, with its stool in front of it, and inside', () => {
    expect(L.desk.x - DESK.depth / 2).toBeGreaterThan(shape.inner.minX - 0.01);
    expect(L.desk.x - DESK.depth / 2).toBeLessThan(shape.inner.minX + 0.2);
    expect(L.desk.yaw).toBe(0);
    for (const p of [L.desk, L.bench, L.bay, L.bay2, L.jack, L.rusty, L.plover]) expect(inside(frame.toWorld(p.x, p.z), 0.3)).toBe(true);
    expect(boxes.some((b) => Math.abs(b.x - L.desk.x) < 0.01 && Math.abs(b.z - L.desk.z) < 0.01 || (b.hx === DESK.depth / 2 && b.hz === DESK.length / 2))).toBe(true); // the desk has a collider
  });
});
