import * as THREE from 'three';
import { StateMachine } from './stateMachine.js';
import { CharacterRig } from './characterRig.js';
import { DEFAULT_COMPANION_PARAMS } from './companionParams.js';
import { applyOutfit, refitOutfit, OUTFITS } from './outfit.js';
import { shapeFigure } from './figure.js';
import { StartingAttempt } from './startingAttempt.js';
import { drivingStates, drivingMethods } from './companionDriving.js';
import { PillionPose } from './pillionPose.js';
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
    applyOutfit(this.rig, OUTFITS[params.outfit] ?? OUTFITS.original);
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
    this.reach = 0; // how far she's reaching for the bars, 0..1
    this.drive = null; // her go at driving, while she's on the front seat (herDriving.js)
    this.driveEvents = []; // what's happened while she's driving, for her voice
    this.gripReach = 0; // how far her hands are on the grips, 0..1
    // Holding on, leaning and looking about while she rides pillion.
    this.pillion = new PillionPose(this);
    this.rig.posers.push((dt) => this.pillion.apply(dt));
    // Hands on the bars while she's driving (companionDriving.js).
    this.rig.posers.push((dt) => this.poseDriving(dt));
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
    refitOutfit(this.rig, OUTFITS[this.params.outfit] ?? OUTFITS.original);
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

  /** Another companion is busy with this quad, so she leaves it alone. */
  takenByOther(quad) {
    return this.others().some((o) => o.claimedQuad === quad);
  }

  // Requests ----------------------------------------------------------------

  /**
   * Menu options that make sense right now. With several quads, each gets its
   * own options, nearest to her first.
   */
  getActions(quads = [this.quad]) {
    const s = this.fsm;
    const here = this.root.getWorldPosition(new THREE.Vector3());
    const sorted = quads.filter((q) => !this.takenByOther(q)).sort((a, b) => a.position.distanceTo(here) - b.position.distanceTo(here));
    // Only quads with a pillion seat can carry her.
    const rideable = (q) => q.hasPillion && !q.isTipped;
    const actions = [];
    if (s.is('driving')) return this.drivingActions();
    if (s.is('shuffling')) return actions;
    const drivable = (q) => this.canDrive(q) && !(s.is('walking') && s.data?.goal === 'drive' && q === this.quad);
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
        if (drivable(q)) actions.push({ kind: 'drive', quad: q, short: 'Drive it', label: `Drive the ${q.label}`, run: () => this.requestDrive(q) });
      }
      return actions;
    }
    if (s.is('dismounting')) return actions;
    // She can have a go at starting any quad that isn't running and has nobody on it.
    const startable = (q) => !q.engine.isRunning && !q.rider && !q.isTipped && !q.isGhostRiding;
    for (const q of sorted) {
      if (drivable(q) && q.hasPillion) actions.push({ kind: 'giveRide', quad: q, short: 'Take me for a ride', label: `Take me for a ride on the ${q.label}`, run: () => this.requestDrive(q, { giveRide: true }) });
      if (drivable(q)) actions.push({ kind: 'follow', quad: q, short: 'Follow me on it', label: `Follow me on the ${q.label}`, run: () => this.requestDrive(q, { follow: true }) });
      if (startable(q) && !(s.is('starting') && q === this.quad)) {
        actions.push({ kind: 'start', quad: q, short: 'Start it', label: `Start the ${q.label}`, run: () => this.requestStart(q) });
      }
      if (drivable(q)) actions.push({ kind: 'drive', quad: q, short: 'Drive it', label: `Drive the ${q.label}`, run: () => this.requestDrive(q) });
      if (rideable(q)) actions.push({ kind: 'mount', quad: q, short: 'Get on it', label: `Get on the ${q.label}`, run: () => this.requestMount(q) });
      if (!this.isStandingBeside(q)) actions.push({ kind: 'stand', quad: q, short: 'Stand next to it', label: `Stand next to the ${q.label}`, run: () => this.requestStandBeside(q) });
    }
    return actions;
  }

  requestMount(quad = this.quad, { ownChoice = false } = {}) {
    if (!quad.hasPillion) return;
    // On the back because she chose to: she can get bored and get off again. Put there by you, she waits to be asked.
    this.seatedByChoice = ownChoice;
    // Driving this one: onto the back. Another: off this one first.
    if (this.stopDriving(quad === this.quad ? 'back' : 'off', quad === this.quad ? null : () => this.requestMount(quad))) return;
    if (this.fsm.is('seated', 'mounting') && quad !== this.quad) {
      // Off this one first, then over to the other.
      this.afterDismount = () => this.requestMount(quad);
      this.fsm.transition('dismounting');
      return;
    }
    if (this.fsm.is('seated')) return;
    this.quad = quad;
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
    const waiting = this.fsm.is('idle') && !viewer?.talking;
    this.idleFor = waiting ? this.idleFor + dt : 0;
    if (!p.ownMind || this.idleFor < this.boredAfter) return;
    this.idleFor = 0;
    this.boredAfter = nextBoredWait(p, this.restlessness);
    const here = this.root.position;
    const near = (q) => q.position.distanceTo(here) < 40 && !this.takenByOther(q) && !q.rider && !q.isTipped && !q.isGhostRiding && q.speed < 0.5;
    const options = {
      mount: this.quads.filter((q) => near(q) && q.hasPillion),
      start: this.quads.filter((q) => near(q) && !q.engine.isRunning),
      drive: this.quads.filter((q) => near(q) && this.canDrive(q)),
    };
    const can = Object.fromEntries(Object.entries(options).map(([k, list]) => [k, list.length > 0]));
    const choice = pickBoredChoice(p, { confidence: this.driveConfidence ?? p.driveConfidence, can });
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    this.selfEvents.push(choice);
    if (choice === 'mount') this.requestMount(pick(options.mount), { ownChoice: true });
    else if (choice === 'start') this.requestStart(pick(options.start));
    else if (choice === 'drive') this.requestDrive(pick(options.drive));
    else this.wander();
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
    let p = quad.localToWorld(side * this.params.standOffset, 0, -0.35);
    // Someone else already standing there: the other side.
    if (auto && this.others().some((o) => o.root.position.distanceTo(p) < 0.9)) p = quad.localToWorld(-side * this.params.standOffset, 0, -0.35);
    p.y = this.world.heightAt(p.x, p.z);
    const c = quad.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  /** Where she climbs on from, just beside the pillion footrest. */
  mountPoint() {
    const side = this.nearSide();
    const p = this.quad.localToWorld(side * 0.85, 0, -0.5);
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
    if (front) return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.driveSeatRaise, -this.sitHips.z + p.driveSeatForward);
    return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.seatRaise, -this.sitHips.z + p.seatForward);
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

  idle: {
    enter() {
      this.rig.play('Idle');
    },
    update(dt, data) {
      if (data.facing !== undefined) this.turnToward(dt, data.facing);
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
        else this.fsm.transition('idle', { facing: t.facing });
      }
    },
  },

  // Having a go at starting the quad: key, tap, choke, starter, then minding the choke as it warms.
  starting: {
    enter(data) {
      this.rig.play('Idle', { fade: 0.3 });
      this.attempt = new StartingAttempt(this.quad);
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
      const seat = (front ? this.quad.riderAnchor : this.quad.pillionAnchor).localToWorld(this.seatOffset(front));
      this.root.position.lerpVectors(this.startPos, seat, k);
      // Lift over the seat rather than sliding through it.
      this.root.position.y += Math.sin(Math.PI * k) * 0.15;
      this.heading = this.startHeading + angleTo(this.startHeading, this.quad.yaw) * k;
      this.root.rotation.y = this.heading;
      this.rig.legSpread = p.legSpread * k;
      if (t >= 1) this.fsm.transition(front ? 'driving' : 'seated');
    },
  },

  seated: {
    enter() {
      this.quad.pillionAnchor.add(this.root);
      this.root.position.copy(this.seatOffset());
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = this.params.legSpread;
      this.pillion.engage();
    },
    update(dt) {
      // Pick up live tuning of the seat position.
      this.root.position.copy(this.seatOffset());
      this.rig.legSpread = this.params.legSpread;
      this.pillion.update(dt);
      this.mindTheEngine(dt);
      this.askToGetOff(dt);
      this.boredOnTheBack(dt);
      this.watchRunaway(dt);
    },
    exit() {
      this.askedToGetOff = false;
      this.askIn = null;
      this.pillion.release();
    },
  },

  dismounting: {
    enter() {
      // Back into the world, keeping her current world transform.
      this.scene.attach(this.root);
      this.startPos = this.root.position.clone();
      const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ');
      this.root.rotation.set(0, e.y, 0);
      this.startHeading = e.y;
      this.target = this.standPoint(1);
      this.rig.play('Sitting', { once: true, timeScale: -1, fade: 0.2 });
    },
    update() {
      const p = this.params;
      const t = Math.min(1, this.fsm.time / p.dismountDuration);
      const k = smooth(t);
      this.target = this.standPoint(1);
      this.root.position.lerpVectors(this.startPos, this.target.position, k);
      this.root.position.y += Math.sin(Math.PI * k) * 0.12;
      this.heading = this.startHeading + angleTo(this.startHeading, this.target.facing) * k;
      this.root.rotation.y = this.heading;
      this.rig.legSpread = p.legSpread * (1 - k);
      if (t >= 1) {
        this.rig.legSpread = 0;
        this.setColliderEnabled(true);
        this.fsm.transition('idle', { facing: this.target.facing });
        // A request that needed her off this quad first (e.g. getting on the other one).
        const next = this.afterDismount;
        this.afterDismount = null;
        next?.();
      }
    },
  },
};
