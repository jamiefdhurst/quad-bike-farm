import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { dealtLayout } from '../src/world/quarry.js';
import { plantSite, plantPoint, PLANT } from '../src/world/plantSite.js';

const random = () => 0.5;
// A heap as the pit draws it: a cone of height h and radius r whose top is at `headX` along the conveyor, on a flat floor a little under the pad.
const coneGround = (headX, h, r) => (x, z) => {
  const k = 1 - Math.hypot(x - headX, z) / r;
  return -0.06 + (k > 0 ? h * k ** 1.25 : 0);
};
const build = async (h = 5, r = 8, slope = 19, side = -1) => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildScreeningPlant, plantMaterials } = await import('../src/world/screeningPlantModel.js');
  const headY = h - 0.06 + PLANT.headLift;
  const headX = PLANT.tailX + (headY - PLANT.tailY) / Math.tan((slope * Math.PI) / 180);
  return { headX, headY, h, r, ...buildScreeningPlant(plantMaterials(random), { headX, headY, ground: coneGround(headX, h, r), side }) };
};

describe('the screening plant model', () => {
  it('has no two faces on one plane, which flicker as alpha fighting', async () => {
    for (const [h, r, side] of [[3.8, 7, -1], [5, 8, 1], [6.2, 10, -1]]) {
      const { group } = await build(h, r, 19, side);
      const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true }).map((f) => `${f.a}/${f.b} ${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`);
      expect(fights, `heap ${h}, generator on side ${side}`).toEqual([]);
    }
  });

  it('is a handful of draw calls', async () => {
    const { group } = await build();
    expect(group.children.length).toBeLessThanOrEqual(12);
  });

  it('ends its second conveyor over the top of the heap, clear of it, and climbs gently', async () => {
    const { parts, headX, headY, h } = await build();
    expect(parts.head2).toEqual([headX, headY]);
    expect(headY - (h - 0.06)).toBeGreaterThan(0.5); // above the heap's top, not in it
    expect(headY - (h - 0.06)).toBeLessThan(1.3);
    const climb = (Math.atan2(headY - parts.tail2[1], headX - parts.tail2[0]) * 180) / Math.PI;
    expect(climb).toBeGreaterThan(10);
    expect(climb).toBeLessThan(26);
  });

  it('stands every trestle on the ground where it is, and keeps the belt clear of the heap along its length', async () => {
    const { parts, headX, headY, boxes, h, r } = await build(6.2, 10);
    const ground = coneGround(headX, h, r);
    expect(parts.legs2.length).toBeGreaterThan(1);
    const last = parts.legs2[parts.legs2.length - 1];
    expect(headX - last).toBeGreaterThan(3); // the head overhangs the last trestle, which does not stand in the heap's top
    const slope = (headY - parts.tail2[1]) / (headX - parts.tail2[0]);
    for (let x = parts.tail2[0]; x <= headX; x += 0.5) {
      const belt = parts.tail2[1] + slope * (x - parts.tail2[0]);
      expect(belt - 0.55, `at ${x}`).toBeGreaterThan(Math.max(ground(x, 0), 0) - 0.05); // the belt's underside is over the ground
    }
    for (const x of parts.legs2) {
      const leg = boxes.find((b) => Math.abs(b[0] - x) < 1e-6 && b[2] < 0);
      expect(leg[1] - leg[4], `trestle ${x} foot`).toBeLessThan(ground(x, -0.95) + 0.05);
      expect(leg[1] - leg[4], `trestle ${x} foot`).toBeGreaterThan(ground(x, -0.95) - 0.2);
    }
  });

  it('has its colliders inside the model, and the pad under all of it', async () => {
    const { group, boxes } = await build();
    const bounds = new THREE.Box3().setFromObject(group);
    for (const [x, y, z, hx, hy, hz] of boxes) {
      expect(x - hx).toBeGreaterThanOrEqual(bounds.min.x - 0.01);
      expect(x + hx).toBeLessThanOrEqual(bounds.max.x + 0.01);
      expect(y + hy).toBeLessThanOrEqual(bounds.max.y + 0.01);
      expect(Math.abs(z) + hz).toBeLessThanOrEqual(Math.max(bounds.max.z, -bounds.min.z) + 0.01);
    }
    const pad = boxes[0];
    expect(pad[1] + pad[4]).toBeCloseTo(0, 5); // its top is the plant's floor
    expect(pad[0] - pad[3]).toBeCloseTo(PLANT.padX0, 5);
  });
});

describe('where the plant stands', () => {
  const make = (seed) => {
    const layout = dealtLayout(LAYOUT, seed);
    const heights = createTerrainHeight(layout, new Track(layout.trackPoints));
    return { quarry: heights.quarry, heights };
  };

  it('is dealt with every pit: flat floor off the water and the roads, with the conveyor ending over its heap and no other heap in the way', () => {
    let digs = 0;
    let plants = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { quarry, heights } = make(seed * 7919);
      const ground = (x, z) => heights.heightAt(x, z);
      const site = plantSite(quarry, ground);
      if (!site) continue; // a pit with no floor to spare has no plant
      plants++;
      const at = (lx, lz) => plantPoint(site, lx, lz);
      const head = at(site.headX, 0);
      expect(Math.hypot(head.x - site.heap.x, head.z - site.heap.z), `seed ${seed} head over the heap`).toBeLessThan(0.01);
      expect(site.heap, `seed ${seed}`).toBe(quarry.pit.heaps[0]);
      expect(site.headY - (ground(site.heap.x, site.heap.z) - site.padTop), `seed ${seed} head clear of the heap`).toBeCloseTo(PLANT.headLift, 5);
      for (const u of [0, 0.5, 1]) for (const v of [-1, 0, 1]) {
        const p = at(PLANT.padX0 + u * (PLANT.padX1 - PLANT.padX0), v * PLANT.padHz);
        expect(quarry.waterAt(p.x, p.z), `seed ${seed} water`).toBe(0);
        expect(quarry.roadNear(p.x, p.z).d, `seed ${seed} road`).toBeGreaterThan(quarry.roadHalf + 2);
        expect(quarry.heapRise(p.x, p.z), `seed ${seed} heap on the pad`).toBeLessThan(0.05);
        expect(site.padTop - ground(p.x, p.z), `seed ${seed} pad over the ground`).toBeGreaterThan(0);
        expect(site.padTop - ground(p.x, p.z), `seed ${seed} pad too proud`).toBeLessThan(0.2);
      }
      for (let lx = PLANT.padX1; lx < site.headX; lx += 2) {
        const p = at(lx, 0);
        expect(quarry.roadNear(p.x, p.z).d, `seed ${seed} conveyor over the road at ${lx}`).toBeGreaterThan(quarry.roadHalf + 1);
        expect(quarry.waterAt(p.x, p.z), `seed ${seed} conveyor over water`).toBe(0);
      }
      expect(site.slope, `seed ${seed} climb`).toBeGreaterThan(12);
      expect(site.slope, `seed ${seed} climb`).toBeLessThan(33);
      if (site.dig) digs++;
    }
    expect(plants).toBeGreaterThan(50); // nearly every pit has one
    expect(digs).toBeGreaterThan(40); // the excavator has room by the hopper on most farms, and keeps its old spot on the rest
  });
});

describe('walking on the plant', () => {
  // The plant's colliders in a Rapier world with the player's capsule and controller set up as player.js does, the ground 6 cm under the pad's top.
  const HALF_HEIGHT = 0.55;
  const walk = async (from, to, seconds = 10) => {
    await RAPIER.init();
    const { boxes } = await build();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(0, -0.56, 0));
    for (const [x, y, z, hx, hy, hz] of boxes) world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(from[0], -0.01 + HALF_HEIGHT + CAPSULE_RADIUS, from[1]));
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
    const ctl = world.createCharacterController(0.03);
    ctl.setUp({ x: 0, y: 1, z: 0 });
    ctl.enableAutostep(0.35, 0.2, false);
    ctl.enableSnapToGround(0.4);
    const speed = DEFAULT_PLAYER_PARAMS.walkSpeed;
    let grounded = false;
    let vy = 0;
    for (let i = 0; i < seconds * 60; i++) {
      const at = body.translation();
      if (Math.hypot(to[0] - at.x, to[1] - at.z) < 0.05) break; // there
      vy = grounded ? -1 : vy - DEFAULT_PLAYER_PARAMS.gravity / 60;
      const dx = to[0] - at.x;
      const dz = to[1] - at.z;
      const step = Math.min(speed / 60, Math.hypot(dx, dz));
      ctl.computeColliderMovement(collider, { x: (dx / Math.hypot(dx, dz)) * step, y: vy / 60, z: (dz / Math.hypot(dx, dz)) * step });
      const m = ctl.computedMovement();
      const t = body.translation();
      body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
      world.step();
      grounded = ctl.computedGrounded();
    }
    const p = body.translation();
    return { x: p.x, z: p.z, feet: p.y - HALF_HEIGHT - CAPSULE_RADIUS };
  };

  it('lets a walking player step up onto the pad over its lip', async () => {
    const end = await walk([-2.4, 8], [-2.4, 0]);
    expect(end.z).toBeLessThan(0.5); // across the edge and well onto it
    expect(end.feet).toBeGreaterThan(0.01); // standing on the pad (its top 6 cm over the ground), not at the foot of its lip
    expect(end.feet).toBeLessThan(0.1);
  });

  it('stops a walking player at the hopper, which is solid', async () => {
    const end = await walk([-3, 0], [3, 0], 6);
    expect(end.x).toBeLessThan(-1.2); // held at the hopper's back legs, not through them
  });
});
