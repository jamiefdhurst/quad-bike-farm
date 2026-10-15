import * as THREE from 'three';

// The red quad's decks and flares, sculpted after photos of a 1990s Honda TRX300FW (TODO 88). Pure geometry, no materials, so it can
// be tested in node. Each deck is the front or the rear fender in one piece: its top crowned, its outer edge rolled down, its end
// rounded over into a face (the front one carries the headlights, the rear one the tail bracket), with the plan outline pulled in at
// the inner end (a swept tail) and round the face's corners, so no edge is straight. The black flare is one ribbon that follows the
// deck's outer edge: a strip across the top, a lip over the rolled edge and a skirt hanging to the wheel arch, which sweeps down
// into a tail at the inner end and tapers away down the corner of the face.

export const DECK = {
  front: { z0: 0.3, zf: 0.858, top: 0.725, crown: 0.028, dip: 0.025, faceH: 0.14 }, // z0: the inner end (towards the middle), zf: the face
  rear: { z0: -0.3, zf: -0.855, top: 0.76, crown: 0.02, dip: 0, faceH: 0.14 },
  half: 0.572, // half the width at its widest, to the outside of the black skirt
  rTop: 0.07, // the radius the top rolls over into the face
  cornerR: 0.12, // how far the face's outer corners are pulled in at the bottom
  tailR: 0.11, // the plan radius at the inner end
  edgeR: 0.1, // how wide the outer edge's roll is
  edgeDrop: 0.05, // how far it rolls down
  flareW: 0.1, // the black strip across the top
  archR: 0.345, // the wheel arch the skirt follows (the tyre is 0.3)
  lowEdge: 0.36, // where the skirt's tail ends, down by the footboard
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (k) => k * k * (3 - 2 * k);

/** The rows along a deck from its inner end over the top and down the face: { z, dy, g, half }. */
export function deckRows(D, spec) {
  const dir = Math.sign(spec.zf - spec.z0);
  const run = Math.abs(spec.zf - spec.z0) - D.rTop;
  const rows = [];
  const offs = [0, 0.01, 0.025, 0.045, 0.07, 0.1, 0.14];
  for (let z = 0.21; z < run - 0.02; z += 0.07) offs.push(z);
  offs.push(run);
  for (const o of offs) rows.push({ z: spec.z0 + dir * o, dy: 0, g: 0 });
  const zs = spec.z0 + dir * run;
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    rows.push({ z: zs + dir * D.rTop * Math.sin(a), dy: -D.rTop * (1 - Math.cos(a)), g: 0 });
  }
  for (let i = 1; i <= 3; i++) rows.push({ z: spec.zf, dy: -D.rTop - ((spec.faceH - D.rTop) * i) / 3, g: 0 });
  for (const r of rows) {
    r.g = clamp01(-r.dy / spec.faceH);
    let half = D.half;
    const t = Math.abs(r.z - spec.z0);
    if (t < D.tailR) {
      const k = (D.tailR - t) / D.tailR;
      half -= D.tailR * (1 - Math.sqrt(1 - k * k));
    }
    half -= D.cornerR * (1 - Math.sqrt(1 - r.g * r.g));
    r.half = half;
  }
  return rows;
}

/** The deck's surface height at x on a row: crowned, dipping a little at the middle, rolled down at the outer edge. */
export function deckY(D, spec, row, x) {
  const ax = Math.abs(x);
  let y = spec.top + row.dy - spec.crown * (ax / D.half) ** 2;
  y -= spec.dip * (1 - ease(clamp01((ax - 0.22) / 0.18)));
  if (ax > row.half - D.edgeR) {
    const t = (ax - (row.half - D.edgeR)) / D.edgeR;
    y -= D.edgeDrop * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  }
  return y;
}

/** A grid of points (rows of points, all rows the same length) as a surface. */
export function gridGeometry(rows) {
  const pos = [];
  const idx = [];
  const m = rows[0].length;
  for (const row of rows) for (const p of row) pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = (i + 1) * m + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The red deck, whole width. `which` is 'front' or 'rear'. */
export function deckGeometry(which, D = DECK) {
  const spec = D[which];
  const N = 30;
  const grid = deckRows(D, spec).map((r) => {
    const out = [];
    for (let j = 0; j <= N; j++) {
      const x = r.half * Math.sin((Math.PI / 2) * ((2 * j) / N - 1));
      out.push([x, deckY(D, spec, r, x), r.z]);
    }
    return out;
  });
  return gridGeometry(grid);
}

/** The black skirt's lower edge at z, for a wheel at wheelZ: the arch, sweeping down to the footboard towards the inner end. */
export function skirtBottom(D, spec, wheelZ, z) {
  const dz = z - wheelZ;
  const arch = D.archR > Math.abs(dz) ? 0.3 + Math.sqrt(D.archR ** 2 - dz * dz) : D.lowEdge;
  const k = clamp01((D.tailR * 1.6 - Math.abs(z - spec.z0)) / (D.tailR * 1.6));
  return arch + (D.lowEdge - arch) * k * k;
}

/** The black flare for one side (side = +1 or -1), on the deck of `which` over the wheel at wheelZ. */
export function flareGeometry(which, wheelZ, side, D = DECK) {
  const spec = D[which];
  const grid = deckRows(D, spec).map((r) => {
    const w = D.flareW * (1 - 0.8 * r.g);
    const out = [];
    for (let i = 0; i <= 3; i++) {
      const x = r.half - w + (w * i) / 3;
      out.push([side * x, deckY(D, spec, r, x) + 0.009, r.z]);
    }
    const yEdge = deckY(D, spec, r, r.half);
    out.push([side * (r.half + 0.01), yEdge + 0.004, r.z]);
    const lipY = yEdge - 0.022;
    out.push([side * (r.half + 0.013), lipY, r.z]);
    out.push([side * (r.half + 0.012), Math.min(skirtBottom(D, spec, wheelZ, r.z), lipY - 0.002), r.z]);
    return out;
  });
  return gridGeometry(grid);
}

/**
 * The height of the body's top between the two decks, front to back (z, y): the side panels' tops, the cover between them and the
 * walls' fillets all follow it, so the deck runs up into the body and down again with no step.
 */
export const BODY_TOP = [[-0.3, 0.754], [-0.2, 0.762], [-0.12, 0.768], [-0.05, 0.77], [0.05, 0.77], [0.1, 0.766], [0.17, 0.75], [0.24, 0.725], [0.3, 0.703]];

export function bodyTopY(z) {
  const T = BODY_TOP;
  if (z <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) {
    if (z <= T[i][0]) {
      const k = (z - T[i - 1][0]) / (T[i][0] - T[i - 1][0]);
      return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * ease(k);
    }
  }
  return T[T.length - 1][1];
}

/**
 * The height of the cover over the body at (x, z): the body's top line, easing within 6 cm of a deck's end to that deck's own edge
 * height there, so the cover and the deck meet in a seam with no step or crack, whatever the deck's crown does at that x.
 */
export function coverY(D, x, z) {
  const end = Math.abs(D.front.z0);
  const spec = z > 0 ? D.front : D.rear;
  const base = bodyTopY(z) - 0.004;
  const row = deckRows(D, spec)[0];
  const edge = deckY(D, spec, row, Math.min(Math.abs(x), row.half));
  const w = ease(clamp01(1 - (end - Math.abs(z)) / 0.06));
  return base + (edge - base) * w;
}

/**
 * The cover over the middle of the body, from one deck's end to the other's, as wide as the side panels and filling the wedge over
 * each wall's fillet (the fillet starts `fillet` back from the deck's end and curves out), so you cannot look down into the body from
 * above anywhere between the decks.
 */
export function topCoverGeometry(D = DECK, { xIn = 0.266, fillet = 0.1 } = {}) {
  const end = Math.abs(D.front.z0);
  const zs = [];
  for (let z = -end; z <= end + 1e-9; z += 0.025) zs.push(z);
  for (const z of [end - 0.01, end - 0.005, -end + 0.005, -end + 0.01]) zs.push(z);
  zs.sort((a, b) => a - b);
  const rows = zs.map((z) => {
    const d = end - Math.abs(z); // back from the deck's end
    const xmax = d >= fillet ? xIn + 0.004 : xIn + 0.004 + fillet * (1 - Math.sqrt(Math.max(0, 1 - (1 - d / fillet) ** 2)));
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const x = -xmax + (2 * xmax * i) / 12;
      pts.push([x, coverY(D, x, z), z]);
    }
    return pts;
  });
  return gridGeometry(rows);
}

/**
 * The wall at a deck's inner end (side = +1 or -1): the back of the front wheel arch, or the front of the rear one. It hangs from the
 * deck's end edge down to the footboard. It leaves the side panel's outer face (`xIn`) tangentially, `fillet` back from the deck's end,
 * so there is no corner between them, curves round a quarter circle in plan, and runs out to meet the black skirt's edge exactly at the
 * deck's end, with a belly in plan and in height. Without it the deck ends in a free edge with a slot behind it that shows straight
 * through the quad; the real fenders have no such edge.
 */
export function bulkheadGeometry(which, side, D = DECK, { xIn = 0.266, bottom = D.lowEdge, fillet = 0.1, bulge = 0.04 } = {}) {
  const spec = D[which];
  const dir = Math.sign(spec.zf - spec.z0);
  const row = deckRows(D, spec)[0];
  const xOut = row.half + 0.012; // the skirt's own x there, so no slit shows between them
  // The path in plan, from the panel round the fillet and out to the skirt: [x, z].
  const path = [];
  const A = 6;
  for (let i = 0; i <= A; i++) {
    const phi = (i / A) * (Math.PI / 2);
    path.push([xIn + fillet * (1 - Math.cos(phi)), spec.z0 - dir * fillet * (1 - Math.sin(phi))]);
  }
  const B = 5;
  for (let i = 1; i <= B; i++) path.push([xIn + fillet + ((xOut - xIn - fillet) * i) / B, spec.z0]);
  const rows = [];
  const M = 8;
  for (let k = 0; k <= M; k++) {
    const t = k / M;
    const pts = path.map(([x, z], i) => {
      const u = i / (path.length - 1);
      const top = i <= A ? coverY(D, x, z) : deckY(D, spec, row, Math.min(x, row.half)); // on the fillet it follows the cover, so they meet
      const back = bulge * Math.sin(Math.PI * t * 0.9) * Math.sin(Math.PI * u);
      return [side * x, top + (bottom - top) * t, z - dir * back];
    });
    rows.push(pts);
  }
  return gridGeometry(rows);
}
