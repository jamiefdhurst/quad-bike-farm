import * as THREE from 'three';
import {
  MOVES, sampleMove, shareOf, addPose, mirrorPose, SEAT_POSES, EMPTY_POSE, StandingIdles, DEFAULT_IDLE_POSE_PARAMS, SEATED_IDLES, seatedIdlesFor,
} from './poseMoves.js';

// Getting on and off things along a move from poseMoves.js, and the poses layered on her while she sits and stands about. As
// Companion methods, mixed in by companion.js; the boarding states in companionHayRide.js use the same runner.
//
// A move takes her hips from where she stood to the seat: `over` along the straight line between them, `lift` on top, while her
// body blends from standing to sitting. Her root is put wherever puts the hips there, so the pose and the path stay together.

const UP = new THREE.Vector3(0, 1, 0);
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const _v = new THREE.Vector3();
const _h = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _d = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/** from + (to - from), the fore-and-aft part (along `heading`) by `along` and the rest by `over`. */
function pathPoint(from, to, heading, over, along, out) {
  _d.copy(to).sub(from);
  _fwd.set(Math.sin(heading), 0, Math.cos(heading));
  const fa = _d.dot(_fwd);
  return out.copy(from).addScaledVector(_d, over).addScaledVector(_fwd, fa * (along - over));
}

export const DEFAULT_MOVE_PARAMS = {
  mountLift: 0.3, // metres: a foot up on a quad's footrest as she swings a leg over
  hopLift: 0.12, // metres of hop sitting back onto a seat
  stepLift: 0.32, // metres up onto the sill of the UTV or Land Rover
  climbLift: 0.55, // metres hauled up onto a trailer, an arch or a seat that high, unless the seat says otherwise
};

export const MOVE_PARAM_RANGES = {
  mountLift: [0, 0.8, 0.01],
  hopLift: [0, 0.5, 0.01],
  stepLift: [0, 0.8, 0.01],
  climbLift: [0, 1.2, 0.01],
};

/** Her hips' place in her root's frame, for a blend of standing (0) and sitting (1). */
function hipsAt(c, sit, out) {
  return out.copy(c.standHips).lerp(c.sitHips, sit);
}

export const moveMethods = {
  /**
   * Starts getting on (`dir` 1) or off (-1).
   * @param {object} o
   * @param {string} o.kind          a key of MOVES
   * @param {number} o.side          +1 she's on the seat's left, -1 its right
   * @param {number} o.duration      seconds for the whole move
   * @param {THREE.Object3D} o.seat  the seat, for her hands
   * @param {Function} o.seatEnd     () => { root, heading }: where her root goes sat down, and which way it faces (world)
   * @param {Function} o.standEnd    () => { position, facing }: where she stands (world)
   * @param {number} [o.lift]        metres, instead of the move's own lift height
   * @param {number} [o.twistTo]     a heading she turns to on the way (away from the seat, to sit back onto it)
   * @param {number} [o.from]        getting off part-way through getting on: how far on she'd got (0..1)
   */
  beginMove({ kind, side, duration, seat, seatEnd, standEnd, dir, lift, twistTo, from = dir > 0 ? 0 : 1 }) {
    const move = MOVES[kind];
    const p = this.moveParams;
    const m = {
      move, kind, side, duration, seat, seatEnd, standEnd, dir, from, k: from, time: 0,
      lift: lift ?? p[`${move.liftFrom}Lift`] ?? 0,
      twistTo,
    };
    // Where she starts: stood here (getting on), or sat there (getting off); the other end is followed as it moves.
    const f0 = sampleMove(move, from, side);
    m.f0 = f0;
    m.startHeading = this.heading;
    m.startHips = hipsAt(this, f0.sit, new THREE.Vector3()).applyAxisAngle(UP, this.heading).add(this.root.position);
    m.startHips.addScaledVector(UP, -f0.lift * m.lift);
    this.moving = m;
    this.rig.poseSeat = seat;
    return m;
  },

  /** Steps the move on; returns true when she's sat down or stood up. */
  stepMove(dt) {
    const m = this.moving;
    if (!m) return true;
    m.time += dt;
    const span = m.dir > 0 ? 1 - m.from : m.from;
    const run = span > 0 ? Math.min(1, m.time / (m.duration * Math.max(0.25, span))) : 1;
    m.k = m.dir > 0 ? m.from + span * run : m.from - span * run;
    const f = sampleMove(m.move, m.k, m.side);
    const seat = m.seatEnd();
    const twist = m.twistTo === undefined ? 0 : angleTo(seat.heading, m.twistTo);
    let hips;
    let heading;
    if (m.dir > 0) {
      const seatHips = hipsAt(this, 1, _h).applyAxisAngle(UP, seat.heading).add(seat.root);
      hips = pathPoint(m.startHips, seatHips, seat.heading, f.over, f.along, _v);
      heading = m.startHeading + angleTo(m.startHeading, seat.heading) * f.turn + twist * f.twist;
    } else {
      const stand = m.standEnd();
      const standHips = hipsAt(this, 0, _h).applyAxisAngle(UP, stand.facing).add(stand.position);
      hips = pathPoint(standHips, m.startHips, seat.heading, shareOf(f.over, m.f0.over), shareOf(f.along, m.f0.along), _v);
      const startFacing = m.startHeading - twist * m.f0.twist;
      heading = stand.facing + angleTo(stand.facing, startFacing) * shareOf(f.turn, m.f0.turn) + twist * f.twist;
    }
    hips.addScaledVector(UP, f.lift * m.lift);
    this.heading = heading;
    this.root.position.copy(hips).sub(hipsAt(this, f.sit, _h).applyAxisAngle(UP, heading));
    this.root.rotation.set(0, heading, 0);
    this.rig.mix('Idle', 'SitIdle', f.sit);
    this.moveFrame = f;
    return run >= 1;
  },

  endMove() {
    this.moving = null;
    this.moveFrame = null;
    this.rig.poseSeat = null;
  },

  /** How far through getting on she is (0 on the ground, 1 sat), while a move is running. */
  get moveK() {
    return this.moving?.k ?? 0;
  },

  /** Which way she gets on a quad's seat: astride, or sat back onto it side-saddle or on the rack; up into a tractor's seat. */
  quadMoveKind(front) {
    if (front) return this.quad.tractor ? 'climbUp' : 'legOver';
    if (this.seatKind === 'rack' || this.sideSaddle) return 'hopOn';
    return 'legOver';
  },

  /** The pose for how she sits on the seat she's on (SEAT_POSES), or null. */
  seatPoseName(front) {
    if (this.quad?.tractor && front) return 'bench';
    if (front) return 'astride';
    if (this.seatKind === 'rack') return 'rack';
    if (this.sideSaddle) return 'side';
    return 'astride';
  },

  /** Where her root goes sat on a quad's seat, and which way it faces, in the world. */
  quadSeatEnd(front) {
    const anchor = this.seatAnchor(front);
    const root = anchor.localToWorld(this.seatOffset(front));
    _e.setFromQuaternion(anchor.getWorldQuaternion(_q), 'YXZ');
    return { root, heading: _e.y + (front ? 0 : this.sideAngle) };
  },

  /**
   * The pose layered on her this frame: the move's, or how she sits, or a way of standing about, eased between them. Called before
   * the rig updates.
   */
  updatePose(dt) {
    this.standingIdles ??= new StandingIdles(this.character?.idles ?? [], this.idlePoseParams ?? DEFAULT_IDLE_POSE_PARAMS);
    const standing = this.fsm.is('idle') && !this.warmingAt && !this.waving && !this.recoil && !this.attempt;
    let pose = this.standingIdles.update(dt, standing);
    // Sat a while somewhere nothing else is posing her: her own ways of sitting, to suit the seat.
    this.seatedIdles ??= new StandingIdles([], this.idlePoseParams ?? DEFAULT_IDLE_POSE_PARAMS, Math.random, SEATED_IDLES);
    const seat = this.seatIdleContext();
    if (seat) {
      const names = seatedIdlesFor(this.character?.seatedIdles ?? [], seat.kind, seat.window);
      const key = names.join();
      if (key !== this.seatedIdleKey) {
        this.seatedIdleKey = key;
        this.seatedIdles.setNames(names);
      }
    }
    pose = addPose(pose, this.seatedIdles.update(dt, !!seat));
    const f = this.moveFrame;
    if (f) {
      pose = addPose(pose, f.pose);
      const sitName = this.movingSeatPose;
      if (sitName && SEAT_POSES[sitName]) pose = addPose(pose, this.sidedSeatPose(sitName), f.sit);
    } else if (this.sittingPose && SEAT_POSES[this.sittingPose]) {
      pose = addPose(pose, this.sidedSeatPose(this.sittingPose));
    }
    this.rig.pose = pose === EMPTY_POSE ? EMPTY_POSE : pose;
  },

  /**
   * The seat she's sat a while on, for her ways of sitting: { kind: 'bench' | 'perch', window }, or null where something else has
   * her (getting on or off, lying back on the bales, thrown about, the pillion and the front seat, where she holds on).
   */
  seatIdleContext() {
    if (this.moving) return null;
    if (this.fsm.is('onTrailer')) {
      const d = this.fsm.data;
      const slot = this.traSlot;
      if (!slot || d.lie || d.leaving || d.fromWorld || (d.leanK ?? 0) > 0.02 || (this.hayFlailT ?? 0) > 0) return null;
      if ((this.trailer?.motion.jolt ?? 0) > 0.6) return null;
      return slot.move === 'stepIn' ? { kind: 'bench', window: slot.name === 'left' } : { kind: 'perch', window: false };
    }
    if (this.fsm.is('seated') && this.seatKind === 'rack') return { kind: 'perch', window: false };
    return null;
  },

  /** A seat pose, mirrored for side-saddle on her right. */
  sidedSeatPose(name) {
    const pose = SEAT_POSES[name];
    return name === 'side' && this.sideSaddle < 0 ? mirrorPose(pose) : pose;
  },
};
