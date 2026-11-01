// The shape of a girl's eyelid, on plain data (eyelids.js builds the meshes from it). Her eyes are painted ovals on her face, so the lid
// is a curtain that hangs from the top of the painted eye and lies on the face's own surface there: a plane fitted to the eye's
// triangles, with a little dome on it so a shut lid rounds over the eye like a real one. Everything is in her Head bone's space.

export const LID = {
  across: 1.25, // the lid is this much wider than the painted eye, so it covers the oval's edge
  down: 1.2, // and this much taller
  out: 0.004, // how far it lies off the face, beyond the painted eye's highest point
  dome: 0.005, // how far the middle of a shut lid rounds out from the face
  lift: 0.01, // how far the cheek pushes out under the eye when she squeezes it shut
  columns: 9,
  rows: 10, // the last of them dark: her lash line
  reach: 1, // how far down its height a shut lid comes: all the way to the lash line, so no painted eye shows under it
};

/** Least-squares plane z = a + b x + c y through points [x, y, z], or null if they don't span one. */
export function fitPlane(points) {
  let sx = 0, sy = 0, sz = 0, sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0;
  for (const [x, y, z] of points) {
    sx += x; sy += y; sz += z;
    sxx += x * x; sxy += x * y; syy += y * y;
    sxz += x * z; syz += y * z;
  }
  const n = points.length;
  // Solve the normal equations by Cramer's rule.
  const m = [[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]];
  const r = [sz, sxz, syz];
  const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  if (n < 3 || Math.abs(d) < 1e-12) return null;
  const col = (k) => m.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)));
  return { a: det(col(0)) / d, b: det(col(1)) / d, c: det(col(2)) / d };
}

/** An eye from the painted oval's vertices [x, y, z]: its middle, half-width and half-height, and the face under it. Null if it's no eye. */
export function eyeOf(points) {
  if (points.length < 4) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const plane = fitPlane(points);
  if (!plane) return null;
  const at = (x, y) => plane.a + plane.b * x + plane.c * y;
  // The painted eye's own corners stand a little proud of the plane through them: lie off the highest.
  const proud = Math.max(0, ...points.map((p) => p[2] - at(p[0], p[1])));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, plane, proud };
}

/** Whether a painted shape is an eye (round-ish and tall) rather than a brow (a wide thin stroke). */
export function isEye(points) {
  const e = eyeOf(points);
  return !!e && e.hh > e.hw * 0.8;
}

/**
 * The lid's vertices at `s`: 0 open (a sliver tucked at the top of the eye, nothing to see), 1 shut, past 1 squeezed (rounder, wider, and
 * the cheek lifting). Returns { positions: [x, y, z][], colors: share of the way to the lash line (0 skin, 1 lash)[], index }; the
 * vertex count and index don't change with `s`, only where the vertices are.
 */
export function lidAt(eye, s, p = LID) {
  const squeeze = Math.max(0, s - 1);
  const k = Math.max(0, Math.min(1, s));
  const a = eye.hw * p.across * (1 + 0.12 * squeeze);
  const b = eye.hh * p.down;
  const top = eye.y + b;
  const shutEdge = top - 2 * b * p.reach;
  const edge = top + (shutEdge - top) * k;
  const out = eye.proud + p.out;
  const positions = [];
  const lash = [];
  for (let r = 0; r < p.rows; r++) {
    const t = r / (p.rows - 1);
    const y = top + (edge - top) * t;
    // The curtain is cut to the eye's oval, so a half-closed lid has the oval's curve at its edge.
    const w = a * Math.cbrt(Math.max(0, 1 - Math.abs((y - eye.y) / b) ** 3)); // a rounded-off oval, so the painted eye's corners are covered
    for (let c = 0; c < p.columns; c++) {
      const u = (c / (p.columns - 1)) * 2 - 1;
      const x = eye.x + u * w;
      // Rounded over the eye while it's shut, flatter while it's lifting.
      const round = Math.max(0, 1 - u * u) * Math.max(0, 1 - ((y - eye.y) / b) ** 2);
      let z = eye.plane.a + eye.plane.b * x + eye.plane.c * y + out + p.dome * k * Math.sqrt(round);
      // Squeezed, the skin under the eye pushes up and out.
      if (squeeze > 0 && y < eye.y) z += p.lift * Math.min(1, squeeze / 0.25) * Math.min(1, (eye.y - y) / b);
      positions.push([x, y, z]);
      lash.push(r === p.rows - 1 ? 1 : 0);
    }
  }
  const index = [];
  for (let r = 0; r < p.rows - 1; r++) {
    for (let c = 0; c < p.columns - 1; c++) {
      const i = r * p.columns + c;
      index.push(i, i + p.columns, i + 1, i + 1, i + p.columns, i + p.columns + 1);
    }
  }
  return { positions, lash, index };
}
