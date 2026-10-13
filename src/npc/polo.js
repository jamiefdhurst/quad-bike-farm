// The girls' knitted tops, the polo and the barn jumper, as garments over her body rather than colour painted on it (the spike
// behind ?polo=shell; see DECISIONS.md, "The polo as a garment"). Pure: it takes her body as plain data (garmentMesh.js) and
// gives back arrays.
//
// A top is her torso and arms, rounded (subdivided) and cut along smooth lines: a round neck at the base of her neck, the
// sleeves square across the arm, and a hem. The edges finish in bands a shade darker, turned in so they have some thickness.
// The polo's sleeves are short and its hem is tucked into her shorts, with a stitched placket and five buttons down the front;
// the jumper reaches her wrists and hangs over her shorts.

import {
  weld,
  subdivide,
  cut,
  openEdges,
  smoothNormals,
  rayHit,
  inTriangle,
  applySkin,
  applySkinDir,
  unskin,
  unskinDir,
  vec,
} from './garmentMesh.js';

const { sub, add, scale, dot, norm, cross } = vec;
const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

// What sets one knitted top apart from another; POLO and JUMPER below.
export const POLO = {
  ease: 0.007, // how far the shirt stands off her body (m)
  round: 0.75, // how far the subdivided shirt rounds out between the body's corners (0 flat, 1 full)
  armRound: 0.25, // less on the arms, whose few long triangles would balloon
  bare: /Leg|Foot|Toe|Hand/, // bones whose skin it never covers
  // The neck: a line round her neck where it meets her shoulders, as heights above her neck bone at the back, the sides and the
  // front (where the placket starts), for points `neckRing` out from the middle of her neck. Further out counts as lower by
  // `neckSlope` per metre, so the line sits in the angle between neck and shoulders rather than climbing either.
  neckBack: 0.016,
  neckSide: 0.014,
  neckFront: -0.008,
  neckRing: 0.045,
  neckSlope: 1.2,
  neckCap: 0.04, // nothing higher than this above her neck bone is inside, however far out (her jaw is wide)
  neckBand: 0.011, // depth of the band round the neck
  neckEase: 0.0045, // how close the band sits to her neck at the edge
  // Short sleeves: the hem square across the upper arm (from the Arm bone towards the ForeArm), this fraction of the way down.
  sleeveFrom: 'Arm',
  sleeveLength: 0.66,
  sleeveEase: 0.005, // the sleeve at the shoulder
  sleeveFlare: 0.008, // and at the hem
  cuff: 0.016, // depth of the band at the sleeve's hem
  cuffEase: null, // how close the cuff is drawn in (null: as the sleeve)
  // Tucked in: the hem this far below the top of the shorts, the shirt drawn close to her below their waistband (inside the
  // shorts) and blousing out a little over it.
  hemDrop: 0.035,
  tucked: true,
  tuckEase: 0.0025,
  blouse: 0.004,
  hemBand: 0,
  hemEase: null,
  // Below the bust the front falls towards the waist instead of following her in under it.
  hangSlope: 0.32, // metres back per metre down from the bust's furthest-forward point
  hangMax: 0.035,
  hangReach: 2, // bins (2 cm) either side it looks for her furthest-forward point, so it bridges between her breasts
  bandShade: 0.84, // the neck band and cuffs, ribbed, a shade darker
  insideShade: 0.55, // the turned-in edge
  lips: ['neck', 'sleeve'], // which edges are turned in
  // The placket: a strip down the front from the neck with five buttons.
  placket: true,
  placketLength: 0.155,
  placketWidth: 0.024,
  placketLift: 0.0022, // how far it stands proud of the shirt
  buttons: [0.01, 0.042, 0.074, 0.106, 0.138], // how far down the placket each button is (m)
  buttonRadius: 0.0052,
  buttonShade: 0.72, // buttons a shade darker than the shirt
  open: 0, // how many buttons from the top are undone (Jess: 1)
  veeWidths: [0, 0.017, 0.022, 0.027, 0.033, 0.04], // an open neck's V: half its width at the neckline, by buttons undone
  veeBows: [1, 1, 0.92, 0.8, 0.6, 0.5], // and how its sides curve out (below 1), opening round her bust the further it's undone
  veeStop: 0.009, // and where it stops, this far above the first button done up (all undone: the bottom of the placket)
  cleavage: 0.5, // with the neck open down to her bust, how dark the soft shadow down the middle is
  veeShadow: 0.18, // and the shadow along the V's edges, where the shirt's fronts stand over her skin
  cleavageWidth: 0.007, // either side of her middle
};

// The barn jumper, a size too big: down to the wrist and over the shorts, a crew neck low enough at the front to show the
// polo's top button, ribbed bands at the neck, cuffs and hem, and falling straight from the bust.
export const JUMPER = {
  ...POLO,
  ease: 0.026,
  bare: /Leg|Foot|Toe|Hand[A-Z]/, // the hand itself may carry the wrist
  neckBack: 0.018,
  neckSide: 0.015,
  neckFront: -0.036,
  neckRing: 0.055,
  neckBand: 0.022,
  neckEase: 0.022,
  sleeveFrom: 'ForeArm',
  sleeveLength: 0.86,
  sleeveEase: 0.021,
  sleeveFlare: 0.021,
  cuff: 0.03,
  cuffEase: 0.009,
  hemDrop: 0.09,
  tucked: false,
  hemBand: 0.03,
  hemEase: 0.016,
  hangSlope: 0.18,
  hangMax: 0.05,
  hangReach: 3,
  bandShade: 0.76,
  lips: ['neck', 'sleeve', 'hem'],
  placket: false,
};

/**
 * The lines a top is cut along, as fields (below 0 is inside). `body` is her body as plain data: `verts[i]` is { bind, rest,
 * normal, weights, skin } (garmentMesh.js), `index` its triangles, `boneNames` the skeleton's bone names by index, `bones`
 * rest-frame positions of the bones by name, `paint(i)` the palette band the original texture gives vertex i ('skin', 'shirt',
 * 'trousers', 'hair' ...), `waist` the height of the top of the shorts as she stands.
 */
export function topFields(body, p = POLO) {
  const { bones, boneNames, waist } = body;
  const neck = bones.Neck;
  const neckField = (v) => {
    const r = v.rest;
    const dx = r[0] - neck[0];
    const dz = r[2] - neck[2];
    const rad = Math.hypot(dx, dz);
    const c = rad > 1e-6 ? dz / rad : 0; // 1 at her front, -1 at the back
    const lineY = neck[1] + p.neckSide + (c > 0 ? (p.neckFront - p.neckSide) * c * c : (p.neckBack - p.neckSide) * c * c);
    return Math.max(r[1] - lineY - p.neckSlope * (rad - p.neckRing), r[1] - (neck[1] + p.neckCap));
  };
  const sleeve = (side) => {
    const next = p.sleeveFrom === 'Arm' ? 'ForeArm' : 'Hand';
    const joint = bones[`${side}${p.sleeveFrom}`];
    const end = bones[`${side}${next}`];
    const axis = sub(end, joint);
    const length = Math.hypot(...axis);
    const along = norm(axis);
    const mine = new RegExp(`^${side}(${p.sleeveFrom}|${next})$`);
    const limb = new RegExp(`^${side}(Arm|ForeArm|Hand)$`);
    const share = (re) => (v) => v.weights.reduce((s, [b, w]) => s + (re.test(boneNames[b]) ? w : 0), 0);
    const armness = share(mine);
    const s = (v) => dot(sub(v.rest, joint), along);
    const at = length * p.sleeveLength;
    // Blended by how much that part of the arm carries the vertex, so nothing nearer her body is ever cut by it.
    const field = (v) => {
      const a = armness(v);
      return a * (s(v) - at) - (1 - a) * 0.05;
    };
    return { field, s, armness, limb: share(limb), at };
  };
  const hemField = (v) => waist - p.hemDrop - v.rest[1];
  return { neckField, left: sleeve('Left'), right: sleeve('Right'), hemField };
}

/** The polo's lines; see topFields. */
export const poloFields = (body) => topFields(body, POLO);

/**
 * Builds a knitted top (POLO, JUMPER) and, for the polo, its placket. Positions and normals are in the bind frame (root space):
 * skin them with `weights`.
 */
export function buildTop(body, p = POLO) {
  const { verts, index, boneNames, paint, waist } = body;
  const F = topFields(body, p);
  const fields = [F.neckField, F.left.field, F.right.field, F.hemField];
  const inside = (v) => fields.every((f) => f(v) <= 0);
  const cloth = new Set(['skin', 'shirt', 'trousers']);
  const dominant = (v) => boneNames[v.weights.reduce((a, b) => (b[1] > a[1] ? b : a))[0]] ?? '';
  const keepTri = (...tri) =>
    tri.every((i) => cloth.has(paint(i)) && !p.bare.test(dominant(verts[i]))) && tri.some((i) => inside(verts[i]));

  // Below the waistband a tucked shirt is inside the shorts, which are her flat faces pushed out: don't round it out there.
  let mesh = weld(verts, index, keepTri);
  const onArm = (v) => F.left.limb(v) + F.right.limb(v) > 0.5;
  const flatBelow = p.tucked ? waist + 0.03 : -Infinity;
  mesh = subdivide(mesh, (A, B) => (Math.min(A.rest[1], B.rest[1]) < flatBelow ? 0 : onArm(A) || onArm(B) ? p.armRound : p.round));
  // An open neck: a V cut into the front of the neckline, down to just above the first button done up.
  const vee = p.open ? openNeck(mesh, body, p, F.neckField) : null;
  if (vee) {
    const round = F.neckField;
    F.neckField = (v) => Math.max(round(v), vee.field(v));
    // Split down her middle first: either side of it the V's edge is a straight line, which a cut follows exactly. Across it,
    // where the V is narrower than the shirt's triangles, a triangle straddling the middle couldn't be cut along both sides.
    mesh = cut(mesh, (v) => v.rest[0] - body.bones.Neck[0], 'middle', { keep: 'split' });
  }
  mesh = cut(mesh, F.neckField, 'neck');
  mesh = cut(mesh, F.left.field, 'sleeve');
  mesh = cut(mesh, F.right.field, 'sleeve');
  mesh = cut(mesh, F.hemField, 'hem');
  // The bands are drawn into the knit (both sides kept), each side its own copy of the points on the line, so the colour
  // changes sharply there.
  const bands = [
    [(v) => F.neckField(v) + p.neckBand, 'neckBand'],
    [(v) => F.left.field(v) + p.cuff, 'cuffBand'],
    [(v) => F.right.field(v) + p.cuff, 'cuffBand'],
  ];
  if (p.hemBand) bands.push([(v) => F.hemField(v) + p.hemBand, 'hemBand']);
  for (const [field, tag] of bands) mesh = cut(mesh, field, tag, { keep: 'both' });
  const inBand = (v) => bands.some(([field]) => field(v) > 0);

  // How far out each point stands.
  const sleeveOf = (v) => (F.left.limb(v) > F.right.limb(v) ? F.left : F.right);
  const ease = (v) => {
    const sl = sleeveOf(v);
    const a = sl.limb(v);
    const flare = smooth01((sl.s(v) - (sl.at - 0.06)) / 0.06);
    let arm = p.sleeveEase + (p.sleeveFlare - p.sleeveEase) * flare;
    if (p.cuffEase !== null) arm += (p.cuffEase - arm) * smooth01((sl.field(v) + p.cuff) / p.cuff);
    let e = p.ease * (1 - a) + arm * a;
    // The neck band hugs her neck towards its edge.
    const n = F.neckField(v);
    e += (p.neckEase - e) * smooth01((n + p.neckBand) / p.neckBand);
    const y = v.rest[1];
    if (p.tucked) {
      // Close to her below the waistband, blousing a little over it.
      e += (p.tuckEase - e) * smooth01((waist + 0.025 - y) / 0.02);
      e += p.blouse * Math.max(0, 1 - Math.abs(y - (waist + 0.04)) / 0.03) * (1 - a);
    } else if (p.hemBand) {
      // A snug ribbed hem.
      e += (p.hemEase - e) * smooth01((F.hemField(v) + p.hemBand) / p.hemBand) * (1 - a);
    }
    return e;
  };
  for (const v of mesh.verts) {
    v.bind = add(v.bind, scale(v.normal, ease(v)));
    v.rest = applySkin(v.skin, v.bind);
  }
  hang(mesh, body, p, F);
  for (const v of mesh.verts) v.rest = applySkin(v.skin, v.bind);

  // Shade: the bands a shade darker. A point on a band's line belongs to the side its triangle is on; colours are per vertex,
  // and the copies on the band side are marked by `cut`.
  const bandTags = new Set(bands.map(([, tag]) => tag));
  const band = (v) => {
    if (bandTags.has(v.edge)) return !!v.outside;
    if (v.edge === 'neck' || v.edge === 'sleeve' || (v.edge === 'hem' && p.hemBand)) return true;
    return inBand(v);
  };
  const shade = mesh.verts.map((v) => (band(v) ? p.bandShade : 1));

  // The turned-in edges: a strip from the edge back in towards her body, so it has some thickness.
  const tris = mesh.tris.slice();
  const allVerts = mesh.verts.slice();
  const outer = new Map();
  const inner = new Map();
  const copy = (map, i, depth) => {
    if (!map.has(i)) {
      const v = mesh.verts[i];
      map.set(i, allVerts.length);
      const bind = sub(v.bind, scale(v.normal, depth));
      allVerts.push({ ...v, bind, rest: applySkin(v.skin, bind), apart: true });
      shade.push(depth ? p.insideShade : shade[i]);
    }
    return map.get(i);
  };
  const lips = new Set(p.lips);
  for (const [a, b] of openEdges(mesh)) {
    const A = mesh.verts[a];
    const B = mesh.verts[b];
    if (!lips.has(A.edge) || !lips.has(B.edge)) continue;
    // Not down an open neck's V: the placket's halves cover that edge, and turned in there they'd fill the opening.
    if (vee && Math.min(A.rest[1], B.rest[1]) < vee.top - 0.004 && A.rest[2] > 0) continue;
    const [oa, ob] = [copy(outer, a, 0), copy(outer, b, 0)];
    const [ia, ib] = [copy(inner, a, ease(A) - 0.0012), copy(inner, b, ease(B) - 0.0012)];
    tris.push([ob, oa, ia], [ob, ia, ib]);
  }
  const shell = { verts: allVerts, tris };
  shell.normals = smoothNormals(shell);
  return { shell, shade, vee, placket: p.placket ? buildPlacket({ verts: mesh.verts, tris: mesh.tris }, body, p, vee) : null };
}

/**
 * The V of an open neck, worked out on the rounded shirt before it's cut: `top`, the round neckline's height at the middle of
 * her front; `bottom`, just above the first button done up; `halfWidth(y)`, how far either side of the middle it reaches at a
 * height; `field`, above 0 inside the V (only on her front, so her back is never cut by it).
 */
function openNeck(mesh, body, p, neckField) {
  const neck = body.bones.Neck;
  const x0 = neck[0];
  const near = (v) => Math.abs(v.rest[0] - x0) < 0.05 && v.rest[2] > neck[2] && v.rest[1] > neck[1] - 0.15;
  const front = { verts: mesh.verts, tris: mesh.tris.filter((t) => t.some((i) => near(mesh.verts[i]))) };
  let top = null;
  for (let y = neck[1] + p.neckCap + 0.005; y > neck[1] - 0.1 && top === null; y -= 0.001) {
    const h = rayHit(front, [x0, y, neck[2] + 0.6], [0, 0, -1]);
    if (h && neckField(inTriangle(front, h.tri, h.bary)) <= 0) top = y;
  }
  if (top === null) return null;
  const open = Math.min(p.open, p.buttons.length);
  const bottom = top - (open === p.buttons.length ? p.placketLength - 0.004 : p.buttons[open] - p.veeStop);
  const width = p.veeWidths[Math.min(open, p.veeWidths.length - 1)];
  const bow = p.veeBows[Math.min(open, p.veeBows.length - 1)];
  // Below its point the field carries on falling as a straight V would, so nothing there sits on the edge of being cut.
  const halfWidth = (y) => (y <= bottom ? (width * (y - bottom)) / (top - bottom) : width * ((y - bottom) / (top - bottom)) ** bow);
  const field = (v) => Math.min(halfWidth(v.rest[1]) - Math.abs(v.rest[0] - x0), v.rest[2] - neck[2] - 0.03);
  return { top, bottom, halfWidth, field };
}

/**
 * Below the bust the shirt falls towards the waist rather than following her in under it. Worked out in the rest frame (her
 * front is +z) and carried back to the bind frame through each point's skin.
 */
function hang(mesh, body, p, F) {
  const { bones, boneNames } = body;
  const neck = bones.Neck;
  const torso = (v) => v.weights.reduce((s, [b, w]) => s + (/Spine|Hips/.test(boneNames[b]) ? w : 0), 0);
  const step = 0.02;
  const front = new Map(); // x bin -> the furthest-forward point of her chest in it
  for (const v of mesh.verts) {
    const r = v.rest;
    if (torso(v) < 0.6 || r[2] <= neck[2] || r[1] > neck[1] - 0.06 || r[1] < neck[1] - 0.3 || Math.abs(r[0] - neck[0]) > 0.14) continue;
    const k = Math.round((r[0] - neck[0]) / step);
    const f = front.get(k);
    if (!f || r[2] > f.z) front.set(k, { z: r[2], y: r[1] });
  }
  const ledge = (x) => {
    const k = Math.round((x - neck[0]) / step);
    let best = null;
    for (let d = -p.hangReach; d <= p.hangReach; d++) {
      const f = front.get(k + d);
      if (f && (!best || f.z > best.z)) best = f;
    }
    return best;
  };
  for (const v of mesh.verts) {
    const r = v.rest;
    if (torso(v) < 0.6 || r[2] <= neck[2]) continue;
    const f = ledge(r[0]);
    if (!f || r[1] >= f.y) continue;
    // Easing back into the tuck at the waist, or into a ribbed hem.
    const toHem = p.tucked ? 0 : 0.012 * smooth01((F.hemField(v) + p.hemBand) / Math.max(p.hemBand, 1e-3));
    const want = f.z - p.hangSlope * (f.y - r[1]) - toHem;
    if (r[2] >= want) continue;
    // Not at her sides, which are already upright.
    const sides = 1 - smooth01((Math.abs(r[0] - neck[0]) - 0.09) / 0.05);
    const tuck = p.tucked ? smooth01((v.rest[1] - (body.waist + 0.01)) / 0.06) : 1;
    const dz = Math.min(p.hangMax, want - r[2]) * sides * tuck;
    if (dz > 0) v.bind = add(v.bind, unskinDir(v.skin, [0, 0, dz]));
  }
}

/**
 * The placket: a strip down the middle of her front from the neck, standing a little proud of the shirt, its edges turned down
 * to the shirt, stitching drawn on it (`uv`: across 0 to 1, down 0 to 1) and its buttons. With the top `p.open` buttons undone
 * (`vee`, from buildTop) it splits above the first one done up: its two halves lie along the edges of the V, the undone buttons
 * on her left half and their buttonholes on her right. Laid out as she stands on the finished shirt, then carried back to the
 * stored pose through the skin of the shirt where each point lies.
 */
function buildPlacket(mesh, body, p, vee) {
  const neck = body.bones.Neck;
  const x0 = neck[0];
  const w = p.placketWidth;
  // Only the front of her chest can be hit; the rest is skipped for speed.
  const near = (v) => Math.abs(v.rest[0] - x0) < 0.07 && v.rest[2] > neck[2] && v.rest[1] > neck[1] - 0.3;
  const front = { verts: mesh.verts, tris: mesh.tris.filter((t) => t.some((i) => near(mesh.verts[i]))) };
  const hitAt = (x, y) => {
    const h = rayHit(front, [x, y, neck[2] + 0.6], [0, 0, -1]);
    return h && inTriangle(front, h.tri, h.bary);
  };
  // Where the neckline is at the middle of her front (or at the top of the V): walk down until a ray from in front hits.
  const found = vee ? vee.top : frontTop(hitAt, x0, neck[1] + p.neckCap + 0.005, neck[1] - 0.1);
  if (found === null) return null;
  const top = found - 0.0003; // right up to where the shirt meets her neck
  const split = (y) => (vee ? Math.max(0, vee.halfWidth(y)) : 0);
  const restNormal = (v) => norm(applySkinDir(v.skin, v.normal));
  // A row across the strip at height y from xL to xR: the shirt under it, and how far forward the strip lies (flat across, so
  // it bridges any dip in the shirt).
  const rowAt = (y, xL, xR, n) => {
    const xAt = (k) => (n === 1 ? xL : xL + ((xR - xL) * k) / (n - 1));
    const under = [];
    for (let k = 0; k < n; k++) {
      const x = xAt(k);
      // At the V's edge or the very top a ray can just miss the shirt: step out, then down, a little until it hits (the point
      // stays where it is; only what's under it is looked for further off).
      let v = null;
      for (let down = 0; !v && down <= 0.012; down += 0.001) {
        for (let out = 0; !v && out < 0.006; out += 0.001) v = hitAt(x + Math.sign(x - x0) * out, y - down);
      }
      if (!v) return null;
      under.push(v);
    }
    return { under, z: Math.max(...under.map((v) => v.rest[2])) + p.placketLift, xs: under.map((_, k) => xAt(k)) };
  };

  const verts = [];
  const tris = [];
  const uv = [];
  const put = (v, rest, u, d) => {
    verts.push({ ...v, bind: unskin(v.skin, rest), rest, normal: v.normal });
    uv.push(u, d / p.placketLength);
    return verts.length - 1;
  };
  // One strip: rows from y0 down to y1, its edges at `edges(y)` ([xL, xR]), its u from u0 to u1; `caps` says which ends get a
  // turned-down end ('top', 'bottom').
  const strip = (y0, y1, edges, u0, u1, n, caps) => {
    const count = Math.max(2, Math.ceil((y0 - y1) / 0.0075));
    const face = [];
    const foot = [];
    for (let r = 0; r <= count; r++) {
      const y = y0 - ((y0 - y1) * r) / count;
      const [xL, xR] = edges(y);
      const row = rowAt(y, xL, xR, n);
      if (!row) return false;
      const d = top - y;
      face.push(row.under.map((v, k) => put(v, [row.xs[k], y, row.z], u0 + ((u1 - u0) * k) / (n - 1), d)));
      foot.push([0, n - 1].map((k) => put(row.under[k], add(row.under[k].rest, scale(restNormal(row.under[k]), 0.0004)), k ? u1 : u0, d)));
    }
    for (let r = 0; r < count; r++) {
      for (let k = 0; k < n - 1; k++) {
        const [a, b, c, d] = [face[r][k], face[r][k + 1], face[r + 1][k], face[r + 1][k + 1]];
        tris.push([a, c, b], [b, c, d]);
      }
      // The two long sides, down to the shirt.
      tris.push([foot[r][0], foot[r + 1][0], face[r][0]], [face[r][0], foot[r + 1][0], face[r + 1][0]]);
      tris.push([face[r][n - 1], face[r + 1][n - 1], foot[r][1]], [foot[r][1], face[r + 1][n - 1], foot[r + 1][1]]);
    }
    if (caps.includes('bottom')) tris.push([face[count][0], foot[count][0], face[count][n - 1]], [face[count][n - 1], foot[count][0], foot[count][1]]);
    if (caps.includes('top')) tris.push([face[0][0], face[0][n - 1], foot[0][0]], [face[0][n - 1], foot[0][1], foot[0][0]]);
    return true;
  };
  const bottom = top - p.placketLength;
  const vBottom = vee ? vee.bottom : top;
  // All undone, the halves run to the bottom of the placket, each with its own end.
  const closed = vBottom - bottom > 0.008;
  const halfCaps = closed ? ['top'] : ['top', 'bottom'];
  const ok =
    (!closed || strip(vBottom, bottom, () => [x0 - w / 2, x0 + w / 2], 0, 1, 5, vee ? ['bottom'] : ['top', 'bottom'])) &&
    (!vee ||
      (strip(top, closed ? vBottom : bottom, (y) => [x0 + split(y), x0 + split(y) + w / 2], 0.5, 1, 3, halfCaps) &&
        strip(top, closed ? vBottom : bottom, (y) => [x0 - split(y) - w / 2, x0 - split(y)], 0, 0.5, 3, halfCaps)));
  if (!ok) return null;

  // The buttons, and for the undone ones the buttonhole on the other half.
  const buttons = [];
  const slits = [];
  p.buttons.forEach((d, i) => {
    const y = top - d;
    const open = vee && (y > vBottom || !closed) && i < p.open;
    // On the strip's own face (which bridges the shirt's dips), not on the shirt under it.
    const at = (x, [xL, xR, n]) => {
      const face = rowAt(y, xL, xR, n);
      const under = rowAt(y, x, x, 1);
      return face && under && { centre: [x, y, face.z], normal: restNormal(under.under[0]), anchor: under.under[0] };
    };
    const b = open ? at(x0 + split(y) + w / 4, [x0 + split(y), x0 + split(y) + w / 2, 3]) : at(x0, [x0 - w / 2, x0 + w / 2, 5]);
    if (b) buttons.push(b);
    const h = open && at(x0 - split(y) - w / 4, [x0 - split(y) - w / 2, x0 - split(y), 3]);
    if (h) slits.push(h);
  });
  return { verts, tris, uv, buttons, slits, top };
}

/**
 * Walks down the middle of her front until a ray from in front hits the shirt, then narrows it down to a tenth of a millimetre:
 * the top of the shirt there, where it meets her neck.
 */
function frontTop(hitAt, x0, from, to) {
  for (let y = from; y > to; y -= 0.001) {
    if (!hitAt(x0, y)) continue;
    let [lo, hi] = [y, y + 0.001]; // lo hits, hi doesn't
    while (hi - lo > 0.0001) {
      const mid = (lo + hi) / 2;
      if (hitAt(x0, mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  return null;
}

/**
 * A buttonhole: a thin dark slit up and down the placket, standing just off it. Rest-frame points and triangles at `centre`,
 * facing `normal`.
 */
export function slitShape(centre, normal, length = 0.009, width = 0.0016) {
  const n = norm(normal);
  const across = norm(cross([0, 1, 0], n));
  const along = cross(n, across);
  const c = add(centre, scale(n, 0.0003));
  const corner = (a, b) => add(c, add(scale(across, (a * width) / 2), scale(along, (b * length) / 2)));
  return { points: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], tris: [[0, 1, 2], [0, 2, 3]] };
}

/**
 * Her skin inside the V of an open neck, as a patch of her own (flat-shaded) triangles cut to the V and lifted a hair off her,
 * because the body's paint can't follow a V across its coarse triangles. `vee` comes from buildTop.
 */
export function buildInset(body, vee, p = POLO) {
  const { verts, index } = body;
  const x0 = body.bones.Neck[0];
  const ids = new Map();
  const mesh = { verts: [], tris: [] };
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (!tri.some((i) => vee.field(verts[i]) > -0.03)) continue; // generous: the V's point can lie inside a triangle
    mesh.tris.push(
      tri.map((i) => {
        if (!ids.has(i)) {
          ids.set(i, mesh.verts.length);
          mesh.verts.push({ ...verts[i] });
        }
        return ids.get(i);
      }),
    );
  }
  // Split flat (each triangle into four in its own plane, so it still matches her facets) and down her middle, so the cut can
  // follow the V to its point: her chest's triangles are 5 cm across, and cut whole they stopped the patch well short of it.
  let patch = subdivide(mesh, 0);
  patch = cut(patch, (v) => v.rest[0] - x0, 'middle', { keep: 'split' });
  // And either side of it, so the shadow down her cleavage stays narrow.
  for (const side of [-1, 1]) patch = cut(patch, (v) => v.rest[0] - x0 - side * p.cleavageWidth, 'middle', { keep: 'split' });
  patch = cut(patch, (v) => -vee.field(v), 'vee');
  patch = cut(patch, (v) => v.rest[1] - (vee.top + 0.01), 'vee');
  // Lifted along the average of the faces at each corner, so the faces stay joined (each along its own would open cracks at
  // the creases, showing the shirt paint under them); still drawn flat, to match her.
  const lift = smoothNormals(patch);
  patch.verts.forEach((v, i) => {
    v.bind = add(v.bind, scale(lift[i], 0.0008));
    v.rest = applySkin(v.skin, v.bind);
  });
  // Her cleavage, drawn on: her body is a few flat faces there with no dip of its own to show. A soft shadow down her middle,
  // fading in from a little above the fullest part of her bust (the furthest-forward point of her chest either side).
  let apex = null;
  for (const v of verts) {
    const r = v.rest;
    const dx = Math.abs(r[0] - x0);
    if (dx > 0.04 && dx < 0.12 && r[1] < vee.top && r[1] > vee.top - 0.25 && (!apex || r[2] > apex[2])) apex = r;
  }
  const from = apex ? apex[1] + 0.09 : -Infinity;
  patch.shade = patch.verts.map((v) => {
    const across = Math.max(0, 1 - Math.abs(v.rest[0] - x0) / p.cleavageWidth);
    const cleft = 1 - p.cleavage * across * smooth01((from - v.rest[1]) / 0.04);
    return cleft * (1 - p.veeShadow * (1 - smooth01(vee.field(v) / 0.008)));
  });
  return patch;
}

/**
 * A button as a turned profile (radius, height) round an axis: a raised rim, a dished face with four holes, and a bevel
 * underneath. Returns rest-frame points and triangles for one button at `centre`, facing `normal`, with `holes` (triangles for
 * the four dark holes, drawn separately).
 */
export function buttonShape(centre, normal, radius, segments = 18) {
  const n = norm(normal);
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(up, n));
  const w = cross(n, u);
  const at = (r, h, a) => add(add(centre, scale(n, h)), add(scale(u, r * Math.cos(a)), scale(w, r * Math.sin(a))));
  // The profile from the middle out and down: dish, rim, outer edge, underside.
  const R = radius;
  const profile = [
    [0, 0.0016],
    [0.45 * R, 0.0017],
    [0.72 * R, 0.0022],
    [0.86 * R, 0.0026],
    [0.97 * R, 0.0022],
    [R, 0.0012],
    [0.92 * R, 0],
  ];
  const points = [];
  const tris = [];
  for (let s = 0; s < segments; s++) {
    const a = (s / segments) * Math.PI * 2;
    for (const [r, h] of profile) points.push(at(r, h, a));
  }
  const P = profile.length;
  for (let s = 0; s < segments; s++) {
    const s2 = (s + 1) % segments;
    for (let k = 0; k < P - 1; k++) {
      const a = s * P + k;
      const b = s * P + k + 1;
      const c = s2 * P + k;
      const d = s2 * P + k + 1;
      tris.push([a, b, c], [b, d, c]);
    }
  }
  // Four holes, as small dark discs just above the dish.
  const holes = [];
  const holeTris = [];
  for (let q = 0; q < 4; q++) {
    const a = Math.PI / 4 + (q * Math.PI) / 2;
    const c = add(centre, add(scale(n, 0.00175), add(scale(u, 0.3 * R * Math.cos(a)), scale(w, 0.3 * R * Math.sin(a)))));
    const base = holes.length;
    holes.push(c);
    for (let s = 0; s < 6; s++) {
      const b = (s / 6) * Math.PI * 2;
      holes.push(add(c, add(scale(u, 0.12 * R * Math.cos(b)), scale(w, 0.12 * R * Math.sin(b)))));
    }
    for (let s = 0; s < 6; s++) holeTris.push([base, base + 1 + s, base + 1 + ((s + 1) % 6)]);
  }
  return { points, tris, holes, holeTris };
}
