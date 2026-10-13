// The bale spike on the tractor's lift arms: a mast and carriage at the back with a spike on it. Reverse the point into a standing
// (wrapped silage) bale at about the right height and it is speared; raise it to carry, lower it to the ground or on another bale and drive
// forward to leave it. Pure logic, no Three.js or Rapier: the game feeds it where the spike is and draws what it says (items/baleSpikeView.js).
// Tested in tests/baleSpike.test.js.

// A round bale standing on its end, as props.js draws it: the middle is half a height above its base, and the base sits a hair in the ground.
export const BALE_SHAPE = { radius: 0.75, height: 1.2, sink: 0.03 };

export const DEFAULT_SPIKE_PARAMS = {
  liftSeconds: 5, // the arms take this long to go from the bottom of their travel to the top (the engine must be running)
  lowY: 0.57, // metres above the ground the spike stands at the bottom: a standing bale's middle, so it rests on the ground
  highY: 1.9, // and at the top: enough to put a bale on top of another
  startLift: 0.4, // how far up the arms are when the game starts (0 to 1), clear of the trailer's ring
  length: 1.5, // the spike, from its plate to its point
  spearReach: 0.45, // the point within this many metres of a bale's middle (along the ground) spears it
  spearHeight: 0.4, // and within this far above or below the bale's middle
  holdBehind: 1.15, // a speared bale hangs with its middle this far behind the plate
  gripSeconds: 0.35, // a bale takes this long to slide up the spike to where it hangs
  leaveDistance: 0.9, // a bale on the ground is left behind once the point is this far from its middle
  overlap: 1.2, // bales this close (along the ground) rest on one another
  balesNeeded: 3, // bales the silage job wants standing in the Dutch barn's open bay
  towWeight: 2, // a bale on the spike drags the tractor like this many things (npc/towLoad)
};

export const SPIKE_PARAM_RANGES = {
  liftSeconds: [1, 15, 0.5],
  lowY: [0.3, 1, 0.01],
  highY: [1.2, 2.6, 0.05],
  startLift: [0, 1, 0.05],
  length: [0.8, 2.2, 0.05],
  spearReach: [0.15, 1, 0.05],
  spearHeight: [0.1, 0.8, 0.05],
  holdBehind: [0.6, 1.6, 0.05],
  gripSeconds: [0.05, 2, 0.05],
  leaveDistance: [0.5, 1.6, 0.05],
  overlap: [0.8, 1.5, 0.05],
  balesNeeded: [1, 6, 1],
  towWeight: [0, 6, 0.5],
};

/** The arms: 0 at the bottom of their travel, 1 at the top. They only move with the engine running (it is the hydraulics). */
export class SpikeLift {
  constructor(params = { ...DEFAULT_SPIKE_PARAMS }) {
    this.p = params;
    this.lift = params.startLift;
  }

  /** One step. `raise` and `lower` are the keys; `powered` is the engine running. Returns true while the arms are moving. */
  update(dt, { raise = false, lower = false, powered = true } = {}) {
    if (!powered || raise === lower) return false;
    const before = this.lift;
    this.lift = Math.max(0, Math.min(1, this.lift + ((raise ? 1 : -1) * dt) / this.p.liftSeconds));
    return this.lift !== before;
  }

  /** The plate's height above the ground at rest, in the tractor's own frame (the model puts the carriage here). */
  get plateY() {
    return this.p.lowY + this.lift * (this.p.highY - this.p.lowY);
  }
}

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** The bales that can be moved. Each is { id, x, y, z, yaw, held, grounded, from, grip }, y being its middle. */
export class BaleYard {
  constructor(bales, params = { ...DEFAULT_SPIKE_PARAMS }) {
    this.p = params;
    this.bales = bales.map((b) => ({ yaw: 0, ...b, held: false, grounded: false, from: null, grip: 1 }));
  }

  get(id) {
    return this.bales.find((b) => b.id === id) ?? null;
  }

  get held() {
    return this.bales.find((b) => b.held) ?? null;
  }

  /** The base of a bale standing at (x, z) with nothing above `y`: the ground, or the top of what it rests on. */
  baseAt(x, z, groundAt, above = Infinity, except = null) {
    let base = groundAt(x, z) - BALE_SHAPE.sink;
    for (const o of this.bales) {
      if (o === except || o.held || o.y >= above) continue;
      if (flat(o, { x, z }) < this.p.overlap) base = Math.max(base, o.y + BALE_SHAPE.height / 2);
    }
    return base;
  }

  /** Lets every bale that is down fall to what is under it (the ground or the bale below), lowest first. */
  settle(groundAt) {
    const down = this.bales.filter((b) => !b.held).sort((a, b) => a.y - b.y);
    const placed = [];
    for (const b of down) {
      let base = groundAt(b.x, b.z) - BALE_SHAPE.sink;
      for (const o of placed) if (flat(o, b) < this.p.overlap) base = Math.max(base, o.y + BALE_SHAPE.height / 2);
      b.y = base + BALE_SHAPE.height / 2;
      placed.push(b);
    }
  }

  /** Whether nothing is stacked on top of the bale, so it can be lifted. */
  isFree(bale) {
    return !this.bales.some((o) => o !== bale && !o.held && o.y > bale.y + BALE_SHAPE.height / 2 && flat(o, bale) < this.p.overlap);
  }

  /** The bale the point at `tip` ({ x, y, z }) has run into, the nearest, or null. */
  spearable(tip) {
    let best = null;
    let bestD = this.p.spearReach;
    for (const b of this.bales) {
      if (b.held || Math.abs(tip.y - b.y) > this.p.spearHeight || !this.isFree(b)) continue;
      const d = flat(b, tip);
      if (d <= bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  /** The bale goes onto the spike (it slides up it over `gripSeconds`). Only one at a time. */
  spear(bale) {
    if (this.held || bale.held) return false;
    Object.assign(bale, { held: true, grounded: false, from: { x: bale.x, y: bale.y, z: bale.z }, grip: 0 });
    return true;
  }

  /**
   * One step with a bale on the spike. `plate` is { x, y, z } where the plate is now, `back` the unit vector { x, z } pointing out of the back
   * of the tractor along the spike, `yaw` the way the tractor faces. Returns 'left' when the bale was left on the ground or on a stack
   * (it is no longer held), else null.
   */
  carry(bale, dt, plate, back, yaw, groundAt) {
    const p = this.p;
    const want = { x: plate.x + back.x * p.holdBehind, y: plate.y, z: plate.z + back.z * p.holdBehind };
    const rest = this.baseAt(want.x, want.z, groundAt, bale.y, bale) + BALE_SHAPE.height / 2;
    bale.yaw = yaw;
    if (bale.grounded) {
      // Resting on something: it stays where it is until the arms lift it again, or the point has backed out of it.
      const tip = { x: plate.x + back.x * p.length, z: plate.z + back.z * p.length };
      if (want.y > bale.y + 0.02) {
        Object.assign(bale, { grounded: false, from: { x: bale.x, y: bale.y, z: bale.z }, grip: 0 });
      } else if (flat(bale, tip) > p.leaveDistance) {
        bale.held = false;
        bale.grounded = false;
        return 'left';
      } else return null;
    }
    bale.grip = Math.min(1, bale.grip + dt / p.gripSeconds);
    const k = bale.grip * bale.grip * (3 - 2 * bale.grip);
    const from = bale.from ?? want;
    bale.x = from.x + (want.x - from.x) * k;
    bale.z = from.z + (want.z - from.z) * k;
    bale.y = Math.max(from.y + (want.y - from.y) * k, rest);
    if (bale.grip >= 1 && want.y <= rest + 0.01) bale.grounded = true;
    return null;
  }

  /** Lets go of a held bale where it is (it drops onto what is under it). */
  release(bale, groundAt) {
    bale.held = false;
    bale.grounded = false;
    this.settle(groundAt);
  }

  /** How many bales standing down have their middle inside `rect` ({ minX, maxX, minZ, maxZ }). */
  countIn(rect) {
    return this.bales.filter((b) => !b.held && b.x > rect.minX && b.x < rect.maxX && b.z > rect.minZ && b.z < rect.maxZ).length;
  }

  /** What the farm keeps: where each bale is. A bale still on the spike is kept where it is. */
  toJSON() {
    return this.bales.map((b) => [b.id, Math.round(b.x * 100) / 100, Math.round(b.z * 100) / 100, Math.round(b.yaw * 100) / 100, Math.round(b.y * 100) / 100]);
  }

  /** Puts the saved bales back (ones the game no longer has are ignored), then lets them settle. */
  restore(saved, groundAt) {
    if (!Array.isArray(saved)) return;
    for (const row of saved) {
      if (!Array.isArray(row)) continue;
      const [id, x, z, yaw, y] = row;
      const b = this.get(id);
      if (b && Number.isFinite(x) && Number.isFinite(z)) Object.assign(b, { x, z, yaw: Number.isFinite(yaw) ? yaw : b.yaw, held: false, grounded: false, y: Number.isFinite(y) ? y : b.y });
    }
    this.settle(groundAt);
  }
}

/** Whether the silage job has run: `needed` bales standing in the target area. */
export function silageDone(yard, rect, needed) {
  return yard.countIn(rect) >= needed;
}
