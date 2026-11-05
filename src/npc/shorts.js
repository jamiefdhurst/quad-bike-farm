// The girls' denim shorts as a garment cut over the body, with the polo (polo.js) tucked in (see docs/decisions/girls.md, "The polo as a
// garment"). Pure, on her body as plain data (garmentMesh.js).
//
// Her hips and thighs, cut level at the waist and square across each thigh, with a waistband and turned-in edges. The polo is
// tucked into them: at the waist both are her own faces pushed straight out along the same normals (the shorts further), so
// the shirt stays inside however she bends.

import { weld, subdivide, cut, openEdges, smoothNormals, applySkin, unskinDir, drape, vec } from './garmentMesh.js';

const { sub, add, scale, dot, norm } = vec;
const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

export const SHORTS = {
  ease: 0.006, // off her body at the waist (m)
  flare: 0.012, // more by the hem
  legLength: 0.4, // the hem across the thigh, this fraction of the way from hip joint to knee
  band: 0.03, // the waistband's depth
  bandEase: 0.011, // it stands proud of her (and of the shirt tucked into it), so it reads as a band
  bandShade: 0.88,
  hemShade: 0.9, // the leg hems, a turned-up edge
  hemBand: 0.012,
  insideShade: 0.55,
  // The seat: her body's bottom is one flat plate across both sides ending in a shelf above her thighs, so the denim is shaped
  // over two round cheeks instead, filling the hollow under them down to the hem.
  seatMax: 0.07, // never more than this further out than it was
  cheek: [0.09, 0.16, 0.06], // each cheek's half-width, reach up from its fullest, and depth (m); down, it reaches past the hem
  cheekApart: 0.055, // each cheek's middle this far from the seam
  cheekDrop: 0, // their fullest this far below the bottom of her body's flat plate
  hemCup: 0.015, // at the hem the cheeks are as they are this far up, so the hem stands round them
  seatSmoothing: 6, // passes evening out how far each point of the seat is moved, between neighbours
  subdivide: false, // split each of her faces in four (flat), so the seat curves rather than folding at her few corners
  drape: 8, // passes bridging the hollows under her (the model's old shirt hem over her seat and hips), so the denim doesn't step in
};

/** The lines the shorts are cut along (below 0 is inside). `body` as for polo.js's topFields. */
export function shortsFields(body, p = SHORTS) {
  const { bones, boneNames, waist } = body;
  const waistField = (v) => v.rest[1] - waist; // level as she stands (level in the stored pose dips at her back)
  const leg = (side) => {
    const hip = bones[`${side}UpLeg`];
    const knee = bones[`${side}Leg`];
    const axis = sub(knee, hip);
    const along = norm(axis);
    const at = Math.hypot(...axis) * p.legLength;
    const mine = new RegExp(`^${side}(UpLeg|Leg)$`);
    const legness = (v) => v.weights.reduce((s, [b, w]) => s + (mine.test(boneNames[b]) ? w : 0), 0);
    const s = (v) => dot(sub(v.rest, hip), along);
    return { field: (v) => legness(v) * (s(v) - at) - (1 - legness(v)) * 0.05, legness, s, at };
  };
  return { waistField, left: leg('Left'), right: leg('Right') };
}

/** Builds the shorts. Positions and normals are in the bind frame (root space): skin them with `weights`. */
export function buildShorts(body, p = SHORTS) {
  const { verts, index, boneNames, paint, waist } = body;
  const F = shortsFields(body, p);
  const fields = [F.waistField, F.left.field, F.right.field];
  const inside = (v) => fields.every((f) => f(v) <= 0);
  const cloth = new Set(['skin', 'shirt', 'trousers']);
  const bare = /Arm|Hand|Shoulder|Neck|Head|Foot|Toe/;
  const dominant = (v) => boneNames[v.weights.reduce((a, b) => (b[1] > a[1] ? b : a))[0]] ?? '';
  const keepTri = (...tri) =>
    tri.every((i) => cloth.has(paint(i)) && !bare.test(dominant(verts[i]))) && tri.some((i) => inside(verts[i]));

  // Subdivided flat, not rounded: rounded, at her hips, which bend right over when she sits, the new points (their skinning
  // blended) sank into her lap. Flat they stay on her faces, and the seat has enough points to curve smoothly.
  let mesh = weld(verts, index, keepTri);
  if (p.subdivide) mesh = subdivide(mesh, 0);
  mesh = cut(mesh, F.waistField, 'waist');
  mesh = cut(mesh, F.left.field, 'leg');
  mesh = cut(mesh, F.right.field, 'leg');
  mesh = cut(mesh, (v) => F.waistField(v) + p.band, 'band', { keep: 'both' });
  mesh = cut(mesh, (v) => F.left.field(v) + p.hemBand, 'hemBand', { keep: 'both' });
  mesh = cut(mesh, (v) => F.right.field(v) + p.hemBand, 'hemBand', { keep: 'both' });

  const hipY = Math.max(body.bones.LeftUpLeg[1], body.bones.RightUpLeg[1]);
  const ease = (v) => {
    const l = F.left.legness(v) > F.right.legness(v) ? F.left : F.right;
    const down = smooth01(l.s(v) / l.at) * smooth01((hipY - v.rest[1]) / 0.05 + 1);
    const band = smooth01((F.waistField(v) + p.band + 0.004) / 0.006); // a small step out at the band's bottom edge
    return Math.max(p.ease + p.flare * down, p.ease + (p.bandEase - p.ease) * band);
  };
  for (const v of mesh.verts) {
    v.bind = add(v.bind, scale(v.normal, ease(v)));
    v.rest = applySkin(v.skin, v.bind);
  }
  seat(mesh, body, p);
  // Over the lip all round her at the model's old shirt hem (her seat, her hips), not in under it.
  drape(mesh, body.split ? p.drape * 4 : p.drape);
  const zone = (v) => {
    if (v.edge === 'band' || v.edge === 'hemBand') return v.outside ? (v.edge === 'band' ? 'band' : 'hem') : '';
    if (v.edge === 'waist') return 'band';
    if (v.edge === 'leg') return 'hem';
    if (F.waistField(v) + p.band > 0) return 'band';
    if (F.left.field(v) + p.hemBand > 0 || F.right.field(v) + p.hemBand > 0) return 'hem';
    return '';
  };
  const shadeOf = { band: p.bandShade, hem: p.hemShade, '': 1 };
  const shade = mesh.verts.map((v) => shadeOf[zone(v)]);

  // Turned-in edges at the waist and the legs.
  const tris = mesh.tris.slice();
  const all = mesh.verts.slice();
  const copies = [new Map(), new Map()];
  const copy = (k, i, depth) => {
    if (!copies[k].has(i)) {
      const v = mesh.verts[i];
      copies[k].set(i, all.length);
      const bind = sub(v.bind, scale(v.normal, depth));
      all.push({ ...v, bind, rest: applySkin(v.skin, bind), apart: true });
      shade.push(depth ? p.insideShade : shade[i]);
    }
    return copies[k].get(i);
  };
  for (const [a, b] of openEdges(mesh)) {
    const A = mesh.verts[a];
    const B = mesh.verts[b];
    if (!['waist', 'leg'].includes(A.edge) || A.edge !== B.edge) continue;
    const [oa, ob, ia, ib] = [copy(0, a, 0), copy(0, b, 0), copy(1, a, ease(A) - 0.001), copy(1, b, ease(B) - 0.001)];
    tris.push([ob, oa, ia], [ob, ia, ib]);
  }
  const shell = { verts: all, tris };
  shell.normals = smoothNormals(shell);
  return { shell, shade };
}

/**
 * Below the fullest part of her bottom the shorts fall nearly straight to the hem rather than following her in under it. Worked
 * out as she stands (her back is -z) and carried back to the stored pose through each point's skin.
 */
function seat(mesh, body, p) {
  const hips = body.bones.Hips;
  if (!hips) return;
  const x0 = hips[0];
  const behind = (v) => v.rest[2] < hips[2];
  // Where her bottom is fullest: the furthest-back point of the shorts near her middle, and its height.
  let full = null;
  let hemY = Infinity;
  for (const v of mesh.verts) {
    if (!behind(v) || Math.abs(v.rest[0] - x0) > 0.14) continue;
    hemY = Math.min(hemY, v.rest[1]);
    if (v.rest[1] < hips[1] + 0.03 && (!full || v.rest[2] < full[2])) full = v.rest;
  }
  if (!full) return;
  // Her body's plate is flat from its top down to the shelf under it: the bottom of that, where she should be fullest.
  let low = full[1];
  for (const v of mesh.verts) {
    if (behind(v) && Math.abs(v.rest[0] - x0) < 0.12 && v.rest[2] < full[2] + 0.012) low = Math.min(low, v.rest[1]);
  }
  // Two round cheeks, either side of the seam, reaching back as far as she does at her fullest and a little lower, so the cloth
  // fills the hollow under her bottom down to the hem and curves into it rather than ending in a ledge.
  const [rx, ryUp, rz] = p.cheek;
  const cy = low - p.cheekDrop;
  const ryDown = Math.max(0.04, cy - hemY + p.hemCup * 2);
  const zc = full[2] + rz;
  const cheekZ = (x, y) => {
    let best = Infinity;
    for (const side of [-1, 1]) {
      const ex = (x - (x0 + side * p.cheekApart)) / rx;
      const ey = (y - cy) / (y > cy ? ryUp : ryDown);
      const e = ex * ex + ey * ey;
      if (e < 1) best = Math.min(best, zc - rz * Math.sqrt(1 - e));
    }
    return best;
  };
  const move = new Map(); // vertex -> how far back it goes
  for (const v of mesh.verts) {
    const r = v.rest;
    if (!behind(v)) continue;
    const want = cheekZ(r[0], Math.max(r[1], hemY + p.hemCup));
    if (!(want < r[2])) continue;
    // Never pulled in, only out; faded in below the waistband, and round towards her sides.
    const round = smooth01((hips[2] - r[2]) / 0.05);
    const band = smooth01((hips[1] + 0.06 - r[1]) / 0.06);
    move.set(v, -Math.min(p.seatMax, r[2] - want) * round * band);
  }
  // Evened out between neighbours, so it blends into the rest instead of ending in a step.
  const index = new Map(mesh.verts.map((v, i) => [v, i]));
  const near = mesh.verts.map(() => new Set());
  for (const t of mesh.tris) for (const a of t) for (const b of t) if (a !== b) near[a].add(b);
  for (let pass = 0; pass < p.seatSmoothing; pass++) {
    const next = new Map();
    mesh.verts.forEach((v, i) => {
      if (v.rest[2] >= hips[2]) return;
      const ns = [...near[i]];
      if (!ns.length) return;
      const avg = ns.reduce((sum, j) => sum + (move.get(mesh.verts[j]) ?? 0), 0) / ns.length;
      next.set(v, 0.5 * (move.get(v) ?? 0) + 0.5 * avg);
    });
    for (const [v, dz] of next) move.set(v, dz);
  }
  for (const [v, dz] of move) {
    if (!dz || index.get(v) === undefined) continue;
    v.bind = add(v.bind, unskinDir(v.skin, [0, 0, dz]));
    v.rest = applySkin(v.skin, v.bind);
  }
}
