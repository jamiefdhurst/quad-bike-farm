import * as THREE from 'three';
import { driveMood, pickConfidence, afterDrive } from './driveMood.js';
import { HerDrive } from './herDriving.js';
import { DEFAULT_STARTING_PARAMS } from './startingAttempt.js';
import { DEFAULT_LINEUP_PARAMS, parkRoute } from './lineUp.js';
import { DEFAULT_HOME_PARAMS, bringsItHome, pickHomeSpot } from './homeParking.js';
import { solveTwoBone, orientHand } from './armIK.js';
import { AutoShifter, NoviceShifter, DEFAULT_SHIFTER_PARAMS, DEFAULT_NOVICE_PARAMS } from '../vehicle/autoShifter.js';
import { DEFAULT_TRACTOR_START_PARAMS } from './tractorStart.js';

// Her driving a quad herself, as Companion states and methods: getting on the
// front, driving (the logic is HerDrive in herDriving.js), shuffling between
// the front seat and the back, and her hands on the grips. Mixed into
// Companion by companion.js.

/** How a girl drives the tractor, apart from the clutch (the novice shifter's own numbers are in autoShifter.js). */
export const DEFAULT_TRACTOR_GO_DRIVE = {
  jessSpeedMin: 1.4, // m/s she is happy at...
  jessSpeedMax: 3.4,
  amySpeedMin: 2.5,
  amySpeedMax: 5.5,
  forMin: 40, // seconds of driving before she has had enough
  forMax: 70,
  maxThrottle: 0.7, // the most throttle she gives it
  jessMaxStalls: 6, // she stalls it a lot, and keeps going
};

export const TRACTOR_GO_DRIVE_RANGES = {
  jessSpeedMin: [0.5, 6, 0.1],
  jessSpeedMax: [0.5, 8, 0.1],
  amySpeedMin: [0.5, 8, 0.1],
  amySpeedMax: [0.5, 8.5, 0.1],
  forMin: [10, 300, 5],
  forMax: [10, 400, 5],
  maxThrottle: [0.2, 1, 0.05],
  jessMaxStalls: [0, 15, 1],
};

const smooth = (t) => t * t * (3 - 2 * t);
const SHUFFLE_DURATION = 0.9; // seconds to slide between the front seat and the back

const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _fingers = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _q = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const ARMS = [
  { side: 1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand', finger: 'LeftHandIndex1', thumb: 'LeftHandThumb1', grip: 'gripLeft' },
  { side: -1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand', finger: 'RightHandIndex1', thumb: 'RightHandThumb1', grip: 'gripRight' },
];

export const drivingStates = {
  // On the front seat with the quad hers: starting it, driving, stopping.
  driving: {
    enter() {
      const q = this.quad;
      this.setColliderEnabled(false);
      q.riderAnchor.add(this.root);
      this.root.position.copy(this.seatOffset(true));
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = this.params.legSpread;
      this.driveExit = null;
      // How she feels about it this time: careful, confident or somewhere between.
      this.driveConfidence ??= this.params.driveConfidence;
      this.driveMood = pickConfidence(this.driveConfidence, this.params.driveMoodSwing);
      // Giving you a ride: bigger loops, and she waits for you to get on.
      const ride = this.giveRide;
      this.giveRide = false;
      // Her own idea to take you out: it lasts about as long as any drive of hers, rather than until you say stop.
      const offered = this.offeredRide;
      this.offeredRide = false;
      const following = this.followWanted;
      this.followWanted = false;
      const race = this.raceWanted;
      this.raceWanted = null;
      const followWho = this.followWhoWanted;
      this.followWhoWanted = null;
      const convoyLead = this.convoyLeadWanted;
      this.convoyLeadWanted = false;
      const doughnut = this.doughnutWanted;
      this.doughnutWanted = null;
      const jump = this.jumpWanted;
      this.jumpWanted = null;
      const showOff = this.showOffWanted;
      this.showOffWanted = null;
      const park = this.parkWanted;
      this.parkWanted = null;
      const params = driveMood(this.params, this.driveMood);
      params.driveSpeedMaxBase = this.params.driveSpeedMax;
      // What she goes back to if she carries on driving when an activity is over (HerDrive.carryOn).
      const after = Object.fromEntries(['driveMaxThrottle', 'driveScareSpeed', 'drivePauseChance', 'driveForMin', 'driveForMax', 'driveLoopRadiusMin', 'driveLoopRadiusMax'].map((k) => [k, params[k]]));
      if (offered) {
        params.driveForMin = this.params.offerRideForMin;
        params.driveForMax = this.params.offerRideForMax;
      }
      if (following) {
        // Keeping up with you takes more throttle than pottering about, and she minds speed less.
        params.driveMaxThrottle = Math.min(1, this.params.followMaxThrottle * (params.driveSpeedMax / this.params.driveSpeedMax));
        params.driveScareSpeed = this.params.followScareSpeed;
      }
      if (convoyLead) {
        // Out in front of the other girl: big loops, and she keeps going until the convoy ends.
        params.driveForMin = params.driveForMax = 1e6;
        params.driveLoopRadiusMin *= this.params.rideLoopScale;
        params.driveLoopRadiusMax *= this.params.rideLoopScale;
      }
      if (doughnut || jump || showOff) {
        params.driveMaxThrottle = 1;
        params.driveScareSpeed = 99; // she's not frightened by the speed, only by tipping over
      }
      const nick = this.nickJob;
      if (nick?.phase === 'away') params.driveForMin = params.driveForMax = nick.seconds; // having fun with yours, for as long as she likes
      if (park) {
        // Tidying: slow and careful, nothing frightens her off. Bringing yours back is quicker.
        params.driveSpeedMin = params.driveSpeedMax = park.nick ? nick.returnSpeed : this.params.parkSpeed;
        params.driveScareSpeed = 99;
        params.drivePauseChance = 0;
      }
      if (race) {
        // Racing: flat out, no pauses, nothing frightens her off.
        params.driveMaxThrottle = race.throttle;
        params.driveScareSpeed = 99;
        params.drivePauseChance = 0;
      }
      if (ride || q.passenger) {
        params.driveLoopRadiusMin *= this.params.rideLoopScale;
        params.driveLoopRadiusMax *= this.params.rideLoopScale;
      }
      if (q.tractor) this.tractorGoParams(params);
      this.drive = new HerDrive(q, {
        params,
        tractorStarting: this.tractorStartParams ?? DEFAULT_TRACTOR_START_PARAMS,
        passenger: () => !!q.passenger,
        skill: this.skillLevels,
        startingParams: { ...DEFAULT_STARTING_PARAMS, pullWhenFlat: this.params.startPullWhenFlat },
        momentWindow: this.skillMomentWindow?.(),
        friend: () => this.friendOnBack(),
        waitForPassenger: ride,
        after,
        race,
        park,
        doughnut: doughnut ? { ...doughnut, spinning: false, t: 0 } : null,
        jump,
        showOff: showOff ? { ...showOff, you: () => this.showOffYou() } : null,
        tires: offered,
        follow: following ? () => {
          const lead = (followWho ?? this.followTarget)?.();
          return lead && lead !== q ? lead : null;
        } : null,
        probe: (heading, distance) => this.driveProbe(heading, distance),
        isClear: (a, b) => this.driveClear(a, b),
      });
      q.setDriver(this.drive);
    },
    update(dt) {
      const q = this.quad;
      const d = this.drive;
      this.root.position.copy(this.seatOffset(true));
      this.rig.legSpread = this.params.legSpread;

      // You've got on: she moves onto the back (or off, if there's no back).
      if (q.rider) {
        d.stop('taken');
        q.setDriver(null);
        this.driveEvents.push('taken');
        if (q.hasPillion && !this.takenByOther(q, 'pillion')) this.fsm.transition('shuffling', { to: 'pillion' });
        else this.fsm.transition('dismounting');
        return;
      }
      if (q.isTipped) {
        q.setDriver(null);
        this.driveEvents.push('done:scared');
        this.fsm.transition('dismounting');
        return;
      }

      this.probeIgnore = d.follow?.()?.physics.collider.handle ?? null;
      for (const e of d.update(dt)) {
        if (e.startsWith('practice:')) this.onPractice?.(e.slice(9));
        else if (e.startsWith('start:')) this.startEvents.push(e.slice(6));
        else this.driveEvents.push(e);
      }
      if (d.done) this.endDrive();
    },
    exit() {
      if (this.quad.driver === this.drive) this.quad.setDriver(null);
    },
  },

  // Sliding back onto the pillion, or forward onto the front seat.
  shuffling: {
    enter(data) {
      const q = this.quad;
      if (data.to === 'pillion' && q.driver === this.drive) q.setDriver(null);
      q.model.attach(this.root);
      this.shuffleFrom = this.root.position.clone();
    },
    update(dt, data) {
      const q = this.quad;
      // You've got on while she was sliding forward: back she goes.
      if (data.to === 'rider' && q.rider) {
        data.to = 'pillion';
        this.shuffleFrom = this.root.position.clone();
        this.fsm.time = 0;
      }
      const front = data.to === 'rider';
      const t = Math.min(1, this.fsm.time / SHUFFLE_DURATION);
      const k = smooth(t);
      const anchor = front ? q.riderAnchor : q.pillionAnchor;
      const end = anchor.position.clone().add(this.seatOffset(front));
      this.root.position.lerpVectors(this.shuffleFrom, end, k);
      this.root.position.y += Math.sin(Math.PI * k) * 0.06;
      this.root.quaternion.identity();
      if (t >= 1) {
        // Climbed forward to stop a runaway: once it's stopped, key off and get down.
        if (front && !q.rider && this.takeOverPlan === 'stop') {
          if (q.speed > 0.4) return;
          this.takeOverPlan = null;
          q.engine.setIgnition(false);
          this.fsm.transition('dismounting');
          return;
        }
        this.takeOverPlan = null;
        this.fsm.transition(front && !q.rider ? 'driving' : 'seated');
      }
    },
  },
};

export const drivingMethods = {
  /**
   * Her go on the tractor: slow and steady, not scared off by speed, and her own way with the clutch: Jess's is the novice's (stays
   * in the low gears, kangaroos, stalls it), Amy's is a good driver's. `params` is her drive params for this go, changed in place.
   */
  tractorGoParams(params) {
    const jess = this.character.id === 'jess';
    const t = this.tractorGo ?? DEFAULT_TRACTOR_GO_DRIVE;
    params.driveSpeedMin = jess ? t.jessSpeedMin : t.amySpeedMin;
    params.driveSpeedMax = jess ? t.jessSpeedMax : t.amySpeedMax;
    params.driveForMin = t.forMin;
    params.driveForMax = t.forMax;
    params.driveMaxThrottle = t.maxThrottle;
    params.driveScareSpeed = 99;
    params.driveMaxStalls = jess ? t.jessMaxStalls : params.driveMaxStalls;
    this.quad.shifter = jess ? new NoviceShifter(DEFAULT_SHIFTER_PARAMS, this.noviceParams ?? DEFAULT_NOVICE_PARAMS) : new AutoShifter();
  },

  /** Walks to the front of a quad, gets on and has a little drive; with `giveRide`, waits for you on the back. */
  requestDrive(quad, { giveRide = false, follow = false, race = null, followWho = null, convoyLead = false, doughnut = null, jump = null, park = null, showOff = null } = {}) {
    this.giveRide = giveRide;
    this.offeredRide = false;
    this.followWanted = follow;
    this.raceWanted = race; // a race to drive in (npc/race.js)
    this.followWhoWanted = followWho; // following something other than you: a convoy (npc/convoy.js)
    this.convoyLeadWanted = convoyLead; // leading one
    this.doughnutWanted = doughnut; // spinning doughnuts (npc/doughnuts.js)
    this.showOffWanted = showOff; // riding at you to do a wheelie or a skid (npc/showOff.js)
    this.jumpWanted = jump; // riding at the ramp in the field (npc/jumps.js)
    this.parkWanted = park; // moving it into the row in front of the barn (npc/lineUp.js)
    if (this.fsm.is('driving')) {
      if (quad !== this.quad) this.stopDriving('off', () => this.requestDrive(quad, { giveRide, follow, race, followWho, convoyLead, doughnut, jump, park, showOff }));
      return;
    }
    if (this.fsm.is('shuffling', 'dismounting')) return;
    if (this.fsm.is('seated') && quad === this.quad && this.seatKind !== 'rack') {
      this.fsm.transition('shuffling', { to: 'rider' });
      return;
    }
    if (this.fsm.is('seated', 'mounting')) {
      this.afterDismount = () => this.requestDrive(quad, { giveRide, follow, race, followWho, convoyLead, doughnut, jump, park, showOff });
      this.fsm.transition('dismounting');
      return;
    }
    this.quad = quad;
    this.fsm.transition('walking', { goal: 'drive', target: () => this.driveMountPoint() });
  },

  /** You're sat on the back of this parked quad with nobody driving it: she goes over, gets on the front and takes you for a ride. */
  offerRide(quad) {
    // Sat out somewhere: she gets down first.
    if (this.isResting) return void this.leaveRest(() => this.offerRide(quad));
    this.selfEvents.push('offerRide');
    this.requestDrive(quad, { giveRide: true });
    this.offeredRide = true; // after requestDrive, which resets it for anything else she's asked to do
  },

  /** Free to offer you a ride on this quad: standing about, and nobody else is on it or heading for it. */
  canOfferRide(quad) {
    return (this.fsm.is('idle') || (this.fsm.is('resting') && this.restPhase === 'sat')) && this.canDrive(quad) && !this.takenByOther(quad);
  },

  /**
   * If she's driving, she pulls up and then gets off (and does `next`) or
   * moves onto the back. Returns whether she was driving.
   */
  stopDriving(how, next = null) {
    if (!this.fsm.is('driving')) return false;
    this.driveExit = { how, next };
    this.drive.stop('asked');
    return true;
  },

  /** Stopped, and had enough: onto the back to wait, or off to stand beside it. */
  endDrive() {
    const q = this.quad;
    const d = this.drive;
    const p = this.params;
    const exit = this.driveExit;
    this.driveExit = null;
    this.driveEvents.push(`done:${d.result}`);
    if (d.park && !d.park.nick && !d.park.home && d.result !== 'parked') this.endLineUp(`the drive ended: ${d.result}`);
    const nick = this.nickJob;
    if (nick?.phase === 'away' && !exit && d.result === 'bored') {
      // Had her fun: back to where you left it, still driving.
      nick.phase = 'back';
      this.parkWanted = { route: parkRoute(nick.slot, this.lineUpParams ?? DEFAULT_LINEUP_PARAMS), yaw: nick.slot.yaw, crooked: false, nick: true };
      q.setDriver(null);
      this.fsm.transition('driving');
      return;
    }
    if (nick && !(nick.phase === 'back' && d.result === 'parked')) this.nickJob = null; // anything else ends it: she's done, or you've got it back
    this.driveConfidence = afterDrive(this.driveConfidence ?? p.driveConfidence, d.result);
    let how = exit?.how;
    if (!how) how = d.result === 'parked' || d.result === 'gaveUp' || d.result === 'noRoom' || Math.random() >= p.driveBackChance ? 'off' : 'back';
    // Done, and getting off: most of the time she drives it back near the barn first, into clear ground east of the row.
    if (how === 'off' && !d.park && !nick && !q.tractor) {
      const home = this.homeParams ?? DEFAULT_HOME_PARAMS;
      const lp = this.lineUpParams ?? DEFAULT_LINEUP_PARAMS;
      const wants = bringsItHome({ result: d.result, pos: q.position, hasPassenger: !!q.passenger, asked: !!exit }, Math.random, home, lp);
      const spot = wants ? pickHomeSpot(this.quads.filter((o) => o !== q).map((o) => ({ x: o.position.x, z: o.position.z })), Math.random, home, lp) : null;
      if (spot) {
        this.parkWanted = { route: parkRoute(spot, lp), yaw: spot.yaw, crooked: false, home: true };
        this.driveEvents.push('bringHome');
        q.setDriver(null);
        this.fsm.transition('driving');
        return;
      }
    }
    q.setDriver(null);
    if (how === 'back' && q.hasPillion && !q.passenger && !this.takenByOther(q, 'pillion')) {
      if (!exit) this.driveEvents.push('toBack');
      this.seatedByChoice = !exit; // moved back by herself: she can get bored of it too
      this.fsm.transition('shuffling', { to: 'pillion' });
      return;
    }
    if (!exit) this.driveEvents.push('getOff');
    // Getting off, she nearly always leaves it running (on the tractor, switching it off is the stop knob).
    if (q.engine.isRunning && Math.random() < p.driveKeyOffChance) {
      if (q.tractor) q.engine.stopKnob();
      else q.engine.setIgnition(false);
    }
    this.afterDismount = exit?.next ?? (d.park && d.result === 'parked' ? () => this.finishParking(d.park) : null);
    this.fsm.transition('dismounting');
  },

  /** She has put a quad in its place in the row: if it was left crooked on purpose her friend notices, otherwise she goes on to the next. */
  finishParking(park) {
    if (park.home) return; // brought it home and left it: nothing more to do
    if (park.nick) {
      this.nickJob = null;
      this.selfEvents.push('nickBack');
      return;
    }
    if (park.crooked) for (const o of this.others()) o.noticeCrooked?.();
    else this.continueLineUp();
  },

  /** Her friend on the back of the quad she's driving: 'on', 'coming' (on her way to get on), or null. */
  friendOnBack() {
    const o = this.others().find((o) => o.claimedQuad === this.quad && ['pillion', 'rack'].includes(o.claimedSeat));
    if (!o) return null;
    if (o.fsm.is('seated')) return 'on';
    return o.fsm.is('walking', 'mounting') ? 'coming' : null;
  },

  /** Menu while she's driving. */
  drivingActions() {
    const q = this.quad;
    const actions = [{ kind: 'stopDrive', label: `Stop and get off the ${q.label}`, run: () => this.requestStandBeside(q) }];
    if (q.hasPillion) actions.push({ kind: 'back', label: 'Stop and move onto the back', run: () => this.requestMount(q) });
    return actions;
  },

  /** A quad she could have a drive on: nobody on it, upright and parked. */
  canDrive(q) {
    return !q.rider && !q.isTipped && !q.isGhostRiding && q.speed < 0.5 && !this.wontRide(q);
  },

  /** The fault (a walk-round finding) she knows this quad has and won't ride it for, or null. Only Amy ever has any (wontRide.js). */
  wontRide(q) {
    const id = q.unit?.spec.id;
    return id && this.knows ? this.knows.blocking(id, q, this.walkParams) : null;
  },

  /** Where she climbs onto the front seat from, beside the footboard on her nearer side. */
  driveMountPoint() {
    const side = this.root.parent === this.scene ? this.nearSide() : 1;
    const p = this.quad.localToWorld(side * 0.85, 0, -0.1);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: this.quad.yaw, side };
  },

  /** Distance to the nearest thing in front of her quad along a heading, or Infinity. */
  driveProbe(heading, distance) {
    const q = this.quad;
    const pos = q.position;
    const y = this.world.heightAt(pos.x, pos.z) + 0.55;
    const dx = Math.sin(heading);
    const dz = Math.cos(heading);
    let best = Infinity;
    // Down the middle and either side, about the width of the quad.
    for (const off of [-0.6, 0, 0.6]) {
      const hit = this.castFrom(pos.x + dz * off, y, pos.z - dx * off, dx, dz, distance, q);
      if (hit < best) best = hit;
    }
    return best;
  },

  /** Whether she could drive straight from a to b: inside the hedges, nothing in the way. */
  driveClear(a, b) {
    const limit = this.world.layout.fieldHalf - 6;
    if (Math.abs(b.x) > limit || Math.abs(b.z) > limit) return false;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const ux = dx / len;
    const uz = dz / len;
    const y = this.world.heightAt(a.x, a.z) + 0.55;
    for (const off of [-0.9, 0, 0.9]) {
      if (this.castFrom(a.x + uz * off, y, a.z - ux * off, ux, uz, len + 1.5, this.quad) < Infinity) return false;
    }
    // Not through a bog: she's seen what happens.
    if (this.world.bogAt(b.x, b.z) > 0.15 || this.world.bogAt((a.x + b.x) / 2, (a.z + b.z) / 2) > 0.15) return false;
    // Not over a steep bank.
    return Math.abs(this.world.heightAt(b.x, b.z) - this.world.heightAt(a.x, a.z)) < len * 0.25 + 0.3;
  },

  castFrom(x, y, z, dx, dz, distance, quad) {
    const ray = new this.RAPIER.Ray({ x, y, z }, { x: dx, y: 0, z: dz });
    const terrain = this.world.terrain.collider.handle;
    const own = this.collider.handle;
    const bike = quad.physics.collider.handle;
    const hit = this.physics.castRay(ray, distance, true, undefined, undefined, undefined, undefined, (c) => {
      // Following you, your quad isn't an obstacle: she keeps her gap from it anyway.
      return c.handle !== terrain && c.handle !== own && c.handle !== bike && c.handle !== this.probeIgnore;
    });
    return hit ? (hit.timeOfImpact ?? hit.toi) : Infinity;
  },

  /** Leans her in a touch and puts her hands on the grips, following the bars. Runs as a rig poser. */
  poseDriving(dt) {
    const q = this.quad;
    const s = this.fsm;
    const front = s.is('driving') || (s.is('shuffling') && s.data.to === 'rider' && s.time > 0.4);
    const mountingFront = s.is('mounting') && s.data.seat === 'rider' && s.time > this.params.mountDuration * 0.6;
    this.gripReach += ((front || mountingFront ? 1 : 0) - this.gripReach) * Math.min(1, dt * 4);
    if (this.gripReach < 0.01) return;
    const k = smooth(Math.min(1, this.gripReach));
    const rig = this.rig;
    const b = rig.bones;
    rig.rotateAboutRootAxis(b.Spine1, AXIS_X, 0.18 * k);
    // Jess can't see over the tractor's bonnet: she cranes up and leans first one way and then the other to look round it.
    if (q.tractor && s.is('driving') && this.character.id === 'jess') {
      rig.rotateAboutRootAxis(b.Spine1, AXIS_Z, 0.16 * Math.sin(s.time * 1.1) * k);
      rig.rotateAboutRootAxis(b.Spine1, AXIS_X, -0.12 * k);
    }
    const model = q.model;
    model.updateMatrixWorld(true);
    const modelQ = model.getWorldQuaternion(_q);
    for (const a of ARMS) {
      const grip = (q.grips ??= {})[a.grip] ??= model.getObjectByName(a.grip);
      if (!grip || !b[a.arm]) continue;
      grip.localToWorld(_target.set(0, 0.055, 0));
      // Elbows a little out and down, as you'd hold the bars.
      b[a.arm].getWorldPosition(_pole);
      model.worldToLocal(_pole).add(_fingers.set(a.side * 0.35, -0.25, -0.1));
      model.localToWorld(_pole);
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, k);
      // Fingers over the front of the grip, palm down on it.
      if (b[a.finger] && b[a.thumb]) {
        _fingers.set(-a.side * 0.25, -0.45, 0.85).normalize().applyQuaternion(modelQ);
        _palm.set(0, -1, 0.15).normalize().applyQuaternion(modelQ);
        orientHand(b[a.hand], b[a.finger], b[a.thumb], _fingers, _palm, a.side, k);
      }
    }
  },
};
