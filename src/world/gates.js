// The farm's two gates (the south gate onto the green lane, the big gate in the east hedge) as things that open and shut. Pure: how far open
// each is, how fast it swings and whether something is in the way of shutting it. The meshes and colliders are in props.js; the hedge gap
// each one fills (world/fields.js) is told when it is shut, so the girls' routes and the runaway tractor read it.

export const DEFAULT_GATE_PARAMS = {
  swingSeconds: 1.8, // how long a gate takes to swing from shut to open or back
  blockBelow: 0.5, // it counts as shut (solid, and a hedge for the runaway tractor) until it is this far open
  clearRadius: 3, // m: nothing may be within this of a gate's middle for it to be shut
};

export const GATE_PARAM_RANGES = {
  swingSeconds: [0.5, 5, 0.1],
  blockBelow: [0.1, 0.9, 0.05],
  clearRadius: [1, 6, 0.5],
};

export class GateState {
  constructor(open = false, params = DEFAULT_GATE_PARAMS) {
    this.p = params;
    this.amount = open ? 1 : 0; // 0 shut, 1 swung right open
    this.target = this.amount;
  }

  /** Swung open or on its way, as opposed to shut or closing. */
  get opening() {
    return this.target > 0.5;
  }

  /** Whether it is solid now (a shut gate, or one not yet swung far enough). */
  get blocking() {
    return this.amount < this.p.blockBelow;
  }

  get moving() {
    return this.amount !== this.target;
  }

  setOpen(open) {
    this.target = open ? 1 : 0;
  }

  toggle() {
    this.setOpen(!this.opening);
  }

  update(dt) {
    if (!this.moving) return;
    const step = dt / Math.max(0.05, this.p.swingSeconds);
    this.amount = this.amount < this.target ? Math.min(this.target, this.amount + step) : Math.max(this.target, this.amount - step);
  }
}

/** The first of `things` ({ x, z }) within `radius` of (x, z), or null: what is stopping a gate being shut. */
export function inTheWay(x, z, things, radius) {
  for (const t of things) if (Math.hypot(t.x - x, t.z - z) < radius) return t;
  return null;
}

/**
 * One gate in the world. `pose(amount)` swings its mesh, `solid` and `swungSolid` are the colliders for shut and for swung open (either may
 * be null) and `gap` is the hedge gap in fields.js, whose `shut` is kept in step.
 */
export class Gate {
  constructor({ id, x, z, open = false, params = DEFAULT_GATE_PARAMS, pose = () => {}, solid = null, swungSolid = null, gap = null }) {
    this.id = id;
    this.x = x;
    this.z = z;
    this.state = new GateState(open, params);
    this.pose = pose;
    this.solid = solid;
    this.swungSolid = swungSolid;
    this.gap = gap;
    this.apply();
  }

  get isOpen() {
    return this.state.opening;
  }

  apply() {
    const { state } = this;
    this.pose(state.amount);
    const shut = state.blocking;
    this.solid?.setEnabled(shut);
    this.swungSolid?.setEnabled(!shut);
    if (this.gap) this.gap.shut = shut;
  }

  /** Swing it open or shut. Shutting is refused (with the thing in the way) when something is near; opening always works. */
  set(open, things = []) {
    if (!open) {
      const t = inTheWay(this.x, this.z, things, this.state.p.clearRadius);
      if (t) return { ok: false, blockedBy: t };
    }
    this.state.setOpen(open);
    return { ok: true };
  }

  update(dt) {
    if (!this.state.moving) return;
    this.state.update(dt);
    this.apply();
  }
}
