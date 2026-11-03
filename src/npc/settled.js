// A girl told to stop (console: reset amy): she stands about for a while and starts nothing of her own, ready to be given something else.
// This holds her own mind off (`params.ownMind`) for that long and remembers what it was, so it goes back as it was. Pure; companion.js
// carries it out.

export class Settled {
  constructor() {
    this.left = 0; // seconds of standing about still to go
    this.was = true; // her ownMind before
  }

  /** Starts (or restarts) the wait. `ownMind` is what her own mind is now, kept only if she isn't already waiting. */
  start(seconds, ownMind) {
    if (this.left <= 0) this.was = ownMind;
    this.left = seconds;
  }

  /** One step. Returns { ownMind } to put back on the frame the wait ends, else null. */
  step(dt) {
    if (this.left <= 0) return null;
    this.left -= dt;
    return this.left <= 0 ? { ownMind: this.was } : null;
  }
}
