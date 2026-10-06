import * as THREE from 'three';
import { PillionDynamics } from './pillionDynamics.js';
import { DEFAULT_PILLION_PARAMS } from './pillionParams.js';
import { solveTwoBone, orientHand } from './armIK.js';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = THREE.MathUtils.clamp;
// How a bend of the back is shared down the spine.
const SPINE = [
  ['Spine', 0.4],
  ['Spine1', 0.35],
  ['Spine2', 0.25],
];
const SIDES = [
  { side: 1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand', finger: 'LeftHandIndex1', thumb: 'LeftHandThumb1', clavicle: 'LeftShoulder', grip: 'pillionGripLeft' },
  { side: -1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand', finger: 'RightHandIndex1', thumb: 'RightHandThumb1', clavicle: 'RightShoulder', grip: 'pillionGripRight' },
];
// Where her head goes while riding behind you: [yaw, pitch, lean], with yaw and lean
// mirrored for the side. Lean tips her upper body over so she can see past you.
const GLANCES = {
  ahead: [0, 0, 0],
  overShoulder: [0.32, 0.12, 0.13],
  around: [1.0, 0.0, 0.03],
  down: [0.35, -0.3, 0.02],
};
const GLANCE_LIST = ['overShoulder', 'overShoulder', 'around', 'around', 'down', 'ahead'];

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _fingers = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _hugFingers = new THREE.Vector3();
const _gripFingers = new THREE.Vector3();

/**
 * Her body language sitting pillion: arms round your waist when you're in
 * front, hands on the rails (or her thighs) when you're not, leaning with the
 * quad, bobbing over bumps and looking about. Layered on top of the sitting
 * clip by the rig, after its own procedural offsets.
 *
 * Positions are worked out in the pillion anchor's space ("seat space"),
 * which is her root's parent: +X her left, +Y up, +Z forward.
 */
export class PillionPose {
  constructor(companion, params = { ...DEFAULT_PILLION_PARAMS }) {
    this.companion = companion;
    this.rig = companion.rig;
    this.params = params;
    this.dynamics = new PillionDynamics(params);
    this.active = false;
    this.weight = 0; // overall, fades in on the seat and out when she gets off
    this.together = 0; // 0 alone on the back, 1 arms round you
    this.arms = SIDES.map((s) => ({ ...s, pos: new THREE.Vector3(), weight: 0, aim: 0 }));
    this.head = { yaw: 0, pitch: 0, lean: 0 };
    this.glance = { kind: 'ahead', side: 1, left: 0, timer: 2 };
    this.lookBack = 0; // how much she's looking at you looking back at her
    this.grips = new WeakMap();
    this.throttleReach = 0; // 0..1: her right hand going round you to your throttle grip (throttleGrab.js)
  }

  /** She's sat down on the pillion seat. */
  engage() {
    this.active = true;
    this.dynamics.reset();
    const quad = this.companion.quad;
    this.together = quad.rider ? 1 : 0;
    // Start with her hands wherever the hold wants them, so she doesn't swing in from nowhere.
    for (const a of this.arms) {
      this.wantedHold(a, quad, a.pos);
      a.weight = 0;
    }
  }

  /** She's getting off; her body language fades back to the clips. */
  release() {
    this.active = false;
  }

  /** The quad's grip anchors, if it has any. */
  gripsOf(quad) {
    if (!this.grips.has(quad)) {
      const left = quad.model.getObjectByName('pillionGripLeft');
      const right = quad.model.getObjectByName('pillionGripRight');
      this.grips.set(quad, left && right ? { left, right, strap: !!left.userData.strap } : null);
    }
    return this.grips.get(quad);
  }

  /**
   * Where one hand wants to be with nobody in front, in seat space, and how
   * firmly (0 leaves it where the sitting clip puts it, on her thigh).
   */
  aloneHold(arm, quad, out) {
    const grips = this.gripsOf(quad);
    if (!grips) return 0;
    // A strap between her knees is only worth leaning for when the quad's moving.
    if (grips.strap && Math.abs(quad.forwardSpeed) < 1.5) return 0;
    const g = arm.side > 0 ? grips.left : grips.right;
    g.getWorldPosition(out);
    quad.pillionAnchor.worldToLocal(out);
    // The wrist sits above the rail with the fingers wrapped over it.
    out.y += 0.055;
    out.x -= arm.side * 0.025;
    return 1;
  }

  wantedHold(arm, quad, out) {
    const p = this.params;
    const hug = _w.set(arm.side * p.hugGap, p.hugHeight, p.hugAhead);
    const aloneWeight = this.aloneHold(arm, quad, out);
    if (aloneWeight === 0) out.copy(hug);
    const k = smooth(clamp(this.together, 0, 1));
    out.lerp(hug, k);
    // Lift the hand clear of her thigh on the way between holds.
    out.y += 0.05 * Math.sin(Math.PI * k) * aloneWeight;
    return aloneWeight + (1 - aloneWeight) * k;
  }

  /** Called from the seated state every frame. */
  update(dt) {
    const p = this.params;
    const c = this.companion;
    const quad = c.quad;
    quad.pillionAnchor.updateWorldMatrix(true, false);

    // The quad's motion in its own frame, for the leaning and bouncing.
    const body = quad.physics.body;
    const lv = body.linvel();
    const av = body.angvel();
    const qq = quad.model.quaternion;
    const fwd = _v.set(0, 0, 1).applyQuaternion(qq);
    const up = _s.set(0, 1, 0).applyQuaternion(qq);
    this.dynamics.update(dt, {
      forward: lv.x * fwd.x + lv.y * fwd.y + lv.z * fwd.z,
      up: lv.x * up.x + lv.y * up.y + lv.z * up.z,
      yawRate: av.x * up.x + av.y * up.y + av.z * up.z,
    });

    // Arms round you when you're on in front.
    const rider = quad.rider;
    const blend = Math.min(1, dt / Math.max(0.01, p.gripBlendTime));
    this.together = clamp(this.together + (rider ? blend : -blend), 0, 1);

    // Holding on to you she glances about instead of fidgeting.
    if (rider) c.fidgetTimer = Math.max(c.fidgetTimer, 1);
    // A fidget can take a hand off the rails while the quad's parked.
    const f = c.fidget;
    let freeSide = 0;
    let free = 0;
    if (f && !rider && Math.abs(quad.forwardSpeed) < 1 && (f.type === 'arm' || f.type === 'stretch')) {
      free = smooth(Math.min(1, f.t / 0.3)) * smooth(Math.min(1, (1 - f.t) / 0.3));
      freeSide = f.type === 'stretch' ? 0 : f.side;
    }
    const follow = Math.min(1, (dt * 3) / Math.max(0.01, p.gripBlendTime));
    for (const a of this.arms) {
      let want = this.wantedHold(a, quad, _target);
      if (a.side < 0 && this.throttleReach > 0.01 && quad.rider) {
        // Reaching round you to the grip your hand is on: the right one.
        const grip = quad.model.getObjectByName('gripRight');
        if (grip) {
          grip.getWorldPosition(_v);
          quad.pillionAnchor.worldToLocal(_v);
          _v.y += 0.07;
          _target.lerp(_v, smooth(this.throttleReach));
          want = Math.max(want, this.throttleReach);
        }
      }
      if (free && (freeSide === 0 || freeSide === a.side)) want *= 1 - free;
      a.pos.lerp(_target, follow);
      a.weight += (want - a.weight) * follow;
    }

    this.updateHead(dt, rider);
    // She sinks into the seat a little as she's squashed down, and shuffles up to you.
    c.root.position.y += this.dynamics.heave.x * 0.4;
    c.root.position.z += p.hugSlide * smooth(this.together);
  }

  /** Glances about while riding behind you, and looks at you when you look back at her. */
  updateHead(dt, rider) {
    const p = this.params;
    const g = this.glance;
    const looking = rider?.lookBack ?? 0;
    this.lookBack += ((looking > 0.6 ? 1 : 0) - this.lookBack) * Math.min(1, dt * p.headSpeed);
    let want = GLANCES.ahead;
    if (rider) {
      if (g.left > 0) {
        g.left -= dt;
        want = GLANCES[g.kind];
      } else if ((g.timer -= dt) <= 0) {
        g.kind = GLANCE_LIST[Math.floor(Math.random() * GLANCE_LIST.length)];
        g.side = Math.random() < 0.5 ? -1 : 1;
        g.left = p.glanceHoldMin + Math.random() * Math.max(0, p.glanceHoldMax - p.glanceHoldMin);
        g.timer = p.glanceEveryMin + Math.random() * Math.max(0, p.glanceEveryMax - p.glanceEveryMin);
      }
    }
    const k = Math.min(1, dt * p.headSpeed);
    const h = this.head;
    h.yaw += (want[0] * g.side - h.yaw) * k;
    h.pitch += (want[1] - h.pitch) * k;
    h.lean += (want[2] * g.side - h.lean) * k;
  }

  /** Poses the skeleton; the rig calls this after the clip and its own offsets. */
  apply(dt) {
    const p = this.params;
    this.weight += ((this.active ? 1 : 0) - this.weight) * Math.min(1, dt * 5);
    if (this.weight < 0.002) return;
    const W = smooth(this.weight);
    const rig = this.rig;
    const b = rig.bones;
    const quad = this.companion.quad;
    const seat = quad.pillionAnchor;
    const d = this.dynamics;
    const hold = smooth(this.together);
    const lb = smooth(this.lookBack);

    // Upper body: lean into the corner, over to glance past you, forward into you
    // and with the braking, slumping as the bumps squash her.
    const roll = (d.roll.x + this.head.lean * (1 - lb)) * W;
    // She sits up off your back to look at you when you turn round.
    const pitch = (d.pitch.x + hold * p.hugLean * (1 - 0.6 * lb) - d.heave.x * p.bounceSlump) * W;
    for (const [name, share] of SPINE) {
      rig.rotateAboutRootAxis(b[name], AXIS_X, pitch * share);
      // Positive roll leans to her left (+X), which is a negative turn about Z.
      rig.rotateAboutRootAxis(b[name], AXIS_Z, -roll * share);
    }

    // Head: keep her eyes up rather than following the lean, then turn to look.
    let yaw = this.head.yaw * (1 - lb);
    let lookPitch = this.head.pitch * (1 - lb) - pitch * 0.7;
    if (lb > 0.001) {
      const cam = this.lookAtAngles(quad.rider);
      if (cam) {
        yaw += cam.yaw * lb;
        lookPitch += cam.pitch * lb;
      }
    }
    yaw *= W;
    rig.rotateAboutRootAxis(b.Neck, AXIS_Y, yaw * 0.45);
    rig.rotateAboutRootAxis(b.Head, AXIS_Y, yaw * 0.55);
    rig.rotateAboutRootAxis(b.Neck, AXIS_X, -lookPitch * 0.4 * W);
    rig.rotateAboutRootAxis(b.Head, AXIS_X, -lookPitch * 0.6 * W);
    // A little tilt into the corner, against the lean, keeps her eyes level.
    rig.rotateAboutRootAxis(b.Head, AXIS_Z, roll * 0.5);

    // Arms.
    const seatQ = seat.getWorldQuaternion(_q);
    for (const a of this.arms) {
      const w = a.weight * W;
      if (w < 0.002) continue;
      // Shoulders come forward to reach round you.
      rig.rotateAboutRootAxis(b[a.clavicle], AXIS_Y, -a.side * 0.3 * hold * W);
      const shoulder = b[a.arm].getWorldPosition(_s);
      seat.worldToLocal(shoulder);
      // Elbows out round your waist when holding you; out and back holding the rails.
      _pole.set(a.side * (0.3 + 0.15 * hold), -0.12 - 0.1 * hold, -0.25 + 0.2 * hold).add(shoulder);
      seat.localToWorld(_pole);
      seat.localToWorld(_target.copy(a.pos));
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, w);

      // Fingers round your middle and palms against you, or wrapped over the rail.
      _hugFingers.set(-a.side * 0.9, -0.15, 0.4);
      _gripFingers.set(a.side * 0.35, -0.55, 0.75);
      _fingers.lerpVectors(_gripFingers, _hugFingers, hold).normalize().applyQuaternion(seatQ);
      _palm.set(a.side * 0.3 * (1 - hold), -(1 - hold), -hold).normalize().applyQuaternion(seatQ);
      orientHand(b[a.hand], b[a.finger], b[a.thumb], _fingers, _palm, a.side, w);
    }
  }

  /** Head yaw and pitch, in her root's frame, to look at the rider's eyes. */
  lookAtAngles(rider) {
    const anchor = rider?.vehicle?.cameraAnchor;
    if (!anchor) return null;
    const root = this.rig.root;
    const from = root.worldToLocal(this.rig.bones.Head.getWorldPosition(_v));
    // From the quad rather than the camera, which hasn't moved with it yet this frame.
    anchor.updateWorldMatrix(true, false);
    const eye = anchor.localToWorld(rider.lookBackOffset(_w));
    const to = root.worldToLocal(eye).sub(from);
    return {
      yaw: clamp(Math.atan2(to.x, to.z), -1.2, 1.2),
      pitch: clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.6, 0.6),
    };
  }
}
