// Who wore it out. Wear is the engine's own number; this keeps the books on who was at the controls while it
// built up, so "who's been caning the orange?" has a real answer. Pure logic: the game says each frame what
// a quad's wear is and who's riding it ('you', a girl's id, or nobody), and a service (wear falling) wipes
// the slate in proportion.

/** What counts: how much of a quad's wear has to be pinned on somebody, and how much of it one rider needs, before anyone says so. */
export const DEFAULT_LEDGER_PARAMS = {
  minBlamed: 0.04, // wear (0..1) pinned on riders before anyone reckons they can say who did it
  blameShare: 0.5, // the share of that one rider needs to be named the culprit
};

export const LEDGER_PARAM_RANGES = {
  minBlamed: [0, 0.5, 0.01],
  blameShare: [0.3, 1, 0.05],
};

export class WearLedger {
  constructor(params = { ...DEFAULT_LEDGER_PARAMS }) {
    this.p = params;
    this.shares = new Map(); // quad id -> { who: wear }
    this.last = new Map(); // quad id -> wear at the last look
  }

  /** Call every frame for each quad with its engine's wear and who's driving it (or null). */
  record(id, wear, who) {
    const prev = this.last.get(id) ?? wear; // wear it came with belongs to nobody
    this.last.set(id, wear);
    const shares = this.shares.get(id) ?? {};
    this.shares.set(id, shares);
    if (wear < prev) {
      // Serviced (or stripped down): the books shrink with it.
      const keep = prev > 0 ? Math.max(0, wear) / prev : 0;
      for (const k of Object.keys(shares)) shares[k] *= keep;
    } else if (wear > prev && who) {
      shares[who] = (shares[who] ?? 0) + (wear - prev);
    }
  }

  /** How much of this quad's wear is pinned on this rider. */
  worn(id, who) {
    return this.shares.get(id)?.[who] ?? 0;
  }

  /** The rider who did most of it as { who, share }, or null if nobody did enough of it to say. */
  culprit(id, p = this.p) {
    const shares = this.shares.get(id);
    if (!shares) return null;
    let total = 0;
    let top = null;
    for (const [who, v] of Object.entries(shares)) {
      total += v;
      if (!top || v > shares[top]) top = who;
    }
    if (!top || total < p.minBlamed) return null;
    const share = shares[top] / total;
    return share >= p.blameShare ? { who: top, share } : null;
  }
}

/** Is this engine being thrashed: cold and worked hard. */
export function isThrashed(engine, p) {
  return engine.isRunning && engine.temperature < p.thrashColdBelow && engine.work > p.thrashWork;
}
