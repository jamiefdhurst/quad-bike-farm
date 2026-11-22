// The far landscape (#708): a ring of low-poly ground from the map's edge out to 3.5 km, so no edge of the world is ever seen. It carries the land's lie
// on (the valley floor east, the moor's plateau and a far hillside west, rising fields north, hills on the horizon), is painted from the patchwork
// (patchwork.js) as fields with hedge lines, woods, farms and the road and river running on. Pure: no Three.js. farLandView.js builds the meshes.

import { createLandform } from './landform.js';
import { PATCH_COLORS, NEAR_GRASS, patchAt, hash2 } from './patchwork.js';
import { PLAN_ORIGIN } from './layoutNew.js';

export const FAR_PARAMS = {
  reach: 3500, // m the ring runs out from the skirt's outer edge
  blend: 260, // m over which the ring's land passes from the ground's own heights to the far land's lie
  nearStep: 24, // m the ring's first cells are across, growing with distance
  growth: 1.15,
  maxStep: 380,
  alongStep: 40, // m between the ring's lines along the edge of the ground
  texture: 2048, // px a side of the painted ground
  cell: 85, // m: the patchwork's field cell (patchwork.js)
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/** Smooth value noise, 0..1, in two dimensions. */
function noise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  return mix(mix(hash2(ix, iz), hash2(ix + 1, iz), u), mix(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v);
}
const fbm = (x, z) => noise(x, z) * 0.6 + noise(x * 2.1 + 7, z * 2.1 + 3) * 0.3 + noise(x * 4.3 + 1, z * 4.3 + 9) * 0.1;

/** The view distance (m) the weathers' fog densities are written for: a clear day shows this far at the default `viewDistance`. */
export const FOG_VIEW = 1500;

/**
 * The fog density to use on the new farm for a weather whose own density is `density`, with a clear day showing `view` metres. A clear or fair day's (0.0032 to 0.004:
 * nothing left at 700 m) is thinned to what lets `view` show, and rain and mist are left as they are at 1500 m. Every weather is a fixed fraction of the view
 * distance (the distance it shows is proportional to it, so its density is inversely), so the weather keeps its murk relative to it.
 */
export function farFog(density, view = FOG_VIEW) {
  return (density * mix(0.36, 1, smooth(0.004, 0.0075, density)) * FOG_VIEW) / Math.max(1, view);
}

/** The skirt's outer rectangle (the ground and `margin` m round it), where the ring starts, and the ring's own outer one. */
export function farRects(ground, margin, reach = FAR_PARAMS.reach) {
  const inner = { minX: ground.minX - margin, maxX: ground.maxX + margin, minZ: ground.minZ - margin, maxZ: ground.maxZ + margin };
  const outer = { minX: inner.minX - reach, maxX: inner.maxX + reach, minZ: inner.minZ - reach, maxZ: inner.maxZ + reach };
  return { inner, outer };
}

/** How far (x, z) is outside the rectangle, 0 inside it. */
export function outsideBy(r, x, z) {
  return Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
}

/** The lines (ascending) across one axis: `lo` to `hi`, closely spaced either side of the inner rectangle's edges and growing outward. */
export function axisLines(lo, hi, innerLo, innerHi, params = FAR_PARAMS) {
  const lines = [];
  let step = params.nearStep;
  for (let v = innerLo - step; v > lo; v -= step) {
    lines.push(v);
    step = Math.min(params.maxStep, step * params.growth);
  }
  lines.push(lo);
  lines.reverse();
  const span = innerHi - innerLo;
  const n = Math.max(1, Math.ceil(span / params.alongStep));
  for (let i = 0; i <= n; i++) lines.push(innerLo + (span * i) / n);
  step = params.nearStep;
  for (let v = innerHi + step; v < hi; v += step) {
    lines.push(v);
    step = Math.min(params.maxStep, step * params.growth);
  }
  lines.push(hi);
  return lines;
}

/**
 * The height of the far land at (x, z): the ground's own height (`groundAt`) up to the inner rectangle's edge, then the land's lie (the
 * landform's rise by x) with what the far country adds, reached over `blend` m so the two meet with no step.
 */
export function createFarHeight({ landform, groundAt, inner, params = FAR_PARAMS }) {
  const lie = createLandform(landform);
  const floor = lie(1e6);
  const valley = (x) => smooth(300, 650, x) * (1 - smooth(1300, 1900, x)); // the broad valley the A-road and the river run down
  const extras = (x, z, d) => {
    const v = valley(x);
    const west = x < inner.minX ? 60 * smooth(0, 1700, inner.minX - x) : 0; // the far hillside beyond the moor's plateau
    const north = z < inner.minZ ? 75 * smooth(0, 2900, inner.minZ - z) * (1 - 0.35 * v) : 0; // fields rising to the hills
    const south = z > inner.maxZ ? 28 * smooth(0, 2600, z - inner.maxZ) * (1 - 0.85 * v) : 0; // the valley carries on south
    const east = x > inner.maxX ? 62 * smooth(0, 2300, x - inner.maxX) : 0; // the far side of the valley
    // The hills of the horizon, topping out at about 2.8 km and dropping behind, so the ring's rim is a valley the hills hide.
    const open = z > inner.maxZ ? 1 - 0.65 * v : 1;
    const hills = 105 * smooth(1300, 2700, d) * (1 - 0.8 * smooth(3000, 3500, d)) * (0.45 + 0.55 * fbm(x / 700, z / 700)) * open;
    const rolling = (3 + 9 * smooth(0, 2000, d)) * (fbm(x / 240, z / 240) - 0.5) * 2 * (1 - 0.75 * v);
    return west + north + south + east + hills + rolling;
  };
  /** The land's own lie there, before the ground's rolling is blended out. */
  const far = (x, z) => lie(x) + extras(x, z, outsideBy(inner, x, z));
  const heightAt = (x, z) => {
    const d = outsideBy(inner, x, z);
    if (d <= 0) return groundAt(x, z);
    const s = smooth(0, params.blend, d);
    return s >= 1 ? far(x, z) : mix(groundAt(x, z), far(x, z), s);
  };
  heightAt.floor = floor;
  return heightAt;
}

/**
 * The ring's triangles: `positions`, `uvs` (across `uvRect`, `outer` unless given) and `index`, for every cell outside `inner` or only those `select`
 * (called with a cell's middle) takes. Two selections that are each other's opposite share their edge's vertices, so the two meshes meet with no gap.
 */
export function farRingData({ inner, outer, heightAt, params = FAR_PARAMS, uvRect = outer, select = null }) {
  const xs = axisLines(outer.minX, outer.maxX, inner.minX, inner.maxX, params);
  const zs = axisLines(outer.minZ, outer.maxZ, inner.minZ, inner.maxZ, params);
  const inside = (ix, iz) => xs[ix] >= inner.minX - 1e-6 && xs[ix + 1] <= inner.maxX + 1e-6 && zs[iz] >= inner.minZ - 1e-6 && zs[iz + 1] <= inner.maxZ + 1e-6;
  const ids = new Map();
  const positions = [];
  const uvs = [];
  const vertex = (ix, iz) => {
    const key = ix * (zs.length + 1) + iz;
    let id = ids.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      ids.set(key, id);
      const x = xs[ix];
      const z = zs[iz];
      positions.push(x, heightAt(x, z), z);
      uvs.push((x - uvRect.minX) / (uvRect.maxX - uvRect.minX), (z - uvRect.minZ) / (uvRect.maxZ - uvRect.minZ));
    }
    return id;
  };
  const index = [];
  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iz = 0; iz < zs.length - 1; iz++) {
      if (inside(ix, iz) || (select && !select((xs[ix] + xs[ix + 1]) / 2, (zs[iz] + zs[iz + 1]) / 2))) continue;
      const a = vertex(ix, iz);
      const b = vertex(ix, iz + 1);
      const c = vertex(ix + 1, iz);
      const d = vertex(ix + 1, iz + 1);
      index.push(a, b, c, c, b, d);
    }
  }
  return { xs, zs, positions, uvs, index };
}

// --- The painted ground ---

const HEDGE = [0.15, 0.22, 0.1];
const WOOD = [0.1, 0.18, 0.09];
const MOOR = [0.4, 0.4, 0.26];
const HAZE = [0.56, 0.67, 0.79];
export const ROAD_GREY = [0.34, 0.35, 0.36];
export const WATER = [0.27, 0.36, 0.4];

const corner = (i, j, cell) => {
  // The patchwork's own warp (patchwork.js patchAt), inverted once, so a field here is the field the skirt has beside it.
  const x0 = i * cell;
  const z0 = j * cell;
  let x = x0 - 14 * Math.sin(z0 * 0.017);
  const z = z0 - 14 * Math.sin(x * 0.019);
  x = x0 - 14 * Math.sin(z * 0.017);
  return [x, z];
};

/**
 * What to paint over the ring: `fields` (each four corners, a colour, whether it is `wood` or open `moor`), the `hedges` between them (a line each,
 * `wall` where it runs on the hill), and the `trees` along the hedges ([x, z, radius]). Fields beyond `joinFrom` m from the ring's start are joined
 * to a neighbour now and then (the hedge left out), so they come in different sizes, and fade toward the haze with distance.
 */
export function farFieldPlan({ outer, inner, heightAt, params = FAR_PARAMS, land = null, joinFrom = 450 }) {
  const cell = params.cell;
  const i0 = Math.floor(outer.minX / cell) - 1;
  const i1 = Math.ceil(outer.maxX / cell) + 1;
  const j0 = Math.floor(outer.minZ / cell) - 1;
  const j1 = Math.ceil(outer.maxZ / cell) + 1;
  const floor = heightAt.floor;
  const W = i1 - i0;
  const H = j1 - j0;
  const at = (i, j) => (i - i0) * H + (j - j0);
  const cells = new Array(W * H);
  for (let i = i0; i < i1; i++) {
    for (let j = j0; j < j1; j++) {
      const c = [corner(i, j, cell), corner(i + 1, j, cell), corner(i + 1, j + 1, cell), corner(i, j + 1, cell)];
      const cx = (c[0][0] + c[2][0]) / 2;
      const cz = (c[0][1] + c[2][1]) / 2;
      const d = outsideBy(inner, cx, cz);
      const up = heightAt(cx, cz) - floor;
      const base = PATCH_COLORS[Math.floor(patchAt(cx, cz).id * PATCH_COLORS.length)];
      const moor = smooth(85, 120, up);
      const wood = d > 120 && up < 90 && hash2(i * 3 + 11, j * 5 + 2) > 0.86;
      const haze = 0.4 * smooth(150, 3400, d);
      let col = [0, 1, 2].map((k) => mix(base[k], MOOR[k] * (0.9 + 0.2 * hash2(i, j)), moor));
      if (wood) col = WOOD;
      col = col.map((v, k) => mix(v, HAZE[k], haze));
      cells[at(i, j)] = { i, j, corners: c, color: col, wood, moor: moor > 0.5, d, cx, cz, out: c.some(([x, z]) => outsideBy(inner, x, z) > 0) };
    }
  }
  const open = (i, j, axis) => cells[at(i, j)].d > joinFrom && !cells[at(i, j)].wood && hash2(i * 7 + axis, j * 13 + 5 * axis) < 0.38;
  // Fields joined along x, then along z, take the first one's colour.
  for (let i = i0; i < i1 - 1; i++) for (let j = j0; j < j1; j++) if (open(i, j, 0) && !cells[at(i + 1, j)].wood) cells[at(i + 1, j)].color = cells[at(i, j)].color;
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1 - 1; j++) if (open(i, j, 1) && !cells[at(i, j + 1)].wood) cells[at(i, j + 1)].color = cells[at(i, j)].color;
  const hedges = [];
  const trees = [];
  const addEdge = (a, b, c, i, j, axis) => {
    // The cell's north side (axis 1) is the south side of the one above it, its west side (axis 0) the east side of the one before.
    if (axis === 0 ? i > i0 && open(i - 1, j, 0) : j > j0 && open(i, j - 1, 1)) return;
    const wall = c.moor;
    if (wall && hash2(i + axis * 5, j + 9) > 0.4) return;
    hedges.push({ a, b, wall });
    if (wall || c.d < 60) return;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(len / 42);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.3 + 0.5 * hash2(i * 17 + k, j * 19 + axis)) / n;
      trees.push([mix(a[0], b[0], t), mix(a[1], b[1], t), 3 + 3 * hash2(k + i, j - k)]);
    }
  };
  for (let i = i0; i < i1; i++) {
    for (let j = j0; j < j1; j++) {
      const c = cells[at(i, j)];
      if (c.out) {
        addEdge(c.corners[0], c.corners[1], c, i, j, 1); // the cell's north side
        addEdge(c.corners[0], c.corners[3], c, i, j, 0); // and its west
      }
    }
  }
  const fields = cells.filter((c) => c.out).map(({ corners, color, wood, moor }) => ({ corners, color, wood, moor }));
  return { fields, hedges, trees };
}

// --- Roads, the river and what stands along them ---

const plan = ([x, z]) => [x - PLAN_ORIGIN[0], z - PLAN_ORIGIN[1]];

/** The lane on south towards Haddon and the A-road north and south past where the game stops drawing them, game metres. */
export const FAR_ROADS = [
  { id: 'lane', halfWidth: 4, points: [[905, 970], [905, 1060], [915, 1300], [960, 1700], [1060, 2100], [1200, 2400], [1290, 2560]].map(plan) },
  { id: 'aRoadSouth', halfWidth: 5, points: [[1281, 1120], [1275, 1500], [1290, 2000], [1310, 2600], [1360, 3300], [1420, 4300], [1480, 5200]].map(plan) },
  { id: 'aRoadNorth', halfWidth: 5, points: [[1330, -215], [1345, -400], [1370, -800], [1400, -1300], [1430, -2000], [1450, -3000], [1480, -4300]].map(plan) },
];

/** The river on the valley floor from the A-road's far side, down the valley to the south-east. */
export const FAR_RIVER = { halfWidth: 6, points: [[1300, 676], [1400, 690], [1560, 780], [1760, 1050], [2000, 1500], [2250, 2200], [2450, 3000], [2600, 4000]].map(plan) };

/** A smooth path through `points` (Catmull-Rom), as points about `step` m apart. */
export function smoothPath(points, step = 30) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(1, Math.round(len / step));
    for (let k = 0; k < m; k++) {
      const t = k / m;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[n - 1]);
  return out;
}

/** `path` with its segments cut to `step` m or less wherever `near(x, z)` says so, where the ground it lies on is finely made. */
export function densify(path, step, near) {
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) ? Math.ceil(len / step) : 1;
    for (let k = 1; k <= n; k++) out.push([mix(a[0], b[0], k / n), mix(a[1], b[1], k / n)]);
  }
  return out;
}

/** A ribbon `halfWidth` m either side of a path, lifted `lift` m, as triangles: `positions` and `index`. */
export function ribbon(path, halfWidth, heightAt, lift = 0.3) {
  const positions = [];
  const index = [];
  path.forEach((p, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const nz = (b[0] - a[0]) / len;
    for (const side of [-1, 1]) {
      const x = p[0] + nx * halfWidth * side;
      const z = p[1] + nz * halfWidth * side;
      positions.push(x, heightAt(x, z) + lift, z);
    }
    if (i > 0) {
      const k = i * 2;
      index.push(k - 2, k - 1, k, k, k - 1, k + 1);
    }
  });
  return { positions, index };
}

/** Tree blocks along both banks of the river on the valley floor ([x, z, halfWidth, height]), every `gap` m with some left out. */
export function bankTrees(path, gap = 16, offset = 9) {
  const out = [];
  let run = 0;
  path.forEach((p, i) => {
    if (i === 0) return;
    const prev = path[i - 1];
    const len = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    run += len;
    if (run < gap) return;
    run = 0;
    const nx = -(p[1] - prev[1]) / (len || 1);
    const nz = (p[0] - prev[0]) / (len || 1);
    for (const side of [-1, 1]) {
      const h = hash2(i * 3 + side, 41);
      if (h < 0.18) continue;
      out.push([p[0] + nx * (offset + 5 * h) * side, p[1] + nz * (offset + 5 * h) * side, 1.5 + 1.5 * h, 6 + 4 * hash2(i, side + 3)]);
    }
  });
  return out;
}

// --- Farms ---

const ROOFS = [0x6f6c68, 0x8f8d88, 0x7b6f66, 0x9c9b97, 0x7a5a48];
const WALLS = [0xb9b3a4, 0x9a948a, 0xc6c0b0, 0x8a8478];

/**
 * Farm clusters out in the far land: one at most in each 520 m square, away from the map and the roads and the river and on ground that is not steep,
 * each a house, a barn or two and a few trees, as boxes with gabled roofs. Returns the shapes `buildFarVersion` takes, and where the farms are.
 */
export function farClusters({ inner, outer, heightAt, keepClear = () => false }) {
  const SQUARE = 520;
  const buildings = [];
  const walls = [];
  const sites = [];
  const level = (x, z, r) => Math.max(...[[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => heightAt(x + dx, z + dz))) - Math.min(...[[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => heightAt(x + dx, z + dz)));
  const floor = heightAt.floor;
  for (let ci = Math.floor(outer.minX / SQUARE); ci < Math.ceil(outer.maxX / SQUARE); ci++) {
    for (let cj = Math.floor(outer.minZ / SQUARE); cj < Math.ceil(outer.maxZ / SQUARE); cj++) {
      if (hash2(ci * 29 + 3, cj * 31 + 8) > 0.55) continue;
      const x = (ci + 0.15 + 0.7 * hash2(ci, cj * 3 + 1)) * SQUARE;
      const z = (cj + 0.15 + 0.7 * hash2(ci * 3 + 2, cj)) * SQUARE;
      if (outsideBy(inner, x, z) < 120 || x < outer.minX + 150 || x > outer.maxX - 150 || z < outer.minZ + 150 || z > outer.maxZ - 150) continue;
      if (keepClear(x, z) || level(x, z, 45) > 9 || heightAt(x, z) - floor > 95) continue;
      sites.push([x, z]);
      const turn = hash2(ci + 5, cj + 7);
      const along = Math.cos(turn * 3.14) > 0; // which way the ridges run: along x, as buildings only gable that way
      const parts = [
        [0, 0, 7.5, 4.5, 5, 7.4, 0],
        [18, -5, 11, 6.5, 5.5, 8.4, 1],
        ...(hash2(ci * 5, cj * 7) > 0.4 ? [[-16, 8, 8, 5, 4.2, 6.6, 1]] : []),
      ];
      parts.forEach(([dx, dz, hx, hz, wallHeight, ridge, barn], k) => {
        const px = x + (along ? dx : dz);
        const pz = z + (along ? dz : dx);
        const y = heightAt(px, pz);
        buildings.push({
          x: px, z: pz, y, halfX: along ? hx : hz, halfZ: along ? hz : hx, wallHeight, ridge,
          wall: WALLS[Math.floor(hash2(ci + k, cj) * WALLS.length)], roof: barn ? ROOFS[1 + Math.floor(hash2(ci, cj + k) * 3)] : ROOFS[Math.floor(hash2(ci + 3, cj + k) * ROOFS.length)],
        });
      });
      for (let k = 0; k < 5; k++) {
        const a = hash2(ci * 11 + k, cj) * 6.28;
        const r = 24 + 16 * hash2(ci, cj * 11 + k);
        const tx = x + Math.cos(a) * r;
        const tz = z + Math.sin(a) * r;
        walls.push({ x: tx, z: tz, hx: 2 + 1.5 * hash2(k, ci), hz: 2 + 1.5 * hash2(k, cj), y: heightAt(tx, tz), height: 6 + 4 * hash2(ci + k, cj), color: 0x3b5a36 });
      }
    }
  }
  return { shapes: { buildings, walls }, sites };
}
