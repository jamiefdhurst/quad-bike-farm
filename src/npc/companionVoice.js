import * as THREE from 'three';
import { Chatter } from './chatter.js';
import { HardBrake } from './hardBrake.js';
import { VOICE_LINES } from './voiceLines.js';
import { band } from './skills.js';
import { Speech } from '../audio/companionAudio.js';
import { FAULT_KINDS } from '../vehicle/faults.js';
import { girlKnows, historyTopics } from '../vehicle/history.js';
import { applicableQuirks, featuresOf, girlKnowsQuirks } from '../vehicle/quirks.js';
import { engineCondition, guessCondition } from './diagnosis.js';
import { guessPlug } from '../workshop/benchJobs.js';
import { isThrashed } from '../engine/wearLedger.js';
import { isThrashedRunningIn } from '../engine/runningIn.js';
import { leftRunningSituation } from './leftRunning.js';
import { quadKey } from './quadNames.js';
import { voiceWobble } from './voiceWobble.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Captions for her recorded sounds.
const SOUND_CAPTIONS = { sigh: '(sighs)', hum: '(hums)', laugh: '(laughs)', yawn: '(yawns)', gasp: '(gasps)', hmm: 'Hmm?', oh: 'Oh.' };

const DIAGNOSE_SITUATION = { cold: 'diagnoseCold', rich: 'diagnoseRich', fouled: 'diagnoseFouled', worn: 'diagnoseWorn', fine: 'diagnoseFine' };
const FAULT_SITUATION = { puncture: 'faultPuncture', belt: 'faultBelt', cable: 'faultCable', carb: 'faultCarb', mounts: 'faultMounts', chain: 'faultChain', valves: 'faultValves', rod: 'faultRod', rim: 'faultRim', leak: 'faultLeak', clutch: 'faultClutch' };

// Mistakes that show a skill she's short on.
const SLIPS = { chokeOff: 'choke', stalled: 'starting', overSteer: 'cornering', revIt: 'mud' };

/**
 * Watches what's going on around her and has her say something about it now
 * and then: riding pillion (fun, rough, too fast, hard braking, stalls), you
 * struggling to start a quad near her (with a hint if she can tell why), being
 * left waiting, being left behind, and answering when you ask her something.
 * Which line, and whether she bothers, is up to the Chatter.
 */
export class CompanionVoice {
  constructor({ companion, speech, sounds, hud, params, soundParams, lines = VOICE_LINES, name = null, floor = { left: 0 } }) {
    this.companion = companion;
    this.name = name; // shown before her captions when there's more than one of them
    this.floor = floor; // shared between companions: seconds until someone else has finished talking
    this.speech = speech;
    this.sounds = sounds;
    this.hud = hud;
    this.params = params;
    this.soundParams = soundParams;
    this.chatter = new Chatter(lines, { minGap: params.voiceMinGap, chattiness: params.chattiness });

    this.head = new THREE.Vector3();
    this.checkTimer = 0;
    this.prevSpeed = 0;
    this.decel = 0;
    this.hardBrake = new HardBrake(); // braking hard with her on the back, not a dab (hardBrake.js)
    this.prevVy = 0;
    this.jolt = 0;
    this.fastTime = 0;
    this.funTime = 0;
    this.gentleTime = 0;
    this.rideTime = 0;
    this.nearTime = 0;
    this.wasTogether = false;
    this.level = 0; // and its square root: the level the buzz and numbness.js count
    this.shake = 0; // how hard her seat is shaking, smoothed
    this.shakeTime = 0;
    this.seatedShakeTime = 0;
    this.seatTime = 0; // on the same quad with you, moving
    this.favourite = null; // spec id of the quad she likes best, picked once the quads are known
    this.favouriteSaid = false;
    this.names = null; // the game's QuadNames: what the girls call each quad (npc/quadNames.js)
    this.slipped = false; // Amy has just used a nickname she was pretending not to know
    this.stoppedTime = 0;
    this.idleTime = 0;
    this.awayTime = 0;
    this.leftBehindSaid = false;
    this.ghostTime = 0;
    this.ghostVerdict = 0; // seconds left to tell you what she thought of that
    this.engineWatch = new Map(); // unit -> { state, cranking }
    this.coldNearTime = 0;
    this.pouredNear = false;
    this.wasMenuOpen = false;
    this.listener = new THREE.Vector3();
    this.driveTalk = 0; // seconds until she might say something while driving
    this.driveNerve = 0; // 0 nervous .. 1 enjoying it, while she's driving
    this.driveVy = 0;
    this.driveJolt = 0;
  }

  /** She got something right by herself: once she's getting the hang of it, or has it, she says so. */
  onPractice(skill) {
    const level = band(this.companion.skillLevels?.[skill] ?? 0.5);
    if (level !== 'novice') this.say(`skill_${skill}_${level}`, { urgent: true, chance: 0.5 });
  }

  /** She was asked to do something from the menu. */
  onRequest(kind) {
    const SAY = { mount: 'ackMount', mountRack: 'ackMount', start: 'ackStart', drive: 'ackDrive', back: 'ackBack', stopDrive: 'ackStopDrive', letOff: 'ackLetOff', keepOn: 'ackKeepOn', giveRide: 'ackGiveRide', follow: 'ackFollow', passengerOn: 'passengerOn', letMeOff: 'ackLetMeOff', stopHere: 'ackStopHere', slower: 'ackSlower', faster: 'ackFaster', goAgain: 'ackGoAgain', swap: 'ackSwap' };
    this.say(SAY[kind] ?? 'ackStand', { force: true });
  }

  /**
   * You tinkering with a quad from the toolbox (raised by workshop.js): 'open',
   * 'adjust', 'limiter' (de-restricting it), 'stock', or 'fast' (asked every
   * frame while riding her quicker than a de-restricted quad used to go). She
   * only remarks on what she can see. Returns what she said, if anything.
   */
  /** You're washing a quad, or you've just sprayed her. */
  onWash(kind) {
    if (this.head.distanceTo(this.listener) > this.params.voiceRange) return null;
    return kind === 'her' ? this.say('sprayedHer', { urgent: true }) : this.say('washing', { chance: 0.004 });
  }

  /** She has noticed the mud or dust on her (muddiness.js): 'mud' or 'dust'. Returns what she said, if anything. */
  onMuddy(kind) {
    if (this.head.distanceTo(this.listener) > Math.min(15, this.params.voiceRange)) return null;
    return this.say(kind === 'dust' ? 'dusty' : 'muddy');
  }

  onTinker(kind) {
    const [situation, chance] = { open: ['tinkerOpen', 0.6], adjust: ['tinker', 0.25], limiter: ['tinkerLimiter', 0.9], stock: ['tinkerStock', 0.6], service: ['tinkerService', 0.8], silencerOff: ['silencerOff', 0.9], silencerOn: ['silencerOn', 0.8], fast: ['tunedFast', 0.02], jetLean: ['jetLean', 0.9], jetRight: ['jetRight', 0.8] }[kind] ?? [];
    if (!situation || this.head.distanceTo(this.listener) > Math.min(15, this.params.voiceRange)) return null;
    return this.say(situation, { urgent: true, chance });
  }

  /** You've fixed up her favourite and it had gone rough (dontFixIt.js): she minds, as close as she is. Returns what she said, if anything. */
  onFixedFavourite() {
    if (this.head.distanceTo(this.listener) > Math.min(15, this.params.voiceRange)) return null;
    return this.say('fixMinds', { urgent: true, force: true });
  }

  /** You working at the barn bench: 'start', 'step', 'flaw', 'done' (done right) or 'botched', and for the barn find 'tarp' (it's off) and 'runs' (its first start). */
  onBench(kind) {
    const [situation, chance] = { start: ['benchStart', 0.6], step: ['benchStep', 0.12], flaw: ['benchFlaw', 0.8], done: ['benchDone', 0.7], botched: ['benchBotched', 0.8], catalogue: ['boreCatalogue', 0.9], boreDone: ['boreDone', 1], boreBotched: ['boreBotched', 1], tarp: ['rustyTarp', 0.95], runs: ['rustyRuns', 1] }[kind] ?? [];
    if (!situation || this.head.distanceTo(this.listener) > Math.min(15, this.params.voiceRange)) return null;
    return this.say(situation, { urgent: true, chance });
  }

  /** You've pulled the old plug: she says what she makes of it, as accurately as `diagnoseAccuracy` (Amy 0.9, Jess 0.5). */
  onPlug(kind) {
    if (this.head.distanceTo(this.listener) > Math.min(15, this.params.voiceRange)) return null;
    const guess = guessPlug(kind, this.companion.params.diagnoseAccuracy);
    return this.say(`plug${guess[0].toUpperCase()}${guess.slice(1)}`, { urgent: true, chance: 0.85 });
  }

  /**
   * @param {number} dt
   * @param {object} view  { listener: Vector3, ridden: QuadUnit|null, units, menuOpen, pouring }
   */
  update(dt, view) {
    const p = this.params;
    const c = this.companion;
    this.chatter.minGap = p.voiceMinGap;
    this.chatter.chattiness = p.chattiness;
    this.chatter.update(dt);
    this.listener.copy(view.listener);
    c.root.getWorldPosition(this.head);
    this.head.y += c.params.height * 0.92;
    this.sounds.setPosition(this.head);
    if (!p.voice) return;

    const distance = this.head.distanceTo(view.listener);
    const ridden = view.ridden;
    const together = !!ridden && c.isSeated && c.quad === ridden.quad;
    // On the back of a quad that's being driven, by you or by her friend: she reacts to the ride.
    const rideQuad = together ? ridden.quad : c.isSeated && c.quad.driver ? c.quad : null;

    // Talking to her.
    if (view.talkingToHer && !this.wasMenuOpen) this.say('talkTo', { force: true, chance: 0.6 });
    this.wasMenuOpen = !!view.talkingToHer;

    // You getting on in front of her.
    if (together && !this.wasTogether) this.say('mountedTogether', { urgent: true, chance: 0.7 });
    this.wasTogether = together;

    // Riding pillion: track speed, braking and jolting every frame.
    if (rideQuad) {
      const quad = rideQuad;
      const speed = Math.abs(quad.forwardSpeed);
      const vy = quad.velocity.y;
      if (dt > 0) {
        const decelNow = (this.prevSpeed - speed) / dt;
        this.decel += (decelNow - this.decel) * Math.min(1, dt * 8);
        const jolt = Math.abs(vy - this.prevVy) / dt;
        this.jolt += (jolt - this.jolt) * Math.min(1, dt * 6);
      }
      this.prevSpeed = speed;
      this.prevVy = vy;

      // Bogged down with her on the back.
      if (quad.bog?.stuck && !this.stuckSaid) this.stuckSaid = !!this.say('stuckRiding', { urgent: true });
      if (!quad.bog?.stuck) this.stuckSaid = false;
      // Leaning or pitched over on a steep slope (the hill's banks): world/hill.js, vehicle/topple.js.
      if (quad.upY < p.voiceSteepUpY && speed > 0.5 && !quad.isTipped) this.say('hillSteep', { urgent: true, chance: 0.8 });
      if (this.hardBrake.update(dt, this.decel, speed, p)) this.say('hardBrake', { urgent: true });
      else if (this.jolt > p.voiceRoughAccel && speed > 2) this.say('rideRough', { chance: 0.6 });

      this.fastTime = speed > p.voiceFastSpeed ? this.fastTime + dt : 0;
      if (this.fastTime > 1.5) this.say('rideFast');

      const smooth = this.jolt < p.voiceRoughAccel * 0.5;
      this.funTime = speed > 4 && speed <= p.voiceFastSpeed && smooth ? this.funTime + dt : Math.max(0, this.funTime - dt * 2);
      this.gentleTime = speed > 1.5 && speed <= 5 && smooth ? this.gentleTime + dt : Math.max(0, this.gentleTime - dt * 2);
      this.rideTime = speed > 1.5 ? this.rideTime + dt : this.rideTime;
      if (speed > 1.5 && this.stoppedTime > 4) this.say('rideStart', { chance: 0.7 });
      this.stoppedTime = speed < 0.5 ? this.stoppedTime + dt : 0;
    } else {
      this.prevSpeed = 0;
      this.prevVy = 0;
      this.jolt = 0;
      this.decel = 0;
      this.hardBrake.reset();
      this.fastTime = 0;
      this.funTime = 0;
      this.gentleTime = 0;
      this.stoppedTime = 10;
    }

    this.view = view;
    this.watchWeather(dt, view.weather);
    this.watchGhostRide(dt, together);
    this.watchStarting();
    this.watchOwnMind();
    this.watchResting(dt);
    this.watchDriving(dt);
    this.watchEngines(dt, view, together, distance);
    this.watchSeat(dt, view, !!rideQuad);

    // Slower checks, once a second.
    this.checkTimer -= dt;
    if (this.checkTimer > 0) return;
    const step = 1 - this.checkTimer;
    this.checkTimer = 1;

    // How you've treated her against her friend: a favoured girl says kind things more often, a neglected one hardly at all.
    const { mood, warmth } = c.favourView();

    // The odd kind word: on a smooth ride with you, stood together, or when you're out in the rain.
    if (together && (this.funTime > 15 || this.gentleTime > 15)) this.say('loveYou', { chance: 0.03 * warmth });
    if (together && view.weather?.rain > 0.25 && this.rideTime > 40) this.say('careForYou', { chance: 0.03 * warmth });

    if (rideQuad) {
      if (this.funTime > 8) this.say('rideFun', { chance: 0.35 });
      else if (this.gentleTime > 10) this.say('rideGentle', { chance: 0.3 });
      if (this.rideTime > 150) this.say('rideLong', { chance: 0.15 });
    }

    // A quad she's on or right by that's badly in need of a service.
    const sick = (view.units ?? []).find((u) => u.engine.isRunning && u.engine.erratic > 0.25 && (u.quad === c.quad && !c.fsm.is('idle', 'walking') ? true : u.quad.position.distanceTo(this.head) < 6));
    if (sick) this.say('engineSick', { chance: 0.05 });

    // Near the quads: she likes them all going, and misses it when they aren't.
    if (c.availability().settled && !view.menuOpen && (view.units ?? []).some((u) => u.engine.isRunning && u.quad.position.distanceTo(this.head) < 8)) {
      if (c.content.share >= 0.7) this.say('likeAllRunning', { chance: p.likeRunningChance * step });
      else if (c.content.share <= 0.5) this.say('wishAllRunning', { chance: p.wishRunningChance * step });
    }

    // Stood next to you, both on foot: the odd warm word.
    const standing = c.fsm.is('idle');
    const close = standing && !ridden && distance < 4 && !view.menuOpen;
    this.nearTime = close ? this.nearTime + step : 0;
    if (this.nearTime > 8) this.say('nearbyWarm', { chance: 0.08 });
    if (this.nearTime > 15) this.say(view.weather?.rain > 0.25 ? 'careForYou' : 'loveYou', { chance: 0.05 * warmth });
    if (this.nearTime > 6 && mood !== 'even') this.say(mood === 'favoured' ? 'favouredWarm' : 'neglectedSulk', { chance: 0.06 });

    // Standing about with nothing happening.
    const waitingSeated = c.isSeated && !rideQuad;
    this.idleTime = (standing || waitingSeated) && !view.menuOpen ? this.idleTime + step : 0;
    if (!close && this.idleTime > p.voiceWaitAfter && distance < p.voiceRange && this.chatter.sinceSpoke > p.voiceWaitAfter) {
      this.say(standing ? 'waitingStanding' : 'waitingSeated', { chance: 0.12 });
    }

    // You riding off without her, and coming back.
    const playerRidingOff = ridden && !together && Math.abs(ridden.quad.forwardSpeed) > 4;
    if (standing && playerRidingOff && distance > 10 && distance < 30 && !this.leftBehindSaid) {
      this.leftBehindSaid = !!this.say('leftBehind', { urgent: true, chance: 0.8 }) || this.leftBehindSaid;
    }
    if (distance < 8) this.leftBehindSaid = false;
    if (distance > 40) this.awayTime += step;
    else if (distance < 8) {
      if (this.awayTime > 20) this.say('playerBack', { chance: 0.7 });
      this.awayTime = 0;
    }

    // Pouring petrol right by her.
    if (view.pouring && view.wrongMix && distance < 8 && !this.warnedMix) {
      this.warnedMix = true;
      this.say(view.wrongMix === 'straight' ? 'oilStraight' : view.wrongMix === 'diesel' ? 'dieselWarn' : view.wrongMix === 'petrol' ? 'utvPetrolWarn' : 'oilPremixFour', { urgent: true });
    }
    if (!view.pouring) this.warnedMix = false;
    if (view.pouring && distance < 6 && !this.pouredNear) {
      this.pouredNear = true;
      this.say('pouring', { chance: 0.4 });
    }
    if (!view.pouring) this.pouredNear = false;
  }

  /**
   * Sitting on a quad: how much it's shaking her, and which quad it is. Bad
   * shaking gets a comment whether you're riding or have left her sat on it
   * idling, and left on it long enough she admits she quite likes it.
   */
  watchSeat(dt, view, together) {
    const c = this.companion;
    const p = this.params;
    if (!this.favourite) {
      // Only a quad she can ride and has something to say about (the kids' and loan quads have no favourite lines).
      const likeable = view.units.filter((u) => this.companion.mayRide(u.quad) && this.chatter.lines[`like${cap(u.spec.id)}`]);
      this.favourite = likeable[Math.floor(Math.random() * likeable.length)]?.spec.id ?? null;
    }
    const unit = c.quad.unit;
    if (!c.isSeated || !unit?.engine.isRunning) {
      this.sounds.setWobble?.(0, 1);
      this.level = 0;
      this.shake = 0;
      this.shakeTime = 0;
      this.seatedShakeTime = 0;
      if (!c.isSeated) {
        this.seatTime = 0;
        this.buzzSaid = false;
        this.favouriteSaid = false;
      }
      return;
    }
    const b = unit.vibration.body;
    const wobble = voiceWobble(b.heave, p);
    this.sounds.setWobble?.(wobble.cents, wobble.gain);
    const now = Math.hypot(b.heave * 100, b.pitch * 57.3, b.roll * 57.3);
    this.shake += (now * now - this.shake) * Math.min(1, dt / 1.5);
    const level = Math.sqrt(this.shake);
    this.level = level; // how hard her seat is shaking her, for numbness.js
    c.content.feel(dt, unit.spec.id, level, p);
    // Whichever quad shakes her most, she comes to like best.
    const fav = c.content.favourite(this.favourite, p, (id) => !!this.chatter.lines[`like${cap(id)}`] && view.units.some((u) => u.spec.id === id && c.mayRide(u.quad)));
    if (fav !== this.favourite) {
      this.favourite = fav;
      this.favouriteSaid = false;
    }
    if (together && !this.buzzSaid && c.content.enjoyed(unit.spec.id, p) && level >= p.buzzFrom) {
      if (this.say('buzzLove', { chance: 0.01 })) this.buzzSaid = true;
    }
    const bad = level > p.voiceShakeLevel;
    this.shakeTime = bad ? this.shakeTime + dt : 0;
    this.seatedShakeTime = bad && !together ? this.seatedShakeTime + dt : together ? 0 : this.seatedShakeTime;
    if (together) {
      if (this.shakeTime > 3) this.say('rideShaking', { chance: 0.01 });
    } else if (this.seatedShakeTime > 40) {
      this.say('seatedShakingLong', { chance: 0.01 });
    } else if (this.shakeTime > 5) {
      this.say('seatedShaking', { chance: 0.01 });
    }

    // Once per ride, a word about the quad she's on.
    if (together && Math.abs(unit.quad.forwardSpeed) > 1.5) this.seatTime += dt;
    if (this.favourite && !this.favouriteSaid && this.seatTime > 12) {
      const id = unit.spec.id;
      const situation = id === this.favourite ? `like${cap(id)}` : `prefer${cap(this.favourite)}`;
      if (this.say(situation, { chance: 0.01 })) this.favouriteSaid = true;
    }
  }

  /** You jumped off and left her on a quad that's driving itself. */
  watchGhostRide(dt, together) {
    const c = this.companion;
    if (c.isSeated && c.quad.isGhostRiding && !together) {
      // Each time, she's either terrified or having the time of her life.
      if (c.ghostLikes !== null) this.ghostFun = c.ghostLikes;
      this.ghostTime += dt;
      if (this.ghostTime > 0.4) this.say(this.ghostFun ? 'ghostRidingFun' : 'ghostRiding', { urgent: true });
    } else if (this.ghostTime > 0) {
      // Once it's come to a stop, or you've caught it, she tells you what she thinks.
      if (!c.isSeated || together || c.quad.speed < 0.5) {
        if (this.ghostTime > 2 && c.isSeated) this.ghostVerdict = 4;
        this.ghostTime = 0;
      }
    }
    if (this.ghostVerdict > 0) {
      this.ghostVerdict -= dt;
      if (this.say(this.ghostFun ? 'ghostStoppedFun' : 'ghostStopped', { urgent: true })) this.ghostVerdict = 0;
    }
  }

  /** Sat out on the bales or fence, or stood in the barn doorway: now and then she says something about it. */
  watchResting(dt) {
    const c = this.companion;
    if (!c.isResting || c.restPhase !== 'sat') {
      this.restTalk = null;
      return;
    }
    this.restTalk ??= 25 + Math.random() * 50;
    this.restTalk -= dt;
    if (this.restTalk > 0) return;
    this.restTalk = 60 + Math.random() * 90;
    this.say(c.restSpot?.kind === 'shelter' ? 'restShelter' : c.restSpot?.kind === 'loft' ? 'loftSat' : 'restSat', { chance: 0.7 });
  }

  /** Says what she's up to when she decides to do something on her own. */
  watchOwnMind() {
    const events = this.companion.selfEvents;
    // Switching a quad off is rare, so she always mentions it.
    for (const e of events) this.say({ wander: 'selfWander', restGo: 'restGo', loftGo: 'loftGo', restRain: 'restRain', goInDark: 'goInDark', restLeave: 'restLeave', dozeGo: 'dozeGo', dozeOff: 'dozeOff', dozeWake: 'dozeWake', dozeWakeGentle: 'dozeWakeGentle', dozeStartled: 'dozeStartled', join: 'selfJoin', mount: 'selfMount', start: 'selfStart', drive: 'selfDrive', sulkOff: 'sulkOff', offerRide: 'offerRide', borrow: 'borrow', doughnuts: 'selfDoughnuts', jumps: 'selfJumps', showOff: 'selfShowOff', nickGo: 'nickGo', nickBack: 'nickBack', lineUp: 'selfLineUp', lineUpCrooked: 'selfCrooked', straighten: 'lineUpStraighten', lineUpNotice: 'lineUpNotice', keyOff: 'selfKeyOff', buzz: 'selfBuzz', numbTingle: 'numbTingle', numbGo: 'numbGo', numbStretch: 'numbStretch', numbBack: 'numbBack', keepSit: 'keepSit', keepCharge: 'keepCharge', keepCharged: 'keepCharged', keepTruth: 'keepTruth', keepDied: 'keepDied', keepGiveUp: 'keepGiveUp', askOff: 'askOff', askStop: 'askStop', getOff: 'selfGetOff', getOffWaited: 'selfGetOffWaited', takeOverStop: 'takeOverStop', takeOverDrive: 'takeOverDrive', sideOn: 'sideSaddleOn', sideWobble: 'sideSaddleWobble', sideSlip: 'sideSaddleSlip', burntLeg: 'burntLeg' }[e], { urgent: true, chance: e === 'dozeStartled' || e === 'dozeWakeGentle' || e === 'keyOff' || e === 'askOff' || e === 'offerRide' || e === 'sulkOff' || e === 'borrow' || e.startsWith('nick') || e.startsWith('takeOver') || e === 'sideWobble' || e === 'sideSlip' || e === 'burntLeg' ? 1 : 0.8, waitTurn: true });
    events.length = 0;
  }

  /**
   * Driving a quad herself: what happens (setting off, yanking the bars,
   * nearly hitting things, stalling, bumps), a nervous or gleeful word now and
   * then as she gets the hang of it, and why she's stopping.
   */
  watchDriving(dt) {
    const c = this.companion;
    const events = c.driveEvents;
    const driving = c.fsm.is('driving') && c.drive;
    const SAY = {
      setOff: ['driveSetOff', 0.9],
      moveOff: ['driveMoveOff', 0.25],
      overSteer: ['driveOverSteer', 0.7],
      obstacle: ['driveObstacle', 0.8],
      stuck: ['driveObstacle', 0.8],
      stalled: ['driveStalled', 0.9],
      revIt: ['driveBogged', 0.8],
      rollBack: ['driveRollBack', 1],
      chokeBack: ['startRemembered', 0.9],
      pause: ['drivePause', 0.35],
      tooFast: ['driveTooFast', 1],
      noRoom: ['driveNoRoom', 1],
      waitingForYou: ['waitingForYou', 1],
      fallingBehind: ['fallingBehind', 1],
      friendOn: ['friendOn', 0.9],
      followGaveUp: ['followGaveUp', 1],
      stuckInBog: ['stuckInBog', 1],
      followDriveOn: ['followDriveOn', 1],
      followSmoke: ['followSmoke', 0.8],
      followDust: ['followDust', 0.8],
      dustCough: ['dustCough', 0.6],
      hillWait: ['hillWait', 1],
      doughnuts: ['doughnutSpin', 0.7],
      onRoad: ['roadOn', 0.6],
      showOffGo: ['showOffGo', 1],
      showOffSeen: ['showOffSeen', 1],
      showOffAgain: ['showOffAgain', 1],
      showOffMissed: ['showOffMissed', 1],
      jumpRun: ['jumpRun', 0.8],
      jumpAir: ['jumpAir', 0.9],
      towStart: ['towStart', 1],
      snatch: ['towSnatch', 1],
      bump: ['towBump', 1],
      'done:unhooked': ['towDone', 1],
      overtook: ['passOvertook', 1],
      waitedAhead: ['passPleased', 1],
      'done:bored': ['driveBored', 0.9],
      'done:scared': ['driveScared', 0.9],
      'done:gaveUp': ['driveGaveUp', 0.9],
      toBack: ['driveToBack', 0.8],
      getOff: ['driveGetOff', 0.5],
      taken: ['driveTaken', 1],
    };
    const mood = c.driveMood ?? 0.5;
    for (const e of events) {
      // A mistake she's no good at yet gets her own line about it, in place of the usual yelp.
      const slip = SLIPS[e];
      if (slip && c.skillLevels && band(c.skillLevels[slip]) === 'novice' && this.say(`skill_${slip}_novice`, { urgent: true, chance: 0.7 })) continue;
      // Setting off, how she feels about it shows.
      if (e === 'setOff' && mood < 0.35) {
        this.say('driveSetOffCareful', { urgent: true, chance: 0.9 });
        this.driveNerve = 0;
        continue;
      }
      if (e === 'setOff' && mood > 0.65) {
        this.say('driveSetOffConfident', { urgent: true, chance: 0.9 });
        this.driveNerve = 0.5;
        continue;
      }
      // Each fright knocks her confidence.
      if (e === 'overSteer' || e === 'obstacle' || e === 'stuck' || e === 'stalled' || e === 'rollBack') this.driveNerve = Math.max(0, this.driveNerve - 0.35);
      if (e === 'setOff') this.driveNerve = 0;
      // A stall that ends her go has its own line.
      if (e === 'stalled' && c.drive?.stalls > this.params.driveMaxStalls) continue;
      const [situation, chance] = SAY[e] ?? [];
      if (situation) this.say(situation, { urgent: true, chance });
    }
    events.length = 0;
    if (!driving) {
      this.driveVy = 0;
      this.driveJolt = 0;
      return;
    }

    // Bumps: a squeak when the ground throws her about.
    const quad = c.quad;
    const vy = quad.velocity.y;
    if (dt > 0) this.driveJolt += (Math.abs(vy - this.driveVy) / dt - this.driveJolt) * Math.min(1, dt * 6);
    this.driveVy = vy;
    const speed = Math.abs(quad.forwardSpeed);
    if (this.driveJolt > this.params.voiceRoughAccel * 0.7 && speed > 1) this.say('driveBump', { urgent: true, chance: 0.5 });

    // Getting the hang of it, slowly.
    if (c.drive.phase !== 'drive') return;
    this.driveNerve = Math.min(1, this.driveNerve + dt / 40);
    this.driveTalk -= dt;
    if (this.driveTalk > 0) return;
    this.driveTalk = 4 + Math.random() * 6;
    const happy = Math.random() < 0.05 + mood * 0.4 + this.driveNerve * 0.45;
    this.say(happy ? 'driveHappy' : 'driveNervous', { chance: 0.45 });
  }

  /** Talking herself through starting a quad you asked her to. */
  watchStarting() {
    const events = this.companion.startEvents;
    if (!events.length) return;
    const SAY = {
      tapOn: ['startTap', 0.6],
      chokeOn: ['startChoke', 0.7],
      remembered: ['startRemembered', 1],
      caught: ['startCaught', 1],
      gaveUp: ['startGaveUp', 1],
      warmedUp: ['startWarm', 1],
      slow: ['startSlow', 1],
      flat: ['startFlat', 1],
      pull: ['startPull', 1],
      knack: ['startKnack', 1],
    };
    const girl = this.companion.character?.id;
    const specId = this.view?.units?.find((u) => u.quad === this.companion.quad)?.spec.id;
    for (const e of events) {
      if (e === 'crank') {
        const a = this.companion.attempt ?? this.companion.drive?.attempt;
        // Jess pats the tank and talks to it on the first go; after that it is "come on" like anyone.
        if (a && a.bursts === 1 && girl === 'jess' && specId && this.sayQuad('startPat', specId, { urgent: true, chance: 0.7 })) continue;
        if (a && a.bursts > 1) this.say('startCrank', { urgent: true, chance: 0.6 });
        continue;
      }
      // Jess cheers it by name; Amy says sorry to it when it floods.
      if (e === 'caught' && girl === 'jess' && specId && this.sayQuad('startCheer', specId, { urgent: true, chance: 0.7 })) continue;
      if (e === 'flooded') {
        if (girl === 'amy' && specId) this.sayQuad('startSorry', specId, { urgent: true, chance: 0.8 });
        continue;
      }
      const [situation, chance] = SAY[e] ?? [];
      if (situation) this.say(situation, { urgent: true, chance });
    }
    events.length = 0;
  }

  /** Stalls, long cranking and catching at last, for quads near her. */
  watchEngines(dt, view, together, distance) {
    const c = this.companion;
    let coldNear = false;
    const content = c.content;
    content.update(dt, view.units.filter((u) => u.engine.isRunning).length / Math.max(1, view.units.length), c.params);
    for (const unit of view.units) {
      const e = unit.engine;
      const w = this.engineWatch.get(unit) ?? { state: e.state, cranking: 0 };
      this.engineWatch.set(unit, w);
      // When she's the one starting it, she has her own things to say.
      const hersToStart = c.fsm.is('starting', 'driving') && c.quad === unit.quad;
      const near = !hersToStart && unit.quad.position.distanceTo(this.head) < 15 && distance < this.params.voiceRange;
      const hers = together && view.ridden === unit;

      if (e.state === 'cranking') w.cranking += dt;
      if (w.state === 'running' && e.state === 'stalled' && (hers || (near && c.quad === unit.quad))) {
        this.say(e.lastStallReason === 'noFuel' ? 'outOfFuel' : e.lastStallReason === 'diesel' ? 'dieselDied' : e.lastStallReason === 'fuelWater' ? 'waterDied' : 'stalledRiding', { urgent: true, chance: 0.8 });
      }
      // A quad stalling where she can see it gets her down, more so if it was under her; the one she was driving knocks her nerve.
      if (w.state === 'running' && e.state === 'stalled' && unit.quad.position.distanceTo(this.head) < c.params.voiceRange) {
        const onIt = c.quad === unit.quad && !c.fsm.is('idle', 'walking');
        content.stalled(onIt, c.params);
        if (onIt && c.fsm.is('driving')) c.driveConfidence = Math.max(0, (c.driveConfidence ?? c.params.driveConfidence) - c.params.stallConfidenceKnock);
        if (!hers && !(near && c.quad === unit.quad)) this.say('stallSad', { urgent: true, chance: 0.8 });
      }
      if (w.state !== 'running' && e.isRunning) {
        // And a bit of relief when it's going again.
        if (content.sad > 0.15 && near) this.say('stallRelief', { urgent: true, chance: 0.7 });
        if (w.cranking > 5 && near) this.say('caughtAfterStruggle', { urgent: true, chance: 0.8 });
        w.cranking = 0;
      }
      if (e.state === 'off') w.cranking = 0;
      // You press the starter on a flat battery and it only clicks.
      if (near && e.events.some((x) => x.type === 'starterClick')) this.say('crankFlat', { urgent: true, chance: 0.7 });
      this.watchOil(dt, unit, w, near || hers);
      if (unit.id === 'blue' && e.isRunning && unit.quad.choke > 0.3 && e.rich > 0.2 && (near || hers)) this.say('chokeOffBlue', { chance: 0.01 });
      this.watchHeat(unit, near || hers);
      this.watchDiesel(unit, near || hers);
      this.watchWater(unit, near || hers);
      if (e.silencerOff && e.isRunning && (near || hers)) this.say('silencerLoud', { chance: 0.015 });
      if (e.silencerBlown >= this.companion.params.blownNoticeAt && e.isRunning && (near || hers) && this.chatter.time >= (w.blownUntil ?? 0)) {
        if (this.say('silencerBlown', { chance: 0.02 })) w.blownUntil = this.chatter.time + 300;
      }
      this.watchFaults(unit, w, near || hers);
      this.watchCarbIce(unit, w, near || hers);
      this.watchDieselWax(unit, w, near || hers);
      this.watchDiagnosis(dt, unit, w);
      this.watchThrash(dt, unit, view, near || hers);
      this.watchBlame(dt, unit, w, view);
      this.watchLeftRunning(dt, unit, w, view);
      this.watchDrip(dt, unit, w, view);
      this.watchCoolant(dt, unit, w, view);
      this.watchSpit(unit);
      this.watchHistory(dt, unit, w, view);
      this.watchQuirks(dt, unit, w, view);
      // Cranking on and on without it catching.
      if (e.state === 'cranking' && w.cranking > 5 && near) {
        this.say(this.crankHint(unit), { chance: 0.02 });
      }
      if (e.isRunning && e.temperature < 0.3 && c.fsm.is('idle') && unit.quad.position.distanceTo(this.head) < 4) coldNear = true;
      w.state = e.state;
    }
    this.coldNearTime = coldNear ? this.coldNearTime + dt : 0;
    if (this.coldNearTime > 10) this.say('coldIdleNearby', { chance: 0.01 });
  }

  /** An engine with too little oil ticking, running hot, tightening up and seizing (a two-stroke's mix or a four-stroke's sump), or a two-stroke smoking from too much. */
  watchOil(dt, unit, w, listening) {
    const e = unit.engine;
    if (!listening) return;
    if (e.events.some((x) => x.type === 'seized')) this.say('engineSeized', { urgent: true });
    if (!e.isRunning) return;
    if (e.nip > 0.3) this.say('engineNipping', { urgent: true, chance: 0.05 });
    else if (e.overheat > 0.45) this.say('engineHot', { chance: 0.02 });
    else if (e.tick > 0.4) this.say('engineTicking', { chance: 0.015 });
    if (e.oilRich > 0.5) this.say('oilSmoky', { chance: 0.01 });
  }

  /** A quad running badly on red diesel (when it dies on it, the stall remark above picks the line). */
  watchDiesel(unit, listening) {
    const e = unit.engine;
    if (!listening) return;
    if (e.isRunning && e.dieselSoak > 0.3) this.say('dieselRough', { chance: 0.02 });
  }

  /** A quad coughing on water in its fuel, or one standing with the sediment bowl on its tap full (when it cuts out, the stall remark above picks the line). */
  watchWater(unit, listening) {
    const e = unit.engine;
    if (!listening) return;
    if (e.isRunning && e.fuelWater > 0.3) this.say('waterRough', { chance: 0.02 });
    else if (!e.isRunning && unit.quad.fuel.sediment > 0.9) this.say('waterBowl', { chance: 0.004 });
  }

  /** An air-cooled quad running too hot and pinking, or a hot one that's been switched off ticking as it cools. */
  watchHeat(unit, listening) {
    const e = unit.engine;
    if (!listening) return;
    if (e.params.waterCooled && e.events.some((x) => x.type === 'overheated')) this.say('heatStalled', { urgent: true, chance: 1 });
    else if (e.params.waterCooled && e.isRunning && e.hot > 0.3) this.say('heatHot', { chance: 0.03 });
    else if (e.pink > 0.4) this.say('heatPink', { chance: 0.03 });
    else if (!e.isRunning && e.events.some((x) => x.type === 'coolTick')) this.say('heatTicking', { chance: 0.08 });
  }

  /** A slow puncture, slipping belt, sticking cable, dirty carb, worn engine mounts or a slack chain: she mentions it when it's bad enough for her to notice, and sooner on a quad she's on. */
  watchFaults(unit, w, listening) {
    const f = unit.quad.faults;
    const from = this.companion.params.faultNoticeFrom;
    w.faultSaid ??= {};
    for (const kind of FAULT_KINDS) {
      if (!f.has(kind)) {
        w.faultSaid[kind] = 0;
        continue;
      }
      // Each shows only in its own way: the tyre, belt and chain when it's being ridden, the cable and carb when the engine's going.
      const ridden = kind === 'puncture' || kind === 'clutch' || kind === 'belt' || kind === 'chain' || kind === 'rod' || kind === 'rim';
      const showing = ridden ? Math.abs(unit.quad.forwardSpeed) > 2 : unit.engine.isRunning;
      // A chain that has come off shows when the engine is going and nothing drives: it is a different thing to say.
      const off = kind === 'chain' && f.chainOff && unit.engine.isRunning;
      if (kind === 'valves' && !f.valveLoose) continue; // too-tight valves make no noise: you only feel the hard start and the lost power
      if (!listening || !(showing || off) || f.levels[kind] < from || w.faultSaid[kind] >= 2) continue;
      const hers = unit.quad === this.companion.quad;
      if (this.say(off ? 'faultChainOff' : FAULT_SITUATION[kind], { urgent: hers, chance: hers ? 0.03 : 0.01 })) w.faultSaid[kind] += 1;
    }
  }

  /** A carb iced up (carbIcing.js) shows as a quad losing power at a steady throttle. Amy knows it; Jess thinks it's broken. Twice a spell, then not till it has cleared. */
  watchCarbIce(unit, w, listening) {
    const ice = unit.quad.carbIce;
    if (!ice.icing || ice.ice < 0.4) {
      if (!ice.icing) w.iceSaid = 0;
      return;
    }
    if (!listening || !unit.engine.isRunning || Math.abs(unit.quad.forwardSpeed) < 2 || (w.iceSaid ?? 0) >= 2) return;
    const hers = unit.quad === this.companion.quad;
    if (this.say('carbIcing', { urgent: hers, chance: hers ? 0.03 : 0.01 })) w.iceSaid = (w.iceSaid ?? 0) + 1;
  }

  /** A diesel waxed up in a hard frost (dieselWax.js): it is struggling or won't start. Amy knows it; Jess thinks it has given up. Twice a spell, then not till it has cleared. */
  watchDieselWax(unit, w, listening) {
    const wax = unit.quad.fuel.wax;
    if (wax < 0.45) {
      if (wax < 0.1) w.waxSaid = 0;
      return;
    }
    if (!listening || (w.waxSaid ?? 0) >= 2) return;
    const hers = unit.quad === this.companion.quad;
    if (this.say('dieselWaxed', { urgent: hers, chance: hers ? 0.03 : 0.01 })) w.waxSaid = (w.waxSaid ?? 0) + 1;
  }

  /**
   * Stood by a running quad, she listens and says what she thinks is wrong with it (diagnosis.js). Her guess is
   * only as good as she is; a wrong one is left in `lastDiagnosis` for the game to have her friend put right.
   */
  watchDiagnosis(dt, unit, w) {
    const c = this.companion;
    const e = unit.engine;
    if (!e.isRunning || !c.availability().settled || unit.quad.position.distanceTo(this.head) > 6) return;
    if (this.chatter.time < (w.diagnosedUntil ?? 0)) return;
    const p = c.params;
    const truth = engineCondition(e, p);
    const guess = guessCondition(truth, p.diagnoseAccuracy);
    if (!this.say(DIAGNOSE_SITUATION[guess], { chance: p.diagnoseChance * dt })) return;
    w.diagnosedUntil = this.chatter.time + 120; // once per quad every couple of minutes, so she doesn't keep guessing it
    if (guess !== truth) this.lastDiagnosis = { guesser: c.character.id, guess, truth };
  }

  /** Somebody caning a quad before it's warm: Amy tells off whoever it is (Jess cheers you on). */
  watchThrash(dt, unit, view, listening) {
    const who = view.drivers?.get(unit);
    if (!listening || !who || who === this.companion.character.id) return;
    const p = this.companion.params;
    // A freshly rebuilt engine being caning before it's run in is worse than a cold one, so it's what she picks up on first.
    const runningIn = isThrashedRunningIn(unit.engine, p.thrashWork, unit.engine.params);
    if (!runningIn && !isThrashed(unit.engine, p)) return;
    const situation = (runningIn ? 'thrashRunIn' : 'thrashCold') + (who === 'you' ? 'You' : '');
    this.say(situation, { chance: this.companion.params.thrashChance * dt });
  }

  /** Stood by a quad that's worn, she says who she thinks did it, going by who was really riding it (wearLedger.js). */
  watchBlame(dt, unit, w, view) {
    const c = this.companion;
    if (!view.ledger || !c.availability().settled || unit.quad.position.distanceTo(this.head) > 6) return;
    if (unit.engine.wear < c.params.blameWearFrom || this.chatter.time < (w.blamedUntil ?? 0)) return;
    const culprit = view.ledger.culprit(unit.id);
    if (!culprit) return;
    if (!this.say(`blame${culprit.who === 'you' ? 'You' : culprit.who === 'amy' ? 'Amy' : 'Jess'}`, { chance: c.params.blameChance * dt })) return;
    w.blamedUntil = this.chatter.time + 180;
  }

  /** Stood by a parked quad whose carb has been dripping, she smells the petrol (carbDrip.js). Once per quad every four minutes. */
  watchDrip(dt, unit, w, view) {
    const c = this.companion;
    if (!view.drip || !c.availability().settled || unit.quad.position.distanceTo(this.head) > c.params.dripSmellRange) return;
    if (!view.drip.smells(unit.id) || this.chatter.time < (w.dripUntil ?? 0)) return;
    if (!this.say('dripSmell', { chance: c.params.dripSmellChance * dt })) return;
    w.dripUntil = this.chatter.time + 240;
  }

  /** A cold, lean quad spitting back through its carb (engine/spitBack.js): the girl sat on it jumps and yelps, one nearby just remarks on it. */
  watchSpit(unit) {
    if (!unit.engine.events.some((x) => x.type === 'spitBack')) return;
    const c = this.companion;
    if (c.isSeated && c.quad === unit.quad) {
      c.react('flinch', { from: unit.quad.position });
      this.say('spitBackOn', { urgent: true, chance: 1 });
    } else if (unit.quad.position.distanceTo(this.head) < c.params.spitHearRange) {
      this.say('spitBackNear', { chance: c.params.spitSayChance });
    }
  }

  /**
   * The orange's coolant leak (engine/coolant.js): she notices the damp patch under it when it's parked, says so when it steams, and a
   * boil-over makes her jump back and shout (the steam is a scald, so she gets well clear).
   */
  watchCoolant(dt, unit, w, view) {
    const e = unit.engine;
    if (!e.params.waterCooled) return;
    const c = this.companion;
    const dist = unit.quad.position.distanceTo(this.head);
    if (e.events.some((x) => x.type === 'boilOver') && dist < c.params.coolantJumpRange && !c.isSeated && !c.fsm.is('driving')) {
      c.react('stepBack', { from: unit.quad.position, force: true });
      this.say('coolantBoil', { urgent: true, chance: 1 });
      return;
    }
    if (dist > c.params.coolantSeeRange || this.chatter.time < (w.coolantUntil ?? 0)) return;
    const patch = view.coolantPatches?.get(unit.id);
    if (e.steam > 0.25 && e.isRunning) {
      if (this.say('coolantSteam', { chance: 0.05 })) w.coolantUntil = this.chatter.time + 90;
    } else if (!e.isRunning && patch?.visible && c.availability().settled) {
      if (this.say('coolantDamp', { chance: c.params.dripSmellChance * dt })) w.coolantUntil = this.chatter.time + 240;
    }
  }

  /** Come across a quad idling with nobody on it, she says who left it running, going by who really did (leftRunning.js). */
  watchLeftRunning(dt, unit, w, view) {
    const c = this.companion;
    if (!view.left || !c.availability().settled || unit.quad.position.distanceTo(this.head) > c.params.leftRunningRange) return;
    if (!unit.engine.isRunning || this.chatter.time < (w.leftUntil ?? 0)) return;
    const who = view.left.culprit(unit.id);
    if (!who) return;
    if (!this.say(leftRunningSituation(who, view.left.times(who), view.left.p), { chance: c.params.leftRunningChance * dt })) return;
    w.leftUntil = this.chatter.time + 240;
  }

  /**
   * Stood by a quad, she brings up what she knows of how it came to be as it is (history.js): who had it out, a fault it had
   * already, tinkering left in. What she knows is settled once, as well as her `diagnoseAccuracy` lets her, so Jess is often
   * wrong about who and misses things. Each topic once per quad, and only while it's still true.
   */
  watchHistory(dt, unit, w, view) {
    const history = view.history?.quads[unit.id];
    const c = this.companion;
    if (!history || !c.availability().settled || unit.quad.position.distanceTo(this.head) > 6) return;
    if (this.chatter.time < (w.historyUntil ?? 0)) return;
    this.beliefs ??= {};
    const knows = (this.beliefs[unit.id] ??= girlKnows(history, c.params.diagnoseAccuracy, Math.random));
    w.historySaid ??= new Set();
    const [topic] = historyTopics(knows, history, { faultsNow: (kind) => unit.quad.faults.has(kind), settingsNow: view.history.settingsFor(unit) }, w.historySaid);
    if (!topic || !this.sayQuad(topic, unit.id, { chance: c.params.historyChance * dt })) return;
    w.historySaid.add(topic);
    w.historyUntil = this.chatter.time + 90; // one at a time, so she doesn't read out the whole file
  }

  /**
   * Stood by a quad, or as you get on it, she warns you of a quirk she knows it has (quirks.js), once each. What she knows is
   * settled once per quad as well as her `diagnoseAccuracy` lets her, so Jess misses some and sometimes swears to one it hasn't got.
   */
  watchQuirks(dt, unit, w, view) {
    const c = this.companion;
    const kinds = unit.quad.quirks.kinds;
    const away = unit.quad.position.distanceTo(this.head);
    const boarding = unit === view.ridden && away < 10;
    if (!boarding && !(c.availability().settled && away < 6)) return;
    if (this.chatter.time < (w.quirkUntil ?? 0)) return;
    this.quirkBeliefs ??= {};
    const known = (this.quirkBeliefs[unit.id] ??= girlKnowsQuirks(kinds, applicableQuirks(featuresOf(unit.spec, true)), c.params.diagnoseAccuracy, Math.random));
    w.quirkSaid ??= new Set();
    const kind = known.find((k) => !w.quirkSaid.has(k));
    if (!kind) return;
    const situation = `quirk${kind[0].toUpperCase()}${kind.slice(1)}`;
    if (!this.say(situation, { chance: c.params.quirkChance * dt * (boarding ? 3 : 1) })) return;
    w.quirkSaid.add(kind);
    w.quirkUntil = this.chatter.time + 60;
  }

  /** Which kind of "it won't start" remark fits what she can see. */
  crankHint(unit) {
    const e = unit.engine;
    if (e.dieselSoak > 0.4) return 'dieselNoStart';
    if (e.fuelWater > 0.5) return 'waterNoStart';
    if (e.battery < e.params.batteryWeakBelow) return 'crankStruggleBattery';
    if (e.knack && !e.knack.primed && e.temperature < e.params.knackColdBelow) return 'crankStruggleKnack';
    if (unit.quad.fuel.bowlLevel < 0.3) return 'crankStruggleNoFuel';
    if (e.fouling > 0.4 || e.rich > 0.2) return 'crankStruggleFlooded';
    if (e.temperature < 0.4 && unit.quad.choke < 0.5) return 'crankStruggleCold';
    return 'crankStruggle';
  }

  /** What the day's like: a word about it early on, and when the rain comes and goes. */
  watchWeather(dt, weather) {
    if (!weather) return;
    this.weatherTime = (this.weatherTime ?? 0) + dt;
    if (!this.weatherSaid && this.weatherTime > (this.weatherAt ??= 12 + Math.random() * 40)) {
      this.weatherSaid = true;
      // The temperature is worth a word when it's frosty, cold or warm (and the rain still comes first); a mild day says nothing of it.
      const temperature = { frosty: 'frost', cold: 'cold', warm: 'warm' }[weather.band];
      const kind = weather.storm > 0.5 ? 'storm' : weather.rain > 0.25 ? 'raining' : temperature ?? ({ sunny: 'sunny', fair: 'sunny', fog: 'fog' }[weather.kind] ?? 'grey');
      const situation = { sunny: 'weatherSunny', raining: 'weatherRain', storm: 'weatherStorm', fog: 'weatherFog', grey: 'weatherGrey', frost: 'weatherFrost', cold: 'weatherCold', warm: 'weatherWarm' }[kind];
      this.say(situation, { chance: 0.75 });
    }
    // The board in the barn (world/forecast.js): a word on what it says, a while after the weather's been mentioned.
    if (this.weatherSaid && !this.forecastSaid && weather.promise && this.weatherTime > this.weatherAt + 20) {
      this.forecastSaid = true;
      this.say(weather.promise.worse ? 'forecastWorse' : 'forecastBetter', { chance: this.params.forecastChat });
    }
    // The weather turning: a word once the sky has started to change, and when the board never said it would.
    const turning = weather.turning;
    if (turning && turning !== this.turnSeen && weather.mix > 0.3) {
      this.turnSeen = turning;
      const said = this.say(turning.worse ? 'turningWorse' : 'turningBetter', { chance: turning.told ? 0.6 : 0.2 });
      if (!said && !turning.told) this.say('forecastMissed', { chance: 0.5 });
    }
    const raining = weather.rain > 0.25;
    if (raining && this.wasRaining === false) this.say('rainStarts', { urgent: true, chance: 0.9 });
    if (!raining && this.wasRaining && weather.rain < 0.1) this.say('rainStops', { chance: 0.7 });
    if (raining || weather.rain < 0.1) this.wasRaining = raining;
    // Out in it a while, the odd grumble.
    this.rainTime = raining ? (this.rainTime ?? 0) + dt : 0;
    if (this.rainTime > 60) this.say('stillRaining', { chance: 0.004 });
    // The day going (world/daylight.js): a word as the light goes, and out in the dark, now and then, that she'd like to go in.
    const dark = weather.dark ?? 0;
    if (dark > 0.25 && dark < 0.8 && !this.duskSaid) this.duskSaid = !!this.say('gettingDark', { chance: 0.9 });
    if (dark > 0.85 && !this.companion.coveredNow) this.say('darkGoIn', { chance: 0.003 });
  }

  /** Picks a line for the situation and says it; returns what was said, or null. */
  /**
   * Says a line about a quad (a kind from quadLines.js), calling it by its nickname if she'd use it, else by its
   * colour. Amy holds out on the nicknames for a while, then slips (`slipped`, which the game answers).
   */
  sayQuad(kind, specId, opts) {
    const girl = this.companion.character?.id;
    const how = this.names?.refer(girl, specId) ?? { nick: null, slip: false };
    const line = this.say(quadKey(kind, specId, how.nick), opts);
    if (!line) return null;
    this.names?.mentioned(girl, specId, how);
    if (how.slip) this.slipped = true;
    return line;
  }

  say(situation, opts) {
    // Someone else is talking (or they're bickering): unprompted chatter waits its turn.
    // `waitTurn` is urgent (no quiet gap) but still lets the other girl finish: her own plans, said as she sets off.
    if (this.floor.left > 0 && !opts?.force && (!opts?.urgent || opts?.waitTurn)) return null;
    if (this.floor.banter && !opts?.force) return null;
    // Asleep on the back she says nothing, whatever else is going on (the wake-up lines are forced).
    if (this.companion.nap?.asleep && !opts?.force) return null;
    const line = this.chatter.pick(situation, opts);
    if (!line) return null;
    return this.speak(line, { shout: !!this.chatter.lines[situation]?.shout }) === null ? null : line;
  }

  /**
   * Says one particular line (or plays a { sound }) now, cutting off whatever
   * she was saying. Returns how long it lasts in seconds, 0 if nobody could hear
   * it, or null if a sound hadn't loaded.
   */
  speak(line, { shout = false } = {}) {
    const p = this.params;
    const sp = this.soundParams;
    const distance = this.head.distanceTo(this.listener);
    // Like anyone, she raises her voice the further away you are, and some things she shouts.
    const raise = Math.min(p.voiceRaiseMax, 1 + Math.max(0, distance - 4) * p.voiceRaisePerMetre) * (shout ? p.shoutGain : 1);
    const voice = { rolloff: shout ? 0.6 : 1.2 };
    let seconds;
    if (typeof line === 'string') {
      const hearing = this.hearing(shout);
      if (hearing <= 0) return 0; // out of earshot: she said it, nobody heard
      this.speech.stop();
      seconds = this.sounds.say(line, this.head, p.voiceVolume * raise, voice);
      if (!seconds) {
        // Not recorded yet: the browser's voice, if it has a woman's, else just the caption.
        seconds = Speech.duration(line, p.speechRate);
        const volume = sp.muted ? 0 : p.voiceVolume * Math.min(1, sp.masterVolume) * hearing;
        this.speech.say(line, { volume, rate: p.speechRate, pitch: p.speechPitch });
      }
      this.caption(`${this.name ? `${this.name}: ` : ''}“${line}”`, seconds + 0.8);
    } else {
      this.speech.stop();
      seconds = this.sounds.play(line.sound, this.head, p.voiceSoundVolume * raise, voice);
      if (!seconds) return null; // not loaded yet
      if (this.hearing(shout) > 0.2 && SOUND_CAPTIONS[line.sound]) this.caption(`${this.name ? `${this.name}: ` : ''}${SOUND_CAPTIONS[line.sound]}`, seconds + 0.4);
    }
    this.chatter.holdFor(seconds);
    this.floor.left = Math.max(this.floor.left, seconds + 1);
    return seconds;
  }

  /** Stops mid-word (caught talking about you). */
  cut() {
    this.speech.stop();
    this.sounds.stop();
    this.chatter.holdFor(0);
  }

  /** 1 close by, fading to 0 at the edge of earshot. A shout carries twice as far. */
  hearing(shout = false) {
    const d = this.head.distanceTo(this.listener);
    const range = this.params.voiceRange * (shout ? 2 : 1);
    return Math.max(0, Math.min(1, 1 - (d - 3) / (range - 3)));
  }

  caption(text, seconds) {
    if (this.params.captions && text) this.hud.caption(text, seconds);
  }
}
