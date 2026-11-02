// Tracks through long grass. A wheel rolling over the standing hay presses the blades down in a line the width of the tyre, and they lift again
// over several minutes, the oldest end of the line first. A fine grid over the hay patch holds how flat each bit is, 0 standing to 1 pressed.
// Pure logic: the quad tells it where its wheels are, world/hayView.js draws it over the standing grass only. Tested in tests/grassTracks.test.js.

export const DEFAULT_TRACKS_PARAMS = {
  width: 0.28, // metres either side of a wheel's middle that the grass is pressed (a tyre and a little more where it squashes the edge)
  springSeconds: 420, // seconds for pressed grass to stand up again: the line is gone in about seven minutes
  minSpeed: 0.3, // m/s: slower than this a wheel is just sitting on it and the grass is left alone
  lay: 0.65, // how strongly a pressed line shows against the standing grass, 0 not at all to 1 fully
};

export const TRACKS_PARAM_RANGES = {
  width: [0.1, 0.8, 0.02],
  springSeconds: [20, 1800, 10],
  minSpeed: [0, 2, 0.05],
  lay: [0, 1, 0.05],
};

export class GrassTracks {
  /**
   * @param {object} o
   * @param {{minX:number, maxX:number, minZ:number, maxZ:number}} o.rect  The patch the grid covers.
   * @param {number} [o.cell]  Metres between grid points (the line is a few of these across).
   */
  constructor({ rect, cell = 0.25, params = { ...DEFAULT_TRACKS_PARAMS } }) {
    this.p = params;
    this.rect = rect;
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil((rect.maxX - rect.minX) / cell));
    this.rows = Math.max(1, Math.ceil((rect.maxZ - rect.minZ) / cell));
    this.flat = new Float32Array(this.cols * this.rows);
    this.live = 0; // how many points are pressed at all, so a field nobody has ridden costs nothing
    this.dirty = true; // the picture is out of date
  }

  /** A wheel on the move at (x, z) presses the grass under it (speed in m/s; a wheel that is barely moving leaves it be). */
  press(x, z, speed) {
    if (speed < this.p.minSpeed) return;
    const r = this.p.width;
    const { minX, minZ } = this.rect;
    const c0 = Math.max(0, Math.floor((x - r - minX) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((x + r - minX) / this.cell));
    const r0 = Math.max(0, Math.floor((z - r - minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((z + r - minZ) / this.cell));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const d = Math.hypot(minX + (col + 0.5) * this.cell - x, minZ + (row + 0.5) * this.cell - z);
        // Fully flat in the middle of the tyre, easing off to the edge so the line has a soft side.
        const v = Math.min(1, (r - d) / (r * 0.5));
        if (v <= 0) continue;
        const i = row * this.cols + col;
        if (this.flat[i] === 0) this.live++;
        if (v > this.flat[i]) {
          this.flat[i] = v;
          this.dirty = true;
        }
      }
    }
  }

  /** The grass stands up again. Returns true if anything changed (so the picture wants redrawing). */
  update(dt) {
    if (!this.live) return false;
    const lift = dt / this.p.springSeconds;
    let live = 0;
    for (let i = 0; i < this.flat.length; i++) {
      const v = this.flat[i];
      if (v === 0) continue;
      const n = v - lift;
      this.flat[i] = n > 0 ? n : 0;
      if (n > 0) live++;
    }
    this.live = live;
    this.dirty = true;
    return true;
  }

  /** How flat the grass is at (x, z), 0..1 (0 off the patch). */
  at(x, z) {
    const col = Math.floor((x - this.rect.minX) / this.cell);
    const row = Math.floor((z - this.rect.minZ) / this.cell);
    return col < 0 || row < 0 || col >= this.cols || row >= this.rows ? 0 : this.flat[row * this.cols + col];
  }

  /** The grass all stands up at once (the debug panel). */
  clear() {
    this.flat.fill(0);
    this.live = 0;
    this.dirty = true;
  }

  describe() {
    return this.live ? `${this.live} of ${this.flat.length} points pressed, the most ${Math.round(this.flat.reduce((m, v) => (v > m ? v : m), 0) * 100)}% flat` : 'the grass is standing';
  }
}
