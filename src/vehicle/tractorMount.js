import * as THREE from 'three';
import { MUDGUARD } from './tractorModel.js';

const CLIMB_LIFT = 1.1; // the arch top is 1.6 m up: she goes over the step and the wheel, not through it

/**
 * The tractor's wheel arches as somewhere to ride, with the same face as the bale trailer (`model`, `motion`, `slots`, `standPoint`,
 * `freeSlot`) so the girls' climb on, sit and climb down states (npc/companionHayRide.js) work on both.
 */
export class TractorMount {
  constructor(quad, ground) {
    this.quad = quad;
    this.ground = ground;
    this.model = quad.model;
    this.motion = { jolt: 0, omega: 0 }; // the tractor's own bounce is in the model already, so no extra jolt
    this.slots = {};
    for (const [side, name] of [[1, 'mudguardLeft'], [-1, 'mudguardRight']]) {
      this.slots[side] = { side, anchor: this.model.getObjectByName(name), girl: null, lift: CLIMB_LIFT };
    }
    this.lastYaw = quad.yaw;
  }

  /** Turn rate, left positive, as the sway in the girl's seat wants it. */
  update(dt) {
    const yaw = this.quad.yaw;
    const d = Math.atan2(Math.sin(yaw - this.lastYaw), Math.cos(yaw - this.lastYaw));
    this.lastYaw = yaw;
    if (dt > 0) this.motion.omega += (d / dt - this.motion.omega) * Math.min(1, dt * 6);
  }

  /** Beside the footplate, ahead of the wheel, on `side` (+1 left). */
  standPoint(side) {
    const p = this.model.localToWorld(new THREE.Vector3(side * MUDGUARD.standX, 0, MUDGUARD.standZ));
    p.y = this.ground(p.x, p.z);
    const c = this.model.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  freeSlot(from) {
    const free = Object.values(this.slots).filter((s) => !s.girl);
    free.sort((a, b) => this.standPoint(a.side).position.distanceTo(from) - this.standPoint(b.side).position.distanceTo(from));
    return free[0] ?? null;
  }
}
