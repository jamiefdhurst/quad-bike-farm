// The ground changes. Tyres wear the field: each wheel on the move (or spinning) adds wear to a coarse grid, and wear fades again
// slowly, faster in dry spells. Worn ground goes soft (mud: less grip, spray and ruts); worn ground that's wet enough goes on to
// become a bog, a new one where the girls' loops (and yours) keep crossing. Rain swells the bogs and a dry spell shrinks them,
// because a bog is judged on wear and wetness together. Pure logic; the world feeds it wheels, the weather's wetness and a texture.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const DEFAULT_WEAR_PARAMS = {
  wearRate: 0.0025, // wear per metre a wheel rolls on the field: about 25 passes of a quad to soften a strip of grass
  spinRate: 0.012, // extra wear per second per m/s of wheelspin, digging in
  wetWear: 2, // extra wear per metre at full wetness (wet ground cuts up three times as fast)
  recoverRate: 0.0008, // wear lost per second in the dry: a soft patch is back to grass in about ten minutes
  wetRecovery: 0.75, // fraction of that recovery lost at full wetness
  softFrom: 0.3, // wear at which the ground starts to go soft (mud) ...
  softTo: 0.65, // ... and is fully so
  bogFrom: 0.72, // wear x wetness factor at which a bog starts to form ...
  bogTo: 0.95, // ... and is fully formed
  bogDry: 0.7, // the wetness factor on bone dry ground: below bogFrom, so a bog never forms (and shrinks away) in a long dry spell
  bogWetGain: 0.5, // the wetness factor's gain at full wetness: heavy rain means a bog from much less wear
  hazardAt: 0.35, // bog depth above which the girls steer clear of a cell
  thawAt: 0.006, // wear laid down at a spot that thaws its frost for good: about two metres of one tyre rolling over it
  soakGain: 1, // how much wetter ground that holds the wet (a hollow) counts: there, half-wet ground bogs as if soaked
  laneWear: 3, // how many times faster the green lane wears than a field: it is sunk, so everyone rides the same two ruts
  laneRecovery: 0.2, // fraction of the usual recovery the lane gets: its ruts stay for days, not minutes
  laneSoak: 0.6, // how much of the wet the lane holds, as a hollow does: it runs with water, so it bogs sooner than the fields round it
};

export const WEAR_PARAM_RANGES = {
  wearRate: [0, 0.02, 0.0001],
  spinRate: [0, 0.1, 0.001],
  wetWear: [0, 5, 0.1],
  recoverRate: [0, 0.01, 0.0001],
  wetRecovery: [0, 1, 0.01],
  softFrom: [0, 1, 0.01],
  softTo: [0, 1, 0.01],
  bogFrom: [0, 1.2, 0.01],
  bogTo: [0, 1.2, 0.01],
  bogDry: [0, 1, 0.01],
  bogWetGain: [0, 1, 0.01],
  hazardAt: [0, 1, 0.01],
  thawAt: [0.001, 0.1, 0.001],
  soakGain: [0, 3, 0.05],
  laneWear: [1, 10, 0.1],
  laneRecovery: [0, 1, 0.01],
  laneSoak: [0, 1, 0.01],
};

export class GroundWear {
  /**
   * @param {object} o
   * @param {object} [o.bounds]    { minX, maxX, minZ, maxZ }: the ground the grid covers (the farm's fields) ...
   * @param {number} [o.half]      ... or metres from the middle that it covers each way.
   * @param {number} [o.cell]      Metres between grid points (a patch of worn ground is about two of these across).
   * @param {(x:number, z:number) => boolean} [o.exempt]  Ground that never wears (the yard, the drag strip, the barn, the road).
   * @param {(x:number, z:number) => number} [o.soak]  0..1 how much of the wet the ground holds (a hollow): it bogs sooner in the rain.
   * @param {(x:number, z:number) => number} [o.lane]  0..1 how much of the ground here is the green lane: it wears faster, recovers slower and holds the wet.
   */
  constructor({ bounds, half, cell = 2, exempt = () => false, soak = null, lane = null, params = { ...DEFAULT_WEAR_PARAMS } }) {
    this.p = params;
    this.cell = cell;
    const b = bounds ?? { minX: -half, maxX: half, minZ: -half, maxZ: half };
    // The grid is a whole number of cells, a little over the bounds if they don't divide.
    this.nx = Math.max(2, Math.ceil((b.maxX - b.minX) / cell));
    this.nz = Math.max(2, Math.ceil((b.maxZ - b.minZ) / cell));
    this.minX = (b.minX + b.maxX) / 2 - (this.nx * cell) / 2;
    this.minZ = (b.minZ + b.maxZ) / 2 - (this.nz * cell) / 2;
    this.exempt = exempt;
    this.soak = soak;
    // How much of the wet each grid point holds, fixed by the lie of the land.
    this.soaks = new Float32Array(this.nx * this.nz);
    // How much of each grid point is the lane (0 everywhere without one).
    this.lanes = new Float32Array(this.nx * this.nz);
    for (let ix = 0; ix < this.nx; ix++) {
      for (let iz = 0; iz < this.nz; iz++) {
        const i = ix * this.nz + iz;
        const x = this.minX + (ix + 0.5) * cell;
        const z = this.minZ + (iz + 0.5) * cell;
        if (lane) this.lanes[i] = lane(x, z);
        if (soak) this.soaks[i] = soak(x, z);
      }
    }
    this.wear = new Float32Array(this.nx * this.nz); // wear[ix * nz + iz], 0..1; node i sits at min + (i + 0.5) * cell
    // r soft, g bog, for the ground shader: a texture nx wide and nz high, so row iz, column ix, as the shader samples it by (x, z).
    this.data = new Uint8Array(this.nx * this.nz * 4);
    // Frost the tyres have melted (b in the texture), 0..1. Unlike wear it never goes back: frost does not regrow in the same day.
    this.thaw = new Float32Array(this.nx * this.nz);
    this.dirty = false;
    this.packClock = 0;
  }

  /** Metres the grid covers along x and z. */
  get sizeX() {
    return this.nx * this.cell;
  }

  get sizeZ() {
    return this.nz * this.cell;
  }

  /** Wheels rolling `dist` metres (and spinning at `spin` m/s) at (x, z): wears the four grid points round it, by `weight` (1 a quad). */
  trample(x, z, dist, { spin = 0, wet = 0, dt = 0, weight = 1 } = {}) {
    if (this.exempt(x, z)) return;
    const p = this.p;
    const gx = (x - this.minX) / this.cell - 0.5;
    const gz = (z - this.minZ) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const lane = this.laneAt(x, z);
    const add = (Math.max(0, dist) * p.wearRate * (1 + p.wetWear * clamp(wet, 0, 1)) + Math.max(0, spin) * p.spinRate * dt) * weight * (1 + (p.laneWear - 1) * lane);
    if (add <= 0) return;
    // Shared out by bilinear weights, scaled so that reading the ground back at the same spot gives `add` (not a quarter of it between points).
    const k = add / (((1 - fx) ** 2 + fx ** 2) * ((1 - fz) ** 2 + fz ** 2));
    this.#bump(ix, iz, k * (1 - fx) * (1 - fz));
    this.#bump(ix + 1, iz, k * fx * (1 - fz));
    this.#bump(ix, iz + 1, k * (1 - fx) * fz);
    this.#bump(ix + 1, iz + 1, k * fx * fz);
    this.dirty = true;
  }

  #bump(ix, iz, amount) {
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return;
    const i = ix * this.nz + iz;
    this.wear[i] = Math.min(1, this.wear[i] + amount);
    this.thaw[i] = Math.min(1, Math.max(this.thaw[i], this.wear[i] / this.p.thawAt));
  }

  /** Grass grows back, quicker when it's dry. `wet` is 0..1 how wet the ground is; refreshes `data` about twice a second if anything moved. */
  update(dt, wet = 0) {
    const p = this.p;
    const rec = p.recoverRate * (1 - p.wetRecovery * clamp(wet, 0, 1)) * dt;
    if (rec > 0) {
      const w = this.wear;
      const laneRec = rec * p.laneRecovery;
      for (let i = 0; i < w.length; i++) {
        if (w[i] > 0) {
          w[i] = Math.max(0, w[i] - (this.lanes[i] >= 0.5 ? laneRec : rec));
          this.dirty = true;
        }
      }
    }
    this.packClock += dt;
    if (this.dirty && this.packClock >= 0.5) {
      this.packClock = 0;
      this.pack(wet);
    }
  }

  /** Wear here (bilinear between grid points), 0 off the grid. */
  wearAt(x, z) {
    const gx = (x - this.minX) / this.cell - 0.5;
    const gz = (z - this.minZ) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    if (ix < -1 || iz < -1 || ix >= this.nx || iz >= this.nz) return 0;
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (a, b) => (a < 0 || b < 0 || a >= this.nx || b >= this.nz ? 0 : this.wear[a * this.nz + b]);
    return at(ix, iz) * (1 - fx) * (1 - fz) + at(ix + 1, iz) * fx * (1 - fz) + at(ix, iz + 1) * (1 - fx) * fz + at(ix + 1, iz + 1) * fx * fz;
  }

  /** 0..1 how much of the green lane is here (bilinear between grid points; 0 off the grid). */
  laneAt(x, z) {
    const gx = (x - this.minX) / this.cell - 0.5;
    const gz = (z - this.minZ) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (a, b) => (a < 0 || b < 0 || a >= this.nx || b >= this.nz ? 0 : this.lanes[a * this.nz + b]);
    return at(ix, iz) * (1 - fx) * (1 - fz) + at(ix + 1, iz) * fx * (1 - fz) + at(ix, iz + 1) * (1 - fx) * fz + at(ix + 1, iz + 1) * fx * fz;
  }

  /** The lane's average wear, 0 with no lane. */
  laneMean() {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < this.wear.length; i++) {
      if (this.lanes[i] < 0.5) continue;
      sum += this.wear[i];
      n++;
    }
    return n ? sum / n : 0;
  }

  /** Sets every lane grid point's wear to `v` (0 puts the lane right, 1 ruts it to a bog): for the debug panel. */
  setLane(v) {
    for (let i = 0; i < this.wear.length; i++) if (this.lanes[i] >= 0.5) this.wear[i] = clamp(v, 0, 1);
    this.dirty = true;
  }

  /** The lane's wear for the farm save: flat [index, 0..255] pairs for the lane's grid points that are worn at all. */
  laneToJSON() {
    const out = [];
    for (let i = 0; i < this.wear.length; i++) {
      if (this.lanes[i] < 0.5) continue;
      const q = Math.round(this.wear[i] * 255);
      if (q > 0) out.push(i, q);
    }
    return out;
  }

  /** Puts a saved lane back, `kept` of it (the rest dried overnight). Anything not a lane point in this grid is ignored. */
  laneFromJSON(pairs, kept = 1) {
    if (!Array.isArray(pairs)) return;
    for (let k = 0; k + 1 < pairs.length; k += 2) {
      const i = pairs[k];
      const q = pairs[k + 1];
      if (!Number.isInteger(i) || i < 0 || i >= this.wear.length || !(this.lanes[i] >= 0.5) || !Number.isFinite(q)) continue;
      this.wear[i] = clamp(q / 255, 0, 1) * clamp(kept, 0, 1);
    }
    this.dirty = true;
  }

  /** 0..1 how much of the frost has melted here (bilinear between grid points; 0 off the grid). */
  thawAt(x, z) {
    const gx = (x - this.minX) / this.cell - 0.5;
    const gz = (z - this.minZ) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (a, b) => (a < 0 || b < 0 || a >= this.nx || b >= this.nz ? 0 : this.thaw[a * this.nz + b]);
    return at(ix, iz) * (1 - fx) * (1 - fz) + at(ix + 1, iz) * fx * (1 - fz) + at(ix, iz + 1) * (1 - fx) * fz + at(ix + 1, iz + 1) * fx * fz;
  }

  /** 0..1 how soft (muddy) the ground is from wear alone. */
  softAt(x, z) {
    return this.#soft(this.wearAt(x, z));
  }

  /** 0..1 how deep a bog the wear has made here, in this wetness. */
  bogAt(x, z, wet = 0) {
    return this.#bog(this.wearAt(x, z), this.#soaked(wet, Math.max(this.soak ? this.soak(x, z) : 0, this.laneAt(x, z) * this.p.laneSoak)));
  }

  /** The wetness ground that holds `soak` of the wet feels. */
  #soaked(wet, soak) {
    return Math.min(1, clamp(wet, 0, 1) * (1 + this.p.soakGain * soak));
  }

  #soft(w) {
    return smoothstep(this.p.softFrom, this.p.softTo, w);
  }

  #bog(w, wet) {
    const p = this.p;
    return smoothstep(p.bogFrom, p.bogTo, w * (p.bogDry + p.bogWetGain * clamp(wet, 0, 1)));
  }

  /** Fills `data` (r soft, g bog, b thawed) for the ground shader. */
  pack(wet = 0) {
    const { wear: w, nx, nz } = this;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const v = w[ix * nz + iz];
        const o = (iz * nx + ix) * 4;
        this.data[o] = Math.round(this.#soft(v) * 255);
        this.data[o + 1] = Math.round(this.#bog(v, this.#soaked(wet, Math.max(this.soaks[ix * nz + iz], this.lanes[ix * nz + iz] * this.p.laneSoak))) * 255);
        this.data[o + 2] = Math.round(this.thaw[ix * nz + iz] * 255);
        this.data[o + 3] = 255;
      }
    }
    this.dirty = false;
    this.packed = true;
  }

  /** The bogs wear has made, as {x, z, radius} for the girls to plan round, capped at the worst `max`. */
  hazards(wet = 0, max = 24) {
    const out = [];
    const r = this.cell * 1.5;
    for (let ix = 0; ix < this.nx; ix++) {
      for (let iz = 0; iz < this.nz; iz++) {
        const w = this.wear[ix * this.nz + iz];
        if (w < 0.4) continue;
        const depth = this.#bog(w, this.#soaked(wet, Math.max(this.soaks[ix * this.nz + iz], this.lanes[ix * this.nz + iz] * this.p.laneSoak)));
        if (depth >= this.p.hazardAt) out.push({ x: this.minX + (ix + 0.5) * this.cell, z: this.minZ + (iz + 0.5) * this.cell, radius: r, depth });
      }
    }
    return out.sort((a, b) => b.depth - a.depth).slice(0, max);
  }
}
