// Where the pit's screening plant goes (pure: no Three.js, so a test can deal a pit and try it). A plant is a line on a flat pad: the feed hopper at
// one end and a conveyor that climbs to end over a heap on the floor. The floor is crowded, so the plant is dealt with the pit (`dealPlant`, called
// by dealPit before the other heaps, which then keep clear of it) and the heap it ends over is the first of them. In the plant's own frame +x runs
// from the hopper to the heap, +z is to its right and y = 0 is the pad's top; screeningPlantModel.js builds it there and quarryProps.js stands it
// on the ground, at the height `plantSite` finds.

/** The plant's fixed sizes, shared by the model and the siting (metres, in the plant's frame). */
export const PLANT = {
  padX0: -3.2, // the pad's far end behind the hopper
  padX1: 9.2, // and its near end under the screen
  padHz: 3.4, // half its width
  padRise: 0.06, // its top stands this far over the highest ground it covers
  tailY: 0.85, // the second conveyor's tail, under the screen's discharge, its belt's top
  tailX: 8.9,
  headLift: 0.9, // the second conveyor's head hangs this far over the heap's top
  slopes: [19, 22, 25], // degrees the second conveyor may climb at, the gentlest tried first
  digZ: 8.4, // the excavator's middle, out to one side of the hopper, its bucket (6.2 m from its middle) hanging by the hopper's rim
};


// The excavator's tracks and body, as (across, outwards from its middle) points: it runs 2.5 m behind its middle and 6.4 m in front, 3.4 m across.
const DIG_FOOTPRINT = [[0, 0], [-1.8, 2.5], [1.8, 2.5], [-1.8, -3.5], [1.8, -3.5], [-1.8, -6], [1.8, -6]];
const rad = (deg) => (deg * Math.PI) / 180;
const segmentDistance = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** A point of the plant at (lx, lz) in its frame, in the world. `site` is `{ x, z, turn }`. */
export function plantPoint(site, lx, lz) {
  return { x: site.x + Math.cos(site.turn) * lx + Math.sin(site.turn) * lz, z: site.z - Math.sin(site.turn) * lx + Math.cos(site.turn) * lz };
}

/** How far the second conveyor's head hangs from the hopper, and how high over the pad's top, for a heap of height `h` and a climb of `slope` degrees. */
export function headFor(h, slope, params = PLANT) {
  const headY = h + params.headLift - params.padRise;
  return { headY, headX: params.tailX + (headY - params.tailY) / Math.tan(rad(slope)) };
}

/**
 * Deals the plant with the pit, on the flat floor (the floor is level, so the heap's height is all the climb needs): a heap, and a pad, a conveyor
 * and room for the excavator laid in a line away from it, every part of it on floor off the pond and the road feet. `ctx` is the pit's own
 * working: `{ at(a, s), floorEdge(a), roadEnds, climbFoot, roadPaths }` (`roadPaths` the lower halves of the two roads down the wall). Returns `{ heap, plant }` or null: `plant` is `{ x, z, turn, slope, side }`,
 * `side` which side of the hopper (+1 or -1 along z) the excavator stands (0 for neither), for `plantSite` to turn into a place.
 */
export function dealPlant(pit, ctx, random, params = PLANT) {
  const r = (lo, hi) => lo + random() * (hi - lo);
  const roadClear = pit.road.halfWidth + 2.5; // a road's edge and a few metres more
  const roadsClear = (x, z, d) => ctx.roadPaths.every((path) => path.every((pt, i) => i + 1 >= path.length || segmentDistance(x, z, pt.x, pt.z, path[i + 1].x, path[i + 1].z) > d));
  const floorOk = (x, z, margin) => {
    const dx = x - pit.x;
    const dz = z - pit.z;
    const qx = dx * Math.cos(pit.yaw) + dz * Math.sin(pit.yaw);
    const qz = -dx * Math.sin(pit.yaw) + dz * Math.cos(pit.yaw);
    const s = Math.hypot(qx, qz);
    return s < ctx.floorEdge(Math.atan2(qz, qx)) - margin
      && Math.hypot((x - pit.pond.x) / pit.pond.rx, (z - pit.pond.z) / pit.pond.rz) > 1 + 1.5 / Math.min(pit.pond.rx, pit.pond.rz)
      && roadsClear(x, z, roadClear)
      && Math.hypot(x - ctx.climbFoot.x, z - ctx.climbFoot.z) > 5;
  };
  // Looking first for a place where the excavator has room too, and for any place at all only when there is none.
  for (let tries = 0; tries < 2400; tries++) {
    const needDig = tries < 1600;
    const heapR = needDig ? r(4.2, 5.8) : r(3.6, 4.6); // a smaller, lower heap when the floor is tight: a shorter conveyor
    const h = needDig ? r(2.2, 3.6) : r(1.8, 2.4);
    const a = r(0, Math.PI * 2);
    const hp = ctx.at(a, random() * ctx.floorEdge(a));
    if (!floorOk(hp.x, hp.z, heapR * 0.85)) continue;
    // The same rules as any heap: off the pond, the roads and the climb's foot.
    if (Math.hypot(hp.x - pit.pond.x, hp.z - pit.pond.z) < heapR + Math.max(pit.pond.rx, pit.pond.rz) + 2) continue;
    if (!roadsClear(hp.x, hp.z, heapR + pit.road.halfWidth + 2)) continue;
    if (Math.hypot(hp.x - ctx.climbFoot.x, hp.z - ctx.climbFoot.z) < heapR + 7.2) continue;
    const start = r(0, Math.PI * 2);
    for (let k = 0; k < 24; k++) {
      const turn = -(start + (k * Math.PI) / 12); // the plant's heading: its +x runs (cos(-turn), sin(-turn)) in the world
      for (const slope of params.slopes) {
        const { headX } = headFor(h, slope, params);
        if (headX - heapR < params.padX1 + 1.5) continue; // the heap's foot must not reach the pad
        const site = { x: hp.x - Math.cos(turn) * headX, z: hp.z + Math.sin(turn) * headX, turn };
        const ok = (lx, lz, margin = 0.5) => {
          const p = plantPoint(site, lx, lz);
          return floorOk(p.x, p.z, margin);
        };
        let fits = true;
        for (const u of [0, 0.5, 1]) for (const v of [-1, 0, 1]) fits = fits && ok(params.padX0 + u * (params.padX1 - params.padX0), v * params.padHz);
        for (let lx = params.padX1; lx < headX && fits; lx += 2.5) fits = ok(lx, 0, -3);
        if (!fits) continue;
        const room = (side) => DIG_FOOTPRINT.every(([ox, oz]) => ok(ox, side * (params.digZ + oz), 1));
        const side = room(1) ? 1 : room(-1) ? -1 : 0;
        if (needDig && !side) continue;
        return { heap: { x: hp.x, z: hp.z, r: heapR, h, kind: random() < 0.5 ? 'gravel' : 'sand' }, plant: { x: site.x, z: site.z, turn, slope, side } };
      }
    }
  }
  return null;
}

/** 0..1 how much the ground at (x, z) is the plant's level pad: 1 under it, easing to 0 over 2.5 m beyond its edge. `plant` is the pit's, or null. */
export function plantPadWeight(plant, x, z, params = PLANT) {
  if (!plant) return 0;
  const mid = (params.padX0 + params.padX1) / 2;
  const dx = x - plant.x - Math.cos(plant.turn) * mid;
  const dz = z - plant.z + Math.sin(plant.turn) * mid;
  if (dx * dx + dz * dz > 14 * 14) return 0; // most of the map is nowhere near it
  const lx = Math.cos(plant.turn) * (x - plant.x) - Math.sin(plant.turn) * (z - plant.z);
  const lz = Math.sin(plant.turn) * (x - plant.x) + Math.cos(plant.turn) * (z - plant.z);
  const d = Math.max(params.padX0 - lx, lx - params.padX1, Math.abs(lz) - params.padHz, 0);
  const t = Math.min(1, d / 2.5);
  return 1 - t * t * (3 - 2 * t);
}

/** Whether a heap of radius `rad` at (x, z) would stand in the plant's way: on its pad, under its conveyor or where the excavator works. */
export function inPlantsWay(pit, x, z, rad, params = PLANT) {
  const { plant, heaps } = pit;
  if (!plant) return false;
  const { headX } = headFor(heaps[0].h, plant.slope, params);
  const a = plantPoint(plant, params.padX0, 0);
  const b = plantPoint(plant, headX, 0);
  if (segmentDistance(x, z, a.x, a.z, b.x, b.z) < rad + params.padHz + 2) return true;
  if (!plant.side) return false;
  const dig = plantPoint(plant, 0, plant.side * params.digZ);
  return Math.hypot(x - dig.x, z - dig.z) < rad + 7;
}

/**
 * Where the dealt plant stands on the ground `groundY`: the pad's top just over the highest ground it covers, where the second conveyor's head
 * hangs over the heap (its belt's top, in the plant's frame), and where the excavator stands and which way it faces (`dig`, `{ x, z, turn, side }`, or null
 * where there is no side with room or it would be over a road). Null if the pit has no plant.
 */
export function plantSite(quarry, groundY, params = PLANT) {
  const { plant, heaps } = quarry.pit;
  if (!plant) return null;
  const heap = heaps[0];
  let top = -Infinity;
  for (const u of [0, 0.25, 0.5, 0.75, 1]) for (const v of [-1, -0.5, 0, 0.5, 1]) {
    const p = plantPoint(plant, params.padX0 + u * (params.padX1 - params.padX0), v * params.padHz);
    top = Math.max(top, groundY(p.x, p.z));
  }
  const padTop = top + params.padRise;
  const headY = groundY(heap.x, heap.z) + params.headLift - padTop;
  const headX = Math.hypot(heap.x - plant.x, heap.z - plant.z); // fixed when it was dealt; the climb is whatever the real heights make it
  const slope = (Math.atan2(headY - params.tailY, headX - params.tailX) * 180) / Math.PI;
  let dig = null;
  if (plant.side) {
    const spot = plantPoint(plant, 0, plant.side * params.digZ);
    const clear = DIG_FOOTPRINT.every(([ox, oz]) => {
      const q = plantPoint(plant, ox, plant.side * (params.digZ + oz));
      return quarry.waterAt(q.x, q.z) === 0 && quarry.roadNear(q.x, q.z).d > quarry.roadHalf + 2;
    });
    if (clear) dig = { ...spot, turn: plant.turn + (plant.side * Math.PI) / 2, side: plant.side };
  }
  return { x: plant.x, z: plant.z, turn: plant.turn, heap, padTop, headX, headY, slope, dig };
}
