// Harrowing the field: a set of chain harrows on a carrier behind the tractor (or a quad with a rack), tines lowered with T, dragged over a
// rectangle of the grass field in lines to comb it flat and spread the molehills. Pure logic, no Three.js: the game feeds it where the mat is
// and how fast it is going, and draws what it says (world/harrowView.js, the farm map). The field is a grid of 1 m cells, each either
// untouched or combed along the way the mat went (the two ways show as different stripes). A harrowed field stays harrowed for a few days
// and is not on the board until then. Tested in tests/harrowing.test.js.

export const HARROW_CELL = 1; // metres a side of one cell of the field (fixed: the grid is built from it)

export const DEFAULT_HARROW_PARAMS = {
  workWidth: 3.4, // metres of mat across
  matBehind: 2.2, // metres behind the axle that the middle of the mat drags
  minSpeed: 0.8, // m/s: slower than this the mat sits and does not comb
  maxSpeed: 7.5, // m/s: faster than this the mat skips over the top
  lowerSeconds: 1.6, // the mat takes this long to come down onto the ground or lift off it
  coverNeeded: 0.9, // the share of the field combed for the job to count as done
  lastsDays: 5, // farm days the field stays harrowed (and off the board) before the molehills are back
  moleHills: 16, // molehills dealt over the field
  towWeight: 2, // a mat on the ground drags like this many things in the tow load (npc/towLoad)
};

export const HARROW_PARAM_RANGES = {
  workWidth: [1, 8, 0.1],
  matBehind: [0.5, 5, 0.1],
  minSpeed: [0.1, 3, 0.1],
  maxSpeed: [2, 14, 0.5],
  lowerSeconds: [0.3, 6, 0.1],
  coverNeeded: [0.3, 1, 0.01],
  lastsDays: [1, 30, 1],
  moleHills: [0, 40, 1],
  towWeight: [0, 8, 0.5],
};

export const UNTOUCHED = 0;
export const COMBED_ALONG_Z = 1; // the mat went mostly north to south
export const COMBED_ALONG_X = 2; // the mat went mostly east to west

export const HARROW_JOB = {
  label: 'Harrow the field',
  chalk: 'Harrow the field inside the track with the chain harrows',
  hint: 'Hitch the harrows to the tractor or a quad with a rack with J, lower the tines with T and drag them up and down the field in overlapping lines',
  needs: 'harrowField',
};

export const HARROW_PHASE_TEXT = {
  lower: 'Lower the tines with T',
  harrow: 'Drag the harrows up and down the field in overlapping lines',
  done: 'The field is harrowed',
};

/** Whether the field wants harrowing on `day`, from the farm save alone (the board is dealt before the field is built). */
export function harrowWanted(save, day, params = DEFAULT_HARROW_PARAMS) {
  const done = save?.doneDay;
  return !(Number.isInteger(done) && day - done < params.lastsDays);
}

/**
 * Where the molehills are, dealt from `random` (a seeded 0..1 source, so the same farm has the same ones): points in `rect`, kept a metre off
 * its edge and apart from each other. Each is { x, z, size }.
 */
export function dealMolehills(rect, count, random) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = rect.minX + 1 + random() * (rect.maxX - rect.minX - 2);
    const z = rect.minZ + 1 + random() * (rect.maxZ - rect.minZ - 2);
    if (out.some((m) => Math.hypot(m.x - x, m.z - z) < 2.5)) continue;
    out.push({ x, z, size: 0.8 + random() * 0.5 });
  }
  return out;
}

export class Harrowing {
  constructor({ rect, params = { ...DEFAULT_HARROW_PARAMS } }) {
    this.p = params;
    this.rect = rect;
    this.cols = Math.max(1, Math.round((rect.maxX - rect.minX) / HARROW_CELL));
    this.rows = Math.max(1, Math.round((rect.maxZ - rect.minZ) / HARROW_CELL));
    this.cells = this.cols * this.rows;
    this.state = new Uint8Array(this.cells);
    this.combed = 0; // how many cells are combed
    this.down = 0; // 0 tines up, 1 tines down on the ground (eased)
    this.downWant = false;
    this.last = null; // { x, z }: where the middle of the mat was
    this.since = null; // the farm day the first of it was combed
    this.doneDay = null; // the farm day the job was done
    this.harrowing = false;
    this.metres = 0; // metres of mat travel on the ground, this job
  }

  get isDown() {
    return this.down >= 0.999;
  }

  index(x, z) {
    const c = Math.floor((x - this.rect.minX) / HARROW_CELL);
    const r = Math.floor((z - this.rect.minZ) / HARROW_CELL);
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c;
  }

  /** The share of the field combed, 0..1. */
  get coverage() {
    return this.combed / this.cells;
  }

  get done() {
    return this.doneDay !== null;
  }

  /** Whether the field wants harrowing on farm day `day`: never done, or done `lastsDays` or more ago. */
  needsHarrowing(day) {
    return this.doneDay === null || day - this.doneDay >= this.p.lastsDays;
  }

  get phase() {
    if (this.done) return 'done';
    return this.isDown ? 'harrow' : 'lower';
  }

  toggleTines() {
    this.downWant = !this.downWant;
    return this.downWant;
  }

  /** Sets the tines down or up at once (the debug panel, a restored game). */
  setDown(down) {
    this.downWant = down;
    this.down = down ? 1 : 0;
  }

  /** Whether the mat is in a state to comb at `speed` m/s. */
  canComb(speed) {
    return this.isDown && speed >= this.p.minSpeed && speed <= this.p.maxSpeed;
  }

  /**
   * One step. `s`: x, z (the axle), yaw (the way the carrier points; the mat drags behind its back, across it), speed (m/s, magnitude), hitched,
   * day (the farm day). Returns events: { type: 'combed', cells } with the cells that changed, and 'done'.
   */
  update(dt, s) {
    const p = this.p;
    const events = [];
    const step = dt / p.lowerSeconds;
    this.down = Math.max(0, Math.min(1, this.down + (this.downWant ? step : -step)));
    // Behind the axle, along the carrier's own line (+z points to the puller, so behind is minus).
    const bx = s.x - Math.sin(s.yaw) * p.matBehind;
    const bz = s.z - Math.cos(s.yaw) * p.matBehind;
    const last = this.last;
    this.last = { x: bx, z: bz };
    this.harrowing = false;
    if (!last || !s.hitched || !this.canComb(s.speed)) return events;
    const dist = Math.hypot(bx - last.x, bz - last.z);
    if (dist <= 1e-6 || dist > 5) return events; // a jump (placed somewhere), not driving
    this.harrowing = true;
    this.metres += dist;
    const kind = Math.abs(Math.cos(s.yaw)) >= Math.abs(Math.sin(s.yaw)) ? COMBED_ALONG_Z : COMBED_ALONG_X;
    // Sweep the mat over the ground it crossed: each half-cell of travel combs the cells under its width.
    const n = Math.max(1, Math.ceil(dist / (HARROW_CELL * 0.5)));
    const px = Math.cos(s.yaw); // across the carrier
    const pz = -Math.sin(s.yaw);
    const half = p.workWidth / 2;
    const changed = new Set();
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const cx = last.x + (bx - last.x) * t;
      const cz = last.z + (bz - last.z) * t;
      for (let o = -half + 1e-3; o < half; o += HARROW_CELL * 0.5) {
        const i = this.index(cx + px * o, cz + pz * o);
        if (i < 0 || this.state[i] === kind) continue;
        if (this.state[i] === UNTOUCHED) this.combed++;
        this.state[i] = kind; // going over it the other way combs it across the first lines
        changed.add(i);
      }
    }
    if (changed.size) {
      this.since ??= s.day ?? 0;
      events.push({ type: 'combed', cells: [...changed] });
    }
    if (!this.done && this.coverage >= p.coverNeeded) {
      this.doneDay = s.day ?? 0;
      events.push({ type: 'done' });
    }
    return events;
  }

  /** Clears the field for a new go (the debug panel, or the combing growing out). */
  clear() {
    this.state.fill(UNTOUCHED);
    this.combed = 0;
    this.since = null;
    this.doneDay = null;
    this.metres = 0;
    this.last = null;
  }

  /** Combs the whole field at once, as if done in good straight lines (the debug panel). */
  combAll(day) {
    this.state.fill(COMBED_ALONG_Z);
    this.combed = this.cells;
    this.since ??= day;
    this.doneDay = day;
  }

  // Keeping it ---------------------------------------------------------------

  /** What the farm keeps: the days, and the field as a string with a digit a cell (0 untouched, 1 combed along z, 2 along x). */
  toJSON() {
    let cells = '';
    for (let i = 0; i < this.cells; i++) cells += this.state[i];
    return { since: this.since, doneDay: this.doneDay, cells };
  }

  /** Puts a save back on `day`: combing older than `lastsDays` has grown out, the field is untouched again. */
  restore(save, day) {
    this.clear();
    this.setDown(false);
    if (!save || typeof save.cells !== 'string' || !Number.isInteger(save.since)) return;
    const marked = Number.isInteger(save.doneDay) ? save.doneDay : save.since;
    if (day - marked >= this.p.lastsDays) return;
    for (let i = 0; i < this.cells && i < save.cells.length; i++) {
      const v = Number(save.cells[i]);
      if (v === COMBED_ALONG_Z || v === COMBED_ALONG_X) {
        this.state[i] = v;
        this.combed++;
      }
    }
    this.since = save.since;
    this.doneDay = Number.isInteger(save.doneDay) ? save.doneDay : null;
  }

  describe() {
    return `${this.phase}: ${Math.round(this.coverage * 100)}% combed, tines ${this.isDown ? 'down' : this.down > 0 ? 'moving' : 'up'}`;
  }
}

/** The runs of one state along each row, for drawing the lines on the map: [{ z, x0, x1, state }]. */
export function harrowRuns(h) {
  const runs = [];
  for (let r = 0; r < h.rows; r++) {
    let c = 0;
    while (c < h.cols) {
      const st = h.state[r * h.cols + c];
      let e = c + 1;
      while (e < h.cols && h.state[r * h.cols + e] === st) e++;
      if (st !== UNTOUCHED) runs.push({ z: h.rect.minZ + r * HARROW_CELL, x0: h.rect.minX + c * HARROW_CELL, x1: h.rect.minX + e * HARROW_CELL, state: st });
      c = e;
    }
  }
  return runs;
}
