// The wax jacket's hood. Pure: points and triangles as she stands (her root's frame: front +z, her left +x, up +y), built round
// her measured head (helmetView.measureHead) and down to the coat's collar, which it tucks inside. Up, it rides on her head
// bone like her helmet; down, the same hood pushed back off her head lies crumpled on her back over the coat, on her chest
// bone. A waxed outside, a tartan lining, and a rolled edge round the face so it has some thickness.

export const HOOD = {
  fit: 1.12, // its size against her measured head, so it clears her hair
  clear: 0.018, // and this much more all round (m)
  above: 0.03, // the crown above the top of her head
  centreDrop: 0.1, // her head's middle below its top
  back: 0.012, // the hood sits this far back of her head's axis, round the back of her hair
  faceHalf: 1.0, // radians either side of her front the face opening reaches at its widest
  faceTop: 0.06, // metres above her head's middle the opening closes over her forehead
  neckHalf: 0.62, // and how wide it stays below her chin, down to the collar
  tuck: 0.012, // its bottom edge this far inside the collar's edge
  lining: 0.004, // the lining this far inside the wax
  rows: 26,
  columns: 44,
  // Pushed back, down her back: turned about the back of the collar, then pressed flat against the coat.
  downTurn: 2.5, // radians it turns back off her head
  downSquash: 0.18, // how flat it lies: its depth off her back against how far it stood out
  downClear: 0.005, // off the coat
  crumple: 0.006, // creases in it, lying down
};

const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/** How far either side of her front (radians) the opening is at height y, from the hood's middle `cy`. 0 above her forehead. */
export function faceGap(y, cy, p = HOOD) {
  const yc = cy - 0.01;
  const span = p.faceTop + 0.01;
  if (y >= yc) return p.faceHalf * Math.sqrt(Math.max(0, 1 - ((y - yc) / span) ** 2));
  return p.faceHalf + (p.neckHalf - p.faceHalf) * smooth01((yc - y) / 0.1);
}

/**
 * The hood's shape: `profile(t)` from its crown (t 0) to its bottom edge (t 1) gives the height and the half-width and half-depth
 * of the round there, `centreAt(t)` the middle of the round (her head's axis, drifting to her neck's further down).
 */
export function hoodShape(head, collar, p = HOOD) {
  const cx = head.x;
  const cz = head.z - p.back;
  const cy = head.top - p.centreDrop;
  const rx = (head.width / 2) * p.fit + p.clear;
  const rz = (head.depth / 2) * p.fit + p.clear;
  const ry = p.centreDrop + p.above;
  const neckR = Math.max(0.03, collar.radius - p.tuck);
  const split = 0.62; // the part of the way down at which it leaves the round of her head for the collar
  const lowAngle = -0.45;
  const profile = (t) => {
    if (t <= split) {
      const e = Math.PI / 2 - (t / split) * (Math.PI / 2 - lowAngle);
      return { y: cy + ry * Math.sin(e), hx: rx * Math.cos(e), hz: rz * Math.cos(e) };
    }
    const u = smooth01((t - split) / (1 - split));
    const y0 = cy + ry * Math.sin(lowAngle);
    const hx0 = rx * Math.cos(lowAngle);
    const hz0 = rz * Math.cos(lowAngle);
    return { y: y0 + (collar.y - y0) * ((t - split) / (1 - split)), hx: hx0 + (neckR - hx0) * u, hz: hz0 + (neckR - hz0) * u };
  };
  const centreAt = (t) => {
    const k = smooth01((t - split) / (1 - split));
    return [cx + (collar.x - cx) * k, cz + (collar.z - cz) * k];
  };
  return { cy, top: cy + ry, bottom: collar.y, profile, centreAt };
}

/**
 * A point of her hair moved to inside the hood (`shape`, hoodShape), `margin` in from the cloth, for squashing her hair under
 * it: pulled in towards the middle of the round where it stands out, and up where it hangs below the hood's edge. A point
 * already inside, or in front of her face in the opening, keeps where it is across (only its height is kept in the hood).
 */
export function intoHood([x, y, z], shape, margin = 0.006) {
  const yy = Math.min(shape.top - margin, Math.max(shape.bottom + margin, y));
  // The round at that height: t by halving, the profile's height falling as t rises.
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (shape.profile(mid).y > yy) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  const { hx, hz } = shape.profile(t);
  const [mx, mz] = shape.centreAt(t);
  const dx = x - mx;
  const dz = z - mz;
  const f = Math.hypot(dx / Math.max(hx - margin, 0.005), dz / Math.max(hz - margin, 0.005));
  const k = f > 1 ? 1 / f : 1;
  return [mx + dx * k, yy, mz + dz * k];
}

/**
 * The hood up. `head`: { top, x, z, width, depth } (measureHead). `collar`: { y, radius, x, z }, the height of the coat's neck
 * edge and how far it is from the middle of her neck. Returns { points, tris, kind } (kind per point: 'wax', 'lining' or
 * 'edge') and `uv` per point ([round, down], 0 to 1, for the lining's tartan).
 */
export function buildHood(head, collar, p = HOOD) {
  const shape = hoodShape(head, collar, p);
  const { cy, profile, centreAt } = shape;
  const points = [];
  const kind = [];
  const uv = [];
  const tris = [];
  const R = p.rows;
  const C = p.columns;
  const layer = (inset, k) => {
    const start = points.length;
    for (let r = 0; r <= R; r++) {
      const t = r / R;
      const { y, hx, hz } = profile(t);
      const g = faceGap(y, cy, p);
      const [mx, mz] = centreAt(t);
      for (let c = 0; c <= C; c++) {
        const a = g + ((Math.PI * 2 - 2 * g) * c) / C;
        points.push([mx + Math.max(0.005, hx - inset) * Math.sin(a), y - (t < 0.05 ? inset : 0), mz + Math.max(0.005, hz - inset) * Math.cos(a)]);
        kind.push(k);
        uv.push([c / C, t]);
      }
    }
    return start;
  };
  const wax = layer(0, 'wax');
  const lin = layer(p.lining, 'lining');
  const at = (base, r, c) => base + r * (C + 1) + c;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const [a, b, d, e] = [at(wax, r, c), at(wax, r, c + 1), at(wax, r + 1, c), at(wax, r + 1, c + 1)];
      tris.push([a, b, d], [b, e, d]); // facing out
      const [la, lb, ld, le] = [at(lin, r, c), at(lin, r, c + 1), at(lin, r + 1, c), at(lin, r + 1, c + 1)];
      tris.push([la, ld, lb], [lb, ld, le]); // facing in
    }
  }
  // The rolled edge: round the face (both ends of every row) and along the bottom, from the wax over to the lining.
  const edge = (i) => {
    points.push(points[i].slice());
    kind.push('edge');
    uv.push(uv[i].slice());
    return points.length - 1;
  };
  const join = (pairs) => {
    for (let k = 0; k < pairs.length - 1; k++) {
      const [w0, l0] = pairs[k];
      const [w1, l1] = pairs[k + 1];
      tris.push([w0, l0, w1], [w1, l0, l1]);
    }
  };
  const side = (c, flip) => {
    const pairs = [];
    for (let r = 0; r <= R; r++) pairs.push([edge(at(wax, r, c)), edge(at(lin, r, c))]);
    join(flip ? pairs.map(([w, l]) => [l, w]) : pairs);
  };
  side(0, false);
  side(C, true);
  const bottom = [];
  for (let c = 0; c <= C; c++) bottom.push([edge(at(wax, R, c)), edge(at(lin, R, c))]);
  join(bottom);
  return { points, tris, kind, uv, shape };
}

/**
 * The hood pushed back off her head: turned back about the back of the collar (`pivot`), then pressed flat on to her back,
 * `backAt(y)` the coat's surface there (the furthest back of it near her middle, as z), with a few soft creases. Same shape of
 * result as buildHood.
 */
export function lowerHood(hood, pivot, backAt, p = HOOD) {
  const c = Math.cos(-p.downTurn);
  const s = Math.sin(-p.downTurn);
  const points = hood.points.map(([x, y, z]) => {
    const dy = y - pivot[1];
    const dz = z - pivot[2];
    const ry = dy * c - dz * s;
    const rz = dy * s + dz * c;
    const ny = pivot[1] + ry;
    const off = Math.abs(rz) * p.downSquash;
    const crease = p.crumple * Math.sin(x * 60 + ny * 35) * Math.sin(ny * 50);
    return [x, ny, Math.min(backAt(ny), pivot[2]) - p.downClear - off - Math.max(0, crease)];
  });
  // Lying down it's crumpled over on itself: what shows is the wax.
  return { ...hood, points, kind: hood.kind.map((k) => (k === 'lining' ? 'wax' : k)) };
}

/** The lining's tartan at (round, down): a dark green and navy check with thin red and yellow lines. Linear RGB, 0 to 1. */
export function tartan([u, v]) {
  const a = (u * 18) % 1;
  const b = (v * 9) % 1;
  if (Math.abs(a - 0.5) < 0.03 || Math.abs(b - 0.5) < 0.05) return [0.2, 0.03, 0.03]; // red line
  if (Math.abs(a - 0.1) < 0.015 || Math.abs(b - 0.1) < 0.025) return [0.22, 0.18, 0.06]; // yellow line
  const dark = (a < 0.5) !== (b < 0.5);
  return dark ? [0.02, 0.04, 0.06] : [0.03, 0.09, 0.05];
}
