// Haymaking: a farm job in four stages on the hay meadow in the grass field's south-east corner. Mow it (drive the tractor over the standing grass at a working pace),
// bale it (drive over what was cut and the baler leaves square bales behind you), load the bales on the trailer (the girls carry them up, or
// you do) and stack them in the Dutch barn. Pure logic, no Three.js: the game feeds it where the tractor is and what the trailer is doing,
// and draws what it says (world/hayView.js). The patch is a grid of cells, each standing, cut or baled; the cut ones grow back over game
// days. Tested in tests/haymaking.test.js.

export const DEFAULT_HAY_PARAMS = {
  cutNeeded: 60, // cells mown for the cutting to count as done
  swath: 1.6, // metres either side of the tractor's middle that are cut
  minSpeed: 0.5, // m/s: slower than this the tractor is just standing on it
  maxSpeed: 3.6, // m/s: faster than this it skips and the blades don't bite
  cellsPerBale: 7, // baled cells that make one bale
  balesNeeded: 8, // bales the job wants, loaded and stacked
  baleBehind: 3.2, // metres behind the tractor's middle that a bale is left
  trailerReach: 12, // metres from a loose bale to the trailer for anyone to load it
  playerReach: 7, // metres from you to the trailer for you to heave a bale on
  stackReach: 3, // metres outside the barn's open bay that the trailer can be and still count as in
  stackSpeed: 0.8, // m/s: the trailer has to be this still to unload
  regrowDays: 3, // days after cutting that the grass has grown back (each load of the game is the next day)
  throwSeconds: 0.55, // how long a bale is in the air
  claimSeconds: 40, // a girl who has claimed a bale and not got it up the trailer in this long is forgotten
};

export const HAY_PARAM_RANGES = {
  cutNeeded: [10, 120, 1],
  swath: [0.6, 3, 0.1],
  minSpeed: [0.1, 2, 0.05],
  maxSpeed: [1, 8, 0.1],
  cellsPerBale: [2, 20, 1],
  balesNeeded: [1, 16, 1],
  baleBehind: [1.5, 6, 0.1],
  trailerReach: [3, 40, 1],
  playerReach: [2, 20, 0.5],
  stackReach: [0, 10, 0.5],
  stackSpeed: [0.1, 3, 0.1],
  regrowDays: [1, 10, 1],
  throwSeconds: [0.2, 1.5, 0.05],
  claimSeconds: [10, 120, 5],
};

export const STANDING = 0;
export const CUT = 1;
export const BALED = 2;

export const STACK_CAPACITY = 16; // bales the Dutch barn's bay holds, four to a row and four high

export const PHASES = ['cut', 'bale', 'load', 'stack', 'done'];

export const HAY_PHASE_TEXT = {
  cut: 'Mow the hay meadow in the grass field with the tractor',
  bale: 'Drive over the cut hay and the baler leaves bales behind you',
  load: 'Bring the trailer to the bales: the girls carry them up, or press E to heave one on',
  stack: 'Take the trailer into the Dutch barn',
  done: 'The hay is in',
};

/** The bale slots on the trailer's bed, in its own metres: rows from the back forward, two across, layer by layer. */
export function trailerSlots(count, { bedY = 0.78, rearZ = -1.7, rows = 4, rowGap = 0.46, across = 0.5, layerHeight = 0.38, lift = 0.25 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / (rows * 2));
    const k = i % (rows * 2);
    const row = Math.floor(k / 2);
    out.push({ x: k % 2 === 0 ? across : -across, y: bedY + lift + layer * layerHeight, z: rearZ + 0.28 + row * rowGap });
  }
  return out;
}

/** The places in the Dutch barn's open bay that stacked bales go: along its back, a row of five, then a second layer. `open` is the bay's rectangle. */
export function stackSpots(open, count, { gap = 0.95, layerHeight = 0.36, floor = 0 } = {}) {
  const perRow = Math.max(1, Math.floor((open.maxX - open.minX - 0.3) / gap));
  const out = [];
  for (let i = 0; i < count; i++) {
    const k = i % perRow;
    out.push({ x: open.minX + 0.15 + gap / 2 + k * gap, y: floor + 0.18 + Math.floor(i / perRow) * layerHeight, z: open.minZ + 0.4 });
  }
  return out;
}

const inRect = (r, x, z, margin = 0) => x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin;

export class Haymaking {
  constructor({ rect, cell = 2, params = { ...DEFAULT_HAY_PARAMS } }) {
    this.p = params;
    this.rect = rect;
    this.cell = cell;
    this.cols = Math.max(1, Math.floor((rect.maxX - rect.minX) / cell));
    this.rows = Math.max(1, Math.floor((rect.maxZ - rect.minZ) / cell));
    this.state = new Uint8Array(this.cols * this.rows);
    this.cut = 0; // cells mown this job
    this.baledCells = 0; // cells baled this job
    this.bales = []; // the loose ones: { id, x, z, state: 'ground' | 'claimed' | 'loaded', by, until, slot }
    this.made = 0; // bales left behind the baler
    this.loaded = 0; // bales on the trailer
    this.stacked = 0; // bales in the barn, kept from day to day
    this.delivered = 0; // bales stacked this job
    this.cutDay = null; // the day the cutting began, for the grass growing back
    this.nextId = 1;
    this.clock = 0;
    this.active = false; // the job is on the board and not ticked off
  }

  // The patch --------------------------------------------------------------

  index(x, z) {
    const c = Math.floor((x - this.rect.minX) / this.cell);
    const r = Math.floor((z - this.rect.minZ) / this.cell);
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c;
  }

  /** The middle of cell `i`, { x, z }. */
  centre(i) {
    return { x: this.rect.minX + ((i % this.cols) + 0.5) * this.cell, z: this.rect.minZ + (Math.floor(i / this.cols) + 0.5) * this.cell };
  }

  get cells() {
    return this.cols * this.rows;
  }

  /** How many cells are in `kind` right now. */
  count(kind) {
    let n = 0;
    for (const s of this.state) if (s === kind) n++;
    return n;
  }

  // The job -------------------------------------------------------------------

  get phase() {
    if (!this.active) return 'idle';
    if (this.cut < this.p.cutNeeded) return 'cut';
    if (this.made < this.p.balesNeeded) return 'bale';
    if (this.delivered >= this.p.balesNeeded) return 'done';
    return this.loaded < this.p.balesNeeded ? 'load' : 'stack';
  }

  /** The board has it: stage one begins (a patch already cut stays cut, so a farm that mowed yesterday starts further on). */
  start() {
    this.active = true;
    this.cut = this.count(CUT) + this.count(BALED);
    this.baledCells = 0;
    this.made = 0;
    this.delivered = 0;
  }

  // Stage by stage ----------------------------------------------------------

  /**
   * One step. `s`: x, z (the tractor's middle), heading (radians, the way it faces: x = sin, z = cos), speed (m/s), working (the tractor is
   * running), day. Returns events: { type: 'cut', cells }, 'cutDone', { type: 'baled', cells }, { type: 'bale', bale }, 'baleDone'.
   */
  update(dt, s) {
    this.clock += dt;
    for (const b of this.bales) if (b.state === 'claimed' && this.clock > b.until) this.release(b.id);
    const events = [];
    const phase = this.phase;
    if ((phase !== 'cut' && phase !== 'bale') || !s.working || s.speed < this.p.minSpeed || s.speed > this.p.maxSpeed) return events;
    const touched = this.cellsUnder(s);
    if (phase === 'cut') {
      const cells = [];
      for (const i of touched) {
        if (this.state[i] !== STANDING) continue;
        this.state[i] = CUT;
        this.cut += 1;
        cells.push(i);
      }
      if (cells.length) {
        this.cutDay ??= s.day ?? 1;
        events.push({ type: 'cut', cells });
      }
      if (this.cut >= this.p.cutNeeded) events.push({ type: 'cutDone' });
      return events;
    }
    const cells = [];
    for (const i of touched) {
      if (this.state[i] !== CUT) continue;
      this.state[i] = BALED;
      this.baledCells += 1;
      cells.push(i);
    }
    if (!cells.length) return events;
    events.push({ type: 'baled', cells });
    while (this.made < this.p.balesNeeded && this.baledCells >= (this.made + 1) * this.p.cellsPerBale) {
      const bale = this.drop(s);
      events.push({ type: 'bale', bale });
    }
    // The last cells of the patch run out before the tally does: the baler leaves what it has.
    if (this.made < this.p.balesNeeded && !this.count(CUT)) {
      while (this.made < this.p.balesNeeded) events.push({ type: 'bale', bale: this.drop(s) });
    }
    if (this.made >= this.p.balesNeeded) events.push({ type: 'baleDone' });
    return events;
  }

  /** The cells whose middles are within the swath of the tractor's path (a rectangle `swath` either side, a metre ahead and behind). */
  cellsUnder(s) {
    const sin = Math.sin(s.heading ?? 0);
    const cos = Math.cos(s.heading ?? 0);
    const out = [];
    const reach = this.p.swath + this.cell * 0.5;
    const c0 = Math.floor((s.x - reach - this.rect.minX) / this.cell);
    const c1 = Math.floor((s.x + reach - this.rect.minX) / this.cell);
    const r0 = Math.floor((s.z - reach - this.rect.minZ) / this.cell);
    const r1 = Math.floor((s.z + reach - this.rect.minZ) / this.cell);
    for (let r = Math.max(0, r0); r <= Math.min(this.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
        const mx = this.rect.minX + (c + 0.5) * this.cell - s.x;
        const mz = this.rect.minZ + (r + 0.5) * this.cell - s.z;
        const across = mx * cos - mz * sin; // sideways of its heading
        const along = mx * sin + mz * cos;
        if (Math.abs(across) <= this.p.swath && Math.abs(along) <= 1.2 + this.cell * 0.5) out.push(r * this.cols + c);
      }
    }
    return out;
  }

  /** Leaves a bale behind the tractor. */
  drop(s) {
    const sin = Math.sin(s.heading ?? 0);
    const cos = Math.cos(s.heading ?? 0);
    const bale = {
      id: this.nextId++,
      x: s.x - sin * this.p.baleBehind,
      z: s.z - cos * this.p.baleBehind,
      yaw: s.heading ?? 0, // lying across the way it was baled
      state: 'ground',
      by: null,
      until: 0,
      slot: -1,
    };
    this.bales.push(bale);
    this.made += 1;
    return bale;
  }

  // The bales ----------------------------------------------------------------

  get(id) {
    return this.bales.find((b) => b.id === id) ?? null;
  }

  /** Bales lying loose that nobody has. */
  free() {
    return this.bales.filter((b) => b.state === 'ground');
  }

  /** The loose bale nearest (x, z) within `range`, or null. */
  nearest(x, z, range = Infinity) {
    let best = null;
    let bestD = range;
    for (const b of this.free()) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d <= bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  /** Whether a bale could be loaded now: the load stage, one lying loose, and room on the trailer. */
  canLoad(trailerFree) {
    return this.phase === 'load' && this.free().length > 0 && trailerFree > 0;
  }

  /** A girl takes the bale: nobody else will. */
  claim(id, by, slot = -1) {
    const b = this.get(id);
    if (!b || b.state !== 'ground') return null;
    b.state = 'claimed';
    b.by = by;
    b.slot = slot; // the place on the trailer she is taking it to, kept for her
    b.until = this.clock + this.p.claimSeconds;
    return b;
  }

  /** The bale is put back on the ground where `at` says (she was called away, or it was a miss). */
  release(id, at = null) {
    const b = this.get(id);
    if (!b || b.state === 'loaded') return null;
    b.state = 'ground';
    b.by = null;
    b.slot = -1;
    if (at) {
      b.x = at.x;
      b.z = at.z;
    }
    return b;
  }

  /** The bale is on the trailer in `slot`. Returns the new count, and 'loaded' when that is all of them. */
  load(id, slot) {
    const b = this.get(id);
    if (!b || b.state === 'loaded') return null;
    b.state = 'loaded';
    b.by = null;
    b.slot = slot;
    this.loaded += 1;
    return this.loaded >= this.p.balesNeeded ? 'loaded' : 'more';
  }

  /** The first slot on the trailer not holding a bale or promised one, or -1 when it is full. `capacity` is how many it has. */
  freeSlot(capacity) {
    const taken = new Set(this.bales.filter((b) => b.slot >= 0 && (b.state === 'loaded' || b.state === 'claimed')).map((b) => b.slot));
    for (let i = 0; i < capacity; i++) if (!taken.has(i)) return i;
    return -1;
  }

  /**
   * The trailer is at the barn: `s` has x, z, speed. Unloads what is on it into the stack when it is stopped in the open bay (or `stackReach`
   * metres outside it). Returns { type: 'stacked', ids } or null.
   */
  deliver(open, s) {
    if (this.phase !== 'stack' || !open || s.speed > this.p.stackSpeed || !inRect(open, s.x, s.z, this.p.stackReach)) return null;
    const ids = this.bales.filter((b) => b.state === 'loaded').map((b) => b.id);
    this.bales = this.bales.filter((b) => b.state !== 'loaded');
    this.stacked += ids.length;
    this.delivered += ids.length;
    this.loaded = 0;
    return { type: 'stacked', ids };
  }

  // Keeping it ---------------------------------------------------------------

  /** What the farm keeps: the cut cells (as indexes), the day they were cut, and the bales in the barn. The job's own stages start again each day. */
  toJSON() {
    const cut = [];
    for (let i = 0; i < this.state.length; i++) if (this.state[i] !== STANDING) cut.push(i);
    return { cut, cutDay: this.cutDay, stacked: this.stacked };
  }

  /** Puts a save back, on `day`: the grass has grown over what was cut `regrowDays` or more ago. */
  restore(save, day) {
    this.state.fill(STANDING);
    this.cutDay = null;
    this.cut = 0;
    this.stacked = Math.max(0, Math.min(Math.floor(save?.stacked ?? 0), STACK_CAPACITY));
    if (!save || !Array.isArray(save.cut) || !Number.isInteger(save.cutDay)) return;
    if (day - save.cutDay >= this.p.regrowDays) return;
    for (const i of save.cut) if (Number.isInteger(i) && i >= 0 && i < this.state.length) this.state[i] = CUT;
    this.cutDay = save.cutDay;
    this.cut = this.count(CUT);
  }

  describe() {
    return `${this.phase}: ${this.cut} cut, ${this.made} bales made, ${this.loaded} loaded, ${this.stacked} stacked`;
  }
}
