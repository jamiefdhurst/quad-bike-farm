import * as THREE from 'three';
import { Chatter } from './chatter.js';
import { VOICE_LINES } from './voiceLines.js';
import { Speech } from '../audio/companionAudio.js';

// Captions for her recorded sounds.
const SOUND_CAPTIONS = { sigh: '(sighs)', hum: '(hums)', laugh: '(laughs)', yawn: '(yawns)', gasp: '(gasps)', hmm: 'Hmm?', oh: 'Oh.' };

/**
 * Watches what's going on around her and has her say something about it now
 * and then: riding pillion (fun, rough, too fast, hard braking, stalls), you
 * struggling to start a quad near her (with a hint if she can tell why), being
 * left waiting, being left behind, and answering when you ask her something.
 * Which line, and whether she bothers, is up to the Chatter.
 */
export class CompanionVoice {
  constructor({ companion, speech, sounds, hud, params, soundParams }) {
    this.companion = companion;
    this.speech = speech;
    this.sounds = sounds;
    this.hud = hud;
    this.params = params;
    this.soundParams = soundParams;
    this.chatter = new Chatter(VOICE_LINES, { minGap: params.voiceMinGap, chattiness: params.chattiness });

    this.head = new THREE.Vector3();
    this.checkTimer = 0;
    this.prevSpeed = 0;
    this.decel = 0;
    this.prevVy = 0;
    this.jolt = 0;
    this.fastTime = 0;
    this.funTime = 0;
    this.gentleTime = 0;
    this.rideTime = 0;
    this.nearTime = 0;
    this.wasTogether = false;
    this.shake = 0; // how hard her seat is shaking, smoothed
    this.shakeTime = 0;
    this.seatedShakeTime = 0;
    this.seatTime = 0; // on the same quad with you, moving
    this.favourite = null; // spec id of the quad she likes best, picked once the quads are known
    this.favouriteSaid = false;
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

  /** She was asked to do something from the menu. */
  onRequest(kind) {
    const SAY = { mount: 'ackMount', start: 'ackStart', drive: 'ackDrive', back: 'ackBack', stopDrive: 'ackStopDrive', letOff: 'ackLetOff', keepOn: 'ackKeepOn', giveRide: 'ackGiveRide', passengerOn: 'passengerOn', letMeOff: 'ackLetMeOff', stopHere: 'ackStopHere', slower: 'ackSlower', faster: 'ackFaster', goAgain: 'ackGoAgain', swap: 'ackSwap' };
    this.say(SAY[kind] ?? 'ackStand', { force: true });
  }

  /**
   * You tinkering with a quad from the toolbox (raised by workshop.js): 'open',
   * 'adjust', 'limiter' (de-restricting it), 'stock', or 'fast' (asked every
   * frame while riding her quicker than a de-restricted quad used to go). She
   * only remarks on what she can see. Returns what she said, if anything.
   */
  onTinker(kind) {
    const [situation, chance] = { open: ['tinkerOpen', 0.6], adjust: ['tinker', 0.25], limiter: ['tinkerLimiter', 0.9], stock: ['tinkerStock', 0.6], service: ['tinkerService', 0.8], fast: ['tunedFast', 0.02] }[kind] ?? [];
    if (!situation || this.head.distanceTo(this.listener) > Math.min(15, this.params.voiceRange)) return null;
    return this.say(situation, { urgent: true, chance });
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

    // Talking to her.
    if (view.menuOpen && !this.wasMenuOpen) this.say('talkTo', { force: true, chance: 0.6 });
    this.wasMenuOpen = view.menuOpen;

    // You getting on in front of her.
    if (together && !this.wasTogether) this.say('mountedTogether', { urgent: true, chance: 0.7 });
    this.wasTogether = together;

    // Riding pillion: track speed, braking and jolting every frame.
    if (together) {
      const quad = ridden.quad;
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

      if (this.decel > 6 && speed > 4) this.say('hardBrake', { urgent: true });
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
      this.fastTime = 0;
      this.funTime = 0;
      this.gentleTime = 0;
      this.stoppedTime = 10;
    }

    this.watchGhostRide(dt, together);
    this.watchStarting();
    this.watchOwnMind();
    this.watchDriving(dt);
    this.watchEngines(dt, view, together, distance);
    this.watchSeat(dt, view, together);

    // Slower checks, once a second.
    this.checkTimer -= dt;
    if (this.checkTimer > 0) return;
    const step = 1 - this.checkTimer;
    this.checkTimer = 1;

    if (together) {
      if (this.funTime > 8) this.say('rideFun', { chance: 0.35 });
      else if (this.gentleTime > 10) this.say('rideGentle', { chance: 0.3 });
      if (this.rideTime > 150) this.say('rideLong', { chance: 0.15 });
    }

    // Stood next to you, both on foot: the odd warm word.
    const standing = c.fsm.is('idle');
    const close = standing && !ridden && distance < 4 && !view.menuOpen;
    this.nearTime = close ? this.nearTime + step : 0;
    if (this.nearTime > 8) this.say('nearbyWarm', { chance: 0.08 });

    // Standing about with nothing happening.
    const waitingSeated = c.isSeated && !together;
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
    this.favourite ??= view.units[Math.floor(Math.random() * view.units.length)]?.spec.id ?? null;
    const unit = c.quad.unit;
    if (!c.isSeated || !unit?.engine.isRunning) {
      this.shake = 0;
      this.shakeTime = 0;
      this.seatedShakeTime = 0;
      if (!c.isSeated) {
        this.seatTime = 0;
        this.favouriteSaid = false;
      }
      return;
    }
    const b = unit.vibration.body;
    const now = Math.hypot(b.heave * 100, b.pitch * 57.3, b.roll * 57.3);
    this.shake += (now * now - this.shake) * Math.min(1, dt / 1.5);
    const bad = Math.sqrt(this.shake) > p.voiceShakeLevel;
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
      const cap = (s) => s[0].toUpperCase() + s.slice(1);
      const situation = id === this.favourite ? `like${cap(id)}` : `prefer${cap(this.favourite)}`;
      if (this.say(situation, { chance: 0.01 })) this.favouriteSaid = true;
    }
  }

  /** You jumped off and left her on a quad that's driving itself. */
  watchGhostRide(dt, together) {
    const c = this.companion;
    if (c.isSeated && c.quad.isGhostRiding && !together) {
      // Each time, she's either terrified or having the time of her life.
      if (this.ghostTime === 0) this.ghostFun = Math.random() < this.params.ghostFunChance;
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

  /** Says what she's up to when she decides to do something on her own. */
  watchOwnMind() {
    const events = this.companion.selfEvents;
    // Switching a quad off is rare, so she always mentions it.
    for (const e of events) this.say({ wander: 'selfWander', mount: 'selfMount', start: 'selfStart', drive: 'selfDrive', keyOff: 'selfKeyOff', askOff: 'askOff', askStop: 'askStop' }[e], { urgent: true, chance: e === 'keyOff' || e === 'askOff' ? 1 : 0.8 });
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
      'done:bored': ['driveBored', 0.9],
      'done:scared': ['driveScared', 0.9],
      'done:gaveUp': ['driveGaveUp', 0.9],
      toBack: ['driveToBack', 0.8],
      getOff: ['driveGetOff', 0.5],
      taken: ['driveTaken', 1],
    };
    const mood = c.driveMood ?? 0.5;
    for (const e of events) {
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
    };
    for (const e of events) {
      if (e === 'crank') {
        const a = this.companion.attempt ?? this.companion.drive?.attempt;
        if (a && a.bursts > 1) this.say('startCrank', { urgent: true, chance: 0.6 });
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
        this.say(e.lastStallReason === 'noFuel' ? 'outOfFuel' : 'stalledRiding', { urgent: true, chance: 0.8 });
      }
      if (w.state !== 'running' && e.isRunning) {
        if (w.cranking > 5 && near) this.say('caughtAfterStruggle', { urgent: true, chance: 0.8 });
        w.cranking = 0;
      }
      if (e.state === 'off') w.cranking = 0;
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

  /** Which kind of "it won't start" remark fits what she can see. */
  crankHint(unit) {
    const e = unit.engine;
    if (unit.quad.fuel.bowlLevel < 0.3) return 'crankStruggleNoFuel';
    if (e.fouling > 0.4 || e.rich > 0.2) return 'crankStruggleFlooded';
    if (e.temperature < 0.4 && unit.quad.choke < 0.5) return 'crankStruggleCold';
    return 'crankStruggle';
  }

  /** Picks a line for the situation and says it; returns what was said, or null. */
  say(situation, opts) {
    const line = this.chatter.pick(situation, opts);
    if (!line) return null;
    const p = this.params;
    const sp = this.soundParams;
    const shout = !!this.chatter.lines[situation]?.shout;
    const distance = this.head.distanceTo(this.listener);
    // Like anyone, she raises her voice the further away you are, and some things she shouts.
    const raise = Math.min(p.voiceRaiseMax, 1 + Math.max(0, distance - 4) * p.voiceRaisePerMetre) * (shout ? p.shoutGain : 1);
    const voice = { rolloff: shout ? 0.6 : 1.2 };
    let seconds;
    if (typeof line === 'string') {
      const hearing = this.hearing(shout);
      if (hearing <= 0) return line; // out of earshot: she said it, nobody heard
      this.speech.stop();
      seconds = this.sounds.say(line, this.head, p.voiceVolume * raise, voice);
      if (!seconds) {
        // Not recorded yet: the browser's voice, if it has a woman's, else just the caption.
        seconds = Speech.duration(line, p.speechRate);
        const volume = sp.muted ? 0 : p.voiceVolume * Math.min(1, sp.masterVolume) * hearing;
        this.speech.say(line, { volume, rate: p.speechRate, pitch: p.speechPitch });
      }
      this.caption(`“${line}”`, seconds + 0.8);
    } else {
      this.speech.stop();
      seconds = this.sounds.play(line.sound, this.head, p.voiceSoundVolume * raise, voice);
      if (!seconds) return null; // not loaded yet
      if (this.hearing(shout) > 0.2) this.caption(SOUND_CAPTIONS[line.sound] ?? '', seconds + 0.4);
    }
    this.chatter.holdFor(seconds);
    return line;
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
