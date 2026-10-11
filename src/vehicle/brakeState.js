// The state of a quad's brakes. Two things go wrong with them: driving through water leaves them wet, so for a few seconds they barely
// bite until braking (or just driving) dries them; and a quad that has stood a long time can have a brake that binds, dragging on the
// wheel, until a few metres of riding frees it with a clunk. Pure logic, no Three.js: quad.js asks for the numbers.

export const DEFAULT_BRAKE_PARAMS = {
  soakFrom: 0.25, // how deep the water under a wheel (0..1) has to be to wet the brakes
  soakRate: 0.8, // wetness a second at full depth, moving (about a second and a half through the ford)
  soakSpeed: 0.8, // m/s: crawling or stood in a puddle doesn't splash the discs
  wetLoss: 0.8, // how much of the brake's bite wet brakes lose (1 would be none at all)
  dryRate: 0.03, // wetness a second lost just driving along (about half a minute dry)
  dryBraking: 0.35, // wetness a second lost per unit of brake pressure at speed: the pads warm and wipe the discs
  bindChance: 0.2, // chance a quad starts the game with a binding brake
  bindDrag: 1.1, // m/s2 of drag on the quad while the brake binds (about the pull of a handbrake left half on)
  bindMetres: 6, // metres of riding that frees a binding brake (each quad's own is 0.6 to 1.5 times this)
  clunkSpeed: 0.5, // m/s it has to be rolling for the freeing to count
};

export const BRAKE_PARAM_RANGES = {
  soakFrom: [0, 1, 0.05],
  soakRate: [0, 3, 0.05],
  soakSpeed: [0, 4, 0.1],
  wetLoss: [0, 1, 0.05],
  dryRate: [0, 0.3, 0.005],
  dryBraking: [0, 2, 0.05],
  bindChance: [0, 1, 0.05],
  bindDrag: [0, 4, 0.1],
  bindMetres: [1, 40, 1],
  clunkSpeed: [0, 3, 0.1],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class BrakeState {
  constructor(params = DEFAULT_BRAKE_PARAMS, random = Math.random) {
    this.P = params;
    this.wet = 0; // 0 dry .. 1 soaked
    this.binding = false;
    this.metres = 0; // ridden since it started binding
    this.freeAt = (0.6 + 0.9 * random()) * params.bindMetres; // the metres this one takes to free
    this.clunked = false; // the freeing happened this step; take it with takeClunk()
  }

  /** Makes it bind (or not), for the game's deal and the debug panel. */
  setBinding(on) {
    this.binding = !!on;
    this.metres = 0;
  }

  /** How much of its bite the lever has: 1 dry, less when wet. */
  get grip() {
    return 1 - this.P.wetLoss * this.wet;
  }

  /** The drag on the quad while the brake binds, in m/s2 (0 when free). */
  get drag() {
    return this.binding ? this.P.bindDrag : 0;
  }

  /**
   * One step. `puddle`: the deepest water under a wheel (0..1); `speed`: m/s along the quad (either way); `pressure`: the brake, 0..1.
   */
  update(dt, { puddle = 0, speed = 0, pressure = 0 } = {}) {
    const P = this.P;
    const v = Math.abs(speed);
    if (puddle > P.soakFrom && v > P.soakSpeed) this.wet = clamp01(this.wet + dt * P.soakRate * puddle);
    else if (v > P.soakSpeed) this.wet = clamp01(this.wet - dt * (P.dryRate + P.dryBraking * pressure * Math.min(1, v / 3)));
    if (this.binding && v > P.clunkSpeed) {
      this.metres += v * dt;
      if (this.metres >= this.freeAt) {
        this.binding = false;
        this.clunked = true;
      }
    }
  }

  /** True once after a binding brake frees, for the clunk. */
  takeClunk() {
    const c = this.clunked;
    this.clunked = false;
    return c;
  }

  /** Dry and free. */
  fix() {
    this.wet = 0;
    this.binding = false;
    this.metres = 0;
  }
}
