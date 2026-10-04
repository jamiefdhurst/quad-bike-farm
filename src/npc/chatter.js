// Decides whether she says something and what, so she talks now and then but
// doesn't babble or repeat herself. Pure logic.

export class Chatter {
  /**
   * @param {object} lines   VOICE_LINES: { situation: { cooldown, lines } }
   * @param {object} opts
   * @param {function} opts.random
   * @param {number} opts.minGap       seconds of quiet after she speaks before she'll speak unprompted again
   * @param {number} opts.chattiness   1 is normal; 2 talks about twice as often, 0 never unprompted
   */
  constructor(lines, { random = Math.random, minGap = 6, chattiness = 1 } = {}) {
    this.lines = lines;
    this.random = random;
    this.minGap = minGap;
    this.chattiness = chattiness;
    this.time = 0;
    this.quietUntil = 0;
    this.speakingUntil = 0;
    this.cooldownUntil = {};
    this.recent = {}; // last few picks per situation, to avoid repeats
  }

  update(dt) {
    this.time += dt;
  }

  /** Seconds since she last spoke, or Infinity. */
  get sinceSpoke() {
    return this.lastSpoke === undefined ? Infinity : this.time - this.lastSpoke;
  }

  /**
   * A line for this situation, or null if she'd rather not right now.
   * `force` (answering you) ignores the quiet gap and the situation's cooldown.
   * `urgent` (a reaction to something that just happened) skips the quiet gap
   * but still waits for her to finish what she's saying.
   * `chance` is how likely she is to bother.
   */
  pick(situation, { force = false, urgent = false, chance = 1 } = {}) {
    const entry = this.lines[situation];
    if (!entry?.lines.length) return null;
    if (!force) {
      if (this.chattiness <= 0) return null;
      if (this.time < (urgent ? this.speakingUntil : this.quietUntil)) return null;
      if (this.time < (this.cooldownUntil[situation] ?? 0)) return null;
      if (this.random() >= chance) return null;
    }
    const list = entry.lines;
    const recent = (this.recent[situation] ??= []);
    const fresh = list.map((_, i) => i).filter((i) => !recent.includes(i));
    const options = fresh.length ? fresh : list.map((_, i) => i);
    const index = options[Math.floor(this.random() * options.length)];
    recent.push(index);
    // Remember about half of the list, so a line can't come round again too soon.
    while (recent.length > Math.floor(list.length / 2)) recent.shift();

    this.lastSpoke = this.time;
    this.cooldownUntil[situation] = this.time + (entry.cooldown ?? 0) / Math.max(0.1, this.chattiness);
    this.quietUntil = this.time + this.minGap / Math.max(0.1, this.chattiness);
    return list[index];
  }

  /** Pushes the quiet gap back to cover a line that's still playing. */
  holdFor(seconds) {
    this.speakingUntil = this.time + seconds;
    this.quietUntil = Math.max(this.quietUntil, this.time + seconds + this.minGap / Math.max(0.1, this.chattiness));
  }
}
