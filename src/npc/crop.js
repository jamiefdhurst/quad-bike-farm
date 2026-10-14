// Jess's string crop-top, for a very warm day: a narrow band round her bust, thinner still round her back like a bra's, held up by
// two string straps over her shoulders. Both are laid on her by rays (garmentMesh.js) rather than cut from her body like the polo,
// since they're far narrower than her triangles. Pure, on plain data. Everything else on
// her top half is bare (outfit.js paints the body's shirt band her skin colour under it).

import { smoothNormals, unskin, applySkinDir, rayHit, inTriangle, vec } from './garmentMesh.js';

const { add, scale, norm } = vec;

export const CROP = {
  ease: 0.005, // how far it stands off her
  top: 0.04, // at her front, its top edge this far above the fullest part of her bust
  under: 0.055, // and its bottom edge this far below it
  backTop: -0.022, // round her back, a narrow band: its top this far above her bust's height (below it)
  backUnder: 0.04, // and its bottom
  strapAcross: 0.07, // the straps this far either side of her middle, front and back, over her shoulders
  strapWidth: 0.0025, // half the width of a strap: a string
  strapLift: 0.0035, // how far it lies off her skin
};

/** The fullest part of her bust as she stands: the furthest-forward point of her chest ({ y, z }), or null. */
export function bustOf(body) {
  const { bones, boneNames } = body;
  const neck = bones.Neck;
  const torso = (v) => v.weights.reduce((s, [b, w]) => s + (/Spine|Hips/.test(boneNames[b]) ? w : 0), 0);
  let best = null;
  for (const v of body.verts) {
    const r = v.rest;
    if (torso(v) < 0.6 || r[2] <= neck[2] || r[1] > neck[1] - 0.06 || r[1] < neck[1] - 0.35 || Math.abs(r[0] - neck[0]) > 0.14) continue;
    if (!best || r[2] > best.z) best = { y: r[1], z: r[2] };
  }
  return best;
}

/** The line the band is cut along, as a field (below 0 inside), and the height of its top edge round her (`top(rest)`). */
export function cropFields(body, p = CROP) {
  const neck = body.bones.Neck;
  const bust = bustOf(body);
  if (!bust) return null;
  const F = {};
  const front = (r) => {
    const dx = r[0] - (F.cx ?? neck[0]);
    const dz = r[2] - (F.cz ?? neck[2]);
    const rad = Math.hypot(dx, dz);
    return rad > 1e-6 ? (dz / rad + 1) / 2 : 0.5; // 1 at her front, 0 at her back
  };
  const top = (r) => bust.y + p.backTop + (p.top - p.backTop) * front(r);
  const under = (r) => bust.y - p.backUnder - (p.under - p.backUnder) * front(r);
  const band = (v) => Math.max(v.rest[1] - top(v.rest), under(v.rest) - v.rest[1]);
  return Object.assign(F, { bust, band, top, under, field: band });
}

/** Builds it: { shell, shade } like the polo's, or null if her body has no bust to measure from. */
export function buildCropTop(body, p = CROP) {
  const F = cropFields(body, p);
  if (!F) return null;
  const all = [];
  const tris = [];
  const shade = [];
  const put = (piece, k = 1) => {
    const base = all.length;
    for (const v of piece.verts) {
      all.push(v);
      shade.push(k);
    }
    for (const t of piece.tris) tris.push(t.map((i) => i + base));
  };
  const torso = skinAround(body, F, 'any');
  middleOf(body, F, p, torso);
  put(buildBand(body, F, p, torso));
  // The straps, from the band's top at her front, over each shoulder, to its top at her back.
  for (const strap of buildStraps(body, F, p, skinAround(body, F, 'all'))) put(strap);
  const shell = { verts: all, tris };
  shell.normals = smoothNormals(shell);
  return { shell, shade, bust: F.bust };
}

/**
 * Her skin round her chest and shoulders, for rays: not her hair or head (a bob hangs down to her shoulders), nor her arms. The
 * band leaves out any triangle her arm has a corner in (`arms: 'any'`), so its rings don't reach out round her upper arms; the
 * straps keep those where her side joins her arm (`'all'`: only triangles wholly her arm's), or a ray slips through the gap.
 */
function skinAround(body, F, arms = 'any') {
  const { verts, index, boneNames, paint } = body;
  const neck = body.bones.Neck;
  const dominant = (v) => boneNames[v.weights.reduce((a, b) => (b[1] > a[1] ? b : a))[0]] ?? '';
  const tris = [];
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (tri.some((i) => paint(i) === 'hair' || /Head/.test(dominant(verts[i])))) continue;
    const limb = (i) => /Arm|Hand|Leg|Foot|Toe/.test(dominant(verts[i]));
    if (arms === 'any' ? tri.some(limb) : tri.every(limb)) continue;
    if (tri.every((i) => verts[i].rest[1] < F.bust.y - 0.12 || verts[i].rest[1] > neck[1] + 0.1)) continue;
    tris.push(tri);
  }
  return { verts, tris };
}

/**
 * The middle of her torso at the band's height, halfway between her front and her back down her middle (F.cx, F.cz): the band's
 * height round her is measured about it, so the band and the straps agree on where its top is.
 */
function middleOf(body, F, p, ground) {
  const neck = body.bones.Neck;
  const cx = neck[0];
  const y0 = F.bust.y - p.backUnder;
  const front = rayHit(ground, [cx, y0, neck[2] + 0.6], [0, 0, -1]);
  const back = rayHit(ground, [cx, y0, neck[2] - 0.6], [0, 0, 1]);
  F.cx = cx;
  F.cz = front && back ? (neck[2] + 0.6 - front.t + (neck[2] - 0.6 + back.t)) / 2 : neck[2];
}

/**
 * The band: rings of rays all round her torso find her skin at heights from its bottom edge to its top, wider at her front and a
 * narrow strap round her back. Each ring is then stretched over the hollows (down her spine, between her breasts) as elastic
 * would be, lifted `ease` off her, and each point skinned as her skin under it. Built this way its edges are exactly where they
 * should be, however coarse her body is.
 */
export function buildBand(body, F, p = CROP, ground = skinAround(body, F, 'any')) {
  const neck = body.bones.Neck;
  if (F.cz === undefined) middleOf(body, F, p, ground);
  const { cx, cz } = F;
  const COLS = 96;
  const ROWS = 8;
  const grid = [];
  for (let r = 0; r <= ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const a = (c / COLS) * Math.PI * 2; // 0 at her front, round to her left
      const d = [Math.sin(a), 0, Math.cos(a)];
      const at = [cx + d[0], 0, cz + d[2]];
      const top = F.top(at);
      const under = F.under(at);
      const y = under + ((top - under) * r) / ROWS;
      const hit = rayHit(ground, [cx + d[0] * 0.45, y, cz + d[2] * 0.45], [-d[0], 0, -d[2]]);
      const v = hit ? inTriangle(ground, hit.tri, hit.bary) : null;
      row.push({ d, y, v, rad: v ? Math.hypot(v.rest[0] - cx, v.rest[2] - cz) : null });
    }
    // Where a ray found nothing, the nearest point that did stands in.
    for (let c = 0; c < COLS; c++) {
      if (row[c].v) continue;
      for (let k = 1; k < COLS / 2; k++) {
        const o = row[(c + k) % COLS].v ? row[(c + k) % COLS] : row[(c - k + COLS) % COLS].v ? row[(c - k + COLS) % COLS] : null;
        if (o) {
          row[c].v = o.v;
          row[c].rad = o.rad;
          break;
        }
      }
    }
    // Stretched over the hollows as elastic is: out to the ring's convex outline round her, so it bridges the groove down her
    // spine and the dip between her breasts but still hugs her ribs under her bust.
    const hull = convexHull(row.map((q) => [q.d[0] * q.rad, q.d[2] * q.rad]));
    for (const q of row) q.rad = Math.max(q.rad, hullReach(hull, q.d[0], q.d[2]));
    grid.push(row);
  }
  if (grid.some((row) => row.some((q) => !q.v))) return { verts: [], tris: [] };
  const verts = [];
  const tris = [];
  for (const row of grid) {
    for (const q of row) {
      const rest = [cx + q.d[0] * (q.rad + p.ease), q.y, cz + q.d[2] * (q.rad + p.ease)];
      verts.push({ ...q.v, rest, bind: unskin(q.v.skin, rest), normal: q.d, edge: 'band' });
    }
  }
  const at = (r, c) => r * COLS + (c % COLS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) tris.push([at(r, c), at(r, c + 1), at(r + 1, c)], [at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)]);
  }
  return { verts, tris };
}

/** The convex hull of points in a plane, anticlockwise (Andrew's monotone chain). */
export function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of pts) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of pts.slice().reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** How far from the origin, along the direction (dx, dz), a ray meets the edge of a hull round the origin (0 if it doesn't). */
export function hullReach(hull, dx, dz) {
  let best = 0;
  for (let i = 0; i < hull.length; i++) {
    const [ax, az] = hull[i];
    const [bx, bz] = hull[(i + 1) % hull.length];
    const ex = bx - ax;
    const ez = bz - az;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ez - az * ex) / den; // along the ray
    const u = (ax * dz - az * dx) / den; // along the edge
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t);
  }
  return best;
}

/**
 * The two string straps: for each, rays from all round a line running front to back through her shoulder, `strapAcross` from
 * her middle, find her skin from the band's top at her front, over the shoulder, down to the band's top at her back. The path is
 * evened out, lifted `strapLift` off her, and made a ribbon `strapWidth` either side, each point skinned as her skin under it.
 */
export function buildStraps(body, F, p = CROP, ground = skinAround(body, F, 'all')) {
  const neck = body.bones.Neck;
  const out = [];
  for (const side of [-1, 1]) {
    const x = neck[0] + side * p.strapAcross;
    const centre = [x, neck[1] - 0.08, neck[2]];
    const path = [];
    for (let a = -1.2; a <= Math.PI + 1.2; a += 0.04) {
      const d = [0, Math.sin(a), Math.cos(a)];
      const hit = rayHit(ground, add(centre, scale(d, 0.35)), scale(d, -1));
      if (!hit) continue;
      const v = inTriangle(ground, hit.tri, hit.bary);
      // Only skin on the side of her the ray came from: a low ray at her front can slip under her bust, where none of her skin is
      // kept, and hit the inside of her back.
      const back = norm([0, v.rest[1] - centre[1], v.rest[2] - centre[2]]);
      if (back[1] * d[1] + back[2] * d[2] < 0.7) continue;
      if (v.rest[1] < F.top(v.rest) - 0.006) continue; // below the band's top: the band is there
      path.push({ v, d });
    }
    if (path.length < 4) continue;
    // Evened out along the path (her shoulder's faces are few and large), then lifted off her.
    const rest = path.map(({ v }) => v.rest);
    const reach = (q) => Math.hypot(q[1] - centre[1], q[2] - centre[2]);
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 1; i < rest.length - 1; i++) rest[i] = scale(add(add(rest[i - 1], rest[i + 1]), scale(rest[i], 2)), 0.25);
      // Evening out cuts the corner over the curve of her bust and shoulder: never in further than her skin is where it now lies.
      rest.forEach((q, i) => {
        const dir = norm([0, q[1] - centre[1], q[2] - centre[2]]);
        const hit = rayHit(ground, add([x, centre[1], centre[2]], scale(dir, 0.35)), scale(dir, -1));
        if (!hit) return;
        const want = 0.35 - hit.t;
        const has = reach(q);
        if (has < want) rest[i] = [q[0], centre[1] + dir[1] * want, centre[2] + dir[2] * want];
      });
    }
    const ribbon = { verts: [], tris: [] };
    path.forEach(({ v, d }, i) => {
      // Lifted along the way her skin faces there (on the slope of her bust, a line from the middle would run along it, not off it).
      const facing = norm(applySkinDir(v.skin, v.normal));
      const at = add(rest[i], scale(facing, p.strapLift));
      for (const w of [-p.strapWidth, p.strapWidth]) {
        const r = [at[0] + w, at[1], at[2]];
        ribbon.verts.push({ ...v, rest: r, bind: unskin(v.skin, r), normal: norm(d), edge: 'strap' });
      }
      if (i > 0) {
        const k = ribbon.verts.length - 4;
        ribbon.tris.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
      }
    });
    out.push(ribbon);
  }
  return out;
}
