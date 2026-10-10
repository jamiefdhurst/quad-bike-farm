import * as THREE from 'three';
import { pathAt } from '../world/loft.js';

// Her sitting about somewhere on the farm: on the straw bales or the paddock fence
// when it's fine, on the bales in the barn when it rains (places.js decides where and
// when). As Companion states and methods, mixed in by companion.js.

const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const smooth = (t) => t * t * (3 - 2 * t);
const UP = new THREE.Vector3(0, 1, 0);

export const restingMethods = {
  /** Where she stands to climb up (or, for shelter, where she stands). */
  restStandPoint(spot) {
    if (spot.stand) return new THREE.Vector3(spot.stand.x, this.world.heightAt(spot.stand.x, spot.stand.z), spot.stand.z); // the foot of the loft ladder
    const stands = spot.kind === 'shelter' && spot.seat === undefined; // shelter without a seat: she just stands there
    const back = spot.kind === 'bale' || spot.kind === 'shelter' ? 1.65 : 0.9;
    const x = stands ? spot.x : spot.x - Math.sin(spot.yaw) * back;
    const z = stands ? spot.z : spot.z - Math.cos(spot.yaw) * back;
    return new THREE.Vector3(x, this.world.heightAt(x, z), z);
  },

  /** Where her root goes when she's sat on a spot, so her hips are on it. */
  restSeatPoint(spot) {
    const hips = this.sitHips;
    const offset = new THREE.Vector3(-hips.x, -hips.y, -hips.z).applyAxisAngle(UP, spot.yaw);
    return new THREE.Vector3(spot.x + offset.x, this.world.heightAt(spot.x, spot.z) + spot.seat + offset.y, spot.z + offset.z);
  },

  /** Walks over to a spot and settles there. Only when she's stood about; returns whether she set off. */
  goRest(spot, { stay = Infinity } = {}) {
    if (!this.fsm.is('idle')) return false;
    this.restSpot = spot;
    this.pendingSpot = null;
    const stand = this.restStandPoint(spot);
    // A spot inside a building has a `door`, a point outside the way in, to walk to first (unless she's nearer in than that already).
    const door = spot.door ? new THREE.Vector3(spot.door.x, this.world.heightAt(spot.door.x, spot.door.z), spot.door.z) : null;
    let through = !door || this.root.position.distanceTo(stand) < door.distanceTo(stand);
    const target = () => {
      if (!through && door.distanceTo(this.root.position) < 0.9) through = true;
      return { position: through ? stand : door, facing: spot.yaw };
    };
    this.fsm.transition('walking', { goal: 'rest', spot, stay, target });
    return true;
  },

  /** Whether she's at a spot, settled, so you can talk to her or send her off. */
  get isResting() {
    return this.fsm.is('resting');
  },

  /** She gets up (a moment to climb down) and does `then` once she's on her feet. */
  leaveRest(then = null) {
    if (!this.fsm.is('resting')) return false;
    const d = this.fsm.data;
    d.leaving = true;
    d.then = then;
    return true;
  },

  /** The spot she's at or on her way to, if any. */
  currentSpot() {
    if (this.pendingSpot) return this.pendingSpot; // told to go there, still getting up
    const s = this.fsm;
    if (s.is('resting') || (s.is('walking') && s.data?.goal === 'rest')) return this.restSpot ?? null;
    return null;
  },
};

export const restingStates = {
  resting: {
    look: 'free',
    enter(data) {
      const sit = data.spot.seat !== undefined;
      this.restPhase = sit ? 'up' : 'sat';
      this.startPos = this.root.position.clone();
      this.startHeading = this.heading;
      if (sit) {
        this.setColliderEnabled(false);
        this.rig.play(data.spot.via ? 'Walking' : 'Sitting', data.spot.via ? { fade: 0.3 } : { once: true, fade: 0.3 });
        this.loftClimbing = !!data.spot.via;
      } else {
        this.rig.play('Idle', { fade: 0.3 });
      }
      this.restFor = data.stay;
    },
    update(dt, data) {
      const p = this.params;
      const spot = data.spot;
      const sit = spot.seat !== undefined;
      if (!sit) {
        this.turnToward(dt, spot.yaw);
        if (data.leaving) finishRest(this, data);
        return;
      }
      const seat = this.restSeatPoint(spot);
      if (spot.via && this.restPhase !== 'sat') {
        restLoftPath(this, spot, seat, data);
        return;
      }
      const tall = Math.max(0.15, Math.min(0.5, spot.seat * 0.35)); // how high she lifts over the edge on the way up
      if (this.restPhase === 'up') {
        const t = Math.min(1, this.fsm.time / p.mountDuration);
        const k = smooth(t);
        this.root.position.lerpVectors(this.startPos, seat, k);
        this.root.position.y += Math.sin(Math.PI * k) * tall;
        this.heading = this.startHeading + angleTo(this.startHeading, spot.yaw) * k;
        this.root.rotation.y = this.heading;
        if (t >= 1) {
          this.restPhase = 'sat';
          this.rig.play('SitIdle', { fade: 0.4 });
          this.rig.legSpread = 0;
        }
        return;
      }
      if (this.restPhase === 'sat') {
        this.root.position.copy(seat);
        this.restFor -= dt;
        if (data.leaving || this.restFor <= 0) {
          this.restPhase = 'down';
          this.downAt = this.fsm.time;
          if (spot.via) this.rig.play('Walking', { fade: 0.3 });
          else this.rig.play('Sitting', { once: true, timeScale: -1, fade: 0.2 });
        }
        return;
      }
      // Climbing down to where she stood.
      const stand = this.restStandPoint(spot);
      const t = Math.min(1, (this.fsm.time - this.downAt) / p.dismountDuration);
      const k = smooth(t);
      this.root.position.lerpVectors(seat, stand, k);
      this.root.position.y += Math.sin(Math.PI * k) * tall * 0.5;
      this.root.rotation.y = this.heading;
      if (t >= 1) finishRest(this, data);
    },
    exit() {
      this.rig.legSpread = 0;
    },
  },
};

/**
 * Up the ladder to a loft seat, and back down: she walks from where she stood through the points in `spot.via` (the top of
 * the ladder, then across the planks) to her seat over `spot.climbSeconds`, and the same in reverse to get down.
 */
function restLoftPath(c, spot, seat, data) {
  const up = c.restPhase === 'up';
  const points = [
    c.restStandPoint(spot),
    ...spot.via.map((v) => ({ x: v.x, y: c.world.heightAt(v.x, v.z) + v.rise, z: v.z })),
    seat,
  ];
  const t = Math.min(1, (up ? c.fsm.time : c.fsm.time - c.downAt) / spot.climbSeconds);
  const k = up ? smooth(t) : 1 - smooth(t);
  const at = pathAt(points, k);
  c.root.position.set(at.x, at.y, at.z);
  const ahead = pathAt(points, Math.min(1, Math.max(0, k + (up ? 0.02 : -0.02))));
  const dx = ahead.x - at.x;
  const dz = ahead.z - at.z;
  if (Math.hypot(dx, dz) > 1e-4) c.heading = Math.atan2(dx, dz);
  c.root.rotation.y = c.heading;
  if (up && !at.climbing && c.loftClimbing) {
    c.loftClimbing = false;
    c.rig.play('Sitting', { once: true, fade: 0.3 });
  }
  if (t < 1) return;
  if (up) {
    c.restPhase = 'sat';
    c.rig.play('SitIdle', { fade: 0.4 });
    c.rig.legSpread = 0;
    c.heading = spot.yaw;
    c.root.rotation.y = spot.yaw;
  } else finishRest(c, data);
}

/** Back on her feet at the end of a rest: collider on, stood about, and whatever was waiting for her. */
export function finishRest(companion, data) {
  companion.setColliderEnabled(true);
  companion.restSpot = null;
  companion.fsm.transition('idle', { facing: companion.heading });
  data.then?.();
}
