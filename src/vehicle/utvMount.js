import * as THREE from 'three';
import { UTV_STAND } from './utvModel.js';

const CLIMB_LIFT = 0.55; // over the sill and onto the bench
const BED_LIFT = 0.45; // up onto the tailgate from behind

/**
 * The UTV's seats as somewhere to ride, with the same face as the bale trailer and the tractor's mudguards (`model`, `motion`, `slots`,
 * `standPoint`, `freeSlot`) so the girls' climb on, sit and climb down states (npc/companionHayRide.js) work on all three. The slots
 * are named `left` and `mid` (the bench) and `bed` (the open tailgate); the driver's seat is yours. The Land Rover's bench works the same,
 * with its own stand points (`stand`) and no bed (its model has no `bedSeat`).
 */
export class UtvMount {
  constructor(quad, ground, stand = UTV_STAND) {
    this.quad = quad;
    this.ground = ground;
    this.model = quad.model;
    this.stand = stand;
    this.motion = { jolt: 0, omega: 0, speed: 0 }; // `speed` is how fast the girls wait for it to be going before they climb in
    this.slots = {
      left: { name: 'left', side: 1, anchor: this.model.getObjectByName('seatLeft'), girl: null, lift: CLIMB_LIFT },
      mid: { name: 'mid', side: 1, anchor: this.model.getObjectByName('seatMid'), girl: null, lift: CLIMB_LIFT },
    };
    const bedSeat = this.model.getObjectByName('bedSeat');
    if (bedSeat) this.slots.bed = { name: 'bed', side: 1, anchor: bedSeat, girl: null, lift: BED_LIFT };
    this.lastYaw = quad.yaw;
  }

  /** Turn rate, left positive, and how bumpy it is, as the sway in the girl's seat wants them. */
  update(dt) {
    const yaw = this.quad.yaw;
    const d = Math.atan2(Math.sin(yaw - this.lastYaw), Math.cos(yaw - this.lastYaw));
    this.lastYaw = yaw;
    if (dt > 0) this.motion.omega += (d / dt - this.motion.omega) * Math.min(1, dt * 6);
    const speed = Math.abs(this.quad.speed);
    this.motion.speed = speed;
    // The body's own springs already move the seats; this is the extra the bed gets over the rough, which grows with speed.
    this.motion.jolt = Math.min(1, speed / 11);
  }

  /** Where she stands on the ground to climb in or out, and the way she faces (toward the UTV). `side` is unused: the seat decides. */
  standPoint(side, slot) {
    const l = this.stand[slot?.name ?? 'left'];
    const p = this.model.localToWorld(new THREE.Vector3(l.x, 0, l.z));
    p.y = this.ground(p.x, p.z);
    const c = this.model.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  /** Whether somebody is on the tailgate or climbing onto it. */
  get bedBusy() {
    return !!this.slots.bed?.girl;
  }

  /** The nearest free bench seat to `from`, or null. The bed is never picked this way: a girl has to want it. */
  freeSlot(from) {
    const free = [this.slots.left, this.slots.mid].filter((s) => !s.girl);
    free.sort((a, b) => this.standPoint(a.side, a).position.distanceTo(from) - this.standPoint(b.side, b).position.distanceTo(from));
    return free[0] ?? null;
  }

  /** Who is in which seat. */
  seatOf(girl) {
    return Object.values(this.slots).find((s) => s.girl === girl)?.name ?? null;
  }
}
