import * as THREE from 'three';
import { swingStep, STILL, DEFAULT_PONYTAIL_PARAMS, hangShare, bendTail, tipIntoHead } from './ponytail.js';

// The ponytail as it moves: its pivot (at the band) stays on her head bone with the band, and the tail is bent each frame so that below
// its first few centimetres it hangs as it does from her chest rather than from her head, so it stays lying down her back when she
// turns or nods, plus the swing (ponytail.js, swingStep) from how the band is thrown about. Its root stays on her head: turning the
// whole tail from the band swung the band and the root into her skull (#1243). Under a helmet the band drops to just below the rim at
// the back. Built by outfit.js; run by the rig after her head has been turned.

const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _swing = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'XZY');
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _raw = new THREE.Vector3();
const _local = new THREE.Vector3();
const _bend = new THREE.Quaternion();
const _back = new THREE.Quaternion();
const _x = new THREE.Vector3(1, 0, 0);

export class PonytailSwing {
  /**
   * `pivot`: the group at the band, already on her head bone, built in the rest pose. `hair`: the tail's mesh in it, bent each
   * frame. `low`: the pivot's position on the head bone under a helmet. `chest`: the bone the tail hangs from. `params`: the shared
   * tuning.
   */
  constructor(pivot, { hair = null, low, chest, params = DEFAULT_PONYTAIL_PARAMS }) {
    this.pivot = pivot;
    this.hair = hair;
    if (hair) {
      const { position, normal } = hair.geometry.attributes;
      this.rest = position.array.slice();
      this.restNormal = normal.array.slice();
      this.share = Float32Array.from({ length: position.count }, (_, i) => hangShare(this.rest[i * 3 + 1]));
      // Bent any way about the band, it stays within the sphere its furthest point reaches, so it is never culled while in view.
      let r = 0;
      for (let i = 0; i < position.count; i++) r = Math.max(r, Math.hypot(this.rest[i * 3], this.rest[i * 3 + 1], this.rest[i * 3 + 2]));
      hair.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), r);
    }
    this.bent = new THREE.Quaternion();
    this.high = pivot.position.clone();
    this.low = low;
    this.baseScale = pivot.scale.clone();
    this.chest = chest;
    this.params = params;
    // How the tail sits against her chest as she stands: kept through anything her head does.
    chest.updateWorldMatrix(true, false);
    this.rel = chest.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(pivot.getWorldQuaternion(new THREE.Quaternion()));
    this.state = { ...STILL };
    this.under = 0; // 0 high on her head, 1 down under a helmet's rim
    this.underHelmet = false;
    this.prev = null;
    this.vel = new THREE.Vector3();
    this.accel = new THREE.Vector3();
  }

  update(dt) {
    if (!this.pivot.parent || !this.pivot.visible) return;
    const target = this.underHelmet ? 1 : 0;
    this.under += (target - this.under) * Math.min(1, dt * 8);
    if (Math.abs(this.under - target) < 1e-3) this.under = target;
    this.pivot.position.lerpVectors(this.high, this.low, this.under);
    this.pivot.scale.copy(this.baseScale).multiplyScalar(1 - 0.12 * this.under); // shorter from lower down, so it still ends on her back
    // Where it would hang from her chest, before the swing.
    this.chest.updateWorldMatrix(true, false);
    const hang = this.chest.getWorldQuaternion(_q).multiply(this.rel);
    // The band's acceleration, in the tail's frame, from where it has been.
    this.pivot.updateWorldMatrix(true, false);
    const at = this.pivot.getWorldPosition(_v);
    if (dt > 1e-4) {
      if (!this.prev || this.prev.distanceToSquared(at) > 1) {
        this.prev = at.clone();
        this.vel.set(0, 0, 0);
        this.accel.set(0, 0, 0);
      } else {
        _a.subVectors(at, this.prev).divideScalar(dt);
        const raw = _raw.copy(_a).sub(this.vel).divideScalar(dt);
        this.vel.copy(_a);
        this.prev.copy(at);
        if (raw.length() > 40) raw.setLength(40); // a jolt, not a teleport
        this.accel.lerp(raw, Math.min(1, dt * 20)); // smoothed: frame to frame the head's position jitters
      }
      const local = _local.copy(this.accel).applyQuaternion(_qp.copy(hang).invert());
      this.state = swingStep(this.state, [local.x, local.z], Math.min(dt, 0.05), this.params);
    }
    // The swing: about across her (its end out behind her) and about her back (its end to the side), and a little further out under a helmet.
    _e.set(-this.state.pitch - 0.08 * this.under, 0, this.state.roll);
    _swing.setFromEuler(_e);
    const world = hang.multiply(_swing);
    // The hang in the pivot's own frame (her head's), and the tail bent to it below its root, when it has moved enough to see.
    this.pivot.getWorldQuaternion(_qp);
    _bend.copy(_qp.invert().multiply(world));
    const tip = tipIntoHead([_bend.x, _bend.y, _bend.z, _bend.w]);
    if (tip > 0) _bend.premultiply(_back.setFromAxisAngle(_x, -tip)); // lying over the back of her head, not through it
    if (this.hair && this.bent.angleTo(_bend) > 1e-4) {
      this.bent.copy(_bend);
      const q = [_bend.x, _bend.y, _bend.z, _bend.w];
      const { position, normal } = this.hair.geometry.attributes;
      bendTail(this.rest, this.share, q, position.array);
      bendTail(this.restNormal, this.share, q, normal.array, true);
      position.needsUpdate = normal.needsUpdate = true;
    }
  }
}
