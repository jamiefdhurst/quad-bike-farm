import * as THREE from 'three';
import { StateMachine } from './stateMachine.js';
import { CharacterRig } from './characterRig.js';
import { DEFAULT_COMPANION_PARAMS } from './companionParams.js';
import { applyOutfit, refitOutfit, reshirt, withJumper, OUTFITS } from './outfit.js';
import { shapeFigure } from './figure.js';
import { StartingAttempt, DEFAULT_STARTING_PARAMS } from './startingAttempt.js';
import { drivingStates, drivingMethods } from './companionDriving.js';
import { restingMethods, restingStates } from './companionResting.js';
import { warmingMethods } from './companionWarming.js';
import { wavingMethods } from './companionWaving.js';
import { DEFAULT_DOUGHNUT_PARAMS, ringPoints } from './doughnuts.js';
import { PillionPose } from './pillionPose.js';
import { canRideRack } from './rackSeat.js';
import { nextBoredWait, driftRestlessness, pickBoredChoice } from './boredom.js';

const CAPSULE_HALF_HEIGHT = 0.55;
const CAPSULE_RADIUS = 0.25;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (t) => t * t * (3 - 2 * t);

function angleTo(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * The companion NPC. Behaviour is a small state machine:
 *
 *   idle ──walk──▶ walking ──arrive──▶ idle | starting | mounting ──▶ seated ──▶ dismounting ──▶ idle
 *                                                 mounting (front) ──▶ driving ──▶ dismounting | shuffling ──▶ seated
 *
 * Requests (the menu options) are methods that pick the next state, and
 * getActions() lists only the ones that make sense right now. New requests
 * slot in as another method plus an entry in getActions().
 */
export class Companion {
  constructor({ scene, physics, RAPIER, world, quad, gltf, params = { ...DEFAULT_COMPANION_PARAMS }, name = 'Her' }) {
    this.name = name;
    this.scene = scene;
    this.physics = physics;
    this.RAPIER = RAPIER;
    this.world = world;
    this.quad = quad;
    this.params = params;

    this.rig = new CharacterRig(gltf, params.height);
    // Shape her first so the fitted garments follow the figure.
    this.figure = this.figureAmounts();
    shapeFigure(this.rig, this.figure);
    this.outfit = OUTFITS[params.outfit] ?? OUTFITS.original;
    applyOutfit(this.rig, this.outfit);
    this.root = this.rig.root;
    this.root.name = `companion ${name}`;
    scene.add(this.root);

    // Where her hips sit in the sitting pose, so she can be placed on the seat.
    this.sitHips = this.rig.measureHips('SitIdle', 0);
    this.rig.play('Idle', { fade: 0 });

    // Invisible proxy for "look at her and press E".
    this.proxy = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 1.0, 4, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.position.y = 0.85;
    this.root.add(this.proxy);

    this.body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider = physics.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), this.body);

    this.tmpV = new THREE.Vector3();
    this.avoidSide = 1;
    this.avoidTimer = 0;
    this.stuckTimer = 0;

    // Start beside the quad on its left, facing it.
    const stand = this.standPoint(1);
    this.root.position.copy(stand.position);
    this.heading = stand.facing;
    this.root.rotation.y = this.heading;
    this.setColliderEnabled(true);
    this.lastPos = this.root.position.clone();

    this.fsm = new StateMachine(this, STATES, 'idle');

    this.glanceTimer = this.randomBetween(params.glanceEveryMin, params.glanceEveryMax);
    this.glanceLeft = 0;
    this.fidgetTimer = this.randomBetween(params.fidgetEveryMin, params.fidgetEveryMax);
    this.fidget = null;
    this.startEvents = []; // what she's done while starting a quad, for her voice to pick up
    this.quads = [quad]; // every quad on the farm, for doing things on her own (set by the game)
    this.others = () => []; // the other companions, whose quads she leaves alone (set by the game)
    this.idleFor = 0;
    this.restlessness = 0.7 + Math.random() * 0.8; // drifts while she's about (boredom.js)
    this.boredAfter = nextBoredWait(params, this.restlessness);
    this.selfEvents = []; // things she decided to do on her own, for her voice
    this.favourView = () => ({ mood: 'even', warmth: 1, sulk: 1 }); // how you've treated her (favour.js); the game swaps in the real thing
    this.reach = 0; // how far she's reaching for the bars, 0..1
    this.seatKind = 'pillion'; // which seat she's after or in on the back: 'pillion', or 'rack' (sat on the front rack)
    this.drive = null; // her go at driving, while she's on the front seat (herDriving.js)
    this.driveEvents = []; // what's happened while she's driving, for her voice
    this.gripReach = 0; // how far her hands are on the grips, 0..1
    // Holding on, leaning and looking about while she rides pillion.
    this.pillion = new PillionPose(this);
    this.rig.posers.push((dt) => this.pillion.apply(dt));
    // Hands on the bars while she's driving (companionDriving.js).
    this.rig.posers.push((dt) => this.poseDriving(dt));
    // Hands over a running engine on a cold day (companionWarming.js).
    this.warmingAt = null;
    this.rig.posers.push((dt) => this.poseWarming(dt));
    // Waving two-stroke smoke away (companionWaving.js).
    this.waving = null;
    this.rig.posers.push((dt) => this.poseWaving(dt));
  }

  figureAmounts() {
    const { bust, waist, hips } = this.params;
    return { bust, waist, hips };
  }

  /** Reshapes her and refits her clothes if the figure tunables have changed. */
  refreshFigure() {
    const next = this.figureAmounts();
    if (Object.keys(next).every((k) => next[k] === this.figure[k])) return;
    this.figure = next;
    shapeFigure(this.rig, next);
    refitOutfit(this.rig, this.outfit);
  }

  /** Her shirt in the colour of her favourite quad, which isn't known until the game has dealt them out. */
  setShirt(color) {
    this.outfit = reshirt(this.rig, this.outfit, color);
  }

  /** Puts a jumper on (a colour), or takes it off (null), refitting what's under it. */
  setJumper(color) {
    this.outfit = withJumper(this.outfit, color);
    refitOutfit(this.rig, this.outfit);
  }

  randomBetween(a, b) {
    return a + Math.random() * Math.max(0, b - a);
  }

  get state() {
    return this.fsm.name;
  }

  get isSeated() {
    return this.fsm.is('seated');
  }

  /** The quad she's busy with (on her way to get on, start or drive it, or on it), if any. */
  get claimedQuad() {
    const s = this.fsm;
    if (s.is('idle')) return null;
    if (s.is('walking')) return ['mount', 'start', 'drive'].includes(s.data?.goal) ? this.quad : null;
    return this.quad;
  }

  /** Which seat of her claimed quad she's after or in: 'rider' (the front, or at the bars), 'pillion', or 'both' while sliding between them. */
  get claimedSeat() {
    const s = this.fsm;
    if (!this.claimedQuad) return null;
    if (s.is('walking')) return s.data?.goal === 'mount' ? this.seatKind : 'rider';
    if (s.is('mounting')) return s.data?.seat === 'rider' ? 'rider' : this.seatKind;
    if (s.is('seated')) return this.seatKind;
    if (s.is('shuffling')) return 'both';
    if (s.is('dismounting')) return this.dismountingFrom ?? this.seatKind;
    return 'rider'; // starting it or driving it
  }

  /**
   * Another companion is busy with this quad (or, given a seat, with that seat
   * of it), so she leaves it alone. With a seat each, they can share one: one
   * driving, the other on the back.
   */
  takenByOther(quad, seat = null) {
    return this.others().some((o) => o.claimedQuad === quad && (!seat || o.claimedSeat === seat || o.claimedSeat === 'both'));
  }

  /** A quad that's one girl's alone (the kids' quad is Jess's) isn't ridden by the other. */
  mayRide(quad) {
    const owner = quad.unit?.spec.owner;
    return !owner || owner === this.character?.id;
  }

  /** It's hers: when she picks a quad to drive she goes for it first. */
  ownsQuad(quad) {
    return !!this.character && (quad.unit?.spec.owner === this.character.id || quad.unit?.spec.id === this.claimedSpec);
  }

  /** The other girl driving this quad (or about to), if any. */
  friendDriving(quad) {
    return this.others().find((o) => o.claimedQuad === quad && o.claimedSeat === 'rider') ?? null;
  }

  /**
   * She could get on the back of this quad: it has a seat there with nobody in
   * it, and if her friend's driving it, it's her own drive (not following you
   * or giving you a ride), so she'll stop to let her on.
   */
  canRidePillion(quad) {
    if (!quad.hasPillion || quad.isTipped || quad.passenger || this.takenByOther(quad, 'pillion')) return false;
    const friend = this.friendDriving(quad);
    return !friend?.drive || (!friend.drive.follow && !friend.drive.waitForPassenger);
  }

  /**
   * She could sit on the front rack: her friend's driving with you on the back
   * (so the back is taken), or the quad's parked with nobody on it and you've
   * asked her to, and nobody else is up there.
   */
  canRideRackOn(quad) {
    const friend = this.friendDriving(quad);
    return canRideRack({
      hasRack: quad.hasRack,
      tipped: quad.isTipped,
      rackTaken: this.takenByOther(quad, 'rack'),
      friendDriving: !!friend,
      friendBusy: !!(friend?.drive && (friend.drive.follow || (friend.drive.waitForPassenger && !quad.passenger))),
      pillionFree: !quad.passenger && !this.takenByOther(quad, 'pillion'),
      parked: !friend && !quad.rider && !quad.driver && !quad.passenger && quad.speed < 0.5,
    });
  }

  // Requests ----------------------------------------------------------------

  /**
   * Menu options that make sense right now. With several quads, each gets its
   * own options, nearest to her first.
   */
  getActions(quads = [this.quad]) {
    const s = this.fsm;
    const here = this.root.getWorldPosition(new THREE.Vector3());
    const sorted = quads.filter((q) => !(this.takenByOther(q, 'rider') && this.takenByOther(q, 'pillion'))).sort((a, b) => a.position.distanceTo(here) - b.position.distanceTo(here));
    // Only quads with a free pillion seat can carry her (her friend may be driving it).
    const rideable = (q) => this.canRidePillion(q);
    const actions = [];
    if (s.is('driving')) return this.drivingActions();
    if (s.is('shuffling')) return actions;
    const drivable = (q) => this.canDrive(q) && !this.takenByOther(q, 'rider') && !(s.is('walking') && s.data?.goal === 'drive' && q === this.quad);
    const boarding = s.is('seated', 'mounting') || (s.is('walking') && s.data?.goal === 'mount');
    if (boarding) {
      // She's asked if she can get off: answer her.
      if (s.is('seated') && this.askedToGetOff) {
        actions.push({ kind: 'letOff', label: 'Yes, hop off', run: () => this.requestStandBeside(this.quad) });
        actions.push({ kind: 'keepOn', label: 'No, stay there', run: () => this.keepOn() });
      }
      actions.push({ kind: 'stand', label: `Get off the ${this.quad.label}`, run: () => this.requestStandBeside(this.quad) });
      for (const q of sorted) {
        if (q !== this.quad && rideable(q)) actions.push({ kind: 'mount', quad: q, short: 'Get on it', label: `Get on the ${q.label}`, run: () => this.requestMount(q) });
        if (q !== this.quad && this.canRideRackOn(q)) actions.push({ kind: 'mountRack', quad: q, short: 'Sit on the front', label: `Sit on the front of the ${q.label}`, run: () => this.requestMount(q, { seat: 'rack' }) });
        if (drivable(q)) actions.push({ kind: 'drive', quad: q, short: 'Drive it', label: `Drive the ${q.label}`, run: () => this.requestDrive(q) });
      }
      return actions;
    }
    if (s.is('dismounting')) return actions;
    // She can have a go at starting any quad that isn't running and has nobody on it.
    const startable = (q) => !q.engine.isRunning && !q.rider && !q.isTipped && !q.isGhostRiding && !this.takenByOther(q, 'rider');
    for (const q of sorted) {
      if (drivable(q) && rideable(q)) actions.push({ kind: 'giveRide', quad: q, short: 'Take me for a ride', label: `Take me for a ride on the ${q.label}`, run: () => this.requestDrive(q, { giveRide: true }) });
      if (drivable(q)) actions.push({ kind: 'follow', quad: q, short: 'Follow me on it', label: `Follow me on the ${q.label}`, run: () => this.requestDrive(q, { follow: true }) });
      if (startable(q) && !(s.is('starting') && q === this.quad)) {
        actions.push({ kind: 'start', quad: q, short: 'Start it', label: `Start the ${q.label}`, run: () => this.requestStart(q) });
      }
      if (drivable(q)) actions.push({ kind: 'drive', quad: q, short: 'Drive it', label: `Drive the ${q.label}`, run: () => this.requestDrive(q) });
      if (rideable(q)) actions.push({ kind: 'mount', quad: q, short: 'Get on it', label: `Get on the ${q.label}`, run: () => this.requestMount(q) });
      if (this.canRideRackOn(q)) actions.push({ kind: 'mountRack', quad: q, short: 'Sit on the front', label: `Sit on the front of the ${q.label}`, run: () => this.requestMount(q, { seat: 'rack' }) });
      if (!this.isStandingBeside(q)) actions.push({ kind: 'stand', quad: q, short: 'Stand next to it', label: `Stand next to the ${q.label}`, run: () => this.requestStandBeside(q) });
    }
    return actions;
  }

  requestMount(quad = this.quad, { ownChoice = false, seat = 'pillion' } = {}) {
    if (!(seat === 'rack' ? quad.hasRack : quad.hasPillion)) return;
    // On the back because she chose to: she can get bored and get off again. Put there by you, she waits to be asked.
    this.seatedByChoice = ownChoice;
    // Driving this one: onto the back. Another: off this one first.
    if (this.stopDriving(quad === this.quad ? 'back' : 'off', quad === this.quad ? null : () => this.requestMount(quad, { ownChoice, seat }))) return;
    if (this.fsm.is('seated', 'mounting') && quad !== this.quad) {
      // Off this one first, then over to the other.
      this.afterDismount = () => this.requestMount(quad, { ownChoice, seat });
      this.fsm.transition('dismounting');
      return;
    }
    if (this.fsm.is('seated')) return;
    this.quad = quad;
    this.seatKind = seat;
    this.fsm.transition('walking', { goal: 'mount', target: () => this.mountPoint() });
  }

  /**
   * Left standing about long enough, she does something on her own: wanders
   * off for a look round, gets on a quad to wait, has a go at starting one, or
   * has a little drive of one.
   * Once she's sat on a quad she stays there until you ask her to get off.
   */
  updateBoredom(dt, viewer) {
    const p = this.params;
    this.restlessness = driftRestlessness(this.restlessness, dt, p);
    const waiting = this.fsm.is('idle') && !viewer?.talking && !this.warmingAt; // warming her hands isn't being bored
    this.idleFor = waiting ? this.idleFor + dt : 0;
    if (!p.ownMind || this.idleFor < this.boredAfter) return;
    this.idleFor = 0;
    this.boredAfter = nextBoredWait(p, this.restlessness);
    const here = this.root.position;
    const near = (q) => q.position.distanceTo(here) < 40 && this.mayRide(q) && !this.takenByOther(q) && !q.rider && !q.isTipped && !q.isGhostRiding && q.speed < 0.5;
    // Her friend about to set off on one (walking to it, getting on, starting it or about to go): she might hop on the back.
    const settingOff = (q) => {
      const f = this.friendDriving(q);
      if (!f) return false;
      return f.fsm.is('walking', 'mounting') || (f.fsm.is('driving') && ['start', 'settle'].includes(f.drive?.phase));
    };
    const drivable = this.quads.filter((q) => near(q) && this.canDrive(q));
    // Doughnuts want a clear stretch of field to spin in, found now so she only picks it when there is one.
    const doughnutPlan = p.boredDoughnutChance > 0 && drivable.length ? this.doughnutPlan() : null;
    const options = {
      doughnuts: doughnutPlan ? drivable : [],
      join: this.quads.filter((q) => q.position.distanceTo(here) < 25 && q.speed < 0.5 && !q.rider && settingOff(q) && (this.canRidePillion(q) || this.canRideRackOn(q))),
      mount: this.quads.filter((q) => near(q) && q.hasPillion),
      start: this.quads.filter((q) => near(q) && !q.engine.isRunning),
      drive: this.quads.filter((q) => near(q) && this.canDrive(q)),
      rest: this.restSpotsNear?.(here) ?? [],
    };
    const can = Object.fromEntries(Object.entries(options).map(([k, list]) => [k, list.length > 0]));
    const favour = this.favourView();
    const choice = pickBoredChoice(p, { confidence: this.driveConfidence ?? p.driveConfidence, can, sulk: favour.sulk });
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    // Neglected and off on a quad alone: she makes a point of it.
    // Jess now and then takes her friend's quad, to wind her up (ownership.js).
    const borrowSpec = choice === 'drive' ? this.borrowPick?.(options.drive.map((q) => q.unit?.spec.id)) : null;
    const borrowed = borrowSpec ? options.drive.find((q) => q.unit?.spec.id === borrowSpec) : null;
    if (choice === 'rest') this.selfEvents.push(options.rest[0]?.kind === 'loft' ? 'loftGo' : 'restGo'); else this.selfEvents.push(borrowed ? 'borrow' : choice === 'drive' && favour.mood === 'neglected' ? 'sulkOff' : choice);
    if (choice === 'join') {
      const q = pick(options.join);
      this.requestMount(q, { ownChoice: true, seat: this.canRidePillion(q) ? 'pillion' : 'rack' });
    }
    else if (choice === 'mount') this.requestMount(pick(options.mount), { ownChoice: true });
    else if (choice === 'start') this.requestStart(pick(options.start));
    else if (borrowed) this.requestDrive(borrowed);
    else if (choice === 'doughnuts') this.requestDrive(pick(options.doughnuts), { doughnut: doughnutPlan });
    else if (choice === 'drive') this.requestDrive(pick(options.drive.some((q) => this.ownsQuad(q)) ? options.drive.filter((q) => this.ownsQuad(q)) : options.drive));
    else if (choice === 'rest') this.goRest(pick(options.rest), { stay: this.restStayFor?.() });
    else this.wander();
  }

  /**
   * A circle of clear field to spin doughnuts in, a little way from her: { centre, radius, dir, seconds, p }, or null if
   * she can't find one (a ring that is clear of bogs, puddles, obstacles and slopes). `scale` makes the circle bigger
   * and the throttle a touch gentler (Amy having a go).
   */
  doughnutPlan(scale = 1) {
    const dp = this.doughnutParams ?? DEFAULT_DOUGHNUT_PARAMS;
    const radius = dp.radius * scale;
    const from = this.root.position;
    for (let tries = 0; tries < 14; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = dp.findFrom + Math.random() * (dp.findTo - dp.findFrom);
      const centre = { x: from.x + Math.sin(a) * d, z: from.z + Math.cos(a) * d };
      const ring = ringPoints(centre, radius + dp.clearExtra, 12);
      const level = this.world.heightAt(centre.x, centre.z);
      const open = [centre, ...ring].every((pt) => !(this.world.bogAt?.(pt.x, pt.z) > 0) && !(this.world.puddleAt?.(pt.x, pt.z) > 0) && Math.abs(this.world.heightAt(pt.x, pt.z) - level) < 0.8);
      if (!open || !this.driveClear(from, centre) || !ring.every((pt) => this.driveClear(centre, pt))) continue;
      return { centre, radius, dir: Math.random() < 0.5 ? 1 : -1, seconds: this.randomBetween(dp.forMin, dp.forMax), p: { ...dp, throttle: dp.throttle * (scale > 1 ? 0.85 : 1) } };
    }
    return null;
  }

  /** Walks to a point and stands there, facing `facing`, dropping whatever else she was up to. */
  walkTo(point, facing) {
    this.warmingAt = null;
    this.waving = null;
    this.recallTarget = point;
    this.fsm.transition('walking', { goal: 'stand', target: () => ({ position: point, facing }) });
  }

  /**
   * Stop whatever she's doing and go to a point (called back to the barn). Driving she pulls up and gets off first; sat
   * on a quad or on the bales she gets down first. Safe to call again every so often until she's there: where she is
   * mid-change (sliding between seats, getting off) it takes effect when that's done.
   */
  recall(point, facing) {
    const s = this.fsm;
    const go = () => this.walkTo(point, facing);
    if (s.is('walking') && s.data?.goal === 'stand' && this.recallTarget === point) return;
    if (this.stopDriving('off', go)) return;
    if (s.is('seated', 'mounting')) {
      this.afterDismount = go;
      s.transition('dismounting');
    } else if (s.is('shuffling', 'dismounting')) {
      this.afterDismount = go;
    } else if (s.is('resting')) {
      this.leaveRest(go);
    } else go();
  }

  /**
   * Sneaks over to `spot` ({ x, z }) to play a prank (pranks.js): once there she pauses a moment,
   * does `act()`, then carries on. Only when she's stood about; returns whether she set off.
   * `via` is a list of { x, z } she walks through first, in order (the way in through a door), and `out` a point she
   * walks to afterwards instead of just standing there (the way back out).
   */
  sneakTo(spot, act, stay = 2.6, { via = [], out = null } = {}) {
    if (!this.fsm.is('idle')) return false;
    const target = new THREE.Vector3(spot.x, this.world.heightAt(spot.x, spot.z), spot.z);
    const facing = Math.atan2(this.root.position.x - spot.x, this.root.position.z - spot.z) + Math.PI;
    const stops = via.map((v) => new THREE.Vector3(v.x, this.world.heightAt(v.x, v.z), v.z));
    const next = () => {
      while (stops.length && stops[0].distanceTo(this.root.position) < 0.9) stops.shift();
      return stops[0] ?? target;
    };
    this.fsm.transition('walking', { goal: 'prank', target: () => ({ position: next(), facing }), act, stay, out });
    return true;
  }

  /** A stroll to somewhere nearby on the farm, staying inside the hedges. */
  wander() {
    const p = this.params;
    const here = this.root.position;
    const limit = this.world.layout.fieldHalf - 6;
    const angle = Math.random() * Math.PI * 2;
    const dist = this.randomBetween(p.wanderMin, p.wanderMax) * (Math.random() < p.wanderFarChance ? 2.5 : 1);
    const target = new THREE.Vector3(
      Math.max(-limit, Math.min(limit, here.x + Math.sin(angle) * dist)),
      0,
      Math.max(-limit, Math.min(limit, here.z + Math.cos(angle) * dist)),
    );
    target.y = this.world.heightAt(target.x, target.z);
    const facing = Math.random() * Math.PI * 2;
    this.fsm.transition('walking', { goal: 'wander', target: () => ({ position: target, facing }) });
  }

  /**
   * Sat on the back, every so often she asks if she can get off (parked) or if
   * you can stop soon (on a long ride). She only gets off if you say so.
   */
  askToGetOff(dt) {
    const p = this.params;
    const q = this.quad;
    if (q.driver) return; // her friend's driving: it's not you she'd ask
    const riding = !!q.rider && q.speed > 1;
    this.askIn ??= this.randomBetween(p.askOffAfterMin, p.askOffAfterMax);
    this.askIn -= dt;
    if (this.askIn > 0) return;
    if (riding) {
      this.selfEvents.push('askStop');
      this.askIn = this.randomBetween(p.askOffAfterMin, p.askOffAfterMax);
    } else if (!q.rider) {
      this.selfEvents.push('askOff');
      this.askedToGetOff = true;
      this.askIn = this.randomBetween(p.askOffAgainMin, p.askOffAgainMax);
    } else {
      this.askIn = 10; // you're on but stopped: ask again in a bit
    }
  }

  /**
   * Sat on the back with nobody else on it, in the end she gets bored and gets
   * off. On there by her own choice, that's after a minute or two; put there by
   * you, she's far more patient (and asks first), but not endlessly.
   */
  boredOnTheBack(dt) {
    const p = this.params;
    const q = this.quad;
    if (q.rider || q.driver || q.passenger || !p.ownMind) {
      this.backBoredIn = null;
      return;
    }
    this.backBoredIn ??= this.seatedByChoice
      ? nextBoredWait(p, this.restlessness) * 1.5
      : this.randomBetween(p.placedPatienceMin, p.placedPatienceMax);
    this.backBoredIn -= dt;
    if (this.backBoredIn > 0) return;
    this.backBoredIn = null;
    if (!this.seatedByChoice || Math.random() < p.boredGetOffChance) {
      this.selfEvents.push(this.seatedByChoice ? 'getOff' : 'getOffWaited');
      this.requestStandBeside(q);
    }
  }

  /**
   * Left on the back of a quad driving itself: each time she either loves it or
   * hates it (`ghostLikes`). Hating it, after a while she climbs onto the front
   * and either stops it and gets off, or drives it about herself.
   */
  watchRunaway(dt) {
    const p = this.params;
    const q = this.quad;
    if (!q.isGhostRiding || q.rider) {
      this.runaway = null;
      return;
    }
    if (!this.runaway) {
      this.runaway = { time: 0, likes: Math.random() < p.ghostFunChance, after: this.randomBetween(p.takeOverAfterMin, p.takeOverAfterMax) };
    }
    const r = this.runaway;
    r.time += dt;
    if (r.likes || r.time < r.after) return;
    // Enough. Over the seat to the front.
    q.releaseGhost();
    this.takeOverPlan = Math.random() < p.takeOverDriveChance ? 'drive' : 'stop';
    this.selfEvents.push(this.takeOverPlan === 'drive' ? 'takeOverDrive' : 'takeOverStop');
    this.runaway = null;
    this.fsm.transition('shuffling', { to: 'rider' });
  }

  /** How she feels about the quad she's on driving itself (null when it isn't). */
  get ghostLikes() {
    return this.runaway ? this.runaway.likes : null;
  }

  /** On the back while her friend drove: once her friend's got off at the end, she gets off too, after a moment. */
  afterFriendsRide(dt) {
    const q = this.quad;
    if (this.friendDriving(q)) {
      this.friendDrove = true;
      this.friendOffIn = null;
      return;
    }
    if (!this.friendDrove || q.rider || q.speed > 0.4) return;
    this.friendOffIn ??= this.randomBetween(1, 3);
    this.friendOffIn -= dt;
    if (this.friendOffIn > 0) return;
    this.friendDrove = false;
    this.friendOffIn = null;
    this.requestStandBeside(q);
  }

  /** You told her to stay on: she grumbles and doesn't ask again for a good while. */
  keepOn() {
    const p = this.params;
    this.askedToGetOff = false;
    this.askIn = this.randomBetween(p.askOffAfterMin, p.askOffAfterMax) * 1.5;
  }

  /**
   * Sat on the back of a quad left running with nobody driving it, now and then
   * (rarely) she leans forward after a while and switches it off.
   */
  mindTheEngine(dt) {
    const q = this.quad;
    const idling = q.engine.isRunning && !q.rider && !q.driver && !q.isGhostRiding && q.speed < 0.3;
    if (!idling) {
      this.keyOffIn = null;
      return;
    }
    // Decided once each time she's left sitting there.
    this.keyOffIn ??= Math.random() < this.params.keyOffChance ? this.randomBetween(this.params.keyOffAfterMin, this.params.keyOffAfterMax) : Infinity;
    this.keyOffIn -= dt;
    if (this.keyOffIn <= 0) {
      this.keyOffIn = null;
      q.engine.setIgnition(false);
      this.selfEvents.push('keyOff');
    }
  }

  /** Walks to the bars of a quad and has a go at starting it. */
  requestStart(quad) {
    if (this.stopDriving('off', () => this.requestStart(quad))) return;
    if (this.fsm.is('seated', 'mounting')) {
      this.afterDismount = () => this.requestStart(quad);
      this.fsm.transition('dismounting');
      return;
    }
    this.quad = quad;
    this.fsm.transition('walking', { goal: 'start', target: () => this.startPoint() });
  }

  requestStandBeside(quad = this.quad) {
    if (this.stopDriving('off', quad !== this.quad ? () => this.requestStandBeside(quad) : null)) return;
    if (this.fsm.is('seated', 'mounting')) {
      this.afterDismount = quad !== this.quad ? () => this.requestStandBeside(quad) : null;
      this.fsm.transition('dismounting');
    } else {
      this.quad = quad;
      this.fsm.transition('walking', { goal: 'stand', target: () => this.standPoint() });
    }
  }

  // Positions around the quad ---------------------------------------------

  /** Side of the bike (+1 left, -1 right) nearer to her. */
  nearSide(quad = this.quad) {
    const local = quad.model.worldToLocal(this.root.getWorldPosition(this.tmpV));
    return local.x >= 0 ? 1 : -1;
  }

  /** Standing spot beside the pillion seat, facing the bike. */
  standPoint(side, quad = this.quad) {
    const auto = side === undefined;
    if (auto) side = this.root.parent === this.scene ? this.nearSide(quad) : 1;
    // Off the front rack she lands beside the front, not the back.
    const z = this.fsm?.is('dismounting') && this.dismountingFrom === 'rack' ? 0.7 : -0.35;
    let p = quad.localToWorld(side * this.params.standOffset, 0, z);
    // Someone else already standing there: the other side.
    if (auto && this.others().some((o) => o.root.position.distanceTo(p) < 0.9)) p = quad.localToWorld(-side * this.params.standOffset, 0, z);
    p.y = this.world.heightAt(p.x, p.z);
    const c = quad.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  /** Where she climbs on from, just beside the pillion footrest. */
  mountPoint() {
    const side = this.nearSide();
    const p = this.quad.localToWorld(side * 0.85, 0, this.seatKind === 'rack' ? 0.75 : -0.5);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: this.quad.yaw, side };
  }

  /** Beside the handlebars on her nearer side, facing them, within reach of the key and starter. */
  startPoint(quad = this.quad) {
    const side = this.root.parent === this.scene ? this.nearSide(quad) : 1;
    const p = quad.localToWorld(side * 0.8, 0, 0.3);
    p.y = this.world.heightAt(p.x, p.z);
    const bars = quad.localToWorld(0, 0, 0.35);
    return { position: p, facing: Math.atan2(bars.x - p.x, bars.z - p.z), side };
  }

  isStandingBeside(quad = this.quad) {
    if (!this.fsm.is('idle')) return false;
    const s = this.standPoint(undefined, quad);
    return s.position.distanceTo(this.root.position) < 0.6 && Math.abs(angleTo(this.heading, s.facing)) < 0.6;
  }

  /** Root-local transform that puts her hips on the pillion seat (or the front seat). */
  seatOffset(front = false) {
    const p = this.params;
    if (!front && this.seatKind === 'rack') return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.rackSeatRaise, -this.sitHips.z + p.rackSeatForward);
    if (front) return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.driveSeatRaise, -this.sitHips.z + p.driveSeatForward);
    return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.seatRaise, -this.sitHips.z + p.seatForward);
  }

  /** The legs' spread for the back seat she's in: astride the pillion, nearly together on the front rack. */
  seatSpread() {
    return this.params.legSpread * (this.seatKind === 'rack' ? this.params.rackLegSpread : 1);
  }

  // Movement ------------------------------------------------------------------

  /** Walks toward `target`; returns true on arrival. */
  walkToward(dt, target) {
    const p = this.params;
    const pos = this.root.position;
    const to = this.tmpV.set(target.x - pos.x, 0, target.z - pos.z);
    const dist = to.length();
    if (dist < p.arriveRadius) return true;
    to.divideScalar(dist);

    let desired = Math.atan2(to.x, to.z);
    this.avoidTimer -= dt;
    if (this.stuckTimer < 5 && this.blocked(desired, Math.min(p.probeDistance, dist - 0.1))) {
      // Try angles either side, keeping to one side for a while so she doesn't dither.
      const offsets = [0.5, 1.0, 1.5, 2.0, 2.5];
      let found = null;
      for (const o of offsets) {
        for (const side of [this.avoidSide, -this.avoidSide]) {
          if (found === null && !this.blocked(desired + side * o, p.probeDistance)) {
            found = desired + side * o;
            if (side !== this.avoidSide && this.avoidTimer <= 0) {
              this.avoidSide = side;
              this.avoidTimer = 1.5;
            }
          }
        }
      }
      if (found !== null) desired = found;
    }

    this.heading += angleTo(this.heading, desired) * Math.min(1, p.turnRate * dt);
    // Slow down when turning sharply and near the end.
    const turnFactor = Math.max(0.2, Math.cos(angleTo(this.heading, desired)));
    const speed = p.walkSpeed * turnFactor * Math.min(1, dist / 0.6 + 0.3);
    pos.x += Math.sin(this.heading) * speed * dt;
    pos.z += Math.cos(this.heading) * speed * dt;
    pos.y = this.world.heightAt(pos.x, pos.z);
    this.root.rotation.y = this.heading;
    this.rig.setTimeScale(speed / p.walkAnimSpeed);

    // Track progress so she can push through if she gets wedged.
    if (pos.distanceTo(this.lastPos) < 0.3 * dt) this.stuckTimer += dt;
    else this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    this.lastPos.copy(pos);
    return false;
  }

  blocked(angle, distance) {
    if (distance <= 0.05) return false;
    const pos = this.root.position;
    const ray = new this.RAPIER.Ray(
      { x: pos.x, y: pos.y + 0.5, z: pos.z },
      { x: Math.sin(angle), y: 0, z: Math.cos(angle) },
    );
    const terrain = this.world.terrain.collider.handle;
    const own = this.collider.handle;
    const hit = this.physics.castRay(ray, distance, true, undefined, undefined, undefined, undefined, (c) => {
      return c.handle !== terrain && c.handle !== own;
    });
    return !!hit;
  }

  turnToward(dt, facing) {
    this.heading += angleTo(this.heading, facing) * Math.min(1, this.params.turnRate * dt);
    this.root.rotation.y = this.heading;
  }

  syncCollider() {
    const p = this.root.position;
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS, z: p.z });
  }

  /** The anchor for the seat she's getting on: the front seat, the back, or the front rack. */
  seatAnchor(front) {
    if (front) return this.quad.riderAnchor;
    return this.seatKind === 'rack' ? this.quad.rackAnchor : this.quad.pillionAnchor;
  }

  setColliderEnabled(on) {
    this.collider.setEnabled(on);
    if (on) {
      const p = this.root.position;
      this.body.setTranslation({ x: p.x, y: p.y + CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS, z: p.z }, true);
    }
  }

  /**
   * @param {number} dt
   * @param {VibrationModel} vibration
   * @param {object} viewer  { position: world position of the player's eyes, isRiding, talking }
   */
  update(dt, vibration, viewer) {
    this.fsm.update(dt);
    this.updateBoredom(dt, viewer);
    if (viewer) this.updateGlance(dt, viewer);
    this.updateFidget(dt);
    if (this.root.parent === this.scene) this.syncCollider();

    // Seated riders shake with the bike; the rig adds a little upper-body lag.
    if ((this.isSeated || this.fsm.is('driving')) && vibration) {
      const k = this.params.rideBounce;
      this.rig.spineSway.pitch = vibration.camera.pitch * 2 * k + vibration.body.pitch * 0.8 * k;
      this.rig.spineSway.roll = vibration.camera.roll * 2 * k;
    } else {
      this.rig.spineSway.pitch = 0;
      this.rig.spineSway.roll = 0;
    }
    this.rig.update(dt);
  }
}

Object.assign(Companion.prototype, drivingMethods);
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(warmingMethods));
Object.assign(Companion.prototype, wavingMethods);
// (restingMethods has getters, so copy its descriptors rather than assigning.)
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(restingMethods));

// Idle behaviour -------------------------------------------------------------

Companion.prototype.updateGlance = function (dt, viewer) {
  const p = this.params;
  const rig = this.rig;
  // Riding together she's behind you, so there's nothing to look at.
  const ridingTogether = viewer.isRiding && this.isSeated;
  const near = this.root.getWorldPosition(this.tmpV).distanceTo(viewer.position) < p.glanceRange;
  let want = 0;
  if (viewer.talking && near) {
    want = 1; // looks at you while you're talking to her
  } else if (!ridingTogether && near && !this.fsm.is('mounting', 'dismounting')) {
    if (this.glanceLeft > 0) {
      this.glanceLeft -= dt;
      want = 1;
    } else if ((this.glanceTimer -= dt) <= 0) {
      this.glanceLeft = this.randomBetween(p.glanceHoldMin, p.glanceHoldMax);
      this.glanceTimer = this.randomBetween(p.glanceEveryMin, p.glanceEveryMax);
    }
  }
  rig.lookTarget.copy(viewer.position);
  rig.lookWeight += (want - rig.lookWeight) * Math.min(1, p.lookSpeed * dt);
};

// Small movements, each with a shape over its life (0..1) and offsets to apply.
const FIDGETS = {
  // Lifts one arm out and bends the elbow, as if adjusting her grip or hair.
  arm: (k, side) => (side > 0 ? { leftArmOut: 0.55 * k, leftElbow: 0.9 * k } : { rightArmOut: 0.55 * k, rightElbow: 0.9 * k }),
  // Shifts her weight to one side.
  lean: (k, side) => ({ spineRoll: 0.24 * k * side, headYaw: -0.2 * k * side }),
  // Stretches back with both arms out a little.
  stretch: (k) => ({ spinePitch: -0.18 * k, leftArmOut: 0.35 * k, rightArmOut: 0.35 * k, leftElbow: 0.3 * k, rightElbow: 0.3 * k }),
  // Looks out over the field to one side.
  lookAround: (k, side) => ({ headYaw: 1.05 * k * side, spineRoll: 0.05 * k * side }),
};
const SEATED_FIDGETS = ['arm', 'lean', 'stretch', 'lookAround', 'arm', 'lookAround'];
const STANDING_FIDGETS = ['lean', 'lookAround'];

Companion.prototype.updateFidget = function (dt) {
  const p = this.params;
  const offsets = this.rig.offsets;
  for (const key in offsets) offsets[key] = 0;

  // Reaching for the key and the starter while she gets a quad going.
  const a = this.attempt;
  const want = a && !a.done ? (a.starter || a.phase === 'reach' ? 1 : 0.45) : 0;
  this.reach += (want - this.reach) * Math.min(1, dt * 5);
  if (this.reach > 0.01) {
    const k = smooth(Math.min(1, this.reach));
    if (this.reachSide > 0) Object.assign(offsets, { leftArmOut: 0.6 * k, leftElbow: 0.5 * k, spinePitch: 0.12 * k });
    else Object.assign(offsets, { rightArmOut: 0.6 * k, rightElbow: 0.5 * k, spinePitch: 0.12 * k });
    return;
  }

  const seated = this.isSeated;
  const standing = this.fsm.is('idle');
  if (!this.fidget && (seated || standing)) {
    if ((this.fidgetTimer -= dt) <= 0) {
      const list = seated ? SEATED_FIDGETS : STANDING_FIDGETS;
      this.fidget = {
        type: list[Math.floor(Math.random() * list.length)],
        side: Math.random() < 0.5 ? -1 : 1,
        t: 0,
        duration: 1.6 + Math.random() * 1.6,
      };
      // Standing, she fidgets less often.
      this.fidgetTimer = this.randomBetween(p.fidgetEveryMin, p.fidgetEveryMax) * (seated ? 1 : 2);
    }
  }
  if (!this.fidget) return;
  const f = this.fidget;
  f.t += dt / f.duration;
  if (f.t >= 1 || !(seated || standing)) {
    this.fidget = null;
    return;
  }
  // Ease in, hold, ease out.
  const k = smooth(Math.min(1, f.t / 0.3)) * smooth(Math.min(1, (1 - f.t) / 0.3)) * p.fidgetScale;
  Object.assign(offsets, FIDGETS[f.type](k, f.side));
};

// State definitions. `this` is the Companion.
const STATES = {
  ...drivingStates,
  ...restingStates,

  idle: {
    enter() {
      this.rig.play('Idle');
    },
    update(dt, data) {
      if (data.facing !== undefined) this.turnToward(dt, data.facing);
    },
    exit() {
      this.warmingAt = null; // whatever she does next, the hands come down
    },
  },

  walking: {
    enter() {
      this.rig.play('Walking', { fade: 0.25 });
      this.stuckTimer = 0;
    },
    update(dt, data) {
      const t = data.target();
      // Hold back near a moving quad until it stops.
      if ((data.goal === 'mount' || data.goal === 'drive') && this.quad.speed > this.params.maxMountSpeed) {
        if (t.position.distanceTo(this.root.position) < 1.2) {
          this.rig.setTimeScale(0);
          return;
        }
      }
      if (this.walkToward(dt, t.position)) {
        if (data.goal === 'mount') this.fsm.transition('mounting', { side: t.side });
        // If you've beaten her to the front seat, she gets on the back.
        else if (data.goal === 'drive') this.fsm.transition('mounting', { side: t.side, seat: this.quad.rider ? 'pillion' : 'rider' });
        else if (data.goal === 'start') this.fsm.transition('starting', { facing: t.facing, side: t.side });
        else if (data.goal === 'prank') this.fsm.transition('pranking', { facing: t.facing, act: data.act, stay: data.stay, out: data.out });
        else if (data.goal === 'rest') this.fsm.transition('resting', { spot: data.spot, stay: data.stay });
        else if (data.goal === 'warm') {
          this.fsm.transition('idle', { facing: t.facing });
          this.startWarming(data.quad, data.side);
        } else this.fsm.transition('idle', { facing: t.facing });
      }
    },
  },

  // Up to no good: a quiet moment at the thing she's meddling with, then done.
  pranking: {
    enter() {
      this.rig.play('Idle', { fade: 0.3 });
      this.prankDone = false;
    },
    update(dt, data) {
      this.turnToward(dt, data.facing);
      if (!this.prankDone && this.fsm.time > 1.4) {
        this.prankDone = true;
        data.act();
      }
      if (this.fsm.time > (data.stay ?? 2.6)) {
        if (data.out) this.walkTo(new THREE.Vector3(data.out.x, this.world.heightAt(data.out.x, data.out.z), data.out.z), data.facing);
        else this.fsm.transition('idle', { facing: data.facing });
      }
    },
  },

  // Having a go at starting the quad: key, tap, choke, starter, then minding the choke as it warms.
  starting: {
    enter(data) {
      this.rig.play('Idle', { fade: 0.3 });
      this.attempt = new StartingAttempt(this.quad, { params: { ...DEFAULT_STARTING_PARAMS, pullWhenFlat: this.params.startPullWhenFlat } });
      this.reachSide = data.side ?? 1;
    },
    update(dt, data) {
      this.turnToward(dt, data.facing);
      const a = this.attempt;
      // You've got on, or it's gone over: she leaves it to you.
      if (this.quad.rider || this.quad.isTipped) a.abandon();
      for (const e of a.update(dt)) this.startEvents.push(e);
      this.quad.helperStarter = a.starter;
      if (a.done) {
        if (a.result === 'running' && !this.quad.rider) this.startEvents.push('warmedUp');
        this.fsm.transition('idle', { facing: data.facing });
      }
    },
    exit() {
      this.quad.helperStarter = false;
      this.attempt = null;
    },
  },

  mounting: {
    enter() {
      this.setColliderEnabled(false);
      this.startPos = this.root.position.clone();
      this.startHeading = this.heading;
      this.rig.play('Sitting', { once: true, fade: 0.3 });
    },
    update(dt, data) {
      const p = this.params;
      const t = Math.min(1, this.fsm.time / p.mountDuration);
      const k = smooth(t);
      // Blend from the ground to the seat, swinging round to face forward.
      const front = data.seat === 'rider';
      const seat = this.seatAnchor(front).localToWorld(this.seatOffset(front));
      this.root.position.lerpVectors(this.startPos, seat, k);
      // Lift over the seat rather than sliding through it.
      this.root.position.y += Math.sin(Math.PI * k) * 0.15;
      this.heading = this.startHeading + angleTo(this.startHeading, this.quad.yaw) * k;
      this.root.rotation.y = this.heading;
      this.rig.legSpread = (front ? p.legSpread : this.seatSpread()) * k;
      if (t >= 1) this.fsm.transition(front ? 'driving' : 'seated');
    },
  },

  seated: {
    enter() {
      const rack = this.seatKind === 'rack';
      this.seatAnchor(false).add(this.root);
      this.root.position.copy(this.seatOffset());
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = this.seatSpread();
      // On the rack there's nobody to hold on to: the sitting clip's hands on her lap will do.
      if (rack) this.quad.rackRider = this;
      else this.pillion.engage();
    },
    update(dt) {
      // Pick up live tuning of the seat position.
      this.root.position.copy(this.seatOffset());
      this.rig.legSpread = this.seatSpread();
      if (this.seatKind === 'rack') {
        this.afterFriendsRide(dt);
        return;
      }
      this.pillion.update(dt);
      this.mindTheEngine(dt);
      this.askToGetOff(dt);
      this.boredOnTheBack(dt);
      this.watchRunaway(dt);
      this.afterFriendsRide(dt);
    },
    exit() {
      this.askedToGetOff = false;
      this.askIn = null;
      if (this.quad.rackRider === this) this.quad.rackRider = null;
      this.pillion.release();
    },
  },

  dismounting: {
    enter() {
      this.dismountingFrom = this.root.parent === this.quad.riderAnchor ? 'rider' : this.root.parent === this.quad.rackAnchor ? 'rack' : 'pillion';
      // Off on the left, unless her friend's getting off or standing there.
      this.dismountSide = this.others().some((o) => o.root.position.distanceTo(this.standPoint(1).position) < 0.9 || (o.quad === this.quad && o.fsm.is('dismounting') && o.dismountSide === 1)) ? -1 : 1;
      // Back into the world, keeping her current world transform.
      this.scene.attach(this.root);
      this.startPos = this.root.position.clone();
      const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ');
      this.root.rotation.set(0, e.y, 0);
      this.startHeading = e.y;
      this.target = this.standPoint(this.dismountSide);
      this.rig.play('Sitting', { once: true, timeScale: -1, fade: 0.2 });
    },
    update() {
      const p = this.params;
      const t = Math.min(1, this.fsm.time / p.dismountDuration);
      const k = smooth(t);
      this.target = this.standPoint(this.dismountSide);
      this.root.position.lerpVectors(this.startPos, this.target.position, k);
      this.root.position.y += Math.sin(Math.PI * k) * 0.12;
      this.heading = this.startHeading + angleTo(this.startHeading, this.target.facing) * k;
      this.root.rotation.y = this.heading;
      this.rig.legSpread = (this.dismountingFrom === 'rack' ? this.seatSpread() : p.legSpread) * (1 - k);
      if (t >= 1) {
        this.rig.legSpread = 0;
        this.setColliderEnabled(true);
        if (this.dismountingFrom === 'rider' && Math.random() < p.parkBrakeChance) this.quad.parkBrake = true;
        this.fsm.transition('idle', { facing: this.target.facing });
        // A request that needed her off this quad first (e.g. getting on the other one).
        const next = this.afterDismount;
        this.afterDismount = null;
        next?.();
      }
    },
  },
};
