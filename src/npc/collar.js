// The polo's collar, built on the garment polo's neck edge (the spike behind ?polo=shell; see DECISIONS.md, "The polo as a
// garment"). Pure, on plain data (garmentMesh.js).
//
// A polo collar is a band standing up round the neck (the stand) that folds over at the top and lies back down over itself and
// on to the shirt (the fall), coming down into a point either side at the front. Earlier collars were fitted to her body, which
// has no neckline to sit on; this one stands on the shirt's own cut edge, a smooth ring of points that move with her, and its
// fall is laid on whatever is outermost there (the shirt, or the jumper over it) by rays, so it never sinks in.

import { rayHit, inTriangle, between, blendWeights, applySkin, unskin, vec } from './garmentMesh.js';

const { sub, add, scale, cross, norm, lerp, dot } = vec;
const TAU = Math.PI * 2;
const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

export const COLLAR = {
  stand: 0.021, // height of the stand at the back (m)
  standFront: 0.016, // and at the front
  lean: 0.003, // the stand leans in towards her neck by this at the top
  roll: 0.009, // how far the fold rolls out over the top of the stand
  out: 0.026, // how far the fall reaches out from the fold, at the back
  drop: 0.01, // how far below the neckline the fall's edge lies, beyond covering the stand
  pointOut: 0.02, // the points: this much further out at the ends
  pointDrop: 0.03, // and this much further down
  pointSpread: 0.75, // turned this much out towards her shoulders, so each wing's front edge runs down and outward
  pointReach: 0.9, // over this many radians from each end
  tipRound: 0.05, // radians at each end over which the point's corner is rounded, only slightly
  clear: 0.003, // how far the fall lies off what's under it
  feel: 0.004, // and it looks this far either side down the fall for anything higher under it
  thickness: 0.0016,
  foldThin: 0.3, // thinner where it folds over the top of the stand, or the inside shows through the sharp bend
  closedGap: 0.0005, // done up, the stand closes over the top of the placket, this far either side of her middle
  placketClear: 0.002, // and the wings start just beyond the placket's edges, leaving it showing
  smoothing: 4, // passes evening out the fall after it's laid on what's under it, so no fold flips over
  edgeShade: 0.9, // the fall's outer edge, a shade darker
  underShade: 0.72, // its underside
  columns: 72,
};

/**
 * Builds the collar. `shirt` is the garment polo's shell (its neck edge is the points tagged 'neck'), `vee` its open neck if
 * any, `placketWidth` how wide the placket is, `over` the meshes it may lie on (the shirt, the jumper). Done up, the stand
 * closes across the top of the placket and the wings start at the placket's edges, leaving it showing; open, both start at the
 * top corners of the V. Returns { verts, tris, shade }, verts carrying bind, rest, weights and skin like the shirt's.
 */
export function buildCollar(shirt, body, { vee = null, placketWidth, over }, p = COLLAR) {
  const neck = body.bones.Neck;
  const [x0, , z0] = neck;
  const angleOf = (r) => (((Math.atan2(r[0] - x0, r[2] - z0) % TAU) + TAU) % TAU); // 0 at her front, rising towards her left
  let edge = shirt.verts.filter((v) => v.edge === 'neck' && !v.apart);
  // An open neck: only the round part of the neckline, not down the V.
  if (vee) edge = edge.filter((v) => v.rest[1] >= vee.top - 0.003 || v.rest[2] < z0);
  const ring = edge.map((v) => ({ v, a: angleOf(v.rest) })).sort((a, b) => a.a - b.a);
  if (ring.length < 8) return null;
  // The neck edge at an angle, interpolated round the ring.
  const at = (theta) => {
    const a = ((theta % TAU) + TAU) % TAU;
    let i = ring.findIndex((q) => q.a > a);
    if (i < 0) i = 0;
    const lo = ring[(i - 1 + ring.length) % ring.length];
    const hi = ring[i];
    const span = (((hi.a - lo.a) % TAU) + TAU) % TAU || TAU;
    const t = ((((a - lo.a) % TAU) + TAU) % TAU) / span;
    return between(lo.v, hi.v, t);
  };
  // The angles either side of her front where the neck edge is `reach` out from her middle.
  const ends = (reach) => {
    let a0 = null;
    let a1 = null;
    for (let a = 0; a < Math.PI && a0 === null; a += 0.004) if (at(a).rest[0] - x0 >= reach) a0 = a;
    for (let a = TAU; a > Math.PI && a1 === null; a -= 0.004) if (at(a).rest[0] - x0 <= -reach) a1 = a;
    return a0 === null || a1 === null ? null : [a0, a1];
  };
  const standSpan = ends(vee ? vee.halfWidth(vee.top) : p.closedGap);
  const fallSpan = vee ? standSpan : ends(placketWidth / 2 + p.placketClear);
  if (!standSpan || !fallSpan) return null;

  // What the fall can lie on, near her neck.
  const near = (v) => Math.hypot(v.rest[0] - x0, v.rest[1] - neck[1], v.rest[2] - z0) < 0.22;
  const ground = { verts: [], tris: [] };
  for (const m of over) {
    const base = ground.verts.length;
    ground.verts.push(...m.verts);
    for (const t of m.tris) if (t.some((i) => near(m.verts[i]))) ground.tris.push(t.map((i) => i + base));
  }

  const U = [0, 1, 0];
  const outward = (theta) => [Math.sin(theta), 0, Math.cos(theta)];
  // The stand is lower towards her front.
  const fromFront = (theta) => Math.min(theta, TAU - theta);
  const standHeight = (theta) => p.stand + (p.standFront - p.stand) * smooth01(1 - fromFront(theta) / (fallSpan[0] + p.pointReach));
  const standTop = (theta, B) => add(add(B.rest, scale(U, standHeight(theta))), scale(outward(theta), -p.lean));
  const columns = ([a0, a1], n, make) => Array.from({ length: n + 1 }, (_, c) => make(a0 + ((a1 - a0) * c) / n, c));

  // The stand: up from the neck edge all the way round, closing across the top of the placket when done up.
  const stand = columns(standSpan, p.columns, (theta) => {
    const B = at(theta);
    const O = outward(theta);
    const h = standHeight(theta);
    return [add(add(B.rest, scale(U, -0.003)), scale(O, 0.0005)), add(add(B.rest, scale(U, h * 0.5)), scale(O, -p.lean * 0.5)), standTop(theta, B)].map(
      (rest) => ({ ...B, rest }),
    );
  });

  // The fall: over the fold at the top of the stand and down on to what's under it, coming to a point at each end, turned out
  // towards her shoulders there.
  // Close together, so the fall rides over a narrow ridge under it (a jumper's neck) rather than letting it through between.
  const rowsT = [0.06, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const [f0, f1] = fallSpan;
  const fall = columns(fallSpan, p.columns, (theta) => {
    const B = at(theta);
    const O = outward(theta);
    const fromEnd = Math.min(theta - f0, f1 - theta);
    const k = smooth01(1 - fromEnd / p.pointReach); // 1 at the ends, where the points are
    const side = theta < Math.PI ? 1 : -1; // her left wing (+x as she stands) or her right
    const h = standHeight(theta);
    const T = standTop(theta, B);
    const dir = norm(add(O, [side * p.pointSpread * k, 0, 0]));
    const fold = add(add(T, scale(O, p.roll)), scale(U, 0.003));
    const far = add(add(T, scale(dir, p.out + p.pointOut * k)), scale(U, -(h + p.drop + p.pointDrop * k)));
    const bez = (t) => add(add(scale(T, (1 - t) * (1 - t)), scale(fold, 2 * t * (1 - t))), scale(far, t * t));
    // Lifted on to what's under it, along a line from a point inside her chest below the neck.
    const centre = [x0, B.rest[1] - 0.06, z0];
    const column = [{ ...B, rest: T }];
    rowsT.forEach((t, r) => {
      let q = bez(t);
      if (r === rowsT.length - 1 && fromEnd < p.tipRound) q = lerp(q, bez(0.85), 0.25 * (1 - fromEnd / p.tipRound) ** 2);
      const D = norm(sub(q, centre));
      // What's under it here, and a few millimetres either side down the fall: it rests on the highest of them, so a narrow
      // ridge between two of its points (a jumper's neck) can't come through.
      const down = norm(sub(bez(Math.min(1, t + 0.05)), bez(Math.max(0, t - 0.05))));
      let under = null;
      let surface = -Infinity;
      for (const d of [0, -p.feel, p.feel]) {
        const from = add(q, scale(down, d));
        const hit = rayHit(ground, add(from, scale(D, 0.12)), scale(D, -1));
        if (!hit) continue;
        const v = inTriangle(ground, hit.tri, hit.bary);
        const level = dot(sub(v.rest, centre), D);
        if (level > surface) surface = level;
        if (!under || d === 0) under = v;
      }
      const floor = surface + p.clear;
      const mine = dot(sub(q, centre), D);
      if (mine < floor) q = add(q, scale(D, floor - mine));
      // Its skin blends from the neck edge's to that of what it lies on, so it moves with her shoulders.
      const s = under ? smooth01(t) : 0;
      column.push({ ...B, rest: q, weights: under ? blendWeights(B.weights, under.weights, s) : B.weights, skin: under ? lerp(B.skin, under.skin, s) : B.skin, lay: { centre, D, floor } });
    });
    return column;
  });

  // Even the fall out (each point towards the middle of its neighbours, along and across), then lift anything that went under
  // what it lies on back out: laid point by point, neighbours lifted by different amounts could fold a triangle over.
  for (let pass = 0; pass < p.smoothing; pass++) {
    const next = fall.map((col) => col.map((v) => v.rest));
    for (let c = 1; c < fall.length - 1; c++) {
      for (let r = 2; r < fall[c].length - 1; r++) {
        const n = [fall[c - 1][r], fall[c + 1][r], fall[c][r - 1], fall[c][r + 1]].map((v) => v.rest);
        next[c][r] = lerp(fall[c][r].rest, scale(n.reduce((a, b) => add(a, b)), 0.25), 0.5);
      }
    }
    fall.forEach((col, c) =>
      col.forEach((v, r) => {
        let q = next[c][r];
        if (v.lay) {
          const mine = dot(sub(q, v.lay.centre), v.lay.D);
          if (mine < v.lay.floor) q = add(q, scale(v.lay.D, v.lay.floor - mine));
        }
        v.rest = q;
      }),
    );
  }

  const out = { verts: [], tris: [], shade: [] };
  slab(out, stand, standSpan, p, () => 1, () => 1);
  slab(out, fall, fallSpan, p, (r, R) => (r === R - 1 ? p.edgeShade : 1), (r) => (r <= 2 ? p.foldThin : 1));
  for (const v of out.verts) v.rest = applySkin(v.skin, v.bind);
  return out;
}

/**
 * A grid of points ([column][row]) made into a slab: the outside, an inside the thickness in (times `thin(row)`), and its four
 * edges closed. `shadeOf(row, rows)` shades the outside; the inside is darker.
 */
function slab(out, grid, [a0, a1], p, shadeOf, thin) {
  const U = [0, 1, 0];
  const C = grid.length;
  const R = grid[0].length;
  const normal = (c, r) => {
    const dc = sub(grid[Math.min(C - 1, c + 1)][r].rest, grid[Math.max(0, c - 1)][r].rest);
    const dr = sub(grid[c][Math.min(R - 1, r + 1)].rest, grid[c][Math.max(0, r - 1)].rest);
    let n = norm(cross(dc, dr));
    const theta = a0 + ((a1 - a0) * c) / (C - 1);
    if (dot(n, add([Math.sin(theta), 0, Math.cos(theta)], scale(U, 0.3))) < 0) n = scale(n, -1);
    return n;
  };
  const put = (v, rest, k) => {
    out.verts.push({ bind: unskin(v.skin, rest), rest, weights: v.weights, skin: v.skin, normal: [0, 1, 0] });
    out.shade.push(k);
    return out.verts.length - 1;
  };
  const top = grid.map((col) => col.map((v, r) => put(v, v.rest, shadeOf(r, R))));
  const under = grid.map((col, c) => col.map((v, r) => put(v, sub(v.rest, scale(normal(c, r), p.thickness * thin(r))), p.underShade)));
  const quad = (a, b, c, d) => out.tris.push([a, b, c], [b, d, c]);
  for (let c = 0; c < C - 1; c++) {
    for (let r = 0; r < R - 1; r++) {
      quad(top[c][r], top[c + 1][r], top[c][r + 1], top[c + 1][r + 1]);
      quad(under[c + 1][r], under[c][r], under[c + 1][r + 1], under[c][r + 1]);
    }
    quad(top[c][R - 1], top[c + 1][R - 1], under[c][R - 1], under[c + 1][R - 1]);
    quad(under[c][0], under[c + 1][0], top[c][0], top[c + 1][0]);
  }
  for (let r = 0; r < R - 1; r++) {
    quad(under[0][r], under[0][r + 1], top[0][r], top[0][r + 1]);
    quad(top[C - 1][r], top[C - 1][r + 1], under[C - 1][r], under[C - 1][r + 1]);
  }
}
