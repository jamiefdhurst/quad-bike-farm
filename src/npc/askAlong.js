// Asking you along. When what a girl has chosen to do would meet her want of company and you are near enough to hear, she sometimes
// stops and asks you to come ("Come and sit on the bales", "Fancy a race?") instead of just going. Her wheel then offers Yes or Not now;
// leaving it lapses into a not now. A yes sets her off with you. A no depends on her: Jess shrugs and goes anyway, Amy goes quiet (a
// short mood, a small dip in how she stands with you) and goes a while later; a neglected girl sulks more and goes alone less.
// Not a new choice: it gates the chooser's own pick of an ask kind (ALONG_KINDS), so it needs no offer of its own. Pure: the game says who is
// near and what she'd chosen, and carries out what comes back.

/** The choices she may ask you along to: the offer key she chose, what she says, and what the wheel says for the yes. */
export const ALONG_KINDS = {
  rest: { line: 'askRest', yes: 'Sit on the bales with her' },
  flask: { line: 'askFlask', yes: 'Have a cup of tea with her' },
  fire: { line: 'askFire', yes: 'Sit by the fire with her' },
  race: { line: 'askRace', yes: 'Race her' },
};

export const DEFAULT_ASK_ALONG_PARAMS = {
  startAfter: 90, // seconds into the game before she asks
  chance: 1, // times her own askChance and how much she wants company: how often a choice she could ask you along to becomes an ask
  hearRange: 16, // metres: she only asks when you are this close
  cooldown: 200, // seconds after an ask is answered before she asks again
  lapseAfter: 40, // seconds an ask stays open before it counts as a not now
  companyFloor: 0.2, // she wants company at least this much before she thinks of asking
  yesFavour: 0.5, // favour for saying yes
  noFavour: -0.6, // favour when you say no (times 1 to 2 as she is neglected, nothing if she goes anyway)
  sulkSeconds: 150, // how long a not now leaves her in a mood (favour.js: she stands lower with you while it lasts)
  laterMin: 25, // seconds a girl who sulked waits before she does it alone
  laterMax: 60,
  neglectedAnyway: 0.5, // a neglected girl's chance of going anyway is this much of her usual
};

export const ASK_ALONG_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  chance: [0, 3, 0.05],
  hearRange: [4, 60, 1],
  cooldown: [0, 1800, 10],
  lapseAfter: [5, 180, 5],
  companyFloor: [0, 1, 0.05],
  yesFavour: [0, 5, 0.1],
  noFavour: [-5, 0, 0.1],
  sulkSeconds: [0, 600, 10],
  laterMin: [0, 300, 5],
  laterMax: [0, 600, 5],
  neglectedAnyway: [0, 1, 0.05],
};

const between = (random, lo, hi) => lo + random() * Math.max(0, hi - lo);

export class AskAlong {
  constructor(params = { ...DEFAULT_ASK_ALONG_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.pending = {}; // girl id -> { key, until }: her open ask
    this.cool = {}; // girl id -> time she may ask again
    this.later = []; // { girl, key, at }: a girl who sulked, going alone after all
  }

  /** Her open ask, { key, until }, or null. */
  pendingFor(id) {
    return this.pending[id] ?? null;
  }

  /**
   * Whether she asks you now instead of going, for the choice `key` she has just taken. `ctx`: { distance (to you), youFree (on foot or on a
   * quad, not busy with something else), company (her want of it, 0..1), askChance (her own), fallenOut }.
   */
  shouldAsk(id, key, ctx) {
    if (!ALONG_KINDS[key] || this.clock < this.p.startAfter || this.clock < (this.cool[id] ?? 0)) return false;
    if (this.pending[id] || Object.keys(this.pending).length || !ctx.youFree || ctx.fallenOut) return false;
    if (ctx.distance > this.p.hearRange || ctx.company < this.p.companyFloor) return false;
    return this.random() < this.p.chance * ctx.askChance * ctx.company;
  }

  /** She asks: the ask is open until she lapses it. Returns { type: 'ask', girl, key }. */
  ask(id, key) {
    this.pending[id] = { key, until: this.clock + this.p.lapseAfter };
    return { type: 'ask', girl: id, key };
  }

  /**
   * You answered, or it lapsed (yes false). Returns what she does, { type: 'yes' | 'anyway' | 'sulk', girl, key, delay? }: yes, she goes (with you);
   * anyway, she shrugs and goes alone now; sulk, she's in a mood and goes alone after `delay`. `ctx`: { goesAnyway (her own chance, 0..1),
   * standing (-1 neglected to 1 favoured) }. Null if she had no ask open.
   */
  answer(id, yes, ctx = {}) {
    const ask = this.pending[id];
    if (!ask) return null;
    delete this.pending[id];
    this.cool[id] = this.clock + this.p.cooldown;
    if (yes) return { type: 'yes', girl: id, key: ask.key, favour: this.p.yesFavour };
    const standing = ctx.standing ?? 0;
    const neglected = Math.max(0, -standing);
    const anyway = (ctx.goesAnyway ?? 0) * (1 - neglected * (1 - this.p.neglectedAnyway));
    if (this.random() < anyway) return { type: 'anyway', girl: id, key: ask.key, favour: 0 };
    const delay = between(this.random, this.p.laterMin, this.p.laterMax);
    this.later.push({ girl: id, key: ask.key, at: this.clock + delay });
    return {
      type: 'sulk',
      girl: id,
      key: ask.key,
      delay,
      favour: this.p.noFavour * (1 + neglected),
      mood: this.p.sulkSeconds * (1 + neglected),
    };
  }

  /** One step. Returns [{ type: 'lapsed', girl, key }] for asks that ran out (answer them as a no), and [{ type: 'later', girl, key }] for sulks that are over. */
  update(dt) {
    this.clock += dt;
    const out = [];
    for (const [id, ask] of Object.entries(this.pending)) if (this.clock >= ask.until) out.push({ type: 'lapsed', girl: id, key: ask.key });
    for (const l of this.later.filter((x) => this.clock >= x.at)) out.push({ type: 'later', girl: l.girl, key: l.key });
    this.later = this.later.filter((x) => this.clock < x.at);
    return out;
  }

  /** Drops her ask and anything she was going to do later (she was given something else to do, or it can't happen now). */
  cancel(id) {
    delete this.pending[id];
    this.later = this.later.filter((l) => l.girl !== id);
  }
}
