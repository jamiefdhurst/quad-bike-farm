// A girl who likes you a lot asks you round the back of the barn. Do it twice and she asks for the second kind of
// moment on her favourite quad, her sat on the back and you stood beside her; after that she is yours for the rest
// of the game, until you do something really bad (throw her off a quad). Only one girl can be locked in.
// Pure logic: the game feeds it who is near and how much she likes you, and acts on the events it returns.
// Nothing is shown beyond a fade to black and what she says.

export const DEFAULT_ROMANCE_PARAMS = {
  startAfter: 300, // seconds into the game before anyone asks
  minScore: 12, // her favour score must be at least this, and she must be the favoured one
  nearRange: 9, // metres: she only asks when you're stood about this close, on foot
  cooldown: 420, // seconds between her invitations
  declineCooldown: 600, // seconds before she asks again after you say not now
  lapseAfter: 75, // seconds an invitation stays open (the quad one gets lapseQuadExtra more, she has to walk there)
  lapseQuadExtra: 60,
  visitsForQuad: 2, // trips round the back before she asks for the quad
  lockScore: 15, // once locked in her favour never drops below this
  betrayScore: -8, // her favour when you throw her off a quad
  betrayedCooldown: 1500, // seconds before she can ask again after that
  quadRange: 3.5, // metres: you have to be this close to the quad she's sat on
  fadeOut: 1.0, // seconds to go to black at the start
  fadeIn: 1.2, // seconds to come back to the scene
  hold: 4, // seconds of the scene itself
  darkOut: 1.5, // seconds to fade to black at the end
  black: 3, // seconds of black, behind the barn
  quadDarkOut: 2.5, // the quad is longer all round
  quadBlack: 6,
  quadFadeIn: 2.5,
};

export const ROMANCE_PARAM_RANGES = {
  startAfter: [0, 1800, 10],
  minScore: [0, 20, 0.5],
  nearRange: [3, 20, 0.5],
  cooldown: [30, 1800, 10],
  declineCooldown: [30, 3600, 10],
  lapseAfter: [10, 300, 5],
  lapseQuadExtra: [0, 300, 5],
  visitsForQuad: [1, 6, 1],
  lockScore: [0, 20, 0.5],
  betrayScore: [-20, 0, 0.5],
  betrayedCooldown: [60, 3600, 30],
  quadRange: [1.5, 8, 0.1],
  fadeOut: [0.2, 4, 0.1],
  fadeIn: [0.2, 4, 0.1],
  hold: [1, 15, 0.5],
  darkOut: [0.2, 6, 0.1],
  black: [0.5, 15, 0.5],
  quadDarkOut: [0.2, 8, 0.1],
  quadBlack: [0.5, 20, 0.5],
  quadFadeIn: [0.2, 8, 0.1],
};

export class Romance {
  /** @param {string[]} ids  The girls, by character id. */
  constructor(ids, params = { ...DEFAULT_ROMANCE_PARAMS }) {
    this.p = params;
    this.ids = ids;
    this.clock = 0;
    this.girls = Object.fromEntries(ids.map((id) => [id, { visits: 0, locked: false, pending: null, nextInvite: 0 }]));
  }

  /** The girl you're locked in with, if any. */
  get lockedGirl() {
    return this.ids.find((id) => this.girls[id].locked) ?? null;
  }

  /** Her open invitation, { kind: 'barn' | 'quad', until }, or null. */
  pendingFor(id) {
    return this.girls[id]?.pending ?? null;
  }

  /** The kind of invitation she would make next. */
  nextKind(id) {
    return this.girls[id].visits >= this.p.visitsForQuad ? 'quad' : 'barn';
  }

  /**
   * ctx.girls: [{ id, score, favoured, free, distance, fallenOut, quadOk }]; ctx.youFree: on foot with nothing else going on.
   * Returns events: { type: 'invite', girl, kind } and { type: 'lapsed', girl, kind }.
   */
  update(dt, ctx) {
    this.clock += dt;
    const events = [];
    for (const id of this.ids) {
      const g = this.girls[id];
      if (g.pending && this.clock >= g.pending.until) {
        events.push({ type: 'lapsed', girl: id, kind: g.pending.kind });
        g.nextInvite = this.clock + this.p.cooldown;
        g.pending = null;
      }
    }
    if (this.clock < this.p.startAfter || !ctx.youFree || this.ids.some((id) => this.girls[id].pending)) return events;
    const locked = this.lockedGirl;
    for (const c of ctx.girls) {
      const g = this.girls[c.id];
      if (!g || g.locked || locked || this.clock < g.nextInvite) continue;
      if (!c.free || c.fallenOut || !c.favoured || c.score < this.p.minScore || c.distance > this.p.nearRange) continue;
      const kind = this.nextKind(c.id);
      if (kind === 'quad' && !c.quadOk) continue;
      const extra = kind === 'quad' ? this.p.lapseQuadExtra : 0;
      g.pending = { kind, until: this.clock + this.p.lapseAfter + extra };
      events.push({ type: 'invite', girl: c.id, kind });
      break;
    }
    return events;
  }

  /** She asks you now, whatever her score or the cooldown (the debug panel). Returns the invite event, or null if one is already open or she is locked in. */
  invite(id, kind = this.nextKind(id)) {
    const g = this.girls[id];
    if (!g || g.pending) return null;
    const extra = kind === 'quad' ? this.p.lapseQuadExtra : 0;
    g.pending = { kind, until: this.clock + this.p.lapseAfter + extra };
    return { type: 'invite', girl: id, kind };
  }

  /** You said yes: the invitation can't lapse in the middle of it. */
  accept(id) {
    const g = this.girls[id];
    if (g?.pending) g.pending.until = Infinity;
  }

  /** You said not now. */
  decline(id) {
    const g = this.girls[id];
    if (!g?.pending) return;
    g.pending = null;
    g.nextInvite = this.clock + this.p.declineCooldown;
  }

  /** The invitation couldn't happen (her quad was taken, say): try again fairly soon. */
  cancel(id) {
    const g = this.girls[id];
    if (!g?.pending) return;
    g.pending = null;
    g.nextInvite = this.clock + 60;
  }

  /** The scene has played out. Returns { type: 'visit', visits } or { type: 'lockedIn' }. */
  complete(id) {
    const g = this.girls[id];
    const kind = g.pending?.kind;
    g.pending = null;
    g.nextInvite = this.clock + this.p.cooldown;
    if (kind === 'quad') {
      g.locked = true;
      return { type: 'lockedIn' };
    }
    g.visits += 1;
    return { type: 'visit', visits: g.visits };
  }

  /** You did something really bad to the girl you're locked in with. She's off you for a long time and it starts again from nothing. */
  betray(id) {
    const g = this.girls[id];
    if (!g?.locked) return false;
    g.locked = false;
    g.visits = 0;
    g.pending = null;
    g.nextInvite = this.clock + this.p.betrayedCooldown;
    return true;
  }
}

/**
 * The scene itself, as a timeline of fades. Fade to black, 'place' (the game puts you where it happens), fade in, a few
 * seconds of the scene ('moment': she says her line), fade out again, black, 'back' (she says hers as it fades in), done.
 * The quad's is longer. `fade` is the black overlay's opacity.
 */
export class Tryst {
  constructor(girl, kind, params = { ...DEFAULT_ROMANCE_PARAMS }) {
    const p = params;
    const quad = kind === 'quad';
    this.girl = girl;
    this.kind = kind;
    this.fade = 0;
    this.done = false;
    // [name, seconds, fade from, fade to, event at the start]
    this.segments = [
      ['out', p.fadeOut, 0, 1, null],
      ['black0', 0.3, 1, 1, 'place'],
      ['in', p.fadeIn, 1, 0, null],
      ['hold', p.hold, 0, 0, 'moment'],
      ['dark', quad ? p.quadDarkOut : p.darkOut, 0, 1, null],
      ['black', quad ? p.quadBlack : p.black, 1, 1, null],
      ['back', quad ? p.quadFadeIn : p.fadeIn, 1, 0, 'back'],
    ];
    this.index = 0;
    this.t = 0;
    this.started = false;
  }

  /** Advances and returns the events that fired ('place', 'moment', 'back', 'done'). */
  update(dt) {
    const events = [];
    if (this.done) return events;
    let left = dt;
    while (!this.done) {
      const [, length, from, to, event] = this.segments[this.index];
      if (!this.started) {
        this.started = true;
        if (event) events.push(event);
      }
      const step = Math.min(left, length - this.t);
      this.t += step;
      left -= step;
      this.fade = length > 0 ? from + (to - from) * (this.t / length) : to;
      if (this.t < length) break;
      this.index += 1;
      this.t = 0;
      this.started = false;
      if (this.index >= this.segments.length) {
        this.done = true;
        this.fade = 0;
        events.push('done');
      }
    }
    return events;
  }
}
