// A girl up on the footboards of her bogged quad, waving for help (stranded.js keeps her time and her shouts). It has the shape of HerDrive
// (controls, update, stop, done, result) so the driving state runs it in place once she has given up on the mud. She holds the brake off and
// the throttle shut until something pulls or pushes the quad (the winch, the chain, you shoving), and then she works the throttle.

export class StrandedWait {
  /** @param {object} opts.params  DEFAULT_STRANDED_PARAMS  @param {object} opts.model  the Stranded  @param {Function} opts.you  () => metres from you to her quad */
  constructor(quad, { params, model, you, onEvent }) {
    this.quad = quad;
    this.p = params;
    this.model = model;
    this.you = you;
    this.onEvent = onEvent;
    this.controls = { throttle: 0, brake: 0, steer: 0, starter: false, reverse: false };
    this.stranded = model; // quad.js checks this to let a shove loosen the mud with her at the controls
    this.done = false;
    this.result = null;
    this.towing = false;
    this.follow = null;
    this.park = null;
    this.race = null;
    this.events = [];
  }

  coachable() {
    return [];
  }

  isMoment() {
    return false;
  }

  endActivity() {}

  stop(reason = 'asked') {
    this.finish(reason);
  }

  finish(result) {
    if (this.done) return;
    this.done = true;
    this.result = result;
    this.controls.throttle = 0;
    this.controls.brake = 1;
    this.quad.bog.fake = false; // the debug panel's pretend bog goes when the call is over
  }

  /** The quad is being hauled or shoved right now. */
  get helped() {
    return this.quad.towed || this.quad.pushLeft > 0.5;
  }

  update(dt) {
    const out = this.events;
    out.length = 0;
    if (this.done) return out;
    const q = this.quad;
    this.model.helped = this.helped;
    const freed = q.bog.sink < this.p.freeSink;
    for (const e of this.model.update(dt, { youDist: this.you(), freed })) this.onEvent?.(e);
    if (this.model.done) {
      this.finish(this.model.done === 'rescued' ? 'rescued' : 'gaveUp');
      return out;
    }
    this.controls.throttle = this.helped ? this.p.pushThrottle : 0;
    this.controls.brake = 0;
    return out;
  }
}
