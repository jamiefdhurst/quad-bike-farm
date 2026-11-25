import * as THREE from 'three';
import { splitBody } from './smoothBody.js';
import { patchBust, coverBust } from './bustPatch.js';


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
  middle: 0.55, // down her middle the forward push is this fraction of what it is at each apex, rising to all of it at the apex's
  // width, so the two stand out as their own shapes with a dip between them, not one across her front (#1134). The model is
  // nearly as far forward there as at the apexes. Drawing her middle back as well made a steep flat face in an open polo's V.
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
    // Each side swells about its own apex. The regions overlap in the middle, where the push is less, so there is a dip between
    // them.
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
      // Less forward down her middle (only her depth changes, so nothing turns over).
      const middle = 1 - smoothstep(0, apex.x, Math.abs(x));
      dz += (BUST.forward * dome * g + (z - apex.z + BUST.depth * g) * BUST.swell * w) * (1 - (1 - BUST.middle) * middle);
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

/**
 * Her normals smoothed where `smooth` (0 to 1 a corner) says: each corner's flat normal eased towards the normal of every triangle
 * meeting at its point, by area. The drawn bust is shaded smooth and her chest round it fades back to flat, so the bust doesn't show
 * an edge where fine meets faceted.
 */
function smoothNormals(geo, smooth) {
  const pos = geo.attributes.position.array;
  const nrm = geo.attributes.normal.array;
  const key = (i) => `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
  const sums = new Map();
  const count = pos.length / 3;
  for (let t = 0; t < count / 3; t++) {
    const k = t * 9;
    const ax = pos[k + 3] - pos[k], ay = pos[k + 4] - pos[k + 1], az = pos[k + 5] - pos[k + 2];
    const bx = pos[k + 6] - pos[k], by = pos[k + 7] - pos[k + 1], bz = pos[k + 8] - pos[k + 2];
    const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    for (let j = 0; j < 3; j++) {
      const i = t * 3 + j;
      if (!smooth[i]) continue;
      const kk = key(i);
      const sum = sums.get(kk) ?? [0, 0, 0];
      sums.set(kk, [sum[0] + n[0], sum[1] + n[1], sum[2] + n[2]]);
    }
  }
  // Every corner at a smoothed point counts, flagged or not, so its neighbours outside the band agree on it.
  for (let t = 0; t < count / 3; t++) {
    const k = t * 9;
    const ax = pos[k + 3] - pos[k], ay = pos[k + 4] - pos[k + 1], az = pos[k + 5] - pos[k + 2];
    const bx = pos[k + 6] - pos[k], by = pos[k + 7] - pos[k + 1], bz = pos[k + 8] - pos[k + 2];
    const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    for (let j = 0; j < 3; j++) {
      const i = t * 3 + j;
      if (smooth[i]) continue;
      const sum = sums.get(key(i));
      if (sum) for (let c = 0; c < 3; c++) sum[c] += n[c];
    }
  }
  for (let i = 0; i < count; i++) {
    const w = smooth[i];
    if (!w) continue;
    const sum = sums.get(key(i));
    const len = Math.hypot(...sum) || 1;
    const n = [0, 1, 2].map((c) => nrm[i * 3 + c] * (1 - w) + (sum[c] / len) * w);
    const l2 = Math.hypot(...n) || 1;
    for (let c = 0; c < 3; c++) nrm[i * 3 + c] = n[c] / l2;
  }
  geo.attributes.normal.needsUpdate = true;
}

/** Her body mesh's normals worked out again (after her hair is tied back, say), smoothed round a drawn bust as shapeFigure left them. */
export function bodyNormals(mesh) {
  const geo = mesh.geometry;
  geo.computeVertexNormals();
  const smooth = mesh.userData.smoothShading;
  if (smooth && smooth.length === geo.attributes.position.count) smoothNormals(geo, smooth);
}

/**
 * The covered body's arrays as bodyData reads them: positions, normals (smoothed, as her drawn bust's), paint and skin. `source`
 * is each corner's own corner of her body, or -1: her paint is cut round her neckline after this (outfit.js), so it is read from her.
 */
function coverArrays(c) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(c.positions, 3));
  geo.setIndex(Array.from(c.index));
  geo.computeVertexNormals();
  smoothNormals(geo, c.smooth);
  return { position: c.positions, normal: geo.attributes.normal.array, uv: c.uvs, source: c.source, skinIndex: c.skinIndex, skinWeight: c.skinWeight, index: c.index };
}

/** Puts a split (or patched) body's arrays on her geometry, replacing them when the number of corners has changed. */
function setBody(geo, b) {
  const pos = geo.attributes.position;
  if (pos.array.length === b.positions.length && geo.index?.count === b.index.length) {
    pos.array.set(b.positions);
    pos.needsUpdate = true;
    return;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(b.positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(b.uvs), 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(b.skinIndex), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(b.skinWeight), 4));
  geo.setIndex(Array.from(b.index));
}

/**
 * The body frame of a skinned body in its bind pose (the hips bone at 0, x her left, y up, z her front, one unit hips to neck), and
 * `toBody(positions)`, which gives a copy of a flat xyz array in it. Null if her bones aren't there.
 */
export function bodyFrame(mesh) {
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
  if (!hips || !neck || !leftArm || !rightArm) return null;
  const unit = neck.distanceTo(hips);
  const up = neck.clone().sub(hips).normalize();
  const left = leftArm.sub(rightArm);
  left.addScaledVector(up, -left.dot(up)).normalize();
  const front = new THREE.Vector3().crossVectors(left, up);
  const q = new THREE.Vector3();
  const toBody = (positions) => {
    const out = new Float32Array(positions.length);
    for (let i = 0; i < out.length / 3; i++) {
      q.fromArray(positions, i * 3).sub(hips);
      out[i * 3] = q.dot(left) / unit;
      out[i * 3 + 1] = q.dot(up) / unit;
      out[i * 3 + 2] = q.dot(front) / unit;
    }
    return out;
  };
  return { hips, unit, up, left, front, toBody };
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

  const frame = bodyFrame(mesh);
  if (!frame) return;
  const { hips, unit, up, left, front } = frame;
  const sk = mesh.skeleton;

  const p = new THREE.Vector3();
  const toBody = (i) => {
    p.fromArray(original, i * 3).sub(hips);
    return [p.dot(left) / unit, p.dot(up) / unit, p.dot(front) / unit];
  };

  // Arms are left alone: their weight on a vertex holds it still.
  const armBones = new Set(sk.bones.map((b, i) => (/Arm|Hand/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const skinIndex = coarse ? coarse.skinIndex : geo.attributes.skinIndex.array;
  const skinWeight = coarse ? coarse.skinWeight : geo.attributes.skinWeight.array;
  const armWeight = (i) => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (armBones.has(skinIndex[i * 4 + k])) w += skinWeight[i * 4 + k];
    return Math.min(1, w);
  };

  // The bust's apex is the frontmost point of the chest on her left.
  let apex = null;
  for (let i = 0; i < count; i++) {
    const [x, y, z] = toBody(i);
    if (x > 0.02 && x < 0.4 && y > 0.55 && y < 0.9 && (!apex || z > apex.z)) apex = { x, y, z };
  }
  if (!apex) return;

  // Drawn from the written target (bustShape.js) after the split, or pushed out here as before.
  // On the split body her bust is drawn after the split, from the written target (bustShape.js, bustPatch.js; #1143). On the model as
  // it comes (`?body=flat`) it is still pushed out here.
  const drawBust = !!(amounts.bust && coarse);
  const pushed = drawBust ? { ...amounts, bust: 0 } : amounts;
  const moved = [];
  for (let i = 0; i < count; i++) {
    const [x, y, z] = toBody(i);
    const [dx, dy, dz] = figureOffset(x, y, z, apex, pushed);
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
  let split = null;
  mesh.userData.cover = null;
  if (!coarse) {
    pos.array.set(shaped);
    pos.needsUpdate = true;
  } else {
    split = splitBody({ ...coarse, positions: shaped }, { rounded: (t) => coarse.rounded[t] === 1 });
    if (drawBust) {
      // The split body into the body frame and back, with her arms held still.
      const body = frame.toBody(split.positions);
      const keep = (i) => {
        let w = 0;
        for (let k = 0; k < 4; k++) if (armBones.has(split.skinIndex[i * 4 + k])) w += split.skinWeight[i * 4 + k];
        return Math.min(1, w);
      };
      const drawn = patchBust({ ...split, positions: body }, amounts.bust, keep, (b) => armBones.has(b));
      const fromBody = (a) => {
        const out = new Float32Array(a.length);
        for (let i = 0; i < out.length / 3; i++) {
          p.copy(hips)
            .addScaledVector(left, a[i * 3] * unit)
            .addScaledVector(up, a[i * 3 + 1] * unit)
            .addScaledVector(front, a[i * 3 + 2] * unit)
            .toArray(out, i * 3);
        }
        return out;
      };
      if (drawn) {
        split = { ...drawn, positions: fromBody(drawn.positions) };
        // Her body as her tops are cut from it (bustPatch.js, coverBust), on her mesh: both girls' geometries share one userData.
        const cover = coverBust(drawn, amounts.bust, (b) => armBones.has(b));
        mesh.userData.cover = cover ? coverArrays({ ...cover, positions: fromBody(cover.positions) }) : null;
      }
    }
    setBody(geo, split);
  }
  // On her mesh, not the geometry: both girls' geometries are clones that share one userData.
  mesh.userData.smoothShading = coarse && split.smooth ? split.smooth : null;
  bodyNormals(mesh);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  // The skinned bounds are recomputed from the new shape on next use.
  mesh.boundingBox = null;
  mesh.boundingSphere = null;
}
