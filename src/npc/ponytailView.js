import * as THREE from 'three';
import { swingStep, STILL, DEFAULT_PONYTAIL_PARAMS } from './ponytail.js';

// The ponytail as it moves: its pivot (at the band, on her head bone) turned each frame so the tail hangs as it does from her chest
// rather than from her head, so it stays lying down her back when she turns or nods, plus the swing (ponytail.js, swingStep) from how
// the band is thrown about. Under a helmet the band drops to just below the rim at the back. Built by outfit.js; run by the rig after
// her head has been turned.

const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _swing = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'XZY');
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _raw = new THREE.Vector3();
const _local = new THREE.Vector3();

export class PonytailSwing {
  /**
   * `pivot`: the group at the band, already on her head bone, built in the rest pose. `low`: the pivot's position on the head bone
   * under a helmet. `chest`: the bone the tail hangs from. `params`: the shared tuning.
   */
  constructor(pivot, { low, chest, params = DEFAULT_PONYTAIL_PARAMS }) {
    this.pivot = pivot;
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
    this.pivot.parent.getWorldQuaternion(_qp);
    this.pivot.quaternion.copy(_qp.invert().multiply(world));
  }
}
