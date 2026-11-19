// The Moor's ground painting (#713, layout 2): heather's older and younger stands in browns and olives, bracken's litter, the flushes' bright sphagnum and dark
// pools, the cut face and bare floor of each peat bank, the sheep tracks worn pale through the heather, the stream's dark bed and the spring. Painted a tile at a
// time like the rest (groundTexture.js `paintGround`, which calls `paintMoor`), over the grass, west of Back Lane only: the verge and the farm's side are left
// as they were. The plants over it are moorProps.js; where each stand is comes from moor.js, so the paint and the plants agree.

import { createMoor } from './moor.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const HEATHER_OLD = [88, 72, 62];
const HEATHER_YOUNG = [122, 108, 70];
const MOOR_GRASS = [140, 134, 84];
const BRACKEN_LITTER = [118, 84, 50];
const SPHAGNUM = [112, 130, 70];
const SPHAGNUM_DARK = [58, 74, 40];
const PEAT = [43, 32, 22];

const cache = new WeakMap();
const moorOf = (M) => {
  if (!cache.has(M)) cache.set(M, createMoor(M));
  return cache.get(M);
};

/**
 * Where Back Lane's west edge is at z, game metres, a straight run of the lane's own points down the common (the lane runs north to south there); the moor is painted
 * on the far side of it. Past the last of the run the common is west of the hairpin.
 */
export function laneEdgeAt(points, z) {
  const run = points.filter((p, i) => i === 0 || p[1] >= points[i - 1][1]);
  if (z <= run[0][1]) return run[0][0];
  for (let i = 0; i < run.length - 1; i++) {
    if (z <= run[i + 1][1]) return run[i][0] + ((run[i + 1][0] - run[i][0]) * (z - run[i][1])) / (run[i + 1][1] - run[i][1] || 1);
  }
  return run[run.length - 1][0];
}

/** Paints the moor into the window of `c` (groundTexture.js's paintContext), as a generator that pauses now and then. */
export function* paintMoor(c, layout) {
  const M = layout.moor;
  if (!M || !c.over(M.bounds, 16)) return;
  const { ctx, s } = c;
  const moor = moorOf(M);
  const lane = layout.roads.find((r) => r.id === 'backLane');
  const lanePts = lane ? lane.points.filter((p) => p[1] <= M.bounds.maxZ && p[1] >= M.bounds.minZ - 30) : [];
  const edge = (z) => (lanePts.length > 1 ? laneEdgeAt(lanePts, z) - 2.2 : M.bounds.maxX);
  const b = M.bounds;
  const cell = c.fine ? 1.5 : 6;

  // The ground itself, in cells: the stands of heather and the grass between, the bracken's litter, the wet. Fades out towards the lane's verge.
  const x0 = Math.max(b.minX - 14, c.win.minX - cell); // out to the ridge wall, which stands a few metres beyond the common's plan edge
  const x1 = Math.min(b.maxX, c.win.maxX + cell);
  const z0 = Math.max(b.minZ, c.win.minZ - cell);
  const z1 = Math.min(b.maxZ, c.win.maxZ + cell);
  for (let z = Math.floor(z0 / cell) * cell; z < z1; z += cell) {
    const east = edge(z + cell / 2);
    for (let x = Math.floor(x0 / cell) * cell; x < x1; x += cell) {
      const cx = x + cell / 2;
      const cz = z + cell / 2;
      const fade = smooth(b.minX - 15, b.minX - 6, cx) * smooth(east, east - 14, cx) * smooth(b.minZ, b.minZ + 14, cz) * smooth(b.maxZ + 6, b.maxZ - 12, cz);
      if (fade <= 0.02) continue;
      const heather = moor.heatherAt(cx, cz);
      const age = moor.heatherAge(cx, cz);
      let col = mix(MOOR_GRASS, mix(HEATHER_YOUNG, HEATHER_OLD, age), Math.min(1, heather * 1.4));
      col = mix(col, BRACKEN_LITTER, moor.brackenAt(cx, cz) * 0.8);
      const lump = moor.patch(cx, cz, 5, 29) * 0.6 + moor.patch(cx, cz, 1.7, 31) * 0.4;
      col = col.map((v) => Math.round(v * (0.84 + lump * 0.32)));
      const [px, pz] = c.toPx(x, z);
      ctx.fillStyle = rgba(col, 0.94 * fade);
      ctx.fillRect(px, pz, cell * s + 1, cell * s + 1);
      if (c.due()) yield;
    }
  }
  yield;

  const blob = (x, z, rx, rz, colour, alpha, turn = 0) => {
    if (!c.inWin(x, z, Math.max(rx, rz) + 1)) return;
    const [px, pz] = c.toPx(x, z);
    ctx.fillStyle = rgba(colour, alpha);
    ctx.beginPath();
    ctx.ellipse(px, pz, rx * s, rz * s, turn, 0, Math.PI * 2);
    ctx.fill();
  };

  // The flushes: bright green moss over a dark wet floor, with pools.
  M.flushes.forEach((f, i) => {
    // A ragged edge: a ring of overlapping blobs rather than one ellipse.
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2 + i * 0.7;
      const j = 0.75 + 0.35 * moor.patch(f.x + k * 3, f.z - k, 4, 13);
      blob(f.x + Math.cos(a) * f.rx * 0.55 * j, f.z + Math.sin(a) * f.rz * 0.55 * j, f.rx * 0.55, f.rz * 0.55, SPHAGNUM_DARK, 0.34);
      blob(f.x + Math.cos(a) * f.rx * 0.45 * j, f.z + Math.sin(a) * f.rz * 0.45 * j, f.rx * 0.45, f.rz * 0.45, SPHAGNUM, 0.4);
    }
    if (!c.fine) return;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + i;
      const d = 0.25 + 0.5 * moor.patch(f.x + k, f.z + i, 3, 7);
      blob(f.x + Math.cos(a) * f.rx * d, f.z + Math.sin(a) * f.rz * d, 0.5 + 0.9 * moor.patch(f.x - k, f.z, 2, 3), 0.4 + 0.6 * moor.patch(f.x, f.z - k, 2, 5), k % 3 ? [150, 190, 80] : [28, 36, 26], k % 3 ? 0.5 : 0.7);
    }
  });
  yield;

  // The sheep tracks: pale worn lines.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of M.tracks) {
    if (!line.some((p) => c.inWin(p[0], p[1], 12))) continue;
    ctx.beginPath();
    line.forEach((p, i) => {
      const [px, pz] = c.toPx(p[0], p[1]);
      if (i) ctx.lineTo(px, pz);
      else ctx.moveTo(px, pz);
    });
    ctx.strokeStyle = rgba([150, 130, 96], 0.55);
    ctx.lineWidth = 1.1 * s;
    ctx.stroke();
    ctx.strokeStyle = rgba([172, 152, 112], 0.45);
    ctx.lineWidth = 0.45 * s;
    ctx.stroke();
  }

  // The peat banks: bare dark floor along the cut and its face, a paler lip.
  for (const p of M.peat) {
    const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
    const nx = (p.b[1] - p.a[1]) / len;
    const nz = -(p.b[0] - p.a[0]) / len;
    for (const [off, w, col, alpha] of [[-2, 6.5, PEAT, 0.9], [0, 3.4, [24, 17, 12], 1], [1.7, 0.7, [118, 96, 66], 0.6]]) {
      if (!c.over({ minX: Math.min(p.a[0], p.b[0]) - 6, maxX: Math.max(p.a[0], p.b[0]) + 6, minZ: Math.min(p.a[1], p.b[1]) - 6, maxZ: Math.max(p.a[1], p.b[1]) + 6 })) continue;
      const [ax, az] = c.toPx(p.a[0] + nx * off, p.a[1] + nz * off);
      const [bx, bz] = c.toPx(p.b[0] + nx * off, p.b[1] + nz * off);
      ctx.strokeStyle = rgba(col, alpha);
      ctx.lineWidth = w * s;
      ctx.beginPath();
      ctx.moveTo(ax, az);
      ctx.lineTo(bx, bz);
      ctx.stroke();
    }
  }

  // The stream's dark bed from the spring east to the lane, and the spring's wet green round it.
  const stream = layout.hill?.stream;
  if (stream?.west) {
    const west = stream.west.minX;
    const zAt = (x) => stream.z + stream.wander * Math.sin(x * 0.05 + 1.1);
    if (c.over({ minX: west - 4, maxX: M.bounds.maxX, minZ: stream.z - 8, maxZ: stream.z + 8 })) {
      for (const [w, col, alpha] of [[4.6, [66, 88, 44], 0.55], [3.0, [44, 40, 30], 0.75], [1.5, [30, 28, 24], 0.8]]) {
        ctx.strokeStyle = rgba(col, alpha);
        ctx.lineWidth = w * s;
        ctx.beginPath();
        for (let x = Math.max(west, c.win.minX - 4); x <= Math.min(M.bounds.maxX, c.win.maxX + 4); x += 2) {
          const [px, pz] = c.toPx(x, zAt(x));
          if (x === Math.max(west, c.win.minX - 4)) ctx.moveTo(px, pz);
          else ctx.lineTo(px, pz);
        }
        ctx.stroke();
      }
    }
  }
  blob(M.spring.at[0], M.spring.at[1], 2.6, 2.2, SPHAGNUM, 0.85);
  blob(M.spring.at[0], M.spring.at[1], 1.1, 0.9, [24, 36, 28], 0.9);
  yield;
}
