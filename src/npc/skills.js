// What each girl is good at. Four things she can get better at, each 0 (hopeless)
// to 1 (has it down): starting, choke, cornering, mud. A level of 0.5 behaves as
// she always did; below it she makes more mistakes, above it fewer. You teach her
// from the back while she drives, by coaching at the right moment; she also picks
// it up, slowly, from doing it right. Pure logic; HerDrive reads the levels and
// the game feeds in coaching and practice. Nothing persists between games.

export const SKILLS = ['starting', 'choke', 'cornering', 'mud'];

export const DEFAULT_SKILL_PARAMS = {
  coachGain: 0.12, // skill she gains from advice at the right moment
  practiceGain: 0.01, // skill she gains from getting it right by herself
  practiceGap: 30, // seconds before getting the same thing right counts as practice again
  nagGap: 25, // seconds before advice on the same thing counts again; sooner is nagging
  nagFavour: -0.5, // favour score for nagging her
  taughtFavour: 0.5, // favour score for teaching her something
  momentWindow: 5, // seconds an event (a wobble, a stall) stays a good moment to coach about it
  novice: 0.35, // below this she says she's no good at it
  learned: 0.8, // above this she's got it
};

export const SKILL_PARAM_RANGES = {
  coachGain: [0, 0.5, 0.01],
  practiceGain: [0, 0.1, 0.005],
  practiceGap: [0, 120, 1],
  nagGap: [0, 120, 1],
  nagFavour: [-5, 0, 0.1],
  taughtFavour: [0, 5, 0.1],
  momentWindow: [1, 20, 0.5],
  novice: [0, 0.6, 0.01],
  learned: [0.5, 1, 0.01],
};

/** Where each girl starts, by character id (anyone else starts at 0.5 across the board). */
export const STARTING_SKILLS = {
  amy: { starting: 0.5, choke: 0.3, cornering: 0.6, mud: 0.35 },
  jess: { starting: 0.45, choke: 0.3, cornering: 0.4, mud: 0.65 },
};

/** What you can tell her, and which skill it teaches. */
export const COACHING = {
  chokeOff: { skill: 'choke', label: 'Choke off now' },
  crankLess: { skill: 'starting', label: 'Short bursts on the starter' },
  easyCorner: { skill: 'cornering', label: 'Ease off into the corners' },
  keepGoing: { skill: 'mud', label: 'Keep it going through the mud' },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** How much of her usual mistake she makes at this level: 0 at 1, 1 at 0.5, 2 at 0. */
export const mistake = (level) => clamp(2 * (1 - level), 0, 2);

/** A chance of something going wrong, scaled by skill (never above 1). */
export const mistakeChance = (base, level) => clamp(base * mistake(level), 0, 1);

/** A chance of something going right, scaled by skill: the miss chance (1 - base) moves with her level. */
export const successChance = (base, level) => 1 - mistakeChance(1 - base, level);

/** Band for what she says: 'novice', 'learning' or 'learned'. */
export function band(level, p = DEFAULT_SKILL_PARAMS) {
  return level < p.novice ? 'novice' : level >= p.learned ? 'learned' : 'learning';
}

export class Skills {
  /**
   * @param {string[]} ids  The girls, by character id.
   * @param {object} [start]  Starting levels by id, each { skill: level }.
   */
  constructor(ids, start = STARTING_SKILLS, params = { ...DEFAULT_SKILL_PARAMS }) {
    this.p = params;
    this.ids = ids;
    this.now = 0;
    /** Live levels by id; HerDrive holds on to the object, so change it in place. */
    this.levels = Object.fromEntries(ids.map((id) => [id, Object.fromEntries(SKILLS.map((s) => [s, start[id]?.[s] ?? 0.5]))]));
    this.lastCoached = {}; // `${id}:${skill}` -> time
  }

  update(dt) {
    this.now += dt;
  }

  level(id, skill) {
    return this.levels[id]?.[skill] ?? 0.5;
  }

  set(id, skill, level) {
    if (this.levels[id]) this.levels[id][skill] = clamp(level, 0, 1);
  }

  /** She did it right by herself. */
  practice(id, skill) {
    const key = `${id}:${skill}:practice`;
    if (this.now - (this.lastCoached[key] ?? -Infinity) < this.p.practiceGap) return;
    this.lastCoached[key] = this.now;
    this.set(id, skill, this.level(id, skill) + this.p.practiceGain);
  }

  /**
   * You coach her. `fitting` is whether the moment was right (HerDrive says so).
   * Returns 'taught' (she gains), 'wrongTime' (nothing, she's puzzled) or 'nagged'
   * (the same advice again too soon: nothing, and she's short with you).
   */
  coach(id, skill, fitting) {
    const key = `${id}:${skill}`;
    const last = this.lastCoached[key];
    this.lastCoached[key] = this.now;
    if (last !== undefined && this.now - last < this.p.nagGap) return 'nagged';
    if (!fitting) return 'wrongTime';
    this.set(id, skill, this.level(id, skill) + this.p.coachGain);
    return 'taught';
  }

  band(id, skill) {
    return band(this.level(id, skill), this.p);
  }
}
