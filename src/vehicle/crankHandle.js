// The Tor's or Crag's starting handle: stand at the front, put it through the hole in the bumper and swing it, for when the battery is too
// flat for the starter. Hold your thumb on the same side as your fingers. Wrap it round the handle and, now and then, the engine kicks
// back on a compression and spins the handle the wrong way, and you spend a few seconds nursing your hand. Pure logic, tested
// (tests/crankHandle.test.js); the swing itself is the engine's pull (engine/engineModel.js), the same as a recoil pull-start.

export const DEFAULT_CRANK_PARAMS = {
  kickChance: 0.3, // chance a swing kicks back with your thumb wrapped round the handle
  hurtSeconds: 4, // nursing your hand after a kick-back: no more swinging until it's done
  reach: 1.2, // metres from the starting-handle hole you have to stand to swing it
};

export const CRANK_PARAM_RANGES = {
  kickChance: [0, 1, 0.01],
  hurtSeconds: [0, 15, 0.5],
  reach: [0.5, 3, 0.1],
};

/** How you hold it: thumb wrapped round the handle (it can kick back) or alongside your fingers (safe). */
export const GRIPS = { round: 'thumb round the handle', along: 'thumb alongside your fingers' };

export class CrankHandle {
  constructor(params = { ...DEFAULT_CRANK_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.grip = 'round'; // the natural way to hold a handle, and the wrong one
    this.hurt = 0; // seconds left nursing your hand
  }

  setGrip(grip) {
    if (GRIPS[grip]) this.grip = grip;
  }

  /** Whether you can swing it (your hand isn't hurting). */
  get ready() {
    return this.hurt <= 0;
  }

  /** A swing the engine took: 'kick' if it kicked back (and your hand hurts now), else 'turn'. A girl swinging passes her own `grip`. */
  swing(grip = this.grip) {
    if (grip === 'round' && this.random() < this.p.kickChance) {
      this.hurt = this.p.hurtSeconds;
      return 'kick';
    }
    return 'turn';
  }

  update(dt) {
    this.hurt = Math.max(0, this.hurt - dt);
  }
}
