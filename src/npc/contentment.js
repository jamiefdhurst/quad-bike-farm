// What a girl likes about the quads: she'd like them all running (so she's glummer when one stalls, happier when they're all
// going, a bit keener to start one that's off and slower to switch one off), and she likes the seat shaking her, the more the
// better, which over time moves her favourite quad to whichever shakes her most. Pure logic: the game says how many quads are
// running, when one stalls and how hard the seat is shaking her; this keeps the moods and the tally. Its tunables live in her
// companion params (companionParams.js), so each girl can differ.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Contentment {
  constructor(random = Math.random) {
    this.random = random;
    this.share = 0; // fraction of the quads running right now
    this.joy = 0; // 0..1: the share, smoothed, so she's not whiplashed by one quad starting
    this.sad = 0; // 0..1: a stall she's seen, fading
    this.buzz = {}; // spec id -> how much of the seat's shake she's enjoyed on it (shake level times seconds)
  }

  /** Each frame: the share of the quads running (0..1). */
  update(dt, share, p) {
    this.share = share;
    const rate = share > this.joy ? p.joyRise : p.joyFall;
    this.joy += (share - this.joy) * Math.min(1, dt * rate);
    this.sad = Math.max(0, this.sad - dt * p.sadFade);
  }

  /** A quad stalled where she could see it; `onIt` if she was riding or sat on it. */
  stalled(onIt, p) {
    this.sad = clamp01(this.sad + (onIt ? p.sadOnStallRiding : p.sadOnStall));
  }

  /** How keen she is to go and start a quad that's off: 1 normally, more the fewer are running. */
  startUrge(p) {
    return 1 + p.startUrge * (1 - this.share);
  }

  /** How much she's inclined to leave an idling quad alone rather than switch it off: scales the chance she does. */
  keyOffFactor(p) {
    return 1 - p.keyOffCut * this.joy;
  }

  /** Sat on a running quad whose seat is shaking her at `level` (the body-shake measure) for `dt` seconds. */
  feel(dt, specId, level, p) {
    if (level < p.buzzFrom) return;
    this.buzz[specId] = (this.buzz[specId] ?? 0) + dt * Math.min(p.buzzCap, level);
  }

  /** Whether she's enjoyed this quad's shake enough to say so. */
  enjoyed(specId, p) {
    return (this.buzz[specId] ?? 0) >= p.buzzSaysAfter;
  }

  /** Her favourite, given the one she has: it moves to whichever shakes her most once that leads by `buzzSwitchLead`. `only` limits the choice. */
  favourite(current, p, only = null) {
    let best = null;
    for (const [id, v] of Object.entries(this.buzz)) {
      if (only && !only(id)) continue;
      if (!best || v > this.buzz[best]) best = id;
    }
    if (!best || best === current) return current;
    return this.buzz[best] - (this.buzz[current] ?? 0) >= p.buzzSwitchLead ? best : current;
  }
}
