import { describe, it, expect } from 'vitest';
import { RAW_LAYOUT } from '../src/world/layout.js';
import { resolveWithBarnLocal, BARN_KEYS } from '../src/world/layoutBarn.js';
import { barnFrame, barnShape, insideBarn, underRoof, indoorLevel, wallBoxes, floorBlend, detourBoxes, outsideDoor, inFirstSpan, inDoorway } from '../src/world/barn.js';
import { loftShape, overLoft, worldClimbPoints, climbPoints, loftRestSpot } from '../src/world/loft.js';
import { detourVia } from '../src/npc/detour.js';
import { workSpot } from '../src/npc/girlBench.js';
import { strawTip } from '../src/world/loft.js';
import { placeInBarn } from '../src/world/barn.js';

// The barn turned a quarter left on the new farm: its doors face south (+z) and its second span is to the west.
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
    for (const k of BARN_KEYS.filter((k) => !['barn', 'loft', 'shed', 'barnBaleSpots', 'axleStands'].includes(k))) {
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
    const seat = f.toWorld(L.barnLocal.loft.seat.x, L.barnLocal.loft.seat.z);
    expect(near(seat.x, L.loft.seat.x) && near(seat.z, L.loft.seat.z)).toBe(true);
  });

  it('keeps the barn\'s own sizes: the walls swap round, the doors open south', () => {
    const boxes = wallBoxes(L);
    const hits = (x, z) => boxes.some((w) => Math.abs(x - w.x) < w.hx && Math.abs(z - w.z) < w.hz);
    const south = L.barn.z + L.barn.halfX; // the first door's wall
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
    expect(insideBarn(L, L.barn.x - L.barn.halfZ - 1, L.barn.z)).toBe(true); // the second span is to the west
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

  it('has its loft where the loft is in the world: the ladder, the edge and the way up', () => {
    const lf = loftShape(L, 0);
    const lf0 = loftShape(L0, 0);
    expect(lf.ladderFoot.x).toBeCloseTo(lf0.ladderFoot.x, 6); // worked out in the barn's own frame
    const foot = f.toWorld(lf.ladderFoot.x, lf.ladderFoot.z);
    const up = worldClimbPoints(L, lf, { x: foot.x, y: 0, z: foot.z + 1 }, true);
    expect(up.length).toBe(4);
    const own = climbPoints(lf, { ...f.toLocal(foot.x, foot.z + 1), y: 0 }, true);
    up.forEach((p, i) => { const w = f.toWorld(own[i].x, own[i].z); expect(near(p.x, w.x) && near(p.z, w.z) && near(p.y, own[i].y)).toBe(true); });
    const top = up[3];
    expect(overLoft(L, top.x, top.z, -0.5)).toBe(true); // the top of the climb is on the planks
    expect(overLoft(L, f.toWorld(L.barn.x - 4, L.barn.z).x, f.toWorld(L.barn.x - 4, L.barn.z).z)).toBe(false); // the back of the barn is under the loft's open edge, not on it
    const spot = loftRestSpot(L, lf);
    expect(overLoft(L, spot.x, spot.z)).toBe(true); // she sits on the planks
    expect(overLoft(L, spot.via[1].x, spot.via[1].z)).toBe(true);
    expect(insideBarn(L, spot.stand.x, spot.stand.z)).toBe(true); // and the ladder's foot is inside
  });

  it('has bale seats inside the first span, and the bench\'s bay inside the barn', () => {
    for (const [x, z] of L.barnBaleSpots) expect(insideBarn(L, x, z), `bale at ${x}, ${z}`).toBe(true);
    expect(insideBarn(L, L.bay.x, L.bay.z)).toBe(true);
    expect(insideBarn(L, L.bay2.x, L.bay2.z)).toBe(true);
    expect(insideBarn(L, L.bench.x, L.bench.z)).toBe(true);
    expect(insideBarn(L, L.helmetHooks.stand.x, L.helmetHooks.stand.z)).toBe(true);
  });

  it('is walked round, and in at the doorway that faces south', () => {
    const boxes = detourBoxes(L);
    expect(boxes.length).toBe(2);
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
    expect(inFirstSpan(L, L.barn.x, L.barn.z)).toBe(true);
    expect(inDoorway(L, out.x, L.barn.z + L.barn.halfX + 0.2)).toBe(true);
  });

  it('is unchanged at yaw 0: the shape is the barn\'s own', () => {
    expect(barnShape(L0).outer.maxX).toBeCloseTo(L0.barn.x + L0.barn.halfX, 6);
    expect(barnFrame(L0).turned).toBe(false);
    expect(wallBoxes(L0).length).toBe(6);
  });

  it('stands a girl at the bay, puts Jess\'s straw and aims the hay door as the unturned barn does, turned with the barn', () => {
    const turn = (v) => f.toWorld(L0.barn.x + v.x, L0.barn.z + v.z); // a point of the unturned barn about its anchor, in the world
    // workSpot: beside the quad in the bay, towards the bench end: the same place relative to the bay, and facing the quad.
    const w0 = workSpot(L0.bay);
    const w = workSpot(L.bay);
    const want = f.toWorld(w0.x, w0.z);
    expect(near(w.x, want.x) && near(w.z, want.z)).toBe(true);
    expect(Math.hypot(w.x - L.bay.x, w.z - L.bay.z)).toBeCloseTo(Math.hypot(w0.x - L0.bay.x, w0.z - L0.bay.z), 6);
    // strawTip: towards the loft's open edge, along the barn's own x
    const t0 = strawTip(L0, { x: 0, z: 0 });
    const t = strawTip(L, { x: 0, z: 0 });
    const step = f.vecToWorld(t0.x, t0.z);
    expect(near(t.x, step.x) && near(t.z, step.z)).toBe(true);
    // the hay door looks out of the barn's door end: south here, as the doors do
    const out = f.headingToWorld(Math.PI / 2);
    expect(near(Math.sin(out), 0) && near(Math.cos(out), 1)).toBe(true);
    expect(turn({ x: 0, z: 0 }).x).toBeCloseTo(L.barn.x, 6);
    // placeInBarn: a wall fixture's place and facing
    const obj = { position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: { y: 0 } };
    placeInBarn(L, obj, L.barn.x + 2, 1.5, L.barn.z - 1);
    const p = f.toWorld(L.barn.x + 2, L.barn.z - 1);
    expect(near(obj.position.x, p.x) && near(obj.position.z, p.z) && obj.position.y === 1.5).toBe(true);
    expect(near(obj.rotation.y, -Math.PI / 2)).toBe(true);
  });
});
