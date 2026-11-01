import * as THREE from 'three';
import { attachKeepingSize } from './attachKeepingSize.js';
import { recallPlan, strandedOnVehicle } from './recallPlan.js';
import { StateMachine } from './stateMachine.js';
import { CharacterRig } from './characterRig.js';
import { DEFAULT_COMPANION_PARAMS } from './companionParams.js';
import { outfitsFor } from './outfits.js';
import { applyOutfit, refitOutfit, reshirt, restyle, withJumper, withCoat, setHood, OUTFITS } from './outfit.js';
import { shapeFigure } from './figure.js';
import { StartingAttempt, DEFAULT_STARTING_PARAMS } from './startingAttempt.js';
import { TractorStartAttempt, DEFAULT_TRACTOR_START_PARAMS } from './tractorStart.js';
import { drivingStates, drivingMethods } from './companionDriving.js';
import { hayRideStates, hayRideMethods, DEFAULT_HAYSEAT_PARAMS } from './companionHayRide.js';
import { thrownStates, DEFAULT_THROWN_PARAMS } from './companionThrown.js';
import { DEFAULT_MOTO_PARAMS } from './motoGo.js';
import { restingMethods, restingStates } from './companionResting.js';
import { warmingMethods } from './companionWarming.js';
import { keepAliveMethods } from './companionKeepAlive.js';
import { numbMethods } from './companionNumb.js';
import { carryingMethods } from './companionCarrying.js';
import { carryParams } from './carrying.js';
import { Contentment } from './contentment.js';
import { SideSaddleSlip, pickSideSaddle } from './sideSaddle.js';
import { exhaustSideOf, pipeHeat, dismountSideFor, burns } from './exhaustBurn.js';
import { wavingMethods } from './companionWaving.js';
import { strandedMethods } from './companionStranded.js';
import { throwingMethods } from './companionThrowing.js';
import { waitingMethods } from './companionWaiting.js';
import { DEFAULT_DOUGHNUT_PARAMS, ringPoints } from './doughnuts.js';
import { DEFAULT_SHOWOFF_PARAMS, pickTrick } from './showOff.js';
import { DEFAULT_JUMP_PARAMS } from './jumps.js';
import { DEFAULT_LINEUP_PARAMS, nextJob, assignSlots, rowSlots, crookedSlot, parkRoute, nudgePose } from './lineUp.js';
import { DEFAULT_HOME_PARAMS, jogging } from './homeParking.js';
import { PillionPose } from './pillionPose.js';
import { createMuddiness } from './muddiness.js';
import { GirlMud } from '../effects/girlMud.js';
import { canRideRack } from './rackSeat.js';
import { nextBoredWait, driftRestlessness, boredOdds, BORED_NORM } from './boredom.js';
import { moveMethods, DEFAULT_MOVE_PARAMS } from './companionMoves.js';
import { DEFAULT_IDLE_POSE_PARAMS } from './poseMoves.js';
import { Attention, DEFAULT_NOTICE_PARAMS, hearingFactor } from './attention.js';
import { reactingMethods } from './companionReacting.js';
import { availabilityOf, JOBS } from './availability.js';
import { Needs } from './needs.js';
import { BackNap } from './backNap.js';
import { firstThink } from './chooser.js';
import { DEFAULT_DOZE_PARAMS, dozePose } from './dozing.js';
import { Memory } from './memory.js';
import { QuadOpinion, OPINION_PARAMS } from './quadOpinion.js';
import { bonusFor, STRENGTH_PARAMS } from '../vehicle/strength.js';
import { Agenda } from './agenda.js';
import { Intent, walkPace } from './intent.js';
import { Mood } from './mood.js';
import { standBy, tagPoint } from './pair.js';

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const NO_CONTACT_FORCES = 0xffff0000; // in every solver group, pushes against none
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
    // Her clothes are fitted once the game has dealt her shirt colour and buttons (setShirt, or dress), not twice.
    applyOutfit(this.rig, this.outfit, { garments: false });
    this.mucky = createMuddiness(); // how muddy and dusty she is (muddiness.js)
    this.girlMud = new GirlMud(this.rig); // and how that looks on her
    this.root = this.rig.root;
    this.root.name = `companion ${name}`;
    scene.add(this.root);

    // Where her hips sit in the sitting pose, so she can be placed on the seat.
    this.sitHips = this.rig.measureHips('SitIdle', 0);
    // And standing, so getting on can carry her hips from one to the other (companionMoves.js).
    this.standHips = this.rig.measureHips('Idle', 0);
    this.moveParams = { ...DEFAULT_MOVE_PARAMS }; // the game shares one set between them, for tuning
    this.idlePoseParams = { ...DEFAULT_IDLE_POSE_PARAMS };
    this.moving = null; // getting on or off, while she is (companionMoves.js)
    this.sittingPose = null; // how she sits on the seat she's on (SEAT_POSES in poseMoves.js)
    this.movingSeatPose = null; // and on the one she's getting on or off
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
    // She's moved by hand, so she can end up overlapping a quad; a kinematic body then shoves it away. Pushing against nothing
    // (as the player's does when stumbling) keeps the quads where they are; the player's controller still can't walk through her.
    this.collider.setSolverGroups(NO_CONTACT_FORCES);

    this.tmpV = new THREE.Vector3();
    this.avoidSide = 1;
    this.avoidTimer = 0;
    this.holdTimer = 0; // seconds left of keeping to a way round something
    this.holdAngle = null;
    this.stuckTimer = 0;

    // Start beside the quad on its left, facing it.
    const stand = this.standPoint(1);
    this.root.position.copy(stand.position);
    this.heading = stand.facing;
    this.root.rotation.y = this.heading;
    this.setColliderEnabled(true);
    this.lastPos = this.root.position.clone();

    this.fsm = new StateMachine(this, STATES, 'idle');

    // What she looks at (attention.js): who and what is about, what she's busy with, where she's off to, what just happened.
    this.attention = new Attention(this.params, DEFAULT_NOTICE_PARAMS);
    this.lookPick = null; // what attention picked this frame
    this.lookPoint = null; // where her eyes are now, sweeping towards the pick
    this.lookTurn = null; // a heading to turn and face, when a look over her shoulder is held (idle uses it)
    this.callSpot = null; // where she has gone off to take a phone call (phoneCalls.js)
    this.benchAt = null; // stood at the barn bench working on a quad (girlBench.js): she faces it and doesn't turn to look about
    this.attendHint = null; // a sub-activity's own focus: { x, y, z, weight, left } (attend())
    this.lookLeadLeft = 0; // seconds she still looks where she's going before setting off
    // What she wants (needs.js), started a little different for each so they don't move in step, and what she last chose and nearly
    // chose (chooser.js, run by the game's updateMinds; the debug panel's "why").
    this.dozeParams = DEFAULT_DOZE_PARAMS; // the game points this at the shared tuning (Places)
    this.dozeT = 0; // seconds into dozing
    this.dozeK = 0; // how far gone she is (0..1), for her head
    this.needs = new Needs({ purpose: Math.random() * 0.5, excitement: Math.random() * 0.4, company: Math.random() * 0.3, rest: Math.random() * 0.3 });
    this.mind = { thinkIn: firstThink(this.params.thinkEvery), last: null, since: 0, scored: [], waiting: null };
    // What she's set on (intent.js): how she walks to it, and whether you've stopped her on her way.
    this.intent = new Intent();
    this.opinion = new QuadOpinion(''); // which quads she thinks are best on a hill, in mud, on tarmac (quadOpinion.js)
    this.memory = new Memory(); // how each kind of thing has gone for her (memory.js), nudging what she chooses
    this.agenda = new Agenda(null, this.params); // what she has in mind for today (agenda.js), boosting those offers; the game deals hers once it knows who she is
    this.mood = new Mood(); // how she's been feeling over the last few minutes (mood.js)
    this.pace = null; // the chosen thing's pace for the walk to it ('hurry', 'brisk', 'dawdle'), cleared when the walk ends
    this.paceMul = 1;
    this.wetNow = false; // it's raining on her (the game sets it with her needs)
    // Whether she's free (availability.js): features that have her for a while, and what on the farm holds both girls (set by the game).
    this.holds = new Map(); // key -> what she's doing for it
    this.worldHold = null; // () => why both girls are held, or null
    this.fidgetTimer = this.randomBetween(params.fidgetEveryMin, params.fidgetEveryMax);
    this.fidget = null;
    this.startEvents = []; // what she's done while starting a quad, for her voice to pick up
    this.quads = [quad]; // every quad on the farm, for doing things on her own (set by the game)
    this.others = () => []; // the other companions, whose quads she leaves alone (set by the game)
    this.fallenOut = () => false; // she and her friend have fallen out, so they won't share a quad (set by the game, fallingOut.js)
    this.recoil = null; // a jump back from a boil-over, while it lasts (jumpBack)
    this.restlessness = 0.7 + Math.random() * 0.8; // drifts while she's about (boredom.js)
    this.boredAfter = nextBoredWait(params, this.restlessness);
    this.nickJob = null; // a quad of yours she has taken off: { quad, phase: 'away' | 'back', ... } (nicking.js)
    this.selfEvents = []; // things she decided to do on her own, for her voice
    this.favourView = () => ({ mood: 'even', warmth: 1, sulk: 1 }); // how you've treated her (favour.js); the game swaps in the real thing
    this.reach = 0; // how far she's reaching for the bars, 0..1
    this.seatKind = 'pillion'; // which seat she's after or in on the back: 'pillion', or 'rack' (sat on the front rack)
    this.drive = null; // her go at driving, while she's on the front seat (herDriving.js)
    this.driveEvents = []; // what's happened while she's driving, for her voice
    this.crankEvents = []; // what's happened at the Land Rover's starting handle ('keyOn', 'swing', 'kick', 'caught', 'noLuck'), for the game to say something about
    this.pushEvents = []; // what's happened while she pushes a vehicle for a bump-start ('start', 'now', 'caught', 'tired'), for the game to say something about
    this.gripReach = 0; // how far her hands are on the grips, 0..1
    // Holding on, leaning and looking about while she rides pillion.
    this.pillion = new PillionPose(this);
    this.nap = new BackNap(); // asleep on the back of a smooth ride (backNap.js); the game points it at the shared tuning
    this.content = new Contentment(); // what she likes about the quads: them running, the seat shaking her (contentment.js)
    this.sideSaddle = 0; // which way her legs hang on the back this ride: 0 astride, +1 her left, -1 her right (sideSaddle.js)
    this.forceBurn = false; // the debug panel: the next dismount is over the exhaust side and burns (exhaustBurn.js)
    this.burnPending = false;
    this.burntLeg = false;
    this.sideBlend = 0; // 0..1: how far she's turned round to sit that way
    this.sideSlip = new SideSaddleSlip();
    this.slipping = false; // she's coming off the back because she slid
    this.rig.posers.push((dt) => this.pillion.apply(dt));
    // Hands on the bars while she's driving (companionDriving.js).
    this.rig.posers.push((dt) => this.poseDriving(dt));
    this.rig.posers.push((dt) => this.poseCranking(dt));
    this.rig.posers.push((dt) => this.posePushing(dt));
    // Hands over a running engine on a cold day (companionWarming.js).
    this.warmingAt = null;
    this.rig.posers.push((dt) => this.poseWarming(dt));
    // Something in her right hand: the jerry can, the toolbox, a mug (companionCarrying.js).
    this.carry = null;
    this.carryParams = carryParams;
    this.carryPace = 1; // times her walking speed while she carries something heavy
    this.rig.posers.push((dt) => this.poseCarrying(dt));
    // Riding on the bale trailer (companionHayRide.js).
    this.hay = { ...DEFAULT_HAYSEAT_PARAMS };
    this.thrownParams = DEFAULT_THROWN_PARAMS; // coming off the mini moto (companionThrown.js); the game swaps in its tunable copy
    this.motoParams = DEFAULT_MOTO_PARAMS; // her nerve on the mini moto (motoGo.js)
    this.trailer = null;
    this.traSlot = null;
    this.mayJog = false; // the walking state says whether this walk is one she'd jog (homeParking.js)
    this.jogging = false;
    this.paceBoost = 1; // times her walking speed: more when she's running after the trailer
    this.hayFell = false; // she has come off the trailer and wants to catch it up
    this.hayLanded = false;
    this.rig.posers.push((dt) => this.poseHayRide(dt));
    // Waving two-stroke smoke away (companionWaving.js).
    this.waving = null;
    this.rig.posers.push((dt) => this.poseWaving(dt));
    // Pointing at what she's brought you to see (companionWaving.js).
    this.pointing = null;
    this.rig.posers.push((dt) => this.posePointing(dt));
    // Stuck out in the field, waving for you (companionStranded.js).
    this.stranded = null;
    this.strandedParams = null; // the game swaps in its tunable copy
    this.strandedHost = null; // game.js: (girl, event) => the shout, the thanks, the favour
    // Throwing a conker at you (companionThrowing.js).
    this.throwing = null;
    this.rig.posers.push((dt) => this.poseThrowing(dt));
    // Her phone in her hand while she checks it, waiting about (companionWaiting.js).
    this.rig.posers.push(() => this.posePhone());
    // A reaction (a flinch, hands over her ears, a cheer: companionReacting.js) shows over everything else, so it goes last.
    this.reaction = null; // { type, t, from, strength }
    this.reactTurn = null; // a heading to turn to while she turns away from something
    this.rig.posers.push((dt) => this.poseReacting(dt));
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

  /** Fits her clothes as her outfit stands (when nothing else is going to). */
  dress() {
    refitOutfit(this.rig, this.outfit);
  }

  /** How many of her polo's buttons are undone (0 to 5, all of them), refitting it. */
  setPoloOpen(n) {
    this.outfit = { ...this.outfit, poloOpen: Math.max(0, Math.min(5, Math.round(n))) };
    refitOutfit(this.rig, this.outfit);
  }

  /** What she has on top today (npc/outfits.js), repainting and refitting her. */
  setStyle(style) {
    if (style?.kind && !outfitsFor(this.character?.outfitOdds).includes(style.kind)) return; // only Jess wears the crop-top
    this.outfit = restyle(this.rig, this.outfit, style);
  }

  /** Puts a jumper on (a colour), or takes it off (null), refitting what's under it. */
  setJumper(color) {
    this.outfit = withJumper(this.outfit, color);
    refitOutfit(this.rig, this.outfit);
  }

  /** Puts a wax jacket on (a colour), or takes it off (null), over whatever else she has on. */
  setCoat(color) {
    this.outfit = withCoat(this.outfit, color);
    if (!color) this.rig.hoodIsUp = false;
    refitOutfit(this.rig, this.outfit);
  }

  /** Whether she has a helmet on: her ponytail comes out under the back of its rim (outfit.js, ponytailView.js). */
  setUnderHelmet(on) {
    this.rig.underHelmet = !!on;
    if (this.rig.ponytail) this.rig.ponytail.swing.underHelmet = !!on;
  }

  /** Her coat's hood up or down (only shows with a coat on). */
  setHood(up) {
    this.rig.hoodIsUp = !!up;
    setHood(this.rig, up);
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
    if (s.is('idle', 'boarding', 'onTrailer', 'sliding', 'thrown')) return null;
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
    if (quad.loadedOn) return false; // strapped on the trailer
    const owner = quad.unit?.spec.owner;
    return !owner || owner === this.character?.id;
  }

  /** It's hers: when she picks a quad to drive she goes for it first. */
  ownsQuad(quad) {
    return !!this.character && (quad.unit?.spec.owner === this.character.id || quad.unit?.spec.id === this.claimedSpec);
  }

  /** Fallen out, she won't get on a quad her friend is on or about to be on. */
  avoidsFriendOn(quad) {
    return this.fallenOut() && this.others().some((o) => o.claimedQuad === quad);
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
    if (this.avoidsFriendOn(quad) || this.refusesStorm()) return false;
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
    if (this.refusesStorm()) return false;
    if (this.avoidsFriendOn(quad)) return false;
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
    const rideable = (q) => !this.refusesStorm() && this.canRidePillion(q);
    const actions = [];
    if (s.is('driving')) return this.drivingActions();
    if (s.is('boarding', 'onTrailer', 'sliding')) return actions; // on the hay ride: nothing to ask of her
    if (s.is('thrown')) return actions; // lying on the grass
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
        else if (this.refusesMoto(q) || this.refusesStorm()) actions.push({ kind: 'drive', quad: q, short: 'Drive it', label: `Drive the ${q.label}`, run: () => (this.refusesStorm() ? this.refuseStorm() : this.refuseMoto()) });
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
      else if (this.refusesMoto(q) || this.refusesStorm()) actions.push({ kind: 'drive', quad: q, short: 'Drive it', label: `Drive the ${q.label}`, run: () => (this.refusesStorm() ? this.refuseStorm() : this.refuseMoto()) });
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
    this.sideSaddle = seat === 'pillion' ? pickSideSaddle(this.params) : 0;
    this.sideBlend = 0;
    this.sideSlip.reset();
    this.fsm.transition('walking', { goal: 'mount', target: () => this.mountPoint() });
  }

  /**
   * Left standing about long enough, she does something on her own: wanders
   * off for a look round, gets on a quad to wait, has a go at starting one, or
   * has a little drive of one.
   * Once she's sat on a quad she stays there until you ask her to get off.
   */
  /**
   * Her restlessness drifts, and how soon she'll want something to do: her need for it (needs.js, purpose) builds while she stands
   * about, at a pace set by her boredom wait (boredom.js), drawn afresh each time she takes something up (chose()).
   */
  updateBoredom(dt) {
    this.restlessness = driftRestlessness(this.restlessness, dt, this.params);
    this.purposeRate = 1 / Math.max(1, this.boredAfter);
  }

  /** She's taken something up (the chooser picked for her): her next wait is drawn. */
  chose() {
    this.boredAfter = nextBoredWait(this.params, this.restlessness);
  }

  /**
   * What she could do on her own, out of boredom (the old boredom choices), as offers for the chooser (chooser.js): each
   * { key, weight, take }, weighted as the old odds were (her bored*Chance params, driving by her appetite for it, starting by how
   * few are running), and taking one does what that choice always did.
   */
  boredOffers(viewer) {
    const p = this.params;
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
    const jumpPlan = p.boredJumpChance > 0 && drivable.length ? this.jumpPlan() : null;
    // Showing off wants you near enough to see her and a girl sure enough of herself; a wheelie wants a two-stroke.
    const showParams = this.showOffParams ?? DEFAULT_SHOWOFF_PARAMS;
    const showable = p.boredShowOffChance > 0 && (this.driveConfidence ?? p.driveConfidence) >= 0.5 && viewer && viewer.position.distanceTo(here) < showParams.planRange;
    const lineUpJob = p.boredLineUpChance > 0 ? this.planLineUp() : null;
    const options = {
      lineUp: lineUpJob ? [lineUpJob.quad] : [],
      doughnuts: doughnutPlan ? drivable : [],
      showOff: showable ? drivable.filter((q) => !q.tractor) : [],
      jumps: jumpPlan ? drivable.filter((q) => !q.tractor) : [],
      join: this.quads.filter((q) => q.position.distanceTo(here) < 25 && q.speed < 0.5 && !q.rider && settingOff(q) && (this.canRidePillion(q) || this.canRideRackOn(q))),
      buzz: this.quads.filter((q) => near(q) && q.hasPillion && q.engine.wear >= p.buzzWear && this.canRidePillion(q)).sort((a, b) => b.engine.wear - a.engine.wear),
      mount: this.quads.filter((q) => near(q) && q.hasPillion),
      start: this.quads.filter((q) => near(q) && !q.engine.isRunning),
      drive: this.quads.filter((q) => near(q) && this.canDrive(q)),
      rest: this.restSpotsNear?.(here) ?? [],
    };
    const favour = this.favourView();
    const odds = boredOdds(p, { confidence: this.driveConfidence ?? p.driveConfidence, sulk: favour.sulk, startUrge: this.content.startUrge(p) });
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const offer = (key, run, say = key) => ({ key, weight: odds[key] / BORED_NORM, take: () => { this.selfEvents.push(say); run(); } });
    const out = [offer('wander', () => this.wander())];
    if (options.join.length) out.push(offer('join', () => {
      const q = pick(options.join);
      this.requestMount(q, { ownChoice: true, seat: this.canRidePillion(q) ? 'pillion' : 'rack' });
    }));
    // The roughest one near her; started first if it is off, then she sits on the back and stays a while.
    if (options.buzz.length) out.push(offer('buzz', () => this.requestBuzzSit(options.buzz[0])));
    if (options.mount.length) out.push(offer('mount', () => this.requestMount(pick(options.mount), { ownChoice: true })));
    if (options.start.length) out.push(offer('start', () => this.requestStart(pick(options.start))));
    if (options.lineUp.length) out.push(offer('lineUp', () => this.startLineUp(lineUpJob)));
    if (options.showOff.length) out.push(offer('showOff', () => {
      const q = pick(options.showOff);
      this.requestDrive(q, { showOff: { trick: pickTrick(q.engine.params.strokes === 2, showParams), p: showParams } });
    }));
    if (options.jumps.length) out.push(offer('jumps', () => this.requestDrive(pick(options.jumps), { jump: jumpPlan })));
    if (options.doughnuts.length) out.push(offer('doughnuts', () => this.requestDrive(pick(options.doughnuts), { doughnut: doughnutPlan })));
    if (options.drive.length) {
      // Jess now and then takes her friend's quad, to wind her up (ownership.js); neglected, she takes one off alone to make a point.
      const borrowSpec = this.borrowPick?.(options.drive.map((q) => q.unit?.spec.id));
      const borrowed = borrowSpec ? options.drive.find((q) => q.unit?.spec.id === borrowSpec) : null;
      const say = borrowed ? 'borrow' : favour.mood === 'neglected' ? 'sulkOff' : 'drive';
      out.push(offer('drive', () => {
        if (borrowed) this.requestDrive(borrowed);
        else this.requestDrive(this.pickByOpinion(options.drive.some((q) => this.ownsQuad(q)) ? options.drive.filter((q) => this.ownsQuad(q)) : options.drive));
      }, say));
    }
    if (options.rest.length) out.push(offer('rest', () => this.goRest(pick(options.rest), { stay: this.restStayFor?.() }), options.rest[0]?.kind === 'loft' ? 'loftGo' : 'restGo'));
    return out.filter((o) => o.weight > 0);
  }

  /** One of these quads, at random but leaning to the ones she thinks are good at something (quadOpinion.js): 1 plus `pull` times her keenness. */
  pickByOpinion(quads) {
    const truthOf = (id, kind) => bonusFor(this.quads.find((q) => q.unit?.spec.id === id)?.unit.spec, kind);
    const weights = quads.map((q) => 1 + OPINION_PARAMS.pull * this.opinion.keenness(q.unit?.spec.id, truthOf, STRENGTH_PARAMS.amount));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < quads.length; i++) {
      r -= weights[i];
      if (r <= 0) return quads[i];
    }
    return quads[quads.length - 1];
  }

  /**
   * Her next job tidying the quads in front of the barn (lineUp.js): { quad, slot, mode, crooked }, or null if there is nothing
   * to do. The tidy sort works down the untidy ones nearest first; the other sort (lineUpCrookedChance) takes one quad and
   * parks it a bit off its slot on purpose.
   */
  planLineUp(crookedChance = this.params.lineUpCrookedChance ?? 0) {
    const lp = this.lineUpParams ?? DEFAULT_LINEUP_PARAMS;
    const here = this.root.position;
    const quads = this.quads.filter((q) => q.position.distanceTo(here) < lp.nearRange && this.mayRide(q) && !this.takenByOther(q) && this.canDrive(q));
    if (!quads.length) return null;
    const poses = quads.map((q) => ({ x: q.position.x, z: q.position.z, yaw: q.yaw }));
    if (Math.random() < crookedChance) {
      const slots = assignSlots(poses, rowSlots(poses.length, lp));
      const i = Math.floor(Math.random() * quads.length);
      return { quad: quads[i], slot: crookedSlot(slots[i], lp), mode: 'drive', crooked: true };
    }
    const job = nextJob(poses, { x: here.x, z: here.z }, lp);
    return job ? { quad: quads[job.index], slot: job.slot, mode: job.mode, crooked: false } : null;
  }

  /** Does a tidying job: drives the quad to its slot, or goes and nudges it straight by hand. */
  startLineUp(job) {
    const lp = this.lineUpParams ?? DEFAULT_LINEUP_PARAMS;
    this.lineUpOn = !job.crooked;
    this.lineUpJob = job;
    this.lineUpWhy = null;
    if (job.crooked) this.selfEvents.push('lineUpCrooked');
    if (job.mode === 'drive') {
      this.requestDrive(job.quad, { park: { route: parkRoute(job.slot, lp), yaw: job.slot.yaw, crooked: job.crooked } });
      return;
    }
    const q = job.quad;
    const side = q.localToWorld(1.2, 0, 0.5);
    const set = this.sneakTo({ x: side.x, z: side.z }, () => {
      this.selfEvents.push('straighten');
      this.nudge = { quad: q, from: { x: q.position.x, z: q.position.z, yaw: q.yaw }, to: job.slot, t: 0 };
    }, lp.shoveSeconds + 1);
    if (!set) this.endLineUp('could not walk to it');
  }

  /**
   * Nicking a quad you left running (nicking.js): she takes it for `seconds`, then brings it back to where it stood (`from`:
   * { x, z, yaw }) at `returnSpeed`. `nickJob.phase` is 'away' and then 'back'; game.js watches it for the mud and the fuel.
   */
  nickQuad(quad, { seconds, returnSpeed }) {
    this.nickJob = { quad, phase: 'away', seconds, returnSpeed, slot: { x: quad.position.x, z: quad.position.z, yaw: quad.yaw }, laughed: 0 };
    this.selfEvents.push('nickGo');
    this.requestDrive(quad);
  }

  /** After one is in place she often goes on to the next, until they are all in a row. */
  continueLineUp() {
    const lp = this.lineUpParams ?? DEFAULT_LINEUP_PARAMS;
    this.lineUpJob = null;
    if (!this.lineUpOn) return this.endLineUp('that was the one job');
    if (Math.random() >= lp.continueChance) return this.endLineUp('got bored of it');
    const job = this.planLineUp(0);
    if (job) this.startLineUp(job);
    else this.endLineUp('nothing left to move');
  }

  /** She's done with tidying, and why (shown in the debug panel). */
  endLineUp(why) {
    this.lineUpOn = false;
    this.lineUpJob = null;
    this.lineUpWhy = why;
  }

  /** For the debug panel: what she's doing about the row. */
  get lineUpStatus() {
    const j = this.lineUpJob;
    if (j) return `${this.nudge ? 'nudging' : j.mode === 'shove' ? 'going to nudge' : 'driving'} the ${j.quad.label}${j.crooked ? ' crooked' : ''} (${this.lineUpOn ? 'then the next' : 'just this one'})`;
    return this.lineUpWhy ? `stopped: ${this.lineUpWhy}` : 'not tidying';
  }

  /** Called on her friend when someone has just left a quad crooked on purpose: she'll see it in a few seconds and go and put it right. */
  noticeCrooked() {
    if (this.params.lineUpCrookedChance > 0 || !this.params.boredLineUpChance) return;
    this.crookedNotice = 5 + Math.random() * 5;
  }

  /** The nudge in progress, and noticing something crooked. */
  updateLineUp(dt) {
    const lp = this.lineUpParams ?? DEFAULT_LINEUP_PARAMS;
    if (this.crookedNotice > 0 && this.fsm.is('idle') && (this.crookedNotice -= dt) <= 0) {
      this.crookedNotice = 0;
      const job = this.planLineUp(0);
      if (job) {
        this.selfEvents.push('lineUpNotice');
        this.startLineUp(job);
        this.lineUpOn = false; // just the one she was cross about
      }
    }
    const n = this.nudge;
    if (!n) return;
    n.t += dt / lp.shoveSeconds;
    const pose = nudgePose(n.from, n.to, Math.min(1, n.t));
    n.quad.placeAt(pose.x, pose.z, pose.yaw);
    if (n.t >= 1 || n.quad.rider) {
      this.nudge = null;
      this.continueLineUp();
    }
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

  /** Her next go at the ramp in the field (jumps.js): { ramp, p }, or null if there isn't one or its run-up and landing are blocked. */
  /** Where you are and which way your eyes point, for her showing off to you: { x, z, fx, fz }. */
  showOffYou() {
    const v = this.viewer;
    if (!v) return { x: this.root.position.x, z: this.root.position.z, fx: 0, fz: 0 };
    return { x: v.position.x, z: v.position.z, fx: v.forward?.x ?? 0, fz: v.forward?.z ?? 0 };
  }

  jumpPlan() {
    const ramp = this.world.layout.jumpRamp;
    if (!ramp) return null;
    const jp = this.jumpParams ?? DEFAULT_JUMP_PARAMS;
    // Nothing standing on the line (a quad, you, the other girl) from the run-up to the end of the landing.
    const clear = this.jumpClear?.(ramp, jp) ?? true;
    return clear ? { ramp, p: jp } : null;
  }

  /** Walks to a point and stands there, facing `facing`, dropping whatever else she was up to. */
  walkTo(point, facing) {
    this.warmingAt = null;
    this.waving = null;
    this.throwing = null;
    this.recallTarget = point;
    this.fsm.transition('walking', { goal: 'stand', target: () => ({ position: point, facing }) });
  }

  /** Walks back to stand `gap` metres from you, wherever you have got to by then, facing you. */
  walkToYou(you, gap = 1.8) {
    this.warmingAt = null;
    this.waving = null;
    this.throwing = null;
    this.fsm.transition('walking', {
      goal: 'stand',
      target: () => {
        const r = this.root.position;
        const d = Math.hypot(you.x - r.x, you.z - r.z) || 1;
        const x = you.x - ((you.x - r.x) / d) * gap;
        const z = you.z - ((you.z - r.z) / d) * gap;
        return { position: new THREE.Vector3(x, this.world.heightAt(x, z), z), facing: Math.atan2(you.x - r.x, you.z - r.z) };
      },
    });
  }

  /** You asked her to come here: off whatever she's driving or sat on first, then over to you. */
  requestComeHere(you) {
    this.getDownThen(() => this.walkToYou(you));
  }

  /** You asked her to stop where she is (she was on her way somewhere): she stands there. */
  requestStop() {
    this.warmingAt = null;
    this.waving = null;
    this.throwing = null;
    this.fsm.transition('idle');
  }

  /** Goes over to stand with her friend at talking distance, facing her (pair.js), wherever her friend has got to by then. */
  standWith(friend, p) {
    this.warmingAt = null;
    this.waving = null;
    this.throwing = null;
    const target = () => {
      const f = friend.root.position;
      const at = standBy(this.root.position, f, p);
      return { position: new THREE.Vector3(at.x, this.world.heightAt(at.x, at.z), at.z), facing: at.facing };
    };
    this.fsm.transition('walking', { goal: 'stand', target });
  }

  /**
   * Tags along with her friend on foot (pair.js): a step behind and to `side` while her friend walks, then stood by her facing her
   * once she gets there (or after `p.tagFor` seconds, whatever her friend is doing).
   */
  tagAlong(friend, side, p) {
    this.warmingAt = null;
    this.waving = null;
    this.throwing = null;
    const going = () => friend.fsm.is('walking') && this.fsm.time < p.tagFor;
    const target = () => {
      const f = friend.root.position;
      const at = going() ? tagPoint({ x: f.x, z: f.z, heading: friend.heading }, side, p) : standBy(this.root.position, f, p);
      return { position: new THREE.Vector3(at.x, this.world.heightAt(at.x, at.z), at.z), facing: Math.atan2(f.x - at.x, f.z - at.z) };
    };
    this.fsm.transition('walking', { goal: 'follow', friend, going, target });
  }

  /**
   * Stop whatever she's doing and go to a point (called back to the barn). Driving she pulls up and gets off first; sat
   * on a quad or on the bales she gets down first. Safe to call again every so often until she's there: where she is
   * mid-change (sliding between seats, getting off) it takes effect when that's done.
   */
  recall(point, facing) {
    this.interrupt(); // on her way to something of her own, she says so
    const s = this.fsm;
    const go = () => this.walkTo(point, facing);
    if (s.is('walking') && s.data?.goal === 'stand' && this.recallTarget === point) return;
    this.getDownThen(go);
  }

  /** A last guard (recallPlan.js): stood or walking about but still parented to a vehicle's seat, she'd float for the rest of the game, so put her on the ground where she is. */
  dropIfStranded() {
    if (!strandedOnVehicle(this.fsm.name, this.root.parent === this.scene)) return;
    console.warn(`${this.character.id} was left on a vehicle's seat while ${this.fsm.name}: dropped to the ground`);
    attachKeepingSize(this.scene, this.root);
    const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ');
    this.heading = e.y;
    this.root.rotation.set(0, e.y, 0);
    this.root.position.y = this.world.heightAt(this.root.position.x, this.root.position.z);
    this.rig.legSpread = 0;
    this.sittingPose = null;
    this.movingSeatPose = null;
    this.freeTrailerSlot();
    this.setColliderEnabled(true);
  }

  /**
   * Whatever she's on or doing, gets her to her feet on the ground and then does `go` (recallPlan.js): off the quad or the cab seat or the
   * trailer first, never walking from a seat, which would leave her floating over the ground still parented to the vehicle. Safe to call again
   * every so often: where she is mid-change it takes effect when that's done.
   */
  getDownThen(go) {
    const s = this.fsm;
    switch (recallPlan(s.name, s.data?.goal)) {
      case 'stopDriving':
        if (!this.stopDriving('off', go)) go();
        break;
      case 'dismount':
        this.afterDismount = go;
        s.transition('dismounting');
        break;
      case 'afterDismount':
        this.afterDismount = go;
        break;
      case 'leaveRest':
        this.leaveRest(go);
        break;
      case 'climbDown':
        this.afterClimb = go;
        this.leaveTrailer();
        break;
      case 'afterBoarding':
        this.afterClimb = go;
        this.leaveWhenUp = true;
        break;
      case 'abortBoarding':
        this.abortBoarding();
        go();
        break;
      case 'wait':
        break;
      default:
        go();
    }
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

  /** Walks to `spot` ({ x, z }) with something in her hand and calls `arrive()` when she's there (to put it down). Only when she's stood about or pranking. */
  carryTo(spot, arrive) {
    if (!this.fsm.is('idle', 'pranking')) return false;
    const target = new THREE.Vector3(spot.x, this.world.heightAt(spot.x, spot.z), spot.z);
    const facing = Math.atan2(spot.x - this.root.position.x, spot.z - this.root.position.z);
    this.fsm.transition('walking', { goal: 'carry', target: () => ({ position: target, facing }), arrive });
    return true;
  }

  /** `target` moved inside the hedges of the field she is in, and onto the ground. */
  keepToField(target) {
    const here = this.root.position;
    const fields = this.world.fields;
    const area = fields?.areaOf(here.x, here.z);
    if (fields && area !== 'out') {
      const c = fields.clampToArea(area, target.x, target.z, area === 'road' || area === 'end' ? 1.5 : 6);
      target.x = c.x;
      target.z = c.z;
    } else {
      const limit = this.world.layout.fieldHalf - 6;
      target.x = Math.max(-limit, Math.min(limit, target.x));
      target.z = Math.max(-limit, Math.min(limit, target.z));
    }
    target.y = this.world.heightAt(target.x, target.z);
    return target;
  }

  /** A stroll to somewhere nearby on the farm, staying inside the hedges of the field she's in. */
  wander() {
    const p = this.params;
    const here = this.root.position;
    const angle = Math.random() * Math.PI * 2;
    const dist = this.randomBetween(p.wanderMin, p.wanderMax) * (Math.random() < p.wanderFarChance ? 2.5 : 1);
    const target = this.keepToField(new THREE.Vector3(here.x + Math.sin(angle) * dist, 0, here.z + Math.cos(angle) * dist));
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
  /**
   * Put on the back by you and left there: her patience runs out and she gets off (a reaction, on her own clock). Sat there by her own
   * choice, getting off when she's bored of it is a choice like any other: an offer (seatOffers) weighed by the chooser.
   */
  boredOnTheBack(dt) {
    const p = this.params;
    const q = this.quad;
    if (this.seatedByChoice || q.rider || q.driver || q.passenger || !p.ownMind) {
      this.backBoredIn = null;
      return;
    }
    this.backBoredIn ??= this.randomBetween(p.placedPatienceMin, p.placedPatienceMax);
    this.backBoredIn -= dt;
    if (this.backBoredIn > 0) return;
    this.backBoredIn = null;
    this.selfEvents.push('getOffWaited');
    this.requestStandBeside(q);
  }

  /** Sat on a parked quad by her own choice, with nobody at the front or on it with her: as good as stood about, for wanting something to do. */
  sittingAbout() {
    const q = this.quad;
    return this.fsm.is('seated') && !!this.seatedByChoice && !q.rider && !q.driver && !q.passenger;
  }

  /** What she could choose to do from the seat she's sat about on (chooser.js): get off, as keen as her boredGetOffWeight says. */
  seatOffers() {
    if (!this.sittingAbout()) return [];
    const q = this.quad;
    return [{ key: 'getOff', girl: this.character?.id, weight: this.params.boredGetOffWeight, take: () => {
      this.selfEvents.push('getOff');
      this.requestStandBeside(q);
    } }];
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
   * Side-saddle on the back: she eases round to sit that way, and holds on less well than astride, so a hard corner or a big
   * bump can have her slide (sideSaddle.js): a yelp first, and then she's off, left where she landed.
   */
  watchSideSaddle(dt) {
    const p = this.params;
    if (this.seatKind !== 'pillion' || !this.sideSaddle) return;
    if (this.sideOnPending) this.selfEvents.push('sideOn');
    this.sideOnPending = false;
    this.sideBlend = Math.min(1, this.sideBlend + dt / 0.6);
    this.root.rotation.y = this.sideAngle;
    const q = this.quad;
    const a = this.pillion.dynamics.accel;
    const event = this.sideSlip.update(dt, { speed: q.speed, lateral: a.left, up: a.up, side: this.sideSaddle, holding: !!q.rider }, p);
    if (event === 'wobble') this.selfEvents.push('sideWobble');
    else if (event === 'off') {
      this.selfEvents.push('sideSlip');
      this.slipping = true;
      this.fsm.transition('dismounting');
    }
  }

  /** Where she ends up on the ground when she slides off: beside the quad on the side her legs hang, where it was. */
  slipSpot() {
    const p = this.quad.localToWorld(this.sideSaddle * 1.1, 0, -0.4);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: this.startHeading };
  }

  /**
   * Sat on the back of a quad left running with nobody driving it, now and then
   * (rarely) she leans forward after a while and switches it off.
   */
  mindTheEngine(dt) {
    if (this.holdIdle(dt)) {
      this.keyOffIn = null;
      return;
    }
    const q = this.quad;
    const idling = q.engine.isRunning && !q.rider && !q.driver && !q.isGhostRiding && q.speed < 0.3;
    if (!idling) {
      this.keyOffIn = null;
      return;
    }
    // Decided once each time she's left sitting there.
    this.keyOffIn ??= Math.random() < this.params.keyOffChance * this.content.keyOffFactor(this.params) ? this.randomBetween(this.params.keyOffAfterMin, this.params.keyOffAfterMax) : Infinity;
    this.keyOffIn -= dt;
    if (this.keyOffIn <= 0) {
      this.keyOffIn = null;
      q.engine.setIgnition(false);
      this.selfEvents.push('keyOff');
    }
  }

  /** Goes and sits on the back of a rough quad for the shake: started first if it is off. */
  requestBuzzSit(q) {
    if (q.engine.isRunning) this.requestMount(q, { ownChoice: true });
    else this.requestStart(q, { then: (ran) => (ran ? this.requestMount(q, { ownChoice: true }) : null) });
  }

  /** Walks to the bars of a quad and has a go at starting it. */
  requestStart(quad, { then = null, settleAt = null } = {}) {
    if (this.stopDriving('off', () => this.requestStart(quad, { then, settleAt }))) return;
    if (this.fsm.is('seated', 'mounting')) {
      this.afterDismount = () => this.requestStart(quad, { then, settleAt });
      this.fsm.transition('dismounting');
      return;
    }
    this.quad = quad;
    if (this.needsHandle(quad)) {
      // The Land Rover on a flat battery: the handle, and she is done once it is running.
      this.afterCrank = () => then?.(true);
      this.fsm.transition('walking', { goal: 'crank', target: () => this.crankPoint(quad) });
      return;
    }
    this.startSettleAt = settleAt; // temperature (0..1) at which she stops minding the choke and leaves it, or null to wait until it's fully warm
    this.afterStart = then; // called with whether it's running when she's done (not if something else interrupts her first)
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
    if (quad.driverStand && (!this.fsm?.is('dismounting') || this.dismountingFrom === 'rider')) return this.driverDoor(quad);
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

  /** The driver's door of the UTV or Land Rover, on the right: where she steps in from and down to, facing the cab. Side is always -1. */
  driverDoor(quad = this.quad) {
    const d = quad.driverStand;
    const p = quad.model.localToWorld(new THREE.Vector3(d.x, 0, d.z));
    p.y = this.world.heightAt(p.x, p.z);
    const c = quad.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z), side: -1 };
  }

  /** Where she climbs on from: beside the footboard, in front of the back wheel, for the back; beside the front for the rack. */
  mountPoint() {
    const side = this.nearSide();
    const p = this.quad.localToWorld(side * 0.85, 0, this.seatKind === 'rack' ? 0.75 : 0);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: this.quad.yaw, side };
  }

  /** Beside the handlebars on her nearer side, facing them, within reach of the key and starter. */
  startPoint(quad = this.quad) {
    if (quad.driverStand) return this.driverDoor(quad); // reaching in for the key
    const side = this.root.parent === this.scene ? this.nearSide(quad) : 1;
    const p = quad.localToWorld(side * 0.8, 0, 0.3);
    p.y = this.world.heightAt(p.x, p.z);
    const bars = quad.localToWorld(0, 0, 0.35);
    return { position: p, facing: Math.atan2(bars.x - p.x, bars.z - p.z), side };
  }

  /** Where she steps down to off a seat she was astride: by the footboard, clear of the wheels, facing the quad. */
  stepOffPoint(side, front) {
    const p = this.quad.localToWorld(side * 0.9, 0, front ? 0.1 : 0);
    p.y = this.world.heightAt(p.x, p.z);
    const c = this.quad.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
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
    if (front && this.quad?.driverStand) return this.haySeatOffset(); // sat on a bench, as the girls in the UTV and Land Rover are
    if (front) return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.driveSeatRaise, -this.sitHips.z + p.driveSeatForward);
    // Turned to one side, her hips swing round with her, so she's put back on the seat by the same amount.
    return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.seatRaise, -this.sitHips.z + p.seatForward).applyAxisAngle(AXIS_Y, this.sideAngle);
  }

  /** How far she's turned about the vertical to sit side-saddle, in radians (positive towards her left). */
  get sideAngle() {
    return this.seatKind === 'pillion' ? this.sideSaddle * this.sideBlend * this.params.sideSaddleTurn : 0;
  }

  /** The legs' spread for the back seat she's in: astride the pillion, nearly together on the front rack. */
  seatSpread() {
    if (this.seatKind === 'pillion' && this.sideSaddle) return 0; // both legs over one side
    return this.params.legSpread * (this.seatKind === 'rack' ? this.params.rackLegSpread : 1);
  }

  // Movement ------------------------------------------------------------------

  /** Walks toward `target`; returns true on arrival. */
  walkToward(dt, target) {
    const p = this.params;
    const pos = this.root.position;
    const final = Math.hypot(target.x - pos.x, target.z - pos.z);
    if (final < p.arriveRadius) return true;
    // In another field, she heads for the gateways on the way (world/fields.js) rather than straight at a hedge.
    let via = this.world.nextWaypoint?.(pos, target) ?? target;
    // A building in the way (the barn, mostly): aimed at its corner, or its doorway, rather than at the wall.
    const round = this.world.detour?.(pos, via, this.detourCorner);
    this.detourCorner = round;
    if (round) via = round;
    const to = this.tmpV.set(via.x - pos.x, 0, via.z - pos.z);
    const leg = to.length(); // to the gateway, or the end if there's none on the way
    const dist = final;
    to.normalize();

    let desired = Math.atan2(to.x, to.z);
    this.avoidTimer -= dt;
    this.holdTimer -= dt;
    if (this.stuckTimer < 5) {
      const look = Math.min(p.probeDistance, leg - 0.1);
      const straight = this.blocked(desired, look);
      if (this.holdTimer > 0 && this.holdAngle !== null && this.angleClear(desired, this.holdAngle, p.probeDistance)) {
        // Still going round: keep the heading she chose, even once the straight line looks clear, or she turns back in and clips the corner.
        desired = this.holdAngle;
      } else {
        this.holdAngle = null;
        if (straight) {
          // Try angles either side, keeping to one side for a while so she doesn't dither.
          const offsets = [0.4, 0.8, 1.2, 1.6, 2.0, 2.5];
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
          if (found !== null) {
            desired = found;
            this.holdAngle = found;
            this.holdTimer = p.avoidHold;
          }
        }
      }
    }

    this.heading += angleTo(this.heading, desired) * Math.min(1, p.turnRate * dt);
    // Slow down when turning sharply and near the end.
    const turnFactor = Math.max(0.2, Math.cos(angleTo(this.heading, desired)));
    // A way to go and she jogs (not when sneaking up on someone or wandering about, which the walking state says).
    this.jogging = this.mayJog && jogging(this.jogging, dist, this.homeParams ?? DEFAULT_HOME_PARAMS);
    const jog = this.jogging ? (this.homeParams ?? DEFAULT_HOME_PARAMS).jogBoost : 1;
    const speed = p.walkSpeed * this.paceBoost * this.paceMul * this.carryPace * jog * turnFactor * Math.min(1, dist / 0.6 + 0.3);
    pos.x += Math.sin(this.heading) * speed * dt;
    pos.z += Math.cos(this.heading) * speed * dt;
    pos.y = this.world.heightAt(pos.x, pos.z);
    this.root.rotation.y = this.heading;
    this.rig.setTimeScale(Math.min(speed / p.walkAnimSpeed, this.jogging ? (this.homeParams ?? DEFAULT_HOME_PARAMS).jogAnimMax : Infinity));

    // Track progress so she can push through if she gets wedged.
    if (pos.distanceTo(this.lastPos) < 0.3 * dt) this.stuckTimer += dt;
    else this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    this.lastPos.copy(pos);
    return false;
  }

  /** Whether the way held at `angle` is still clear at the hold's reach, from the heading she wanted. */
  angleClear(desired, angle, distance) {
    return Math.abs(angleTo(desired, angle)) < 2.6 && !this.blocked(angle, distance);
  }

  /** Whether something is in the way along `angle`: down her middle and, with room to look, past each shoulder, so she clears a corner. */
  blocked(angle, distance) {
    if (distance <= 0.05) return false;
    const pos = this.root.position;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const terrain = this.world.terrain.collider.handle;
    const own = this.collider.handle;
    const offsets = distance > 1 ? [0, -this.params.probeWidth, this.params.probeWidth] : [0];
    for (const off of offsets) {
      const ray = new this.RAPIER.Ray({ x: pos.x + dz * off, y: pos.y + 0.5, z: pos.z - dx * off }, { x: dx, y: 0, z: dz });
      const hit = this.physics.castRay(ray, distance, true, undefined, undefined, undefined, undefined, (c) => {
        return c.handle !== terrain && c.handle !== own;
      });
      if (hit) return true;
    }
    return false;
  }

  /**
   * Whether she's free to be given something to do, and if not what has her (availability.js): { free, why, settled, held }. Every
   * feature asks this rather than checking her state and flags. `asked`: you're asking her (the wheel, the debug panel); `mine`: the
   * asking feature's own job (a JOBS flag or hold key), which doesn't count against her.
   */
  availability({ asked = false, mine = null, pull = false } = {}) {
    const jobs = {};
    for (const [flag] of JOBS) jobs[flag] = this[flag];
    const restingSat = this.fsm.is('resting') && this.restPhase === 'sat';
    return availabilityOf({ state: this.fsm.name, restingSat, jobs, holds: [...this.holds], held: this.worldHold?.() ?? null }, { asked, mine, pull });
  }

  /**
   * Not free, but only doing something idle that something urgent (the rain) can take her from: sat resting, or one of the soft jobs
   * (warming her hands, tidying, walking off a numb bum). The chooser offers her only urgent things then (chooser.js).
   */
  interruptible() {
    const a = this.availability();
    if (a.free) return false;
    return (this.fsm.is('resting') && this.restPhase === 'sat') || (this.fsm.is('idle') && this.availability({ asked: true }).free && !a.held);
  }

  /**
   * Something else has her now (you asked through the wheel, the bell): if she was on her way to something she'd chosen she says so,
   * and it stays on her mind (intent.js). Returns what she was on her way to, or null.
   */
  interrupt() {
    const key = this.intent.interrupt(this.params);
    if (key) this.voice?.say('interrupted', { urgent: true, chance: 0.85 });
    return key;
  }

  /** You've asked her something: in a low mood she's short about it (mood.js). */
  answerAsked() {
    if (this.mood.state === 'low') this.voice?.say('moodCurt', { urgent: true, chance: this.params.moodCurtChance });
  }

  /** A feature has her for a while (`why` says what for, for the debug panel): she isn't free until it lets her go. */
  hold(key, why) {
    this.holds.set(key, why);
  }

  release(key) {
    this.holds.delete(key);
  }

  /** Stood about with nothing holding her in place (her hands over an engine, a wave, a start), so she may turn to look at something. */
  freeToTurn() {
    return this.fsm.is('idle') && !this.warmingAt && !this.waving && !this.throwing && !this.recoil && !this.attempt && !this.benchAt && !this.callSpot && !this.waitPinned();
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
    this.viewer = viewer; // who's watching, for showing off to (showOffYou)
    this.fsm.update(dt);
    this.dropIfStranded();
    this.updateNumbPlan(dt);
    this.updateRecoil(dt);
    this.updateTipCall(dt);
    this.updateReaction(dt);
    this.updateBoredom(dt);
    this.updateLineUp(dt);
    if (viewer) this.updateAttention(dt, viewer);
    this.updateFidget(dt);
    this.updateCarry(dt);
    this.updateWaiting(dt);
    this.updatePose(dt);
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
// (hayRideMethods has a getter too.)
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(hayRideMethods));
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(warmingMethods));
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(keepAliveMethods));
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(numbMethods));
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(carryingMethods));
Object.assign(Companion.prototype, wavingMethods);
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(strandedMethods));
Object.assign(Companion.prototype, throwingMethods);
Object.assign(Companion.prototype, waitingMethods);
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(moveMethods));
// (restingMethods has getters, so copy its descriptors rather than assigning.)
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(restingMethods));
Object.defineProperties(Companion.prototype, Object.getOwnPropertyDescriptors(reactingMethods));

// Idle behaviour -------------------------------------------------------------

/** Jumps back from something (a boil-over): a quick hop away from `from`, arms up. */
Companion.prototype.jumpBack = function (from) {
  const here = this.root.position;
  const dx = here.x - from.x;
  const dz = here.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  this.recoil = { vx: (dx / d) * this.params.recoilSpeed, vz: (dz / d) * this.params.recoilSpeed, t: 0, k: 1 };
};

Companion.prototype.updateRecoil = function (dt) {
  const r = this.recoil;
  if (!r) return;
  r.t += dt;
  const left = Math.max(0, 1 - r.t / this.params.recoilSeconds);
  r.k = left;
  if (this.fsm.is('idle', 'resting', 'walking')) {
    this.root.position.x += r.vx * left * dt;
    this.root.position.z += r.vz * left * dt;
  }
  if (left <= 0) this.recoil = null;
};

/** Tells her something happened (a notice for attention.js: { kind, key, x, y, z, strength }); game.notice calls this. */
Companion.prototype.notice = function (n) {
  this.attention.notice(n);
  this.reactToNotice(n); // and it may make her move (reactions.js)
  this.wakeToNotice(n); // or wake her, if she's dozing (dozing.js)
};

/**
 * For a sub-activity inside a state (warming her hands, carrying something, waving): look at `point` while doing it, as strongly as
 * `weight` (1 is like a state's focus), for `seconds`. Call it each frame to keep it, or once to hold it a while.
 */
Companion.prototype.attend = function (point, { weight = 1, seconds = 0.2 } = {}) {
  this.attendHint = { x: point.x, y: point.y, z: point.z, weight, left: seconds };
};

/** What her state says she looks at: a focus { x, y, z, weight, intent? }, 'own' (another poser has her head) or null. */
Companion.prototype.stateLook = function () {
  const def = this.fsm.current.look;
  const look = typeof def === 'function' ? def.call(this, this.fsm.data) : def;
  return look === 'free' ? null : look ?? null;
};

/** A point on a vehicle (`up` metres above its middle) to look at, as a focus. */
Companion.prototype.lookAtVehicle = function (q, up = 0.8, weight = 1) {
  return q ? { x: q.position.x, y: q.position.y + up, z: q.position.z, weight } : null;
};

/** The ground `metres` ahead of a vehicle, for watching where it's going, as a focus. */
Companion.prototype.lookAhead = function (q, metres, weight = 1) {
  if (!q) return null;
  const yaw = q.yaw;
  return { x: q.position.x + Math.sin(yaw) * metres, y: q.position.y, z: q.position.z + Math.cos(yaw) * metres, weight };
};

/** Each frame: what she looks at (attention.js), from the game's view of who and what is about (viewer.world), and her head following. */
Companion.prototype.updateAttention = function (dt, viewer) {
  const p = this.params;
  const rig = this.rig;
  const look = this.stateLook();
  const own = look === 'own';
  const dozy = this.dozeK > 0.2; // nodding off or asleep: her head is hers, not attention's
  const at = this.root.getWorldPosition(this.tmpV);
  const dir = this.root.getWorldDirection(_dirV);
  const self = { x: at.x, y: at.y + p.height * 0.93, z: at.z };
  const id = this.character?.id;
  const world = viewer.world ?? { people: [], vehicles: [] };
  const fond = Math.max(-0.6, Math.min(1, this.favourView?.().standing ?? 0));
  const people = world.people.filter((o) => o.key !== id).map((o) => (o.key === 'you' ? { ...o, talkingToMe: !!viewer.talking, warmth: fond } : o));
  const onIt = this.root.parent !== this.scene ? this.quad?.unit?.id : null;
  const vehicles = world.vehicles.filter((v) => v.key !== onIt);
  // A sub-activity's own focus takes over from the state's while it lasts.
  const hint = this.attendHint;
  if (hint && (hint.left -= dt) <= 0) this.attendHint = null;
  const focus = hint ?? (own || !look || look.intent ? null : look);
  const intent = !own && look?.intent ? look : null;
  // What she can hear of the world beyond: the rain, the barn roof, an engine going beside her (attention's hearingFactor).
  const hearing = hearingFactor(
    { rain: world.rain, indoors: !!this.world.inBarn?.(at.x, at.z), engines: (world.engines ?? []).map((e) => Math.hypot(e.x - at.x, e.z - at.z)) },
    this.attention.noticeParams,
  );
  this.hearingK = hearing;
  const pick = this.attention.update(dt, { self, facing: Math.atan2(dir.x, dir.z), people, vehicles, focus, intent, noGaze: own, hearing });
  this.lookPick = pick;
  this.lookTurn = !own && pick ? pick.turnTo : null;
  // On the back behind you the pillion pose has her head, and turns it to whatever catches her eye.
  this.pillion.attend = own ? pick : null;
  if (own || !pick || dozy) {
    rig.lookWeight += (0 - rig.lookWeight) * Math.min(1, p.lookSpeed * dt);
    return;
  }
  // Her eyes sweep to the next thing rather than jumping there.
  if (!this.lookPoint) this.lookPoint = new THREE.Vector3(pick.x, pick.y, pick.z);
  else this.lookPoint.lerp(_pickV.set(pick.x, pick.y, pick.z), Math.min(1, p.lookSweep * dt));
  rig.lookTarget.copy(this.lookPoint);
  rig.lookWeight += (1 - rig.lookWeight) * Math.min(1, p.lookSpeed * dt);
};

const _dirV = new THREE.Vector3();
const _pickV = new THREE.Vector3();

// Small movements, each with a shape over its life (0..1) and offsets to apply.
const FIDGETS = {
  // Lifts one arm out and bends the elbow, as if adjusting her grip or hair.
  arm: (k, side) => (side > 0 ? { leftArmOut: 0.55 * k, leftElbow: 0.9 * k } : { rightArmOut: 0.55 * k, rightElbow: 0.9 * k }),
  // Shifts her weight to one side.
  lean: (k, side) => ({ spineRoll: 0.24 * k * side, headYaw: -0.2 * k * side }),
  // Stretches back with both arms out a little.
  stretch: (k) => ({ spinePitch: -0.18 * k, leftArmOut: 0.35 * k, rightArmOut: 0.35 * k, leftElbow: 0.3 * k, rightElbow: 0.3 * k }),
};
// (Looking about is attention.js's gazing, not a fidget.)
const SEATED_FIDGETS = ['arm', 'lean', 'stretch', 'arm'];
const STANDING_FIDGETS = ['lean'];

Companion.prototype.updateFidget = function (dt) {
  const p = this.params;
  const offsets = this.rig.offsets;
  for (const key in offsets) offsets[key] = 0;
  // Nodding off or asleep (dozing.js): her head droops and she doesn't fidget.
  this.dozeK += ((this.isDozing ? 1 : 0) - this.dozeK) * Math.min(1, dt * (this.isDozing ? 1.5 : 4));
  if (this.dozeK > 0.01) {
    const d = dozePose(this.dozeT, this.dozeK, this.dozeParams.dozeDropSeconds);
    offsets.headDown = d.headDown;
    offsets.spinePitch = d.spinePitch;
    return;
  }
  if (this.recoil) Object.assign(offsets, { leftArmOut: 0.8 * this.recoil.k, rightArmOut: 0.8 * this.recoil.k, leftElbow: 0.6 * this.recoil.k, rightElbow: 0.6 * this.recoil.k, spinePitch: -0.25 * this.recoil.k });

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

// State definitions. `this` is the Companion. Every state says what she looks at while in it (`look`, attention.js): 'free'
// (nothing in particular, so whatever catches her eye), 'own' (another poser has her head), or a function of the state's data
// returning a focus ({ x, y, z, weight }, or with intent: true for where she's about to go). tests/girlsMinds.test.js fails until
// a new state has one.
export const STATES = {
  ...drivingStates,
  ...hayRideStates,
  ...thrownStates,
  ...restingStates,

  idle: {
    look: 'free', // a sub-activity (warming her hands) says what it looks at with attend()
    enter() {
      this.rig.play('Idle');
    },
    update(dt, data) {
      // Turning away from smoke (reactions.js); something held over her shoulder a while, she turns to face it (attention.js); either
      // way she turns back to what she was facing after.
      if (this.reactTurn !== null && !this.warmingAt && !this.attempt) this.turnToward(dt, this.reactTurn);
      else if (this.throwing) this.turnToward(dt, this.throwing.facing); // to where she's throwing
      else if (this.waitTurn != null) this.turnToward(dt, this.waitTurn); // to the tyre she's kicking or the seat she's wiping
      else if (this.lookTurn !== null && this.freeToTurn()) this.turnToward(dt, this.lookTurn);
      else if (this.pairFacing != null && this.freeToTurn()) {
        // Stood with her friend: facing her, opened up to you when you come over (pair.js). She keeps facing that way after.
        data.facing = this.pairFacing;
        this.turnToward(dt, data.facing);
      } else if (data.facing !== undefined) this.turnToward(dt, data.facing);
    },
    exit() {
      this.warmingAt = null; // whatever she does next, the hands come down
    },
  },

  walking: {
    // Where she's going: first as her intent, looked at before she sets off from standing, then as what she watches as she goes.
    look(data) {
      const t = data.target?.()?.position;
      if (!t) return null;
      return this.lookLeadLeft > 0 ? { x: t.x, y: t.y + 0.9, z: t.z, intent: true } : { x: t.x, y: t.y + 0.9, z: t.z, weight: 0.8 };
    },
    enter(data) {
      this.stuckTimer = 0;
      this.jogging = false;
      // From standing about she looks where she's going before she sets off, unless it's a hurry (attention.js).
      this.lookLeadLeft = this.fsm.previous === 'idle' || this.fsm.previous === 'resting' ? (data.hurry ? 0 : this.params.lookLead) : 0;
      if (this.lookLeadLeft <= 0) this.rig.play('Walking', { fade: 0.25 });
    },
    exit() {
      this.mayJog = false;
      this.jogging = false;
      this.pace = null; // the walk's over; the next one has its own
      this.paceMul = 1;
    },
    update(dt, data) {
      // How she walks: the pace of what she chose, the rain, how tired or keyed up she is (intent.js).
      const pace = walkPace(this.pace, { wet: this.wetNow, tired: this.needs.rest, excited: this.needs.excitement, mood: this.mood.pace(this.params) }, this.params);
      this.paceMul = pace.mul;
      this.mayJog = pace.jog === 'auto' ? data.goal !== 'prank' && data.goal !== 'wander' : pace.jog === 'yes';
      if (this.lookLeadLeft > 0) {
        if ((this.lookLeadLeft -= dt) > 0) return;
        this.rig.play('Walking', { fade: 0.25 });
      }
      const t = data.target();
      // Hold back near a moving quad until it stops.
      if ((data.goal === 'mount' || data.goal === 'drive') && this.quad.speed > this.params.maxMountSpeed) {
        if (t.position.distanceTo(this.root.position) < 1.2) {
          this.rig.setTimeScale(0);
          return;
        }
      }
      // Wait for the trailer to slow down before climbing on, as she does for a quad.
      if (data.goal === 'board' && this.trailer.motion.speed > 1.2 && t.position.distanceTo(this.root.position) < 1.2) {
        this.rig.setTimeScale(0);
        return;
      }
      // Tagging along, she waits a step behind until her friend gets there.
      if (data.goal === 'follow' && data.going() && t.position.distanceTo(this.root.position) < this.params.arriveRadius) {
        this.rig.setTimeScale(0);
        return;
      }
      if (this.walkToward(dt, t.position)) {
        if (data.goal === 'board') this.fsm.transition('boarding');
        else if (data.goal === 'mount') this.fsm.transition('mounting', { side: t.side });
        // If you've beaten her to the front seat, she gets on the back.
        else if (data.goal === 'drive') this.fsm.transition('mounting', { side: t.side, seat: this.quad.rider ? 'pillion' : 'rider' });
        else if (data.goal === 'start') this.fsm.transition('starting', { facing: t.facing, side: t.side });
        else if (data.goal === 'crank') this.fsm.transition('cranking', { facing: t.facing });
        else if (data.goal === 'push') this.fsm.transition('pushing');
        else if (data.goal === 'carry') {
          this.fsm.transition('idle', { facing: t.facing });
          data.arrive();
        } else if (data.goal === 'prank') this.fsm.transition('pranking', { facing: t.facing, act: data.act, stay: data.stay, out: data.out });
        else if (data.goal === 'rest') this.fsm.transition('resting', { spot: data.spot, stay: data.stay, doze: data.doze });
        else if (data.goal === 'warm') {
          this.fsm.transition('idle', { facing: t.facing });
          this.startWarming(data.quad, data.side);
        } else this.fsm.transition('idle', { facing: t.facing });
      }
    },
  },

  // Up to no good: a quiet moment at the thing she's meddling with, then done.
  pranking: {
    look(data) {
      // Down at whatever she's meddling with, in front of her.
      const r = this.root.position;
      return { x: r.x + Math.sin(data.facing) * 1.2, y: r.y + 0.5, z: r.z + Math.cos(data.facing) * 1.2, weight: 2 };
    },
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
    look() {
      return this.lookAtVehicle(this.quad, 0.9, 2);
    },
    enter(data) {
      this.rig.play('Idle', { fade: 0.3 });
      // The diesels (the tractor, the UTV) have a key and glow plugs rather than a tap and a choke.
      if (this.quad.tractor || this.quad.engine.params?.compressionIgnition) this.attempt = new TractorStartAttempt(this.quad, { params: this.tractorStartParams ?? DEFAULT_TRACTOR_START_PARAMS });
      else this.attempt = new StartingAttempt(this.quad, { params: { ...DEFAULT_STARTING_PARAMS, pullWhenFlat: this.params.startPullWhenFlat, settleAt: this.startSettleAt } });
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
        this.quad.startTrouble = a.result === 'running' ? (a.bursts ?? 0) + (a.pulls ?? 0) : 0; // how many goes it took, for keepAlive.js
        if (a.result === 'running' && !this.quad.rider) this.startEvents.push('warmedUp');
        const then = this.afterStart;
        const ran = this.quad.engine.isRunning;
        this.afterStart = null;
        this.fsm.transition('idle', { facing: data.facing });
        then?.(ran);
      }
    },
    exit() {
      this.quad.helperStarter = false;
      this.afterStart = null;
      this.attempt = null;
    },
  },

  // Getting on: astride with a leg over, or sat back onto the seat side-saddle or on the rack (companionMoves.js).
  mounting: {
    look() {
      return this.lookAtVehicle(this.quad, 0.7, 2);
    },
    enter(data) {
      this.setColliderEnabled(false);
      const front = data.seat === 'rider';
      const side = data.side ?? this.nearSide();
      // Side-saddle, her legs go over the side she got on from.
      if (!front && this.seatKind === 'pillion' && this.sideSaddle) {
        this.sideSaddle = side;
        this.sideBlend = 1;
        this.sideOnPending = true;
      }
      const kind = this.quadMoveKind(front);
      this.movingSeatPose = this.seatPoseName(front);
      this.beginMove({
        kind, side, dir: 1, duration: front && this.quad.driverStand ? this.hay.stepSeconds : this.params.mountDuration, seat: this.seatAnchor(front),
        seatEnd: () => this.quadSeatEnd(front), standEnd: () => this.standPoint(side),
        twistTo: kind === 'hopOn' ? this.quad.yaw + (side * Math.PI) / 2 : undefined,
      });
      data.front = front;
      data.side = side;
    },
    update(dt, data) {
      const done = this.stepMove(dt);
      const f = this.moveFrame;
      const spread = data.front ? (this.quad.driverStand ? 0 : this.params.legSpread) : this.seatSpread();
      this.rig.legSpread = spread * (this.moving.kind === 'legOver' ? f.spread : f.sit);
      if (done) {
        data.done = true;
        this.fsm.transition(data.front ? 'driving' : 'seated');
      }
    },
    exit() {
      const d = this.fsm.data;
      // Called off part-way (asked to get down): getting off runs this back from where she'd got to.
      this.interruptedMount = d.done ? null : { k: this.moveK, kind: this.moving?.kind, side: d.side, front: d.front };
      this.endMove();
      this.movingSeatPose = null;
    },
  },

  seated: {
    // On the back the pillion pose has her head (and turns it to what catches her eye); on the rack she watches where it's going.
    look() {
      return this.seatKind === 'rack' ? this.lookAhead(this.quad, 12, 1.2) : 'own';
    },
    enter() {
      const rack = this.seatKind === 'rack';
      this.seatAnchor(false).add(this.root);
      this.root.position.copy(this.seatOffset());
      this.root.quaternion.identity();
      this.root.rotation.y = this.sideAngle;
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = this.seatSpread();
      this.sittingPose = this.seatPoseName(false);
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
      this.watchSideSaddle(dt);
      this.mindTheEngine(dt);
      this.askToGetOff(dt);
      this.updateNumb(dt);
      this.boredOnTheBack(dt);
      this.watchRunaway(dt);
      this.afterFriendsRide(dt);
    },
    exit() {
      this.releaseIdle();
      this.sittingPose = null;
      this.askedToGetOff = false;
      this.askIn = null;
      if (this.quad.rackRider === this) this.quad.rackRider = null;
      this.pillion.release();
    },
  },

  dismounting: {
    look() {
      const t = this.target?.position;
      return t ? { x: t.x, y: t.y + 0.2, z: t.z, weight: 2 } : null;
    },
    enter() {
      const im = this.interruptedMount;
      this.interruptedMount = null;
      const parent = this.root.parent;
      this.dismountingFrom = im ? (im.front ? 'rider' : this.seatKind === 'rack' ? 'rack' : 'pillion') : parent === this.quad.riderAnchor ? 'rider' : parent === this.quad.rackAnchor ? 'rack' : 'pillion';
      const front = this.dismountingFrom === 'rider';
      // Off on the left, unless her friend's getting off or standing there; side-saddle, off the side her legs are.
      this.dismountSide = this.others().some((o) => o.root.position.distanceTo(this.standPoint(1).position) < 0.9 || (o.quad === this.quad && o.fsm.is('dismounting') && o.dismountSide === 1)) ? -1 : 1;
      if (this.dismountingFrom === 'pillion' && this.sideSaddle) this.dismountSide = this.sideSaddle;
      if (front && this.quad.driverStand) this.dismountSide = -1; // out of the driver's door
      if (im) this.dismountSide = im.side;
      // Over the exhaust side with a leg (exhaustBurn.js): Jess sometimes picks it, and a hot pipe catches her calf.
      this.burnPending = false;
      const exhaustSide = exhaustSideOf(this.quad);
      if (!im && this.quadMoveKind(front) === 'legOver' && exhaustSide) {
        const forced = this.forceBurn;
        this.dismountSide = forced ? exhaustSide : dismountSideFor({ side: this.dismountSide, exhaustSide, p: this.params });
        const heat = forced ? 1 : pipeHeat(this.quad.engine);
        this.burnPending = burns({ side: this.dismountSide, exhaustSide, heat, p: this.params, forced });
      }
      this.forceBurn = false;
      // Back into the world, keeping her current world transform.
      attachKeepingSize(this.scene, this.root);
      const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ');
      this.root.rotation.set(0, e.y, 0);
      this.heading = this.startHeading = e.y;
      this.target = this.standPoint(this.dismountSide);
      this.slipTarget = this.slipping ? this.slipSpot() : null;
      this.slipping = false;
      const side = this.dismountSide;
      const kind = im?.kind ?? this.quadMoveKind(front);
      this.movingSeatPose = this.seatPoseName(front);
      this.beginMove({
        kind, side, dir: -1, from: im ? im.k : 1, duration: front && this.quad.driverStand ? this.hay.stepSeconds : this.params.dismountDuration, seat: this.seatAnchor(front),
        seatEnd: () => this.quadSeatEnd(front), standEnd: () => (this.target = this.slipTarget ?? (kind === 'legOver' ? this.stepOffPoint(side, front) : this.standPoint(side))),
        twistTo: kind === 'hopOn' ? this.quad.yaw + (side * Math.PI) / 2 : undefined,
      });
    },
    update(dt) {
      const p = this.params;
      const done = this.stepMove(dt);
      const f = this.moveFrame;
      const spread = (this.dismountingFrom === 'rider' && this.quad.driverStand) ? 0 : this.dismountingFrom === 'rack' || (this.dismountingFrom === 'pillion' && this.sideSaddle) ? this.seatSpread() : p.legSpread;
      this.rig.legSpread = spread * (this.moving.kind === 'legOver' ? f.spread : f.sit);
      // Her leg goes over the pipe about half way through.
      if (this.burnPending && this.moveK < 0.55) {
        this.burnPending = false;
        this.burntLeg = true;
        this.selfEvents.push('burntLeg');
      }
      if (done) {
        this.endMove();
        this.movingSeatPose = null;
        this.rig.legSpread = 0;
        this.slipTarget = null;
        this.setColliderEnabled(true);
        if (this.dismountingFrom === 'rider') {
          if (Math.random() < p.parkBrakeChance || this.quad.driverStand) this.quad.parkBrake = true; // a car's handbrake: always, or it creeps on the slope
          this.quad.lastLeft = { who: this.character.id, braked: this.quad.parkBrake };
        }
        this.fsm.transition('idle', { facing: this.target.facing });
        if (this.burntLeg) {
          this.burntLeg = false;
          this.react('flinch', { from: this.quad.position, strength: 1 }); // snatches her leg away
        }
        // A request that needed her off this quad first (e.g. getting on the other one).
        const next = this.afterDismount;
        this.afterDismount = null;
        next?.();
      }
    },
    exit() {
      if (this.moving) this.endMove();
      this.movingSeatPose = null;
    },
  },
};
