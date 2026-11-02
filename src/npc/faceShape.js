// The shapes of a girl's brows and mouth, on plain data (face.js builds the meshes from them). Her brows are painted strokes on her
// face and she has no mouth at all, so both are thin pieces laid on the face's own surface: the brows where the painted ones were, the
// mouth between her nose and her chin. `surface` is the face's height (z, out of her face) at a point (x across, y up), everything in
// her Head bone's space; faceExpression.js says how they're posed.

export const FACE = {
  out: 0.006, // how far the mouth lies off the face (head units: about 2 mm)
  browOut: 0.009, // and the brows, over the ridge of her brow
  browThick: 0.019, // a brow strip's height at its inner end (about 6 mm), tapering to `browTip` of it at the outer end
  browTip: 0.45,
  browLift: 0.03, // how far a fully raised brow goes up (about 9 mm); lowered, as far down
  browKnit: 0.024, // how far the inner ends come down and in when she frowns
  browColumns: 9,
  mouthY: 0.163, // the mouth's middle, up from the Head bone: a third of the way from the bottom of her nose to her chin
  mouthHalf: 0.068, // half its width at rest (about 2 cm)
  mouthWide: 0.022, // how much wider it stretches in a grimace
  lipUpper: 0.011, // the upper lip's height at its middle
  lipLower: 0.014, // and the lower's
  mouthCurve: 0.022, // how far the corners go up in a smile, or down in a scowl
  mouthOpen: 0.05, // how far the lips part for a laugh
  teeth: 0.4, // the share of an open mouth the upper teeth fill, at most
  mouthColumns: 11,
};

/** A smooth step over 0..1. */
const ease = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/** A height field from `sample(x, y)` (the face's z, or null where there's none) on a grid, read back by bilinear interpolation. */
export function heightField(sample, x0, x1, y0, y1, nx = 24, ny = 16) {
  const zs = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) zs.push(sample(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny));
  // A ray that missed (round the side of her head) takes the nearest hit along its row, so the field has no holes.
  for (let j = 0; j <= ny; j++) {
    const row = zs.slice(j * (nx + 1), (j + 1) * (nx + 1));
    for (let i = 0; i <= nx; i++) {
      if (row[i] !== null) continue;
      let best = null;
      for (let d = 1; d <= nx && best === null; d++) best = row[i - d] ?? row[i + d] ?? null;
      zs[j * (nx + 1) + i] = best ?? 0;
    }
  }
  return (x, y) => {
    const fx = Math.max(0, Math.min(nx, ((x - x0) / (x1 - x0)) * nx));
    const fy = Math.max(0, Math.min(ny, ((y - y0) / (y1 - y0)) * ny));
    const i = Math.min(nx - 1, Math.floor(fx));
    const j = Math.min(ny - 1, Math.floor(fy));
    const u = fx - i;
    const v = fy - j;
    const z = (a, b) => zs[b * (nx + 1) + a];
    return (z(i, j) * (1 - u) + z(i + 1, j) * u) * (1 - v) + (z(i, j + 1) * (1 - u) + z(i + 1, j + 1) * u) * v;
  };
}

/** A point `out` off the surface at (x, y), along the surface's normal there: [x, y, z]. */
export function onSurface(surface, x, y, out) {
  const e = 0.004;
  const dx = (surface(x + e, y) - surface(x - e, y)) / (2 * e);
  const dy = (surface(x, y + e) - surface(x, y - e)) / (2 * e);
  const n = Math.hypot(dx, dy, 1);
  return [x - (dx / n) * out, y - (dy / n) * out, surface(x, y) + out / n];
}

/**
 * A brow from the painted stroke's vertices [x, y, z]: where it runs (x from its inner end to its outer, `side` +1 on the left of her
 * face) and its middle line, as a parabola y = a + b x + c x² fitted through the stroke. Null if it's no stroke.
 */
export function browOf(points) {
  if (points.length < 3) return null;
  const xs = points.map((p) => p[0]);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  if (hi - lo < 1e-6) return null;
  // Least squares for the parabola, on x scaled to -1..1 so the sums stay well conditioned.
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const [x, y] of points) {
    const u = (x - mid) / half;
    s0 += 1; s1 += u; s2 += u * u; s3 += u ** 3; s4 += u ** 4;
    t0 += y; t1 += u * y; t2 += u * u * y;
  }
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const m = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]];
  const r = [t0, t1, t2];
  const d = det3(m);
  if (Math.abs(d) < 1e-12) return null;
  const col = (k) => m.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)));
  const [a, b, c] = [det3(col(0)) / d, det3(col(1)) / d, det3(col(2)) / d];
  const side = mid > 0 ? 1 : -1;
  // Inner end is the one nearer her middle.
  const inner = side > 0 ? lo : hi;
  const outer = side > 0 ? hi : lo;
  return { inner, outer, side, line: (x) => a + b * ((x - mid) / half) + c * ((x - mid) / half) ** 2 };
}

/** A strip's index: `columns` across, `rows` down, two triangles a cell. */
function stripIndex(columns, rows, first = 0) {
  const index = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const i = first + r * columns + c;
      index.push(i, i + columns, i + 1, i + 1, i + columns, i + columns + 1);
    }
  }
  return index;
}

/**
 * The brow strip's vertices for a pose: `lift` -1 (lowered) to 1 (raised), `knit` 0 to 1 (inner end down and in, a frown). Three rows
 * (top edge, middle, bottom edge, so it bends over her brow) of `browColumns`, inner end first. Returns { positions: [x, y, z][], index }.
 */
export function browAt(brow, { lift = 0, knit = 0 } = {}, surface, p = FACE) {
  const positions = [];
  const top = [];
  const middle = [];
  const bottom = [];
  for (let c = 0; c < p.browColumns; c++) {
    const t = c / (p.browColumns - 1); // 0 inner, 1 outer
    // Knitting pulls the inner end in towards her nose and down, the pull dying away along the brow.
    const pull = knit * (1 - ease(t * 1.6));
    const x = brow.inner + (brow.outer - brow.inner) * t - brow.side * pull * p.browKnit * 0.6;
    const y = brow.line(brow.inner + (brow.outer - brow.inner) * t) + lift * p.browLift * (1 - 0.3 * t) - pull * p.browKnit;
    const h = p.browThick * (1 - (1 - p.browTip) * t);
    top.push(onSurface(surface, x, y + h / 2, p.browOut));
    middle.push(onSurface(surface, x, y, p.browOut));
    bottom.push(onSurface(surface, x, y - h / 2, p.browOut));
  }
  positions.push(...top, ...middle, ...bottom);
  return { positions, index: stripIndex(p.browColumns, 3) };
}

/**
 * The mouth for a pose: `curve` -1 (corners down) to 1 (up), `wide` 0 to 1 (stretched flat), `open` 0 to 1 (lips apart), `teeth` 0
 * to 1 (how much of the opening the upper teeth fill). Three strips, each `mouthColumns` across: the upper lip (two rows, its top edge
 * and the mouth line), the inside (three rows: under the upper lip, where the teeth stop, over the lower lip) and the lower lip (two
 * rows). Returns { positions, part: 'lip' | 'teeth' | 'inside' a vertex, index } with the vertex count fixed whatever the pose.
 */
export function mouthAt({ curve = 0, wide = 0, open = 0, teeth = 0 } = {}, surface, x0 = 0, p = FACE) {
  const half = p.mouthHalf + wide * p.mouthWide;
  const gap = open * p.mouthOpen;
  const rows = { upperTop: [], upperLine: [], inTop: [], inTeeth: [], inBottom: [], lowerLine: [], lowerBottom: [] };
  for (let c = 0; c < p.mouthColumns; c++) {
    const u = (c / (p.mouthColumns - 1)) * 2 - 1; // -1 her right corner, 1 her left
    const x = x0 + u * half;
    const along = 1 - u * u; // 1 in the middle, 0 at the corners
    // The corners lift (or drop) and the middle stays: a smile is a curve, not the whole mouth moving up.
    const lineY = p.mouthY + curve * p.mouthCurve * u * u;
    // Opened, the lips part most in the middle and meet at the corners; a smile lifts the upper lip less than the jaw drops.
    const upperLine = lineY + gap * 0.3 * along;
    const lowerLine = lineY - gap * 0.7 * Math.sqrt(along);
    // A wide grimace thins the lips; the corners taper to nothing.
    const thin = 1 - 0.4 * wide;
    rows.upperTop.push([x, upperLine + p.lipUpper * thin * Math.sqrt(along)]);
    rows.upperLine.push([x, upperLine]);
    rows.inTop.push([x, upperLine]);
    rows.inTeeth.push([x, upperLine - (upperLine - lowerLine) * teeth * p.teeth]);
    rows.inBottom.push([x, lowerLine]);
    rows.lowerLine.push([x, lowerLine]);
    rows.lowerBottom.push([x, lowerLine - p.lipLower * thin * Math.sqrt(along)]);
  }
  const lay = (row) => row.map(([x, y]) => onSurface(surface, x, y, p.out));
  // The inside lies a hair under the lips, so where they overlap the lips win.
  const layIn = (row) => row.map(([x, y]) => onSurface(surface, x, y, p.out * 0.7));
  const n = p.mouthColumns;
  const positions = [...lay(rows.upperTop), ...lay(rows.upperLine), ...layIn(rows.inTop), ...layIn(rows.inTeeth), ...layIn(rows.inBottom), ...lay(rows.lowerLine), ...lay(rows.lowerBottom)];
  const part = [...Array(2 * n).fill('lip'), ...Array(n).fill('teeth'), ...Array(n).fill('teeth'), ...Array(n).fill('inside'), ...Array(2 * n).fill('lip')];
  // The teeth band runs from inTop to inTeeth; the dark from inTeeth down. Its own copy of the inTeeth row keeps the edge sharp.
  const darkTop = positions.slice(3 * n, 4 * n);
  positions.push(...darkTop);
  part.push(...Array(n).fill('inside'));
  const index = [
    ...stripIndex(n, 2, 0), // upper lip
    ...stripIndex(n, 2, 2 * n), // teeth: inTop to inTeeth
    ...stripIndex(n, 2, 7 * n).map((i) => (i >= 8 * n ? i - 4 * n : i)), // the dark: the copy of inTeeth to inBottom
    ...stripIndex(n, 2, 5 * n), // lower lip
  ];
  return { positions, part, index };
}

/** The face's height at (x, y): the frontmost of `tris` ([[x, y, z] x3]) a ray along -z there hits, or null if it hits none. */
export function frontmostZ(tris, x, y) {
  let best = null;
  for (const [a, b, c] of tris) {
    // Barycentric in x, y: the ray is straight along z.
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
    if (u < 0 || v < 0 || u + v > 1) continue;
    const z = u * a[2] + v * b[2] + (1 - u - v) * c[2];
    if (best === null || z > best) best = z;
  }
  return best;
}
