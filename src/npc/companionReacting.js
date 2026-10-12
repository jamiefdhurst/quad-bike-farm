// Her reactions with her body (reactions.js says which and when): a flinch, a step back, hands over her ears or her mouth, a cheer, a wave at someone going by, and
// turning away from smoke. Mixed into Companion; poseReacting runs as the last rig poser, so a reaction shows over whatever else she's
// doing with her arms.
import * as THREE from 'three';
import { REACTIONS, reactionTo, reactionWeight, mayInterrupt } from './reactions.js';
import { headingTo } from './attention.js';
import { solveTwoBone } from './armIK.js';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const ARMS = [
  { side: 1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand', clavicle: 'LeftShoulder' },
  { side: -1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand', clavicle: 'RightShoulder' },
];
const _at = new THREE.Vector3();
const _head = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();

export const reactingMethods = {
  /**
   * Reacts with her body now: `type` one of REACTIONS, `from` where the thing is ({ x, y, z }: she steps back from it, turns away
   * from it), `strength` how big (1 usual). Something stronger already under way wins unless `force`. Returns whether she did.
   */
  react(type, { from = null, strength = 1, force = false } = {}) {
    if (!REACTIONS[type] || !this.mayReact(type)) return false;
    if (!force && !mayInterrupt(type, this.reaction)) return false;
    this.reaction = { type, t: 0, from: from ? { x: from.x, y: from.y ?? 0, z: from.z } : null, strength };
    if (type === 'stepBack' && from) this.jumpBack(from);
    if (type === 'turnAway') this.waveOff(REACTIONS.turnAway.seconds - 0.6);
    return true;
  },

  /**
   * Whether she's free to do this reaction now. 'any' (a flinch) she can do anywhere; 'feet' (a step back, turning away) needs her
   * stood or walking; 'hands' needs her hands free too: not driving, holding on behind you, carrying, warming them, starting a quad, or on her phone or a seat.
   */
  mayReact(type) {
    const needs = REACTIONS[type]?.needs;
    if (!needs) return false;
    if (needs === 'any') return true;
    const onFoot = this.root.parent === this.scene && this.fsm.is('idle', 'walking', 'pranking');
    if (needs === 'feet') return onFoot && !this.attempt;
    if (this.carrying || this.warmingAt || this.attempt || this.waitHands?.()) return false;
    return onFoot || this.fsm.is('resting', 'onTrailer') || (this.fsm.is('seated') && this.seatKind === 'rack');
  },

  /** Told of a notice (attention.js): whether it makes her move (reactions.js), and if so she does. */
  reactToNotice(n) {
    const at = this.root.getWorldPosition(_at);
    const own = this.root.parent !== this.scene && !!this.quad?.unit && n.key === this.quad.unit.id;
    const ctx = { distance: Math.hypot(n.x - at.x, n.z - at.z), own, can: (t) => this.mayReact(t), current: this.reaction };
    const r = reactionTo(n, ctx, this.params);
    if (r) this.react(r.type, r);
  },

  /** Each frame: the reaction's clock, and turning her face away from smoke while she does. */
  updateReaction(dt) {
    const r = this.reaction;
    this.reactTurn = null;
    if (!r) return;
    r.t += dt;
    if (r.t >= REACTIONS[r.type].seconds) {
      this.reaction = null;
      return;
    }
    if (r.type === 'turnAway' && r.from) {
      const at = this.root.getWorldPosition(_at);
      const away = headingTo(r.from.x, r.from.z, at.x, at.z);
      this.reactTurn = away;
      this.attend({ x: at.x + Math.sin(away) * 6, y: at.y + 1.2, z: at.z + Math.cos(away) * 6 }, { weight: 4 });
    }
  },

  /** What the reaction is (for the debug panel and the console). */
  get reactingText() {
    const r = this.reaction;
    return r ? `${r.type}, ${r.t.toFixed(1)} of ${REACTIONS[r.type].seconds} s` : 'nothing';
  },

  /** The reaction's pose, over whatever else she's doing. Runs as the last rig poser. */
  poseReacting() {
    const r = this.reaction;
    if (!r) return;
    const k = reactionWeight(r.type, r.t) * Math.min(1.2, r.strength ?? 1);
    if (k < 0.01) return;
    const rig = this.rig;
    const b = rig.bones;
    if (!b.Spine2 || !b.Head) return;
    const p = this.params;
    if (r.type === 'flinch' || r.type === 'stepBack') {
      // Hunched forward, shoulders up, head down (and on a flinch, her hands up in front of her: placed below).
      const f = k * p.reactFlinch * (r.type === 'stepBack' ? 0.6 : 1);
      rig.rotateAboutRootAxis(b.Spine2, AXIS_X, 0.18 * f);
      for (const a of ARMS) rig.rotateAboutRootAxis(b[a.clavicle], AXIS_Z, a.side * 0.15 * f);
      rig.rotateAboutRootAxis(b.Neck, AXIS_X, 0.15 * f);
      if (r.type === 'stepBack') return;
    }
    if (r.type === 'turnAway') {
      rig.rotateAboutRootAxis(b.Spine2, AXIS_X, -0.08 * k); // leaning back from it (the waving hand is poseWaving's)
      return;
    }
    if (r.type === 'wave') {
      // Her right hand up beside her head, swinging from side to side; the left hangs as it was.
      const root = this.root;
      root.updateMatrixWorld(true);
      const head = root.worldToLocal(b.Head.getWorldPosition(_head));
      const shoulder = root.worldToLocal(b.RightArm.getWorldPosition(_shoulder));
      const swing = Math.sin(r.t * 9);
      _target.set(shoulder.x - 0.2 + 0.09 * swing, head.y + 0.16, shoulder.z + 0.12);
      _pole.set(shoulder.x - 0.45, shoulder.y - 0.15, shoulder.z - 0.05);
      root.localToWorld(_target);
      root.localToWorld(_pole);
      solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _target, _pole, Math.min(1, k));
      return;
    }
    if (r.type === 'pose' || r.type === 'palm') {
      // One hand: on her right hip with her head tilted (pose), or flat up in front of her face (palm). The left hangs as it was.
      const root = this.root;
      root.updateMatrixWorld(true);
      const head = root.worldToLocal(b.Head.getWorldPosition(_head));
      const shoulder = root.worldToLocal(b.RightArm.getWorldPosition(_shoulder));
      if (r.type === 'pose') {
        _target.set(shoulder.x - 0.1, shoulder.y - 0.42, shoulder.z + 0.04);
        _pole.set(shoulder.x - 0.55, shoulder.y - 0.3, shoulder.z - 0.1);
        rig.rotateAboutRootAxis(b.Neck, AXIS_Z, 0.14 * k);
      } else {
        _target.set(shoulder.x + 0.2, head.y - 0.03, head.z + 0.26 + 0.03 * Math.sin(r.t * 8));
        _pole.set(shoulder.x - 0.3, shoulder.y - 0.25, shoulder.z + 0.1);
      }
      root.localToWorld(_target);
      root.localToWorld(_pole);
      solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _target, _pole, Math.min(1, k));
      return;
    }
    if (r.type === 'face') rig.rotateAboutRootAxis(b.Neck, AXIS_Z, 0.18 * k * Math.sin(r.t * 6)); // head wobbling, hands in below
    // The rest place both hands, in her own frame: x to her left, y up, z forward. The targets are the wrists, and the fingers reach
    // on past them, so a hand meant to be at her middle is aimed short of it or the arms cross.
    const root = this.root;
    root.updateMatrixWorld(true);
    const head = root.worldToLocal(b.Head.getWorldPosition(_head));
    const swing = Math.sin(r.t * 10);
    for (const a of ARMS) {
      if (!b[a.arm] || !b[a.fore] || !b[a.hand]) continue;
      const shoulder = root.worldToLocal(b[a.arm].getWorldPosition(_shoulder));
      const s = a.side;
      if (r.type === 'flinch') {
        // Hands up in front of her chest, palms out, as if to fend it off.
        _target.set(shoulder.x - s * 0.02, shoulder.y - 0.04, shoulder.z + 0.3);
        _pole.set(shoulder.x + s * 0.25, shoulder.y - 0.45, shoulder.z);
      } else if (r.type === 'face') {
        // Hands out beside her cheeks, wiggling.
        _target.set(head.x + s * (0.2 + 0.03 * swing), head.y - 0.04 + 0.03 * swing, head.z + 0.06);
        _pole.set(shoulder.x + s * 0.35, shoulder.y - 0.2, shoulder.z + 0.1);
      } else if (r.type === 'coverEars') {
        _target.set(head.x + s * 0.12, head.y + 0.05, head.z + 0.03);
        _pole.set(shoulder.x + s * 0.3, shoulder.y - 0.2, shoulder.z + 0.3);
      } else if (r.type === 'gasp') {
        _target.set(head.x + s * 0.08, head.y - 0.03, head.z + 0.13);
        _pole.set(shoulder.x + s * 0.15, shoulder.y - 0.3, shoulder.z + 0.1);
      } else if (p.reactCheerArms >= 0.5) {
        // Arms up and pumping.
        _target.set(shoulder.x + s * 0.28, shoulder.y + 0.5 * p.reactCheerArms + 0.04 * swing, shoulder.z + 0.1);
        _pole.set(shoulder.x + s * 0.5, shoulder.y, shoulder.z - 0.1);
      } else {
        // A clap in front of her chest, hands meeting and parting.
        _target.set(s * (0.1 + 0.07 * Math.abs(swing)), shoulder.y - 0.06, shoulder.z + 0.34);
        _pole.set(shoulder.x + s * 0.3, shoulder.y - 0.35, shoulder.z);
      }
      root.localToWorld(_target);
      root.localToWorld(_pole);
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, Math.min(1, k));
    }
  },
};
