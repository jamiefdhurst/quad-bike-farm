// How wet the tarmac is. It takes the rain up at once and holds the water on its sealed surface long after the grass has soaked its share
// away, then dries as the sun and the wind get at it: quickly on a bright breezy day, barely at all under cloud, not at all in a freeze.
// The terrain shader makes the tarmac dark and glossy by this, and lets it dry in patches (world/terrain.js). Pure logic.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const DEFAULT_ROAD_WET_PARAMS = {
  soakTime: 25, // seconds of full rain to wet the tarmac through
  dryTime: 1500, // seconds to dry under cloud with no wind
  sunDry: 3, // extra drying in full sun, in multiples of the base rate
  windDry: 1, // extra drying in a full breeze
  coldDry: 0.3, // how much of the drying is left at freezing (the cold keeps it wet, then frost takes over)
};

export const ROAD_WET_PARAM_RANGES = {
  soakTime: [2, 300, 1],
  dryTime: [60, 3600, 10],
  sunDry: [0, 10, 0.1],
  windDry: [0, 5, 0.1],
  coldDry: [0, 1, 0.05],
};

export class RoadWet {
  constructor({ params = { ...DEFAULT_ROAD_WET_PARAMS }, wet = 0 } = {}) {
    this.p = params;
    this.value = clamp01(wet); // 0 dry to 1 shining wet
  }

  /**
   * @param {number} dt  Seconds.
   * @param {object} o
   * @param {number} o.rain  0..1 falling now.
   * @param {number} o.sun  0..1 how much sunshine reaches the ground (0 at night or under thick cloud).
   * @param {number} o.wind  0..1 how breezy.
   * @param {number} o.temperature  Degrees C.
   */
  update(dt, { rain = 0, sun = 0, wind = 0, temperature = 10 } = {}) {
    const p = this.p;
    if (rain > 0.02) {
      this.value = clamp01(this.value + (rain * dt) / p.soakTime);
      return this.value;
    }
    const cold = p.coldDry + (1 - p.coldDry) * clamp01(temperature / 10);
    const rate = ((1 + p.sunDry * clamp01(sun) + p.windDry * clamp01(wind)) * cold) / p.dryTime;
    this.value = clamp01(this.value - rate * dt);
    return this.value;
  }

  /** Sets it (the console), clamped. */
  set(v) {
    this.value = clamp01(v);
  }
}

/**
 * A 0..255 mask of the tarmac over `rect` ({ minX, maxX, minZ, maxZ }), one texel a `cell` metres, row after row along z, for the ground shader to
 * know where the road is. `boxes` are the places a road could be (`fields.tarmacBoxes()`): `tarmacAt` is asked only there, once for each texel
 * (`lookups` counts them), so the mask costs by the length of road and not by the size of the ground. Null when no box reaches `rect`: no road here.
 * A generator that pauses every `every` lookups (a few thousand are a millisecond), for painting a tile a little a frame; `tarmacMask` runs it through.
 */
export function* tarmacMaskSteps(tarmacAt, rect, cell = 0.5, boxes = [], every = 2000) {
  const nx = Math.ceil((rect.maxX - rect.minX) / cell);
  const nz = Math.ceil((rect.maxZ - rect.minZ) / cell);
  let data = null;
  let seen = null;
  let lookups = 0;
  for (const b of boxes) {
    if (b.maxX < rect.minX || b.minX > rect.maxX || b.maxZ < rect.minZ || b.minZ > rect.maxZ) continue;
    if (!data) {
      data = new Uint8Array(nx * nz);
      seen = new Uint8Array(nx * nz);
    }
    // The texels whose middles are in the box.
    const ix0 = Math.max(0, Math.ceil((b.minX - rect.minX) / cell - 0.5));
    const ix1 = Math.min(nx - 1, Math.floor((b.maxX - rect.minX) / cell - 0.5));
    const iz0 = Math.max(0, Math.ceil((b.minZ - rect.minZ) / cell - 0.5));
    const iz1 = Math.min(nz - 1, Math.floor((b.maxZ - rect.minZ) / cell - 0.5));
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const k = iz * nx + ix;
        if (seen[k]) continue;
        seen[k] = 1;
        lookups++;
        const t = tarmacAt(rect.minX + (ix + 0.5) * cell, rect.minZ + (iz + 0.5) * cell);
        data[k] = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(t * 255);
        if (lookups % every === 0) yield;
      }
    }
  }
  return data ? { data, nx, nz, cell, minX: rect.minX, minZ: rect.minZ, sizeX: nx * cell, sizeZ: nz * cell, lookups } : null;
}

/** The tarmac mask in one go: see `tarmacMaskSteps`. */
export function tarmacMask(tarmacAt, rect, cell = 0.5, boxes = []) {
  const job = tarmacMaskSteps(tarmacAt, rect, cell, boxes);
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}
