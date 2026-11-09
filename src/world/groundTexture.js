// Paints the farm's ground on a canvas, a window of it at a time (see "Painting the ground a window at a time" below): grass with blotchy
// variation, the neighbouring farmland beyond the hedges, the stubble fields and the tarmac road, the muddy track with ruts and puddles, and worn
// patches in the yard and gateways.

import { patchColor, patchBlend } from './patchwork.js';
import { createOutbuildings } from './outbuildings.js';
import { roadNetwork, pointAt } from './roads.js';

function rand(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function noiseCanvas(size, random, colorFn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b, a] = colorFn(random());
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Tiling greyscale noise used as a close-up detail layer. */
export function createDetailCanvas(size = 256) {
  const random = rand(7);
  const coarse = noiseCanvas(32, random, (v) => {
    const g = 110 + v * 120;
    return [g, g, g, 255];
  });
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  // Draw the coarse layer tiled 3x3 so the smoothing wraps at the edges.
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) ctx.drawImage(coarse, i * size, j * size, size, size);
  }
  const fine = noiseCanvas(size, random, (v) => {
    const g = v * 255;
    return [g, g, g, 90];
  });
  ctx.drawImage(fine, 0, 0);
  return c;
}

// ---- Painting the ground a window at a time -------------------------------------------------------------------------------------------------
//
// The ground is painted as you come near it, a tile at a time (groundPaint.js), and once coarsely over the whole of it for what is far off. Both
// run the same painters over a `window`, a rectangle of the ground in metres, onto a canvas that holds just that. So that one window paints exactly
// what the next does where they meet, no random number is drawn in order: each belongs to what it is for (cell 12, 40 of the pit's floor; stone
// 8,031) and comes from `hash01` or `itemRandom`, the same whichever window is being painted and whatever else is skipped.

const mix = (a, b) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};

/** A number from 0 to 1 for cell (i, j) of kind `salt`: the same every time. */
export const hash01 = (salt, i, j = 0) => mix(mix(salt, i | 0), j | 0) / 4294967296;

/** A stream of numbers from 0 to 1 for item `i` of kind `salt` (a stone, a leaf): the same every time, and nothing to do with the other items'. */
export function itemRandom(salt, i) {
  let a = mix(salt, i | 0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// What each kind of random number is for.
const S = {
  blotch: 1, mid: 2, fine: 3, stubble: 10, hillGrass: 20, tussock: 21, woodEdge: 22, woodCell: 23, laneA: 24, laneB: 25, stream: 26, ford: 27, paddock: 28, mud: 29, tuft: 30, pondA: 31,
  woodFloor: 40, leaf: 41, trailSpeck: 42, rootA: 43, mottleWood: 44, pondB: 45, quarryField: 50, grit: 51, gritJ: 52, stone: 53, heap: 54, fleck: 55, pondC: 56,
  barnWear: 60, straw: 61, mottle: 62, bog: 63,
};

const INFINITE = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
const WORK = 2500; // canvas calls (or about that much else) between one pause and the next, a millisecond or so

/**
 * What the painters draw with: a canvas `ctx` that holds the ground's rectangle `win` ({ minX, maxX, minZ, maxZ }, metres) at `s` pixels a metre.
 * `fine` is whether detail finer than a pixel or two is worth drawing (not on the coarse overview), and `due(n)` says when to pause.
 */
export function paintContext(ctx, win, s, { fine = s >= 4, toPx } = {}) {
  let work = 0;
  return {
    ctx,
    win,
    s,
    fine,
    toPx: toPx ?? ((x, z) => [(x - win.minX) * s, (z - win.minZ) * s]),
    /** Whether (x, z) is within `m` metres of the window. */
    inWin: (x, z, m = 0) => x > win.minX - m && x < win.maxX + m && z > win.minZ - m && z < win.maxZ + m,
    /** Whether the rectangle `r` is within `m` metres of the window. */
    over: (r, m = 0) => r.maxX > win.minX - m && r.minX < win.maxX + m && r.maxZ > win.minZ - m && r.minZ < win.maxZ + m,
    /** Count `n` more calls' worth of work and say whether it is time to pause (the caller yields). */
    due: (n = 1) => ((work += n) >= WORK ? ((work = 0), true) : false),
  };
}

/** The indices `k` of `lo + k * step` (below `hi`) that fall within a window's span `wlo` to `whi` widened by `margin`: [from, to). */
function span(lo, hi, step, wlo, whi, margin = 0) {
  const k0 = Math.max(0, Math.floor((wlo - margin - lo) / step));
  const k1 = Math.min(Math.ceil((hi - lo) / step), Math.ceil((whi + margin - lo) / step));
  return [k0, Math.max(k0, k1)];
}

/** Whether a run of [x, z] points (or { x, z }) has any piece within `m` metres of the window. */
function pathNear(c, pts, m, closed = false) {
  const get = (p) => (Array.isArray(p) ? p : [p.x, p.z]);
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, az] = get(pts[i]);
    const [bx, bz] = get(pts[(i + 1) % pts.length]);
    if (c.over({ minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz) }, m)) return true;
  }
  return false;
}

/** Everything the painters need that is the same for every window, made once: the outbuildings, the roads and their speckle. */
export function createGroundPlan({ track, layout, fields, puddles = [], bogs = [], autumn = false }) {
  const net = roadNetwork(layout);
  const roads = net.roads.filter((r) => r.draw === 'ground').map((road) => ({ road, plan: planRoad(road, fields, rand(5)) }));
  return { track, layout, fields, puddles, bogs, autumn, ob: createOutbuildings(layout), roads };
}

/**
 * Paints `plan` (createGroundPlan) over the window of `c` (paintContext), as a generator that pauses now and then: run it with `.next()` for as
 * long as there is time. The grass, the farmland beyond the hedges, the stubble fields, the tarmac, the hill, the wood and the pit, the worn
 * yard and gateways, the muddy track with its ruts, then the bogs and puddles.
 */
export function* paintGround(plan, c) {
  const { ctx, win, s } = c;
  const { track, layout, fields, puddles, bogs, autumn } = plan;
  yield* paintBase(c);
  yield;
  if (fields) {
    paintPatchwork(c, fields);
    yield;
    paintStubble(c, fields);
    for (const { road, plan: roadPlan } of plan.roads) drawRoad(c, road, roadPlan, fields);
    yield;
    if (fields.hill) yield* paintHill(c, fields);
    if (fields.woods) yield* paintWoods(c, fields, autumn);
    if (fields.quarry) yield* paintQuarry(c, fields.quarry);
  }

  // Worn yard and gateway.
  const wear = (x, z, r, color) => {
    if (!c.inWin(x, z, r)) return;
    const [px, pz] = c.toPx(x, z);
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, r * s);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r * s, pz - r * s, r * 2 * s, r * 2 * s);
  };
  const { yard, gate, fieldHalf } = layout;
  wear(yard.x, yard.z, yard.radius * 0.8, 'rgba(105,92,66,0.85)');
  wear(yard.x - 4, yard.z + 2, yard.radius * 0.45, 'rgba(92,80,58,0.7)');
  wear(gate.x, fieldHalf - 3, 7, 'rgba(90,72,48,0.8)');
  if (layout.road) wear(fieldHalf - 4, layout.road.z, 6, 'rgba(90,72,48,0.6)'); // the quads cut the corner onto the road
  paintOutbuildings(c, plan, wear); // its own draws, leaving the rest of the ground as it was
  yield;

  // Track.
  const pts = track.points;
  const onTrack = pathNear(c, pts, 6, true);
  const strokeLoop = (offset, widthM, style, alpha = 1, blur = 0) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = widthM * s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i++) {
      const a = pts[i % pts.length];
      const b = pts[(i + 1) % pts.length];
      const tx = b[0] - a[0];
      const tz = b[1] - a[1];
      const tl = Math.hypot(tx, tz) || 1;
      const [px, pz] = c.toPx(a[0] - (tz / tl) * offset, a[1] + (tx / tl) * offset);
      if (i === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    }
    ctx.stroke();
    ctx.restore();
  };
  const hw = layout.trackHalfWidth;
  if (onTrack) {
    strokeLoop(0, hw * 2 + 2.4, '#6e6440', 0.55, 6);
    strokeLoop(0, hw * 2 + 0.6, '#5b4a31', 0.9, 3);
    strokeLoop(0, hw * 2 - 0.4, '#54422b', 1, 1);
    strokeLoop(0, 1.0, '#4d3c27', 0.6, 2);
    // Grass strip between the ruts.
    strokeLoop(0, 0.35, '#5d6436', 0.35, 1);
    for (const off of [-0.7, 0.7]) {
      strokeLoop(off, 0.45, '#3b2c1c', 0.85, 1);
      strokeLoop(off, 0.15, '#2f2316', 0.7, 0);
    }
    yield;

    // Mottling on the mud so it isn't a flat colour.
    if (c.fine) {
      for (let i = 0; i < 6000; i++) {
        const random = itemRandom(S.mottle, i);
        const p = track.sample(random());
        const lat = (random() * 2 - 1) * hw;
        const x = p.x - p.tz * lat;
        const z = p.z + p.tx * lat;
        const rr = 0.1 + random() * 0.35;
        const dark = random() < 0.55;
        const sq = 1 + random();
        const turn = random() * Math.PI;
        if (!c.inWin(x, z, rr * 2)) continue;
        const [px, pz] = c.toPx(x, z);
        ctx.fillStyle = dark ? 'rgba(40,30,18,0.35)' : 'rgba(120,100,70,0.25)';
        ctx.beginPath();
        ctx.ellipse(px, pz, rr * s * sq, rr * s, turn, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Bogs: a churned, dark, wet patch with a ragged edge.
  bogs.forEach((b, bi) => {
    if (!c.inWin(b.x, b.z, b.radius * 1.2)) return;
    const [px, pz] = c.toPx(b.x, b.z);
    const r = b.radius * 1.15 * s;
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, r);
    g.addColorStop(0, 'rgba(30,22,13,0.97)');
    g.addColorStop(0.55, 'rgba(38,28,16,0.9)');
    g.addColorStop(0.8, 'rgba(52,40,24,0.55)');
    g.addColorStop(1, 'rgba(52,40,24,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r, pz - r, r * 2, r * 2);
    if (!c.fine) return;
    for (let i = 0; i < 60; i++) {
      const random = itemRandom(S.bog, bi * 100 + i);
      const a = random() * Math.PI * 2;
      const d = Math.sqrt(random()) * r * 0.8;
      ctx.fillStyle = random() < 0.5 ? 'rgba(20,14,8,0.5)' : 'rgba(70,55,35,0.35)';
      ctx.beginPath();
      ctx.ellipse(px + Math.cos(a) * d, pz + Math.sin(a) * d, (0.15 + random() * 0.4) * s, (0.08 + random() * 0.2) * s, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Puddle surrounds, darker and wetter.
  for (const p of puddles) {
    if (!c.inWin(p.x, p.z, layout.puddleRadius * 1.3)) continue;
    const [px, pz] = c.toPx(p.x, p.z);
    const r = layout.puddleRadius * 1.3 * s;
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, r);
    g.addColorStop(0, 'rgba(38,28,18,0.95)');
    g.addColorStop(0.7, 'rgba(48,36,22,0.7)');
    g.addColorStop(1, 'rgba(48,36,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r, pz - r, r * 2, r * 2);
  }
}

/** Grass with blotchy variation: three layers of smoothed noise, 8.75 m, 1.6 m and 0.4 m across (the last only where a pixel is smaller than it). */
function* paintBase(c) {
  const { ctx, win, s } = c;
  ctx.fillStyle = '#5f7d3b';
  ctx.fillRect(0, 0, Math.ceil((win.maxX - win.minX) * s), Math.ceil((win.maxZ - win.minZ) * s));
  noiseLayer(c, 8.75, S.blotch, (v) => [70 + v * 50, 100 + v * 45, 40 + v * 20, 120]);
  yield;
  noiseLayer(c, 420 / 256, S.mid, (v) => [60 + v * 60, 90 + v * 60, 35 + v * 25, 70]);
  yield;
  if (c.fine) noiseLayer(c, 420 / 1024, S.fine, (v) => (v > 0.5 ? [140, 160, 80, 40] : [30, 50, 20, 50]));
}

/** Noise in squares `cell` metres across, kept where they are on the ground whatever the window, drawn smoothed over the window. */
function noiseLayer(c, cell, salt, colorFn) {
  const { ctx, win, s } = c;
  const i0 = Math.floor(win.minX / cell) - 1;
  const j0 = Math.floor(win.minZ / cell) - 1;
  const nx = Math.ceil(win.maxX / cell) + 1 - i0;
  const nz = Math.ceil(win.maxZ / cell) + 1 - j0;
  const cv = document.createElement('canvas');
  cv.width = nx;
  cv.height = nz;
  const g = cv.getContext('2d');
  const img = g.createImageData(nx, nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const [r, gr, b, a] = colorFn(hash01(salt, i0 + i, j0 + j));
      const o = (j * nx + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = gr;
      img.data[o + 2] = b;
      img.data[o + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cv, (i0 * cell - win.minX) * s, (j0 * cell - win.minZ) * s, nx * cell * s, nz * cell * s);
}

/**
 * The hill through the south gate (world/hill.js): the pasture's rough, coarser and yellower than the grass field, browner under the
 * bracken; leaf litter in the wood; the lane's two worn wheel tracks with grass up the middle, muddy down to the ford; and the stream's bed,
 * dark silt along it and pale gravel where the ford is.
 */
function* paintHill(c, fields) {
  const { ctx, s, win } = c;
  const hill = fields.hill;
  const p = hill.pasture;
  const fine = c.fine;
  const cell = (x, z, w, h, color) => {
    const [px, pz] = c.toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  if (c.over(p, 2)) {
    const [ax0, ax1] = span(p.minX, p.maxX, 1, win.minX, win.maxX, 1);
    const [az0, az1] = span(p.minZ, p.maxZ, 1, win.minZ, win.maxZ, 1);
    for (let kx = ax0; kx < ax1; kx++) {
      for (let kz = az0; kz < az1; kz++) {
        const x = p.minX + kx;
        const z = p.minZ + kz;
        const v = hash01(S.hillGrass, kx, kz);
        cell(x, z, 1, 1, `rgba(${130 + v * 40},${128 + v * 30},${60 + v * 20},0.22)`);
        const b = hill.brackenAt(x + 0.5, z + 0.5);
        if (b > 0) cell(x, z, 1, 1, `rgba(${88 + v * 30},${80 + v * 20},${42},${0.45 * b})`);
        if (hill.gorseAt(x + 0.5, z + 0.5) > 0.3) cell(x, z, 1, 1, 'rgba(50,62,30,0.35)');
      }
      if (c.due((az1 - az0) * 3)) yield;
    }
    // Tussocks: little dark and light clumps.
    if (fine) {
      for (let i = 0; i < 9000; i++) {
        const random = itemRandom(S.tussock, i);
        const x = p.minX + random() * (p.maxX - p.minX);
        const z = p.minZ + random() * (p.maxZ - p.minZ);
        const dark = random() < 0.5;
        const rx = (0.2 + random() * 0.3) * s;
        const rz = (0.15 + random() * 0.2) * s;
        const turn = random() * Math.PI;
        if (!c.inWin(x, z, 1)) continue;
        const [px, pz] = c.toPx(x, z);
        ctx.fillStyle = dark ? 'rgba(45,60,25,0.35)' : 'rgba(170,165,95,0.3)';
        ctx.beginPath();
        ctx.ellipse(px, pz, rx, rz, turn, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    yield;
    // The wood's floor, its edge ragged.
    const wood = hill.inWood;
    const ws = fine ? 0.5 : 2;
    const [bx0, bx1] = span(p.minX, p.maxX, ws, win.minX, win.maxX, 3);
    const [bz0, bz1] = span(p.minZ, p.maxZ, ws, win.minZ, win.maxZ, 3);
    for (let kx = bx0; kx < bx1; kx++) {
      for (let kz = bz0; kz < bz1; kz++) {
        const x = p.minX + kx * ws;
        const z = p.minZ + kz * ws;
        if (!wood(x, z, -2 + hash01(S.woodEdge, kx, kz) * 4)) continue;
        const v = hash01(S.woodCell, kx, kz);
        cell(x, z, ws, ws, `rgba(${70 + v * 30},${52 + v * 20},${30 + v * 12},0.7)`);
      }
      if (c.due((bz1 - bz0) * 2)) yield;
    }
  }

  // The lane: two wheel tracks the length of it, worn bare, with the grass between; mud towards the ford.
  const lane = hill.lane;
  const end = hill.farEdge(lane.x) + 3;
  const ls = fine ? 0.25 : 0.5;
  if (c.over({ minX: lane.x - 2, maxX: lane.x + 2, minZ: hill.top - 2, maxZ: end }, 2)) {
    const [lz0, lz1] = span(hill.top - 2, end, ls, win.minZ, win.maxZ, 2);
    for (let k = lz0; k < lz1; k++) {
      const z = hill.top - 2 + k * ls;
      for (const [side, off] of [[0, -0.75], [1, 0.75]]) {
        const random = itemRandom(S.laneA + side * 100, k);
        const muddy = Math.min(1, Math.max(0, (z - (hill.streamZ(lane.x) - 12)) / 8));
        const [px, pz] = c.toPx(lane.x + off + (random() - 0.5) * 0.1, z);
        ctx.fillStyle = muddy > 0.2 ? `rgba(60,45,28,${0.75 + 0.2 * muddy})` : 'rgba(110,92,62,0.8)';
        ctx.beginPath();
        ctx.ellipse(px, pz, (0.32 + random() * 0.1) * s, 0.2 * s * (ls / 0.25) ** 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (hill.west) yield* paintPaddocks(c, hill);

  // The stream's bed: silt along it, the ford's gravel pale and stony.
  const ss = fine ? 0.5 : 1;
  const [sx0, sx1] = span(p.minX - 3, p.maxX + 3, ss, win.minX, win.maxX, 3);
  for (let kx = sx0; kx < sx1; kx++) {
    const x = p.minX - 3 + kx * ss;
    const sz = hill.streamZ(x);
    const half = hill.halfAt(x);
    const zlo = sz - half - 1;
    const [kz0, kz1] = span(zlo, sz + half + 1, ss, win.minZ, win.maxZ, 1);
    for (let kz = kz0; kz < kz1; kz++) {
      const z = zlo + kz * ss;
      const r = Math.abs(z - sz) / (half + 1);
      const ford = Math.abs(x - lane.x) < lane.halfWidth + 2.5;
      const v = hash01(S.stream, Math.round(x / ss), Math.round(z / ss));
      const color = ford ? `rgba(${120 + v * 40},${110 + v * 35},${90 + v * 30},${0.9 - r * 0.4})` : `rgba(${50 + v * 20},${42 + v * 15},${30 + v * 10},${0.95 - r * 0.5})`;
      cell(x, z, ss, ss, color);
    }
    if (c.due(kz1 - kz0)) yield;
  }
  // Stones in the ford.
  if (fine) {
    for (let i = 0; i < 500; i++) {
      const random = itemRandom(S.ford, i);
      const x = lane.x + (random() - 0.5) * (lane.halfWidth * 2 + 5);
      const z = hill.streamZ(x) + (random() - 0.5) * hill.halfAt(x) * 2.2;
      const light = random() < 0.5;
      const rx = (0.05 + random() * 0.1) * s;
      const rz = (0.04 + random() * 0.08) * s;
      const turn = random() * Math.PI;
      if (!c.inWin(x, z, 1)) continue;
      const [px, pz] = c.toPx(x, z);
      ctx.fillStyle = light ? 'rgba(165,155,135,0.8)' : 'rgba(85,78,65,0.7)';
      ctx.beginPath();
      ctx.ellipse(px, pz, rx, rz, turn, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * The two fields beside the lane: rough grazing like the pasture's but greener, the wet meadow's sedgy patches and the pond's silt, and the mud
 * of the track in to the water and round the gateways (hill.mudAt).
 */
function* paintPaddocks(c, hill) {
  const { ctx, s, win } = c;
  const fine = c.fine;
  const cell = (x, z, w, h, color) => {
    const [px, pz] = c.toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  [hill.west, hill.east].forEach((r, ri) => {
    if (!c.over(r, 2)) return;
    paddockCells(c, hill, r, ri, cell);
  });
  yield;
  for (const [ri, r] of [hill.west, hill.east].entries()) {
    if (!fine || !c.over(r, 2)) continue;
    for (let i = 0; i < 3000; i++) {
      const random = itemRandom(S.tuft + ri * 10, i);
      const x = r.minX + random() * (r.maxX - r.minX);
      const z = r.minZ + random() * (r.maxZ - r.minZ);
      const dark = random() < 0.5;
      const rx = (0.2 + random() * 0.3) * s;
      const rz = (0.15 + random() * 0.2) * s;
      const turn = random() * Math.PI;
      if (!c.inWin(x, z, 1)) continue;
      const [px, pz] = c.toPx(x, z);
      ctx.fillStyle = dark ? 'rgba(45,62,28,0.32)' : 'rgba(165,160,95,0.28)';
      ctx.beginPath();
      ctx.ellipse(px, pz, rx, rz, turn, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Rushes in dark patches round the pond, the silt of its bed under the water.
  const pond = hill.pond;
  const ps = fine ? 0.5 : 1;
  const [px0, px1] = span(pond.x - pond.rx * 1.4, pond.x + pond.rx * 1.4, ps, win.minX, win.maxX, 1);
  const [pz0, pz1] = span(pond.z - pond.rz * 1.4, pond.z + pond.rz * 1.4, ps, win.minZ, win.maxZ, 1);
  for (let kx = px0; kx < px1; kx++) {
    for (let kz = pz0; kz < pz1; kz++) {
      const x = pond.x - pond.rx * 1.4 + kx * ps;
      const z = pond.z - pond.rz * 1.4 + kz * ps;
      const r = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
      const v = hash01(S.pondA, Math.round(x / ps), Math.round(z / ps));
      if (r < 0.75) cell(x, z, ps, ps, `rgba(${46 + v * 18},${40 + v * 14},${30 + v * 8},0.95)`);
      else if (r < 1.3 && v < 0.5) cell(x, z, ps, ps, `rgba(${52 + v * 20},${70 + v * 20},${34},${0.5 * (1.3 - r)})`);
    }
  }
}

function paddockCells(c, hill, r, ri, cell) {
  const { ctx, s, win } = c;
  const [kx0, kx1] = span(r.minX, r.maxX, 1, win.minX, win.maxX, 2);
  const [kz0, kz1] = span(r.minZ, r.maxZ, 1, win.minZ, win.maxZ, 2);
  for (let kx = kx0; kx < kx1; kx++) {
    for (let kz = kz0; kz < kz1; kz++) {
      const x = r.minX + kx;
      const z = r.minZ + kz;
      const v = hash01(S.paddock + ri, kx, kz);
      cell(x, z, 1, 1, `rgba(${110 + v * 30},${124 + v * 30},${56 + v * 20},0.2)`);
      // Mud in soft daubs, so the edge of a track or a shore is not a row of squares.
      for (let k = 0; k < 2; k++) {
        const random = itemRandom(S.mud + ri * 10 + k, kx * 4096 + kz);
        const mx = x + random();
        const mz = z + random();
        const m = hill.mudAt(mx, mz);
        if (m < 0.1) continue;
        const [px, pz] = c.toPx(mx, mz);
        ctx.fillStyle = `rgba(${62 + v * 14},${46 + v * 10},${30 + v * 8},${Math.min(0.85, m * 0.9)})`;
        ctx.beginPath();
        ctx.ellipse(px, pz, (0.5 + random() * 0.4) * s, (0.5 + random() * 0.4) * s, random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * The wood through the north gate (world/woods.js): a floor of leaf litter, darker and browner than the grass field, patched with moss and
 * bare earth; the Hollow Run and its lead-in worn into a narrow dark track with two ruts and a grass strip between; the pond's silt and rushes.
 */
function* paintWoods(c, fields, autumn = false) {
  const { ctx, s, win } = c;
  const woods = fields.woods;
  const r = woods.rect;
  const half = woods.halfWidth;
  const fine = c.fine;
  const cell = (x, z, w, h, color) => {
    const [px, pz] = c.toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  if (!c.over(r, 12) && !(woods.pond && c.inWin(woods.pond.x, woods.pond.z, Math.max(woods.pond.rx, woods.pond.rz) * 1.5))) return;
  if (c.over(r, 2)) {
    const ws = fine ? 0.5 : 2;
    const [kx0, kx1] = span(r.minX, r.maxX, ws, win.minX, win.maxX, 1);
    const [kz0, kz1] = span(r.minZ, r.maxZ, ws, win.minZ, win.maxZ, 1);
    for (let kx = kx0; kx < kx1; kx++) {
      for (let kz = kz0; kz < kz1; kz++) {
        const x = r.minX + kx * ws;
        const z = r.minZ + kz * ws;
        const v = hash01(S.woodFloor, kx, kz);
        const moss = 0.5 + 0.5 * Math.sin(x * 0.19 + z * 0.13) * Math.sin(z * 0.17 - x * 0.11);
        if (moss > 0.62 && v < 0.6) cell(x, z, ws, ws, `rgba(${52 + v * 20},${72 + v * 22},${34 + v * 10},0.6)`);
        else cell(x, z, ws, ws, `rgba(${72 + v * 34},${58 + v * 24},${36 + v * 14},0.6)`);
      }
      if (c.due(kz1 - kz0)) yield;
    }
    // Fallen leaves in drifts, and bare patches where the roots are.
    // In autumn there are three times as many, in oranges, golds and reds (autumn.js).
    const AUTUMN_LEAVES = ['rgba(196,98,26,0.5)', 'rgba(214,140,36,0.5)', 'rgba(150,48,22,0.45)', 'rgba(200,170,60,0.45)'];
    if (fine) {
      const leaves = autumn ? 21000 : 7000;
      for (let i = 0; i < leaves; i++) {
        const random = itemRandom(S.leaf, i);
        const x = r.minX + random() * (r.maxX - r.minX);
        const z = r.minZ + random() * (r.maxZ - r.minZ);
        const colour = autumn ? (random() < 0.85 ? AUTUMN_LEAVES[Math.floor(random() * AUTUMN_LEAVES.length)] : 'rgba(40,32,20,0.35)') : random() < 0.6 ? 'rgba(150,104,48,0.3)' : 'rgba(40,32,20,0.35)';
        const rx = (0.2 + random() * 0.5) * s;
        const rz = (0.12 + random() * 0.25) * s;
        const turn = random() * Math.PI;
        if (!c.inWin(x, z, 1)) continue;
        const [px, pz] = c.toPx(x, z);
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.ellipse(px, pz, rx, rz, turn, 0, Math.PI * 2);
        ctx.fill();
      }
      yield;
    }
  }

  // The track: the circuit (closed) and the lead-in from the gate (open), each stroked in layers like the main track but narrower and darker.
  const lines = [{ pts: woods.track.points, closed: true }, { pts: woods.leadIn, closed: false }];
  const stroke = (line, offset, widthM, style, alpha, blur) => {
    const list = line.pts;
    const count = line.closed ? list.length : list.length - 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = widthM * s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const a = list[i % list.length];
      const b = list[(i + 1) % list.length];
      const cc = list[(i - 1 + list.length) % list.length];
      // Offset along the normal of the way on (the previous segment at the very end of an open line).
      const from = i < count || line.closed ? a : cc;
      const to = i < count || line.closed ? b : a;
      const tx = to[0] - from[0];
      const tz = to[1] - from[1];
      const tl = Math.hypot(tx, tz) || 1;
      const [px, pz] = c.toPx(a[0] - (tz / tl) * offset, a[1] + (tx / tl) * offset);
      if (i === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    }
    ctx.stroke();
    ctx.restore();
  };
  // The Fern Trail (painted first, so the Hollow Run's wider bed lies over it where they cross): a single-track path of packed pale earth worn through the litter, a ribbon of bare ground with a faint dark edge and a
  // dusting of leaves on it, no ruts. Painted roots cross it where the real ones lie.
  const tr = woods.trail;
  if (tr && pathNear(c, woods.trailTrack.points, 8, true)) {
    const th = woods.trailHalf;
    const line = { pts: woods.trailTrack.points, closed: true };
    stroke(line, 0, th * 2 + 1.3, '#3d3020', 0.4, 5);
    stroke(line, 0, th * 2 + 0.3, '#6b5738', 0.95, 2);
    stroke(line, 0, th * 2 - 0.5, '#7d6844', 0.9, 2);
    stroke(line, 0, 0.5, '#8a7650', 0.55, 1);
    stroke(line, 0, 0.35, '#4c5a2c', 0.18, 1);
    for (const dip of tr.dips) {
      // The dips are darker, damp earth.
      for (let k = -dip.len / 2; k < dip.len / 2; k += 0.25) {
        const p = woods.trailAt(dip.at + k);
        if (!c.inWin(p.x, p.z, th + 1)) continue;
        const [px, pz] = c.toPx(p.x, p.z);
        ctx.fillStyle = 'rgba(44,34,22,0.14)';
        ctx.beginPath();
        ctx.ellipse(px, pz, (th + 0.2) * s, 0.8 * s, Math.atan2(p.tx, -p.tz), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (fine) {
      for (let i = 0; i < 1800; i++) {
        const random = itemRandom(S.trailSpeck, i);
        const p = woods.trailAt(random() * woods.trailTrack.totalLength);
        const lat = (random() * 2 - 1) * th;
        const x = p.x - p.tz * lat;
        const z = p.z + p.tx * lat;
        const rr = (0.05 + random() * 0.16) * s;
        const colour = random() < 0.5 ? 'rgba(60,46,28,0.3)' : autumn ? 'rgba(190,110,30,0.4)' : 'rgba(150,104,48,0.3)';
        const sq = 1 + random();
        const turn = random() * Math.PI;
        if (!c.inWin(x, z, 1)) continue;
        const [px, pz] = c.toPx(x, z);
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.ellipse(px, pz, rr * sq, rr, turn, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Roots: the ones with bodies, and a few more only painted, running off the path into the litter.
    const rootLine = (x, z, yaw, len, wide) => {
      if (!c.inWin(x, z, len)) return;
      const [x0, z0] = c.toPx(x - Math.cos(yaw) * len / 2, z + Math.sin(yaw) * len / 2);
      const [x1, z1] = c.toPx(x + Math.cos(yaw) * len / 2, z - Math.sin(yaw) * len / 2);
      for (const [width, style] of [[wide * 1.6, 'rgba(24,16,8,0.45)'], [wide, 'rgba(92,70,46,0.9)'], [wide * 0.35, 'rgba(140,114,82,0.6)']]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, z0);
        ctx.lineTo(x1, z1);
        ctx.stroke();
      }
    };
    for (const root of tr.roots) rootLine(root.x, root.z, root.yaw, root.len, root.r * 2);
    for (let i = 0; i < 70; i++) {
      const random = itemRandom(S.rootA, i);
      const p = woods.trailAt(random() * woods.trailTrack.totalLength);
      const yaw = Math.atan2(-p.tx, -p.tz) + (random() - 0.5) * 1.2;
      const lat = (random() * 2 - 1) * (th + 0.8);
      rootLine(p.x - p.tz * lat, p.z + p.tx * lat, yaw, 0.7 + random() * 1.3, 0.05 + random() * 0.05);
    }
    yield;
  }
  for (const line of lines) {
    if (!pathNear(c, line.pts, half + 4, line.closed)) continue;
    stroke(line, 0, half * 2 + 2, '#4a3d28', 0.5, 6);
    stroke(line, 0, half * 2 + 0.4, '#3f3222', 0.92, 3);
    stroke(line, 0, half * 2 - 0.4, '#392c1c', 1, 1);
    stroke(line, 0, 0.5, '#4c5a2c', 0.4, 1);
    for (const off of [-0.55, 0.55]) {
      stroke(line, off, 0.38, '#251b10', 0.85, 1);
      stroke(line, off, 0.12, '#1c140b', 0.7, 0);
    }
  }
  yield;
  // Mottling on the mud, and roots across the track here and there.
  if (fine && pathNear(c, woods.track.points, half + 4, true)) {
    for (let i = 0; i < 3500; i++) {
      const random = itemRandom(S.mottleWood, i);
      const p = woods.track.sample(random());
      const lat = (random() * 2 - 1) * half;
      const x = p.x - p.tz * lat;
      const z = p.z + p.tx * lat;
      const rr = (0.08 + random() * 0.3) * s;
      const dark = random() < 0.55;
      const sq = 1 + random();
      const turn = random() * Math.PI;
      if (!c.inWin(x, z, 1)) continue;
      const [px, pz] = c.toPx(x, z);
      ctx.fillStyle = dark ? 'rgba(25,18,10,0.35)' : 'rgba(110,86,56,0.25)';
      ctx.beginPath();
      ctx.ellipse(px, pz, rr * sq, rr, turn, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The pond: silt on the bed, rushes round it.
  const pond = woods.pond;
  if (pond) {
    const ps = fine ? 0.5 : 1;
    const [px0, px1] = span(pond.x - pond.rx * 1.4, pond.x + pond.rx * 1.4, ps, win.minX, win.maxX, 1);
    const [pz0, pz1] = span(pond.z - pond.rz * 1.4, pond.z + pond.rz * 1.4, ps, win.minZ, win.maxZ, 1);
    for (let kx = px0; kx < px1; kx++) {
      for (let kz = pz0; kz < pz1; kz++) {
        const x = pond.x - pond.rx * 1.4 + kx * ps;
        const z = pond.z - pond.rz * 1.4 + kz * ps;
        const rr = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
        const v = hash01(S.pondB, Math.round(x / ps), Math.round(z / ps));
        if (rr < 0.75) cell(x, z, ps, ps, `rgba(${40 + v * 16},${36 + v * 12},${28 + v * 8},0.95)`);
        else if (rr < 1.3 && v < 0.5) cell(x, z, ps, ps, `rgba(${50 + v * 20},${68 + v * 20},${34},${0.5 * (1.3 - rr)})`);
      }
    }
  }
}

/**
 * The gravel pit (world/quarry.js): a rough, scrubby field round it; the walls in bands of buff, orange, grey and pale sand (a band is a depth,
 * so they run level round the bowl with a wobble, as strata do), loose scree at the toe; a floor of packed grey-brown
 * with the haul road worn bare and pale with two ruts; the heaps, grey gravel or buff sand; the pond's silt and the damp round its shore.
 */
function* paintQuarry(c, quarry) {
  const { ctx, s, win } = c;
  const r = quarry.rect;
  const pit = quarry.pit;
  const fine = c.fine;
  const cell = (x, z, w, h, color) => {
    const [px, pz] = c.toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  const reach = quarry.reachMax + 3;
  const pitBox = { minX: pit.x - reach, maxX: pit.x + reach, minZ: pit.z - reach, maxZ: pit.z + reach };
  if (!c.over(r, 2) && !c.over(pitBox, 2)) return;
  // The field: dry rough grass gone to dock and bare patches, browner than the farm's.
  if (c.over(r, 2)) {
    const [kx0, kx1] = span(r.minX, r.maxX, 1, win.minX, win.maxX, 1);
    const [kz0, kz1] = span(r.minZ, r.maxZ, 1, win.minZ, win.maxZ, 1);
    for (let kx = kx0; kx < kx1; kx++) {
      for (let kz = kz0; kz < kz1; kz++) {
        const x = r.minX + kx;
        const z = r.minZ + kz;
        const v = hash01(S.quarryField, kx, kz);
        const dry = 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.09) * Math.sin(z * 0.11 - x * 0.07 + 1);
        if (dry > 0.45) cell(x, z, 1, 1, `rgba(${118 + v * 40},${112 + v * 34},${66 + v * 20},${0.25 + 0.3 * dry})`);
      }
      if (c.due((kz1 - kz0) * 2)) yield;
    }
  }
  const STRATA = [[201, 184, 138], [186, 140, 84], [158, 152, 138], [216, 207, 178], [174, 150, 104]];
  const step = fine ? 0.3 : 1.2;
  // Cells a little bigger than their spacing and knocked off the grid, so the ground reads as grit and not as squares.
  const grit = (x, z, kx, kz, color) => cell(x + (hash01(S.gritJ, kx, kz) - 0.5) * step, z + (hash01(S.gritJ + 100, kx, kz) - 0.5) * step, step * 1.6, step * 1.6, color);
  if (c.over(pitBox, 2)) {
    const [gx0, gx1] = span(pitBox.minX, pitBox.maxX, step, win.minX, win.maxX, 2);
    const [gz0, gz1] = span(pitBox.minZ, pitBox.maxZ, step, win.minZ, win.maxZ, 2);
    for (let kx = gx0; kx < gx1; kx++) {
      for (let kz = gz0; kz < gz1; kz++) {
        const x = pitBox.minX + kx * step;
        const z = pitBox.minZ + kz * step;
        const { a, s: dist } = quarry.polar(x, z);
        const rim = quarry.rimAt(a);
        if (dist > rim + 2.5) continue;
        const v = hash01(S.grit, kx, kz);
        const cut = quarry.bowlCut(x, z);
        const u = (rim - dist) / quarry.runAt(a);
        let col;
        let alpha = 0.98;
        if (u >= 1) {
          // The floor: packed, with stones.
          const g = 120 + v * 28;
          col = [g + 12, g + 4, g - 14];
        } else if (u <= 0) {
          // The lip: raw ground showing through the grass.
          col = [176 + v * 20, 160 + v * 18, 112 + v * 14];
          alpha = 0.9 * (1 - Math.min(1, -u * (quarry.runAt(a) / 2.5)));
        } else {
          const band = Math.floor(cut * 0.85 + 0.9 * Math.sin(a * 5 + cut * 0.4) + 0.5 * Math.sin(a * 13 + 2) + v * 0.35);
          const base = STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length];
          const scree = smoothScree(u);
          const m = 0.92 + v * 0.1; // the cells are about half a metre, so each is near its neighbour and the shader's grit gives the texture
          col = [base[0] * m * (1 - 0.2 * scree) + 30 * scree, base[1] * m * (1 - 0.2 * scree) + 26 * scree, base[2] * m * (1 - 0.2 * scree) + 20 * scree];
        }
        grit(x, z, kx, kz, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha})`);
      }
      if (c.due((gz1 - gz0) * 4)) yield;
    }
    // Stones speckled over the walls and floor, flints and grey.
    if (fine) {
      for (let i = 0; i < 26000; i++) {
        const random = itemRandom(S.stone, i);
        const a = random() * Math.PI * 2;
        const dist = Math.sqrt(random()) * (quarry.rimAt(a) + 1);
        const p = quarry.frameAt(a, dist);
        if (!c.inWin(p.x, p.z, 1)) continue;
        const [px, pz] = c.toPx(p.x, p.z);
        ctx.fillStyle = random() < 0.4 ? 'rgba(236,230,214,0.5)' : random() < 0.5 ? 'rgba(88,84,78,0.5)' : 'rgba(150,120,80,0.45)';
        ctx.beginPath();
        ctx.ellipse(px, pz, (0.05 + random() * 0.14) * s, (0.04 + random() * 0.1) * s, random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        if (c.due(1)) yield;
      }
    }
    // The heaps.
    pit.heaps.forEach((h, hi) => {
      if (!c.inWin(h.x, h.z, h.r + 2)) return;
      const sand = h.kind === 'sand';
      const [hx0, hx1] = span(h.x - h.r, h.x + h.r, step, win.minX, win.maxX, 2);
      const [hz0, hz1] = span(h.z - h.r, h.z + h.r, step, win.minZ, win.maxZ, 2);
      for (let kx = hx0; kx < hx1; kx++) {
        for (let kz = hz0; kz < hz1; kz++) {
          const x = h.x - h.r + kx * step;
          const z = h.z - h.r + kz * step;
          const d = Math.hypot(x - h.x, z - h.z) / h.r;
          if (d > 1) continue;
          const v = hash01(S.heap + hi, kx, kz);
          const m = 0.85 + v * 0.3 + 0.12 * (1 - d);
          grit(x, z, kx + 5000 * (hi + 1), kz, sand ? `rgba(${(214 * m) | 0},${(190 * m) | 0},${(134 * m) | 0},0.95)` : `rgba(${(138 * m) | 0},${(135 * m) | 0},${(130 * m) | 0},0.95)`);
        }
      }
    });
    yield;
    // The haul road: bare pale gravel, with two darker ruts and a fringe of dust.
    const roads = [quarry.roadPoints, quarry.rampPoints];
    const road = roads.flat();
    const stroke = (offset, widthM, style, alpha, blur = 0) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = widthM * s;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (blur) ctx.filter = `blur(${blur}px)`;
      for (const pts of roads) {
        if (!pathNear(c, pts, 6)) continue;
        ctx.beginPath();
        pts.forEach((pt, i) => {
          const b = pts[Math.min(i + 1, pts.length - 1)];
          const a = pts[Math.max(i - 1, 0)];
          const tl = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          const [px, pz] = c.toPx(pt.x - ((b.z - a.z) / tl) * offset, pt.z + ((b.x - a.x) / tl) * offset);
          if (i) ctx.lineTo(px, pz);
          else ctx.moveTo(px, pz);
        });
        ctx.stroke();
      }
      ctx.restore();
    };
    const w = quarry.roadHalf * 2;
    stroke(0, w + 1.6, '#b9aa86', 0.55, 5);
    stroke(0, w, '#c8bb98', 0.92, 2);
    for (const off of [-0.8, 0.8]) stroke(off, 0.5, '#8d8064', 0.7, 1);
    stroke(0, 0.3, '#a89c7e', 0.5, 1);
    // Gravel and dust flecks along the haul road.
    if (fine) {
      for (let i = 0; i < 9000; i++) {
        const random = itemRandom(S.fleck, i);
        const pt = road[Math.floor(random() * road.length)];
        const x = pt.x + (random() - 0.5) * w * 1.1;
        const z = pt.z + (random() - 0.5) * w * 1.1;
        const light = random() < 0.5;
        const rx = (0.04 + random() * 0.09) * s;
        const rz = (0.03 + random() * 0.07) * s;
        const turn = random() * Math.PI;
        if (!c.inWin(x, z, 1)) continue;
        const [px, pz] = c.toPx(x, z);
        ctx.fillStyle = light ? 'rgba(238,232,214,0.6)' : 'rgba(96,86,68,0.5)';
        ctx.beginPath();
        ctx.ellipse(px, pz, rx, rz, turn, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The pond: silt on the bed, a damp dark fringe on the shore.
    const pond = pit.pond;
    const [qx0, qx1] = span(pond.x - pond.rx * 1.5, pond.x + pond.rx * 1.5, step, win.minX, win.maxX, 2);
    const [qz0, qz1] = span(pond.z - pond.rz * 1.5, pond.z + pond.rz * 1.5, step, win.minZ, win.maxZ, 2);
    for (let kx = qx0; kx < qx1; kx++) {
      for (let kz = qz0; kz < qz1; kz++) {
        const x = pond.x - pond.rx * 1.5 + kx * step;
        const z = pond.z - pond.rz * 1.5 + kz * step;
        const rr = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
        const v = hash01(S.pondC, kx, kz);
        if (rr < 0.8) grit(x, z, kx + 9000, kz, `rgba(${86 + v * 18},${78 + v * 14},${58 + v * 10},0.97)`);
        else if (rr < 1.4) grit(x, z, kx + 9000, kz, `rgba(${70 + v * 20},${64 + v * 14},${44 + v * 10},${(0.7 * (1.4 - rr)) / 0.6})`);
      }
    }
  }
  // The gateway, worn.
  if (c.inWin(quarry.gate.x, r.maxZ - 2, 6)) {
    const [gx, gz] = c.toPx(quarry.gate.x, r.maxZ - 2);
    const gr = ctx.createRadialGradient(gx, gz, 0, gx, gz, 6 * s);
    gr.addColorStop(0, 'rgba(110,92,62,0.85)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(gx - 6 * s, gz - 6 * s, 12 * s, 12 * s);
  }
}

/** 0..1 how much scree there is `u` of the way down a bank: none at the top, loose stone over the lower part. */
function smoothScree(u) {
  const t = Math.min(1, Math.max(0, (u - 0.45) / 0.5));
  return t * t * (3 - 2 * t);
}

/** The neighbouring farmland beyond the farm's hedges, at 2 m a pixel (4 on the overview), fading in from the grass a few metres out (as the outer ring does). */
function paintPatchwork(c, fields) {
  const { ctx, win, s } = c;
  const cell = c.fine ? 2 : 4;
  const i0 = Math.floor(win.minX / cell) - 1;
  const j0 = Math.floor(win.minZ / cell) - 1;
  const nx = Math.ceil(win.maxX / cell) + 1 - i0;
  const nz = Math.ceil(win.maxZ / cell) + 1 - j0;
  const cv = document.createElement('canvas');
  cv.width = nx;
  cv.height = nz;
  const g = cv.getContext('2d');
  const img = g.createImageData(nx, nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = (i0 + i + 0.5) * cell;
      const z = (j0 + j + 0.5) * cell;
      const blend = patchBlend(fields.outside(x, z));
      const o = (j * nx + i) * 4;
      if (blend <= 0) continue;
      const col = patchColor(x, z, 1);
      img.data[o] = col[0] * 255;
      img.data[o + 1] = col[1] * 255;
      img.data[o + 2] = col[2] * 255;
      img.data[o + 3] = blend * 215; // the grass's own blotches still show through a little
    }
  }
  g.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cv, (i0 * cell - win.minX) * s, (j0 * cell - win.minZ) * s, nx * cell * s, nz * cell * s);
}

/**
 * The stubble fields, each as layout.stubbleFields has it: its straw colour with darker drill rows every half metre the way it was drilled,
 * the odd bare or weedy patch, and the tramlines (the sprayer's wheel lines, two dark stripes 1.8 m apart) every British arable field has.
 * The north field's hollow is damper: darker, with more green coming through.
 */
function paintStubble(c, fields) {
  const { ctx, s, win } = c;
  for (const [fi, key] of ['north', 'south'].entries()) {
    const r = fields.areas[key];
    if (!r || !c.over(r, 1)) continue;
    const f = fields.stubbleField(key) ?? { rows: 'x', tramlines: 24, ground: '#b3a06a' };
    // Only the part of the field in the window.
    const [x0, z0] = c.toPx(Math.max(r.minX, win.minX - 1), Math.max(r.minZ, win.minZ - 1));
    const [x1, z1] = c.toPx(Math.min(r.maxX, win.maxX + 1), Math.min(r.maxZ, win.maxZ + 1));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, z0, x1 - x0, z1 - z0);
    ctx.clip();
    ctx.fillStyle = f.ground;
    ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
    // Blotches: a little greener where it's weedy, browner where the combine left it thin.
    for (let i = 0; i < 450; i++) {
      const random = itemRandom(S.stubble + fi, i);
      const x = r.minX + random() * (r.maxX - r.minX);
      const z = r.minZ + random() * (r.maxZ - r.minZ);
      const radM = 1.5 + random() * 5;
      const tint = random() < 0.35 ? '120,130,70' : random() < 0.5 ? '150,125,80' : '205,190,140';
      if (!c.inWin(x, z, radM)) continue;
      const [px, pz] = c.toPx(x, z);
      const rad = radM * s;
      const g = ctx.createRadialGradient(px, pz, 0, px, pz, rad);
      g.addColorStop(0, `rgba(${tint},0.35)`);
      g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(px - rad, pz - rad, rad * 2, rad * 2);
    }
    // The hollow: damp ground, darker, with weeds coming through.
    if (f.hollow && c.over({ minX: f.hollow.x - f.hollow.rx, maxX: f.hollow.x + f.hollow.rx, minZ: f.hollow.z - f.hollow.rz, maxZ: f.hollow.z + f.hollow.rz })) {
      const [hx, hz] = c.toPx(f.hollow.x, f.hollow.z);
      ctx.save();
      ctx.translate(hx, hz);
      ctx.scale(f.hollow.rx * s, f.hollow.rz * s);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(92,96,58,0.6)');
      g.addColorStop(0.55, 'rgba(110,108,68,0.35)');
      g.addColorStop(1, 'rgba(110,108,68,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    // Drill rows, and tramlines from 12 m in from the field's edge, both running the way it was drilled. Rows are finer than a pixel on the overview.
    const alongX = f.rows !== 'z';
    const line = (at) => {
      ctx.beginPath();
      if (alongX) {
        const [, pz] = c.toPx(0, at);
        ctx.moveTo(x0, pz);
        ctx.lineTo(x1, pz);
      } else {
        const [px] = c.toPx(at, 0);
        ctx.moveTo(px, z0);
        ctx.lineTo(px, z1);
      }
      ctx.stroke();
    };
    const [lo, hi] = alongX ? [r.minZ, r.maxZ] : [r.minX, r.maxX];
    const [wlo, whi] = alongX ? [win.minZ, win.maxZ] : [win.minX, win.maxX];
    if (c.fine) {
      ctx.strokeStyle = 'rgba(110,95,55,0.35)';
      ctx.lineWidth = Math.max(1, 0.12 * s);
      const [k0, k1] = span(lo + 0.25, hi, 0.5, wlo, whi, 1);
      for (let k = k0; k < k1; k++) line(lo + 0.25 + k * 0.5);
      ctx.strokeStyle = 'rgba(105,90,58,0.75)';
      ctx.lineWidth = 0.45 * s;
      const [t0, t1] = span(lo + 12, hi - 6, f.tramlines, wlo, whi, 2);
      for (let k = t0; k < t1; k++) for (const off of [-0.9, 0.9]) line(lo + 12 + k * f.tramlines + off);
    }
    ctx.restore();
  }
}

/**
 * The ground at the buildings out east (outbuildings.js): the Dutch barn's floor bare and trodden, littered with straw, worn out onto the
 * hardstanding; the field shed's earth floor and its doorway; a dark stain round the muck heap; and the ground poached round the trough.
 */
function paintOutbuildings(c, plan, wear) {
  const { ctx, s } = c;
  const { ob, layout } = plan;
  const floor = (r, color) => {
    if (!c.over(r)) return;
    const [x0, z0] = c.toPx(r.minX, r.minZ);
    const [x1, z1] = c.toPx(r.maxX, r.maxZ);
    ctx.fillStyle = color;
    ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
  };
  if (ob.barn) {
    const r = ob.barn.outer;
    floor({ minX: r.minX - 0.3, maxX: r.maxX + 0.3, minZ: r.minZ - 0.3, maxZ: r.maxZ + 0.3 }, 'rgba(112,100,78,0.75)');
    floor(r, 'rgba(98,86,66,0.8)');
    const a = ob.apron;
    floor(a, 'rgba(108,94,70,0.55)');
    for (let i = 0; i < 30; i++) {
      const random = itemRandom(S.barnWear, i);
      wear(a.minX + 1 + random() * (a.maxX - a.minX - 2), a.minZ + random() * (a.maxZ - a.minZ), 1.5 + random() * 2, 'rgba(100,86,62,0.5)');
    }
    if (c.fine) {
      for (let i = 0; i < 450; i++) {
        const random = itemRandom(S.straw, i);
        const x = r.minX + random() * (r.maxX - r.minX);
        const z = r.minZ + random() * (r.maxZ - r.minZ + 1.5);
        const ang = random() * Math.PI;
        const len = (0.1 + random() * 0.25) * s;
        const colour = `rgba(${190 + random() * 30},${160 + random() * 30},${90 + random() * 30},${0.2 + random() * 0.3})`;
        if (!c.inWin(x, z, 1)) continue;
        const [px, pz] = c.toPx(x, z);
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(1, 0.02 * s);
        ctx.beginPath();
        ctx.moveTo(px, pz);
        ctx.lineTo(px + Math.cos(ang) * len, pz + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
  }
  if (ob.shed) {
    floor(ob.shed.inner, 'rgba(78,66,50,0.9)');
    wear((ob.shed.door.minX + ob.shed.door.maxX) / 2, ob.shed.door.z + 1.2, 2.8, 'rgba(88,74,52,0.9)');
  }
  const m = layout.muckHeap;
  if (m && c.inWin(m.x, m.z, Math.max(m.halfX, m.halfZ) + 2)) {
    const [hx, hz] = c.toPx(m.x, m.z);
    ctx.save();
    ctx.translate(hx, hz);
    ctx.scale((m.halfX + 1.6) * s, (m.halfZ + 1.6) * s);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(60,46,30,0.95)');
    g.addColorStop(0.7, 'rgba(70,56,36,0.7)');
    g.addColorStop(1, 'rgba(70,56,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  const t = layout.trough;
  if (t) {
    // On the field side, where the cattle stand to drink (the hedge is behind it).
    wear(t.x, t.z - 1, 3.2, 'rgba(84,66,44,0.9)');
    wear(t.x + 0.6, t.z - 1.3, 1.8, 'rgba(66,50,32,0.8)');
  }
}

/**
 * What the roads painted into the ground are made of, worked out once: the stone speckled over the tarmac and the bites out of its edge, where
 * each is, so that every window paints the same ones. `random` is drawn in the order the road was always painted in.
 */
export function planRoad(road, fields, random) {
  const pads = road.pads;
  const xs = [...road.points.map((p) => p[0]), ...pads.flatMap((q) => [q.x - q.radius, q.x + q.radius])];
  const zs = [...road.points.map((p) => p[1]), ...pads.flatMap((q) => [q.z - q.radius, q.z + q.radius])];
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const reach = Math.max(road.halfWidth, ...pads.map((q) => q.radius));
  const zMid = (road.points[0][1] + road.points[road.points.length - 1][1]) / 2;
  const [z0, z1] = [Math.min(minZ, zMid - reach), Math.max(maxZ, zMid + reach)];
  const area = (maxX - minX) * (z1 - z0);
  // Speckle: the stone in the tarmac, as x, z and 1 for a light fleck, 0 for a dark.
  const speckle = [];
  for (let i = 0; i < area * 6; i++) {
    const x = minX + random() * (maxX - minX);
    const z = z0 + random() * (z1 - z0);
    if (fields.tarmacAt(x, z) < 0.5) continue;
    speckle.push(x, z, random() < 0.5 ? 1 : 0);
  }
  // Bites out of the edge.
  const bites = [];
  for (let at = 0; at < road.length; at += 1.5 + random() * 4) {
    const p = pointAt(road, at);
    for (const side of [-1, 1]) {
      if (random() < 0.5) continue;
      const out = (d) => [p.x - p.tz * side * d, p.z + p.tx * side * d];
      if (fields.tarmacAt(...out(road.halfWidth + 0.4)) > 0.5) continue; // across the hardstanding, there's no edge
      const [x, z] = out(road.halfWidth + 0.05);
      bites.push({ x, z, rx: 0.2 + random() * 0.5, rz: 0.08 + random() * 0.15 });
    }
  }
  return { speckle: Float64Array.from(speckle), bites };
}

/**
 * The roads painted into the ground (the farm road and its hardstanding): dark grey tarmac, speckled, a little lighter where the wheels run, with
 * crumbling edges. They are drawn from the road network (world/roads.js) like every road; they are painted rather than laid so the mud, the rain,
 * the frost and the snow that lie on the ground lie on them. One road with `draw: 'ground'`, over the window of `c`; `plan` is planRoad's.
 */
export function drawRoad(c, road, plan) {
  const { ctx, s } = c;
  const pads = road.pads;
  const shape = (grow) => {
    ctx.beginPath();
    // Each straight piece of the road as a band `grow` m wider than it each side, the ends of the whole road `grow` m longer.
    road.segs.forEach((g, i) => {
      const n = { x: -g.tz, z: g.tx };
      const w = road.halfWidth + grow;
      const lo = i === 0 ? -grow : 0;
      const hi = g.len + (i === road.segs.length - 1 ? grow : 0);
      const pt = (t, side) => [g.a.x + g.tx * t + n.x * w * side, g.a.z + g.tz * t + n.z * w * side];
      const corners = [pt(lo, -1), pt(hi, -1), pt(hi, 1), pt(lo, 1)];
      if (!c.over({ minX: Math.min(...corners.map((q) => q[0])), maxX: Math.max(...corners.map((q) => q[0])), minZ: Math.min(...corners.map((q) => q[1])), maxZ: Math.max(...corners.map((q) => q[1])) }, 1)) return;
      const [p0, p1, p2, p3] = corners.map((q) => c.toPx(q[0], q[1]));
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.closePath();
    });
    for (const q of pads) {
      if (!c.inWin(q.x, q.z, q.radius + grow + 1)) continue;
      const [px, pz] = c.toPx(q.x, q.z);
      ctx.moveTo(px + (q.radius + grow) * s, pz);
      ctx.arc(px, pz, (q.radius + grow) * s, 0, Math.PI * 2);
    }
  };
  // A worn, gritty margin where the edge has broken up into the verge.
  ctx.fillStyle = 'rgba(95,88,70,0.6)';
  shape(0.25);
  ctx.fill();
  ctx.fillStyle = '#4b4a47';
  shape(0);
  ctx.fill();
  ctx.save();
  shape(0);
  ctx.clip();
  // Speckle: the stone in the tarmac (finer than a pixel on the overview).
  if (c.fine) {
    const sp = plan.speckle;
    const size = Math.max(1, 0.08 * s);
    for (let i = 0; i < sp.length; i += 3) {
      if (!c.inWin(sp[i], sp[i + 1], 0.5)) continue;
      const [px, pz] = c.toPx(sp[i], sp[i + 1]);
      ctx.fillStyle = sp[i + 2] ? 'rgba(120,118,112,0.5)' : 'rgba(35,35,34,0.5)';
      ctx.fillRect(px, pz, size, size);
    }
  }
  // Polished a little lighter where the wheels run, about 1.6 m apart.
  ctx.strokeStyle = 'rgba(120,118,110,0.18)';
  ctx.lineWidth = 0.5 * s;
  const sm = road.samples;
  const near = (i) => i >= 0 && i < sm.length && c.inWin(sm[i].x, sm[i].z, 4);
  for (const off of [-0.8, 0.8]) {
    ctx.beginPath();
    let pen = false;
    sm.forEach((p, i) => {
      if (!near(i) && !near(i - 1) && !near(i + 1)) {
        pen = false;
        return;
      }
      const [px, pz] = c.toPx(p.x + p.tz * off, p.z - p.tx * off);
      if (pen) ctx.lineTo(px, pz);
      else ctx.moveTo(px, pz);
      pen = true;
    });
    ctx.stroke();
  }
  ctx.restore();
  // Bites out of the edge.
  for (const b of plan.bites) {
    if (!c.inWin(b.x, b.z, 1)) continue;
    const [px, pz] = c.toPx(b.x, b.z);
    ctx.fillStyle = 'rgba(95,88,70,0.8)';
    ctx.beginPath();
    ctx.ellipse(px, pz, b.rx * s, b.rz * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One road with `draw: 'ground'`, painted whole through a `toPx` of the caller's own: see drawRoad. Exported for the tests. */
export function paintRoadOnGround(ctx, toPx, s, road, fields, random) {
  drawRoad({ ctx, toPx, s, fine: true, win: INFINITE, inWin: () => true, over: () => true, due: () => false }, road, planRoad(road, fields, random));
}
