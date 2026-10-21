// A snorkel: fitted at the barn bench (the `snorkel` job in workshop/benchJobs.js) to the Land Rovers, which carry the intake up the
// wing and the screen's side to the roofline. The engine only gulps water once the puddle is much deeper (the ford and a quiet stream
// are nothing), and takes in far less when it does; a flat-out hit on the deepest water in a stream in spate can still drown it.
// A badly sealed one (joints not bedded in) leaks some of that gulp back. Pure logic, no Three.js; the model is snorkelModel.js.

export const DEFAULT_SNORKEL_PARAMS = {
  depthFrom: 0.9, // puddle depth (0..1) the engine starts taking water at with one fitted (without, engine params' waterDepthFrom, 0.55)
  gulpScale: 0.2, // share of the usual gulp that still gets in over that depth
  leakShare: 0.3, // how much of the rest a badly sealed one lets back in, at a seal of 0 (the default botch, 0.35, leaves about 0.36 of the gulp)
};

export const SNORKEL_PARAM_RANGES = {
  depthFrom: [0.5, 1, 0.01],
  gulpScale: [0, 1, 0.01],
  leakShare: [0, 1, 0.01],
};

export const SNORKEL_PARAMS = { ...DEFAULT_SNORKEL_PARAMS }; // shared by every vehicle, registered once

export class Snorkel {
  /** `canFit`: whether this vehicle can have one (the Land Rovers). */
  constructor(canFit = false, p = SNORKEL_PARAMS) {
    this.p = p;
    this.canFit = !!canFit;
    this.fitted = false;
    this.seal = 1; // 1 bedded in properly, less for one put on badly
  }

  fit(seal = 1) {
    if (!this.canFit) return false;
    this.fitted = true;
    this.seal = seal;
    return true;
  }

  /** Taken off again (the debug panel). */
  remove() {
    this.fitted = false;
  }

  /** What the engine's gulp is changed by ({ depthFrom, scale }), or null with none fitted. */
  effect() {
    if (!this.fitted) return null;
    const leak = (1 - Math.max(0, Math.min(1, this.seal))) * this.p.leakShare;
    return { depthFrom: this.p.depthFrom, scale: Math.min(1, this.p.gulpScale + (1 - this.p.gulpScale) * leak) };
  }

  capture() {
    return { fitted: this.fitted, seal: this.seal };
  }

  restore(s) {
    if (!s || !this.canFit || !s.fitted) return;
    this.fitted = true;
    this.seal = typeof s.seal === 'number' && Number.isFinite(s.seal) ? Math.max(0, Math.min(1, s.seal)) : 1;
  }
}
