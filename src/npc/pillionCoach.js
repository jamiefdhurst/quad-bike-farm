// The girl on the back coaching the girl driving, the way you can (skills.js). She watches what the driver's getting wrong
// (HerDrive.coachable) and, after a moment to react, tells her. Whether it teaches is decided by the same rules as yours,
// so a bad moment or a repeat is wasted. Amy coaches what she knows (starting, the choke, corners) at the right moment, mostly.
// Jess coaches mud, loudly, and also chips in at the wrong moment and says it again straight away. Pure logic.

export const DEFAULT_PILLION_COACH_PARAMS = {
  firstGap: 12, // seconds after setting off together before she says anything
  gap: 20, // seconds between her pieces of advice, whoever they're to
  reactTime: 1.2, // seconds from seeing the moment to saying it
  amyChance: 0.5, // per second, while there's a moment she knows about
  jessChance: 0.7, // per second, while there's a moment she knows about
  jessWrongChance: 0.015, // per second, Jess piping up when nothing's going wrong
  jessRepeatChance: 0.35, // chance Jess says the same thing again straight after
  repeatDelay: 4, // seconds before the repeat
};

export const PILLION_COACH_PARAM_RANGES = {
  firstGap: [0, 120, 1],
  gap: [0, 120, 1],
  reactTime: [0, 5, 0.1],
  amyChance: [0, 5, 0.05],
  jessChance: [0, 5, 0.05],
  jessWrongChance: [0, 0.2, 0.005],
  jessRepeatChance: [0, 1, 0.05],
  repeatDelay: [0, 15, 0.5],
};

/** Which of COACHING's keys each girl gives (anyone else coaches nothing). */
export const COACH_KNOWS = {
  amy: ['chokeOff', 'crankLess', 'easyCorner'],
  jess: ['keepGoing'],
};

/** Everything Jess will say something about, when she pipes up for no reason. */
export const JESS_WILD = ['chokeOff', 'crankLess', 'easyCorner', 'keepGoing'];

export class PillionCoach {
  constructor(params = { ...DEFAULT_PILLION_COACH_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.pair = null; // 'coach>driver' while they're sharing
    this.together = 0; // seconds sharing
    this.cooldown = 0; // seconds until she might coach again
    this.pending = null; // { key, left } advice she's about to give
    this.repeat = null; // { key, left } Jess saying it again
  }

  /**
   * @param {number} dt
   * @param {{coach: string, driver: string, moments: string[]}|null} share  The girl on the back, the girl driving and what
   *   she's got wrong right now (COACHING keys); null when they aren't sharing a quad with one driving.
   * @returns {{coach: string, driver: string, key: string}[]} Advice given this frame.
   */
  update(dt, share) {
    const id = share ? `${share.coach}>${share.driver}` : null;
    if (id !== this.pair) {
      this.pair = id;
      this.together = 0;
      this.cooldown = 0;
      this.pending = null;
      this.repeat = null;
    }
    if (!share) return [];
    this.together += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const out = [];
    const give = (key) => {
      out.push({ coach: share.coach, driver: share.driver, key });
      this.cooldown = this.p.gap;
    };
    if (this.repeat) {
      this.repeat.left -= dt;
      if (this.repeat.left <= 0) {
        give(this.repeat.key);
        this.repeat = null;
      }
      return out;
    }
    if (this.pending) {
      this.pending.left -= dt;
      if (this.pending.left <= 0) {
        const { key } = this.pending;
        this.pending = null;
        give(key);
        if (share.coach === 'jess' && this.random() < this.p.jessRepeatChance) this.repeat = { key, left: this.p.repeatDelay };
      }
      return out;
    }
    if (this.together < this.p.firstGap || this.cooldown > 0) return out;
    const knows = COACH_KNOWS[share.coach] ?? [];
    const seen = share.moments.filter((k) => knows.includes(k));
    const chance = (share.coach === 'jess' ? this.p.jessChance : this.p.amyChance) * dt;
    if (seen.length && this.random() < chance) {
      this.pending = { key: seen[Math.floor(this.random() * seen.length) % seen.length], left: this.p.reactTime };
    } else if (share.coach === 'jess' && this.random() < this.p.jessWrongChance * dt) {
      this.pending = { key: JESS_WILD[Math.floor(this.random() * JESS_WILD.length) % JESS_WILD.length], left: 0 };
    }
    return out;
  }
}
