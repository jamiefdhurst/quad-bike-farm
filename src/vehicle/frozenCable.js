// A throttle cable frozen on a frosty morning. Water gets into the outer and freezes, so the throttle either won't open or, once opened,
// won't shut again, until the engine's heat, a few minutes of sun or a milder day frees it. Only on frosty days, and only on a quad left
// out in the open. Pure logic, no Three.js: quad.js asks for the throttle, the game deals it at the start of the day.

export const DEFAULT_FROZEN_CABLE_PARAMS = {
  startChance: 0.7, // chance a quad left out on a frosty morning starts the game with a frozen cable
  startIce: 0.5, // the least ice a frozen start has (it goes up to 1)
  freezeRate: 0.0011, // ice a second at full frost on a quad stood outside with the engine off (about fifteen minutes)
  freezeFrom: 0.15, // below this much ice the cable's only a little stiff and nothing changes
  openLoss: 0.9, // frozen shut: how much of the throttle's travel the ice takes at full ice (the rest still opens)
  holdFrom: 0.3, // frozen open: from this much ice a throttle you open stays where you left it
  thawEngine: 0.015, // ice a second lost with the engine running and warm (a cold engine thaws it at about a third of this)
  thawSun: 0.005, // ice a second lost in full sun (a few minutes, less the freezing that goes on)
  thawWarm: 0.002, // ice a second lost per degree above freezing, as the day warms
};

export const FROZEN_CABLE_PARAM_RANGES = {
  startChance: [0, 1, 0.05],
  startIce: [0.2, 1, 0.05],
  freezeRate: [0, 0.01, 0.0001],
  freezeFrom: [0, 0.5, 0.01],
  openLoss: [0, 1, 0.05],
  holdFrom: [0.1, 1, 0.05],
  thawEngine: [0, 0.1, 0.001],
  thawSun: [0, 0.03, 0.0005],
  thawWarm: [0, 0.02, 0.0005],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class FrozenCable {
  constructor(params = DEFAULT_FROZEN_CABLE_PARAMS, random = Math.random) {
    this.P = params;
    this.ice = 0; // 0 free .. 1 solid
    this.mode = random() < 0.5 ? 'shut' : 'open'; // which way this one freezes: won't open, or won't shut
    this.held = 0; // what a cable frozen open is holding
  }

  /** The morning's deal: a frosty dawn may leave a quad out in the open with a frozen cable. `frost` is the weather's, 0..1. */
  deal(random, frost, covered) {
    this.ice = frost > 0 && !covered && random() < this.P.startChance ? this.P.startIce + (1 - this.P.startIce) * random() : 0;
    this.held = 0;
  }

  /** The cable is stiff enough to notice. */
  get frozen() {
    return this.ice >= this.P.freezeFrom;
  }

  /** One step of freezing and thawing. `frost`, `temperature` (degrees C) and `sun` (0..1) are the weather as it is now. */
  update(dt, { running = false, engineTemp = 0, covered = false, frost = 0, temperature = 10, sun = 0 } = {}) {
    const P = this.P;
    if (!running && !covered && frost > 0) this.ice += dt * P.freezeRate * frost;
    let thaw = P.thawWarm * Math.max(0, temperature - 0.5) + P.thawSun * sun * (covered ? 0 : 1);
    if (running) thaw += P.thawEngine * (0.3 + 0.7 * engineTemp);
    this.ice = clamp01(this.ice - dt * thaw);
  }

  /** What the throttle really is, given what you're asking for. */
  throttle(throttle, running) {
    const P = this.P;
    if (!running) {
      this.held = 0;
      return throttle;
    }
    if (this.ice < P.freezeFrom) {
      this.held = throttle;
      return throttle;
    }
    if (this.mode === 'shut') {
      this.held = throttle;
      return Math.min(throttle, 1 - P.openLoss * this.ice);
    }
    // Frozen open: it stays where you left it while the ice is thick, and comes back as it thaws.
    if (this.ice >= P.holdFrom) this.held = Math.max(throttle, this.held);
    else this.held = Math.max(throttle, Math.min(this.held, (this.ice - P.freezeFrom) / Math.max(0.01, P.holdFrom - P.freezeFrom)));
    return this.held;
  }

  /** Freed and dry. */
  fix() {
    this.ice = 0;
    this.held = 0;
  }
}
