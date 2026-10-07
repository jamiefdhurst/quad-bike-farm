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
  reach: 0.16, // sideways radius of each breast's region from its apex
  reachUp: 0.2, // above the apex
  reachDown: 0.2, // below it, a bit further so the shirt hangs from the bust
  forward: 0.1, // the whole region moves forward this much
  swell: 0.25, // and swells by this fraction away from a point inside the chest
  depth: 0.17, // that point is this far behind the apex
  drop: 0.03, // a fuller bust sits a little lower
  frontFrom: 0.0, // only the front of the body moves: none at z = frontFrom,
  frontTo: 0.15, // fully at z = frontTo
  dome: 0.35, // the forward push follows (1 - e) to this power: under 1 a rounder dome, full across the middle and falling away
  // at the edge, rather than tapering to a point at the apex
};
// Each fades out over `reach` above and below its height `y`; the other
// numbers are the fraction it narrows or widens by at full strength.
const WAIST = { y: 0.37, reach: 0.3, narrow: 0.2, flatten: 0.08 };
const HIPS = { y: -0.15, reach: 0.3, widen: 0.15, back: 0.15 };
const SPINE_DEPTH = 0.04; // front-to-back middle of the torso, which the waist and hips scale about

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
    const ry = y > apex.y ? BUST.reachUp : BUST.reachDown;
    const e = (across / BUST.reach) ** 2 + ((y - apex.y) / ry) ** 2;
    if (e < 1) {
      const t = 1 - e;
      const front = smoothstep(BUST.frontFrom, BUST.frontTo, z) * bust;
      const w = t * t * (3 - 2 * t) * front;
      // The forward push is domed, so the breast is round rather than conical; it still meets the body smoothly at the edge.
      const dome = t ** BUST.dome * smoothstep(0, 0.5, t) * front;
      // No sideways swell on the midline, so the two halves meet.
      dx += side * across * BUST.swell * w * smoothstep(0, apex.x, Math.abs(x));
      dy += ((y - apex.y) * BUST.swell - BUST.drop) * w;
      dz += BUST.forward * dome + (z - apex.z + BUST.depth) * BUST.swell * w;
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

  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = toBody(i);
    const [dx, dy, dz] = figureOffset(x, y, z, apex, amounts);
    const k = unit * (1 - armWeight(i));
    p.fromArray(original, i * 3)
      .addScaledVector(left, dx * k)
      .addScaledVector(up, dy * k)
      .addScaledVector(front, dz * k);
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
