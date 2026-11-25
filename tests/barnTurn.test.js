import { describe, it, expect } from 'vitest';
import { RAW_LAYOUT } from '../src/world/layout.js';
import { resolveWithBarnLocal, BARN_KEYS } from '../src/world/layoutBarn.js';
import { barnFrame, barnShape, insideBarn, underRoof, indoorLevel, wallBoxes, floorBlend, detourBoxes, outsideDoor, inBarnWalls, inDoorway } from '../src/world/barn.js';
import { detourVia } from '../src/npc/detour.js';
import { workSpot } from '../src/npc/girlBench.js';
import { placeInBarn } from '../src/world/barn.js';

// The barn turned a quarter left on the new farm: its doors face south (+z) and its width runs east and west.
const A = RAW_LAYOUT.anchors;
const turned = (yaw) => resolveWithBarnLocal(RAW_LAYOUT, { ...A, barn: { x: 515.6, z: 329.8, yaw, turnable: true } });
const L0 = turned(0);
const L = turned(-Math.PI / 2);
const near = (a, b) => Math.abs(a - b) < 1e-4;

describe('the barn turned a quarter', () => {
  const f = barnFrame(L);

  it('turns a point of its own frame into the world the way an anchor turns an offset', () => {
    const p = f.toWorld(L.barn.x + 10, L.barn.z - 2); // out of the door, a little to the north
    expect(near(p.x, 515.6 + 2) && near(p.z, 329.8 + 10)).toBe(true);
    const back = f.toLocal(p.x, p.z);
    expect(near(back.x, L.barn.x + 10) && near(back.z, L.barn.z - 2)).toBe(true);
  });

  it('puts every one of its own things where the resolver put it', () => {
    // Each point of `barnLocal`, turned with the frame, is the point the layout resolved with the anchor turned.
    for (const k of BARN_KEYS.filter((k) => !['barn', 'shed', 'barnBaleSpots', 'axleStands'].includes(k))) {
      const local = L.barnLocal[k];
      if (!local) continue; // (the clock is only on the new barn's wall)
      const world = L[k];
      const p = f.toWorld(local.x, local.z);
      expect(near(p.x, world.x) && near(p.z, world.z), k).toBe(true);
      if (local.yaw !== undefined) expect(near(f.yawToWorld(local.yaw), world.yaw), `${k} yaw`).toBe(true);
    }
    for (const [i, [x, z]] of L.barnLocal.barnBaleSpots.entries()) {
      const p = f.toWorld(x, z);
      expect(near(p.x, L.barnBaleSpots[i][0]) && near(p.z, L.barnBaleSpots[i][1]), `bale ${i}`).toBe(true);
    }
  });

  it('keeps the barn\'s own sizes: the walls swap round, the doors open south', () => {
    const boxes = wallBoxes(L);
    const hits = (x, z) => boxes.some((w) => Math.abs(x - w.x) < w.hx && Math.abs(z - w.z) < w.hz);
    const south = L.barn.z + L.barn.halfX; // the doors' wall
    for (let x = L.barn.x - L.barn.door.halfWidth + 0.1; x < L.barn.x + L.barn.door.halfWidth; x += 0.25) expect(hits(x, south - 0.1), `doorway at x ${x}`).toBe(false);
    expect(hits(L.barn.x + L.barn.door.halfWidth + 0.3, south - 0.1)).toBe(true);
    expect(hits(L.barn.x, L.barn.z)).toBe(false); // the inside is open
    expect(hits(L.barn.x, L.barn.z - L.barn.halfX + 0.1)).toBe(true); // the back wall, north
  });

  it('keeps the pit\'s sizes its own: the shed kit\'s pit is turned by its yaw, not by swapping its half-sizes', () => {
    expect(L.shed.pit.halfX).toBe(L0.shed.pit.halfX);
    expect(L.shed.pit.halfZ).toBe(L0.shed.pit.halfZ);
    expect(near(L.shed.pit.yaw, -Math.PI / 2)).toBe(true);
  });

  it('is inside, under the roof and indoors where the turned walls are, and not where they were', () => {
    expect(insideBarn(L, L.barn.x, L.barn.z)).toBe(true);
    expect(insideBarn(L, L.barn.x - L.barn.halfZ + 1, L.barn.z)).toBe(true); // its width runs east and west
    expect(insideBarn(L, L.barn.x - L.barn.halfZ - 1, L.barn.z)).toBe(false);
    expect(insideBarn(L, L.barn.x + L.barn.halfZ + 1, L.barn.z)).toBe(false);
    expect(insideBarn(L, L.barn.x, L.barn.z + L.barn.halfX + 1)).toBe(false); // out in the yard
    expect(underRoof(L, L.barn.x, L.barn.z + L.barn.halfX + 0.2)).toBe(true);
    expect(indoorLevel(L, L.barn.x, L.barn.z + L.barn.halfX + 2)).toBe(0);
    expect(indoorLevel(L, L.barn.x, L.barn.z)).toBe(1);
    expect(floorBlend(L, L.barn.x, L.barn.z)).toBe(1);
    expect(floorBlend(L, L.barn.x, L.barn.z + L.barn.halfX + 30)).toBe(0);
  });

  it('answers as the unturned barn does for the same place in its own frame', () => {
    for (const [dx, dz] of [[0, 0], [3, 2], [-4, 6], [9, 0], [0, 14]]) {
      const own = { x: L0.barn.x + dx, z: L0.barn.z + dz };
      const w = f.toWorld(own.x, own.z);
      expect(insideBarn(L, w.x, w.z)).toBe(insideBarn(L0, own.x, own.z));
      expect(indoorLevel(L, w.x, w.z)).toBeCloseTo(indoorLevel(L0, own.x, own.z), 6);
    }
  });

  it('has bale seats, the bench\'s bay and the bench inside the barn', () => {
    for (const [x, z] of L.barnBaleSpots) expect(insideBarn(L, x, z), `bale at ${x}, ${z}`).toBe(true);
    expect(insideBarn(L, L.bay.x, L.bay.z)).toBe(true);
    expect(insideBarn(L, L.bench.x, L.bench.z)).toBe(true);
    // (The big bay and the helmet hooks are placed by barnPlan.js on the farm, and checked inside the barn by tests/farmstead.test.js.)
  });

  it('is walked round, and in at the doorway that faces south', () => {
    const boxes = detourBoxes(L);
    expect(boxes.length).toBe(1);
    expect(boxes[0].door.out).toEqual({ x: 0, z: 1 });
    const inYard = { x: L.barn.x, z: L.barn.z + L.barn.halfX + 8 };
    const inside = { x: L.barn.x, z: L.barn.z };
    expect(detourVia(inYard, inside, boxes)).toBeNull(); // square on to the doorway: straight in
    const aside = { x: L.barn.x + 8, z: L.barn.z + L.barn.halfX + 2 };
    const via = detourVia(aside, inside, boxes);
    expect(via).not.toBeNull();
    expect(via.z).toBeGreaterThan(L.barn.z + L.barn.halfX); // lines up on the doorway, out in the yard
    // from the north side (the back wall) she goes round, not through
    const behind = { x: L.barn.x, z: L.barn.z - L.barn.halfX - 4 };
    const round = detourVia(behind, inYard, boxes);
    expect(round).not.toBeNull(); // the barn is in the way: she heads for a corner, which is outside every box
    for (const b of boxes) expect(round.x > b.minX && round.x < b.maxX && round.z > b.minZ && round.z < b.maxZ).toBe(false);
  });

  it('is what the cat and dog and the girls call the door: out of it is south', () => {
    const out = outsideDoor(L, 3);
    expect(near(out.x, L.barn.x) && near(out.z, L.barn.z + L.barn.halfX + 3)).toBe(true);
    expect(near(out.facing, Math.PI / 2 - Math.PI / 2)).toBe(true); // heading 0 is south (+z)
    expect(inBarnWalls(L, L.barn.x, L.barn.z)).toBe(true);
    expect(inBarnWalls(L, L.barn.x, L.barn.z + L.barn.halfX + 1)).toBe(false);
    expect(inDoorway(L, out.x, L.barn.z + L.barn.halfX + 0.2)).toBe(true);
  });

  it('is unchanged at yaw 0: the shape is the barn\'s own', () => {
    expect(barnShape(L0).outer.maxX).toBeCloseTo(L0.barn.x + L0.barn.halfX, 6);
    expect(barnFrame(L0).turned).toBe(false);
    expect(wallBoxes(L0).length).toBe(5);
  });

  it('stands a girl at the bay and hangs a wall fixture as the unturned barn does, turned with the barn', () => {
    // workSpot: beside the quad in the bay, towards the bench end: the same place relative to the bay, and facing the quad.
    const w0 = workSpot(L0.bay);
    const w = workSpot(L.bay);
    const want = f.toWorld(w0.x, w0.z);
    expect(near(w.x, want.x) && near(w.z, want.z)).toBe(true);
    expect(Math.hypot(w.x - L.bay.x, w.z - L.bay.z)).toBeCloseTo(Math.hypot(w0.x - L0.bay.x, w0.z - L0.bay.z), 6);
    // the doors look out of the barn's +x wall: south here
    const out = f.headingToWorld(Math.PI / 2);
    expect(near(Math.sin(out), 0) && near(Math.cos(out), 1)).toBe(true);
    // placeInBarn: a wall fixture's place and facing
    const obj = { position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: { y: 0 } };
    placeInBarn(L, obj, L.barn.x + 2, 1.5, L.barn.z - 1);
    const p = f.toWorld(L.barn.x + 2, L.barn.z - 1);
    expect(near(obj.position.x, p.x) && near(obj.position.z, p.z) && obj.position.y === 1.5).toBe(true);
    expect(near(obj.rotation.y, -Math.PI / 2)).toBe(true);
  });
});
