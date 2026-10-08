import * as THREE from 'three';
import { solveTwoBone } from './armIK.js';
import { Carry, CARRY_ITEMS, carryLean, carryPace } from './carrying.js';

// Her carrying something in her right hand (carrying.js says how heavy it is and the stages). As Companion methods, mixed in by
// companion.js. The thing keeps its own model; while she has it, this places it from her hand each frame, and when she puts it down
// the caller's `onLowered` puts it back to being a normal item on the ground.

const smooth = (t) => t * t * (3 - 2 * t);
const SIDE = -1; // her right hand: -x in her own frame
const _hand = new THREE.Vector3();
const _grip = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _shoulder = new THREE.Vector3();

export const carryingMethods = {
  /**
   * She takes hold of `model` (a kind from CARRY_ITEMS) from where it is. `weight` is 0..1; `sip` has her drink from it once she has it, `inHand` that she has it already.
   * `onRaised` is called when she's got it up, `onSipped` when she has had her drink, `onLowered` once she has put it down (see `putDownCarry`). Not while she's carrying already.
   */
  startCarry(kind, model, weight, { sip = false, inHand = false, onRaised = null, onSipped = null, onLowered = null } = {}) {
    if (this.carry) return false;
    const item = CARRY_ITEMS[kind];
    this.scene.attach(model);
    model.scale.set(1, 1, 1);
    const core = new Carry(kind, weight, this.carryParams, { sip });
    if (inHand) core.inHand();
    this.carry = {
      kind,
      model,
      item,
      core,
      from: model.position.clone(), // where it was lying, for the lift
      fromYaw: model.rotation.y,
      to: new THREE.Vector3(), // where it's going down
      toYaw: 0,
      onRaised,
      onSipped,
      onLowered,
      stride: 0,
    };
    return true;
  },

  /** Sets it down at `position` (world, on the ground) turned to `yaw`; `onLowered` is called with those when it's down. */
  putDownCarry(position, yaw, onLowered = null) {
    const c = this.carry;
    if (!c) return false;
    c.to.set(position.x, position.y ?? this.world.heightAt(position.x, position.z) + 0.005, position.z);
    c.toYaw = yaw;
    if (onLowered) c.onLowered = onLowered;
    c.core.lower();
    return true;
  },

  /** Lets go of it where she stands, wherever she's got to (she's been called away). */
  dropCarry() {
    const c = this.carry;
    if (!c) return;
    const side = this.root.localToWorld(new THREE.Vector3(SIDE * 0.35, 0, 0.1));
    c.to.set(side.x, this.world.heightAt(side.x, side.z) + 0.005, side.z);
    c.toYaw = this.root.rotation.y + c.item.yaw;
    this.finishCarry(c);
  },

  /** Lets go of it without setting it down anywhere: the caller has dealt with it. */
  endCarry() {
    this.carry = null;
    this.carryPace = 1;
  },

  /** Whether she has something in her hand, or is putting it down. */
  get carrying() {
    return !!this.carry;
  },

  finishCarry(c) {
    this.carry = null;
    this.carryPace = 1;
    c.onLowered?.(c.to, c.toYaw);
  },

  /** Stages, her pace and her lean. Called each frame before the rig is posed. */
  updateCarry(dt) {
    const c = this.carry;
    if (!c) {
      this.carryPace = 1;
      return;
    }
    // Called away to ride or sit: she can't take it with her.
    if (!this.fsm.is('idle', 'walking', 'pranking')) return this.dropCarry();
    const event = c.core.update(dt);
    if (event === 'raised') c.onRaised?.();
    if (event === 'lowered') return this.finishCarry(c);
    if (c.core.sipping && c.core.sipped && c.core.phase === 'hold' && !c.sipDone) {
      c.sipDone = true;
      c.onSipped?.();
    }
    const p = this.carryParams;
    const walking = this.fsm.is('walking');
    this.carryPace = walking && c.core.k > 0.7 ? carryPace(p, c.kind, c.core.weight) : 1;
    c.stride += dt * (walking ? 1 : 0) * 5.5;
    const o = this.rig.offsets;
    o.spineRoll += SIDE * carryLean(p, c.core.weight) * c.core.ease * (c.kind === 'mug' ? 0 : 1);
    o.spinePitch += p.bend * c.core.stoop * Math.min(1, c.core.weight * 2 + 0.4);
  },

  /** The arm to the thing, and the thing to the hand. Runs as a rig poser. */
  poseCarrying(dt) {
    const c = this.carry;
    if (!c) return;
    const b = this.rig.bones;
    if (!b.RightArm || !b.RightForeArm || !b.RightHand) return;
    const core = c.core;
    const e = core.ease;
    const p = this.carryParams;
    this.root.updateMatrixWorld(true);
    // Where her wrist goes when she's walking with it (swinging a little with her stride), or up at her mouth for a sip.
    const [hx, hy, hz] = c.item.hand;
    const sway = Math.sin(c.stride) * p.sway;
    _hand.set(SIDE * hx, hy, hz + sway);
    if (core.sip > 0) _hand.lerp(_shoulder.set(SIDE * 0.04, 1.4, 0.2), core.sip);
    this.root.localToWorld(_hand);
    // Where the grip is while it is on the ground (a lift or a lowering starts and ends there).
    const ground = core.phase === 'lower' || (core.phase === 'done') ? c.to : c.from;
    _grip.set(ground.x, ground.y + c.item.grip, ground.z).lerp(_hand, e);
    // The arm reaches for the grip.
    b.RightArm.getWorldPosition(_shoulder);
    _pole.set(SIDE * 0.5, -0.1, -0.35);
    this.root.localToWorld(_pole);
    _pole.y = _shoulder.y - 0.25;
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _grip, _pole, smooth(Math.min(1, e * 3 + 0.35)));
    // It hangs from the grip, turned with her as she is, easing round from how it was lying.
    const yaw = this.root.rotation.y + c.item.yaw;
    const from = core.phase === 'lower' ? c.toYaw : c.fromYaw;
    let d = yaw - from;
    d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
    c.model.position.set(_grip.x, _grip.y - c.item.grip, _grip.z);
    c.model.rotation.set(0, from + d * e, 0);
  },
};
