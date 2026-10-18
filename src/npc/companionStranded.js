import { DEFAULT_STRANDED_PARAMS, Stranded } from './stranded.js';
import { StrandedWait } from './strandedWait.js';

// A girl stuck out in the field waving for you (stranded.js says when she shouts and what the help was worth). Bogged, she stays up on her quad,
// stood on the footboards; tipped, she has climbed out and stands beside it. As Companion methods, mixed in by companion.js. game.js hears what
// happens through `strandedHost(girl, event)`.

export const strandedMethods = {
  get strandedP() {
    return this.strandedParams ?? DEFAULT_STRANDED_PARAMS;
  },

  /** Metres from you to her quad. */
  strandedYouDist() {
    const v = this.viewer;
    const q = this.quad.position;
    return v ? Math.hypot(v.position.x - q.x, v.position.z - q.z) : Infinity;
  },

  /** She has given up on the mud: she stays on, stood up on the footboards, and waves. Run by the driving state in place of her own driving. */
  beginBogCall() {
    const q = this.quad;
    const params = this.strandedP;
    this.stranded = new Stranded('bog', q.position, params);
    this.drive = new StrandedWait(q, { params, model: this.stranded, you: () => this.strandedYouDist(), onEvent: (e) => this.strandedHost?.(this, e) });
    q.setDriver(this.drive);
    this.rig.play('Idle', { fade: 0.4 });
    this.rig.legSpread = 0;
    this.startCalling();
    this.hold('stranded', 'stuck in a bog, calling for help');
  },

  /** She has tipped it and climbed out: she stands by it and waves. */
  beginTipCall() {
    this.stranded = new Stranded('tipped', this.quad.position, this.strandedP);
    this.startCalling();
    this.hold('stranded', 'tipped her quad, calling for help');
  },

  /** Over (rescued, given up, you took over, or something else had her): back to sitting if she was stood on the quad, and the hold is let go. */
  endCall() {
    if (!this.stranded) return;
    if (this.stranded.kind === 'bog' && this.fsm.is('driving')) this.rig.play('SitIdle', { fade: 0.3 });
    this.stranded = null;
    if (this.waving?.call) this.waving = null;
    this.release('stranded');
  },

  /** Where she stands on the footboards, in the quad's frame: over where she sits, her feet where they hang. */
  standOffset() {
    const o = this.seatOffset(true);
    o.y += this.strandedP.standRaise;
    return o;
  },

  /** While she is stood beside a tipped quad: the shouts and what the help was worth. Her bogged call runs inside her drive. */
  updateTipCall(dt) {
    const s = this.stranded;
    if (!s || s.kind !== 'tipped') return;
    // Something else had her (you asked her to do something, she walked off): the call is over.
    if (!this.fsm.is('idle') || !this.waving?.call) return this.endCall();
    for (const e of s.update(dt, { youDist: this.strandedYouDist(), freed: !this.quad.isTipped })) this.strandedHost?.(this, e);
    if (s.done) this.endCall();
  },
};
