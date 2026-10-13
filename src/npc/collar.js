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
  standFront: 0.016, // and at its front ends
  lean: 0.003, // the stand leans in towards her neck by this at the top
  roll: 0.009, // how far the fold rolls out over the top of the stand
  out: 0.026, // how far the fall reaches out from the fold, at the back
  drop: 0.01, // how far below the neckline the fall's edge lies, beyond covering the stand
  pointOut: 0.022, // the points: this much further out at the ends
  pointDrop: 0.038, // and this much further down
  pointForward: 0.45, // turned this much towards her front
  pointReach: 0.9, // over this many radians from each end
  tipRound: 0.14, // radians at each end over which the point's corner is rounded
  clear: 0.0025, // how far the fall lies off what's under it
  thickness: 0.0016,
  foldThin: 0.3, // thinner where it folds over the top of the stand, or the inside shows through the sharp bend
  closedGap: 0.0005, // a done-up collar's ends meet over the placket, this far either side of her middle
  smoothing: 3, // passes evening out the fall after it's laid on what's under it, so no fold flips over
  edgeShade: 0.9, // the fall's outer edge, a shade darker
  underShade: 0.72, // its underside
  columns: 72,
};

/**
 * Builds the collar. `shirt` is the garment polo's shell (its neck edge is the points tagged 'neck'), `vee` its open neck if
 * any, `placketWidth` how wide the placket is (a done-up collar's ends are at its edges), `over` the meshes it may lie on (the
 * shirt, the jumper). `placketWidth` is unused while a done-up collar closes over the placket. Returns { verts, tris, shade }, verts carrying bind, rest, weights and skin like the shirt's.
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
  // Its ends: done up, they meet over the placket; open, they're at the top corners of the V.
  const reach = vee ? vee.halfWidth(vee.top) : p.closedGap;
  let start = null;
  let end = null;
  for (let a = 0; a < Math.PI && start === null; a += 0.005) if (at(a).rest[0] - x0 >= reach) start = a;
  for (let a = TAU; a > Math.PI && end === null; a -= 0.005) if (at(a).rest[0] - x0 <= -reach) end = a;
  if (start === null || end === null) return null;

  // What the fall can lie on, near her neck.
  const near = (v) => Math.hypot(v.rest[0] - x0, v.rest[1] - neck[1], v.rest[2] - z0) < 0.22;
  const ground = { verts: [], tris: [] };
  for (const m of over) {
    const base = ground.verts.length;
    ground.verts.push(...m.verts);
    for (const t of m.tris) if (t.some((i) => near(m.verts[i]))) ground.tris.push(t.map((i) => i + base));
  }

  const U = [0, 1, 0];
  const rowsT = [0.12, 0.3, 0.5, 0.7, 0.86, 1];
  const grid = []; // [column][row] = vertex
  for (let c = 0; c <= p.columns; c++) {
    const theta = start + ((end - start) * c) / p.columns;
    const B = at(theta);
    const O = [Math.sin(theta), 0, Math.cos(theta)];
    const fromEnd = Math.min(theta - start, end - theta);
    const k = smooth01(1 - fromEnd / p.pointReach); // 1 at the ends, where the points are
    const h = p.stand + (p.standFront - p.stand) * k;
    const base = B.rest;
    const T = add(add(base, scale(U, h)), scale(O, -p.lean));
    const column = [
      add(add(base, scale(U, -0.003)), scale(O, 0.0005)),
      add(add(base, scale(U, h * 0.5)), scale(O, -p.lean * 0.5)),
      T,
    ].map((rest) => ({ ...B, rest }));
    // The fall: out over the fold and down, turned towards her front at the points.
    const dir = norm(add(O, scale([0, 0, 1], k * p.pointForward)));
    const fold = add(add(T, scale(O, p.roll)), scale(U, 0.003));
    const far = add(add(T, scale(dir, p.out + p.pointOut * k)), scale(U, -(h + p.drop + p.pointDrop * k)));
    const bez = (t) => add(add(scale(T, (1 - t) * (1 - t)), scale(fold, 2 * t * (1 - t))), scale(far, t * t));
    // Lifted on to what's under it, along a line from a point inside her chest below the neck.
    const centre = [x0, base[1] - 0.06, z0];
    rowsT.forEach((t, r) => {
      let q = bez(t);
      if (r === rowsT.length - 1 && fromEnd < p.tipRound) q = lerp(q, bez(0.8), 0.35 * (1 - fromEnd / p.tipRound) ** 2);
      const D = norm(sub(q, centre));
      const hit = rayHit(ground, add(q, scale(D, 0.12)), scale(D, -1));
      let under = null;
      if (hit) {
        under = inTriangle(ground, hit.tri, hit.bary);
        const surface = dot(sub(under.rest, centre), D);
        const mine = dot(sub(q, centre), D);
        if (mine < surface + p.clear) q = add(q, scale(D, surface + p.clear - mine));
      }
      // Its skin blends from the neck edge's to that of what it lies on, so it moves with her shoulders.
      const s = under ? smooth01(t) : 0;
      const floor = under ? dot(sub(under.rest, centre), D) + p.clear : -Infinity;
      column.push({ ...B, rest: q, weights: under ? blendWeights(B.weights, under.weights, s) : B.weights, skin: under ? lerp(B.skin, under.skin, s) : B.skin, lay: { centre, D, floor } });
    });
    grid.push(column);
  }

  // Even the fall out (each point towards the middle of its neighbours, along and across), then lift anything that went under
  // what it lies on back out: laid point by point, neighbours lifted by different amounts could fold a triangle over.
  for (let pass = 0; pass < p.smoothing; pass++) {
    const next = grid.map((col) => col.map((v) => v.rest));
    for (let c = 1; c < grid.length - 1; c++) {
      for (let r = 4; r < grid[c].length - 1; r++) {
        const n = [grid[c - 1][r], grid[c + 1][r], grid[c][r - 1], grid[c][r + 1]].map((v) => v.rest);
        next[c][r] = lerp(grid[c][r].rest, scale(n.reduce((a, b) => add(a, b)), 0.25), 0.5);
      }
    }
    grid.forEach((col, c) =>
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

  // A slab: the outside, an inside the thickness in, and the edges closed.
  const C = grid.length;
  const R = grid[0].length;
  const normal = (c, r) => {
    const dc = sub(grid[Math.min(C - 1, c + 1)][r].rest, grid[Math.max(0, c - 1)][r].rest);
    const dr = sub(grid[c][Math.min(R - 1, r + 1)].rest, grid[c][Math.max(0, r - 1)].rest);
    let n = norm(cross(dc, dr));
    const theta = start + ((end - start) * c) / p.columns;
    if (dot(n, add([Math.sin(theta), 0, Math.cos(theta)], scale(U, 0.3))) < 0) n = scale(n, -1);
    return n;
  };
  const verts = [];
  const shade = [];
  const put = (v, rest, k) => {
    verts.push({ bind: unskin(v.skin, rest), rest, weights: v.weights, skin: v.skin, normal: [0, 1, 0] });
    shade.push(k);
    return verts.length - 1;
  };
  const top = grid.map((col, c) => col.map((v, r) => put(v, v.rest, r === R - 1 ? p.edgeShade : 1)));
  const thin = (r) => (r >= 2 && r <= 4 ? p.foldThin : 1); // rows 2 to 4 are the fold
  const under = grid.map((col, c) => col.map((v, r) => put(v, sub(v.rest, scale(normal(c, r), p.thickness * thin(r))), p.underShade)));
  const tris = [];
  const quad = (a, b, c, d) => tris.push([a, b, c], [b, d, c]);
  for (let c = 0; c < C - 1; c++) {
    for (let r = 0; r < R - 1; r++) {
      quad(top[c][r], top[c + 1][r], top[c][r + 1], top[c + 1][r + 1]);
      quad(under[c + 1][r], under[c][r], under[c + 1][r + 1], under[c][r + 1]);
    }
    quad(top[c][R - 1], top[c + 1][R - 1], under[c][R - 1], under[c + 1][R - 1]); // the fall's outer edge
    quad(under[c][0], under[c + 1][0], top[c][0], top[c + 1][0]); // the stand's foot
  }
  for (let r = 0; r < R - 1; r++) {
    quad(under[0][r], under[0][r + 1], top[0][r], top[0][r + 1]); // the ends
    quad(top[C - 1][r], top[C - 1][r + 1], under[C - 1][r], under[C - 1][r + 1]);
  }
  for (const v of verts) v.rest = applySkin(v.skin, v.bind);
  return { verts, tris, shade };
}
