// Sulking in the cab. After a falling out goes badly for her, or a slight from you (you favour her friend), a girl goes and sits alone in a
// Tor or Crag with the engine on for the heat, and doesn't want company. Knock on the window to talk her round: Amy ignores the first knock,
// answers the second and forgives you on the third; Jess revs the engine at you instead, three times, and then gives in. Knock too fast
// and she's worse. Left alone she gets out when she's had enough. Pure logic: the game says who is free and where she is, and acts on
// what comes back. The cab itself (walking to it, starting it, sitting in it) is cabShelter.js with the reason 'sulk'.

export const DEFAULT_SULK_PARAMS = {
  startAfter: 120, // seconds into the game before anyone sulks
  fellOutChance: 0.6, // chance that the girl who came off worse in a falling out goes and sulks
  slightEvery: 5, // seconds between thinking about a neglected girl
  slightChance: 0.04, // each time, for a free girl who feels neglected
  goDelayMin: 6, // seconds before she storms off after the row or the slight
  goDelayMax: 20,
  goTimeout: 270, // seconds she has to be in the cab by (a long walk, and starting it can take a few goes) before she gives up
  stayMin: 150, // seconds she sulks if left alone
  stayMax: 260,
  cooldown: 600, // seconds after she's out before she will sulk again
  knockGap: 2.5, // knocks closer together than this seconds count as pushing it
  pushMax: 3, // this many knocks in a row, each within knockGap of the last, and she's worse
  pushExtra: 120, // seconds added when she's worse
  knockCut: 40, // seconds a knock that didn't do it takes off her sulk
  amyKnocks: 3, // knocks for Amy to forgive you (the first is ignored, the second gets the window down)
  amyKnocksNeglected: 4, // and if she feels neglected, one more
  jessRevs: 3, // times Jess revs it at you before she gives in
  revSeconds: 0.9, // how long each rev is
};

export const SULK_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  fellOutChance: [0, 1, 0.05],
  slightEvery: [1, 60, 1],
  slightChance: [0, 1, 0.01],
  goDelayMin: [0, 120, 1],
  goDelayMax: [0, 240, 1],
  goTimeout: [20, 600, 10],
  stayMin: [10, 900, 10],
  stayMax: [10, 1200, 10],
  cooldown: [0, 1800, 10],
  knockGap: [0.5, 10, 0.5],
  pushMax: [2, 8, 1],
  pushExtra: [0, 600, 10],
  knockCut: [0, 300, 5],
  amyKnocks: [2, 8, 1],
  amyKnocksNeglected: [2, 10, 1],
  jessRevs: [1, 8, 1],
  revSeconds: [0.2, 3, 0.1],
};

const between = (random, min, max) => min + random() * Math.max(0, max - min);

export class Sulking {
  constructor(params = { ...DEFAULT_SULK_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.nextSlight = 0;
    this.coolUntil = {}; // girl id -> time
    this.mine = null; // { girl, why, phase: 'waiting' | 'going' | 'in', goAt, until, since, knocks, pushes, lastKnock, awayFor }
  }

  /** Who is sulking, or null. Only one at a time. */
  get who() {
    return this.mine?.girl ?? null;
  }

  /** Whether she is in the cab sulking, as opposed to on her way. */
  isIn(id) {
    return this.mine?.girl === id && this.mine.phase === 'in';
  }

  /** She starts to sulk now (the debug button, and what the rest call). Returns whether she does. */
  begin(id, why = 'forced') {
    if (this.mine) return false;
    this.mine = { girl: id, why, phase: 'waiting', goAt: this.clock + between(this.random, this.p.goDelayMin, this.p.goDelayMax), until: Infinity, since: 0, knocks: 0, pushes: 0, lastKnock: -Infinity, awayFor: 0, round: false };
    return true;
  }

  /** A falling out has begun: the one who came off worse may go off to sulk. `kind` is 'race', 'borrow' or 'digs'; `fault` the girl most to blame. */
  fellOut(kind, fault, ids) {
    if (this.mine || this.clock < this.p.startAfter || this.random() >= this.p.fellOutChance) return null;
    // The race's loser is sore; the one whose quad was taken is cross; in the digs it is whoever started it.
    const girl = kind === 'borrow' ? ids.find((o) => o !== fault) : fault;
    if (!girl || this.clock < (this.coolUntil[girl] ?? 0)) return null;
    return this.begin(girl, 'fellOut') ? girl : null;
  }

  /** The cab has gone from under her (she was asked out, bored, or you drove off), or she never got there: this ends it. */
  drop(id) {
    if (this.mine?.girl !== id) return;
    this.coolUntil[id] = this.clock + this.p.cooldown;
    this.mine = null;
  }

  /**
   * She hears a knock on the window. Returns { kind } where kind is 'ignored' (Amy's first), 'answer' (Amy's second: the window down, a curt word),
   * 'rev' (Jess), 'forgive' / 'relent' (talked round: she'll get out), 'pushed' (knocked too fast: she's worse) or null if nobody is sulking there.
   */
  knock(id, { neglected = false } = {}) {
    const m = this.mine;
    if (!m || m.girl !== id || m.phase !== 'in' || m.round) return null;
    const p = this.p;
    m.knocks++;
    m.pushes = this.clock - m.lastKnock < p.knockGap ? m.pushes + 1 : 1; // knocks in a row, this one included
    m.lastKnock = this.clock;
    if (m.pushes >= p.pushMax) {
      m.pushes = 0;
      m.knocks = 0;
      m.until += p.pushExtra;
      return { kind: 'pushed' };
    }
    if (id === 'jess') {
      if (m.knocks > p.jessRevs) return this.talkedRound(m, 'relent');
      m.until -= p.knockCut;
      return { kind: 'rev' };
    }
    const need = neglected ? p.amyKnocksNeglected : p.amyKnocks;
    if (m.knocks >= need) return this.talkedRound(m, 'forgive');
    m.until -= p.knockCut;
    return { kind: m.knocks === 1 ? 'ignored' : 'answer' };
  }

  talkedRound(m, kind) {
    m.round = true;
    m.until = this.clock;
    return { kind };
  }

  /**
   * One step. `ctx.girls` is [{ id, free, neglected, cab }] with `cab` null, 'going' or 'in' as the cab shelter has her.
   * Returns events: { type: 'go', girl, why } (send her to the cab), { type: 'in', girl }, { type: 'out', girl, why: 'time' | 'round' }
   * (she gets out), { type: 'over', girl } (it ended some other way).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const m = this.mine;
    if (!m) {
      if (this.clock >= p.startAfter && this.clock >= this.nextSlight) {
        this.nextSlight = this.clock + p.slightEvery;
        for (const g of ctx.girls) {
          if (g.free && g.neglected && this.clock >= (this.coolUntil[g.id] ?? 0) && this.random() < p.slightChance) {
            this.begin(g.id, 'slight');
            break;
          }
        }
      }
      return events;
    }
    const g = ctx.girls.find((x) => x.id === m.girl);
    if (!g) {
      this.drop(m.girl);
      return events;
    }
    if (m.phase === 'waiting') {
      if (this.clock >= m.goAt && g.free) {
        m.phase = 'going';
        m.since = this.clock;
        events.push({ type: 'go', girl: g.id, why: m.why });
      }
    } else if (m.phase === 'going') {
      if (g.cab === 'in') {
        m.phase = 'in';
        m.until = this.clock + between(this.random, p.stayMin, p.stayMax);
        events.push({ type: 'in', girl: g.id });
      } else if (this.clock - m.since >= p.goTimeout || (g.cab === null && this.clock - m.since > 3)) {
        this.drop(g.id);
        events.push({ type: 'over', girl: g.id });
      }
    } else if (g.cab !== 'in') {
      this.drop(g.id);
      events.push({ type: 'over', girl: g.id });
    } else if (this.clock >= m.until) {
      const why = m.round ? 'round' : 'time';
      this.drop(g.id);
      events.push({ type: 'out', girl: g.id, why });
    }
    return events;
  }
}
