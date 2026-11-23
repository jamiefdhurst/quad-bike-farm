// What stands about the neighbour's yard (#911), as shapes: the pieces a working dairy yard has and where the marks of work lie on its concrete. Pure: the
// pieces are drawn by neighbourYardProps.js, the marks painted into one decal by the same file, and `neighbourFarmShape` reads `furniture` from the layout.

/**
 * Each kind's footprint as half sizes (x, z) at yaw 0, in metres. A piece turned a quarter swaps them, and any other turn takes the larger on both. The
 * footprint is what the route test and the yard's `builtAt` keep clear; `onWall` marks what stands on a wall or hangs from one (no ground footprint).
 */
export const YARD_KINDS = {
  silageTrough: { hx: 5.5, hz: 0.42 }, // a feed passage's trough along the barn wall
  mineralTub: { hx: 0.6, hz: 0.5 }, // a lick tub on a pallet
  balefeeder: { hx: 1.1, hz: 1.1 }, // a steel ring round a round bale
  wrappedBale: { hx: 0.65, hz: 0.65 },
  waterTrough: { hx: 0.9, hz: 0.32 },
  hoseHook: { hx: 0.3, hz: 0.12 },
  yardTap: { hx: 0.15, hz: 0.15 },
  barrow: { hx: 0.3, hz: 0.75 },
  leaningTools: { hx: 0.12, hz: 0.45 },
  scrapeBlade: { hx: 1.3, hz: 0.5 },
  palletStack: { hx: 0.6, hz: 0.5 },
  limeBags: { hx: 0.4, hz: 0.3 },
  feedSacks: { hx: 0.3, hz: 0.25 },
  tyreStack: { hx: 0.5, hz: 0.5 },
  ibcTank: { hx: 0.6, hz: 0.55 },
  muckHeap: { hx: 3.2, hz: 3 },
  henCoop: { hx: 1.6, hz: 1.3 },
  catOnWall: { hx: 0, hz: 0, onWall: true },
  kennel: { hx: 0.55, hz: 0.45 },
  dogBowl: { hx: 0.2, hz: 0.2 },
  bootsAtDoor: { hx: 0.2, hz: 0.15 },
  churnStand: { hx: 0.45, hz: 0.45 },
  nameBoard: { hx: 0.1, hz: 1.1 },
  yardLight: { hx: 0.25, hz: 0.25 },
};

const quarter = (yaw) => Math.abs(Math.sin(yaw)) > 0.999;
const straight = (yaw) => Math.abs(Math.sin(yaw)) < 0.001;

/** A piece from the layout (`{ kind, x, z, yaw }`) with its footprint (`hx`, `hz` turned as above) and `outer` as a rect. Null for a kind that isn't known. */
export function yardPiece(p) {
  const k = YARD_KINDS[p.kind];
  if (!k) return null;
  const yaw = p.yaw ?? 0;
  const m = Math.max(k.hx, k.hz);
  const [hx, hz] = straight(yaw) ? [k.hx, k.hz] : quarter(yaw) ? [k.hz, k.hx] : [m, m];
  return { ...p, yaw, hx, hz, onWall: !!k.onWall, outer: { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz } };
}

/** The pieces on the ground of the yard, as `yardPiece`s. */
export const yardFootprints = (list) => (list ?? []).map(yardPiece).filter((p) => p && !p.onWall);

const rnd = (random, a, b) => a + random() * (b - a);

/** A line of points walked along at `step` m, each with the heading there. */
function along(points, step) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0); // 0 along +z
    for (let d = 0; d < len; d += step) out.push({ x: x0 + ((x1 - x0) * d) / len, z: z0 + ((z1 - z0) * d) / len, yaw });
  }
  return out;
}

/**
 * The marks of work on the yard's concrete, in game metres: pairs of wheel tracks where the vehicles run (the gateway to the barn door and to the tank room's
 * strip), hoof prints where the herd goes in (the gateway to the collecting yard's gap), an oil stain under each parked vehicle and under the tractor's
 * engine end, the puddle in the low corner, straw blown against the barn door and the barn's foot, the scrape of the loader along the collecting yard's south
 * kerb and the drip under the tap. A mark is { type, x, z, yaw, w, d, seed } (`w` across, `d` along its heading), the stains irregular blobs built from
 * `seed`, never a circle. `shape` is `neighbourFarmShape`'s; the marks stay inside its slab.
 */
export function yardMarks(shape, random) {
  const s = shape;
  const marks = [];
  const gx = s.gateway.x + (s.gateway.side === 'west' ? 1 : -1);
  const door = [s.barn.door.x + (s.barn.door.x > s.barn.x ? 2.5 : -2.5), s.barn.door.z];
  const gapZ = s.collecting ? (s.collecting.gap?.z ?? (s.collecting.minZ + s.collecting.maxZ) / 2) : s.gateway.z;
  const gapX = s.collecting ? s.collecting.minX - 1 : door[0];
  const strip = s.tankRoom ? [s.tankRoom.x, s.tankRoom.outer.maxZ + 3] : [gx, gz(s)];
  const wheel = (path, spacing, kind) => {
    for (const p of along(path, kind === 'tyre' ? 1.1 : 0.62)) {
      if (random() < 0.12) continue; // the track breaks where the ground was drier
      for (const side of [-1, 1]) {
        const off = side * spacing + rnd(random, -0.08, 0.08);
        marks.push({ type: kind, x: p.x + Math.cos(p.yaw) * off, z: p.z - Math.sin(p.yaw) * off, yaw: p.yaw + rnd(random, -0.05, 0.05), w: kind === 'tyre' ? 0.2 : 0.12, d: kind === 'tyre' ? 0.9 : 0.14, seed: random() });
      }
    }
  };
  wheel([[gx, s.gateway.z + 1], [gx + 14, s.gateway.z + 1.5], [door[0] - 3, door[1] + 8], door], 0.75, 'tyre');
  if (s.tankRoom) wheel([[gx + 14, s.gateway.z + 2.2], [s.collecting ? s.collecting.maxX + 6 : strip[0], s.gateway.z + 6], strip], 0.8, 'tyre');
  wheel([[gx, s.gateway.z - 1.2], [gx + 12, s.gateway.z - 4], [gapX - 6, gapZ + 2], [gapX, gapZ]], 0.3, 'hoof'); // the herd walks the lane's side of the gateway
  const onSlab = (p) => p.x > s.slab.minX && p.x < s.slab.maxX && p.z > s.slab.minZ && p.z < s.slab.maxZ;
  for (const p of s.parked.filter((v) => onSlab(v) && v.kind !== 'tipTrailer')) for (let k = 0; k < 2; k++) { // a vehicle on the grass has no concrete to stain, and a trailer has no engine to drip
    marks.push({ type: 'oil', x: p.x + rnd(random, -0.7, 0.7) * Math.sin(p.yaw) + rnd(random, -0.3, 0.3), z: p.z + rnd(random, -0.7, 0.7) * Math.cos(p.yaw), yaw: rnd(random, 0, 3), w: rnd(random, 0.5, 0.9), d: rnd(random, 0.35, 0.7), seed: random(), vehicle: p.kind });
  }
  // The low corner: the slab's lowest, where it falls to the wall away from the house, by the gateway side's south end.
  const sl = s.slab;
  marks.push({ type: 'puddle', x: sl.minX + 5.5, z: sl.maxZ - 3, yaw: 0.3, w: 3.4, d: 2.2, seed: random() });
  const bd = s.barn.door;
  marks.push({ type: 'straw', x: bd.x + (bd.x > s.barn.x ? 1.6 : -1.6), z: bd.z, yaw: 0, w: 2.4, d: 5.6, seed: random() });
  marks.push({ type: 'straw', x: s.barn.x + (bd.x > s.barn.x ? 4 : -4), z: s.barn.outer.maxZ + 1.4, yaw: 1.57, w: 1.3, d: 4.5, seed: random() });
  if (s.collecting) marks.push({ type: 'scrape', x: (s.collecting.minX + s.collecting.maxX) / 2, z: s.collecting.maxZ + 1.1, yaw: 1.57, w: 1.4, d: 22, seed: random() });
  for (const f of yardFootprints(s.furniture)) {
    if (f.kind === 'yardTap') marks.push({ type: 'drip', x: f.x, z: f.z + 0.45, yaw: 0, w: 0.9, d: 0.8, seed: random() });
    if (f.kind === 'silageTrough') marks.push({ type: 'silage', x: f.x, z: f.outer.maxZ + 0.35, yaw: 1.57, w: 0.7, d: f.hx * 2 + 0.6, seed: random() });
  }
  return marks;
}

function gz(s) {
  return s.gateway.z;
}
