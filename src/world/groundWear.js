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
};

export class GroundWear {
  /**
   * @param {object} o
   * @param {number} o.half        Metres from the middle that the grid covers each way.
   * @param {number} [o.cell]      Metres between grid points (a patch of worn ground is about two of these across).
   * @param {(x:number, z:number) => boolean} [o.exempt]  Ground that never wears (the yard, the drag strip, the barn).
   */
  constructor({ half, cell = 2, exempt = () => false, params = { ...DEFAULT_WEAR_PARAMS } }) {
    this.p = params;
    this.cell = cell;
    this.n = Math.max(2, Math.ceil((half * 2) / cell));
    this.half = (this.n * cell) / 2; // the grid is a whole number of cells, a little over `half` if that doesn't divide
    this.exempt = exempt;
    this.wear = new Float32Array(this.n * this.n); // wear[ix * n + iz], 0..1; node i sits at -half + (i + 0.5) * cell
    this.data = new Uint8Array(this.n * this.n * 4); // r soft, g bog, for the ground shader
    this.dirty = false;
    this.packClock = 0;
  }

  /** Wheels rolling `dist` metres (and spinning at `spin` m/s) at (x, z): wears the four grid points round it, by `weight` (1 a quad). */
  trample(x, z, dist, { spin = 0, wet = 0, dt = 0, weight = 1 } = {}) {
    if (this.exempt(x, z)) return;
    const p = this.p;
    const add = (Math.max(0, dist) * p.wearRate * (1 + p.wetWear * clamp(wet, 0, 1)) + Math.max(0, spin) * p.spinRate * dt) * weight;
    if (add <= 0) return;
    const gx = (x + this.half) / this.cell - 0.5;
    const gz = (z + this.half) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    // Shared out by bilinear weights, scaled so that reading the ground back at the same spot gives `add` (not a quarter of it between points).
    const k = add / (((1 - fx) ** 2 + fx ** 2) * ((1 - fz) ** 2 + fz ** 2));
    this.#bump(ix, iz, k * (1 - fx) * (1 - fz));
    this.#bump(ix + 1, iz, k * fx * (1 - fz));
    this.#bump(ix, iz + 1, k * (1 - fx) * fz);
    this.#bump(ix + 1, iz + 1, k * fx * fz);
    this.dirty = true;
  }

  #bump(ix, iz, amount) {
    if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) return;
    const i = ix * this.n + iz;
    this.wear[i] = Math.min(1, this.wear[i] + amount);
  }

  /** Grass grows back, quicker when it's dry. `wet` is 0..1 how wet the ground is; refreshes `data` about twice a second if anything moved. */
  update(dt, wet = 0) {
    const p = this.p;
    const rec = p.recoverRate * (1 - p.wetRecovery * clamp(wet, 0, 1)) * dt;
    if (rec > 0) {
      const w = this.wear;
      for (let i = 0; i < w.length; i++) {
        if (w[i] > 0) {
          w[i] = Math.max(0, w[i] - rec);
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
    const gx = (x + this.half) / this.cell - 0.5;
    const gz = (z + this.half) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    if (ix < -1 || iz < -1 || ix >= this.n || iz >= this.n) return 0;
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (a, b) => (a < 0 || b < 0 || a >= this.n || b >= this.n ? 0 : this.wear[a * this.n + b]);
    return at(ix, iz) * (1 - fx) * (1 - fz) + at(ix + 1, iz) * fx * (1 - fz) + at(ix, iz + 1) * (1 - fx) * fz + at(ix + 1, iz + 1) * fx * fz;
  }

  /** 0..1 how soft (muddy) the ground is from wear alone. */
  softAt(x, z) {
    return this.#soft(this.wearAt(x, z));
  }

  /** 0..1 how deep a bog the wear has made here, in this wetness. */
  bogAt(x, z, wet = 0) {
    return this.#bog(this.wearAt(x, z), wet);
  }

  #soft(w) {
    return smoothstep(this.p.softFrom, this.p.softTo, w);
  }

  #bog(w, wet) {
    const p = this.p;
    return smoothstep(p.bogFrom, p.bogTo, w * (p.bogDry + p.bogWetGain * clamp(wet, 0, 1)));
  }

  /** Fills `data` (r soft, g bog) for the ground shader. */
  pack(wet = 0) {
    const w = this.wear;
    for (let i = 0; i < w.length; i++) {
      this.data[i * 4] = Math.round(this.#soft(w[i]) * 255);
      this.data[i * 4 + 1] = Math.round(this.#bog(w[i], wet) * 255);
      this.data[i * 4 + 3] = 255;
    }
    this.dirty = false;
    this.packed = true;
  }

  /** The bogs wear has made, as {x, z, radius} for the girls to plan round, capped at the worst `max`. */
  hazards(wet = 0, max = 24) {
    const out = [];
    const r = this.cell * 1.5;
    for (let ix = 0; ix < this.n; ix++) {
      for (let iz = 0; iz < this.n; iz++) {
        const w = this.wear[ix * this.n + iz];
        if (w < 0.4) continue;
        const depth = this.#bog(w, wet);
        if (depth >= this.p.hazardAt) out.push({ x: -this.half + (ix + 0.5) * this.cell, z: -this.half + (iz + 0.5) * this.cell, radius: r, depth });
      }
    }
    return out.sort((a, b) => b.depth - a.depth).slice(0, max);
  }
}
