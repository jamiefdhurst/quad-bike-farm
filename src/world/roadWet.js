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
 * A 0..255 mask of the tarmac over a square of ground, one texel a `cell` metres, row after row along z, for the ground shader to know where
 * the road is. `size` is the width of the square, centred on the origin.
 */
export function tarmacMask(tarmacAt, size, cell = 0.5) {
  const n = Math.ceil(size / cell);
  const half = size / 2;
  const data = new Uint8Array(n * n);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const t = tarmacAt(-half + (ix + 0.5) * cell, -half + (iz + 0.5) * cell);
      data[iz * n + ix] = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(t * 255);
    }
  }
  return { data, n, size, cell, minX: -half, minZ: -half };
}
