import * as THREE from 'three';

// Small inverse-kinematics helpers for posing a skinned character's limbs
// toward world-space points. They work on bones in place, after the
// animation mixer has posed them, and blend with the animated pose by weight.

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _keepUpper = new THREE.Quaternion();
const _keepLower = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();

/** Applies a world-space rotation `q` to a bone, keeping its position, blended by `weight`. */
export function rotateBoneWorld(bone, q, weight = 1) {
  if (weight <= 0) return;
  bone.parent.getWorldQuaternion(_qp);
  bone.getWorldQuaternion(_qw);
  // local' = parent^-1 * q * world
  const next = _qp.invert().multiply(q).multiply(_qw);
  if (weight >= 1) bone.quaternion.copy(next);
  else bone.quaternion.slerp(next, weight);
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone IK: bends `upper` (shoulder) and `lower` (elbow) so that `end`
 * (the wrist) reaches `target`, with the elbow pointing toward `pole`.
 * Targets out of reach are approached along the line to them, with the arm
 * kept just short of locking straight.
 * @param {THREE.Bone} upper
 * @param {THREE.Bone} lower
 * @param {THREE.Object3D} end
 * @param {THREE.Vector3} target  world position for `end`
 * @param {THREE.Vector3} pole    world position the elbow bends toward
 * @param {number} [weight]       0 leaves the animated pose, 1 is fully solved
 * @param {number} [maxReach]     fraction of the full arm length it may stretch to
 * @returns {number} how far short of the target the end finishes, in metres
 */
export function solveTwoBone(upper, lower, end, target, pole, weight = 1, maxReach = 0.985) {
  if (weight <= 0.001) return 0;
  upper.getWorldPosition(_a);
  lower.getWorldPosition(_b);
  end.getWorldPosition(_c);
  const lenA = _a.distanceTo(_b);
  const lenB = _b.distanceTo(_c);
  _t.copy(target).sub(_a);
  const dist = _t.length();
  if (dist < 1e-6 || lenA < 1e-6 || lenB < 1e-6) return 0;
  _n.copy(_t).divideScalar(dist);
  const d = THREE.MathUtils.clamp(dist, Math.abs(lenA - lenB) + 1e-4, (lenA + lenB) * maxReach);

  // Bend plane: from the shoulder toward the pole, square to the reach direction.
  _m.copy(pole).sub(_a);
  _m.addScaledVector(_n, -_m.dot(_n));
  if (_m.lengthSq() < 1e-10) {
    // Pole on the reach line: keep the elbow's current side.
    _m.copy(_b).sub(_a);
    _m.addScaledVector(_n, -_m.dot(_n));
    if (_m.lengthSq() < 1e-10) _m.set(0, -1, 0).addScaledVector(_n, _n.y);
  }
  _m.normalize();
  const cosA = THREE.MathUtils.clamp((lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _elbow.copy(_a).addScaledVector(_n, lenA * cosA).addScaledVector(_m, lenA * sinA);

  _keepUpper.copy(upper.quaternion);
  _keepLower.copy(lower.quaternion);

  // Upper bone: swing the elbow onto its spot.
  _u.copy(_b).sub(_a).normalize();
  _v.copy(_elbow).sub(_a).normalize();
  rotateBoneWorld(upper, _q.setFromUnitVectors(_u, _v));

  // Lower bone: swing the wrist onto the (reachable) target.
  lower.getWorldPosition(_b);
  end.getWorldPosition(_c);
  _u.copy(_c).sub(_b).normalize();
  _v.copy(_a).addScaledVector(_n, d).sub(_b).normalize();
  rotateBoneWorld(lower, _q.setFromUnitVectors(_u, _v));

  if (weight < 1) {
    const solvedUpper = upper.quaternion.clone();
    const solvedLower = lower.quaternion.clone();
    upper.quaternion.copy(_keepUpper).slerp(solvedUpper, weight);
    lower.quaternion.copy(_keepLower).slerp(solvedLower, weight);
    upper.updateMatrixWorld(true);
  }
  return Math.max(0, dist - d);
}

/**
 * Turns a hand so its fingers point along `fingers` and its palm faces
 * `palm` (both world directions), blended by weight.
 * @param {THREE.Bone} hand
 * @param {THREE.Object3D} fingerBase  a bone toward the fingertips (the index knuckle)
 * @param {THREE.Object3D} thumbBase   the thumb's first bone
 * @param {number} side  +1 for a left hand, -1 for a right
 */
export function orientHand(hand, fingerBase, thumbBase, fingers, palm, side, weight = 1) {
  if (weight <= 0.001) return;
  const h = hand.getWorldPosition(_a);
  const f = fingerBase.getWorldPosition(_b).sub(h).normalize();
  const t = thumbBase.getWorldPosition(_c).sub(h);
  t.addScaledVector(f, -t.dot(f));
  // Out of the palm, from the finger direction and the thumb side.
  const n = side > 0 ? _n.crossVectors(f, t) : _n.crossVectors(t, f);
  n.normalize();
  const from = basis(_m1, f, n);
  const fw = _u.copy(fingers).normalize();
  const pw = _v.copy(palm).addScaledVector(fw, -palm.dot(fw)).normalize();
  const to = basis(_m2, fw, pw);
  // Rotation taking the current basis onto the wanted one.
  _q.setFromRotationMatrix(to.multiply(from.transpose()));
  rotateBoneWorld(hand, _q, weight);
}

function basis(m, x, y) {
  const z = _elbow.crossVectors(x, y);
  return m.makeBasis(x, y, z);
}
