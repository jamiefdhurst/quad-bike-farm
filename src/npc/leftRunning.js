// Left running. A quad that's idling with nobody at its controls was left that way by whoever last had it: the one who
// started it and wandered off, or who got off and didn't switch it off. This keeps the books, like wearLedger.js, so when a
// girl finds it and says who left it running, she's right. Pure logic: the game says each frame which quads are running
// and attended and who was at the controls, and this says how long each has idled and whose fault it is.

export const DEFAULT_LEFT_PARAMS = {
  askAfter: 75, // seconds idling with nobody on it before anyone reckons it's been left
  againAfter: 3, // times you've been the one before she says "again"
};

export const LEFT_PARAM_RANGES = {
  askAfter: [5, 600, 5],
  againAfter: [2, 10, 1],
};

export class LeftRunning {
  constructor(params = { ...DEFAULT_LEFT_PARAMS }) {
    this.p = params;
    this.idle = new Map(); // quad id -> seconds running unattended
    this.lastWho = new Map(); // quad id -> 'you' or a girl's id: whoever last had it
    this.tally = {}; // who -> times they've left one running long enough to be noticed
    this.counted = new Set(); // quad ids already added to the tally for this stretch of idling
  }

  /**
   * Call every frame for each quad: `running`, whether anyone is on it or starting it (`attended`) and `who` at the controls
   * or starting it ('you', a girl's id or null; a passenger alone is null, so the last driver keeps the blame).
   */
  record(id, dt, { running, attended, who }) {
    if (who) this.lastWho.set(id, who);
    if (!running || attended) {
      this.idle.set(id, 0);
      this.counted.delete(id);
      return;
    }
    const t = (this.idle.get(id) ?? 0) + dt;
    this.idle.set(id, t);
    const culprit = this.lastWho.get(id);
    if (t >= this.p.askAfter && culprit && !this.counted.has(id)) {
      this.counted.add(id);
      this.tally[culprit] = (this.tally[culprit] ?? 0) + 1;
    }
  }

  /** Whose fault it is that this quad is running with nobody on it, or null if it isn't left yet (or nobody ever had it). */
  culprit(id) {
    if ((this.idle.get(id) ?? 0) < this.p.askAfter) return null;
    return this.lastWho.get(id) ?? null;
  }

  /** How many times this one has been left running. */
  times(who) {
    return this.tally[who] ?? 0;
  }
}

/** The situation a girl uses when she finds a quad left running by `who`. */
export function leftRunningSituation(who, times, p) {
  if (who === 'you') return times >= p.againAfter ? 'leftRunningYouAgain' : 'leftRunningYou';
  return who === 'amy' ? 'leftRunningAmy' : 'leftRunningJess';
}
