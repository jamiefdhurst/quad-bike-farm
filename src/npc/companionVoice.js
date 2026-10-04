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
    this.stoppedTime = 0;
    this.idleTime = 0;
    this.awayTime = 0;
    this.leftBehindSaid = false;
    this.engineWatch = new Map(); // unit -> { state, cranking }
    this.coldNearTime = 0;
    this.pouredNear = false;
    this.wasMenuOpen = false;
    this.listener = new THREE.Vector3();
  }

  /** She was asked to do something from the menu. */
  onRequest(kind) {
    this.say(kind === 'mount' ? 'ackMount' : 'ackStand', { force: true });
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
      if (speed > 1.5 && this.stoppedTime > 4) this.say('rideStart', { chance: 0.7 });
      this.stoppedTime = speed < 0.5 ? this.stoppedTime + dt : 0;
    } else {
      this.prevSpeed = 0;
      this.prevVy = 0;
      this.jolt = 0;
      this.decel = 0;
      this.fastTime = 0;
      this.funTime = 0;
      this.stoppedTime = 10;
    }

    this.watchEngines(dt, view, together, distance);

    // Slower checks, once a second.
    this.checkTimer -= dt;
    if (this.checkTimer > 0) return;
    const step = 1 - this.checkTimer;
    this.checkTimer = 1;

    if (together && this.funTime > 8) this.say('rideFun', { chance: 0.35 });

    // Standing about with nothing happening.
    const standing = c.fsm.is('idle');
    const waitingSeated = c.isSeated && !together;
    this.idleTime = (standing || waitingSeated) && !view.menuOpen ? this.idleTime + step : 0;
    if (this.idleTime > p.voiceWaitAfter && distance < p.voiceRange && this.chatter.sinceSpoke > p.voiceWaitAfter) {
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

  /** Stalls, long cranking and catching at last, for quads near her. */
  watchEngines(dt, view, together, distance) {
    const c = this.companion;
    let coldNear = false;
    for (const unit of view.units) {
      const e = unit.engine;
      const w = this.engineWatch.get(unit) ?? { state: e.state, cranking: 0 };
      this.engineWatch.set(unit, w);
      const near = unit.quad.position.distanceTo(this.head) < 15 && distance < this.params.voiceRange;
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
    let seconds;
    if (typeof line === 'string') {
      seconds = Speech.duration(line, p.speechRate);
      const hearing = this.hearing();
      if (hearing > 0) {
        const volume = sp.muted ? 0 : p.voiceVolume * Math.min(1, sp.masterVolume) * hearing;
        this.speech.say(line, { volume, rate: p.speechRate, pitch: p.speechPitch });
        this.caption(`“${line}”`, seconds + 0.8);
      }
    } else {
      seconds = this.sounds.play(line.sound, this.head, p.voiceSoundVolume);
      if (!seconds) return null; // not loaded yet
      if (this.hearing() > 0.2) this.caption(SOUND_CAPTIONS[line.sound] ?? '', seconds + 0.4);
    }
    this.chatter.holdFor(seconds);
    return line;
  }

  /** 1 close by, fading to 0 at the edge of earshot. */
  hearing() {
    const d = this.head.distanceTo(this.listener);
    const range = this.params.voiceRange;
    return Math.max(0, Math.min(1, 1 - (d - 3) / (range - 3)));
  }

  caption(text, seconds) {
    if (this.params.captions && text) this.hud.caption(text, seconds);
  }
}
