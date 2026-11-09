// The worn ground, kept in tiles that exist only where a wheel has worn something (or frost has been thawed). Each tile is a small
// GroundWear (groundWear.js, which does the wearing, the bogs and the thaw) over a 64 m square plus a margin of two cells all round, so a
// track that crosses a tile's edge reads the same on both sides. Near the farm the grid is the fine one the game has always had (2 m); on the
// ground beyond it, a tile has a grid four times as coarse. A tile with nothing worn or thawed is let go, so a farm seven times the size
// costs only what has been ridden over. The ground shader reads an atlas of the tiles that exist through a small table of where each is.
// Pure logic; the world feeds it wheels and the weather's wetness, the terrain shader draws `atlas` and `index`.

import { GroundWear, DEFAULT_WEAR_PARAMS } from './groundWear.js';

export const TILE_CELLS = 32; // fine cells across a tile's core (64 m at 2 m a cell)
export const TILE_MARGIN = 2; // cells of the next tile's ground that each tile keeps as well
export const FAR_RATIO = 4; // how many times coarser the grid is beyond the farm
export const SLOT = TILE_CELLS + 2 * TILE_MARGIN; // texels a tile takes in the atlas, margin included
export const ATLAS_SLOTS = 24; // the most tiles across the atlas (576 drawn at once); a smaller ground has a smaller atlas, one slot for each of its tiles

const BYTES_PER_CELL = 20; // wear, soak, lane, thaw (floats) and one texel

export class WearTiles {
  /**
   * @param {object} o
   * @param {object} [o.bounds]  { minX, maxX, minZ, maxZ }: the farm the fine grid covers ...
   * @param {object} [o.half]    ... or metres from the middle that it covers each way.
   * @param {object} [o.ground]  { minX, maxX, minZ, maxZ }: all the ground, which can be worn too (coarsely, beyond the fine grid).
   * @param {number} [o.cell]    Metres between fine grid points.
   * @param {Function} [o.exempt] (x, z) => boolean, ground that never wears.
   * @param {Function} [o.soak]   (x, z) => 0..1, how much of the wet the ground holds.
   * @param {Function} [o.lane]   (x, z) => 0..1, how much of the ground is the green lane.
   */
  constructor({ bounds, half, ground = null, cell = 2, exempt = () => false, soak = null, lane = null, params = { ...DEFAULT_WEAR_PARAMS } }) {
    this.p = params;
    this.cell = cell;
    this.farCell = cell * FAR_RATIO;
    this.exempt = exempt;
    this.soak = soak;
    this.lane = lane;
    const b = bounds ?? { minX: -half, maxX: half, minZ: -half, maxZ: half };
    // The fine grid's lattice, as GroundWear lays it (its points sit half a cell in from the lattice's lines).
    this.nx = Math.max(2, Math.ceil((b.maxX - b.minX) / cell));
    this.nz = Math.max(2, Math.ceil((b.maxZ - b.minZ) / cell));
    this.minX = (b.minX + b.maxX) / 2 - (this.nx * cell) / 2;
    this.minZ = (b.minZ + b.maxZ) / 2 - (this.nz * cell) / 2;
    this.tileSize = cell * TILE_CELLS;
    // The tiles reach over all the ground and the fine grid, whichever is bigger.
    const lo = { x: Math.min(this.minX, ground?.minX ?? Infinity), z: Math.min(this.minZ, ground?.minZ ?? Infinity) };
    const hi = { x: Math.max(this.minX + this.nx * cell, ground?.maxX ?? -Infinity), z: Math.max(this.minZ + this.nz * cell, ground?.maxZ ?? -Infinity) };
    this.tx0 = Math.floor((lo.x - this.minX) / this.tileSize);
    this.tz0 = Math.floor((lo.z - this.minZ) / this.tileSize);
    this.dimX = Math.ceil((hi.x - this.minX) / this.tileSize) - this.tx0;
    this.dimZ = Math.ceil((hi.z - this.minZ) / this.tileSize) - this.tz0;
    this.originX = this.minX + this.tx0 * this.tileSize;
    this.originZ = this.minZ + this.tz0 * this.tileSize;
    this.fineTilesX = Math.ceil(this.nx / TILE_CELLS);
    this.fineTilesZ = Math.ceil(this.nz / TILE_CELLS);
    this.tiles = new Map();
    // For the ground shader: the atlas of the tiles that exist, and where each is in it (r, g the slot plus one; 0 is no tile).
    this.slotsAcross = Math.min(ATLAS_SLOTS, Math.ceil(Math.sqrt(this.dimX * this.dimZ)));
    this.atlasSize = this.slotsAcross * SLOT;
    this.atlas = new Uint8Array(this.atlasSize * this.atlasSize * 4);
    this.index = new Uint8Array(this.dimX * this.dimZ * 4);
    for (let i = 3; i < this.index.length; i += 4) this.index[i] = 255;
    this.slotCount = this.slotsAcross * this.slotsAcross;
    this.freeSlots = Array.from({ length: this.slotCount }, (_, i) => this.slotCount - 1 - i);
    this.packed = false;
    // The green lane's points on the fine lattice: [ix, iz] for each, found once.
    this.lanePoints = [];
    if (lane) {
      for (let ix = 0; ix < this.nx; ix++) {
        for (let iz = 0; iz < this.nz; iz++) {
          if (lane(this.minX + (ix + 0.5) * cell, this.minZ + (iz + 0.5) * cell) >= 0.5) this.lanePoints.push([ix, iz]);
        }
      }
    }
    this.laneIndexes = new Set(this.lanePoints.map(([ix, iz]) => ix * this.nz + iz));
  }

  /** Metres the tiles cover along x and z, from (originX, originZ). */
  get sizeX() {
    return this.dimX * this.tileSize;
  }

  get sizeZ() {
    return this.dimZ * this.tileSize;
  }

  #isFine(tx, tz) {
    return tx >= 0 && tz >= 0 && tx < this.fineTilesX && tz < this.fineTilesZ;
  }

  #inRange(tx, tz) {
    return tx >= this.tx0 && tz >= this.tz0 && tx < this.tx0 + this.dimX && tz < this.tz0 + this.dimZ;
  }

  /** Where the tile's slot is written in `index`: a texel a tile, a row for each z, as the shader reads it. */
  #indexAt(t) {
    return ((t.tz - this.tz0) * this.dimX + (t.tx - this.tx0)) * 4;
  }

  #key(tx, tz) {
    return (tx - this.tx0) * this.dimZ + (tz - this.tz0);
  }

  #tileIndexOf(x, z) {
    return [Math.floor((x - this.minX) / this.tileSize), Math.floor((z - this.minZ) / this.tileSize)];
  }

  /** The tile that has (x, z) in its core, if it exists. */
  #find(x, z) {
    const [tx, tz] = this.#tileIndexOf(x, z);
    return this.#inRange(tx, tz) ? this.tiles.get(this.#key(tx, tz)) ?? null : null;
  }

  #get(tx, tz, create) {
    if (!this.#inRange(tx, tz)) return null;
    const key = this.#key(tx, tz);
    let t = this.tiles.get(key);
    if (!t && create) {
      const far = !this.#isFine(tx, tz);
      const c = far ? this.farCell : this.cell;
      const minX = this.minX + tx * this.tileSize;
      const minZ = this.minZ + tz * this.tileSize;
      const m = TILE_MARGIN * c;
      const w = new GroundWear({
        bounds: { minX: minX - m, maxX: minX + this.tileSize + m, minZ: minZ - m, maxZ: minZ + this.tileSize + m },
        cell: c, exempt: this.exempt, soak: this.soak, lane: this.lane, params: this.p,
      });
      t = { tx, tz, key, far, cell: c, cells: this.tileSize / c, minX, minZ, w, slot: -1 };
      this.tiles.set(key, t);
    }
    return t ?? null;
  }

  /** Wheels rolling `dist` metres (and spinning at `spin` m/s) at (x, z): wears the ground there, in every tile that holds the points it lands on. */
  trample(x, z, dist, opts = {}) {
    if (this.exempt(x, z)) return;
    const p = this.p;
    const { spin = 0, dt = 0, weight = 1 } = opts;
    if ((Math.max(0, dist) * p.wearRate + Math.max(0, spin) * p.spinRate * dt) * weight <= 0) return;
    const [otx, otz] = this.#tileIndexOf(x, z);
    if (!this.#inRange(otx, otz)) return;
    const far = !this.#isFine(otx, otz);
    const c = far ? this.farCell : this.cell;
    const cells = this.tileSize / c;
    const ix = Math.floor((x - this.minX) / c - 0.5);
    const iz = Math.floor((z - this.minZ) / c - 0.5);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const tx = otx + dx;
        const tz = otz + dz;
        if (!this.#inRange(tx, tz) || this.#isFine(tx, tz) === far) continue;
        const loX = tx * cells - TILE_MARGIN;
        const loZ = tz * cells - TILE_MARGIN;
        // The four points a wheel lands on are ix and ix + 1: this tile holds them if they fall in its core or its margin.
        if (ix + 1 < loX || ix >= loX + cells + 2 * TILE_MARGIN || iz + 1 < loZ || iz >= loZ + cells + 2 * TILE_MARGIN) continue;
        this.#get(tx, tz, true).w.trample(x, z, dist, opts);
      }
    }
  }

  /** Grass grows back, quicker when it's dry; packs the tiles that moved into the atlas and lets go of those with nothing left. */
  update(dt, wet = 0) {
    for (const t of this.tiles.values()) {
      if (t.w.anyWear || t.w.dirty) t.w.update(dt, wet); // a tile that only holds melted frost has nothing to do
      if (t.w.packed) {
        this.#upload(t);
        t.w.packed = false;
        this.packed = true;
      }
      if (t.w.isClear()) this.#drop(t);
    }
  }

  #drop(t) {
    if (t.slot >= 0) {
      this.freeSlots.push(t.slot);
      const o = this.#indexAt(t);
      this.index[o] = this.index[o + 1] = 0;
      this.packed = true;
    }
    this.tiles.delete(t.key);
  }

  /** Copies the tile's texels into its place in the atlas (the coarse ones resampled to the fine tile's texels). */
  #upload(t) {
    if (t.slot < 0) {
      if (!this.freeSlots.length) return; // no room in the atlas: it is worn all the same, and drawn when a slot frees
      t.slot = this.freeSlots.pop();
      const o = this.#indexAt(t);
      this.index[o] = (t.slot % this.slotsAcross) + 1;
      this.index[o + 1] = Math.floor(t.slot / this.slotsAcross) + 1;
    }
    const sx = (t.slot % this.slotsAcross) * SLOT;
    const sy = Math.floor(t.slot / this.slotsAcross) * SLOT;
    const { data, nx, nz } = t.w;
    if (!t.far) {
      for (let r = 0; r < SLOT; r++) this.atlas.set(data.subarray(r * nx * 4, (r * nx + SLOT) * 4), ((sy + r) * this.atlasSize + sx) * 4);
      return;
    }
    const c = t.cell;
    for (let r = 0; r < SLOT; r++) {
      const gz = (r + 0.5 - TILE_MARGIN) * this.cell / c + TILE_MARGIN - 0.5; // this texel's place on the coarse tile's grid
      const z0 = Math.floor(gz);
      const fz = gz - z0;
      for (let k = 0; k < SLOT; k++) {
        const gx = (k + 0.5 - TILE_MARGIN) * this.cell / c + TILE_MARGIN - 0.5;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const o = ((sy + r) * this.atlasSize + sx + k) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const at = (a, b) => data[(Math.min(nz - 1, Math.max(0, b)) * nx + Math.min(nx - 1, Math.max(0, a))) * 4 + ch];
          this.atlas[o + ch] = Math.round(at(x0, z0) * (1 - fx) * (1 - fz) + at(x0 + 1, z0) * fx * (1 - fz) + at(x0, z0 + 1) * (1 - fx) * fz + at(x0 + 1, z0 + 1) * fx * fz);
        }
        this.atlas[o + 3] = 255;
      }
    }
  }

  /** Wear here (bilinear between grid points), 0 where nothing has been worn. */
  wearAt(x, z) {
    return this.#find(x, z)?.w.wearAt(x, z) ?? 0;
  }

  /** 0..1 how much of the frost has melted here. */
  thawAt(x, z) {
    return this.#find(x, z)?.w.thawAt(x, z) ?? 0;
  }

  /** 0..1 how soft (muddy) the ground is from wear alone. */
  softAt(x, z) {
    return this.#find(x, z)?.w.softAt(x, z) ?? 0;
  }

  /** 0..1 how deep a bog the wear has made here, in this wetness. */
  bogAt(x, z, wet = 0) {
    return this.#find(x, z)?.w.bogAt(x, z, wet) ?? 0;
  }

  /** 0..1 how much of the green lane is here (bilinear between fine grid points; 0 off the grid). */
  laneAt(x, z) {
    const t = this.#find(x, z);
    if (t) return t.w.laneAt(x, z);
    if (!this.lane) return 0;
    const gx = (x - this.minX) / this.cell - 0.5;
    const gz = (z - this.minZ) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (a, b) => (a < 0 || b < 0 || a >= this.nx || b >= this.nz ? 0 : this.lane(this.minX + (a + 0.5) * this.cell, this.minZ + (b + 0.5) * this.cell));
    return at(ix, iz) * (1 - fx) * (1 - fz) + at(ix + 1, iz) * fx * (1 - fz) + at(ix, iz + 1) * (1 - fx) * fz + at(ix + 1, iz + 1) * fx * fz;
  }

  /** The bogs wear has made, as {x, z, radius} for the girls to plan round, capped at the worst `max`. */
  hazards(wet = 0, max = 24) {
    const out = [];
    for (const t of this.tiles.values()) {
      const inCore = (x, z) => x >= t.minX && x < t.minX + this.tileSize && z >= t.minZ && z < t.minZ + this.tileSize;
      out.push(...t.w.hazards(wet, max, inCore));
    }
    return out.sort((a, b) => b.depth - a.depth).slice(0, max);
  }

  /** The lane's average wear, 0 with no lane. */
  laneMean() {
    if (!this.lanePoints.length) return 0;
    let sum = 0;
    for (const [ix, iz] of this.lanePoints) {
      const t = this.#get(Math.floor(ix / TILE_CELLS), Math.floor(iz / TILE_CELLS), false);
      if (t) sum += this.#pointOf(t, ix, iz);
    }
    return sum / this.lanePoints.length;
  }

  /** Sets every lane point's wear to `v` (0 puts the lane right, 1 ruts it to a bog): for the debug panel. */
  setLane(v) {
    const w = clamp01(v);
    for (const [ix, iz] of this.lanePoints) this.#setPoint(false, ix, iz, w);
  }

  #pointOf(t, gix, giz) {
    const lx = gix - (t.tx * t.cells - TILE_MARGIN);
    const lz = giz - (t.tz * t.cells - TILE_MARGIN);
    return t.w.wear[lx * t.w.nz + lz];
  }

  /** Puts `v` at one lattice point of the fine or the coarse grid in every tile that holds it; makes the tiles only if there is wear to put. */
  #setPoint(far, gix, giz, v) {
    const cells = this.tileSize / (far ? this.farCell : this.cell);
    const otx = Math.floor(gix / cells);
    const otz = Math.floor(giz / cells);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const tx = otx + dx;
        const tz = otz + dz;
        if (!this.#inRange(tx, tz) || this.#isFine(tx, tz) === far) continue;
        const lx = gix - (tx * cells - TILE_MARGIN);
        const lz = giz - (tz * cells - TILE_MARGIN);
        if (lx < 0 || lz < 0 || lx >= cells + 2 * TILE_MARGIN || lz >= cells + 2 * TILE_MARGIN) continue;
        const t = this.#get(tx, tz, v > 0);
        if (!t) continue;
        t.w.wear[lx * t.w.nz + lz] = v;
        t.w.dirty = true;
        if (v > 0) t.w.anyWear = true;
      }
    }
  }

  /**
   * What the farm save keeps of the wear: the tiles that have any, each as [tx, tz, index, 0..255, ...] for its core points that are worn at all
   * (index is column * cells + row inside the tile). `lane` keeps only the green lane's points. Frost thaw is never kept.
   */
  toJSON({ lane = false } = {}) {
    const tiles = [];
    for (const t of this.tiles.values()) {
      const out = [t.tx, t.tz];
      const nzT = t.w.nz;
      for (let cx = 0; cx < t.cells; cx++) {
        for (let cz = 0; cz < t.cells; cz++) {
          const i = (cx + TILE_MARGIN) * nzT + cz + TILE_MARGIN;
          if (lane && !(t.w.lanes[i] >= 0.5)) continue;
          const q = Math.round(t.w.wear[i] * 255);
          if (q > 0) out.push(cx * t.cells + cz, q);
        }
      }
      if (out.length > 2) tiles.push(out);
    }
    return { tiles };
  }

  /** Puts saved wear back, `kept` of it (the rest dried overnight); also takes the lane as older saves kept it. Anything that is not in these tiles is ignored. */
  fromJSON(saved, kept = 1) {
    if (Array.isArray(saved)) return this.#laneFromPairs(saved, kept);
    if (!Array.isArray(saved?.tiles)) return;
    const k = clamp01(kept);
    for (const entry of saved.tiles) {
      if (!Array.isArray(entry) || entry.length < 4) continue;
      const [tx, tz] = entry;
      if (!Number.isInteger(tx) || !Number.isInteger(tz) || !this.#inRange(tx, tz)) continue;
      const far = !this.#isFine(tx, tz);
      const cells = this.tileSize / (far ? this.farCell : this.cell);
      for (let n = 2; n + 1 < entry.length; n += 2) {
        const i = entry[n];
        const q = entry[n + 1];
        if (!Number.isInteger(i) || i < 0 || i >= cells * cells || !Number.isFinite(q)) continue;
        this.#setPoint(far, tx * cells + Math.floor(i / cells), tz * cells + (i % cells), clamp01(q / 255) * k);
      }
    }
  }

  /** A lane saved before the tiles (flat [index, 0..255] pairs over the fine lattice): `kept` of it. */
  #laneFromPairs(pairs, kept) {
    for (let n = 0; n + 1 < pairs.length; n += 2) {
      const i = pairs[n];
      const q = pairs[n + 1];
      if (!Number.isInteger(i) || !this.laneIndexes.has(i) || !Number.isFinite(q)) continue;
      this.#setPoint(false, Math.floor(i / this.nz), i % this.nz, clamp01(q / 255) * clamp01(kept));
    }
  }

  /** What the tiles hold now, for the console and the Tune tab. */
  stats() {
    let far = 0;
    let cells = 0;
    for (const t of this.tiles.values()) {
      if (t.far) far++;
      cells += t.w.nx * t.w.nz;
    }
    return { tiles: this.tiles.size, far, slots: this.slotCount - this.freeSlots.length, of: this.slotCount, bytes: cells * BYTES_PER_CELL };
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
