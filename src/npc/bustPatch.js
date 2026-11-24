// The written bust (bustShape.js) put on her split body (#1143): her chest's triangles round each breast taken out and replaced by
// rings drawn on it, joined into her chest by a collar that uses her own points round the hole, so nothing cracks. Moving her own
// points on to it instead was tried beside it and dropped: she has too few there, and it faceted and folded where her arm held them.
// First the model's own small bust is eased back to her chest wall round the outline (`flatten`), so no ledge of it is left.
// Everything is in figure.js's body frame (x her left, y up, z her front, one unit hips to neck). Pure apart from three's ear clipping.

import { ShapeUtils, Vector2 } from 'three';
import { BUST_SHAPE, bustOutline, bustPoint, bustUV, chestWall } from './bustShape.js';

export const BUST_PATCH = {
  margin: 1.1, // the hole is cut this many of the outline's half-widths round it: her triangles are long at her sides, and an edge
  // of one, straight in her body, bowed in across the rim once the collar is laid out round her
  band: 1.6, // round the outline, out to this many of its half-widths, her front is eased back to her chest wall: all the way out to
  bandFull: 1.2, // this many, past the hole's edge, so the collar lies on the wall (half way, her ribs under Jess's fold folded it under)
  // The model's own small bust stands up to 3 cm proud of her chest wall from y 0.55 to 0.9, above the outline as well as in it: all
  // of it is eased back, or its top is left as a lip over the new bust's upper slope.
  own: { x: 0.34, fullX: 0.2, from: 0.5, fullFrom: 0.56, to: 0.95, fullTo: 0.85 },
  front: 0.06, // only points further forward than this are hers to move (her back has the same x and y)
  smoothTo: 1.4, // her chest round the bust is shaded smoothly, like the bust, out to this many of the outline's half-widths, and
  smoothOut: 2.1, // fades back to her flat facets by this many, so the bust doesn't stand out from her chest by its shading
  rings: 14, // rings from the middle out
  around: 48, // points round each ring
};

// The covered body her tops are cut from (`coverBust`): one sheet over her bust, bridged across her cleavage and carried round under
// each breast to her ribs rather than in under it, never inside her (#1143).
export const BUST_SHEET = {
  cell: 0.004, // its grid this fine in height (body-frame units, about 1.7 mm)
  curve: 30, // under each breast it carries on round under her lower curve, turning in by this much slope per unit down, until it
  // meets her ribs (a fixed fall of 2.4, 67 degrees, made a skirt that stuck out before going in to her waist; 6 dropped straight off)
  sag: 0.07, // and sags this much (body-frame units, about 3 cm) at her middle, so each breast stays round under the cloth
  fadeIn: 0.1, // the bridge eases in over this much below where it starts, so there is no ledge there
  blur: 14, // passes smoothing the sheet where it was raised, so the bridge leaves her chest gently at the top of her cleavage
  // (at 3 its slope jumped there and the cloth creased across her)
  behind: 0.45, // drawn round a line this far behind her front's middle: further forward (0.15), the outward bulge of each breast's
  // lower outer side was hidden behind its front and the sheet cut inside it
  angle: 0.56, // radians either side of her front (32 degrees: wider, its top corners reached into her armpits and its collar
  // folded round her sides)
  step: 0.006, // its grid this fine in angle
  low: 0.28, // from this height (her waist, below where it falls back to her)
  regionTop: 1.05, // to this share of the way from her bust's middle up to where its upper slope starts: up under her collarbone,
  // where she is nearly flat, so its join doesn't step (lower, on her upper slope, the cloth showed a cut there)
  smoothOut: 0.06, // her shading smooth round it, fading back to her facets over this far past its edge
  rim: 0.85, // its rings' rim this share of the way to its edge, inside the hole
  rings: 24, // its rings from the middle out
  around: 96, // points round each ring
};

// The collar round the hole is laid out flat as an angle round her (about a line behind her chest) and a height, not as she's seen
// from the front: round her sides her chest turns away, and seen from the front the hole's edge folded over itself there.
const AROUND = { behind: 0.15, radius: 0.35 };
const unroll = (x, y, z) => ({ x: Math.atan2(x, z + AROUND.behind) * AROUND.radius, y });

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How far a front point round the outline is eased back to her chest wall: 1 at the outline, 0 at `band`. */
function flatten(x, y, z, o, s, p) {
  if (z < p.front) return z;
  const { r2 } = bustUV(x, y, o);
  const m = p.own;
  const own = (1 - smoothstep(m.fullX, m.x, Math.abs(x))) * smoothstep(m.from, m.fullFrom, y) * (1 - smoothstep(m.fullTo, m.to, y));
  const w = Math.max(own, 1 - smoothstep(p.bandFull, p.band, Math.sqrt(r2)));
  if (w <= 0) return z;
  const wall = chestWall(Math.abs(x), y, s);
  return z - w * Math.max(0, z - wall);
}

const key = (a, i) => `${Math.round(a[i * 3] * 1e4)},${Math.round(a[i * 3 + 1] * 1e4)},${Math.round(a[i * 3 + 2] * 1e4)}`;

/** Whether a triangle (three body-frame corners) touches either breast's outline, at a corner or anywhere along an edge. */
function touches(c, o, p) {
  if (c.some((q) => q[2] < p.front)) return false;
  for (let e = 0; e < 3; e++) {
    const a = c[e], b = c[(e + 1) % 3];
    // Sampled along the edge, so an edge across an outline counts (bustUV mirrors her right on to her left).
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      if (bustUV(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, o).r2 < p.margin ** 2) return true;
    }
  }
  const m = [0, 1].map((j) => (c[0][j] + c[1][j] + c[2][j]) / 3);
  return bustUV(m[0], m[1], o).r2 < p.margin ** 2;
}

/**
 * A collar between a loop and one rim inside it, both running once round `middle` (laid out): each stepped round by its angle about
 * the middle, every point joined to its neighbours across the gap, so no piece reaches far along it (ear clipping a long thin gap
 * made slivers half her height). Faces as index triples into [...loop, ...rim], as triangulateShape gives them.
 */
function zipped(loop, rim, middle) {
  const angle = (q) => Math.atan2(q.y - middle.y, q.x - middle.x);
  const unwrap = (pts) => {
    // Both in the same turning direction, from the point nearest straight below the middle, angles counted on round.
    const signed = pts.reduce((s, q, k) => s + (pts[(k + 1) % pts.length].x - q.x) * (pts[(k + 1) % pts.length].y + q.y), 0);
    const order = pts.map((_, k) => k);
    if (signed > 0) order.reverse(); // anticlockwise
    let start = 0;
    order.forEach((k, n) => Math.abs(angle(pts[k]) + Math.PI / 2) < Math.abs(angle(pts[order[start]]) + Math.PI / 2) && (start = n));
    const seq = [...order.slice(start), ...order.slice(0, start)];
    let last = angle(pts[seq[0]]);
    let turned = 0;
    return seq.map((k) => {
      let a = angle(pts[k]);
      while (a < last - Math.PI) a += 2 * Math.PI;
      while (a > last + Math.PI) a -= 2 * Math.PI;
      last = a;
      turned = a;
      return { k, a: turned };
    });
  };
  const L = unwrap(loop), R = unwrap(rim);
  const base = L[0].a - R[0].a;
  R.forEach((q) => (q.a += Math.round(base / (2 * Math.PI)) * 2 * Math.PI));
  const faces = [];
  let i = 0, j = 0;
  const n = loop.length;
  while (i < L.length || j < R.length) {
    const li = L[i % L.length], ln = L[(i + 1) % L.length];
    const rj = R[j % R.length], rn = R[(j + 1) % R.length];
    const nextL = i < L.length ? L[i].a + (i + 1 < L.length ? ln.a - li.a : 2 * Math.PI + L[0].a - li.a) : Infinity;
    const nextR = j < R.length ? R[j].a + (j + 1 < R.length ? rn.a - rj.a : 2 * Math.PI + R[0].a - rj.a) : Infinity;
    if (nextL <= nextR) {
      faces.push([li.k, ln.k, n + rj.k]);
      i++;
    } else {
      faces.push([li.k, n + rn.k, n + rj.k]);
      j++;
    }
  }
  return faces;
}

/**
 * Fills holes in a mesh. `mesh`: { positions, uvs, skinIndex, skinWeight } (body frame), three corners a triangle; `taken` (one a
 * triangle, changed) marks the triangles to replace; `place(i)` is where kept corner i goes; `smoothOf(i)` its shading's smoothness;
 * `armBone(b)` whether bone b is her arm's. `patches(nearest)` makes the new surfaces: [{ grid, side, middle }], each `grid` rings of
 * points from the middle out ({ pos, round (laid out), near, arm }, ring 0 one point), `side` 1 if anticlockwise laid out faces out
 * or -1, and `middle` a laid-out point inside it; `nearest(x, y, z)` is the taken corner nearest a point, for its paint and skin.
 * Each loop round the holes is joined to the rims inside it by a collar ear-clipped as laid out round her. Returns the new arrays
 * (and `index`, `smooth`), or null if a hole can't be traced or filled. `fixed(i)`: corner i is never taken (her arm's).
 */
function fillHoles(mesh, taken, { place, smoothOf, armBone, patches, front, fixed = () => false, zip = false }) {
  const { positions, uvs, skinIndex, skinWeight } = mesh;
  const tris = positions.length / 9;
  const corner = (i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  // Welded points, so a hole's edge is found where the kept and the taken triangles share it.
  const ids = new Map();
  const weld = new Int32Array(positions.length / 3);
  for (let i = 0; i < weld.length; i++) {
    const k = key(positions, i);
    if (!ids.has(k)) ids.set(k, ids.size);
    weld[i] = ids.get(k);
  }
  // The hole's edges, traced into loops: each edge of a taken triangle that a kept one shares, run the way the taken one runs it.
  const trace = () => {
    const edgeOf = new Set(); // "a,b" for each edge a kept triangle runs a to b
    for (let t = 0; t < tris; t++) {
      if (taken[t]) continue;
      for (let e = 0; e < 3; e++) edgeOf.add(`${weld[t * 3 + e]},${weld[t * 3 + ((e + 1) % 3)]}`);
    }
    const next = new Map(); // welded point -> the next round the hole
    const at = new Map(); // welded point -> one of its corners (for its paint and skin)
    for (let t = 0; t < tris; t++) {
      if (!taken[t]) continue;
      for (let e = 0; e < 3; e++) {
        const a = weld[t * 3 + e], b = weld[t * 3 + ((e + 1) % 3)];
        if (!edgeOf.has(`${b},${a}`)) continue;
        if (next.has(a)) return { pinch: a }; // the hole touches itself at a point: not a simple loop
        next.set(a, b);
        at.set(a, t * 3 + e);
        at.set(b, t * 3 + ((e + 1) % 3));
      }
    }
    const loops = [];
    const seen = new Set();
    for (const start of next.keys()) {
      if (seen.has(start)) continue;
      const loop = [];
      let q = start;
      while (!seen.has(q)) {
        seen.add(q);
        loop.push(q);
        q = next.get(q);
        if (q === undefined) return null;
      }
      if (q !== start) return null;
      loops.push(loop.map((w) => ({ ...unroll(...place(at.get(w))), w })));
    }
    return loops.length ? { loops, at } : null;
  };
  const inside = (pt, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  // The patches' middles, laid out, before they are drawn (they depend only on where the holes are meant to be).
  const middles = patches(null).map((q) => q.middle);
  // A loop with no patch inside it goes round an island of her left between the holes (a bigger bust's two holes meet above and
  // below it): the island is taken too, and the hole traced again.
  let hole = null;
  for (let pass = 0; pass < 12; pass++) {
    hole = trace();
    if (!hole) return null;
    if (hole.pinch !== undefined) {
      // Where the hole touches itself at a point, her triangles round the point are taken too (or, where they can't be, those
      // taken round it given back), and the hole traced again.
      const round = [];
      for (let t = 0; t < tris; t++) if ([0, 1, 2].some((j) => weld[t * 3 + j] === hole.pinch)) round.push(t);
      const can = round.filter((t) => !taken[t] && [0, 1, 2].every((j) => positions[(t * 3 + j) * 3 + 2] > front && !fixed(t * 3 + j)));
      if (can.length) for (const t of can) taken[t] = 1;
      else for (const t of round) taken[t] = 0;
      hole = null;
      continue;
    }
    const islands = hole.loops.filter((loop) => !middles.some((m) => inside(m, loop)));
    if (!islands.length) break;
    for (let t = 0; t < tris; t++) {
      if (taken[t]) continue;
      const m = [0, 1, 2].map((j) => (positions[t * 9 + j] + positions[t * 9 + 3 + j] + positions[t * 9 + 6 + j]) / 3);
      if (m[2] > front && islands.some((loop) => inside(unroll(...m), loop))) taken[t] = 1;
    }
    hole = null;
  }
  if (!hole) return null;
  const { loops, at } = hole;

  // The new mesh: every kept triangle, then each patch's rings, then the collars.
  const P = [], U = [], SI = [], SW = [], SM = [], SRC = [];
  const push = (pos, uvAt, skinAt, arm = 1, smooth = 1, from = -1) => {
    P.push(...pos);
    SM.push(smooth);
    SRC.push(from);
    U.push(uvs[uvAt * 2], uvs[uvAt * 2 + 1]);
    const w = [0, 1, 2, 3].map((j) => skinWeight[skinAt * 4 + j] * (armBone(skinIndex[skinAt * 4 + j]) ? arm : 1));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    for (let j = 0; j < 4; j++) SI.push(skinIndex[skinAt * 4 + j]), SW.push(w[j] / sum);
  };
  for (let t = 0; t < tris; t++) {
    if (taken[t]) continue;
    for (let j = 0; j < 3; j++) push(place(t * 3 + j), t * 3 + j, t * 3 + j, 1, smoothOf(t * 3 + j), t * 3 + j);
  }
  // The paint and skin of a new point: the nearest corner of a taken triangle.
  const takenCorners = [];
  for (let t = 0; t < tris; t++) if (taken[t]) for (let j = 0; j < 3; j++) takenCorners.push(t * 3 + j);
  const nearest = (x, y, z) => {
    let best = takenCorners[0], d = Infinity;
    for (const i of takenCorners) {
      const e = (positions[i * 3] - x) ** 2 + (positions[i * 3 + 1] - y) ** 2 + (z === undefined ? 0 : (positions[i * 3 + 2] - z) ** 2);
      if (e < d) (d = e), (best = i);
    }
    return best;
  };
  const drawn = patches(nearest, loops, at);
  for (const { grid, side } of drawn) {
    // Wound so it faces out: anticlockwise round the rings is anticlockwise as she's seen from the front for side 1. A point of
    // the loop round the hole (`w`, where a patch's last ring is the loop itself) is her own corner there.
    const tri = (a, b, c) => {
      for (const q of side > 0 ? [a, b, c] : [a, c, b]) {
        if (q.w !== undefined) {
          const k = at.get(q.w);
          push(place(k), k, k, 1, 1, k);
        } else push(q.pos, q.near, q.near, q.arm, 1, -2 - q.near);
      }
    };
    const n = grid[1].length;
    for (let a = 0; a < n; a++) tri(grid[0][0], grid[1][a], grid[1][(a + 1) % n]);
    for (let j = 1; j < grid.length - 1; j++) {
      for (let a = 0; a < n; a++) {
        const b = (a + 1) % n;
        tri(grid[j][a], grid[j + 1][a], grid[j + 1][b]);
        tri(grid[j][a], grid[j + 1][b], grid[j][b]);
      }
    }
  }
  // A patch whose last ring is a loop round the hole needs no collar; the others are joined to their loops by one.
  const filled = new Set(drawn.filter((q) => q.loop).map((q) => q.loop));
  const rims = drawn.filter((q) => !q.loop).map(({ grid }) => grid[grid.length - 1]);
  const rimMiddles = drawn.filter((q) => !q.loop).map((q) => q.middle);

  // The collars: between each loop round the hole and the rims inside it, ear-clipped as laid out round her. The rims are on her
  // and the loop's points where she is, so the collar lies against her and its shape doesn't show.
  const around = new Map(); // a point round the hole -> the next one, as the taken triangles ran their edges
  for (const loop of loops) loop.forEach((q, k) => around.set(q.w, loop[(k + 1) % loop.length].w));
  const used = new Set();
  for (const loop of loops) {
    if (filled.has(loop)) continue;
    const holes = rims.filter((rim, k) => !used.has(k) && inside(rimMiddles[k], loop));
    if (!holes.length) return null;
    rims.forEach((rim, k) => holes.includes(rim) && used.add(k));
    const holePts = holes.map((rim) => rim.map((q) => ({ ...q.round, q })));
    const all = [...loop, ...holePts.flat()];
    const faces = zip && holes.length === 1
      ? zipped(loop, holePts[0], rimMiddles[rims.indexOf(holes[0])])
      : ShapeUtils.triangulateShape(
          loop.map((q) => new Vector2(q.x, q.y)),
          holePts.map((h) => h.map((q) => new Vector2(q.x, q.y))),
        );
    for (const f of faces) {
      const pts = f.map((i) => all[i]);
      // Wound as her body beside it runs: an edge it shares with a kept triangle runs the other way in that triangle, as round the
      // hole, so the surface stays one way out. With no such edge, anticlockwise laid out. (By laid-out area alone, a sliver of
      // three points along the hole's edge, nearly in a line laid out, came out either way.)
      let order = 0;
      for (let k = 0; k < 3 && !order; k++) {
        const a = pts[k].w, b = pts[(k + 1) % 3].w;
        if (a === undefined || b === undefined) continue;
        if (around.get(a) === b) order = 1;
        else if (around.get(b) === a) order = -1;
      }
      if (!order) {
        const area = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[2].x - pts[0].x) * (pts[1].y - pts[0].y);
        order = area < 0 ? -1 : 1;
      }
      if (order < 0) pts.reverse();
      for (const q of pts) {
        if (q.w !== undefined) {
          const k = at.get(q.w);
          push(place(k), k, k, 1, 1, k);
        } else push(q.q.pos, q.q.near, q.q.near, q.q.arm, 1, -2 - q.q.near);
      }
    }
  }
  if (used.size !== rims.length) return null;
  const count = P.length / 3;
  return {
    positions: Float32Array.from(P),
    uvs: Float32Array.from(U),
    skinIndex: Uint16Array.from(SI),
    skinWeight: Float32Array.from(SW),
    index: Array.from({ length: count }, (_, i) => i),
    smooth: Float32Array.from(SM), // per corner, 0 to 1: how far its shading is smooth rather than her flat facets
    source: Int32Array.from(SRC), // per corner, the corner of `mesh` it is (k), or for a new one -2 - the nearest (for her paint later)
  };
}

/**
 * Her chest round each breast replaced with rings drawn on the bust. `mesh`: { positions (body frame), uvs, skinIndex,
 * skinWeight }, three corners a triangle as splitBody gives them; `keep(i)`, 0 to 1, how much corner i is held still (her
 * arm's points, over a half, stay as they are); `armBone(b)` whether bone b is her arm's, whose pull is eased off the rings
 * inside the edge so the breast moves with her chest, not her arm. Returns new arrays of the same kinds (and `index`, `smooth`),
 * or null if the hole round the bust can't be traced (the caller keeps her as she was).
 */
export function patchBust(mesh, size = 1, keep = () => 0, armBone = () => false, s = BUST_SHAPE, p = BUST_PATCH) {
  const { positions } = mesh;
  const o = bustOutline(size, s);
  const tris = positions.length / 9;
  const corner = (i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const taken = new Uint8Array(tris);
  for (let t = 0; t < tris; t++) {
    const c = [0, 1, 2].map((j) => corner(t * 3 + j));
    if (c.some((_, j) => keep(t * 3 + j) > 0.5)) continue;
    if (touches(c, o, p)) taken[t] = 1;
  }
  // A corner where it will be: eased back to her chest wall unless it's her arm's.
  const place = (i) => {
    const [x, y, z] = corner(i);
    return [x, y, keep(i) > 0.5 ? z : flatten(x, y, z, o, s, p)];
  };
  const smoothOf = (i) => {
    const [x, y, z] = corner(i);
    return z < p.front ? 0 : 1 - smoothstep(p.smoothTo, p.smoothOut, Math.sqrt(bustUV(x, y, o).r2));
  };
  const patches = (nearest) =>
    [1, -1].map((side) => {
      const middle = unroll(side * o.cx, o.cy, chestWall(o.cx, o.cy, s));
      if (!nearest) return { middle };
      // Points on the oval: ring 0 is the middle, ring `rings` its edge. Spaced closer towards the edge, where it turns most.
      const grid = [];
      for (let j = 0; j <= p.rings; j++) {
        const r = Math.sin((Math.PI / 2) * (j / p.rings));
        const ring = [];
        const n = j === 0 ? 1 : p.around;
        for (let a = 0; a < n; a++) {
          const ang = (2 * Math.PI * a) / p.around;
          const q = bustPoint(r * Math.cos(ang), r * Math.sin(ang), size, s, o);
          const near = nearest(side * q.xBase, q.yBase);
          ring.push({ pos: [side * q.x, q.y, q.z], round: unroll(side * q.x, q.y, q.z), near, arm: j === p.rings ? 1 : smoothstep(0.6, 1, r) });
        }
        grid.push(ring);
      }
      // Anticlockwise in u, v is anticlockwise as she's seen from the front on her left, clockwise on her right.
      return { grid, side, middle };
    });
  return fillHoles(mesh, taken, { place, smoothOf, armBone, patches, front: p.front, fixed: (i) => keep(i) > 0.5 });
}

/**
 * Her body as her tops are cut from it (#1143): her front between `low` and `high`, `angle` either side of her middle, taken out and
 * drawn again round her: a grid in the angle round a line behind her chest (the one the collars are laid out round) and height,
 * each point as far out as her front there (so never the underside of a breast, hidden behind it), bridged straight across her
 * cleavage and falling from under each breast to her ribs rather than curling in under it. Drawn round her as the collar joining it
 * to her is laid out, the two agree, and none of it can turn over. `drawn`: patchBust's arrays (body frame); `size`, `armBone` as for
 * patchBust. Returns arrays of the same kinds (with `source`, each corner's own corner of `drawn`), or null if it can't be made.
 */
export function coverBust(drawn, size = 1, armBone = () => false, s = BUST_SHAPE, p = BUST_PATCH, c = BUST_SHEET) {
  const { positions, skinIndex, skinWeight } = drawn;
  const o = bustOutline(size, s);
  const tris = positions.length / 9;
  const P = (i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const keep = (i) => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (armBone(skinIndex[i * 4 + k])) w += skinWeight[i * 4 + k];
    return w;
  };
  // Round her: angle (0 her front, positive her left) and distance out from the line behind her chest.
  const behind = c.behind;
  const polar = ([x, y, z]) => [Math.atan2(x, z + behind), y, Math.hypot(x, z + behind)];
  const cart = (a, y, r) => [r * Math.sin(a), y, r * Math.cos(a) - behind];
  const a0 = -c.angle, a1 = c.angle;
  const half = () => c.angle;
  const yLo = c.low, yHi = o.cy + (s.top - o.cy) * c.regionTop;
  const na = Math.ceil((a1 - a0) / c.step) + 1, ny = Math.ceil((yHi - yLo) / c.cell) + 1;
  const da = (a1 - a0) / (na - 1), dy = (yHi - yLo) / (ny - 1);
  // Her front round her: the furthest out of her front triangles at each angle and height.
  const her = new Float32Array(na * ny).fill(-Infinity);
  for (let t = 0; t < tris; t++) {
    const cs = [0, 1, 2].map((j) => P(t * 3 + j));
    if (cs.some((q) => q[2] < p.front)) continue;
    const [A, B, D] = cs.map(polar);
    const det = (B[1] - D[1]) * (A[0] - D[0]) + (D[0] - B[0]) * (A[1] - D[1]);
    if (Math.abs(det) < 1e-14) continue;
    const i0 = Math.max(0, Math.floor((Math.min(A[0], B[0], D[0]) - a0) / da)), i1 = Math.min(na - 1, Math.ceil((Math.max(A[0], B[0], D[0]) - a0) / da));
    const j0 = Math.max(0, Math.floor((Math.min(A[1], B[1], D[1]) - yLo) / dy)), j1 = Math.min(ny - 1, Math.ceil((Math.max(A[1], B[1], D[1]) - yLo) / dy));
    for (let j = j0; j <= j1; j++) {
      const y = yLo + j * dy;
      for (let i = i0; i <= i1; i++) {
        const a = a0 + i * da;
        const l1 = ((B[1] - D[1]) * (a - D[0]) + (D[0] - B[0]) * (y - D[1])) / det;
        const l2 = ((D[1] - A[1]) * (a - D[0]) + (A[0] - D[0]) * (y - D[1])) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        her[j * na + i] = Math.max(her[j * na + i], l1 * A[2] + l2 * B[2] + l3 * D[2]);
      }
    }
  }
  // Fill any cell her triangles missed (round her sides, below the front) from its neighbours: it is drawn from all of them.
  for (let pass = 0; pass < 200 && her.some((v) => !Number.isFinite(v)); pass++) {
    for (let k = 0; k < her.length; k++) {
      if (Number.isFinite(her[k])) continue;
      const i = k % na, j = (k - i) / na;
      let sum = 0, n = 0;
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= na || jj >= ny) continue;
        const v = her[jj * na + ii];
        if (Number.isFinite(v)) (sum += v), n++;
      }
      if (n) her[k] = sum / n;
    }
  }
  if (her.some((v) => !Number.isFinite(v))) return null;
  const env = her.slice();
  // Across her cleavage: each row bridged straight (as seen from above) between her breasts' middles, sagging a little, easing in
  // below the top.
  const am = Math.atan2(o.cx, chestWall(o.cx, o.cy, s) + o.project * 0.6 + behind);
  const ib0 = Math.round((-am - a0) / da), ib1 = Math.round((am - a0) / da);
  for (let j = 0; j < ny; j++) {
    const y = yLo + j * dy;
    const fade = smoothstep(yHi - c.fadeIn * 0.3, yHi - c.fadeIn, y);
    const L = cart(a0 + ib0 * da, y, env[j * na + ib0]), R = cart(a0 + ib1 * da, y, env[j * na + ib1]);
    for (let i = ib0 + 1; i < ib1; i++) {
      const a = a0 + i * da;
      // Where the ray at this angle meets the line from L to R, less the sag.
      const t = (i - ib0) / (ib1 - ib0);
      const dx = R[0] - L[0], dz = R[2] - L[2];
      const den = Math.sin(a) * dz - Math.cos(a) * dx;
      if (Math.abs(den) < 1e-9) continue;
      const r = (L[0] * dz - (L[2] + behind) * dx) / den - c.sag * 4 * t * (1 - t);
      const k = j * na + i;
      if (r > env[k]) env[k] += (r - env[k]) * fade;
    }
  }
  // Under each breast: down each column from her fullest, falling back no faster than `fall`. Every column: where she has no breast
  // her front falls away slower than that and nothing is raised. (Tapered out towards a breast's outer edge, the sheet dropped
  // straight from her lower curve to her ribs there, cutting into her and standing out below.)
  for (let i = 0; i < na; i++) {
    let top = 0, best = -Infinity;
    for (let j = 0; j < ny; j++) if (yLo + j * dy > s.fold - 0.25 && env[j * na + i] > best) (best = env[j * na + i]), (top = j);
    // Going down, the sheet carries on at the slope it had and turns steadily further in (`curve`), so her lower curve carries on
    // round under itself until it meets her ribs: a fixed rate either stood out in a skirt or dropped straight off it.
    let slope = 0;
    for (let j = top - 1; j >= 0; j--) {
      const k = j * na + i, above = (j + 1) * na + i;
      const rounded = env[above] - slope * dy;
      if (rounded > env[k]) {
        env[k] = rounded;
        slope += c.curve * dy;
      } else slope = Math.max(0, (env[above] - env[k]) / dy);
    }
  }
  // Smoothed where it was raised, never inside her.
  for (let pass = 0; pass < c.blur; pass++) {
    const was = env.slice();
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < na - 1; i++) {
        const k = j * na + i;
        // Where raised, and anywhere between her breasts' middles, so the bridge rises gently from a little above her cleavage.
        if (!(was[k] > her[k] + 1e-6) && (i <= ib0 || i >= ib1)) continue;
        let sum = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += was[k + dj * na + di];
        env[k] = Math.max(her[k], sum / 9);
      }
    }
  }
  // Her triangles inside it are taken out: every one of her front's wholly inside it, but not her arms'. (With a corner inside, her
  // big triangles under her collarbone took the hole 4 cm past it, and the collar across that cut into her.)
  const inside = ([x, y, z]) => {
    const [a] = polar([x, y, z]);
    return z > p.front && y > yLo + dy && y < yHi - dy && Math.abs(a) < half(y) - da;
  };
  const taken = new Uint8Array(tris);
  for (let t = 0; t < tris; t++) {
    if ([0, 1, 2].some((j) => keep(t * 3 + j) > 0.5)) continue;
    if ([0, 1, 2].every((j) => inside(P(t * 3 + j)))) taken[t] = 1;
  }
  const at = (a, y) => {
    const fi = (a - a0) / da, fj = (y - yLo) / dy;
    const i = Math.max(0, Math.min(na - 2, Math.floor(fi))), j = Math.max(0, Math.min(ny - 2, Math.floor(fj)));
    const u = Math.min(1, Math.max(0, fi - i)), v = Math.min(1, Math.max(0, fj - j));
    return { her: (f) => f[j * na + i] * (1 - u) * (1 - v) + f[j * na + i + 1] * u * (1 - v) + f[(j + 1) * na + i] * (1 - u) * v + f[(j + 1) * na + i + 1] * u * v };
  };
  // The sheet as rings round its middle, out to a rim `rim` of the way to its edge, inside the hole (the collar runs from there out
  // to the hole's edge).
  const y0 = yLo + 2 * dy, y1 = yHi - 2 * dy;
  const mid = [0, (y0 + y1) / 2];
  const point = (a, y) => cart(a, y, at(a, y).her(env));
  const patches = (nearest) => {
    const middle = unroll(...point(mid[0], mid[1]));
    if (!nearest) return [{ middle }];
    const grid = [];
    for (let j = 0; j <= c.rings; j++) {
      const r = Math.sin((Math.PI / 2) * (j / c.rings)) * c.rim;
      const n = j === 0 ? 1 : c.around;
      const ring = [];
      for (let k = 0; k < n; k++) {
        const ang = (2 * Math.PI * k) / c.around;
        // A rounded square in angle and height, wide across her at every height.
        const cu = Math.cos(ang), sv = Math.sin(ang);
        const y = mid[1] + ((y1 - y0) / 2) * r * Math.sign(sv) * Math.abs(sv) ** 0.4;
        const a = (half(y) - 2 * da) * r * Math.sign(cu) * Math.abs(cu) ** 0.4;
        const q = point(a, y);
        ring.push({ pos: q, round: unroll(...q), near: nearest(...q), arm: 1 });
      }
      grid.push(ring);
    }
    // Anticlockwise in angle (her left positive) and height is anticlockwise as she's seen from the front.
    return [{ grid, side: 1, middle }];
  };
  // Her own corners keep her shading, smoothed too round the sheet, fading back to her facets: her tops are pushed out along it.
  const smoothOf = (i) => {
    const q = P(i);
    const [a, y] = polar(q);
    const out = Math.max(0, y - yHi, yLo - y, (Math.abs(a) - half(y)) * 0.35);
    return Math.max(drawn.smooth ? drawn.smooth[i] : 0, 1 - smoothstep(0, c.smoothOut, out));
  };
  return fillHoles(drawn, taken, { place: P, smoothOf, armBone, patches, front: p.front, fixed: (i) => keep(i) > 0.5, zip: true });
}

