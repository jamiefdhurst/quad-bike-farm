// The girls' knitted tops, the polo and the barn jumper, as garments over her body rather than colour painted on it (see
// docs/decisions/girls.md, "The polo as a garment"). Pure: it takes her body as plain data (garmentMesh.js) and gives back arrays.
//
// A top is her torso and arms, rounded (subdivided) and cut along smooth lines: a round neck at the base of her neck, the
// sleeves square across the arm, and a hem. The edges finish in bands a shade darker, turned in so they have some thickness.
// The polo's sleeves are short and its hem is tucked into her shorts, with a stitched placket and five buttons down the front;
// the jumper reaches her wrists and hangs over her shorts.

import { cleavageShade } from './cleavage.js';
import {
  weld,
  subdivide,
  smoothSkinning,
  cut,
  openEdges,
  smoothNormals,
  rayHit,
  inTriangle,
  applySkin,
  applySkinDir,
  unskin,
  unskinDir,
  blendWeights,
  vec,
} from './garmentMesh.js';

const { sub, add, scale, dot, norm, cross, lerp } = vec;
const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

// What sets one knitted top apart from another; POLO and JUMPER below.
export const POLO = {
  ease: 0.007, // how far the shirt stands off her body (m)
  round: 0.75, // how far the subdivided shirt rounds out between the body's corners (0 flat, 1 full)
  armRound: 0.25, // less on the arms, whose few long triangles would balloon
  skinSmoothing: 4, // passes evening out its bone weights between neighbours, so it bends without creasing
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
  // The placket: a strip down the front from the neck with five buttons, ending `placketPastBust` below the bottom of her bust
  // (placketLength is for a body without one), the buttons spread evenly down it.
  placket: true,
  placketLength: 0.215,
  placketPastBust: 0.015,
  placketWidth: 0.024,
  placketLift: 0.0022, // how far it stands proud of the shirt
  // How far down the placket each button is (m), from where the shirt meets her neck. The top one is above it, on the collar's
  // stand (buttoned right up); the rest are spaced evenly down from it.
  buttons: [-0.005, 0.0459, 0.0968, 0.1476, 0.1985],
  topButtonOpen: 0.006, // undone, a top button that sits on the placket (not the collar's stand) is at least this far below its top
  topButtonSink: 0.0025, // one on the collar's stand sits this far back from the shirt's face, as the stand leans in towards her neck
  // A little embroidered logo on her left chest, as a brand's would be: centred this far across from her middle and down from
  // where the shirt meets her neck, this wide and high.
  logo: { across: 0.07, down: 0.072, width: 0.025, height: 0.018, lift: 0.0007 },
  buttonRadius: 0.0052,
  buttonShade: 0.72, // buttons a shade darker than the shirt
  open: 0, // how many buttons from the top are undone (dealt for each farm between the girl's limits)
  veeWidths: [0, 0.018, 0.024, 0.03, 0.037, 0.045], // an open neck's V: half its width at the neckline, by buttons undone
  veeBows: [1, 1, 0.92, 0.8, 0.6, 0.5], // and how its sides curve out (below 1), opening round her bust the further it's undone
  veeStop: 0.009, // and where it stops, this far above the first button done up (all undone: the bottom of the placket)
  cleavage: 0.5, // with the neck open down to her bust, how dark the soft shadow down the middle is
  veeShadow: 0.18, // and the shadow along the V's edges, where the shirt's fronts stand over her skin
  cleavageWidth: 0.007, // either side of her middle
  bustRound: 0.38, // and each breast shaded darker away from its fullest point (towards her middle and underneath), so the two
  bustRadius: 0.075, // read as rounded shapes rather than flat faces with a line down them; over about this far
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

// The wax jacket from the barn, over the polo and the jumper: roomy, to the wrist, done up two thirds of the way with studs down
// a storm flap so the V at the top shows what she has on under it, and below her hips a skirt of its own (her body's triangles
// there are her legs'). Its corduroy collar is collar.js on its neck edge (COAT_COLLAR); the hood is hood.js.
export const COAT = {
  ...JUMPER,
  ease: 0.034, // just clear of the jumper (2.6 cm), so it hangs rather than balloons
  bare: /(Left|Right)Leg$|Foot|Toe|Hand[A-Z]/, // the tops of her thighs are kept: the bottom of her backside is theirs, and left out it notched the hem
  // Rounded as the jumper is: rounded less, its faces lie flatter between her corners than the jumper's and it comes through.
  neckBack: 0.022,
  neckSide: 0.02,
  neckFront: -0.01,
  neckRing: 0.06,
  neckCap: 0.045,
  neckBand: 0.012,
  neckEase: 0.03,
  sleeveLength: 0.95,
  sleeveEase: 0.026,
  sleeveFlare: 0.025,
  cuff: 0.04,
  cuffEase: 0.016,
  hemDrop: 0.08,
  hemBand: 0,
  hangSlope: 0.18, // as the jumper's (any less and the jumper would come through under the bust)
  hangMax: 0.05,
  bandShade: 0.9,
  insideShade: 0.4,
  lips: ['neck', 'sleeve', 'hem'],
  skirt: 0.05, // below the body's hem, straight down this far: hip length, a Bedale rather than a long Beaufort
  skirtFlare: 0, // and out this much at the bottom
  skirtLeg: 0.45, // how much of the skirt's bottom moves with her thighs, so it rides up over her lap when she sits
  placket: true,
  placketToHem: 0.025, // the storm flap runs down to this far above the hem, however long she is
  placketWidth: 0.034,
  placketLift: 0.004,
  studs: 7, // spaced evenly from the first down to near the bottom of the flap
  buttons: [0.02], // the first stud, from the top of the neck
  topButtonOpen: 0.02,
  buttonRadius: 0.0085,
  buttonColour: '#c9a95c', // brass studs
  placketShade: 0.62, // the storm flap a shade darker than the coat, so the line down the front shows
  buttonHoles: false,
  slits: false,
  veeMeasured: true,
  inset: false, // what shows in the V is what she has on under it, not her skin
  open: 2, // done up two thirds: the top two studs undone
  veeWidths: [0, 0.035, 0.055, 0.065, 0.07, 0.075, 0.08, 0.085],
  veeBows: [1, 1, 0.85, 0.8, 0.75, 0.7, 0.7, 0.7],
  veeStop: 0.015,
  logo: null,
  roughness: 0.42, // waxed cotton has a dull sheen
};

// A plaid flannel shirt buttoned up in place of the polo: a proper shirt, untucked over the shorts, its long sleeves rolled to just
// below the elbow in a thick turn-up, buttons all the way down its front to the hem with the top few undone as her polo's would be.
// The check is drawn by the material (outfit.js), laid on her stored shape so it runs straight across her and along her arms.
export const PLAID = {
  ...POLO,
  ease: 0.009,
  neckBack: 0.018,
  neckSide: 0.016,
  neckFront: -0.006,
  neckBand: 0.006,
  neckEase: 0.006,
  sleeveFrom: 'ForeArm',
  sleeveLength: 0.3, // rolled to just below the elbow
  sleeveEase: 0.012,
  sleeveFlare: 0.016,
  cuff: 0.055, // the rolled-up turn-up
  cuffEase: 0.017, // thick, but inside the jumper's sleeve (2.1 cm off her) when she has one on
  bandShade: 0.86,
  tucked: false,
  hemDrop: 0.07,
  hemBand: 0,
  hemEase: null,
  hangSlope: 0.25,
  hangMax: 0.04,
  lips: ['neck', 'sleeve', 'hem'],
  placket: true,
  placketToHem: 0.015,
  placketWidth: 0.026,
  placketShade: 1,
  studs: 8,
  buttons: [-0.008], // done right up, the top button is on the collar's stand, as the polo's
  topButtonOpen: 0.006,
  buttonRadius: 0.0055,
  buttonColour: '#e6e0d0', // pale shirt buttons
  veeWidths: [0, 0.02, 0.03, 0.04, 0.045, 0.05, 0.055, 0.06, 0.065],
  veeBows: [1, 1, 0.9, 0.8, 0.7, 0.6, 0.6, 0.6, 0.6],
  veeStop: 0.01,
  logo: null,
  plaid: true,
  roughness: 0.95,
};


// The plaid shirt buttoned over her polo: roomier than the polo under it, as the over-polo is, and its neck a little lower so her
// polo's neck band and collar stand up out of it (her collar is laid out over the plaid's, outfit.js). The polo shows in its V.
export const PLAID_OVER = {
  ...PLAID,
  ease: 0.0135,
  neckBack: 0.01,
  neckSide: 0.008,
  neckFront: -0.014,
  neckEase: 0.012, // clear of the polo's neck band (0.45 cm off her, 1.1 cm deep)
  sleeveEase: 0.015, // over the polo's sleeves
  inset: false, // what shows in the V is her polo
};

// The plaid shirt worn open over her polo: a little roomier, its fronts hanging apart all the way down so the polo shows.
export const PLAID_OPEN = {
  ...PLAID,
  ease: 0.018,
  sleeveEase: 0.015,
  sleeveFlare: 0.016,
  cuffEase: 0.017, // inside the jumper's sleeve (2.1 cm off her) when she has one on
  neckEase: 0.016,
  open: 99, // every button undone
  veeWidths: [0.075],
  veeBows: [0.55],
  veeNeck: 0.022, // at the collar the fronts are this far either side of her middle, so the collar sits round her neck
  veeDrop: 0.14, // and they fall open over this far down
  veeFloor: 0.055, // to this far either side of her middle, all the way to the hem
  veeMeasured: true, // its fronts laid along the edge as cut on the finished shirt (a wide V moves as the shirt is pushed out)
  inset: false, // what shows between the fronts is her polo
};

// A second polo over her own, white or black, a size bigger: its sleeves a little shorter and its neck a little lower, so her own
// polo's sleeves, neck band and collar show under it. Tucked in over hers.
export const OVER_POLO = {
  ...POLO,
  ease: 0.0135,
  neckBack: 0.01,
  neckSide: 0.008,
  neckFront: -0.014,
  sleeveLength: 0.58,
  sleeveEase: 0.015, // roomy, so hers doesn't come through when her arms go up
  sleeveFlare: 0.017,
  tuckEase: 0.0042,
  blouse: 0.006,
};

// A plain cotton work shirt for a shirt and tie, white or pale blue: tucked in as the polo is, seven small white buttons down a
// placket to the waistband, a chest pocket on her left. Done right up, its long sleeves end in cuffs buttoned at her wrists; its
// collar is a stiff point collar (POINT_COLLAR in collar.js) with the tie (tie.js) under it.
export const SHIRT = {
  ...POLO,
  ease: 0.008,
  bare: /Leg|Foot|Toe|Hand[A-Z]/, // the hand itself may carry the wrist, under the cuff
  neckBack: 0.018,
  neckSide: 0.016,
  neckFront: -0.006,
  neckBand: 0.006,
  neckEase: 0.006,
  sleeveFrom: 'ForeArm',
  sleeveLength: 0.9, // to the wrist
  sleeveEase: 0.016, // roomy enough that her forearm doesn't come through at the elbow when she bends it (sat on a bale)
  sleeveFlare: 0.017,
  cuff: 0.05, // a shirt's cuff, stiff and close round her wrist
  cuffEase: 0.013,
  elbowEase: 0.007, // and more round the elbow, where bending it (sat on a bale) brought her forearm through
  cuffButtons: true, // one button on the outside of each cuff
  bandShade: 0.94, // a cuff is the same cloth, only doubled
  hangSlope: 0.25,
  hangMax: 0.04,
  placket: true,
  placketToHem: 0.045, // down to just above the waistband
  placketWidth: 0.024,
  placketShade: 1,
  studs: 7,
  buttons: [-0.008], // done right up, the top button is on the collar's stand, under the knot
  topButtonOpen: 0.006,
  buttonRadius: 0.0045,
  buttonColour: '#f6f4ee', // small white shirt buttons
  buttonMetal: 0,
  veeWidths: [0, 0.019, 0.026, 0.032, 0.038],
  veeBows: [1, 1, 0.9, 0.8, 0.7],
  veeStop: 0.01,
  logo: null,
  pocket: { across: 0.07, down: 0.07, width: 0.08, height: 0.09, lift: 0.0012, hem: 0.014, shade: 0.9 },
  roughness: 0.8,
};

// Loosened: the top one or two undone and the sleeves rolled to the elbow in a turn-up.
export const SHIRT_ROLLED = { ...SHIRT, sleeveLength: 0.06, sleeveFlare: 0.017, cuff: 0.045, cuffEase: 0.016, cuffButtons: false, bandShade: 0.9 };

// The shirt over her polo: roomier, as the plaid over it is, its neck as high as on its own so its collar stands over the polo's.
const OVER = { ease: 0.0135, neckEase: 0.013, inset: false };
export const SHIRT_OVER = { ...SHIRT, ...OVER, sleeveEase: 0.019, sleeveFlare: 0.019, cuffEase: 0.015 };
export const SHIRT_ROLLED_OVER = { ...SHIRT_ROLLED, ...OVER, sleeveEase: 0.019, cuffEase: 0.018 };

/**
 * Keeps a top's sleeves inside the top worn over it, as she stands. Skinned down from the stored pose (arms out) to her arms
 * hanging, the inside of a sleeve is squeezed, and the outer top, further out, is squeezed more, so the under one's sleeve can
 * come through it there. Each point of `inner` carried by an arm is checked along the line out from the arm's bone through it;
 * if the outer top is nearer than it plus `gap`, it is pulled back in to there (by at most `most`). Changes `inner`'s points
 * (bind and rest) in place and returns how many moved. `body` as for topFields.
 */
export function tuckSleeves(inner, outer, body, { gap = 0.002, most = 0.008 } = {}) {
  const { bones, boneNames } = body;
  let moved = 0;
  for (const side of ['Left', 'Right']) {
    const arm = new RegExp(`^${side}(Arm|ForeArm|Hand)$`);
    const share = (v) => v.weights.reduce((s, [b, w]) => s + (arm.test(boneNames[b]) ? w : 0), 0);
    const from = bones[`${side}Arm`];
    const to = bones[`${side}Hand`];
    const axis = sub(to, from);
    const len2 = dot(axis, axis);
    const onAxis = (p) => add(from, scale(axis, Math.max(0, Math.min(1, dot(sub(p, from), axis) / len2))));
    // Only the outer top's faces near this arm, so each ray tries a few hundred triangles rather than all of them.
    const near = (p) => Math.hypot(...sub(p, onAxis(p))) < 0.12;
    const local = { verts: outer.verts, tris: outer.tris.filter((t) => t.some((i) => near(outer.verts[i].rest))) };
    for (const v of inner.verts) {
      if (share(v) < 0.3) continue;
      const c = onAxis(v.rest);
      const out = sub(v.rest, c);
      const d = Math.hypot(...out);
      if (d < 1e-6) continue;
      const dir = scale(out, 1 / d);
      const hit = rayHit(local, c, dir);
      // A point already tucked sits at exactly hit.t - gap, so allow for rounding or it is moved again on another machine.
      if (!hit || hit.t >= d + gap - 1e-9) continue;
      const rest = add(c, scale(dir, Math.max(d - most, hit.t - gap)));
      v.rest = rest;
      v.bind = unskin(v.skin, rest);
      moved++;
    }
  }
  return moved;
}

/** How many of a girl's polo buttons are undone on this farm: a whole number from `lo` to `hi`, both included. */
export function dealPoloOpen([lo, hi] = [0, 0], random = Math.random) {
  return lo + Math.min(hi - lo, Math.floor(random() * (hi - lo + 1)));
}

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
  if (p.placketToHem != null) {
    // A coat's flap and studs are as long as she is: from the neck to just above the hem.
    const placketLength = body.bones.Neck[1] + p.neckFront - (waist - p.hemDrop - (p.skirt ?? 0)) - p.placketToHem;
    const gap = (placketLength - 0.03 - p.buttons[0]) / (p.studs - 1);
    p = { ...p, placketLength, buttons: Array.from({ length: p.studs }, (_, i) => p.buttons[0] + gap * i) };
  }
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
  // Even out its skinning, so it doesn't crease across her shoulders when her arms reach forward (smoothSkinning).
  if (p.skinSmoothing) smoothSkinning(mesh, p.skinSmoothing, 0.5);
  // A placket down past her bust, measured on her (the V is cut to its buttons, so this comes first).
  if (p.placket && p.placketPastBust != null && p.placketToHem == null) p = pastBust(mesh, body, p, F.neckField);
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
    // A long sleeve is squeezed on the inside of a bent elbow, so it has a little more room there (from the elbow, `s` 0).
    if (p.elbowEase && p.sleeveFrom === 'ForeArm') arm += p.elbowEase * Math.exp(-((sl.s(v) / 0.05) ** 2));
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
  if (p.skirt) addSkirt(mesh, body, p);

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
  const placket = p.placket ? buildPlacket({ verts: mesh.verts, tris: mesh.tris }, body, p, vee) : null;
  const logo = placket && p.logo ? buildLogo({ verts: mesh.verts, tris: mesh.tris }, body, p, placket.top) : null;
  const pocket = placket && p.pocket ? buildPocket({ verts: mesh.verts, tris: mesh.tris }, body, p.pocket, placket.top) : null;
  const cuffButtons = p.cuffButtons ? buildCuffButtons(mesh, body, p, F) : [];
  return { shell, shade, vee, placket, logo, pocket, cuffButtons };
}

/**
 * A button on the outside of each cuff, as she stands with her arms down: on the cuff's middle, on the side of her wrist away
 * from her body. Each { centre, normal, anchor, on } as the placket's, `on` the sleeve's faces round it.
 */
function buildCuffButtons(mesh, body, p, F) {
  const x0 = body.bones.Neck[0];
  const out = [];
  // Only points of the sleeve itself: a cut leaves the points it cut away in the list, and a button on one stood off the cuff.
  const used = new Set(mesh.tris.flat());
  for (const [side, sl] of [[1, F.left], [-1, F.right]]) {
    // her left is +x as she stands
    const sleeve = [...used].filter((i) => sl.limb(mesh.verts[i]) >= 0.8);
    if (!sleeve.length) continue;
    // Measured from where the sleeve really ends: her right sleeve stops about 4 cm short of the cuff's line, and from the line
    // there was nothing of it to sit on (only a point the cut had left behind, so that button stood off the cuff).
    const end = Math.max(...sleeve.map((i) => sl.field(mesh.verts[i])));
    let best = null;
    for (const i of sleeve) {
      const v = mesh.verts[i];
      const f = sl.field(v) - end;
      if (f > -p.cuff * 0.3 || f < -p.cuff * 0.7) continue;
      const reach = side * (v.rest[0] - x0);
      if (!best || reach > best.reach) best = { v, reach };
    }
    if (!best) continue;
    const normal = norm(applySkinDir(best.v.skin, best.v.normal));
    const near = (i) => Math.hypot(...sub(mesh.verts[i].rest, best.v.rest)) < 0.03;
    out.push({ centre: add(best.v.rest, scale(normal, 0.0003)), normal, anchor: best.v, on: { verts: mesh.verts, tris: mesh.tris.filter((t) => t.some(near)) } });
  }
  return out;
}

/**
 * A shirt's chest pocket: a patch laid on the finished shirt on her left chest (rays from in front, as she stands), a hair off
 * it, with a pointed bottom and a turned-down hem along its top. `shade` per point: its stitched edges and hem a shade darker.
 */
export function buildPocket(mesh, body, pk, top) {
  const neck = body.bones.Neck;
  const cx = neck[0] + pk.across; // her left
  const cy = top - pk.down - pk.height / 2;
  const near = (v) => Math.abs(v.rest[0] - cx) < pk.width && v.rest[2] > neck[2] && Math.abs(v.rest[1] - cy) < pk.height;
  const front = { verts: mesh.verts, tris: mesh.tris.filter((t) => t.some((i) => near(mesh.verts[i]))) };
  const cols = 7;
  const rows = 9;
  const verts = [];
  const shade = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1); // 0 at the top
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1) - 0.5;
      // The bottom comes to a shallow point, as a work shirt's does.
      const x = cx + u * pk.width;
      const y = cy + pk.height / 2 - t * pk.height + (t === 1 ? Math.abs(u) * 0.02 : 0);
      const h = rayHit(front, [x, y, neck[2] + 0.6], [0, 0, -1]);
      if (!h) return null;
      const v = inTriangle(front, h.tri, h.bary);
      const rest = add(v.rest, scale(norm(applySkinDir(v.skin, v.normal)), pk.lift));
      verts.push({ ...v, bind: unskin(v.skin, rest), rest });
      const edge = r === rows - 1 || c === 0 || c === cols - 1;
      shade.push(edge || pk.height * t < pk.hem ? pk.shade : 1);
    }
  }
  const tris = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      tris.push([a, a + cols, a + 1], [a + 1, a + cols, a + cols + 1]);
    }
  }
  return { verts, tris, shade };
}

/**
 * A coat's skirt: the cloth carried on down from the hem as she stands, flaring a little, so it reaches below her hips where her
 * body's triangles are her legs'. Each column keeps the skinning of the hem point it hangs from, blended towards her thigh's
 * further down (`skirtLeg`), so when she sits the front rides up over her lap rather than her thighs coming through it. The new
 * bottom edge is the hem now.
 */
function addSkirt(mesh, body, p) {
  const { boneNames, bones } = body;
  const neck = bones.Neck;
  const edges = openEdges(mesh).filter(([a, b]) => mesh.verts[a].edge === 'hem' && mesh.verts[b].edge === 'hem');
  if (!edges.length) return;
  // A point her thigh carries alone, at its top, for each side: its skin is the thigh's.
  const thigh = {};
  for (const side of ['Left', 'Right']) {
    const name = `${side}UpLeg`;
    for (const v of body.verts) {
      const w = v.weights.reduce((s, [b, k]) => s + (boneNames[b] === name ? k : 0), 0);
      if (w > 0.95 && (!thigh[side] || v.rest[1] > thigh[side].rest[1])) thigh[side] = v;
    }
  }
  const rows = 3;
  const columns = new Map();
  const column = (i) => {
    if (columns.has(i)) return columns.get(i);
    const v = mesh.verts[i];
    const dx = v.rest[0] - neck[0];
    const dz = v.rest[2] - neck[2];
    const r = Math.hypot(dx, dz) || 1;
    const leg = thigh[dx > 0 ? 'Left' : 'Right']; // her left is +x as she stands
    const ids = [i];
    for (let k = 1; k <= rows; k++) {
      const t = k / rows;
      const flare = p.skirtFlare * t * t;
      const rest = [v.rest[0] + (dx / r) * flare, v.rest[1] - p.skirt * t, v.rest[2] + (dz / r) * flare];
      const share = leg ? p.skirtLeg * t : 0;
      const skin = share ? lerp(v.skin, leg.skin, share) : v.skin;
      const weights = share ? blendWeights(v.weights, leg.weights, share) : v.weights;
      mesh.verts.push({ ...v, bind: unskin(skin, rest), rest, skin, weights, edge: k === rows ? 'hem' : undefined, outside: undefined });
      ids.push(mesh.verts.length - 1);
    }
    columns.set(i, ids);
    return ids;
  };
  for (const [a, b] of edges) {
    const A = column(a);
    const B = column(b);
    for (let k = 0; k < rows; k++) mesh.tris.push([B[k], A[k], A[k + 1]], [B[k], A[k + 1], B[k + 1]]);
  }
  for (const i of columns.keys()) mesh.verts[i].edge = undefined;
}

/**
 * The placket made long enough to end `placketPastBust` below the bottom of her bust, its buttons spread evenly down it from the
 * top one: the bottom of her bust is the lowest 1 cm band, below its fullest point, where her front still stands more than halfway
 * out from her chest to that point (across the middle of either breast). A body without a bust keeps `placketLength`.
 */
function pastBust(mesh, body, p, neckField) {
  const neck = body.bones.Neck;
  const bands = new Map();
  for (const { rest: [x, y, z] } of body.verts) {
    const dx = Math.abs(x - neck[0]);
    if (dx < 0.03 || dx > 0.09 || z < neck[2]) continue;
    const k = Math.round((neck[1] - y) * 100);
    bands.set(k, Math.max(bands.get(k) ?? -Infinity, z));
  }
  const near = [...bands.entries()].filter(([k]) => k >= 8 && k <= 20);
  const chest = [...bands.entries()].filter(([k]) => k >= 24 && k <= 30).map(([, z]) => z);
  if (!near.length || !chest.length) return p;
  const [tipBand, tip] = near.reduce((a, b) => (b[1] > a[1] ? b : a));
  const back = Math.min(...chest);
  if (tip - back < 0.03) return p;
  const bottom = Math.max(...[...bands.entries()].filter(([k, z]) => k >= tipBand && k <= 28 && z > (tip + back) / 2).map(([k]) => k));
  const top = neckTop(mesh, body, p, neckField);
  if (top === null) return p;
  const placketLength = top - (neck[1] - bottom / 100) + p.placketPastBust;
  const [first] = p.buttons;
  const stretch = (placketLength - (p.placketLength - p.buttons.at(-1)) - first) / (p.buttons.at(-1) - first);
  return { ...p, placketLength, buttons: p.buttons.map((d) => first + (d - first) * stretch) };
}

/** The round neckline's height at the middle of her front, found by rays from in front on the rounded shirt before it's cut. */
function neckTop(mesh, body, p, neckField) {
  const neck = body.bones.Neck;
  const x0 = neck[0];
  const near = (v) => Math.abs(v.rest[0] - x0) < 0.05 && v.rest[2] > neck[2] && v.rest[1] > neck[1] - 0.15;
  const front = { verts: mesh.verts, tris: mesh.tris.filter((t) => t.some((i) => near(mesh.verts[i]))) };
  for (let y = neck[1] + p.neckCap + 0.005; y > neck[1] - 0.1; y -= 0.001) {
    const h = rayHit(front, [x0, y, neck[2] + 0.6], [0, 0, -1]);
    if (h && neckField(inTriangle(front, h.tri, h.bary)) <= 0) return y;
  }
  return null;
}

/**
 * The V of an open neck, worked out on the rounded shirt before it's cut: `top`, the round neckline's height at the middle of
 * her front; `bottom`, just above the first button done up; `halfWidth(y)`, how far either side of the middle it reaches at a
 * height; `field`, above 0 inside the V (only on her front, so her back is never cut by it).
 */
function openNeck(mesh, body, p, neckField) {
  const neck = body.bones.Neck;
  const x0 = neck[0];
  const top = neckTop(mesh, body, p, neckField);
  if (top === null) return null;
  const open = Math.min(p.open, p.buttons.length);
  const bottom = top - (open === p.buttons.length ? p.placketLength - 0.004 : p.buttons[open] - p.veeStop);
  const width = p.veeWidths[Math.min(open, p.veeWidths.length - 1)];
  const bow = p.veeBows[Math.min(open, p.veeBows.length - 1)];
  // Below its point the field carries on falling as a straight V would, so nothing there sits on the edge of being cut.
  const closing = (y) => (y <= bottom ? (width * (y - bottom)) / (top - bottom) : width * ((y - bottom) / (top - bottom)) ** bow);
  // An overshirt worn open: nearly together at the collar (`veeNeck`), falling open over `veeDrop` to `veeFloor` either side of her
  // middle, and staying that far apart all the way down to the hem rather than meeting at the bottom.
  const hanging = (y) => p.veeNeck + (p.veeFloor - p.veeNeck) * smooth01((top - y) / p.veeDrop);
  const halfWidth = p.veeFloor ? (p.veeNeck != null ? hanging : (y) => Math.max(p.veeFloor, closing(y))) : closing;
  const field = (v) => Math.min(halfWidth(v.rest[1]) - Math.abs(v.rest[0] - x0), v.rest[2] - neck[2] - 0.03);
  return { top, bottom, halfWidth, field };
}

// The logo's embroidery threads, all coloured; the one that stands out most from the shirt is used.
export const LOGO_THREADS = ['#22335e', '#1e4a33', '#7a1f2b', '#d1a93a']; // navy, bottle green, burgundy, gold

/** The logo's thread for a shirt of colour `[r, g, b]` (0 to 1, as displayed): the one furthest from it, weighted as the eye is. */
export function logoThread([r, g, b]) {
  const rgb = (hex) => [0, 2, 4].map((k) => parseInt(hex.slice(1 + k, 3 + k), 16) / 255);
  const far = (hex) => {
    const [R, G, B] = rgb(hex);
    return 2 * (R - r) ** 2 + 4 * (G - g) ** 2 + 3 * (B - b) ** 2;
  };
  return LOGO_THREADS.reduce((a, c) => (far(c) > far(a) ? c : a));
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
  const reach = Math.max(0.3, p.placketLength + 0.05);
  const wide = 0.07 + (vee ? Math.max(0, vee.halfWidth(vee.top)) : 0);
  // Her sides too: a wide open front's edges come round towards them at the waist.
  const near = (v) => Math.abs(v.rest[0] - x0) < wide && v.rest[2] > neck[2] - (vee ? 0.08 : 0) && v.rest[1] > neck[1] - reach;
  const front = { verts: mesh.verts, tris: mesh.tris.filter((t) => t.some((i) => near(mesh.verts[i]))) };
  const hitAt = (x, y) => {
    // A hair off her middle: split down it, a ray exactly there can fall between the triangles either side.
    const h = rayHit(front, [x + 1e-6, y, neck[2] + 0.6], [0, 0, -1]);
    return h && inTriangle(front, h.tri, h.bary);
  };
  // Where the neckline is at the middle of her front (or at the top of the V): walk down until a ray from in front hits.
  const found = vee ? vee.top : frontTop(hitAt, x0, neck[1] + p.neckCap + 0.005, neck[1] - 0.1);
  if (found === null) return null;
  const top = found - 0.0003; // right up to where the shirt meets her neck
  if (p.placketToHem != null) {
    // A coat's flap runs from here to just above its hem, its studs spread down it from the first done up (at the V's point).
    const placketLength = top - (body.waist - p.hemDrop - (p.skirt ?? 0)) - p.placketToHem;
    const allOpen = vee && p.open >= p.studs;
    const open = vee && !allOpen ? Math.min(p.open, p.studs - 1) : 0;
    const first = vee && !allOpen ? top - vee.bottom + p.veeStop : p.buttons[0];
    const below = (placketLength - 0.03 - first) / Math.max(1, p.studs - 1 - open);
    const above = open ? (first - p.buttons[0]) / open : 0;
    const buttons = Array.from({ length: p.studs }, (_, i) => (i < open ? p.buttons[0] + above * i : first + below * (i - open)));
    p = { ...p, placketLength, buttons };
  }
  // How far either side of the middle the V's edge is. A coat stands so far off her that pushing it out widens the V it was cut
  // with, so its edge is found on the finished coat (`veeMeasured`); the polo's barely moves and keeps the V it was cut to.
  const edgeCache = new Map();
  // Each side on its own: her body isn't quite symmetrical, and a wide V shows it.
  const measured = (y, side) => {
    const k = `${Math.round(y * 1e4)},${side}`;
    if (!edgeCache.has(k)) {
      let d = Math.max(0, vee.halfWidth(y));
      while (d < 0.2 && !hitAt(x0 + side * d, y)) d += 0.0005;
      edgeCache.set(k, d + 0.001);
    }
    return edgeCache.get(k);
  };
  const split = (y, side = 1) => (!vee ? 0 : p.veeMeasured && vee.halfWidth(y) > 0 ? measured(y, side) : Math.max(0, vee.halfWidth(y)));
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
  const closed = !(vee && p.open >= p.buttons.length) && vBottom - bottom > 0.008;
  const halfCaps = closed ? ['top'] : ['top', 'bottom'];
  const ok =
    (!closed || strip(vBottom, bottom, () => [x0 - w / 2, x0 + w / 2], 0, 1, 5, vee ? ['bottom'] : ['top', 'bottom'])) &&
    (!vee ||
      (strip(top, closed ? vBottom : bottom, (y) => [x0 + split(y), x0 + split(y) + w / 2], 0.5, 1, 3, halfCaps) &&
        strip(top, closed ? vBottom : bottom, (y) => [x0 - split(y, -1) - w / 2, x0 - split(y, -1)], 0, 0.5, 3, halfCaps)));
  if (!ok) return null;

  // The buttons, and for the undone ones the buttonhole on the other half. Those on the strip lie on it (`on`, onCloth).
  const strips = { verts, tris };
  const buttons = [];
  const slits = [];
  p.buttons.forEach((d0, i) => {
    const undone = vee && i < p.open;
    if (d0 < 0) {
      // On the collar's stand, which stands straight up from the shirt's top edge here (collar.js): just off the shirt's face.
      // Undone, it stays at the height it has done up, on its own half's end of the stand, with its buttonhole on the other
      // (or, with no shirt under that end, down on its half of the placket as before).
      const on = (x) => {
        const at = rowAt(top, x, x, 1);
        return at && { centre: [x, top - d0, at.under[0].rest[2] - 0.0005 - (p.topButtonSink ?? 0)], normal: norm([0, 0.35, 1]), anchor: at.under[0] };
      };
      const b = undone ? on(x0 + split(top) + w / 4) : on(x0);
      if (b || !undone) {
        if (b) buttons.push(b);
        const h = undone && on(x0 - split(top, -1) - w / 4);
        if (h) slits.push(h);
        return;
      }
    }
    const d = undone ? Math.max(d0, p.topButtonOpen) : d0;
    const y = top - d;
    const open = undone && (y > vBottom || !closed);
    // On the strip's own face (which bridges the shirt's dips), not on the shirt under it.
    const at = (x, [xL, xR, n]) => {
      const face = rowAt(y, xL, xR, n);
      const under = rowAt(y, x, x, 1);
      return face && under && { centre: [x, y, face.z], normal: restNormal(under.under[0]), anchor: under.under[0], on: strips };
    };
    const b = open ? at(x0 + split(y) + w / 4, [x0 + split(y), x0 + split(y) + w / 2, 3]) : at(x0, [x0 - w / 2, x0 + w / 2, 5]);
    if (b) buttons.push(b);
    const h = open && at(x0 - split(y, -1) - w / 4, [x0 - split(y) - w / 2, x0 - split(y), 3]);
    if (h) slits.push(h);
  });
  return { verts, tris, uv, buttons, slits, top };
}

/**
 * The logo's patch: a small grid laid on the finished shirt on her left chest (rays from in front, as she stands), lifted a hair
 * off it and carried back to the stored pose through the shirt's skin where each point lies. `uv` maps the drawing on to it.
 */
function buildLogo(mesh, body, p, top) {
  const neck = body.bones.Neck;
  const { across, down, width, height, lift } = p.logo;
  const cx = neck[0] + across; // her left is +x as she stands
  const cy = top - down;
  const near = (v) => Math.abs(v.rest[0] - cx) < 0.05 && v.rest[2] > neck[2] && Math.abs(v.rest[1] - cy) < 0.05;
  const front = { verts: mesh.verts, tris: mesh.tris.filter((t) => t.some((i) => near(mesh.verts[i]))) };
  const n = 5;
  const verts = [];
  const uv = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = cx - width / 2 + (width * c) / (n - 1);
      const y = cy + height / 2 - (height * r) / (n - 1);
      const h = rayHit(front, [x, y, neck[2] + 0.6], [0, 0, -1]);
      if (!h) return null;
      const v = inTriangle(front, h.tri, h.bary);
      const rest = add(v.rest, scale(norm(applySkinDir(v.skin, v.normal)), lift));
      verts.push({ ...v, bind: unskin(v.skin, rest), rest });
      uv.push(c / (n - 1), 1 - r / (n - 1));
    }
  }
  const tris = [];
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const a = r * n + c;
      tris.push([a, a + n, a + 1], [a + 1, a + n, a + n + 1]);
    }
  }
  return { verts, tris, uv };
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
 * A button or a buttonhole laid on the cloth it sits on (`b.on`, a { verts, tris } of the placket or the sleeve). `make(centre,
 * normal)` builds its shape (buttonShape, slitShape) facing the way the cloth's face under its middle does, and `lay(points)`
 * carries each of the shape's points down on to the cloth straight under it, at its own height off it, with the skin and weights
 * of that spot: so its whole underside sits on the cloth and bends and moves as the cloth does. Facing the shirt under it (or
 * her body), a flat button stood a few millimetres clear of the placket or cuff on one side. Without cloth under it (on the
 * collar's stand) it keeps `b.anchor`'s skin, as before. `lay` returns { bind, weights } for each point.
 */
export function layOnCloth(b, make, lift = 0.0003) {
  const down = (from, n) => {
    const hit = b.on && rayHit(b.on, add(from, scale(n, 0.01)), scale(n, -1));
    if (!hit) return null;
    const [p0, p1, p2] = hit.tri.map((i) => b.on.verts[i].rest);
    return { v: inTriangle(b.on, hit.tri, hit.bary), face: norm(cross(sub(p1, p0), sub(p2, p0))) };
  };
  const mid = down(b.centre, b.normal);
  if (!mid) {
    return { shape: make(b.centre, b.normal), lay: (points) => points.map((pt) => ({ bind: unskin(b.anchor.skin, pt), weights: b.anchor.weights })) };
  }
  const normal = dot(mid.face, b.normal) < 0 ? scale(mid.face, -1) : mid.face;
  const centre = add(mid.v.rest, scale(normal, lift));
  const lay = (points) =>
    points.map((pt) => {
      const h = dot(sub(pt, centre), normal);
      const under = down(sub(pt, scale(normal, h)), normal)?.v;
      // A point past the cloth's edge (a rim over a turned-down side) keeps the skin of the cloth under its middle.
      const at = under ?? mid.v;
      return { bind: unskin(at.skin, under ? add(under.rest, scale(normal, h + lift)) : pt), weights: at.weights };
    });
  return { shape: make(centre, normal), lay };
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
  const tips = {}; // each breast's fullest point, by side
  for (const v of verts) {
    const r = v.rest;
    const dx = Math.abs(r[0] - x0);
    if (!(dx > 0.04 && dx < 0.12 && r[1] < vee.top && r[1] > vee.top - 0.25)) continue;
    if (!apex || r[2] > apex[2]) apex = r;
    const side = Math.sign(r[0] - x0);
    if (!tips[side] || r[2] > tips[side][2]) tips[side] = r;
  }
  const from = apex ? apex[1] + 0.09 : -Infinity;
  // Rounded: darker with distance from her fullest point on that side, below a little above it (her upper chest stays light).
  const round = (r) => {
    const tip = tips[Math.sign(r[0] - x0)] ?? apex;
    if (!tip || !p.bustRound) return 1;
    const d = Math.hypot(r[0] - tip[0], r[1] - tip[1]);
    return 1 - p.bustRound * smooth01((d - 0.015) / p.bustRadius) * smooth01((tip[1] + 0.05 - r[1]) / 0.04);
  };
  patch.shade = patch.verts.map((v) => {
    const across = v.rest[0] - x0;
    const cleft = cleavageShade(across, from - v.rest[1], { strength: p.cleavage, width: p.cleavageWidth, fade: 0.04 });
    return cleft * round(v.rest) * (1 - p.veeShadow * (1 - smooth01(vee.field(v) / 0.008)));
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
