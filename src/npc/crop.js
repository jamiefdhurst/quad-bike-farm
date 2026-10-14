// Jess's string crop-top, for a very warm day: a narrow band round her bust, thinner still round her back like a bra's, held up by
// two string straps over her shoulders. The band is cut from her own body like the polo (garmentMesh.js); the straps are thin
// ribbons laid over her shoulders by rays, since they're far narrower than her triangles. Pure, on plain data. Everything else on
// her top half is bare (outfit.js paints the body's shirt band her skin colour under it).

import { weld, subdivide, smoothSkinning, cut, openEdges, smoothNormals, applySkin, unskin, rayHit, inTriangle, vec } from './garmentMesh.js';

const { sub, add, scale, norm } = vec;

export const CROP = {
  ease: 0.004, // how far it stands off her
  round: 0.75,
  bare: /Arm|Hand|Leg|Foot|Toe/, // bones whose skin it never covers
  top: 0.04, // at her front, its top edge this far above the fullest part of her bust
  under: 0.055, // and its bottom edge this far below it
  backTop: -0.022, // round her back, a narrow band: its top this far above her bust's height (below it)
  backUnder: 0.04, // and its bottom
  strapAcross: 0.07, // the straps this far either side of her middle, front and back, over her shoulders
  strapWidth: 0.0022, // half the width of a strap: a string
  strapLift: 0.0025, // how far it lies off her skin
  insideShade: 0.55,
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
  const front = (r) => {
    const dx = r[0] - neck[0];
    const dz = r[2] - neck[2];
    const rad = Math.hypot(dx, dz);
    return rad > 1e-6 ? (dz / rad + 1) / 2 : 0.5; // 1 at her front, 0 at her back
  };
  const top = (r) => bust.y + p.backTop + (p.top - p.backTop) * front(r);
  const under = (r) => bust.y - p.backUnder - (p.under - p.backUnder) * front(r);
  const band = (v) => Math.max(v.rest[1] - top(v.rest), under(v.rest) - v.rest[1]);
  return { bust, band, top, under, field: band };
}

/** Builds it: { shell, shade } like the polo's, or null if her body has no bust to measure from. */
export function buildCropTop(body, p = CROP) {
  const { verts, index, boneNames, paint } = body;
  const F = cropFields(body, p);
  if (!F) return null;
  const neck = body.bones.Neck;
  const dominant = (v) => boneNames[v.weights.reduce((a, b) => (b[1] > a[1] ? b : a))[0]] ?? '';
  const cloth = new Set(['skin', 'shirt']);
  const keepTri = (...tri) => tri.every((i) => cloth.has(paint(i)) && !p.bare.test(dominant(verts[i]))) && tri.some((i) => F.field(verts[i]) <= 0.03);
  let mesh = weld(verts, index, keepTri);
  mesh = subdivide(mesh, () => p.round);
  smoothSkinning(mesh, 4, 0.5);
  // Round her back the band is narrower than her triangles, so its edges are drawn in first: cut at once, a triangle with a corner
  // above the band and one below has no corner inside, and the band would vanish there.
  mesh = cut(mesh, (v) => v.rest[1] - F.top(v.rest), 'bandTop', { keep: 'split' });
  mesh = cut(mesh, (v) => F.under(v.rest) - v.rest[1], 'bandUnder', { keep: 'split' });
  mesh = cut(mesh, F.field, 'edge');
  for (const v of mesh.verts) {
    v.bind = [v.bind[0] + v.normal[0] * p.ease, v.bind[1] + v.normal[1] * p.ease, v.bind[2] + v.normal[2] * p.ease];
    v.rest = applySkin(v.skin, v.bind);
  }
  // A turned-in edge all round, so it has some thickness.
  const tris = mesh.tris.slice();
  const all = mesh.verts.slice();
  const shade = mesh.verts.map(() => 1);
  const copies = new Map();
  const inner = (i) => {
    if (!copies.has(i)) {
      const v = mesh.verts[i];
      const bind = sub(v.bind, scale(v.normal, p.ease - 0.001));
      copies.set(i, all.length);
      all.push({ ...v, bind, rest: applySkin(v.skin, bind), apart: true });
      shade.push(p.insideShade);
    }
    return copies.get(i);
  };
  for (const [a, b] of openEdges(mesh)) tris.push([b, a, inner(a)], [b, inner(a), inner(b)]);
  // The straps, from the band's top at her front, over each shoulder, to its top at her back.
  for (const strap of buildStraps(body, F, p)) {
    const base = all.length;
    for (const v of strap.verts) {
      all.push(v);
      shade.push(1);
    }
    for (const t of strap.tris) tris.push(t.map((i) => i + base));
  }
  const shell = { verts: all, tris };
  shell.normals = smoothNormals(shell);
  return { shell, shade, bust: F.bust };
}

/**
 * The two string straps: for each, rays from all round a line running front to back through her shoulder, `strapAcross` from
 * her middle, find her skin from the band's top at her front, over the shoulder, down to the band's top at her back. The path is
 * evened out, lifted `strapLift` off her, and made a ribbon `strapWidth` either side, each point skinned as her skin under it.
 */
export function buildStraps(body, F, p = CROP) {
  const { verts, index, boneNames, paint } = body;
  const neck = body.bones.Neck;
  const dominant = (v) => boneNames[v.weights.reduce((a, b) => (b[1] > a[1] ? b : a))[0]] ?? '';
  // Her skin round her shoulders, but not her hair or her head (a bob hangs down to them).
  const skinTris = [];
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (tri.some((i) => paint(i) === 'hair' || /Head/.test(dominant(verts[i])))) continue;
    if (tri.every((i) => verts[i].rest[1] < F.bust.y - 0.1 || verts[i].rest[1] > neck[1] + 0.1)) continue;
    skinTris.push(tri);
  }
  const ground = { verts, tris: skinTris };
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
      if (v.rest[1] < F.top(v.rest) - 0.006) continue; // below the band's top: the band is there
      path.push({ v, d });
    }
    if (path.length < 4) continue;
    // Evened out along the path (her shoulder's faces are few and large), then lifted off her.
    const rest = path.map(({ v }) => v.rest);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < rest.length - 1; i++) rest[i] = scale(add(add(rest[i - 1], rest[i + 1]), scale(rest[i], 2)), 0.25);
    }
    const ribbon = { verts: [], tris: [] };
    path.forEach(({ v, d }, i) => {
      const at = add(rest[i], scale(d, p.strapLift));
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
