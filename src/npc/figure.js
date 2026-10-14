import * as THREE from 'three';

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
const BUST = {
  reach: 0.185, // sideways radius of each breast's region from its apex (a full bust is wide, not just forward)
  reachUp: 0.2, // above the apex
  reachDown: 0.2, // below it, a bit further so the shirt hangs from the bust
  forward: 0.1, // the whole region moves forward this much
  swell: 0.25, // and swells by this fraction away from a point inside the chest
  depth: 0.17, // that point is this far behind the apex
  drop: 0.03, // a fuller bust sits a little lower
  frontFrom: 0.0, // only the front of the body moves: none at z = frontFrom,
  frontTo: 0.15, // fully at z = frontTo
  dome: 0.3, // the forward push follows (1 - e) to this power: under 1 a rounder dome, full across the middle and falling away
  // at the edge, rather than tapering to a point at the apex
  sideSwell: 0.4, // the sideways swell, out towards her arms, stronger than the rest so she's fuller at the sides
  grow: 0.45, // a bigger bust (over 1) covers more of her as well as standing out further: its region this much wider and
  // deeper per unit over 1 (and narrower under 1), so a full one is round rather than a point on a narrow base
  fullBelow: 0.03, // the dome's fullest line sits this far below the apex (more with size), so the lower half is the fuller one
  domeUnder: 0.16, // below that line the push holds out longer (a lower power than `dome`) before tucking in at the fold
  foldEdge: 0.3, // and meets the body over a shorter edge underneath than above (the smoothstep's reach in t)
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
 * Offset for one body-frame point. `apex` is the left breast's apex {x, y, z}
 * (the right is its mirror); amounts are 0 for the original shape.
 * @returns {number[]} [dx, dy, dz] in body-frame units
 */
export function figureOffset(x, y, z, apex, { bust = 0, waist = 0, hips = 0 }) {
  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (bust) {
    // Each side swells about its own apex. The regions overlap a little in
    // the middle, so the shirt still dips slightly between them.
    const side = x < 0 ? -1 : 1;
    const across = Math.abs(x) - apex.x;
    const g = Math.max(0.5, 1 + BUST.grow * (bust - 1)); // how much bigger its region is, with the bust
    // Measured from its fullest line, a little below the apex. Above, its height grows half as fast as its width; below, as fast,
    // so a bigger bust is as round underneath as across rather than wide and shallow.
    const yc = apex.y - BUST.fullBelow * g;
    const ry = y > yc ? BUST.reachUp * (0.5 + 0.5 * g) : BUST.reachDown * g;
    const e = (across / (BUST.reach * g)) ** 2 + ((y - yc) / ry) ** 2;
    if (e < 1) {
      const t = 1 - e;
      const front = smoothstep(BUST.frontFrom, BUST.frontTo, z) * bust;
      const w = t * t * (3 - 2 * t) * front;
      // The forward push is domed, so the breast is round rather than conical; it still meets the body smoothly at the edge.
      // Underneath (blended in over a short way below the fullest line, so there is no step) it holds out longer and tucks in
      // over a shorter edge; and the bigger it is the rounder the dome.
      const under = smoothstep(0, 0.08, yc - y);
      const power = (BUST.dome + (BUST.domeUnder - BUST.dome) * under) / Math.sqrt(g);
      const edge = 0.5 + (BUST.foldEdge - 0.5) * under;
      const dome = t ** power * smoothstep(0, edge, t) * front;
      // No sideways swell on the midline, so the two halves meet.
      dx += side * across * BUST.sideSwell * w * smoothstep(0, apex.x, Math.abs(x));
      dy += ((y - apex.y) * BUST.swell - BUST.drop) * w;
      dz += BUST.forward * dome * g + (z - apex.z + BUST.depth * g) * BUST.swell * w;
    }
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
  if (!geo.userData.bindPositions) geo.userData.bindPositions = pos.array.slice();
  const original = geo.userData.bindPositions;

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
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  const armWeight = (i) => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (armBones.has(skinIndex.getComponent(i, k))) w += skinWeight.getComponent(i, k);
    return Math.min(1, w);
  };

  // The bust's apex is the frontmost point of the chest on her left.
  let apex = null;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = toBody(i);
    if (x > 0.02 && x < 0.4 && y > 0.55 && y < 0.9 && (!apex || z > apex.z)) apex = { x, y, z };
  }
  if (!apex) return;

  const moved = [];
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = toBody(i);
    const [dx, dy, dz] = figureOffset(x, y, z, apex, amounts);
    const k = 1 - armWeight(i);
    moved.push({ x: x + dx * k, y: y + dy * k, z: z + dz * k, k });
  }
  // Her seat rounded, on the reshaped figure (the model's bottom is a block with a shelf under it).
  const seat = amounts.seat === 0 ? moved.map((q) => q.z) : roundSeat(moved);
  for (let i = 0; i < pos.count; i++) {
    const q = moved[i];
    const [x, y, z] = toBody(i);
    const dz = q.z - z + (seat[i] - q.z) * q.k;
    p.fromArray(original, i * 3)
      .addScaledVector(left, (q.x - x) * unit)
      .addScaledVector(up, (q.y - y) * unit)
      .addScaledVector(front, dz * unit);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  // The skinned bounds are recomputed from the new shape on next use.
  mesh.boundingBox = null;
  mesh.boundingSphere = null;
}
