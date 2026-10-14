// Jess's string crop-top, for a very warm day: a narrow band round her bust, thinner still round her back like a bra's, held up by
// two string straps over her shoulders. Cut from her own body like the polo (garmentMesh.js), on plain data, pure. Everything else
// on her top half is bare (outfit.js paints the body's shirt band her skin colour under it).

import { weld, subdivide, smoothSkinning, cut, openEdges, smoothNormals, applySkin, vec } from './garmentMesh.js';

const { sub, scale } = vec;

export const CROP = {
  ease: 0.004, // how far it stands off her
  round: 0.75,
  bare: /Arm|Hand|Leg|Foot|Toe/, // bones whose skin it never covers
  top: 0.04, // at her front, its top edge this far above the fullest part of her bust
  under: 0.055, // and its bottom edge this far below it
  backTop: -0.022, // round her back, a narrow band: its top this far above her bust's height (below it)
  backUnder: 0.04, // and its bottom
  strapAcross: 0.07, // the straps this far either side of her middle, front and back, over her shoulders
  strapWidth: 0.005, // half the width of a strap
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

/** The lines it's cut along, as fields (below 0 inside): the band, the straps, and the two together. */
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
  const straps = (v) => {
    const r = v.rest;
    const line = Math.abs(Math.abs(r[0] - neck[0]) - p.strapAcross) - p.strapWidth;
    // From just inside the band's top up and over her shoulders, no higher than the base of her neck.
    return Math.max(line, top(r) - 0.01 - r[1], r[1] - (neck[1] + 0.05));
  };
  return { bust, band, straps, field: (v) => Math.min(band(v), straps(v)) };
}

/** Builds it: { shell, shade } like the polo's, or null if her body has no bust to measure from. */
export function buildCropTop(body, p = CROP) {
  const { verts, index, boneNames, paint } = body;
  const F = cropFields(body, p);
  if (!F) return null;
  const neck = body.bones.Neck;
  const dominant = (v) => boneNames[v.weights.reduce((a, b) => (b[1] > a[1] ? b : a))[0]] ?? '';
  const cloth = new Set(['skin', 'shirt']);
  // Everything from below the band to her neck: the straps are narrower than her triangles, so they're drawn in before cutting.
  const keepTri = (...tri) =>
    tri.every((i) => cloth.has(paint(i)) && !p.bare.test(dominant(verts[i]))) && tri.some((i) => verts[i].rest[1] > F.bust.y - 0.12 && verts[i].rest[1] < neck[1] + 0.08);
  let mesh = weld(verts, index, keepTri);
  mesh = subdivide(mesh, () => p.round);
  smoothSkinning(mesh, 4, 0.5);
  for (const side of [-1, 1]) {
    for (const w of [-p.strapWidth, p.strapWidth]) {
      const x = neck[0] + side * (p.strapAcross + w);
      mesh = cut(mesh, (v) => v.rest[0] - x, 'strapLine', { keep: 'split' });
    }
  }
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
  const shell = { verts: all, tris };
  shell.normals = smoothNormals(shell);
  return { shell, shade, bust: F.bust };
}
