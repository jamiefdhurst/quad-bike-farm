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
  /**
   * `rear`: the back bench's seats where there is one (the 200TDi's LANDY_REAR_SEATS, each with the `door` it's reached by), and `stand`
   * then has a stand point for each door (`rearLeft` for the passenger's, `rearRight` for the driver's).
   */
  constructor(quad, ground, stand = UTV_STAND, rear = {}) {
    this.quad = quad;
    this.ground = ground;
    this.model = quad.model;
    this.stand = stand;
    this.motion = { jolt: 0, omega: 0, speed: 0 }; // `speed` is how fast the girls wait for it to be going before they climb in
    this.slots = {};
    // Stepped into, under the roof (npc/poseMoves.js); the bed is climbed up onto. A car has no middle seat (no seatMid), only the passenger's.
    for (const [name, part] of [['left', 'seatLeft'], ['mid', 'seatMid']]) {
      const anchor = this.model.getObjectByName(part);
      if (anchor) this.slots[name] = { name, side: 1, anchor, girl: null, lift: CLIMB_LIFT, move: 'stepIn' };
    }
    // The back bench, stepped into past the tipped front seat (npc/poseMoves.js stepInBack).
    for (const [name, seat] of Object.entries(rear)) {
      const anchor = this.model.getObjectByName(`seat${name[0].toUpperCase()}${name.slice(1)}`);
      if (anchor) this.slots[name] = { name, side: 1, anchor, girl: null, lift: CLIMB_LIFT, move: 'stepInBack', rear: true, door: seat.door };
    }
    const bedSeat = this.model.getObjectByName('bedSeat');
    if (bedSeat) this.slots.bed = { name: 'bed', side: 1, anchor: bedSeat, girl: null, lift: BED_LIFT };
    this.lastYaw = quad.yaw;
  }

  /** Whether a girl is stepping in or climbing down just now (or walking up to climb in), so the door nets are swung out for her. */
  get boardingNow() {
    for (const slot of Object.values(this.slots)) {
      const c = slot.girl;
      if (!c?.fsm) continue;
      const d = c.fsm.data;
      if (c.fsm.is('boarding') || (c.fsm.is('onTrailer') && (d?.leaving || d?.fromWorld))) return true;
      if (c.fsm.is('walking') && d?.goal === 'board' && c.root.position.distanceTo(this.quad.position) < 3.5) return true;
    }
    return false;
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
    this.quad.doorWant = this.boardingNow; // the door nets swing out for a girl getting in or out (quad.js poses them)
  }

  /** The back bench's seats, if it has one. */
  get rearSlots() {
    return Object.values(this.slots).filter((s) => s.rear);
  }

  /** The door a back seat is reached by just now: its own, unless that's the driver's and somebody is at the wheel. */
  doorOf(slot) {
    return slot.door === 'driver' && (this.quad.driver || this.quad.rider) ? 'left' : slot.door;
  }

  /** Where she stands on the ground to climb in or out, and the way she faces (toward the UTV). `side` is unused: the seat decides. */
  standPoint(side, slot) {
    const key = slot?.rear ? (this.doorOf(slot) === 'driver' ? 'rearRight' : 'rearLeft') : slot?.name ?? 'left';
    const l = this.stand[key];
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
    const free = [this.slots.left, this.slots.mid].filter((s) => s && !s.girl);
    free.sort((a, b) => this.standPoint(a.side, a).position.distanceTo(from) - this.standPoint(b.side, b).position.distanceTo(from));
    return free[0] ?? null;
  }

  /** The nearest free seat on the back bench to `from`, or null (or if there isn't one). */
  freeRearSlot(from) {
    const free = this.rearSlots.filter((s) => !s.girl);
    free.sort((a, b) => this.standPoint(a.side, a).position.distanceTo(from) - this.standPoint(b.side, b).position.distanceTo(from));
    return free[0] ?? null;
  }

  /** Who is in which seat. */
  seatOf(girl) {
    return Object.values(this.slots).find((s) => s.girl === girl)?.name ?? null;
  }
}
