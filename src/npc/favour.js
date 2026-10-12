// Who you favour. Each girl quietly keeps a score of how you treat her: rides she
// gives you, times you talk to her, you riding or washing her favourite quad,
// and the odd time you go off with her friend instead. Nobody is told the
// numbers; they show in how she is. The score fades back towards nothing, and
// what matters is how she stands against her friend, from -1 (neglected) to 1
// (favoured). Pure logic; the game feeds it events and reads it back.

export const DEFAULT_FAVOUR_PARAMS = {
  ridePerSecond: 0.05, // score for each second she's driving you about
  talk: 1, // you open her wheel and ask her something
  favouriteQuad: 1.5, // you get on her favourite quad
  washPerSecond: 0.1, // you hose her favourite quad
  ignored: 1, // you talk to her friend with her stood right there
  ignoredPerSecond: 0.02, // she's on foot while her friend drives you about
  decayPerSecond: 0.01, // scores drift back towards nothing (a score of 10 loses about 6 a minute)
  maxScore: 20, // neither goes beyond this either way
  scale: 6, // the gap between the two scores that counts as fully favoured or neglected
  moodAt: 0.35, // standing beyond this either way makes her favoured or neglected
  warmthBoost: 2, // a favoured girl's kind words come this much more often; a neglected one's fade to nothing
  offerBias: 0.7, // how much her standing sways who offers you a ride (0 none, 1 a neglected girl never offers)
  refuseMax: 0.35, // the chance a fully neglected girl says no to a request, and her friend takes it on
  sulkDriveBoost: 2.5, // a fully neglected girl is this much more likely to go off on a quad on her own when bored
  moodDrag: 0.6, // how far a bad phone call or the like pulls her standing down while it lasts (`sulk`)
  gloatChance: 0.7, // the girl who takes on a request her friend turned down gloats about it, rather than just saying okay
};

export const FAVOUR_PARAM_RANGES = {
  ridePerSecond: [0, 0.5, 0.01],
  talk: [0, 5, 0.1],
  favouriteQuad: [0, 10, 0.1],
  washPerSecond: [0, 1, 0.01],
  ignored: [0, 5, 0.1],
  ignoredPerSecond: [0, 0.2, 0.005],
  decayPerSecond: [0, 0.2, 0.005],
  maxScore: [5, 100, 1],
  scale: [1, 30, 0.5],
  moodAt: [0.05, 0.9, 0.05],
  warmthBoost: [1, 5, 0.1],
  offerBias: [0, 1, 0.05],
  refuseMax: [0, 1, 0.05],
  sulkDriveBoost: [1, 6, 0.1],
  moodDrag: [0, 1, 0.05],
  gloatChance: [0, 1, 0.05],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Favour {
  /** @param {string[]} ids  The girls, by character id. */
  constructor(ids, params = { ...DEFAULT_FAVOUR_PARAMS }) {
    this.p = params;
    this.ids = ids;
    this.scores = Object.fromEntries(ids.map((id) => [id, 0]));
    this.moods = {}; // girl id -> seconds left of a bad mood that has nothing to do with you (sulk)
    this.locked = {}; // girl id -> the score her favour never drops below (romance.js: she is yours for the rest of the game)
  }

  /** Locks her favour in: it stays at or above `floor`, nothing takes it away, and she always stands as favoured. */
  lock(id, floor) {
    this.locked[id] = floor;
    this.scores[id] = Math.max(this.scores[id], floor);
  }

  /** Lets her favour go again, to `score`. */
  unlock(id, score) {
    delete this.locked[id];
    if (score !== undefined) this.scores[id] = score;
  }

  /** `amount` of score for her, kept within bounds (it can go below nothing). */
  add(id, amount) {
    if (!(id in this.scores)) return;
    if (id in this.locked && amount < 0) return;
    this.scores[id] = clamp(this.scores[id] + amount, -this.p.maxScore, this.p.maxScore);
  }

  /** She is in a mood for `seconds` (a bad phone call): she stands lower with you while it lasts, whatever the score. Never shortens one. */
  sulk(id, seconds) {
    if (id in this.scores) this.moods[id] = Math.max(this.moods[id] ?? 0, seconds);
  }

  /** Seconds left of her mood, 0 if she is not in one. */
  moodLeft(id) {
    return this.moods[id] ?? 0;
  }

  /** Scores drift back towards nothing, and moods wear off. */
  update(dt) {
    for (const id of Object.keys(this.moods)) if ((this.moods[id] -= dt) <= 0) delete this.moods[id];
    for (const id of this.ids) {
      if (id in this.locked) {
        this.scores[id] = Math.max(this.scores[id], this.locked[id]);
        continue;
      }
      const s = this.scores[id];
      const step = this.p.decayPerSecond * dt * Math.sign(s);
      this.scores[id] = Math.abs(step) >= Math.abs(s) ? 0 : s - step;
    }
  }

  /** How she stands against the others: -1 neglected, 0 even, 1 favoured. */
  standing(id) {
    if (id in this.locked) return 1; // locked in: always fully favoured
    const others = this.ids.filter((o) => o !== id);
    if (!others.length) return 0;
    const rest = others.reduce((sum, o) => sum + this.scores[o], 0) / others.length;
    return clamp((this.scores[id] - rest) / this.p.scale - (this.moods[id] > 0 ? this.p.moodDrag : 0), -1, 1);
  }

  /** 'favoured', 'neglected' or 'even'. */
  mood(id) {
    const s = this.standing(id);
    return s >= this.p.moodAt ? 'favoured' : s <= -this.p.moodAt ? 'neglected' : 'even';
  }

  /** The girl who's clearly favoured, if any: { favoured, other } as ids. */
  rivalry() {
    const favoured = this.ids.find((id) => this.mood(id) === 'favoured');
    if (!favoured) return null;
    return { favoured, other: this.ids.find((id) => id !== favoured) };
  }

  /** How much more (or less) often her kind words come: 1 even, up to warmthBoost favoured, 0 at the neglected end. */
  warmth(id) {
    const s = this.standing(id);
    return s >= 0 ? 1 + s * (this.p.warmthBoost - 1) : 1 + s;
  }

  /** Her weight when choosing who offers you a ride. */
  offerWeight(id) {
    return Math.max(0.05, 1 + this.standing(id) * this.p.offerBias);
  }

  /** The chance she says no to something you ask: only when neglected, up to refuseMax. */
  refuseChance(id) {
    const s = this.standing(id);
    return s <= -this.p.moodAt ? this.p.refuseMax * -s : 0;
  }

  /** Multiplier on how often she takes a quad off on her own when bored: 1 unless neglected. */
  sulkDrive(id) {
    const s = this.standing(id);
    return s <= -this.p.moodAt ? 1 + (this.p.sulkDriveBoost - 1) * -s : 1;
  }
}
