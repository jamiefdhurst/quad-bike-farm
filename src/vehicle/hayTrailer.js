import * as THREE from 'three';
import { TrailerMotion, DEFAULT_TRAILER_PARAMS } from './trailer.js';
import { TRACTOR_GROUND_OFFSET } from './tractorModel.js';
import { buildTrailerModel, TRAILER_SPEC, trailerStandLocal } from './trailerModel.js';

const PIN_BACK = 1.5; // the tractor's drawbar pin, metres behind its origin

/**
 * The bale trailer in the yard: its model, its motion (vehicle/trailer.js) and whether it's on the tractor's drawbar. It isn't a
 * physics body, so it can't flip the tractor or be driven into; it just follows the pin.
 */
export class HayTrailer {
  constructor({ scene, world, params = { ...DEFAULT_TRAILER_PARAMS } }) {
    this.world = world;
    this.p = params;
    this.model = buildTrailerModel();
    scene.add(this.model);
    this.body = this.model.getObjectByName('body');
    this.motion = new TrailerMotion(params);
    this.hitched = false;
    this.tractor = null; // the tractor's Quad while it's hitched
    this.signedSpeed = 0;
    this.slots = {
      1: { side: 1, anchor: this.body.getObjectByName('seatLeft'), girl: null },
      '-1': { side: -1, anchor: this.body.getObjectByName('seatRight'), girl: null },
    };
    this.wheels = ['wheelLeft', 'wheelRight'].map((n) => this.model.getObjectByName(n).getObjectByName('spin'));
  }

  ground = (x, z) => this.world.heightAt(x, z);

  /** Stands it with its axle at (x, z), pointing `yaw` (toward the tractor). */
  place(x, z, yaw) {
    this.motion.place(x, z, yaw, this.ground);
    this.apply();
  }

  /** The drawbar pin of a tractor Quad, on the ground plan, and its height above the ground. */
  pinOf(quad) {
    const w = quad.localToWorld(0, TRACTOR_GROUND_OFFSET + 0.52, -PIN_BACK);
    return { x: w.x, z: w.z, y: w.y - TRAILER_SPEC.ringHeight };
  }

  /** How far the tractor's pin is from the trailer's ring. */
  gap(quad) {
    const pin = this.pinOf(quad);
    const ring = this.motion.ring();
    return Math.hypot(pin.x - ring.x, pin.z - ring.z);
  }

  canHitch(quad) {
    return !this.hitched && this.gap(quad) <= this.p.hitchRange;
  }

  hitch(quad) {
    this.hitched = true;
    this.tractor = quad;
  }

  unhitch() {
    this.hitched = false;
    this.tractor = null;
    this.motion.speed = 0;
    this.motion.omega = 0;
  }

  /** Where she stands to climb on or off on `side` (+1 left, -1 right), as a world position and the way she faces (toward the bed). */
  standPoint(side) {
    const l = trailerStandLocal(side);
    const p = this.model.localToWorld(new THREE.Vector3(l.x, 0, l.z));
    p.y = this.ground(p.x, p.z);
    const c = this.model.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  /** The slot a girl would take, picking the free one nearer her. */
  freeSlot(from) {
    const free = Object.values(this.slots).filter((s) => !s.girl);
    free.sort((a, b) => this.standPoint(a.side).position.distanceTo(from) - this.standPoint(b.side).position.distanceTo(from));
    return free[0] ?? null;
  }

  update(dt) {
    const m = this.motion;
    const before = { x: m.x, z: m.z };
    let pin;
    if (this.hitched) pin = this.pinOf(this.tractor);
    else {
      const ring = m.ring();
      pin = { x: ring.x, z: ring.z, y: this.ground(ring.x, ring.z) };
    }
    m.update(dt, pin, this.ground);
    this.signedSpeed = dt > 0 ? ((m.x - before.x) * Math.sin(m.yaw) + (m.z - before.z) * Math.cos(m.yaw)) / dt : 0;
    for (const w of this.wheels) w.rotation.x += (this.signedSpeed * dt) / TRAILER_SPEC.wheelRadius;
    this.apply();
  }

  apply() {
    const m = this.motion;
    this.model.position.set(m.x, m.y, m.z);
    this.model.rotation.set(-m.pitch, m.yaw, m.roll, 'YXZ');
    this.body.position.y = m.heave;
    this.model.updateMatrixWorld(true);
  }
}
