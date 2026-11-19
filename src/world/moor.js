// The Moor (#713): the open common beyond Back Lane up to the ridge wall (docs/farm-plan.md). Pure: no Three.js, no Rapier. `MOOR_FEATURES_PLAN` is what is
// on it in plan metres, `moorLayout` lays it in game metres for `layout.moor` (layoutNew.js), `createMoor` reads it for the ground's relief and the
// questions the props and the paint ask (where the heather is, where a flush is wet). moorProps.js builds it, moorPaint.js paints it.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A small seeded stream of numbers from 0 to 1, so the moor is the same every game (its places are on the plan, not dealt from the farm's seed). */
function stream(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The distance from (x, z) to the polyline `pts` ([x, z] points). */
export function distToLine(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/**
 * What is on the Moor, plan metres. The ridge wall runs the length of the common a little inside plan x -330, wandering as a real one does; the ladder
 * stile is at its vertex (-334, 612), where the footpath (RESERVED_PLAN) ends, and the trig pillar (LANDMARKS_PLAN, -330, 480) stands 7 m inside it with the
 * cairn a little way off. The spring is on the stream's own line (the hill's stream is at plan z 570 and wanders 2.5 m), at about (-200, 560). The cattle grids
 * are nearest the plan's (60, 34) and (-30, 840) that a car can cross: the first on the lane's straight into the north end, the second 25 m before the hairpin.
 */
export const MOOR_FEATURES_PLAN = {
  wall: { height: 1.35, thickness: 0.6, points: [[-327, 40], [-332, 160], [-330, 300], [-336, 420], [-337, 480], [-335, 560], [-334, 612], [-332, 700], [-330, 820], [-327, 920]] },
  stile: { at: [-334, 612], half: 0.7 },
  trig: { at: [-330, 480] },
  cairn: { at: [-324, 506], radius: 1.5, height: 1.6 },
  spring: { at: [-200, 571] },
  grids: [{ id: 'north', near: [60, 34] }, { id: 'south', near: [-14, 818] }],
  // Wet flushes (cotton grass, rushes and sphagnum), [x, z, rx, rz]: round the spring, and in the hollows between.
  flushes: [[-200, 571, 14, 11], [-150, 640, 11, 8], [-110, 700, 16, 9], [-250, 500, 12, 10], [-180, 420, 10, 13], [-90, 330, 13, 9], [-230, 760, 12, 10], [-120, 190, 11, 8], [-270, 250, 14, 10]],
  // Peat banks, cut faces [x0, z0, x1, z1] (the cut side is to the north-east: the face looks across the fall of the land).
  peat: [[-215, 612, -185, 600], [-140, 285, -115, 300]],
  // Sheep tracks, worn through the heather from the moor gate and the lane up to the ridge and the spring, each a polyline.
  tracks: [
    [[-2, 705], [-60, 690], [-120, 660], [-180, 600], [-200, 571]],
    [[-2, 705], [-70, 730], [-150, 760], [-230, 760], [-300, 730], [-320, 700]],
    [[8, 300], [-60, 330], [-130, 330], [-200, 400], [-260, 450], [-300, 480]],
    [[10, 150], [-80, 190], [-160, 210], [-240, 260], [-300, 330]],
  ],
  outcrops: 26,
  boulders: 60,
};

/** The grid's place: the lane's own point nearest `near`, found on `road` (roads.js), as { x, z, s }. */
export function gridPlace(road, near) {
  let best = Infinity;
  let at = null;
  for (const p of road.samples) {
    const d = Math.hypot(p.x - near[0], p.z - near[1]);
    if (d < best) [best, at] = [d, p];
  }
  return { x: at.x, z: at.z, s: at.s };
}

/** The moor in game metres. `fromPlan` is layoutNew's: plan (x, z) to game [x, z]. `bounds` is `MOOR_PLAN`. */
export function moorLayout(F, bounds, fromPlan) {
  const pt = (p) => fromPlan(p);
  const [minX, minZ] = fromPlan([bounds.minX, bounds.minZ]);
  const [maxX, maxZ] = fromPlan([bounds.maxX, bounds.maxZ]);
  const wall = { ...F.wall, points: F.wall.points.map(pt) };
  const stile = { at: pt(F.stile.at), half: F.stile.half };
  const spring = { at: pt(F.spring.at) };
  const flushes = F.flushes.map(([x, z, rx, rz]) => ({ x: pt([x, z])[0], z: pt([x, z])[1], rx, rz }));
  const peat = F.peat.map(([x0, z0, x1, z1]) => ({ a: pt([x0, z0]), b: pt([x1, z1]) }));
  const tracks = F.tracks.map((t) => t.map(pt));
  return {
    bounds: { minX, maxX, minZ, maxZ },
    wall,
    stile,
    trig: { at: pt(F.trig.at) },
    cairn: { at: pt(F.cairn.at), radius: F.cairn.radius, height: F.cairn.height },
    spring,
    grids: F.grids.map((g) => ({ id: g.id, near: pt(g.near) })),
    flushes,
    peat,
    tracks,
    outcrops: F.outcrops,
    boulders: F.boulders,
  };
}

/**
 * The moor as the ground and the props read it: `reliefAt(x, z)` (metres the outcrops and peat cuts add to the land's lie), the heather's and bracken's
 * cover at a point, how wet it is, and the outcrops and boulders dealt out on a fixed seed clear of everything with a place of its own.
 * `keepClear(x, z)` (optional) says where nothing may stand besides the moor's own places (the lane, the stream, the gate).
 */
export function createMoor(M, { keepClear = () => false } = {}) {
  const { bounds } = M;
  const inside = (x, z, m = 0) => x > bounds.minX - m && x < bounds.maxX + m && z > bounds.minZ - m && z < bounds.maxZ + m;
  const wallPts = M.wall.points;
  const distTo = (x, z, pts) => distToLine(pts, x, z);
  const own = [
    [M.trig.at, 6], [M.cairn.at, 5], [M.spring.at, 8], [M.stile.at, 6], [M.trig.at, 6],
  ];
  const clear = (x, z, pad = 0) => !keepClear(x, z) && distTo(x, z, wallPts) > 3 + pad && own.every(([a, r]) => Math.hypot(x - a[0], z - a[1]) > r + pad) && !M.peat.some((p) => distTo(x, z, [p.a, p.b]) < 7 + pad);

  // Outcrops: low gritstone humps with a cluster of lumps on each, more of them higher up where the soil is thin.
  const rnd = stream(0x4d007);
  const outcrops = [];
  for (let tries = 0; outcrops.length < M.outcrops && tries < 4000; tries++) {
    const x = bounds.maxX - rnd() * (bounds.maxX - bounds.minX) * (0.15 + 0.85 * Math.sqrt(rnd()));
    const z = bounds.minZ + rnd() * (bounds.maxZ - bounds.minZ);
    if (!inside(x, z) || !clear(x, z, 4) || outcrops.some((o) => Math.hypot(o.x - x, o.z - z) < 22)) continue;
    outcrops.push({ x, z, r: 3 + rnd() * 3.5, h: 0.5 + rnd() * 1.1, yaw: rnd() * Math.PI });
  }
  const boulders = [];
  for (let tries = 0; boulders.length < M.boulders && tries < 4000; tries++) {
    const x = bounds.minX + rnd() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + rnd() * (bounds.maxZ - bounds.minZ);
    if (!clear(x, z, 2)) continue;
    boulders.push({ x, z, size: 0.35 + rnd() * rnd() * 1.2, yaw: rnd() * Math.PI * 2 });
  }

  /** Peat bank `p`'s cut: a shelf 0.9 m high along its line whose face drops over 2.4 m (about 20 degrees, 30 on the fall of the land), on the line's north-east side. 0 at (x, z) off it. */
  function peatCut(p, x, z) {
    const dx = p.b[0] - p.a[0];
    const dz = p.b[1] - p.a[1];
    const len = Math.hypot(dx, dz);
    const along = ((x - p.a[0]) * dx + (z - p.a[1]) * dz) / len;
    if (along < -3 || along > len + 3) return 0;
    const across = ((x - p.a[0]) * dz - (z - p.a[1]) * dx) / len; // negative on the north-east side
    const end = smoothstep(-3, 2, along) * smoothstep(-3, 2, len - along);
    return 0.9 * end * (1 - smoothstep(-1.2, 1.2, across));
  }

  /** The metres the outcrops raise the land and the peat banks cut it. */
  function reliefAt(x, z) {
    if (!inside(x, z, 10)) return 0;
    let h = 0;
    for (const o of outcrops) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < o.r * 2) h += o.h * Math.exp(-((d / o.r) ** 2));
    }
    for (const p of M.peat) h -= peatCut(p, x, z);
    return h;
  }

  /** How wet it is at (x, z), 0 to 1: the flushes' middles. */
  function wetAt(x, z) {
    let w = 0;
    for (const f of M.flushes) w = Math.max(w, 1 - smoothstep(0.55, 1.15, Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz)));
    return w;
  }

  /** A slow noise from 0 to 1 over the moor, in patches about `cell` m across (the heather's older and younger stands). */
  const patch = (x, z, cell, salt) => {
    const gx = x / cell;
    const gz = z / cell;
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const h = (a, b) => {
      let t = (Math.imul(a + salt, 374761393) + Math.imul(b, 668265263)) | 0;
      t = Math.imul(t ^ (t >>> 13), 1274126177);
      return (((t ^ (t >>> 16)) >>> 0) / 4294967296);
    };
    const fx = gx - i;
    const fz = gz - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    return (h(i, j) * (1 - sx) + h(i + 1, j) * sx) * (1 - sz) + (h(i, j + 1) * (1 - sx) + h(i + 1, j + 1) * sx) * sz;
  };

  /** Bracken's cover at (x, z), 0 to 1: the lower slopes, in the east of the common, patchy, never in a flush. */
  const brackenAt = (x, z) => {
    const low = smoothstep(bounds.minX + 170, bounds.minX + 270, x); // 0 at the high end, 1 on the lower slopes
    return low * smoothstep(0.42, 0.62, patch(x, z, 24, 11)) * (1 - wetAt(x, z));
  };
  /** Heather's cover, 0 to 1: everywhere but the flushes, the bracken and the bare outcrops; its age (0 young, 1 old and leggy) is `heatherAge`. */
  /** How worn a sheep track makes (x, z), 0 to 1: nothing grows in the middle of one. */
  const trackAt = (x, z) => {
    let t = 0;
    for (const line of M.tracks) t = Math.max(t, 1 - smoothstep(0.25, 1.1, distToLine(line, x, z)));
    return t;
  };
  const heatherAt = (x, z) => (1 - 0.95 * trackAt(x, z)) * (1 - wetAt(x, z)) * (1 - 0.85 * brackenAt(x, z)) * smoothstep(bounds.minX - 8, bounds.minX + 25, x) * (0.35 + 0.65 * smoothstep(0.1, 0.5, patch(x, z, 18, 3)));
  const heatherAge = (x, z) => patch(x, z, 30, 7);

  return { M, bounds, inside, outcrops, boulders, reliefAt, wetAt, trackAt, brackenAt, heatherAt, heatherAge, clear, patch };
}

/**
 * The wall's collider pieces: [{ x, z, len, yaw }] along its line, at most `chunk` m each, none across the stile's gap (a ladder stile climbs over the wall,
 * so the wall is whole there; `stileGap` is how much of it the stile's own steps cover, for the model only).
 */
export function wallPieces(wall, chunk = 3) {
  const out = [];
  const pts = wall.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / chunk));
    for (let k = 0; k < n; k++) {
      const a = [ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n];
      const b = [ax + ((bx - ax) * (k + 1)) / n, az + ((bz - az) * (k + 1)) / n];
      out.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, len: Math.hypot(b[0] - a[0], b[1] - a[1]), yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) });
    }
  }
  return out;
}
