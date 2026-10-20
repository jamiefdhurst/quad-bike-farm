// Runs the girls' exchanges (banterLines.js): when one can start, which one,
// and playing it out a line at a time with a beat between speakers. The game
// says what's going on each frame as a list of triggers; this decides.
// Pure logic: `speak(speaker, text, { shout })` does the talking and returns
// how long the line lasts.
//
// A trigger is { when, roles, edge }. Edge triggers are moments (you've just
// talked to one of them, you're back from a ride, one's just got stuck) and
// start an exchange straight away if one's allowed; the rest are situations
// that last (standing about together, one watching the other drive) and start
// one now and then.

/** Least seconds between exchanges of each kind, and per second chance while a lasting situation holds. */
export const BANTER_TIMING = {
  idle: { gap: 75, chance: 0.04 },
  talked: { gap: 30 },
  riding: { gap: 45, chance: 0.3 },
  back: { gap: 40 },
  watching: { gap: 50, chance: 0.06 },
  stuck: { gap: 30 },
  sharing: { gap: 45, chance: 0.05 },
  favoured: { gap: 90, chance: 0.05 },
  corrected: { gap: 20 },
  raced: { gap: 20 }, // just after a race
  swapped: { gap: 20 }, // they've swapped places in a convoy
  rivals: { gap: 150, chance: 0.04 }, // one of them is well ahead on race wins
  strengths: { gap: 240, chance: 0.03 }, // the two differ over which quad is best at what (strengthLines.js)
  strengthsAgree: { gap: 400, chance: 0.015 }, // and for once agree
  fellOut: { gap: 0 }, // they've just fallen out (fallingOut.js)
  fallenOut: { gap: 60, chance: 0.05 }, // stood about while fallen out
  madeUp: { gap: 0 }, // they've made up
};
const ANY_GAP = 20; // seconds between any two exchanges
const MOMENT_KEEPS = 8; // seconds a moment waits for a gap in the talking before it's let go
const PRIORITY = ['fellOut', 'madeUp', 'stuck', 'corrected', 'raced', 'swapped', 'talked', 'riding', 'back', 'sharing', 'favoured', 'rivals', 'strengths', 'strengthsAgree', 'fallenOut', 'watching', 'idle'];

const rolesMatch = (exchange, roles = {}) => Object.entries(exchange.roles ?? {}).every(([role, who]) => roles[role] === who);

export class Banter {
  constructor(exchanges, { random = Math.random } = {}) {
    this.exchanges = exchanges;
    this.random = random;
    this.time = 0;
    this.lastAny = -Infinity;
    this.last = {}; // when -> time an exchange of that kind last ended
    this.used = new Map(); // exchange -> times used
    this.running = null; // { exchange, index, wait }
    this.moments = []; // edge triggers waiting for a gap: { trigger, until }
  }

  get busy() {
    return !!this.running;
  }

  /** Exchanges that fit a trigger, least used first (ties at random). */
  candidates(trigger) {
    const fits = this.exchanges.filter((e) => e.when === trigger.when && rolesMatch(e, trigger.roles));
    if (!fits.length) return [];
    const least = Math.min(...fits.map((e) => this.used.get(e) ?? 0));
    return fits.filter((e) => (this.used.get(e) ?? 0) === least);
  }

  /**
   * @param {number} dt
   * @param {object[]} triggers  What's going on now: [{ when, roles, edge }]
   * @param {function} speak     (speaker, text, { shout }) => seconds
   * @param {boolean} [floorFree] Nobody else talking right now.
   * @returns {object|null} the exchange that started this frame, if any
   */
  update(dt, triggers, speak, floorFree = true) {
    this.time += dt;
    // Moments keep for a few seconds, in case someone's still talking.
    for (const t of triggers) if (t.edge) this.moments.push({ trigger: t, until: this.time + MOMENT_KEEPS });
    this.moments = this.moments.filter((m) => m.until > this.time);
    if (this.running) {
      this.play(dt, speak);
      return null;
    }
    if (!floorFree) return null;
    const waiting = this.moments.map((m) => m.trigger);
    const ordered = [...triggers.filter((t) => !t.edge), ...waiting].sort((a, b) => PRIORITY.indexOf(a.when) - PRIORITY.indexOf(b.when));
    for (const t of ordered) {
      const timing = BANTER_TIMING[t.when];
      if (!timing || this.time - (this.last[t.when] ?? -Infinity) < timing.gap) continue;
      // A moment can cut the general wait between exchanges short; a lasting situation can't.
      if (!t.edge && this.time - this.lastAny < ANY_GAP) continue;
      if (!t.edge && this.random() >= (timing.chance ?? 0) * dt) continue;
      const options = this.candidates(t);
      if (!options.length) continue;
      const exchange = options[Math.floor(this.random() * options.length)];
      this.used.set(exchange, (this.used.get(exchange) ?? 0) + 1);
      this.running = { exchange, index: 0, wait: 0 };
      this.moments = this.moments.filter((m) => m.trigger !== t);
      this.play(0, speak);
      return exchange;
    }
    return null;
  }

  play(dt, speak) {
    const r = this.running;
    r.wait -= dt;
    if (r.wait > 0) return;
    const lines = r.exchange.lines;
    if (r.index >= lines.length) {
      this.last[r.exchange.when] = this.time;
      this.lastAny = this.time;
      this.running = null;
      return;
    }
    const [speaker, text, opts] = lines[r.index++];
    const seconds = speak(speaker, text, opts ?? {}) ?? 0;
    // A beat before the other answers.
    r.wait = Math.max(seconds, 0.8) + 0.3 + this.random() * 0.4;
  }
}
