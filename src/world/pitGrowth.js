// What has grown over the Old Pit's floor since it was left (#1003), as numbers, so the farm's list of placed things (farmPlacement.js) has the same
// ones quarryProps.js draws: grass crusting the heaps with birch seedlings and buddleia in it, reeds, rushes and sedge round the pond's edge (out of
// the water), weeds round the screening plant's footings and in the cracks of its pad, lumps broken off the pad's edge. And, worked out from where
// the builder stands each relic (those are dealt inside its drawing code, so they join the list with it, #1229): grass and weeds up through the
// excavator's tracks, weeds through the drums, and the container's hardstanding with the birch through its sleepers. Pure: no Three.js. What the
// whole pit grows comes from its own stream (`streamFor('pitGrowth')`), so it is the same however the other builders draw.

import { streamFor, seeded } from './propStreams.js';
import { PLANT, plantPoint, headFor, plantFootings } from './plantSite.js';

const TAU = Math.PI * 2;
/** The container's length and width (containerModel.js `CONTAINER`, which this pure module doesn't import for Three.js's sake; a test holds them equal). */
export const CONTAINER_SIZE = { length: 6.06, width: 2.44 };
const CONTAINER = CONTAINER_SIZE;

/** How much grows (#1003): tufts, seedlings and buddleia per heap, the pond's clumps, the pad's weeds and lumps. */
export const PIT_GROWTH = {
  heapTufts: 2.6, // grass tufts per square metre of a heap's grassed patches
  heapSeedlings: [3, 5], // birch seedlings on each heap, fewest to most
  heapBuddleia: [1, 2],
  reeds: 70, // clumps round the pond
  rushes: 46,
  sedge: 30,
  padWeeds: 26, // tufts in the pad's cracks
  padEdge: 0.9, // metres between the tufts and lumps along the pad's edge
};

const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** A point (lx, lz) in the frame of something standing at `at` turned `turn` (+x its length), in the world: as quarryProps.js places a model. */
export function framePoint(at, turn, lx, lz) {
  return { x: at.x + Math.cos(turn) * lx + Math.sin(turn) * lz, z: at.z - Math.sin(turn) * lx + Math.cos(turn) * lz };
}

/**
 * The grassed patches on heap `hi` (#1003), the same for the ground's painting (groundTexture.js) and the tufts on them: three to five discs over
 * its crown and flanks, `{ x, z, r }`, from the heap's own fixed stream.
 */
export function heapPatches(heap, hi) {
  const rnd = seeded(7919 * (hi + 1) + 101);
  const n = 3 + Math.floor(rnd() * 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const d = heap.r * (i === 0 ? rnd() * 0.25 : 0.25 + rnd() * 0.5);
    out.push({ x: heap.x + Math.cos(a) * d, z: heap.z + Math.sin(a) * d, r: heap.r * (0.22 + rnd() * 0.22) });
  }
  return out;
}

/** The pit's own working the growth needs, from `quarry` (createQuarry): what to keep clear of, and the plant's line and its excavator's spot. */
function clearOf(quarry) {
  const { pit } = quarry;
  const [c0, , c2] = quarry.climb.points;
  const plant = pit.plant;
  let line = null;
  let dig = null;
  if (plant) {
    const { headX } = headFor(pit.heaps[0].h, plant.slope);
    const a = plantPoint(plant, PLANT.padX0 - 0.8, 0);
    const b = plantPoint(plant, headX + 1, 0);
    line = [a.x, a.z, b.x, b.z];
    if (plant.side) dig = plantPoint(plant, -1.8, plant.side * PLANT.digZ);
  }
  return (x, z, margin = 0) => {
    if (quarry.waterAt(x, z) > 0.05) return false;
    if (quarry.roadNear(x, z).d < quarry.roadHalf + 0.6 + margin) return false;
    if (segDist(x, z, c0[0], c0[1], c2[0], c2[1]) < quarry.climb.gateHalf + 2) return false; // the climb's way up the wall stays clear
    if (line && segDist(x, z, ...line) < 1.7 + margin) return false; // under the conveyor and round the pad
    if (dig && Math.hypot(x - dig.x, z - dig.z) < 5.5) return false; // where the excavator stands
    return true;
  };
}

/**
 * Everything the pit grows that the list can place from the pit's own deal (#1003): `{ tufts, seedlings, buddleia, reeds, rushes, sedge, padWeeds,
 * padLumps, footings }`, each `[{ x, z, s, yaw, ... }]` in game metres. `s` is a scale (a seedling's and a buddleia's `h` its height), a weed's
 * `kind` 'nettle', 'dock', 'parsley' or 'grass'.
 */
export function pitGrowth(quarry, { random = streamFor('pitGrowth') } = {}) {
  const { pit } = quarry;
  const ok = clearOf(quarry);
  const r = (lo, hi) => lo + random() * (hi - lo);
  const out = { tufts: [], seedlings: [], buddleia: [], reeds: [], rushes: [], sedge: [], padWeeds: [], padLumps: [], footings: [] };
  // The heaps: grass in their patches, seedlings over the crust, buddleia low on their flanks.
  pit.heaps.forEach((heap, hi) => {
    const onHeap = (x, z) => Math.hypot(x - heap.x, z - heap.z) < heap.r * 0.92;
    for (const p of heapPatches(heap, hi)) {
      const n = Math.round(Math.PI * p.r * p.r * PIT_GROWTH.heapTufts);
      for (let i = 0; i < n; i++) {
        const a = random() * TAU;
        const d = Math.sqrt(random()) * p.r;
        const x = p.x + Math.cos(a) * d;
        const z = p.z + Math.sin(a) * d;
        const s = r(0.7, 1.3);
        const yaw = random() * TAU;
        if (onHeap(x, z) && ok(x, z)) out.tufts.push({ x, z, s, yaw, heap: hi });
      }
    }
    const seed = (count, near, far, list, size) => {
      for (let i = 0, tries = 0; i < count && tries < count * 12; tries++) {
        const a = random() * TAU;
        const d = heap.r * r(near, far);
        const x = heap.x + Math.cos(a) * d;
        const z = heap.z + Math.sin(a) * d;
        const h = r(...size);
        const yaw = random() * TAU;
        if (!ok(x, z, 0.5) || list.some((q) => Math.hypot(q.x - x, q.z - z) < 1.2)) continue;
        list.push({ x, z, h, yaw, heap: hi });
        i++;
      }
    };
    const [s0, s1] = PIT_GROWTH.heapSeedlings;
    seed(s0 + Math.floor(random() * (s1 - s0 + 1)), 0.1, 0.8, out.seedlings, [0.6, 1.9]);
    const [b0, b1] = PIT_GROWTH.heapBuddleia;
    seed(b0 + Math.floor(random() * (b1 - b0 + 1)), 0.55, 0.95, out.buddleia, [1.0, 1.8]);
  });
  // The pond: round its edge, just out of the water, reeds nearest it, rushes and sedge behind; a gap on the floor's side, where the drums were dumped.
  {
    const pond = quarry.pond;
    const toFloor = Math.atan2(pit.z - pond.z, pit.x - pond.x);
    const edgeAt = (a) => {
      let e = 0.3;
      while (e < 1.5 && quarry.waterAt(pond.x + Math.cos(a) * e * pond.rx, pond.z + Math.sin(a) * e * pond.rz) > 0.05) e += 0.02;
      return e;
    };
    const ring = (count, out0, out1, list, sizes) => {
      for (let i = 0, tries = 0; i < count && tries < count * 10; tries++) {
        const a = random() * TAU;
        const e = edgeAt(a);
        const k = e + r(out0, out1) / Math.min(pond.rx, pond.rz); // metres out from the water's edge
        const x = pond.x + Math.cos(a) * k * pond.rx;
        const z = pond.z + Math.sin(a) * k * pond.rz;
        const s = r(...sizes);
        const yaw = random() * TAU;
        const gap = Math.abs(Math.atan2(Math.sin(a - toFloor), Math.cos(a - toFloor))) < 0.45;
        if (gap || !ok(x, z, -0.3)) continue;
        list.push({ x, z, s, yaw });
        i++;
      }
    };
    ring(PIT_GROWTH.reeds, 0.15, 0.9, out.reeds, [0.8, 1.25]);
    ring(PIT_GROWTH.rushes, 0.5, 1.8, out.rushes, [0.75, 1.2]);
    ring(PIT_GROWTH.sedge, 0.9, 2.4, out.sedge, [0.7, 1.15]);
  }
  // The plant: weeds round each footing, tufts in the pad's cracks, and along its edge tufts and lumps of hardcore broken off it.
  const plant = pit.plant;
  if (plant) {
    const heap = pit.heaps[0];
    const headX = Math.hypot(heap.x - plant.x, heap.z - plant.z);
    const side = plant.side || -1;
    const kinds = ['nettle', 'dock', 'grass', 'grass', 'parsley'];
    for (const f of plantFootings(headX, side)) {
      const n = 1 + Math.floor(random() * 2);
      for (let i = 0; i < n; i++) {
        const a = random() * TAU;
        const d = r(0.18, 0.4);
        const lx = f.x + Math.cos(a) * d;
        const lz = f.z + Math.sin(a) * d;
        const p = plantPoint(plant, lx, lz);
        const kind = kinds[Math.floor(random() * kinds.length)];
        const s = r(0.6, 1.1);
        const yaw = random() * TAU;
        if (quarry.waterAt(p.x, p.z) > 0.05 || quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 0.6) continue;
        out.footings.push({ ...p, lx, lz, s, yaw, kind, onPad: f.onPad && lx > PLANT.padX0 && lx < PLANT.padX1 && Math.abs(lz) < PLANT.padHz });
      }
    }
    for (let i = 0; i < PIT_GROWTH.padWeeds; i++) {
      const lx = r(PLANT.padX0 + 0.3, PLANT.padX1 - 0.3);
      const lz = r(-PLANT.padHz + 0.3, PLANT.padHz - 0.3);
      const s = r(0.5, 0.9);
      const yaw = random() * TAU;
      out.padWeeds.push({ ...plantPoint(plant, lx, lz), lx, lz, s, yaw, onPad: true });
    }
    // Round the pad's edge, a little out from it, where the hardcore has crumbled away and the grass is coming in.
    const x0 = PLANT.padX0 - 0.1;
    const x1 = PLANT.padX1 + 0.1;
    const hz = PLANT.padHz + 0.1;
    const perimeter = 2 * (x1 - x0) + 4 * hz;
    for (let s = 0; s < perimeter; s += PIT_GROWTH.padEdge * r(0.6, 1.4)) {
      let lx;
      let lz;
      if (s < x1 - x0) [lx, lz] = [x0 + s, -hz];
      else if (s < x1 - x0 + 2 * hz) [lx, lz] = [x1, -hz + (s - (x1 - x0))];
      else if (s < 2 * (x1 - x0) + 2 * hz) [lx, lz] = [x1 - (s - (x1 - x0) - 2 * hz), hz];
      else [lx, lz] = [x0, hz - (s - 2 * (x1 - x0) - 2 * hz)];
      const out1 = r(-0.15, 0.5);
      const nx = lx <= x0 + 1e-6 ? -1 : lx >= x1 - 1e-6 ? 1 : 0;
      const nz = nx ? 0 : Math.sign(lz);
      const px = lx + nx * out1;
      const pz = lz + nz * out1;
      const p = plantPoint(plant, px, pz);
      const lump = random() < 0.45;
      const size = r(0.12, 0.34);
      const yaw = random() * TAU;
      const tip = r(-0.2, 0.2);
      if (quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 0.6 || quarry.waterAt(p.x, p.z) > 0.05) continue;
      if (lump) out.padLumps.push({ ...p, lx: px, lz: pz, size, yaw, tip, shape: random() });
      else out.padWeeds.push({ ...p, lx: px, lz: pz, s: size * 3, yaw, onPad: false });
    }
  }
  return out;
}

/**
 * Grass and weeds up through the excavator's tracks and round them (#1003), in its own frame (+x the way it looks, +z to its right, tracks 1 m
 * either side of its middle, 3.7 m long): `[{ x, z, s, yaw, kind }]`. Some stand in the loop between the runs, where they come up through it.
 */
export function excavatorGrowth(random) {
  const out = [];
  const r = (lo, hi) => lo + random() * (hi - lo);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) out.push({ x: r(-1.9, 1.9), z: side * r(1.33, 1.6), s: r(0.8, 1.4), yaw: random() * TAU, kind: random() < 0.75 ? 'grass' : 'dock' }); // against the outside of the track
    for (let i = 0; i < 5; i++) out.push({ x: r(-1.6, 1.6), z: side * r(0.55, 0.7), s: r(0.8, 1.3), yaw: random() * TAU, kind: 'grass' }); // in the gap between the tracks
    for (let i = 0; i < 4; i++) out.push({ x: r(-1.3, 1.3), z: side * r(0.85, 1.15), s: r(1.1, 1.6), yaw: random() * TAU, kind: random() < 0.5 ? 'nettle' : 'grass', through: true }); // up through the loop itself
    for (const end of [-1, 1]) for (let i = 0; i < 2; i++) out.push({ x: end * r(1.95, 2.2), z: side * r(0.7, 1.3), s: r(0.8, 1.3), yaw: random() * TAU, kind: 'grass' }); // over the sprocket and the idler
  }
  return out;
}

/** Weeds through a pile of drums (#1003): round and between the drums at `spots` (`[{ x, z, r }]`, game metres), `[{ x, z, s, yaw, kind }]`. */
export function drumWeeds(spots, random) {
  const out = [];
  for (const d of spots) {
    const n = 2 + Math.floor(random() * 2);
    for (let i = 0; i < n; i++) {
      const a = random() * TAU;
      const dist = d.r + 0.03 + random() * 0.25;
      out.push({ x: d.x + Math.cos(a) * dist, z: d.z + Math.sin(a) * dist, s: 0.7 + random() * 0.6, yaw: random() * TAU, kind: ['grass', 'grass', 'nettle', 'dock'][Math.floor(random() * 4)] });
    }
  }
  return out;
}

/** The container's hardstanding's size (#1003): an old concrete slab under it, longer at the door end where the apron was. In its frame, metres. */
export const HARDSTANDING = { x0: -CONTAINER.length / 2 - 0.9, x1: CONTAINER.length / 2 + 1.9, halfW: CONTAINER.width / 2 + 0.95 };

/**
 * The container's hardstanding and what grows round it (#1003), in the container's frame (+x to its doors, +z to its right): the slab's `rows`
 * ([{ u, left, right }] along x, its edges broken back unevenly), the birch growing up between two sleepers on `side` (+1 or -1, the side it leans
 * away from the wall to), weeds in the slab's cracks and along its edge, and lumps broken off it.
 */
export function containerDressing(random, side = 1) {
  const r = (lo, hi) => lo + random() * (hi - lo);
  const { x0, x1, halfW } = HARDSTANDING;
  const rows = [];
  for (let u = x0; u <= x1 + 1e-6; u += 0.5) {
    const ragged = () => r(0, 0.45) * (random() < 0.3 ? 1.6 : 1); // a bite out of the edge here and there
    rows.push({ u, left: -halfW + ragged(), right: halfW - ragged() });
  }
  const sapling = { x: -1.15 + r(-0.15, 0.15), z: side * (CONTAINER.width / 2 + 0.24), h: r(2.3, 2.9), lean: side };
  const weeds = [];
  for (let i = 0; i < 18; i++) {
    const along = random() < 0.5;
    const x = along ? r(x0, x1) : random() < 0.5 ? x0 + r(-0.1, 0.3) : x1 + r(-0.3, 0.1);
    const z = along ? (random() < 0.5 ? -1 : 1) * (halfW - r(0, 0.5)) : r(-halfW, halfW);
    weeds.push({ x, z, s: r(0.7, 1.2), yaw: random() * TAU, kind: random() < 0.7 ? 'grass' : 'dock' });
  }
  for (let i = 0; i < 8; i++) weeds.push({ x: r(CONTAINER.length / 2 + 0.3, x1 - 0.2), z: r(-halfW + 0.3, halfW - 0.3), s: r(0.5, 0.8), yaw: random() * TAU, kind: 'grass' }); // in the apron's cracks
  weeds.push({ x: sapling.x + 0.25, z: sapling.z + side * 0.1, s: 1.1, yaw: random() * TAU, kind: 'grass' }, { x: sapling.x - 0.3, z: sapling.z, s: 0.9, yaw: random() * TAU, kind: 'nettle' });
  const lumps = [];
  for (let i = 0; i < 7; i++) {
    const end = random() < 0.4;
    lumps.push({ x: end ? x1 + r(0, 0.4) : r(x0, x1), z: end ? r(-halfW, halfW) : (random() < 0.5 ? -1 : 1) * (halfW + r(-0.1, 0.35)), size: r(0.15, 0.4), yaw: random() * TAU, shape: random() });
  }
  return { rows, sapling, weeds, lumps };
}
