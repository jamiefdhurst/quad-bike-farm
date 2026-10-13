// The girls' denim shorts as a garment cut over the body (the spike behind ?polo=shell, with the polo in polo.js; see
// DECISIONS.md, "The polo as a garment"). Pure, on her body as plain data (garmentMesh.js).
//
// Her hips and thighs, cut level at the waist and square across each thigh, with a waistband and turned-in edges. The polo is
// tucked into them: at the waist both are her own faces pushed straight out along the same normals (the shorts further), so
// the shirt stays inside however she bends.

import { weld, cut, openEdges, smoothNormals, applySkin, unskinDir, vec } from './garmentMesh.js';

const { sub, add, scale, dot, norm } = vec;
const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

export const SHORTS = {
  ease: 0.006, // off her body at the waist (m)
  flare: 0.012, // more by the hem
  legLength: 0.56, // the hem across the thigh, this fraction of the way from hip joint to knee
  band: 0.03, // the waistband's depth
  bandShade: 0.92,
  hemShade: 0.9, // the leg hems, a turned-up edge
  hemBand: 0.012,
  insideShade: 0.55,
  // The seat: below the fullest part of her bottom the denim falls nearly straight to the hem, bridging between the two sides,
  // instead of following her in under it.
  seatSlope: 0.12, // metres forward per metre down from her bottom's furthest-back point
  seatMax: 0.06,
  seatReach: 2, // bins (2 cm) either side it looks for that point
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

  // Not subdivided: at her hips, which bend right over when she sits, a point between two of her vertices with their weights
  // blended doesn't stay between them once skinned, and sinks into her lap. Her own vertices bend exactly as she does.
  let mesh = weld(verts, index, keepTri);
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
    return p.ease + p.flare * down;
  };
  for (const v of mesh.verts) {
    v.bind = add(v.bind, scale(v.normal, ease(v)));
    v.rest = applySkin(v.skin, v.bind);
  }
  seat(mesh, body, p);
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
  const step = 0.02;
  const back = new Map(); // x bin -> the furthest-back point of her bottom in it
  for (const v of mesh.verts) {
    const r = v.rest;
    if (r[2] >= hips[2] || r[1] > hips[1] + 0.02 || r[1] < hips[1] - 0.2 || Math.abs(r[0] - hips[0]) > 0.16) continue;
    const k = Math.round((r[0] - hips[0]) / step);
    const f = back.get(k);
    if (!f || r[2] < f.z) back.set(k, { z: r[2], y: r[1] });
  }
  const fullest = (x) => {
    const k = Math.round((x - hips[0]) / step);
    let best = null;
    for (let d = -p.seatReach; d <= p.seatReach; d++) {
      const f = back.get(k + d);
      if (f && (!best || f.z < best.z)) best = f;
    }
    return best;
  };
  for (const v of mesh.verts) {
    const r = v.rest;
    if (r[2] >= hips[2]) continue;
    const f = fullest(r[0]);
    if (!f || r[1] >= f.y) continue;
    const want = f.z + p.seatSlope * (f.y - r[1]);
    if (r[2] <= want) continue;
    // Fading out towards her sides and round to her front, so the seat joins the rest smoothly.
    const sides = 1 - smooth01((Math.abs(r[0] - hips[0]) - 0.07) / 0.07);
    const behind = smooth01((hips[2] - r[2]) / 0.05);
    const dz = -Math.min(p.seatMax, r[2] - want) * sides * behind;
    v.bind = add(v.bind, unskinDir(v.skin, [0, 0, dz]));
    v.rest = applySkin(v.skin, v.bind);
  }
}
