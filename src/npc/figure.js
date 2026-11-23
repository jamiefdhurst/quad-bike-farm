import * as THREE from 'three';
import { splitBody } from './smoothBody.js';

// Body shape for the companion. The source model is fairly straight up and
// down, so her figure is reshaped at load time: the bust fuller, the waist
// drawn in and the hips widened. The skinned mesh is moved in its bind pose
// with skin weights untouched, so every animation carries the new shape, and
// it happens before the outfit is fitted so the clothes follow it.
//
// The work is done in a body frame: origin at the hips bone, x to her left,
// y up, z to her front, and one unit is the hips-to-neck length, so the
// regions below scale with the model.

const bell = (t) => (Math.abs(t) < 1 ? (1 - t * t) ** 2 : 0);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Regions, in body-frame units.
// Each breast is a dome her front is lifted on to, rather than a push added to her own points: the model has one point at each apex
// and a single ring round it, so pushing those out made a flat-fronted block with a shelf under it. The dome is lifted on to again
// after her body is split (`liftBust`), so the split's extra points lie on the curve and not on a cone between the coarse ones.
export const BUST = {
  reach: 0.13, // sideways radius of each breast's dome from its middle: it ends before her chest turns round to her side, where her
  // points are too far back to be lifted on to it (half lifted, they folded into slashes across it)
  reachUp: 0.2, // above its fullest line
  reachDown: 0.2, // below it
  outward: 0.01, // each breast's middle sits this far further out than the model's apex, so they sit a little apart and face outwards
  lift: 0.105, // how far its apex stands in front of the model's at a bust of 1
  swell: 0.12, // the points it lifts also spread this fraction away from its fullest line, so it is full above and below as well as forward
  drop: 0.025, // a fuller bust sits a little lower: the dome's middle this far down per unit of bust
  frontFrom: 0.05, // only the front of the body is lifted: none at z = frontFrom,
  frontTo: 0.15, // fully at z = frontTo
  domeUp: 0.75, // the upper half's height follows (1 - e) to this power: near 1 a gentle slope down from her collarbone to the apex
  domeDown: 0.38, // the lower half's, under 1 so it holds out round and tucks in at the fold
  edgeUp: 0.55, // and meets her chest over this much of t above (a long, soft join)
  edgeDown: 0.12, // and this little below (the fold under it)
  coreFrom: 0.25, // inside the dome by this much of t, her front is set on to it even where it stood further out (the split's rounding,
  coreTo: 0.5, // the model's own shape), fully by this much, so the middle of it is one clean curve
  valley: 0.72, // between them, down her middle, the dome is this fraction of its height: a shallow dip, not one shelf across her
  sideSwell: 0.4, // the sideways swell, out towards her arms, stronger than the rest so she's fuller at the sides
  grow: 0.45, // a bigger bust (over 1) covers more of her as well as standing out further: its region this much wider and
  // deeper per unit over 1 (and narrower under 1), so a full one is round rather than a point on a narrow base
  centre: 0.15, // points are moved on to it along lines from a point this far behind the apex (times its size), inside her chest
  fullBelow: 0.02, // the dome's fullest line sits this far below the apex (more with size), so the lower half is the fuller one
};
// Each fades out over `reach` above and below its height `y`; the other
// numbers are the fraction it narrows or widens by at full strength.
const WAIST = { y: 0.37, reach: 0.3, narrow: 0.2, flatten: 0.08 };
const HIPS = { y: -0.15, reach: 0.3, widen: 0.15, back: 0.15 };
const SPINE_DEPTH = 0.04; // front-to-back middle of the torso, which the waist and hips scale about
// The model's bottom is a block: one flat plate across both sides, then a shelf straight in to the thighs. Her seat is reshaped as
// two round cheeks: points behind her are moved towards their surfaces, reaching back as far as she did at her fullest and
// curving in to the waist above and the thighs below.
export const SEAT = {
  from: -0.55, // body-frame heights it works between (the hips bone is 0)
  to: 0.2,
  apart: 0.13, // each cheek's middle this far from her middle
  across: 0.27, // its half-width (the model's back has points only down her middle and about 0.22 either side of it)
  up: 0.38, // how far up it reaches from its fullest
  fullAt: 0.4, // its fullest this far up her flat plate from the plate's bottom edge (0 to 1)
  reach: 0.7, // the plate's bottom edge this far down the cheek (0 its fullest, 1 its bottom)
  depth: 0.16, // how far it stands out from its own middle
  amount: 1, // how far each point goes towards it
};

/**
 * Her seat as two round cheeks. `points`: [{ x, y, z }] in the body frame (the hips bone at 0, z to her front). Returns a new z
 * for each, the same for anything not behind her in the seat's heights. Pure.
 */
export function roundSeat(points, p = SEAT) {
  const out = points.map((q) => q.z);
  const seat = points.map((q, i) => ({ ...q, i })).filter((q) => q.z < SPINE_DEPTH - 0.05 && q.y > p.from && q.y < p.to && Math.abs(q.x) < p.apart + p.across);
  if (!seat.length) return out;
  // Where she's fullest, and the top and bottom of her flat plate (as far back, near enough). The cheeks are fullest part way up
  // it, so its bottom edge (the old shirt's hem, overhanging her thighs) curves in under them as the underside of a bottom does.
  const full = seat.reduce((a, q) => (q.z < a.z ? q : a));
  const plate = seat.filter((q) => q.z < full.z + 0.03);
  const bottom = plate.reduce((a, q) => (q.y < a.y ? q : a)).y;
  const top = plate.reduce((a, q) => (q.y > a.y ? q : a)).y;
  const low = bottom + (top - bottom) * p.fullAt;
  // Down from there it reaches past the plate's bottom edge (`reach` of the way down the cheek there), so the edge is inside the
  // cheek all across her, between them as well, and curves in under it.
  const down = Math.max(0.05, (low - bottom) / p.reach);
  const zc = full.z + p.depth;
  for (const q of seat) {
    let target = Infinity;
    for (const side of [-1, 1]) {
      const ex = (q.x - side * p.apart) / p.across;
      const ey = (q.y - low) / (q.y > low ? p.up : down);
      const e = ex * ex + ey * ey;
      if (e < 1) target = Math.min(target, zc - p.depth * Math.sqrt(1 - e));
    }
    if (!Number.isFinite(target)) continue;
    // Faded in from her sides and the ends of the heights it covers, so it meets the rest of her smoothly.
    const fade = smoothstep(p.from, p.from + 0.1, q.y) * (1 - smoothstep(p.to - 0.1, p.to, q.y)) * smoothstep(SPINE_DEPTH - 0.05, SPINE_DEPTH - 0.15, q.z);
    out[q.i] = q.z + (target - q.z) * p.amount * fade;
  }
  return out;
}

/**
 * The bust's dome at a body-frame (x, y): `surface`, where her front reaches there (-Infinity outside it), and `core`, how far
 * inside it the point is (0 at its edge, 1 well in), where her front is set on to the dome even if it stood further out. `apex` is
 * the model's left apex (the right is its mirror). Pure.
 */
export function bustDome(x, y, apex, bust) {
  if (!bust) return { surface: -Infinity, core: 0 };
  const g = Math.max(0.5, 1 + BUST.grow * (bust - 1));
  const across = Math.abs(x) - apex.x - BUST.outward * g;
  // Measured from its fullest line, a little below the apex. Above, its height grows half as fast as its width; below, as fast,
  // so a bigger bust is as round underneath as across rather than wide and shallow.
  const yc = apex.y - BUST.fullBelow * g - BUST.drop * bust;
  const ry = y > yc ? BUST.reachUp * (0.5 + 0.5 * g) : BUST.reachDown * g;
  const v = (y - yc) / ry;
  const e = (across / (BUST.reach * g)) ** 2 + v * v;
  if (e >= 1) return { surface: -Infinity, core: 0 };
  const t = 1 - e;
  // From the top of it to the bottom the profile turns gradually from the gentle upper slope to the round lower half, so there is
  // no ridge along the fullest line. The fold is only under it: round her side, towards her arm, it meets her chest softly.
  const under = smoothstep(0.5, -0.7, v);
  const beneath = smoothstep(-0.2, -0.8, v) * Math.min(1, (v * v) / Math.max(e, 0.05));
  const power = (BUST.domeUp + (BUST.domeDown - BUST.domeUp) * under) / Math.sqrt(g);
  const edge = BUST.edgeUp + (BUST.edgeDown - BUST.edgeUp) * beneath;
  const valley = BUST.valley + (1 - BUST.valley) * smoothstep(0, apex.x, Math.abs(x));
  // It rises from `frontFrom`, behind all of her front it can lift, so wherever it starts to lift her it meets her with no step.
  const height = apex.z + BUST.lift * bust * g - BUST.frontFrom;
  // Down her middle nothing is pushed back on to it: the dip between them is only as deep as she already is there.
  const core = smoothstep(BUST.coreFrom, BUST.coreTo, t) * smoothstep(apex.x * 0.4, apex.x, Math.abs(x));
  return { surface: BUST.frontFrom + height * t ** power * smoothstep(0, edge, t) * valley, core };
}

/** How far forward her front reaches over the bust at a body-frame (x, y), or -Infinity outside it. */
export const bustSurface = (x, y, apex, bust) => bustDome(x, y, apex, bust).surface;

/**
 * The move [dx, dy, dz] that puts a point of her front on the dome: all the way where it falls short of it, and where it stands out,
 * by how far inside the dome it is. It moves along a line from a point inside her chest behind the breast, not straight forward:
 * straight forward, the model's flat shelf under her bust was squashed into slivers on the dome, some turned inside out (slashes
 * across it). Down her middle it moves only forward, so the two sides never cross.
 */
function ontoDome(x, y, z, apex, bust) {
  const front = frontOf(z);
  if (!front || !bust) return [0, 0, 0];
  const along = smoothstep(apex.x * 0.3, apex.x * 0.8, Math.abs(x)); // 0 down her middle: forward only
  const [rx, ry, rz] = along ? alongLine(x, y, z, apex, bust) : [0, 0, 0];
  let fz = 0;
  if (along < 1) {
    const { surface, core } = bustDome(x, y, apex, bust);
    if (surface !== -Infinity) fz = (surface - z) * (surface > z ? 1 : core);
  }
  return [rx * along * front, ry * along * front, (rz * along + fz * (1 - along)) * front];
}

/** The move on to the dome along the line from a point inside her chest behind the breast through this point, or none. */
function alongLine(x, y, z, apex, bust) {
  const none = [0, 0, 0];
  const g = Math.max(0.5, 1 + BUST.grow * (bust - 1));
  const cx = (x < 0 ? -1 : 1) * (apex.x + BUST.outward * g);
  const cy = apex.y - BUST.fullBelow * g - BUST.drop * bust;
  const cz = apex.z - BUST.centre * g;
  const [ux, uy, uz] = [x - cx, y - cy, z - cz];
  if (uz <= 0) return none;
  // How far out along the line the dome is (in multiples of the point's own distance): the dome only rises forward and falls away
  // to its edge, so going out the line crosses it once. Bisected.
  const past = (k) => cz + uz * k - bustDome(cx + ux * k, cy + uy * k, apex, bust).surface;
  let lo = 0.05;
  let hi = 4;
  if (past(lo) > 0 || past(hi) < 0) return none;
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2;
    if (past(mid) < 0) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  // Only her surface near the dome: nothing deep inside her (far short of it, near the centre, where the line's direction means
  // little) or well clear of it is moved; and where she stands out, only by how far inside the dome she is.
  const w = k > 1 ? smoothstep(3.5, 2.5, k) : bustDome(cx + ux * k, cy + uy * k, apex, bust).core * smoothstep(0.5, 0.8, k);
  return w ? [ux * (k - 1) * w, uy * (k - 1) * w, uz * (k - 1) * w] : none;
}

/** How far a point at depth z is part of her front, which the bust lifts (0 behind her, 1 well in front). */
const frontOf = (z) => smoothstep(BUST.frontFrom, BUST.frontTo, z);

/**
 * Offset for one body-frame point. `apex` is the left breast's apex {x, y, z}
 * (the right is its mirror); amounts are 0 for the original shape.
 * @returns {number[]} [dx, dy, dz] in body-frame units
 */
export function figureOffset(x, y, z, apex, { bust = 0, waist = 0, hips = 0 }) {
  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (bust) {
    const side = x < 0 ? -1 : 1;
    const g = Math.max(0.5, 1 + BUST.grow * (bust - 1));
    const across = Math.abs(x) - apex.x;
    const yc = apex.y - BUST.fullBelow * g;
    const ry = y > yc ? BUST.reachUp * (0.5 + 0.5 * g) : BUST.reachDown * g;
    const e = (across / (BUST.reach * g)) ** 2 + ((y - yc) / ry) ** 2;
    const front = frontOf(z);
    if (e < 1 && front > 0) {
      // Spread out from the middle of each a little, sideways (none on her midline, so the two halves meet) and up and down.
      const t = 1 - e;
      const w = t * t * (3 - 2 * t) * front * Math.min(1, bust);
      dx += side * across * BUST.sideSwell * w * g * smoothstep(0, apex.x, Math.abs(x));
      dy += ((y - yc) * BUST.swell * g - BUST.drop * bust) * w; // and down with the dome, so the model's own shelf under it stays under it
    }
    // Then on to the dome, from where she now is.
    const [ox, oy, oz] = ontoDome(x + dx, y + dy, z, apex, bust);
    dx += ox;
    dy += oy;
    dz += oz;
  }

  if (waist) {
    const w = bell((y - WAIST.y) / WAIST.reach) * waist;
    dx -= x * WAIST.narrow * w;
    dz -= (z - SPINE_DEPTH) * WAIST.flatten * w;
  }

  if (hips) {
    const w = bell((y - HIPS.y) / HIPS.reach) * hips;
    dx += x * HIPS.widen * w;
    // A little more behind, none in front.
    dz += (z - SPINE_DEPTH) * HIPS.back * w * smoothstep(SPINE_DEPTH, SPINE_DEPTH - 0.15, z);
  }

  return [dx, dy, dz];
}

/**
 * Sets the points of a split body on to the bust's dome (where they fall short of it, and in its middle), so the split's new points
 * lie on the curve rather than on the flat faces between the coarse ones. `positions` is changed in place; `arm(i)` is how far point
 * i follows her arms (held still), `toBody(positions, i)` gives its body-frame [x, y, z] and `move(positions, i, d)` moves it by a
 * body-frame [dx, dy, dz].
 */
export function liftBust(positions, arm, toBody, move, apex, bust) {
  if (!bust) return;
  for (let i = 0; i < positions.length / 3; i++) {
    const k = 1 - arm(i);
    if (k <= 0) continue;
    const [x, y, z] = toBody(positions, i);
    const [dx, dy, dz] = ontoDome(x, y, z, apex, bust);
    if (dx || dy || dz) move(positions, i, [dx * k, dy * k, dz * k]);
  }
}

/** The character's skinned body mesh. */
function bodyMesh(rig) {
  let mesh = null;
  rig.model.traverse((o) => {
    if (o.isSkinnedMesh && !mesh) mesh = o;
  });
  return mesh;
}

/**
 * Reshapes the rig's body mesh from its original bind pose, so calling it
 * again with new amounts replaces the old shape rather than adding to it.
 * @param {{bust: number, waist: number, hips: number}} amounts  0 = the model as shipped
 */
export function shapeFigure(rig, amounts) {
  const mesh = bodyMesh(rig);
  if (!mesh) return;
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  // A body split at load (smoothBody.js) is shaped on the model's own points, then split again: shaped point by point, the split's
  // extra points would pick out every edge of the shaping (under her bust, round her seat) that the model's few points step over.
  const coarse = geo.userData.coarse;
  if (!coarse && !geo.userData.bindPositions) geo.userData.bindPositions = pos.array.slice();
  const original = coarse ? coarse.positions : geo.userData.bindPositions;
  const count = original.length / 3;

  // Bone bind positions are in the same space as the vertices.
  const sk = mesh.skeleton;
  const bindPos = (name) => {
    const i = sk.bones.findIndex((b) => b.name === name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert());
  };
  const hips = bindPos('Hips');
  const neck = bindPos('Neck');
  const leftArm = bindPos('LeftArm');
  const rightArm = bindPos('RightArm');
  if (!hips || !neck || !leftArm || !rightArm) return;
  const unit = neck.distanceTo(hips);
  const up = neck.clone().sub(hips).normalize();
  const left = leftArm.sub(rightArm);
  left.addScaledVector(up, -left.dot(up)).normalize();
  const front = new THREE.Vector3().crossVectors(left, up);

  const p = new THREE.Vector3();
  const toBody = (i) => {
    p.fromArray(original, i * 3).sub(hips);
    return [p.dot(left) / unit, p.dot(up) / unit, p.dot(front) / unit];
  };

  // Arms are left alone: their weight on a vertex holds it still.
  const armBones = new Set(sk.bones.map((b, i) => (/Arm|Hand/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const skinIndex = coarse ? coarse.skinIndex : geo.attributes.skinIndex.array;
  const skinWeight = coarse ? coarse.skinWeight : geo.attributes.skinWeight.array;
  const armShare = (index, weight, i) => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (armBones.has(index[i * 4 + k])) w += weight[i * 4 + k];
    return Math.min(1, w);
  };
  const armWeight = (i) => armShare(skinIndex, skinWeight, i);
  // Any point of a positions array in the body frame, and a move in the body frame (in body units) put back on to it.
  const toBodyAt = (arr, i) => {
    p.fromArray(arr, i * 3).sub(hips);
    return [p.dot(left) / unit, p.dot(up) / unit, p.dot(front) / unit];
  };
  const fromBodyMove = (arr, i, [dx, dy, dz]) =>
    p.fromArray(arr, i * 3).addScaledVector(left, dx * unit).addScaledVector(up, dy * unit).addScaledVector(front, dz * unit).toArray(arr, i * 3);

  // The bust's apex is the frontmost point of the chest on her left.
  let apex = null;
  for (let i = 0; i < count; i++) {
    const [x, y, z] = toBody(i);
    if (x > 0.02 && x < 0.4 && y > 0.55 && y < 0.9 && (!apex || z > apex.z)) apex = { x, y, z };
  }
  if (!apex) return;

  const moved = [];
  for (let i = 0; i < count; i++) {
    const [x, y, z] = toBody(i);
    const [dx, dy, dz] = figureOffset(x, y, z, apex, amounts);
    const k = 1 - armWeight(i);
    moved.push({ x: x + dx * k, y: y + dy * k, z: z + dz * k, k });
  }
  // Her seat rounded, on the reshaped figure (the model's bottom is a block with a shelf under it).
  const seat = amounts.seat === 0 ? moved.map((q) => q.z) : roundSeat(moved);
  const shaped = new Float32Array(original.length);
  for (let i = 0; i < count; i++) {
    const q = moved[i];
    const [x, y, z] = toBody(i);
    const dz = q.z - z + (seat[i] - q.z) * q.k;
    p.fromArray(original, i * 3)
      .addScaledVector(left, (q.x - x) * unit)
      .addScaledVector(up, (q.y - y) * unit)
      .addScaledVector(front, dz * unit);
    p.toArray(shaped, i * 3);
  }
  if (coarse) {
    const split = splitBody({ ...coarse, positions: shaped }, { rounded: (t) => coarse.rounded[t] === 1 });
    liftBust(split.positions, (i) => armShare(split.skinIndex, split.skinWeight, i), toBodyAt, fromBodyMove, apex, amounts.bust);
    pos.array.set(split.positions);
  } else pos.array.set(shaped);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  // The skinned bounds are recomputed from the new shape on next use.
  mesh.boundingBox = null;
  mesh.boundingSphere = null;
}
