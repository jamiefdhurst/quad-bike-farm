// Mist on the inside of a cab's glass. Pure logic, no Three or DOM: how people's breath and wet clothes fog it on a cold wet day, how the
// heater clears it, what a wiper, a sleeve or a finger does to it. effects/cabMistView.js draws it.
//
// The windscreen is a grid of cells over the rain glass's frame (screenRain.js: x across, y up the glass, metres), each 0 clear to 1 fogged,
// with the cells off the glass (a Tor's or Crag's centre post, a car's top corners) never fogging. The side windows and the back are one
// number between them (`rest`): they fog with the screen and clear last, with no pattern to them.

export const DEFAULT_CAB_MIST_PARAMS = {
  cell: 0.015, // metres across a cell of the screen's grid: small enough for a finger's line
  fogSeconds: 130, // seconds one person takes to fog a clear screen right over, in cold air and full wet
  dryFog: 0.25, // how much fog a dry cold day still makes, against a wet one (1)
  airBelow: 16, // air temperature (°C) below which breath fogs the glass at all
  airFull: 3, // and the air temperature at which it fogs most
  edgeBias: 1.2, // how much faster the top and the edges fog than the middle (thickest there)
  heaterFrom: 0.3, // engine warmth (0..1) from which the heater blows warm
  heaterFull: 0.8, // and from which it blows hot
  clearSeconds: 45, // seconds the heater takes to clear the fan it reaches, at full heat
  fanBase: 0.06, // how wide, as a share of the glass, the fan is at a demister slot
  fanSpread: 0.45, // and how much wider it grows for each share of the glass height up
  fanReach: 1.1, // how far up, as a share of the glass height, the fan gets at full heat
  fanOutside: 0.12, // the clearing outside the fan, against inside it (so it all goes in the end)
  restClear: 0.25, // the side windows' and the back's clearing, against the screen's: they are last
  idleClearSeconds: 600, // seconds a cold cab with nobody in it takes to dry out
  runFrom: 0.55, // how fogged the screen must be, 0..1, before drops start running down it
  runRate: 0.25, // new running drops a second on a fully fogged screen
  runSpeed: 0.05, // metres a second a drop runs
  runClear: 0.15, // what is left of the fog in a drop's track, 0..1 of what it was
  sayAbove: 0.5, // how fogged the screen is, 0..1, when a girl says so while you drive
  sayAfter: 3, // seconds it has been that bad
  sayReset: 0.2, // and how clear it must get before she'll say it again
  actAfter: 3, // seconds after she says it that she wipes her side or draws on it
  actMin: 0.3, // she only does when the screen is at least this fogged
};

export const CAB_MIST_PARAM_RANGES = {
  cell: [0.008, 0.04, 0.001],
  fogSeconds: [10, 600, 5],
  dryFog: [0, 1, 0.01],
  airBelow: [0, 25, 0.5],
  airFull: [-10, 15, 0.5],
  edgeBias: [0, 4, 0.1],
  heaterFrom: [0, 1, 0.01],
  heaterFull: [0.1, 1, 0.01],
  clearSeconds: [5, 300, 5],
  fanBase: [0, 0.3, 0.01],
  fanSpread: [0, 1.5, 0.05],
  fanReach: [0.2, 2, 0.05],
  fanOutside: [0, 1, 0.01],
  restClear: [0.05, 1, 0.01],
  idleClearSeconds: [30, 3600, 30],
  runFrom: [0.2, 1, 0.01],
  runRate: [0, 2, 0.05],
  runSpeed: [0.01, 0.3, 0.005],
  runClear: [0, 1, 0.01],
  sayAbove: [0.2, 1, 0.01],
  sayAfter: [0, 20, 0.5],
  sayReset: [0, 0.6, 0.01],
  actAfter: [0, 20, 0.5],
  actMin: [0, 1, 0.01],
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** The glass of `panes` (as screenRain.js has them: each an array of [x, y] corners, convex) as a grid of cells. */
export function createCabMist(panes, P = DEFAULT_CAB_MIST_PARAMS) {
  const xs = panes.flat().map((c) => c[0]);
  const ys = panes.flat().map((c) => c[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const cols = Math.max(4, Math.ceil((box[2] - box[0]) / P.cell));
  const rows = Math.max(4, Math.ceil((box[3] - box[1]) / P.cell));
  const m = { panes, box, cols, rows, cells: new Float32Array(cols * rows), on: new Uint8Array(cols * rows), rest: 0, streaks: [], due: 0, cover: 0, onCount: 0 };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const [x, y] = cellCentre(m, i, j);
    if (paneContains(panes, x, y)) {
      m.on[j * cols + i] = 1;
      m.onCount++;
    }
  }
  return m;
}

function paneContains(panes, x, y) {
  return panes.some((p) => {
    let sign = 0;
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i];
      const [x1, y1] = p[(i + 1) % p.length];
      const c = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
      if (c === 0) continue;
      if (sign === 0) sign = Math.sign(c);
      else if (Math.sign(c) !== sign) return false;
    }
    return true;
  });
}

/** The middle of cell (i, j) in the glass's frame; j counts up from the glass's foot. */
export function cellCentre(m, i, j) {
  return [m.box[0] + ((i + 0.5) / m.cols) * (m.box[2] - m.box[0]), m.box[1] + ((j + 0.5) / m.rows) * (m.box[3] - m.box[1])];
}

/** How fogged the screen is overall, 0..1: the mean over its glass. */
export function cabMistCover(m) {
  if (!m.onCount) return 0;
  let s = 0;
  for (let k = 0; k < m.cells.length; k++) if (m.on[k]) s += m.cells[k];
  return (m.cover = s / m.onCount);
}

/**
 * How fast the glass fogs and how hot the heater blows, from what is going on in the cab.
 * @param {{people:number, wet:number, air:number, warmth:number, running:boolean}} s  people aboard, how wet the day is (0..1), the air
 *   temperature, the engine's warmth (0 cold .. 1 warm) and whether it's running
 * @returns {{fog:number, heater:number}} fog: share of a full screen a second (1 = fogs from clear to full in the time it takes at 1 person)
 */
export function cabMistRates(s, P = DEFAULT_CAB_MIST_PARAMS) {
  const air = clamp01((P.airBelow - s.air) / Math.max(0.5, P.airBelow - P.airFull));
  const wet = P.dryFog + (1 - P.dryFog) * clamp01(s.wet);
  const fog = (Math.max(0, Math.min(4, s.people)) * air * wet) / P.fogSeconds;
  const heater = s.running ? clamp01((s.warmth - P.heaterFrom) / Math.max(0.05, P.heaterFull - P.heaterFrom)) : 0;
  return { fog, heater };
}

/**
 * Time passing on the glass. Returns whether the screen changed, so the view knows to redraw.
 * @param {{fog:number, heater:number, slots:number[], people:number}} s  from cabMistRates; the demister slots as shares across the glass
 *   (0 left .. 1 right); and how many are aboard
 * @param {() => number} random
 */
export function updateCabMist(m, dt, s, random, P = DEFAULT_CAB_MIST_PARAMS) {
  const idle = s.people === 0 && s.heater === 0 ? dt / P.idleClearSeconds : 0;
  const heat = (s.heater * dt) / P.clearSeconds;
  const reach = s.heater * P.fanReach;
  let changed = false;
  for (let j = 0; j < m.rows; j++) {
    const v = (j + 0.5) / m.rows; // 0 at the foot, 1 at the top
    const pinned = Math.abs(v - 0.5) * 2;
    for (let i = 0; i < m.cols; i++) {
      const k = j * m.cols + i;
      if (!m.on[k]) continue;
      const u = (i + 0.5) / m.cols;
      const edge = Math.max(pinned, Math.abs(u - 0.5) * 2) ** 2; // 0 in the middle, 1 at the rim
      const bias = 1 + P.edgeBias * Math.max(edge, v * v);
      let c = m.cells[k] + s.fog * bias * dt;
      if (heat > 0) {
        let inFan = false;
        if (v <= reach) for (const slot of s.slots) if (Math.abs(u - slot) <= P.fanBase + v * P.fanSpread) inFan = true;
        c -= heat * (inFan ? 1 - 0.6 * v : P.fanOutside);
      }
      c -= idle;
      c = clamp01(c);
      if (c !== m.cells[k]) changed = true;
      m.cells[k] = c;
    }
  }
  const was = m.rest;
  m.rest = clamp01(m.rest + s.fog * 1.4 * dt - heat * P.restClear - idle);
  if (m.rest !== was) changed = true;
  const cover = cabMistCover(m);
  if (runDrops(m, dt, cover, random, P)) changed = true;
  return changed;
}

/** Heavy mist runs: a drop starts near the top, runs down the glass and leaves a clear streak behind it. */
function runDrops(m, dt, cover, random, P) {
  let changed = false;
  if (cover > P.runFrom && m.streaks.length < 14) {
    m.due += P.runRate * dt * ((cover - P.runFrom) / (1 - P.runFrom + 0.01) + 0.2);
    while (m.due >= 1) {
      m.due -= 1;
      const u = 0.05 + random() * 0.9;
      m.streaks.push({ u, v: 0.95 - random() * 0.2, speed: P.runSpeed * (0.7 + random() * 0.6) });
    }
  } else m.due = 0;
  const h = m.box[3] - m.box[1];
  for (let n = m.streaks.length - 1; n >= 0; n--) {
    const d = m.streaks[n];
    d.v -= (d.speed * dt) / h;
    if (d.v <= 0) {
      m.streaks.splice(n, 1);
      continue;
    }
    const i = Math.min(m.cols - 1, Math.floor(d.u * m.cols));
    const j = Math.min(m.rows - 1, Math.floor(d.v * m.rows));
    const k = j * m.cols + i;
    if (m.on[k] && m.cells[k] > 0.05) {
      m.cells[k] *= P.runClear;
      changed = true;
    }
  }
  return changed;
}

/** The angle of a wiper blade at `blade` 0..1 (the same sum as screenRain.js's). */
const bladeAngle = (w, blade) => w.park + w.sweep * blade;

/**
 * A blade moving from `from` to `to` (each 0..1) wipes the sector it passed over clear (the same wiper shapes as screenRain.js's
 * `wipeSector`, from `wiperGeometry`). Returns how many cells it cleared.
 */
export function wipeCabMistSector(m, w, from, to) {
  if (from === to) return 0;
  const a0 = bladeAngle(w, from);
  const span = bladeAngle(w, to) - a0;
  const lo = Math.min(0, span) - 0.03;
  const hi = Math.max(0, span) + 0.03;
  let cleared = 0;
  for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) {
    const k = j * m.cols + i;
    if (!m.on[k] || m.cells[k] <= 0) continue;
    const [x, y] = cellCentre(m, i, j);
    const dx = x - w.px;
    const dy = y - w.py;
    const dist = Math.hypot(dx, dy);
    if (dist < w.rIn || dist > w.rOut) continue;
    let rel = Math.atan2(dy, dx) - a0;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (rel < lo || rel > hi) continue;
    m.cells[k] = 0;
    cleared++;
  }
  return cleared;
}

/**
 * A sleeve or a hand across the glass: clears a patch round (x, y) of radius r, wholly in the middle and less towards the edge, so the
 * edge is smeared. Returns how many cells it cleared.
 */
export function wipePatch(m, x, y, r) {
  let cleared = 0;
  const [x0, y0, x1, y1] = m.box;
  const i0 = Math.max(0, Math.floor(((x - r - x0) / (x1 - x0)) * m.cols));
  const i1 = Math.min(m.cols - 1, Math.ceil(((x + r - x0) / (x1 - x0)) * m.cols));
  const j0 = Math.max(0, Math.floor(((y - r - y0) / (y1 - y0)) * m.rows));
  const j1 = Math.min(m.rows - 1, Math.ceil(((y + r - y0) / (y1 - y0)) * m.rows));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * m.cols + i;
    if (!m.on[k]) continue;
    const [cx, cy] = cellCentre(m, i, j);
    const d = Math.hypot(cx - x, cy - y) / r;
    if (d >= 1) continue;
    const keep = clamp01((d - 0.55) / 0.45) * 0.7; // clean to 55% of the way out, then a thin smear
    if (m.cells[k] > keep) {
      m.cells[k] = keep;
      cleared++;
    }
  }
  return cleared;
}

/** A sleeve drawn from one point to another: patches along the line, a stroke of clear glass with smeared edges. */
export function wipeSwipe(m, from, to, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / (r * 0.5)));
  let cleared = 0;
  for (let n = 0; n <= steps; n++) cleared += wipePatch(m, from[0] + ((to[0] - from[0]) * n) / steps, from[1] + ((to[1] - from[1]) * n) / steps, r);
  return cleared;
}

/** A finger drawing along a line of points: a thin, hard-edged line of clear glass (and a small patch at a dot). */
export function drawLine(m, points, r = 0.012) {
  let cleared = 0;
  const stamp = (x, y) => {
    const [x0, y0, x1, y1] = m.box;
    const i0 = Math.max(0, Math.floor(((x - r - x0) / (x1 - x0)) * m.cols));
    const i1 = Math.min(m.cols - 1, Math.ceil(((x + r - x0) / (x1 - x0)) * m.cols));
    const j0 = Math.max(0, Math.floor(((y - r - y0) / (y1 - y0)) * m.rows));
    const j1 = Math.min(m.rows - 1, Math.ceil(((y + r - y0) / (y1 - y0)) * m.rows));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * m.cols + i;
      if (!m.on[k]) continue;
      const [cx, cy] = cellCentre(m, i, j);
      if (Math.hypot(cx - x, cy - y) <= r + 0.5 * Math.min((x1 - x0) / m.cols, (y1 - y0) / m.rows) && m.cells[k] > 0) {
        m.cells[k] = 0;
        cleared++;
      }
    }
  };
  for (let n = 0; n < points.length; n++) {
    stamp(points[n][0], points[n][1]);
    if (n > 0) {
      const [ax, ay] = points[n - 1];
      const [bx, by] = points[n];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (r * 0.8));
      for (let s = 1; s < steps; s++) stamp(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
    }
  }
  return cleared;
}

/** The strokes of a smiley `size` metres across centred on (x, y): two eyes and a smile (each stroke a list of points). */
export function smileyStrokes(x, y, size) {
  const s = size / 2;
  const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + ((a1 - a0) * i) / n) * r, cy + Math.sin(a0 + ((a1 - a0) * i) / n) * r]);
  return [
    arc(x, y, s, 0, Math.PI * 2, 24), // the face
    [[x - s * 0.35, y + s * 0.3]], // the eyes
    [[x + s * 0.35, y + s * 0.3]],
    arc(x, y, s * 0.55, Math.PI * 1.15, Math.PI * 1.85, 10), // the smile
  ];
}

/** Which way people sit: a driver's side is the model's right, x negative in the glass's frame as in the model's. */
export function sideX(m, side, share = 0.28) {
  const mid = (m.box[0] + m.box[2]) / 2;
  return mid + side * share * (m.box[2] - m.box[0]);
}

/**
 * What the girls say and do about a misted screen: after it has been bad for `sayAfter` seconds with someone at the wheel, one girl aboard
 * says so, and a few seconds later wipes her side (Amy) or draws on it (Jess). Once per spell: the screen has to clear before she'll
 * say it again. Pure state; the game acts on the events.
 */
export class CabMistTalk {
  constructor() {
    this.bad = 0; // seconds the screen has been over the line
    this.said = false;
    this.act = null; // { girl, left } waiting to wipe or draw
  }

  /**
   * @param {{cover:number, driving:boolean, girls:string[]}} s  the screen's cover, someone is driving it, the ids of the girls aboard
   * @returns {{type:'say'|'act', girl:string}[]}
   */
  update(dt, s, random, P = DEFAULT_CAB_MIST_PARAMS) {
    const out = [];
    if (s.cover < P.sayReset) {
      this.said = false;
      this.bad = 0;
      this.act = null;
    }
    if (!s.girls.length) {
      this.act = null;
      return out;
    }
    if (!this.said) {
      this.bad = s.driving && s.cover > P.sayAbove ? this.bad + dt : 0;
      if (this.bad >= P.sayAfter) {
        this.said = true;
        const girl = s.girls[Math.floor(random() * s.girls.length)];
        out.push({ type: 'say', girl });
        this.act = { girl, left: P.actAfter };
      }
    }
    if (this.act) {
      this.act.left -= dt;
      if (this.act.left <= 0) {
        if (s.cover >= P.actMin && s.girls.includes(this.act.girl)) out.push({ type: 'act', girl: this.act.girl });
        this.act = null;
      }
    }
    return out;
  }
}

/** The look of the other glass at `rest` fog: its colour towards a grey-white and its opacity up. */
export function restGlass(rest, base) {
  return { opacity: base + (0.72 - base) * clamp01(rest), mix: clamp01(rest) * 0.85 };
}
