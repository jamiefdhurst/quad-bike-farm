// The bale spike on the tractor, in the running game: it joins the pure yard and arms (baleSpike.js) to the tractor's model, the silage
// bales' meshes and their Rapier colliders. A bale on the spike has no collider (it hangs clear of the tractor); one that is down has.

import * as THREE from 'three';
import { BaleYard, SpikeLift } from './baleSpike.js';
import { poseBaleSpike, SPIKE_PLATE_Z, TRACTOR_GROUND_OFFSET } from '../vehicle/tractorModel.js';

const MOVED = 0.01; // metres a bale must have moved for its collider to be made again

export class BaleSpikeRig {
  /**
   * @param {object} o.silage   The standing bales from props.js: { id, mesh, collider, x, y, z, yaw }.
   * @param {object|null} o.tractor  The tractor's Quad, or null (the bales can still be put where they were left).
   */
  constructor({ physics, RAPIER, silage, groundAt, tractor = null, params }) {
    this.physics = physics;
    this.RAPIER = RAPIER;
    this.groundAt = groundAt;
    this.tractor = tractor;
    this.params = params;
    this.lift = new SpikeLift(params);
    this.yard = new BaleYard(silage.map(({ id, x, y, z, yaw }) => ({ id, x, y, z, yaw })), params);
    this.parts = new Map(silage.map((s) => [s.id, { mesh: s.mesh, collider: s.collider, at: { x: s.x, y: s.y, z: s.z } }]));
    this.homes = silage.map(({ id, x, y, z }) => ({ id, x, y, z }));
    this.plate = new THREE.Vector3();
    this.back = { x: 0, z: -1 };
    this.yaw = 0;
    this.shown = true;
    poseBaleSpike(tractor?.model ?? new THREE.Object3D(), this.lift.plateY, true, this.lift.lift);
  }

  get held() {
    return this.yard.held;
  }

  /** Puts the bales where the farm left them. */
  restore(saved) {
    this.yard.restore(saved, this.groundAt);
    this.sync();
  }

  /** Brings every mesh and collider into line with the yard. */
  sync() {
    for (const b of this.yard.bales) {
      const part = this.parts.get(b.id);
      part.mesh.position.set(b.x, b.y, b.z);
      part.mesh.rotation.set(0, b.yaw, 0);
      if (b.held) {
        this.dropCollider(part);
      } else if (!part.collider || Math.abs(part.at.x - b.x) + Math.abs(part.at.y - b.y) + Math.abs(part.at.z - b.z) > MOVED) {
        this.dropCollider(part);
        part.collider = this.physics.createCollider(
          this.RAPIER.ColliderDesc.cylinder(0.6, 0.75).setTranslation(b.x, b.y, b.z).setFriction(0.8),
        );
        part.at = { x: b.x, y: b.y, z: b.z };
      }
    }
  }

  dropCollider(part) {
    if (!part.collider) return;
    this.physics.removeCollider(part.collider, true);
    part.collider = null;
  }

  /** Where the plate is and which way the spike points, from the tractor as it stands now. */
  locate() {
    const q = this.tractor;
    q.model.updateWorldMatrix(true, true);
    const y = this.lift.plateY + TRACTOR_GROUND_OFFSET;
    const p = q.localToWorld(0, y, SPIKE_PLATE_Z);
    const b = q.localToWorld(0, y, SPIKE_PLATE_Z - 1);
    this.plate.copy(p);
    const len = Math.hypot(b.x - p.x, b.z - p.z) || 1;
    this.back = { x: (b.x - p.x) / len, z: (b.z - p.z) / len };
    this.yaw = Math.atan2(this.back.x, this.back.z);
  }

  /**
   * One frame. `raise` and `lower` are the keys (only while you are driving it), `powered` the engine running, `shown` whether the spike is
   * fitted (no trailer on the drawbar). Returns the events: { type: 'speared' | 'left', bale }.
   */
  update(dt, { raise = false, lower = false, powered = true, shown = true } = {}) {
    const events = [];
    if (!this.tractor) return events;
    this.shown = shown;
    if (shown) this.lift.update(dt, { raise, lower, powered });
    poseBaleSpike(this.tractor.model, this.lift.plateY, shown, this.lift.lift);
    if (!shown) return events;
    this.locate();
    const held = this.yard.held;
    if (held) {
      if (this.yard.carry(held, dt, this.plate, this.back, this.yaw, this.groundAt) === 'left') {
        this.yard.settle(this.groundAt);
        events.push({ type: 'left', bale: held });
        this.sync();
      } else {
        const part = this.parts.get(held.id);
        part.mesh.position.set(held.x, held.y, held.z);
        part.mesh.rotation.set(0, held.yaw, 0);
      }
      return events;
    }
    const tip = { x: this.plate.x + this.back.x * this.params.length, y: this.plate.y, z: this.plate.z + this.back.z * this.params.length };
    const hit = this.yard.spearable(tip);
    if (hit && this.yard.spear(hit)) {
      events.push({ type: 'speared', bale: hit });
      this.sync();
    }
    return events;
  }

  /** Puts every bale back where it started. */
  reset() {
    this.putDown();
    for (const h of this.homes) Object.assign(this.yard.get(h.id), { x: h.x, y: h.y, z: h.z, yaw: 0 });
    this.yard.settle(this.groundAt);
    this.sync();
  }

  /** Lets go of whatever is on the spike, where it hangs (the debug panel). */
  putDown() {
    const held = this.yard.held;
    if (!held) return false;
    this.yard.release(held, this.groundAt);
    this.sync();
    return true;
  }
}
