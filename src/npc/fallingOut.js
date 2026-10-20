// The girls falling out. Friction builds between them from a bad race, a quad taken off its owner and the digs they trade, and
// drains slowly. Past a threshold they fall out: for a few minutes they won't share a quad, follow each other or stand close,
// each tells you her side, and the banter turns sharp. They make up on their own, sooner if you get them together, nudge them
// or take a side (which keeps the other stewing longer). Pure logic: the game feeds it events and reads the state back.

export const DEFAULT_FALLING_OUT_PARAMS = {
  startAfter: 120, // seconds into the game before they can fall out at all
  threshold: 8, // friction at which they fall out
  raceFriction: 3.5, // friction from a race (the loser is sore, the winner insufferable)
  borrowFriction: 5, // friction from one taking a quad that's her friend's
  digFriction: 1.5, // friction from each bicker where they trade digs
  decayPerSecond: 0.02, // friction drains at this rate while they're friends
  durationMin: 240, // seconds a falling out lasts if left alone
  durationMax: 360,
  cooldown: 180, // seconds after making up before they can fall out again
  togetherRange: 10, // metres: stood this close to each other (and near you) counts as getting them together
  togetherNearYou: 14, // metres: and this close to you
  togetherRate: 4, // the falling out runs down this many times faster while they're stood together
  apartRange: 4, // metres: closer than this and one of them moves off
  sideRange: 7, // metres: you're this close to a girl and she tells you her side
  sideExtend: 60, // seconds added to the falling out when you take one's side
  sideFavour: 2, // favour for the girl you side with, and the same off her friend
  nudgeCut: 0.35, // fraction of what's left that a nudge takes off
  nudgeWindow: 40, // seconds: nudge both within this and they make up at once
};

export const FALLING_OUT_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  threshold: [2, 30, 0.5],
  raceFriction: [0, 15, 0.5],
  borrowFriction: [0, 15, 0.5],
  digFriction: [0, 10, 0.1],
  decayPerSecond: [0, 0.2, 0.005],
  durationMin: [30, 900, 10],
  durationMax: [30, 1200, 10],
  cooldown: [0, 900, 10],
  togetherRange: [4, 30, 1],
  togetherNearYou: [4, 40, 1],
  togetherRate: [1, 10, 0.5],
  apartRange: [1, 10, 0.5],
  sideRange: [2, 20, 1],
  sideExtend: [0, 300, 10],
  sideFavour: [0, 10, 0.5],
  nudgeCut: [0, 1, 0.05],
  nudgeWindow: [5, 120, 5],
};

export class FallingOut {
  /** @param {string[]} ids  The girls, by character id. */
  constructor(ids, params = { ...DEFAULT_FALLING_OUT_PARAMS }, random = Math.random) {
    this.ids = ids;
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.friction = 0;
    this.active = false;
    this.remaining = 0;
    this.elapsed = 0; // seconds this falling out has lasted
    this.cause = null; // { kind: 'race' | 'borrow' | 'digs', fault } while it lasts
    this.told = {}; // girl id -> she's told you her side this time
    this.nudged = {}; // girl id -> clock when she was last nudged
    this.cooldownUntil = 0;
    this.lastKind = 'digs';
    this.lastFault = null;
  }

  /**
   * Something that adds friction. `kind` is 'race', 'borrow' or 'digs'; `fault` is the girl most to blame (the race's loser, the
   * one who took the quad), if there is one. Returns a 'fellOut' event if that was the last straw.
   */
  add(kind, fault = null) {
    if (this.active) return null;
    const amount = { race: this.p.raceFriction, borrow: this.p.borrowFriction, digs: this.p.digFriction }[kind] ?? 0;
    this.friction += amount;
    this.lastKind = kind;
    this.lastFault = fault;
    if (this.friction < this.p.threshold || this.clock < this.p.startAfter || this.clock < this.cooldownUntil) return null;
    return this.begin(kind, fault);
  }

  /** They fall out now (also the debug button). */
  begin(kind = this.lastKind, fault = this.lastFault) {
    const { durationMin, durationMax } = this.p;
    this.active = true;
    this.friction = 0;
    this.elapsed = 0;
    this.remaining = durationMin + this.random() * (durationMax - durationMin);
    this.fault = fault ?? this.ids[Math.floor(this.random() * this.ids.length)];
    this.cause = { kind, fault: this.fault };
    this.told = {};
    this.nudged = {};
    return { type: 'fellOut', kind, fault: this.fault };
  }

  /** They make up. `sorry` is the girl who apologises first: the one most at fault. */
  end() {
    const sorry = this.fault;
    this.active = false;
    this.cause = null;
    this.remaining = 0;
    this.elapsed = 0;
    this.friction = 0;
    this.cooldownUntil = this.clock + this.p.cooldown;
    return { type: 'madeUp', sorry };
  }

  /** @param {boolean} together  They're stood about close together, near you. Returns a 'madeUp' event when they do. */
  update(dt, together = false) {
    this.clock += dt;
    if (!this.active) {
      this.friction = Math.max(0, this.friction - this.p.decayPerSecond * dt);
      return null;
    }
    this.elapsed += dt;
    this.remaining -= dt * (together ? this.p.togetherRate : 1);
    return this.remaining <= 0 ? this.end() : null;
  }

  /** The other girl, for two. */
  other(id) {
    return this.ids.find((o) => o !== id);
  }

  /** She's close enough to you and hasn't told you her side yet. */
  wantsToTell(id) {
    return this.active && !this.told[id];
  }

  tell(id) {
    this.told[id] = true;
  }

  /** You take her side: the other stews for longer. Only once she has told you hers. */
  sideWith(id) {
    if (!this.active || !this.told[id]) return false;
    this.remaining += this.p.sideExtend;
    return true;
  }

  /** You tell her to make it up. Both within the window and they do; one alone takes a bite off what's left. */
  nudge(id) {
    if (!this.active) return null;
    this.nudged[id] = this.clock;
    const friend = this.other(id);
    if (friend in this.nudged && this.clock - this.nudged[friend] <= this.p.nudgeWindow) return this.end();
    this.remaining *= 1 - this.p.nudgeCut;
    return null;
  }
}
