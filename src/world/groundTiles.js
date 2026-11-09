// The ground in tiles (#665). Pure: no Three.js, no Rapier. `terrain.js` draws what this works out.
//
// The ground is a rectangle (`layout.ground`), sampled once at 1 m from terrainHeight.js into a GroundGrid. The same grid is the physics
// heightfield, so a wheel is always on the ground the world says is there, and the drawn tiles read it instead of asking the world again.
// The drawn ground is cut into tiles of about 64 m, each drawn as coarsely as its distance allows: every metre close to you, every 2, 4 or 8
// further off. A tile whose neighbour is coarser snaps its edge to the neighbour's line, so tiles meet with no crack and no skirt.

export const TILE_SIZE = 64;
/** The metres between a tile's vertices, finest first. Each is a whole number of grid squares, so a coarse vertex is always a grid sample. */
export const LOD_STEPS = [1, 2, 4, 8];

export const DEFAULT_GROUND_PARAMS = {
  near: 150, // metres out to which the ground is drawn every metre
  mid: 400, // metres out to which it is drawn every 2 m; beyond, every 4 m
  far: 800, // metres beyond which it is drawn every 8 m
  hysteresis: 0.1, // how far past a distance (as a fraction of it) a tile must be before it changes detail, so it doesn't flicker on the line
  primeRadius: 400, // metres round where you start that are built behind the start screen
  buildMs: 2, // milliseconds a frame spent building tiles in play
  paintNear: 200, // metres out to which the ground is painted at full size, a tile at a time (groundPaint.js); beyond, the coarse overview shows
  paintPrime: 100, // metres round where you start that are painted behind the start screen
  paintMs: 2, // milliseconds a frame spent painting tiles in play
};

export const GROUND_PARAM_RANGES = {
  near: [60, 400, 10],
  mid: [150, 800, 10],
  far: [300, 2000, 50],
  hysteresis: [0, 0.4, 0.01],
  primeRadius: [100, 1500, 50],
  buildMs: [0.5, 6, 0.1],
  paintNear: [60, 600, 10],
  paintPrime: [0, 400, 10],
  paintMs: [0.5, 6, 0.1],
};

/**
 * The ground's rectangle in whole metres, from `layout.ground` ({ minX, maxX, minZ, maxZ }), rounded outward. It need not be centred on anything.
 */
export function groundBounds(layout) {
  const g = layout.ground;
  return { minX: Math.floor(g.minX), maxX: Math.ceil(g.maxX), minZ: Math.floor(g.minZ), maxZ: Math.ceil(g.maxZ) };
}

/** The height of the ground at every metre over `bounds`, from `heightAt(x, z)`. Index `ix * (nz + 1) + iz`, which is Rapier's heightfield order. */
export class GroundGrid {
  constructor(bounds, heightAt) {
    this.bounds = bounds;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.nx = bounds.maxX - bounds.minX; // squares along x
    this.nz = bounds.maxZ - bounds.minZ;
    this.stride = this.nz + 1;
    this.heights = new Float32Array((this.nx + 1) * this.stride);
    for (let ix = 0; ix <= this.nx; ix++) {
      const x = this.minX + ix;
      for (let iz = 0; iz <= this.nz; iz++) this.heights[ix * this.stride + iz] = heightAt(x, this.minZ + iz);
    }
  }

  /** The sample at grid point (ix, iz), the nearest one on the edge if it is off the grid. */
  at(ix, iz) {
    const cx = ix < 0 ? 0 : ix > this.nx ? this.nx : ix;
    const cz = iz < 0 ? 0 : iz > this.nz ? this.nz : iz;
    return this.heights[cx * this.stride + cz];
  }

  /**
   * The height of the 1 m triangles themselves (each square split along its b-c diagonal, as the finest tile's indices do), or NaN off the grid.
   * For things that must sit exactly on the drawn ground, like wheel ruts and mud specks.
   */
  surfaceAt(x, z) {
    const gx = x - this.minX;
    const gz = z - this.minZ;
    if (!(gx >= 0 && gz >= 0 && gx <= this.nx && gz <= this.nz)) return NaN;
    const ix = Math.min(Math.floor(gx), this.nx - 1);
    const iz = Math.min(Math.floor(gz), this.nz - 1);
    const fx = gx - ix;
    const fz = gz - iz;
    const a = this.at(ix, iz);
    const b = this.at(ix, iz + 1);
    const c = this.at(ix + 1, iz);
    const d = this.at(ix + 1, iz + 1);
    if (fx + fz <= 1) return a + (c - a) * fx + (b - a) * fz;
    return d + (b - d) * (1 - fx) + (c - d) * (1 - fz);
  }
}

/**
 * The ground cut into tiles of `size` metres from the corner, the last in each row and column whatever is left. Each has its `id`, its rectangle,
 * its place in the grid of tiles (`tx`, `tz`), `maxStep` (the coarsest step that is a whole number of squares along both its sides) and its centre.
 */
export function cutTiles(bounds, size = TILE_SIZE) {
  const cols = Math.ceil((bounds.maxX - bounds.minX) / size);
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / size);
  const tiles = [];
  for (let tx = 0; tx < cols; tx++) {
    for (let tz = 0; tz < rows; tz++) {
      const minX = bounds.minX + tx * size;
      const minZ = bounds.minZ + tz * size;
      const maxX = Math.min(bounds.maxX, minX + size);
      const maxZ = Math.min(bounds.maxZ, minZ + size);
      const maxStep = [...LOD_STEPS].reverse().find((s) => (maxX - minX) % s === 0 && (maxZ - minZ) % s === 0) ?? 1;
      tiles.push({ id: tx * rows + tz, tx, tz, minX, maxX, minZ, maxZ, maxStep, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 });
    }
  }
  return { tiles, cols, rows };
}

/** Metres from (x, z) to the nearest point of the tile's rectangle, 0 inside it. */
export function tileDistance(tile, x, z) {
  const dx = Math.max(tile.minX - x, 0, x - tile.maxX);
  const dz = Math.max(tile.minZ - z, 0, z - tile.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * The step a tile `dist` metres away is drawn at. `prev` is the step it was last drawn at: it keeps that until `dist` is `hysteresis` of the
 * boundary past it. Never coarser than `maxStep`.
 */
export function stepFor(dist, prev, params, maxStep = LOD_STEPS[LOD_STEPS.length - 1]) {
  const edges = [params.near, params.mid, params.far]; // the distance at which each step gives way to the next
  const h = params.hysteresis;
  let level = prev === undefined ? 0 : Math.max(0, LOD_STEPS.indexOf(prev));
  if (prev === undefined) while (level < edges.length && dist >= edges[level]) level++;
  else {
    while (level < edges.length && dist >= edges[level] * (1 + h)) level++;
    while (level > 0 && dist < edges[level - 1] * (1 - h)) level--;
  }
  return Math.min(LOD_STEPS[level], maxStep);
}

/** The pieces of a tile's mesh, in the order Rapier and the Three.js meshes use: vertex `ix * (nz + 1) + iz`, two triangles a square. */
const indexCache = new Map();
export function tileIndices(nx, nz) {
  const key = `${nx}x${nz}`;
  let index = indexCache.get(key);
  if (!index) {
    const n = nz + 1;
    index = new Uint16Array(nx * nz * 6);
    let k = 0;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const a = ix * n + iz;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        index.set([a, b, c, c, b, d], k);
        k += 6;
      }
    }
    indexCache.set(key, index);
  }
  return index;
}

/**
 * The vertices of `tile` every `step` metres. `edges` is the step of the tile on each side ([minX, maxX, minZ, maxZ]); where that is coarser than
 * `step`, the tile's edge vertices lie on the straight line between the neighbour's, so the two meet exactly. `tint(x, z)` gives a grey to
 * multiply the ground by, and `uvOf(x, z)`, if given, the [u, v] of a texture (the ground's own are worked out in its shader from where it is, so
 * the terrain gives none). Normals are the slope of the grid at this tile's own step, so tiles at the same step shade the same across their seam.
 * @returns {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array | null, colors: Float32Array, index: Uint16Array, nx: number, nz: number }}
 */
export function tileMeshData(grid, tile, step, edges, tint, uvOf = null) {
  const nx = (tile.maxX - tile.minX) / step;
  const nz = (tile.maxZ - tile.minZ) / step;
  const n = nz + 1;
  const count = (nx + 1) * n;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = uvOf ? new Float32Array(count * 2) : null;
  const colors = new Float32Array(count * 3);
  const gx0 = tile.minX - grid.minX;
  const gz0 = tile.minZ - grid.minZ;
  for (let ix = 0; ix <= nx; ix++) {
    for (let iz = 0; iz <= nz; iz++) {
      const i = ix * n + iz;
      const gx = gx0 + ix * step; // grid coordinates
      const gz = gz0 + iz * step;
      const x = tile.minX + ix * step;
      const z = tile.minZ + iz * step;
      let y = grid.at(gx, gz);
      // On an edge shared with a coarser tile, lie on the line between its two vertices either side.
      // (A corner is a tile corner, which every step divides, so it is on the neighbour's line already.)
      const onX = ix === 0 ? edges[0] : ix === nx ? edges[1] : 0;
      const onZ = iz === 0 ? edges[2] : iz === nz ? edges[3] : 0;
      if (onX > step && iz > 0 && iz < nz) y = lerpAlong(grid, gx, gz, 'z', iz * step, onX, gz0);
      else if (onZ > step && ix > 0 && ix < nx) y = lerpAlong(grid, gx, gz, 'x', ix * step, onZ, gx0);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      // The slope, from the grid a step either side.
      const sx = grid.at(gx + step, gz) - grid.at(gx - step, gz);
      const sz = grid.at(gx, gz + step) - grid.at(gx, gz - step);
      const len = Math.hypot(sx, 2 * step, sz);
      normals[i * 3] = -sx / len;
      normals[i * 3 + 1] = (2 * step) / len;
      normals[i * 3 + 2] = -sz / len;
      if (uvs) {
        const [u, v] = uvOf(x, z);
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
      }
      const t = tint(x, z);
      colors[i * 3] = t;
      colors[i * 3 + 1] = t;
      colors[i * 3 + 2] = t;
    }
  }
  return { positions, normals, uvs, colors, index: tileIndices(nx, nz), nx, nz };
}

/** The height on the line between the grid samples `coarse` metres apart that enclose position `along` (metres from the tile's corner) on an edge. */
function lerpAlong(grid, gx, gz, axis, along, coarse, origin) {
  const lo = Math.floor(along / coarse) * coarse;
  const t = (along - lo) / coarse;
  const base = origin + lo;
  const a = axis === 'z' ? grid.at(gx, base) : grid.at(base, gz);
  const b = axis === 'z' ? grid.at(gx, base + coarse) : grid.at(base + coarse, gz);
  return a + (b - a) * t;
}

/**
 * Which tiles are drawn, and how finely. Works out each tile's step from where you are, and builds (through `build(tile, step, edges)`) what is
 * not drawn yet or is drawn wrongly, the nearest first, within a time budget a frame. `drop(tile)` is told when a tile is let go.
 */
export class TileSet {
  constructor(tiles, cols, rows, params, { build, now = () => performance.now() }) {
    this.tiles = tiles;
    this.cols = cols;
    this.rows = rows;
    this.params = params;
    this.build = build;
    this.now = now;
    this.last = new Map(); // tile id -> the step last chosen for it, for the hysteresis
    this.built = new Map(); // tile id -> { step, edges } as drawn now
    this.lastBuiltAt = null;
    this.builds = 0;
    this.buildMs = 0;
    this.worstBuildMs = 0;
  }

  neighbour(tile, dx, dz) {
    const tx = tile.tx + dx;
    const tz = tile.tz + dz;
    if (tx < 0 || tz < 0 || tx >= this.cols || tz >= this.rows) return null;
    return this.tiles[tx * this.rows + tz];
  }

  /** What each tile should be drawn as when you are at (x, z): { step, edges } by tile id. */
  wanted(x, z) {
    const steps = new Map();
    for (const t of this.tiles) {
      const step = stepFor(tileDistance(t, x, z), this.last.get(t.id), this.params, t.maxStep);
      steps.set(t.id, step);
      this.last.set(t.id, step);
    }
    const want = new Map();
    for (const t of this.tiles) {
      const step = steps.get(t.id);
      const side = (dx, dz) => {
        const o = this.neighbour(t, dx, dz);
        return o ? Math.max(step, steps.get(o.id)) : step;
      };
      want.set(t.id, { step, edges: [side(-1, 0), side(1, 0), side(0, -1), side(0, 1)] });
    }
    return want;
  }

  /** The tiles that are not drawn as they should be, nearest first. */
  pending(x, z) {
    const want = this.wanted(x, z);
    const out = [];
    for (const t of this.tiles) {
      const w = want.get(t.id);
      const b = this.built.get(t.id);
      if (!b || b.step !== w.step || b.edges.some((e, i) => e !== w.edges[i])) out.push({ tile: t, want: w, dist: tileDistance(t, x, z), fresh: !b });
    }
    out.sort((a, b) => a.fresh - b.fresh || a.dist - b.dist);
    return out;
  }

  draw(item) {
    const t0 = this.now();
    this.build(item.tile, item.want.step, item.want.edges);
    this.built.set(item.tile.id, { step: item.want.step, edges: [...item.want.edges] });
    const ms = this.now() - t0;
    this.builds++;
    this.buildMs += ms;
    this.worstBuildMs = Math.max(this.worstBuildMs, ms);
  }

  /**
   * Builds, behind the start screen, every tile within `radius` metres of (x, z) and every one drawn at 4 m or 8 m (a few hundred vertices, so
   * the ground is never seen with a hole in it). The finer tiles further off wait for `update`. Returns how many.
   */
  prime(x, z, radius = this.params.primeRadius) {
    let n = 0;
    for (const item of this.pending(x, z)) {
      if (item.dist > radius && item.want.step < 4) continue;
      this.draw(item);
      n++;
    }
    return n;
  }

  /** In play: builds the nearest tile that needs it, and more while the time spent is under `budgetMs`. Returns how many it built. */
  update(x, z, budgetMs = this.params.buildMs) {
    const todo = this.pending(x, z);
    const start = this.now();
    let n = 0;
    for (const item of todo) {
      this.draw(item);
      n++;
      if (this.now() - start >= budgetMs) break;
    }
    this.waiting = todo.length - n;
    return n;
  }

  stats() {
    const bySteps = {};
    for (const b of this.built.values()) bySteps[b.step] = (bySteps[b.step] ?? 0) + 1;
    return { tiles: this.tiles.length, built: this.built.size, waiting: this.waiting ?? 0, builds: this.builds, buildMs: this.buildMs, worstBuildMs: this.worstBuildMs, bySteps };
  }
}
