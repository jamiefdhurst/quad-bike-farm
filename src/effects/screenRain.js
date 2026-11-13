// Rain on a windscreen. Pure logic, no Three or DOM: where the drops are on the glass, how they bead, run and blow, and what a wiper
// blade passing over them does. effects/screenRainView.js draws it on the glass.
//
// Everything is in the glass's own frame, in metres: x across, y up the glass, the origin at its middle. The glass is one or more convex
// panes (a car's trapezoid, a Tor's or Crag's two flat panes), each a list of corners. A drop that lands on another joins it, so the glass
// beads up; one grown past `runFrom` runs down it, and at speed the air pushes them all up the screen, leaving streaks. When the rain stops
// they dry. A blade clears what it sweeps over.

export const DEFAULT_SCREEN_RAIN_PARAMS = {
  rainRate: 70, // drops a second per square metre of glass in full rain, standing still
  speedRate: 0.08, // and that again this share more for each m/s you drive into it
  maxDrops: 260, // the most on one screen at once
  dropMin: 0.0012, // a fresh drop's radius, metres, from this
  dropMax: 0.0026, // to this
  runFrom: 0.0034, // a drop grown this big runs down the glass
  runSpeed: 0.06, // metres a second it runs
  airFrom: 8, // m/s: faster than this the air pushes drops up the screen
  airPush: 0.014, // metres a second up the glass for each m/s past that
  dryRate: 0.00004, // metres of radius lost a second once the rain has stopped (a 3 mm drop goes in about a minute)
  trailFade: 0.5, // seconds a streak takes to fade behind a drop that stops
};

export const SCREEN_RAIN_PARAM_RANGES = {
  rainRate: [0, 300, 5],
  speedRate: [0, 0.3, 0.01],
  maxDrops: [20, 600, 10],
  dropMin: [0.0004, 0.004, 0.0001],
  dropMax: [0.0008, 0.006, 0.0001],
  runFrom: [0.0015, 0.008, 0.0001],
  runSpeed: [0, 0.3, 0.005],
  airFrom: [0, 25, 0.5],
  airPush: [0, 0.05, 0.001],
  dryRate: [0, 0.0005, 0.00001],
  trailFade: [0.05, 3, 0.05],
};

/** A glass of `panes` (each an array of [x, y] corners going round, convex). */
export function createScreenRain(panes) {
  const area = panes.reduce((a, p) => a + polygonArea(p), 0);
  const xs = panes.flat().map((c) => c[0]);
  const ys = panes.flat().map((c) => c[1]);
  return { panes, area, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], drops: [], due: 0, seq: 0 };
}

function polygonArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

/** Whether a point is on the glass: inside one of its panes. */
export function onGlass(g, x, y) {
  return g.panes.some((p) => {
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

/** One drop landing at x, y: it joins any it touches (the volumes add), or sits as a new one. */
export function addDrop(g, x, y, r, P = DEFAULT_SCREEN_RAIN_PARAMS) {
  for (const d of g.drops) {
    if (Math.hypot(d.x - x, d.y - y) < d.r + r) {
      d.r = Math.cbrt(d.r ** 3 + r ** 3);
      return d;
    }
  }
  const drop = { id: g.seq++, x, y, r, trail: 0, run: 0 };
  g.drops.push(drop);
  if (g.drops.length > P.maxDrops) g.drops.splice(0, g.drops.length - P.maxDrops); // the oldest go first
  return drop;
}

/**
 * Time passing on the glass. Returns whether anything changed, so the view knows to redraw.
 * @param {object} s  { rain (0..1, 0 under a roof), speed (m/s forwards) }
 * @param {() => number} random
 */
export function updateScreenRain(g, dt, s, random, P = DEFAULT_SCREEN_RAIN_PARAMS) {
  let changed = false;
  const rain = Math.max(0, s.rain);
  if (rain > 0) {
    g.due += rain * g.area * P.rainRate * (1 + Math.max(0, s.speed) * P.speedRate) * dt;
    const [x0, y0, x1, y1] = g.box;
    for (let tries = 0; g.due >= 1 && tries < 40; tries++) {
      const x = x0 + random() * (x1 - x0);
      const y = y0 + random() * (y1 - y0);
      if (!onGlass(g, x, y)) continue; // a point off the glass (a car screen's top corners, the Tor's or Crag's centre post): try again
      g.due -= 1;
      addDrop(g, x, y, P.dropMin + random() * (P.dropMax - P.dropMin), P);
      changed = true;
    }
    g.due = Math.min(g.due, 5); // a long frame doesn't save up a downpour
  }
  const up = Math.max(0, s.speed - P.airFrom) * P.airPush;
  for (let i = g.drops.length - 1; i >= 0; i--) {
    const d = g.drops[i];
    const run = up - (d.r >= P.runFrom ? P.runSpeed : 0); // up the glass with the air, down it when heavy
    if (run !== 0) {
      d.y += run * dt;
      d.run = run;
      d.trail = Math.min(0.12, d.trail + Math.abs(run) * dt);
      changed = true;
    } else if (d.trail > 0) {
      d.trail = Math.max(0, d.trail - (dt / P.trailFade) * 0.12);
      changed = true;
    }
    if (rain <= 0) {
      d.r -= P.dryRate * dt;
      changed = true;
    }
    if (d.r < 0.0005 || !onGlass(g, d.x, d.y)) g.drops.splice(i, 1);
  }
  return changed;
}

/** The angle round a wiper's spindle of its blade when it is at `blade` (0 parked .. 1 at the far end). */
export function bladeAngle(w, blade) {
  return w.park + w.sweep * blade;
}

/**
 * A blade moving from `from` to `to` (each 0..1) clears every drop in the sector it passed over.
 * @param {{px:number, py:number, rIn:number, rOut:number, park:number, sweep:number}} w  the spindle on the glass, how far along the arm the
 *   blade starts and ends, its parked angle (radians, from +x towards +y) and the signed angle of a full sweep
 * @returns {number} how many it cleared
 */
export function wipeSector(g, w, from, to) {
  if (from === to) return 0;
  const a0 = bladeAngle(w, from);
  const span = bladeAngle(w, to) - a0;
  const lo = Math.min(0, span) - 0.03; // a little either side, as the blade has a width
  const hi = Math.max(0, span) + 0.03;
  let cleared = 0;
  for (let i = g.drops.length - 1; i >= 0; i--) {
    const d = g.drops[i];
    const dx = d.x - w.px;
    const dy = d.y - w.py;
    const dist = Math.hypot(dx, dy);
    if (dist < w.rIn - d.r || dist > w.rOut + d.r) continue;
    let rel = Math.atan2(dy, dx) - a0;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel)); // -pi..pi from where the blade started
    if (rel < lo || rel > hi) continue;
    g.drops.splice(i, 1);
    cleared++;
  }
  return cleared;
}

/** How much of the glass is covered, 0..1: for the panel and the console. */
export function screenCover(g) {
  let c = 0;
  for (const d of g.drops) c += Math.PI * d.r * d.r;
  return g.area ? Math.min(1, (c / g.area) * 40) : 0; // (a drop blurs a patch of view much bigger than itself)
}
