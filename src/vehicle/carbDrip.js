// A dripping carb. A quad with a sticky float, parked with its fuel tap ON, now and then lets the float stick open and
// petrol drips from the overflow: a damp patch grows under it, the tank slowly empties, and the next start is flooded.
// Turning the tap OFF stops it. Pure logic, no Three.js: the game says each frame whether a quad is parked and what its tap
// and tank are doing, and this says how much petrol went and how big the patch is.

export const DEFAULT_DRIP_PARAMS = {
  proneShare: 0.4, // share of the quads with a sticky float this game (there's always at least one)
  stickRate: 0.004, // per second parked with the tap on, that a prone quad's float sticks (about once in four minutes)
  dripLitres: 0.005, // litres a second out of the overflow while it drips (a minute loses 0.3 L)
  puddleGrow: 0.012, // how fast the damp patch grows while it drips, as a fraction of full size per second
  puddleFade: 0.002, // how fast it dries up when nothing's dripping
  floodFoul: 0.6, // plug fouling a full patch's worth of flooding leaves, for the next start
  smellAt: 0.08, // patch size at which you can smell petrol from beside it
};

export const DRIP_PARAM_RANGES = {
  proneShare: [0, 1, 0.05],
  stickRate: [0, 0.1, 0.001],
  dripLitres: [0, 0.05, 0.001],
  puddleGrow: [0, 0.1, 0.001],
  puddleFade: [0, 0.05, 0.0005],
  floodFoul: [0, 1, 0.05],
  smellAt: [0, 0.5, 0.01],
};

export class CarbDrip {
  /** @param {string[]} ids every quad with a fuel tap */
  constructor(ids, random = Math.random, params = { ...DEFAULT_DRIP_PARAMS }) {
    this.p = params;
    this.random = random;
    this.state = new Map(ids.map((id) => [id, { prone: false, stuck: false, puddle: 0 }]));
    for (const id of ids) if (random() < params.proneShare) this.state.get(id).prone = true;
    if (ids.length && ![...this.state.values()].some((s) => s.prone)) this.state.get(ids[Math.floor(random() * ids.length)]).prone = true;
  }

  /**
   * Call every frame for each quad. `parked` is no engine running and nobody on it; `tapOpen` is the tap on ON or RESERVE;
   * `litres` is what's in the tank. Returns the litres lost to the drip this frame, and whether the float just stuck.
   */
  update(id, dt, { parked, tapOpen, litres }) {
    const s = this.state.get(id);
    if (!s) return { lost: 0, stuck: false };
    const p = this.p;
    let justStuck = false;
    if (!parked) s.stuck = false; // running it shakes the float free
    else if (s.prone && !s.stuck && tapOpen && litres > 0 && this.random() < p.stickRate * dt) justStuck = s.stuck = true;
    const dripping = s.stuck && parked && tapOpen && litres > 0;
    if (dripping) s.puddle = Math.min(1, s.puddle + p.puddleGrow * dt);
    else s.puddle = Math.max(0, s.puddle - p.puddleFade * dt);
    return { lost: dripping ? Math.min(litres, p.dripLitres * dt) : 0, stuck: justStuck };
  }

  prone(id) {
    return this.state.get(id)?.prone ?? false;
  }

  dripping(id) {
    const s = this.state.get(id);
    return !!s && s.stuck && s.puddle > 0;
  }

  /** Size of the damp patch, 0..1. */
  puddle(id) {
    return this.state.get(id)?.puddle ?? 0;
  }

  /** Whether someone stood by it can smell petrol. */
  smells(id) {
    return this.puddle(id) >= this.p.smellAt;
  }

  /** The plug fouling a flooded carb leaves while the engine is stopped. */
  floodFouling(id) {
    return this.puddle(id) * this.p.floodFoul;
  }
}
