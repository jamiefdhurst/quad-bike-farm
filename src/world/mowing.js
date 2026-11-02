// Mowing (#76): the ride-on mower's blade and the lawns it cuts. The blade is a lever you engage (T): it turns only with the engine running, cuts
// only while the mower moves forward on grass, loads the engine and slows the drive in long grass, and thrown on gravel or tarmac it throws grit
// and dulls. The lawns are two plots (the yard's and the paddock's) as grids of cells; a pass stamps the deck's footprint, remembering the day
// and which way the mower was going, and the stripes grow back over a few days. Pure logic, no Three.js: the game feeds it where the mower is
// and what it is on, and draws what it says (world/mowView.js). Tested in tests/mowing.test.js.

export const DEFAULT_MOW_PARAMS = {
  cell: 0.5, // metres between cells of a lawn's grid
  deckWidth: 1.0, // metres across the blade cuts (a 42 inch deck, less the edges)
  deckLength: 0.5, // metres along its run that one step cuts, so a quick pass leaves no gaps between steps
  regrowDays: 5, // days for a cut stripe to grow out of sight (the longer grass is the harder it is to cut)
  minSpeed: 0.3, // m/s forward before the blade cuts anything
  spinUp: 1.2, // seconds for the blade to come up to speed once engaged (and to run down)
  idleLoad: 0.18, // the engine's load from just turning the blade
  cutLoad: 0.55, // the load added at full speed through long grass
  fullSpeed: 2.4, // m/s at which cutting takes its full load
  maxDrag: 0.6, // the share of the drive the blade can take off at full load
  gritRate: 4, // bits of grit a second thrown with the blade on a hard surface
  dullRate: 0.04, // dullness gained a second with the blade on a hard surface
  dullWidth: 0.35, // how much narrower a fully dull blade cuts
  dullLoad: 0.3, // and how much more load it puts on the engine
  doneShare: 0.85, // the share of the lawns' cells that must be cut today for the job to be done
};

export const MOW_PARAM_RANGES = {
  cell: [0.25, 1, 0.05],
  deckWidth: [0.5, 1.6, 0.05],
  deckLength: [0.2, 1.2, 0.05],
  regrowDays: [1, 20, 1],
  minSpeed: [0, 2, 0.05],
  spinUp: [0.2, 5, 0.1],
  idleLoad: [0, 0.6, 0.02],
  cutLoad: [0, 1, 0.05],
  fullSpeed: [0.5, 5, 0.1],
  maxDrag: [0, 0.9, 0.05],
  gritRate: [0, 20, 1],
  dullRate: [0, 0.5, 0.01],
  dullWidth: [0, 0.8, 0.05],
  dullLoad: [0, 1, 0.05],
  doneShare: [0.3, 1, 0.01],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The blade: its lever, how fast it is turning, how dull it is, and what it asks of the engine. */
export class MowBlade {
  constructor(params = { ...DEFAULT_MOW_PARAMS }) {
    this.p = params;
    this.engaged = false; // the lever is forward
    this.spin = 0; // 0 stopped to 1 at speed
    this.dull = 0; // 0 sharp to 1 blunt
    this.grit = 0; // seconds of grit owed
    this.out = { cutting: false, load: 0, drive: 1, width: params.deckWidth, events: [] };
  }

  /** The lever. It can only be put forward with the engine running. Returns whether it is forward now. */
  toggle(running) {
    this.engaged = running ? !this.engaged : false;
    return this.engaged;
  }

  /**
   * One step. `s`: running (the engine), speed (m/s forward, negative backwards), hard (on tarmac, gravel or bare ground), grass (how long the
   * grass under the deck is, 0 just cut to 1 long). Returns `out`: cutting, load (0..1 on the engine), drive (a factor on the drive force),
   * width (metres cut now) and events ({ type: 'grit' }).
   */
  update(dt, s) {
    const p = this.p;
    if (!s.running) this.engaged = false; // a stalled engine drops the blade
    const to = this.engaged ? 1 : 0;
    const step = dt / Math.max(0.05, p.spinUp);
    this.spin = clamp(this.spin + clamp(to - this.spin, -step, step), 0, 1);
    const events = [];
    const cutting = this.spin >= 0.8 && s.speed >= p.minSpeed && !s.hard;
    const pull = cutting ? clamp(s.grass, 0, 1) * clamp(s.speed / p.fullSpeed, 0, 1) : 0;
    const load = clamp(this.spin * (p.idleLoad + this.dull * p.dullLoad * 0.5) + pull * p.cutLoad * (1 + this.dull * p.dullLoad), 0, 1);
    if (this.spin >= 0.5 && s.hard) {
      this.dull = clamp(this.dull + p.dullRate * dt, 0, 1);
      this.grit += p.gritRate * dt * (s.speed > 0.2 ? 1 : 0.3);
      while (this.grit >= 1) {
        this.grit -= 1;
        events.push({ type: 'grit' });
      }
    } else this.grit = 0;
    this.out = { cutting, load, drive: 1 - p.maxDrag * load, width: p.deckWidth * (1 - this.dull * p.dullWidth), events };
    return this.out;
  }

  /** Overnight the blade is sharpened (a bench job for it is a later idea). */
  sharpen() {
    this.dull = 0;
  }
}

/** A lawn: its rectangle and the cells of it that have been cut, each with the day and which way the mower was going (1 forward along the run, 2 back). */
class Lawn {
  constructor(id, rect, cell) {
    this.id = id;
    this.rect = rect;
    this.cols = Math.max(1, Math.ceil((rect.maxX - rect.minX) / cell));
    this.rows = Math.max(1, Math.ceil((rect.maxZ - rect.minZ) / cell));
    this.day = new Int32Array(this.cols * this.rows).fill(-1);
    this.dir = new Uint8Array(this.cols * this.rows);
  }

  get cells() {
    return this.cols * this.rows;
  }
}

export class MowGrid {
  /** @param {{id:string, rect:{minX:number,maxX:number,minZ:number,maxZ:number}}[]} plots */
  constructor(plots, params = { ...DEFAULT_MOW_PARAMS }) {
    this.p = params;
    this.lawns = plots.map((pl) => new Lawn(pl.id, pl.rect, params.cell));
    this.dirty = true; // the picture is out of date
  }

  get cells() {
    return this.lawns.reduce((n, l) => n + l.cells, 0);
  }

  lawnAt(x, z) {
    return this.lawns.find((l) => x >= l.rect.minX && x < l.rect.maxX && z >= l.rect.minZ && z < l.rect.maxZ) ?? null;
  }

  /** How long the grass is at (x, z) on `day`: 1 uncut (and off every lawn), down to 0 just cut, growing back over `regrowDays`. */
  longness(x, z, day) {
    const l = this.lawnAt(x, z);
    if (!l) return 1;
    const c = Math.floor((x - l.rect.minX) / this.p.cell);
    const r = Math.floor((z - l.rect.minZ) / this.p.cell);
    const d = l.day[r * l.cols + c];
    return d < 0 ? 1 : clamp((day - d) / this.p.regrowDays, 0, 1);
  }

  /** The grass the deck is about to cut, averaged over three points across its front edge (just beyond what the last steps cut). */
  longnessUnder(x, z, heading, day) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const w = this.p.deckWidth * 0.4;
    const ahead = this.p.deckLength / 2 + 0.2;
    let sum = 0;
    for (const k of [-1, 0, 1]) sum += this.longness(x + fz * k * w + fx * ahead, z - fx * k * w + fz * ahead, day);
    return sum / 3;
  }

  /** Cuts the deck's footprint centred at (x, z) going `heading` (radians, forward is (sin, cos)), `width` metres across, on `day`. Returns the cells cut. */
  cut(x, z, heading, width, day) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const half = width / 2;
    const halfLen = this.p.deckLength / 2;
    const reach = Math.hypot(half, halfLen);
    const along = Math.abs(fz) >= Math.abs(fx) ? fz : fx;
    const dir = along >= 0 ? 1 : 2;
    let n = 0;
    for (const l of this.lawns) {
      const { rect } = l;
      if (x + reach < rect.minX || x - reach > rect.maxX || z + reach < rect.minZ || z - reach > rect.maxZ) continue;
      const c0 = Math.max(0, Math.floor((x - reach - rect.minX) / this.p.cell));
      const c1 = Math.min(l.cols - 1, Math.floor((x + reach - rect.minX) / this.p.cell));
      const r0 = Math.max(0, Math.floor((z - reach - rect.minZ) / this.p.cell));
      const r1 = Math.min(l.rows - 1, Math.floor((z + reach - rect.minZ) / this.p.cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const dx = rect.minX + (c + 0.5) * this.p.cell - x;
          const dz = rect.minZ + (r + 0.5) * this.p.cell - z;
          const lateral = dx * fz - dz * fx;
          const forward = dx * fx + dz * fz;
          if (Math.abs(lateral) > half || Math.abs(forward) > halfLen) continue;
          const i = r * l.cols + c;
          if (l.day[i] === day && l.dir[i] === dir) continue;
          l.day[i] = day;
          l.dir[i] = dir;
          n++;
        }
      }
    }
    if (n) this.dirty = true;
    return n;
  }

  /** How much of the lawns was cut on `day`, 0..1. */
  share(day) {
    let cut = 0;
    for (const l of this.lawns) for (let i = 0; i < l.day.length; i++) if (l.day[i] === day) cut++;
    return cut / Math.max(1, this.cells);
  }

  /** Whether enough was cut today for the job. */
  done(day) {
    return this.share(day) >= this.p.doneShare;
  }

  /** How strong the stripe on a cell shows on `day`: 1 cut today, fading to 0 when the grass has grown back (and 0 uncut). */
  stripe(lawn, i, day) {
    const d = lawn.day[i];
    return d < 0 ? 0 : clamp(1 - (day - d) / this.p.regrowDays, 0, 1);
  }

  /** Everything grows back at once (the debug panel). */
  clear() {
    for (const l of this.lawns) {
      l.day.fill(-1);
      l.dir.fill(0);
    }
    this.dirty = true;
  }

  /** Cuts every cell on `day` (the debug panel). */
  cutAll(day) {
    for (const l of this.lawns) {
      l.day.fill(day);
      for (let i = 0; i < l.dir.length; i++) l.dir[i] = (Math.floor(i / l.cols) % 2) + 1;
    }
    this.dirty = true;
  }

  /** What the farm keeps: for each lawn the cut cells (index, day and direction) that have not grown back. */
  toJSON() {
    const out = {};
    for (const l of this.lawns) {
      const cells = [];
      for (let i = 0; i < l.day.length; i++) if (l.day[i] >= 0) cells.push(i, l.day[i], l.dir[i]);
      out[l.id] = { cols: l.cols, rows: l.rows, cells };
    }
    return out;
  }

  /** Puts a save back on `day`: a cell cut `regrowDays` or more ago has grown over, and a lawn whose shape changed is forgotten. */
  restore(save, day) {
    this.clear();
    if (!save || typeof save !== 'object') return;
    for (const l of this.lawns) {
      const s = save[l.id];
      if (!s || s.cols !== l.cols || s.rows !== l.rows || !Array.isArray(s.cells)) continue;
      for (let k = 0; k + 2 < s.cells.length; k += 3) {
        const [i, d, dir] = [s.cells[k], s.cells[k + 1], s.cells[k + 2]];
        if (!Number.isInteger(i) || !Number.isInteger(d) || i < 0 || i >= l.day.length || d < 0 || day - d >= this.p.regrowDays) continue;
        l.day[i] = d;
        l.dir[i] = dir === 2 ? 2 : 1;
      }
    }
    this.dirty = true;
  }

  describe(day) {
    return `${Math.round(this.share(day) * 100)}% of the lawns cut today (needs ${Math.round(this.p.doneShare * 100)}%)`;
  }
}

/** The lawns for a layout: the yard's and the paddock's, from `layout.lawns` (an object of id to rectangle). */
export function lawnPlots(layout) {
  return Object.entries(layout.lawns ?? {}).map(([id, rect]) => ({ id, rect }));
}
