import * as THREE from 'three';
import { attachKeepingSize } from './attachKeepingSize.js';
import { driveMood, pickConfidence, afterDrive } from './driveMood.js';
import { HerDrive } from './herDriving.js';
import { DEFAULT_STARTING_PARAMS } from './startingAttempt.js';
import { DEFAULT_LINEUP_PARAMS, parkRoute } from './lineUp.js';
import { DEFAULT_HOME_PARAMS, bringsItHome, pickHomeSpot } from './homeParking.js';
import { solveTwoBone, orientHand } from './armIK.js';
import { AutoShifter, NoviceShifter, DEFAULT_SHIFTER_PARAMS, DEFAULT_NOVICE_PARAMS } from '../vehicle/autoShifter.js';
import { DEFAULT_TRACTOR_START_PARAMS } from './tractorStart.js';
import { CrankAttempt, DEFAULT_CRANK_ATTEMPT_PARAMS, needsStartingHandle } from './crankAttempt.js';
import { PushStart, DEFAULT_PUSH_PARAMS } from './pushStart.js';
import { onTarmac } from './tarmac.js';
import { towedBy } from '../vehicle/trailerObstacle.js';
import { pickOuting, roadSpots } from './outings.js';
import { DEFAULT_SIGHT_PARAMS, pickSight, sightsFrom } from './sights.js';
import { TowSteer, DEFAULT_TOW_STEER_PARAMS } from './towSteer.js';
import { MotoNerve, refusesMoto, speedShare } from './motoGo.js';

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

/** The UTV's go: an automatic, so no clutch to fumble; quicker than the tractor, and neither of them frightened by the speed. */
export const DEFAULT_UTV_GO_DRIVE = {
  jessSpeedMin: 2,
  jessSpeedMax: 5,
  amySpeedMin: 3,
  amySpeedMax: 6,
  forMin: 40,
  forMax: 70,
  maxThrottle: 0.8,
  jessMaxStalls: 6,
};

/** The Tor's or Crag's go: a four-speed with a heavy clutch, so Jess stays in second (8 m/s) and Amy goes up to third. */
export const DEFAULT_CAB_GO_DRIVE = {
  jessSpeedMin: 2,
  jessSpeedMax: 6,
  amySpeedMin: 3,
  amySpeedMax: 8,
  forMin: 40,
  forMax: 70,
  maxThrottle: 0.7,
  jessMaxStalls: 6,
};

const smooth = (t) => t * t * (3 - 2 * t);
const SHUFFLE_DURATION = 0.9; // seconds to slide between the front seat and the back

const _target = new THREE.Vector3();
const _hole = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _fingers = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _q = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const ARMS = [
  { side: 1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand', finger: 'LeftHandIndex1', thumb: 'LeftHandThumb1', grip: 'gripLeft' },
  { side: -1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand', finger: 'RightHandIndex1', thumb: 'RightHandThumb1', grip: 'gripRight' },
];

export const drivingStates = {
  // On the front seat with the quad hers: starting it, driving, stopping.
  driving: {
    // The way she's going, strongly: a driver glances away now and then, or at a bang, but mostly watches the road (attention.js).
    look() {
      return this.lookAhead(this.quad, 10, 2);
    },
    enter() {
      const q = this.quad;
      this.setColliderEnabled(false);
      q.riderAnchor.add(this.root);
      this.root.position.copy(this.seatOffset(true));
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = q.driverStand ? 0 : this.params.legSpread;
      this.sittingPose = this.seatPoseName(true);
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
      let park = this.parkWanted;
      this.parkWanted = null;
      // From another field, by the gateways (world/fields.js): the way to the first point of her route, without it.
      const via = park && this.world.fields ? this.world.fields.route(this.quad.position, park.route[0]).slice(0, -1) : [];
      if (via.length) park = { ...park, route: [...via.map((p) => ({ x: p.x, z: p.z })), ...park.route] };
      // Sat on a dead quad on the tow rope: no engine to start and nowhere of her own to go, just the bars and the brake (towSteer.js).
      const tow = this.towWanted;
      this.towWanted = null;
      if (tow?.rope.target === q) {
        this.drive = new TowSteer(q, tow.rope, { params: this.towSteerParams ?? { ...DEFAULT_TOW_STEER_PARAMS }, horizon: this.params.towHorizon, distractChance: this.params.towDistractChance });
        q.setDriver(this.drive);
        return;
      }
      const params = driveMood(this.params, this.driveMood);
      params.driveSpeedMaxBase = this.params.driveSpeedMax;
      // The mini moto: she is nervous at first and slow, braver the longer she is on it, and in the end comes off (motoGo.js).
      this.motoRide = !!q.unit?.spec.miniMoto && !this.refusesMoto(q);
      if (this.motoRide) {
        this.motoNerve ??= new MotoNerve(this.motoParams);
        this.motoNerve.begin();
        const share = speedShare(this.motoNerve.nerve, this.motoParams);
        params.driveSpeedMax *= share;
        params.driveSpeedMin = Math.min(params.driveSpeedMin, params.driveSpeedMax);
        this.voice.say(this.motoNerve.goes === 1 ? 'motoStart' : 'motoBrave', { chance: 1 });
      }
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
      if (q.tractor || q.driverStand) this.goParams(params);
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
        tarmac: this.tarmacParams && this.world.roads.road('farm') && !q.tractor && !q.driverStand ? { at: (x, z) => onTarmac(this.world.roads, x, z), p: this.tarmacParams } : null,
        showOff: showOff ? { ...showOff, you: () => this.showOffYou() } : null,
        outing: q.car && this.outingParams && this.outingSpots && this.world.fields
          ? this.outingFor(q, { road: true })
          : this.outingParams && this.outingSpots && this.world.fields && !race && !park && !doughnut && !jump && !showOff && !following && !convoyLead && !q.tractor && !q.driverStand && !this.motoRide
            ? this.outingFor(q)
            : null,
        tires: offered,
        follow: following ? () => {
          const lead = (followWho ?? this.followTarget)?.();
          return lead && lead !== q ? lead : null;
        } : null,
        followWay: following && this.world.fields ? (pos, point, lead) => this.followWay(pos, point, lead) : null,
        probe: (heading, distance) => this.driveProbe(heading, distance),
        isClear: (a, b) => this.driveClear(a, b),
      });
      q.setDriver(this.drive);
    },
    update(dt) {
      const q = this.quad;
      const d = this.drive;
      this.root.position.copy(this.stranded ? this.standOffset() : this.seatOffset(true));
      this.rig.legSpread = q.driverStand || this.stranded ? 0 : this.params.legSpread;

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
        this.endCall();
        q.setDriver(null);
        this.driveEvents.push('done:scared');
        this.afterDismount = () => this.beginTipCall(); // out and stood beside it, waving for you (companionStranded.js)
        this.fsm.transition('dismounting');
        return;
      }

      this.probeIgnore = d.follow?.()?.physics.collider.handle ?? null;
      for (const e of d.update(dt)) {
        if (e.startsWith('practice:')) this.onPractice?.(e.slice(9));
        else if (e.startsWith('start:')) this.startEvents.push(e.slice(6));
        else if (e.startsWith('sight:')) this.showSight(d.trip?.sight);
        else this.driveEvents.push(e);
      }
      if (this.motoRide && !d.done && this.stepMoto(dt)) return;
      if (d.done && d.strandedInBog && !this.stranded) return this.beginBogCall(); // given up on the mud: stays up on it, waving, rather than getting off
      if (d.done) this.endDrive();
    },
    exit() {
      this.endCall();
      this.sittingPose = null;
      this.motoRide = false;
      this.motoNerve?.end();
      if (this.quad.driver === this.drive) this.quad.setDriver(null);
    },
  },

  // At the front of the Tor or Crag with its starting handle in the bumper, swinging it because the battery is flat (crankAttempt.js).
  cranking: {
    look() {
      return this.lookAtVehicle(this.quad, 0.6, 2);
    },
    enter() {
      this.rig.play('Idle', { fade: 0.3 });
      this.crankAttempt = new CrankAttempt(this.quad, this.character.id, { params: this.crankParams ?? DEFAULT_CRANK_ATTEMPT_PARAMS });
      this.crankReach = 0;
    },
    update(dt, data) {
      this.turnToward(dt, data.facing);
      const a = this.crankAttempt;
      const q = this.quad;
      if (q.rider) a.abandon(); // you've got in: she leaves it to you
      for (const e of a.update(dt)) this.crankEvents.push(e);
      if (a.done) {
        const ran = q.engine.isRunning;
        const then = this.afterCrank;
        this.afterCrank = null;
        if (!ran) this.crankEvents.push('noLuck');
        this.fsm.transition('idle', { facing: data.facing });
        if (ran) then?.();
      }
    },
    exit() {
      if (this.crankAttempt && !this.crankAttempt.done) this.crankAttempt.abandon();
      this.crankAttempt = null;
      this.afterCrank = null;
      this.quad.helperPull = false;
    },
  },

  // Behind a vehicle with a flat battery, leaning on the back and walking it along so you can drop the clutch and bump-start it (pushStart.js).
  pushing: {
    look() {
      return this.lookAtVehicle(this.quad, 0.8, 1.5);
    },
    enter() {
      this.rig.play('Idle', { fade: 0.3 });
      this.pushWalking = false;
      this.pushReach = 0;
      this.setColliderEnabled(false);
      const mass = this.quad.physics.body.mass();
      this.pushAttempt = new PushStart(this.quad, this.character.id, mass, { params: this.pushParams ?? DEFAULT_PUSH_PARAMS, skill: this.skillLevels?.bumpStart ?? 0.5 });
    },
    update(dt) {
      const a = this.pushAttempt;
      const q = this.quad;
      // You've got off (or never got on): she stops.
      if (!q.rider && !a.done) a.abandon();
      for (const e of a.update(dt)) this.pushEvents.push(e);
      // She keeps to the back of it, a pace behind however it moves.
      const t = this.pushPoint(q);
      const pos = this.root.position;
      const dx = t.position.x - pos.x;
      const dz = t.position.z - pos.z;
      const d = Math.hypot(dx, dz);
      const step = Math.min(d, Math.max(3, q.speed + 2) * dt);
      if (d > 0.001) {
        pos.x += (dx / d) * step;
        pos.z += (dz / d) * step;
      }
      pos.y = this.world.heightAt(pos.x, pos.z);
      this.heading = q.yaw;
      this.root.rotation.y = q.yaw;
      if (a.accel > 0) {
        const m = q.physics.body.mass() * a.accel * dt;
        q.physics.body.applyImpulse({ x: Math.sin(q.yaw) * m, y: 0, z: Math.cos(q.yaw) * m }, true);
      }
      const walking = q.speed > 0.25 || d > 0.3;
      if (walking !== this.pushWalking) {
        this.pushWalking = walking;
        this.rig.play(walking ? 'Walking' : 'Idle', { fade: 0.25 });
      }
      if (walking) this.rig.setTimeScale(Math.min(2, Math.max(0.6, q.speed / this.params.walkAnimSpeed)));
      if (a.done) this.fsm.transition('idle', { facing: q.yaw });
    },
    exit() {
      if (this.pushAttempt && !this.pushAttempt.done) this.pushAttempt.abandon();
      this.pushAttempt = null;
      this.setColliderEnabled(true);
    },
  },

  // Sliding back onto the pillion, or forward onto the front seat.
  shuffling: {
    look() {
      return this.lookAhead(this.quad, 6, 1.5);
    },
    enter(data) {
      const q = this.quad;
      if (data.to === 'pillion' && q.driver === this.drive) q.setDriver(null);
      attachKeepingSize(q.model, this.root);
      this.shuffleFrom = this.root.position.clone();
      this.sittingPose = 'astride';
    },
    exit() {
      this.sittingPose = null;
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
   * Her go on the tractor, the UTV or the Tor or Crag: slow and steady, not scared off by speed, and (on the two with a clutch) her own
   * way with it: Jess's is the novice's (stays in the low gears, kangaroos, stalls it, grinds the Tor's or Crag's first and second),
   * Amy's is a good driver's. `params` is her drive params for this go, changed in place.
   */
  goParams(params) {
    const jess = this.character.id === 'jess';
    const q = this.quad;
    if (q.car) {
      // Her own car: she drives it every day, so a driver's gear changes, and her own pace (carGo.js: Amy careful, Jess not).
      const d = this.carGo?.driveFor(this.character.id) ?? { speedMin: 5, speedMax: 10, forMin: 70, forMax: 130, maxThrottle: 0.7 };
      params.driveSpeedMin = d.speedMin;
      params.driveSpeedMax = d.speedMax;
      params.driveForMin = d.forMin;
      params.driveForMax = d.forMax;
      params.driveMaxThrottle = d.maxThrottle;
      params.driveScareSpeed = 99;
      this.quad.shifter = new AutoShifter();
      return;
    }
    const t = q.tractor ? this.tractorGo ?? DEFAULT_TRACTOR_GO_DRIVE : q.landRover ? this.cabGo ?? DEFAULT_CAB_GO_DRIVE : this.utvGo ?? DEFAULT_UTV_GO_DRIVE;
    params.driveSpeedMin = jess ? t.jessSpeedMin : t.amySpeedMin;
    params.driveSpeedMax = jess ? t.jessSpeedMax : t.amySpeedMax;
    params.driveForMin = t.forMin;
    params.driveForMax = t.forMax;
    params.driveMaxThrottle = t.maxThrottle;
    params.driveScareSpeed = 99;
    params.driveMaxStalls = jess ? t.jessMaxStalls : params.driveMaxStalls;
    if (q.manual) {
      this.quad.shifter = jess ? new NoviceShifter(DEFAULT_SHIFTER_PARAMS, this.noviceParams ?? DEFAULT_NOVICE_PARAMS) : new AutoShifter();
      this.quad.shifter.declutchLevel = () => this.skillLevels?.doubleDeclutch; // how often she grinds a gear with no synchromesh
    }
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
    if (this.needsHandle(quad)) {
      // A flat battery on the Tor or Crag: the handle first, then she gets in.
      this.afterCrank = () => this.requestDrive(quad, { giveRide, follow, race, followWho, convoyLead, doughnut, jump, park, showOff });
      this.fsm.transition('walking', { goal: 'crank', target: () => this.crankPoint(quad) });
      return;
    }
    this.fsm.transition('walking', { goal: 'drive', target: () => this.driveMountPoint() });
  },

  /** She gets on a dead quad that is on the end of the tow rope and steers and brakes it behind the towing quad (towSteer.js). */
  requestTowSteer(quad, rope) {
    this.requestDrive(quad);
    this.towWanted = { rope }; // after requestDrive, which can be a drive she was already on: it is read when she sits down
  },

  /** The rope is on this quad, the quad is still, nobody is on it, and she could sit on it. */
  canSteerTowed(quad, rope) {
    return rope?.state === 'hooked' && rope.target === quad && !quad.passenger && quad.speed < 0.5 && this.canDrive(quad);
  },

  /** The Tor's or Crag's battery is too flat for the starter and it is not running: she will have to swing the handle. */
  needsHandle(quad) {
    return needsStartingHandle(quad);
  },

  /** Where she stands to swing the starting handle: in front of the bumper, facing the hole. */
  crankPoint(quad = this.quad) {
    const hole = quad.crankHole.getWorldPosition(new THREE.Vector3());
    const fx = Math.sin(quad.yaw);
    const fz = Math.cos(quad.yaw);
    const p = new THREE.Vector3(hole.x + fx * 0.8, 0, hole.z + fz * 0.8);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: Math.atan2(-fx, -fz) };
  },

  /** Bent forward to the handle in the bumper, both hands on it, turning it while the engine turns over. Runs as a rig poser. */
  poseCranking(dt) {
    if (!this.crankAttempt) {
      this.crankReach = 0;
      return;
    }
    const on = this.fsm.is('cranking') && !this.crankAttempt.done;
    this.crankReach = (this.crankReach ?? 0) + ((on ? 1 : 0) - (this.crankReach ?? 0)) * Math.min(1, dt * 5);
    if (this.crankReach < 0.01) return;
    const k = smooth(Math.min(1, this.crankReach));
    const q = this.quad;
    const rig = this.rig;
    const b = rig.bones;
    rig.rotateAboutRootAxis(b.Spine, AXIS_X, 0.35 * k);
    rig.rotateAboutRootAxis(b.Spine1, AXIS_X, 0.25 * k);
    const hole = q.crankHole.getWorldPosition(_hole);
    // The handle goes round in a circle across the front of the car while she swings.
    this.crankAngle = (this.crankAngle ?? 0) + (this.crankAttempt.turning ? dt * 9 : 0);
    const r = this.crankAttempt.holding ? 0.03 : 0.12;
    _palm.set(Math.cos(this.crankAngle) * r, Math.sin(this.crankAngle) * r + 0.05, 0).applyAxisAngle(AXIS_Y, q.yaw);
    hole.add(_palm);
    const cx = hole.x;
    const cy = hole.y;
    const cz = hole.z;
    for (const a of ARMS) {
      b[a.arm].getWorldPosition(_pole);
      _pole.add(_fingers.set(a.side * 0.3, -0.3, 0.1));
      _fingers.set(a.side * 0.04, 0, 0).applyAxisAngle(AXIS_Y, q.yaw);
      _target.set(cx + _fingers.x, cy, cz + _fingers.z);
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, k);
    }
  },

  /** The vehicle is one she could push-start: a manual (so there is a clutch to drop) that is not running, with you in the seat. */
  canPushStart(quad) {
    return !!quad.manual && !quad.engine.isRunning && !!quad.rider && !quad.isTipped;
  },

  /** Walks round to the back of the vehicle and starts pushing it. */
  requestPush(quad) {
    if (this.stopDriving('off', () => this.requestPush(quad))) return;
    if (this.fsm.is('seated', 'mounting')) {
      this.afterDismount = () => this.requestPush(quad);
      this.fsm.transition('dismounting');
      return;
    }
    this.quad = quad;
    this.fsm.transition('walking', { goal: 'push', target: () => this.pushPoint(quad) });
  },

  /** Where she leans on it: a pace behind the back of the vehicle, facing the way it points. */
  pushPoint(quad = this.quad) {
    const rearZ = Math.min(...quad.wheels.map((w) => w.z));
    const p = quad.localToWorld(0, 0, rearZ - 0.8);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: quad.yaw };
  },

  /** Bent into it, both hands on the back of the vehicle. Runs as a rig poser. */
  posePushing(dt) {
    const on = this.fsm.is('pushing') && this.pushAttempt && !this.pushAttempt.done;
    this.pushReach = (this.pushReach ?? 0) + ((on && this.pushAttempt.pushing ? 1 : 0) - (this.pushReach ?? 0)) * Math.min(1, dt * 5);
    if (this.pushReach < 0.01 || !this.pushAttempt) return;
    const k = smooth(Math.min(1, this.pushReach));
    const q = this.quad;
    const rig = this.rig;
    const b = rig.bones;
    rig.rotateAboutRootAxis(b.Spine, AXIS_X, 0.3 * k);
    rig.rotateAboutRootAxis(b.Spine1, AXIS_X, 0.2 * k);
    const rearZ = Math.min(...q.wheels.map((w) => w.z));
    for (const a of ARMS) {
      b[a.arm].getWorldPosition(_pole);
      _pole.add(_fingers.set(a.side * 0.3, -0.3, 0.1));
      q.model.localToWorld(_target.set(a.side * 0.25, 0.95, rearZ - 0.1));
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, k);
    }
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
    this.endCall();
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
    if (!how) how = d.towing || d.result === 'parked' || d.result === 'gaveUp' || d.result === 'rescued' || d.result === 'noRoom' || Math.random() >= p.driveBackChance ? 'off' : 'back';
    // Done, and getting off: most of the time she drives it back near the barn first, into clear ground east of the row.
    if (how === 'off' && !d.park && !d.towing && !nick && !q.tractor && !q.driverStand) {
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
    if (q.engine.isRunning && !d.park?.light && Math.random() < p.driveKeyOffChance) { // brought round to light you (workLight.js), it stays running
      if (q.tractor) q.engine.stopKnob();
      else q.engine.setIgnition(false);
    }
    this.afterDismount = exit?.next ?? (d.park && (d.result === 'parked' || d.park.then) ? () => this.finishParking(d.park, d.result) : null);
    this.fsm.transition('dismounting');
  },

  /** She has put a quad in its place in the row: if it was left crooked on purpose her friend notices, otherwise she goes on to the next. */
  finishParking(park, result = 'parked') {
    if (park.then) return park.then(result); // brought round for something (lights to work by, workLight.js): the game carries on
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
    // Up on the tractor's wheel arch counts as the back of it.
    const up = this.others().find((o) => o.onHayRide && o.trailer?.quad === this.quad);
    if (up) return up.fsm.is('onTrailer') ? 'on' : 'coming';
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

  /** The mini moto, and a girl who won't go near it (only Amy, motoGo.js). */
  refusesMoto(q) {
    return !!q.unit?.spec.miniMoto && refusesMoto(this.character.id, this.motoParams);
  },

  /** A thunderstorm, and a girl who won't ride in one (only Amy): she won't get on or drive anything until it has passed. The game sets `inStorm`. */
  refusesStorm() {
    return !!this.inStorm && this.params.stormWont > 0;
  },

  refuseStorm() {
    this.voice.say('stormWont', { urgent: true, chance: 1 });
  },

  /** A vehicle whose latest MOT failed: 'refuses' (Amy won't get on the back), 'grumbles' (Jess does and says so) or 'ok'. The game sets `motMinds`. */
  motMind(q) {
    const id = q.unit?.spec.id;
    return id && this.motMinds ? this.motMinds(id) : 'ok';
  },

  refuseMot() {
    this.voice.say('motWont', { urgent: true, chance: 1 });
  },

  /** She says she isn't getting on it. */
  refuseMoto() {
    this.voice.say('motoWont', { urgent: true, chance: 1 });
  },

  /**
   * One step of her go on the mini moto: the bars wobble while she is nervous, and when it is time she loses it on the grass and is thrown
   * off. True if she came off (she's in the thrown state now).
   */
  stepMoto(dt) {
    const q = this.quad;
    const d = this.drive;
    const road = this.world.roads;
    const r = this.motoNerve.update(dt, { speed: Math.abs(q.speed), grass: !onTarmac(road, q.position.x, q.position.z) });
    d.controls.steer = Math.max(-1, Math.min(1, d.controls.steer + r.wobble));
    if (Math.abs(r.wobble) > this.motoParams.wobbleAmp * 0.2) this.voice.say('motoWobble', { chance: 0.3 });
    if (!r.fall) return false;
    const lean = q.physics.lean().lean;
    q.fallOver(Math.sign(lean) || Math.sign(d.controls.steer) || 1);
    d.stop('thrown');
    q.setDriver(null);
    this.fsm.transition('thrown', { side: q.bike.fallSide });
    return true;
  },

  /** A quad she could have a drive on: nobody on it, upright and parked. */
  canDrive(q) {
    return !q.rider && !q.isTipped && !q.isGhostRiding && q.speed < 0.5 && !this.wontRide(q) && !this.refusesMoto(q) && !this.refusesStorm() && !this.avoidsFriendOn(q);
  },

  /** The fault (a walk-round finding) she knows this quad has and won't ride it for, or null. Only Amy ever has any (wontRide.js). */
  wontRide(q) {
    const id = q.unit?.spec.id;
    return id && this.knows ? this.knows.blocking(id, q, this.walkParams) : null;
  },

  /** Where she climbs onto the front seat from, beside the footboard on her nearer side. */
  driveMountPoint() {
    if (this.quad.driverStand) return this.driverDoor();
    const side = this.root.parent === this.scene ? this.nearSide() : 1;
    const p = this.quad.localToWorld(side * 0.85, 0, 0.1);
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
    const half = q.driverStand ? 0.95 : 0.6; // the UTV and the Tor or Crag are wider
    for (const off of [-half, 0, half]) {
      const hit = this.castFrom(pos.x + dz * off, y, pos.z - dx * off, dx, dz, distance, q);
      if (hit < best) best = hit;
    }
    return best;
  },

  /**
   * Following, the way to the point behind the lead: through the gateways (world/fields.js), passing a gateway point within 3 m (she's
   * moving), and, once the lead is up the hill past its foot (world/hill.js) in among the wood's trees (world/woods.js) or down the gravel pit's road (world/quarry.js), only as far as the foot or the gate, where she waits.
   */
  followWay(pos, point, lead) {
    const fields = this.world.fields;
    const hill = fields.hill;
    const woods = fields.woods;
    const waitHill = !!hill && hill.pastFoot(lead.x, lead.z) && !hill.pastFoot(pos.x, pos.z);
    // The same for the wood: she waits just inside its gate rather than driving in among the trees.
    const waitWood = !waitHill && !!woods && woods.pastGate(lead.x, lead.z) && !woods.pastGate(pos.x, pos.z);
    // And for the gravel pit: just inside its gate, not down the haul road after you.
    const quarry = fields.quarry;
    const waitPit = !waitHill && !waitWood && !!quarry && quarry.pastGate(lead.x, lead.z) && !quarry.pastGate(pos.x, pos.z);
    const wait = waitHill || waitWood || waitPit;
    const to = waitHill ? hill.waitSpot : waitWood ? woods.waitSpot : waitPit ? quarry.waitSpot : point;
    return { point: fields.nextWaypoint(pos, to, 3), wait, to };
  },

  /** Her drive's way of going somewhere now and then (herDriving.js `outing`): a place picked from the farm's, the gateways there and the way back. */
  outingFor(quad, { road = false } = {}) {
    const fields = this.world.fields;
    const clear = (a, b) => this.driveClear(a, b);
    const origin = { x: quad.position.x, z: quad.position.z };
    const way = (from, to) => fields.route(from, to).map((pt) => ({ x: pt.x, z: pt.z }));
    const forced = this.outingForced; // from the debug panel: this drive goes somewhere for certain
    this.outingForced = false;
    // A car only ever goes out along the farm road and back (outings.js roadSpots), every time, however far the road's end is.
    const p = road ? { ...this.outingParams, chance: 1, maxDistance: Infinity } : forced ? { ...this.outingParams, chance: 1 } : this.outingParams;
    const spots = () => (road ? roadSpots(this.world.layout) : this.outingSpots());
    // With you on the back, somewhere to show you (sights.js). Forced (the debug panel): even with nobody on, and certain.
    const sp = this.sightParams ?? DEFAULT_SIGHT_PARAMS;
    const sightForced = this.sightForced;
    this.sightForced = false;
    const sights = road || !this.sightsNow ? null : {
      p: sightForced ? { ...sp, chance: 1 } : sp,
      forced: sightForced,
      pick: (from) => pickSight(from, sightsFrom(from, this.sightsNow(), sp), way, clear, this.driveRandom ?? Math.random, sp),
    };
    return {
      p,
      sights,
      pick: (from) => pickOuting(from, spots(), way, clear, this.driveRandom ?? Math.random, p),
      back: (from) => way(from, origin),
    };
  },

  /** She has pulled up at what she brought you to see: looks at it, points, and says why. */
  showSight(sight) {
    if (!sight) return;
    const sp = this.sightParams ?? DEFAULT_SIGHT_PARAMS;
    const y = this.world.heightAt(sight.look.x, sight.look.z) + 1.2;
    this.startPointing({ x: sight.look.x, y, z: sight.look.z }, sp.pointSeconds);
    this.voice.say(sight.line, { urgent: true, chance: 1 });
  },

  /** Whether she could drive straight from a to b: inside the farm's hedges, nothing in the way (the hedges between fields included). */
  driveClear(a, b) {
    if (this.world.fields) {
      if (!this.world.fields.inFarm(b.x, b.z, 6)) return false;
    } else {
      const limit = this.world.layout.fieldHalf - 6;
      if (Math.abs(b.x) > limit || Math.abs(b.z) > limit) return false;
    }
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const ux = dx / len;
    const uz = dz / len;
    const y = this.world.heightAt(a.x, a.z) + 0.55;
    for (const off of this.quad.driverStand ? [-1.2, 0, 1.2] : [-0.9, 0, 0.9]) {
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
      return c.handle !== terrain && c.handle !== own && c.handle !== bike && c.handle !== this.probeIgnore && !towedBy(this.trailers?.() ?? [], c.handle, quad);
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
