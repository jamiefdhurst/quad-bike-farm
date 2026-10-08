// Mud carried onto the farm road. A tyre picks mud up rolling through the track, a bog or ground it has churned soft, wipes a little off
// on grass, and sheds what it carries onto the tarmac over the first stretch it rolls, most of it in the first 60 m or so. The smears lie on
// a fine grid over the road: they count as mud for grip (and look like it), and wash off slowly in the rain. Pure logic; the world feeds it
// wheels and the rain, the terrain shader draws `data`.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const DEFAULT_ROAD_MUD_PARAMS = {
  pickUp: 0.3, // tyre mud gained per metre rolled on full mud: a few metres of the track loads a tyre up
  pickUpFrom: 0.3, // ground less muddy than this picks up nothing
  grassWipe: 0.02, // fraction of a tyre's mud wiped off per metre on grass or stubble
  shedLength: 20, // metres of tarmac over which a tyre sheds about two thirds of what it carries
  smear: 3, // smear laid on the road per unit of mud shed (a loaded tyre's first metre leaves about 0.15)
  washRate: 0.004, // smear washed off per second in heavy rain: a thick smear goes in about four minutes
  dryFade: 0.00008, // smear lost per second in the dry, worn off by tyres and the wind: hours
  grip: 0.75, // how much a full smear counts as mud for grip
};

export const ROAD_MUD_PARAM_RANGES = {
  pickUp: [0, 2, 0.01],
  pickUpFrom: [0, 1, 0.01],
  grassWipe: [0, 0.2, 0.001],
  shedLength: [1, 100, 1],
  smear: [0, 10, 0.1],
  washRate: [0, 0.05, 0.0005],
  dryFade: [0, 0.002, 0.00001],
  grip: [0, 1, 0.01],
};

export class RoadMud {
  /**
   * @param {object} o
   * @param {object} o.bounds  { minX, maxX, minZ, maxZ }: the ground the grid covers (the road and its hardstanding).
   * @param {(x:number, z:number) => number} o.tarmacAt  0..1 how much of the ground here is tarmac.
   * @param {number} [o.cell]  Metres between grid points: fine enough for a tyre's line.
   */
  constructor({ bounds, tarmacAt, cell = 0.5, params = { ...DEFAULT_ROAD_MUD_PARAMS } }) {
    this.p = params;
    this.cell = cell;
    this.tarmacAt = tarmacAt;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.nx = Math.max(2, Math.ceil((bounds.maxX - bounds.minX) / cell));
    this.nz = Math.max(2, Math.ceil((bounds.maxZ - bounds.minZ) / cell));
    this.smears = new Float32Array(this.nx * this.nz); // [iz * nx + ix], 0..1, the same layout as the texture
    this.data = new Uint8Array(this.nx * this.nz * 4); // r the smear, for the ground shader
    this.dirty = false;
    this.packed = false;
    this.packClock = 0;
  }

  get sizeX() {
    return this.nx * this.cell;
  }

  get sizeZ() {
    return this.nz * this.cell;
  }

  /**
   * A tyre carrying `load` (0..1) of mud rolls `dist` metres at (x, z), on ground `mud` (0..1) muddy. Returns what it carries now: more
   * after the track, less after grass, and on the tarmac less again, the difference left on the road.
   */
  roll(load, x, z, dist, mud) {
    const p = this.p;
    if (dist <= 0) return load;
    const tarmac = this.tarmacAt(x, z);
    if (tarmac > 0.5) {
      const shed = load * (1 - Math.exp(-dist / p.shedLength));
      if (shed > 0) this.#lay(x, z, shed * p.smear);
      return load - shed;
    }
    if (mud > p.pickUpFrom) {
      const k = (mud - p.pickUpFrom) / (1 - p.pickUpFrom);
      return Math.min(1, load + (1 - load) * Math.min(1, p.pickUp * k * dist));
    }
    return load * Math.max(0, 1 - p.grassWipe * dist);
  }

  /** Spreads `amount` onto the four grid points round (x, z), so that reading it back there gives `amount` (as groundWear.js does). */
  #lay(x, z, amount) {
    const gx = (x - this.minX) / this.cell - 0.5;
    const gz = (z - this.minZ) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const k = amount / (((1 - fx) ** 2 + fx ** 2) * ((1 - fz) ** 2 + fz ** 2));
    this.#bump(ix, iz, k * (1 - fx) * (1 - fz));
    this.#bump(ix + 1, iz, k * fx * (1 - fz));
    this.#bump(ix, iz + 1, k * (1 - fx) * fz);
    this.#bump(ix + 1, iz + 1, k * fx * fz);
    this.dirty = true;
  }

  #bump(ix, iz, amount) {
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return;
    const i = iz * this.nx + ix;
    this.smears[i] = Math.min(1, this.smears[i] + amount);
  }

  /** 0..1 how thick the smear is here (bilinear between grid points), 0 off the grid. */
  smearAt(x, z) {
    const gx = (x - this.minX) / this.cell - 0.5;
    const gz = (z - this.minZ) / this.cell - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    if (ix < -1 || iz < -1 || ix >= this.nx || iz >= this.nz) return 0;
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (a, b) => (a < 0 || b < 0 || a >= this.nx || b >= this.nz ? 0 : this.smears[b * this.nx + a]);
    return at(ix, iz) * (1 - fx) * (1 - fz) + at(ix + 1, iz) * fx * (1 - fz) + at(ix, iz + 1) * (1 - fx) * fz + at(ix + 1, iz + 1) * fx * fz;
  }

  /** How much the smear here counts as mud for the tyres. */
  mudAt(x, z) {
    return this.smearAt(x, z) * this.p.grip;
  }

  /** The rain (0..1, falling now) washes the smears away; refreshes `data` about twice a second if anything changed. */
  update(dt, rain = 0) {
    const fade = (this.p.washRate * clamp(rain, 0, 1) + this.p.dryFade) * dt;
    const s = this.smears;
    for (let i = 0; i < s.length; i++) {
      if (s[i] > 0) {
        s[i] = Math.max(0, s[i] - fade);
        this.dirty = true;
      }
    }
    this.packClock += dt;
    if (this.dirty && this.packClock >= 0.5) {
      this.packClock = 0;
      this.pack();
    }
  }

  pack() {
    const s = this.smears;
    for (let i = 0; i < s.length; i++) {
      this.data[i * 4] = Math.round(clamp(s[i], 0, 1) * 255);
      this.data[i * 4 + 3] = 255;
    }
    this.dirty = false;
    this.packed = true;
  }
}
