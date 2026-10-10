import { sickness, sickEvidence, KeepAlive, DEFAULT_KEEPALIVE_PARAMS } from './keepAlive.js';

// Her sat on the back of a sick quad with a hand on the throttle (keepAlive.js decides when and how). As Companion methods, mixed in
// by companion.js; she is in the seated state, so everything that works on a girl on the back still does.

export const keepAliveMethods = {
  /** The shared numbers (the game hands the girls one object, so the tuning panel moves both). */
  get keepAliveParams() {
    return this.keepParams ?? DEFAULT_KEEPALIVE_PARAMS;
  },

  /** Her hand on the throttle, made the first time it is wanted. */
  get keepAlive() {
    this._keepAlive ??= new KeepAlive({ params: this.keepAliveParams });
    return this._keepAlive;
  },

  /** How sick the quad she is at is, from what she can tell about it (keepAlive.js sickness()). */
  quadSickness(quad = this.quad) {
    return sickness(sickEvidence(quad), this.keepAliveParams);
  },

  /** Whether she has a hand on the throttle right now. */
  get holdingIdle() {
    return this._keepAlive?.holding ?? false;
  },

  /**
   * Called each step while she is sat on the back. Returns true while she is keeping it alive, so she doesn't also reach for the key.
   * She gets off after a long sit with nobody coming, and lets go (maybe losing it) when you take it.
   */
  holdIdle(dt) {
    const q = this.quad;
    const e = q.engine;
    const ka = this.keepAlive;
    const sick = this.quadSickness(q);
    const you = this.viewer?.position ?? null;
    const events = ka.update(dt, {
      id: this.character.id,
      running: e.isRunning,
      sick: sick.sick,
      score: sick.score,
      battery: e.battery,
      unattended: !q.rider && !q.driver && !q.isGhostRiding && q.speed < 0.3,
      rpm: e.rpm,
      idleRpm: e.params.idleRpmWarm,
      youDistance: you ? this.root.position.distanceTo(you) : Infinity,
    });
    for (const ev of events) {
      if (ev.type === 'sit') this.selfEvents.push(ev.charging ? 'keepCharge' : 'keepSit');
      else if (ev.type === 'charged') this.selfEvents.push('keepCharged');
      else if (ev.type === 'truth') this.selfEvents.push('keepTruth');
      else if (ev.type === 'died') this.selfEvents.push('keepDied');
      else if (ev.type === 'letGo' && ev.stalls) {
        e.stall('letGo');
        this.selfEvents.push('keepDied');
      } else if (ev.type === 'giveUp') {
        if (ev.keyOff) {
          e.setIgnition(false);
          this.selfEvents.push('keyOff');
        } else {
          this.selfEvents.push('keepGiveUp');
          if (ev.stalls) e.stall('letGo');
        }
        this.fsm.transition('dismounting');
      }
    }
    if (ka.holding) q.helperThrottle = ka.throttle;
    else if (this.heldThrottleLast) q.helperThrottle = 0;
    this.heldThrottleLast = ka.holding;
    return ka.holding;
  },

  /** Off the seat or taken away: lets go of the throttle, and a sick one may die without her hand on it. */
  releaseIdle() {
    const ka = this._keepAlive;
    if (!ka?.holding) return;
    const q = this.quad;
    const sick = this.quadSickness(q);
    const stalls = q.engine.isRunning && ka.heldFor >= this.keepAliveParams.letGoAfter && Math.random() < this.keepAliveParams.letGoStall * sick.score;
    ka.reset();
    this.heldThrottleLast = false;
    q.helperThrottle = 0;
    if (stalls) {
      q.engine.stall('letGo');
      this.selfEvents.push('keepDied');
    }
  },
};
