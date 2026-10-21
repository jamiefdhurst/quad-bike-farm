// Spraying the field: a sprayer on a trailer behind the green quad, a boom that folds out, and a stubble field to go over in straight, slightly
// overlapping lines. Pure logic, no Three.js: the game feeds it where the boom is and how fast it is going, and draws what it says
// (world/sprayView.js, the farm map). The field is a grid of cells, each carrying a dose; one pass of the boom puts about 1 on every cell it
// crosses, so a strip two passes cover shows as doubled. A field that has been sprayed stays sprayed for a few days and is not on the board
// until then. Tested in tests/spraying.test.js.

export const SPRAY_CELL = 1; // metres a side of one cell of the field (fixed: the grid is built from it)

export const DEFAULT_SPRAY_PARAMS = {
  boomWidth: 6, // metres of boom when it is folded out
  boomBehind: 1.3, // metres behind the axle that the boom hangs
  minSpeed: 0.6, // m/s: slower than this it dribbles and the dose piles up, so nothing is laid
  maxSpeed: 3.6, // m/s: faster than this the spray is blown about and does not land
  foldSeconds: 3.5, // the boom takes this long to fold out or in
  tankMetres: 240, // metres of boom travel a full tank lasts
  fillSeconds: 14, // holding the hose on an empty tank fills it in this long
  fillReach: 3.5, // metres from you (with the hose) to the tank to fill it
  sprayedAt: 0.6, // a dose over this counts as sprayed
  doubledAt: 1.7, // and over this as sprayed twice (the overlap shows darker)
  coverNeeded: 0.88, // the share of the field sprayed for the job to count as done
  lastsDays: 6, // farm days the field stays sprayed (and off the board)
};

export const SPRAY_PARAM_RANGES = {
  boomWidth: [2, 12, 0.5],
  boomBehind: [0.5, 3, 0.1],
  minSpeed: [0.1, 2, 0.05],
  maxSpeed: [1, 8, 0.1],
  foldSeconds: [0.5, 10, 0.1],
  tankMetres: [40, 800, 10],
  fillSeconds: [2, 60, 1],
  fillReach: [1, 10, 0.5],
  sprayedAt: [0.1, 1.5, 0.05],
  doubledAt: [1, 4, 0.1],
  coverNeeded: [0.3, 1, 0.01],
  lastsDays: [1, 30, 1],
};

export const UNSPRAYED = 0;
export const SPRAYED = 1;
export const DOUBLED = 2;

export const SPRAY_JOB = {
  label: 'Spray the field',
  chalk: 'Spray the wheat stubble in the south field',
  hint: 'Hitch the sprayer to the green quad with J, fold the boom out with T and drive slowly up and down in overlapping lines. Fill the tank with the hose',
  needs: 'sprayField',
};

export const SPRAY_PHASE_TEXT = {
  fold: 'Fold the boom out with T',
  spray: 'Drive slowly up and down the field in overlapping lines',
  fill: 'The tank is empty: fill it from the hose',
  done: 'The field is sprayed',
};

/** The dose a cell has, as the state it shows. */
export function stateOf(dose, p) {
  return dose >= p.doubledAt ? DOUBLED : dose >= p.sprayedAt ? SPRAYED : UNSPRAYED;
}

/** Whether the field wants spraying on `day`, from the farm save alone (the board is dealt before the field is built). */
export function sprayWanted(save, day, params = DEFAULT_SPRAY_PARAMS) {
  const done = save?.doneDay;
  return !(Number.isInteger(done) && day - done < params.lastsDays);
}

export class Spraying {
  constructor({ rect, params = { ...DEFAULT_SPRAY_PARAMS } }) {
    this.p = params;
    this.rect = rect;
    this.cols = Math.max(1, Math.round((rect.maxX - rect.minX) / SPRAY_CELL));
    this.rows = Math.max(1, Math.round((rect.maxZ - rect.minZ) / SPRAY_CELL));
    this.cells = this.cols * this.rows;
    this.dose = new Float32Array(this.cells);
    this.state = new Uint8Array(this.cells);
    this.tank = 1; // 0..1
    this.boom = 0; // 0 folded in, 1 folded out (eased)
    this.boomWant = false;
    this.last = null; // { x, z }: where the boom was
    this.started = false; // the job has begun (some of the field sprayed this time)
    this.since = null; // the farm day the first of it was sprayed
    this.doneDay = null; // the farm day the job was done
    this.spraying = false;
    this.metres = 0; // metres of boom travel with spray on, this job
  }

  get out() {
    return this.boom >= 0.999;
  }

  index(x, z) {
    const c = Math.floor((x - this.rect.minX) / SPRAY_CELL);
    const r = Math.floor((z - this.rect.minZ) / SPRAY_CELL);
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c;
  }

  centre(i) {
    const c = i % this.cols;
    const r = Math.floor(i / this.cols);
    return { x: this.rect.minX + (c + 0.5) * SPRAY_CELL, z: this.rect.minZ + (r + 0.5) * SPRAY_CELL };
  }

  count(state) {
    let n = 0;
    for (let i = 0; i < this.cells; i++) if (this.state[i] === state) n++;
    return n;
  }

  /** The share of the field with spray on it, 0..1. */
  get coverage() {
    return (this.count(SPRAYED) + this.count(DOUBLED)) / this.cells;
  }

  /** The share sprayed twice: how much overlap there was. */
  get overlap() {
    return this.count(DOUBLED) / this.cells;
  }

  get done() {
    return this.doneDay !== null;
  }

  /** Whether the field wants spraying on farm day `day`: never done, or done `lastsDays` or more ago. */
  needsSpraying(day) {
    return this.doneDay === null || day - this.doneDay >= this.p.lastsDays;
  }

  get phase() {
    if (this.done) return 'done';
    if (this.tank <= 0.001) return 'fill';
    return this.out ? 'spray' : 'fold';
  }

  toggleBoom() {
    this.boomWant = !this.boomWant;
    return this.boomWant;
  }

  /** Sets the boom folded out or in at once (the debug panel, a restored game). */
  setBoom(out) {
    this.boomWant = out;
    this.boom = out ? 1 : 0;
  }

  /** Whether the boom is in a state to lay spray at `speed` m/s. */
  canSpray(speed) {
    return this.out && this.tank > 0.001 && speed >= this.p.minSpeed && speed <= this.p.maxSpeed;
  }

  /**
   * One step. `s`: x, z (the axle), yaw (the way the trailer points; the boom hangs behind its back, across it), speed (m/s, magnitude), hitched,
   * day (the farm day). Returns events: { type: 'sprayed', cells } with the cells that changed state, 'empty' when the tank runs dry, 'done'.
   */
  update(dt, s) {
    const p = this.p;
    const events = [];
    const step = dt / p.foldSeconds;
    this.boom = Math.max(0, Math.min(1, this.boom + (this.boomWant ? step : -step)));
    // Behind the axle, along the trailer's own line (+z points to the puller, so behind is minus).
    const bx = s.x - Math.sin(s.yaw) * p.boomBehind;
    const bz = s.z - Math.cos(s.yaw) * p.boomBehind;
    const last = this.last;
    this.last = { x: bx, z: bz };
    this.spraying = false;
    if (!last || !s.hitched || !this.canSpray(s.speed)) return events;
    const dist = Math.hypot(bx - last.x, bz - last.z);
    if (dist <= 1e-6 || dist > 5) return events; // a jump (placed somewhere), not driving
    this.spraying = true;
    const wasEmpty = this.tank <= 0.001;
    const use = Math.min(dist / p.tankMetres, this.tank);
    this.tank = this.tank - use < 1e-9 ? 0 : this.tank - use;
    this.metres += dist;
    // Sweep the bar over the ground it crossed. Each half-cell of travel marks the cells under the bar and gives them that much dose.
    const n = Math.max(1, Math.ceil(dist / (SPRAY_CELL * 0.5)));
    const px = Math.cos(s.yaw); // across the trailer
    const pz = -Math.sin(s.yaw);
    const half = p.boomWidth / 2;
    const changed = new Set();
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const cx = last.x + (bx - last.x) * t;
      const cz = last.z + (bz - last.z) * t;
      const hit = new Set();
      for (let o = -half + 1e-3; o < half; o += SPRAY_CELL * 0.5) {
        const i = this.index(cx + px * o, cz + pz * o);
        if (i >= 0) hit.add(i);
      }
      for (const i of hit) {
        const before = this.state[i];
        this.dose[i] += dist / n / SPRAY_CELL;
        const after = stateOf(this.dose[i], p);
        if (after !== before) {
          this.state[i] = after;
          changed.add(i);
        }
      }
    }
    if (changed.size) {
      if (!this.started) {
        this.started = true;
        this.since ??= s.day ?? 0;
      }
      events.push({ type: 'sprayed', cells: [...changed] });
    }
    if (!wasEmpty && this.tank <= 0.001) events.push({ type: 'empty' });
    if (!this.done && this.coverage >= p.coverNeeded) {
      this.doneDay = s.day ?? 0;
      events.push({ type: 'done' });
    }
    return events;
  }

  /** Holding the hose on the tank: fills it. Returns 'full' once it is. */
  fill(dt) {
    if (this.tank >= 0.999) return null;
    this.tank = Math.min(1, this.tank + dt / this.p.fillSeconds);
    if (this.tank < 0.999) return null;
    this.tank = 1;
    return 'full';
  }

  /** Clears the field for a new go (the debug panel, or the spray wearing off). */
  clear() {
    this.dose.fill(0);
    this.state.fill(UNSPRAYED);
    this.started = false;
    this.since = null;
    this.doneDay = null;
    this.metres = 0;
    this.last = null;
  }

  /** Fills the field at once, as if sprayed in good straight lines (the debug panel). */
  sprayAll(day) {
    this.dose.fill(1);
    this.state.fill(SPRAYED);
    this.started = true;
    this.since ??= day;
    this.doneDay = day;
  }

  // Keeping it ---------------------------------------------------------------

  /** What the farm keeps: the tank, the days, and the doses as a string with a digit (0 to 9, tenths of a dose, doubled at most) a cell. */
  toJSON() {
    let cells = '';
    for (let i = 0; i < this.cells; i++) cells += Math.min(9, Math.ceil(this.dose[i] * 4 - 1e-9)).toString(); // quarters of a dose, to 2.25 (rounded up, so a cell keeps its state)
    return { tank: Math.round(this.tank * 1000) / 1000, since: this.since, doneDay: this.doneDay, cells };
  }

  /** Puts a save back on `day`: spray older than `lastsDays` has worn off, the field is clear again. */
  restore(save, day) {
    this.clear();
    this.boom = 0;
    this.boomWant = false;
    this.tank = Number.isFinite(save?.tank) ? Math.max(0, Math.min(1, save.tank)) : 1;
    if (!save || typeof save.cells !== 'string' || !Number.isInteger(save.since)) return;
    const marked = Number.isInteger(save.doneDay) ? save.doneDay : save.since;
    if (day - marked >= this.p.lastsDays) return;
    for (let i = 0; i < this.cells && i < save.cells.length; i++) {
      const d = Number(save.cells[i]) / 4;
      if (Number.isFinite(d)) {
        this.dose[i] = d;
        this.state[i] = stateOf(d, this.p);
      }
    }
    this.since = save.since;
    this.doneDay = Number.isInteger(save.doneDay) ? save.doneDay : null;
    this.started = this.count(UNSPRAYED) < this.cells;
  }

  describe() {
    return `${this.phase}: ${Math.round(this.coverage * 100)}% covered, ${Math.round(this.overlap * 100)}% twice, tank ${Math.round(this.tank * 100)}%, boom ${this.out ? 'out' : this.boom > 0 ? 'moving' : 'in'}`;
  }
}

/** The runs of one state along each row, for drawing the lines on the map: [{ row, from, to, state }], from/to as metres in x. */
export function sprayRuns(sp) {
  const runs = [];
  for (let r = 0; r < sp.rows; r++) {
    let c = 0;
    while (c < sp.cols) {
      const st = sp.state[r * sp.cols + c];
      let e = c + 1;
      while (e < sp.cols && sp.state[r * sp.cols + e] === st) e++;
      if (st !== UNSPRAYED) runs.push({ z: sp.rect.minZ + r * SPRAY_CELL, x0: sp.rect.minX + c * SPRAY_CELL, x1: sp.rect.minX + e * SPRAY_CELL, state: st });
      c = e;
    }
  }
  return runs;
}
