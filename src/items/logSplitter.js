// The log splitter on the tractor's back, run off its hydraulics: it takes the place of the bale spike on the lift arms. Stand at it with a
// round on the beam and hold E to push the ram into the wedge; the round comes apart into two logs, which you carry to the stack. The tractor
// has to be running and parked (brake on or in neutral). Pure logic, no Three.js or Rapier: the game feeds it the keys and the engine and draws
// what it says (vehicle/tractorModel.js for the splitter, items/woodPieces.js for the rounds and logs). Tested in tests/logSplitter.test.js.

export const DEFAULT_SPLITTER_PARAMS = {
  outSeconds: 4.5, // the ram takes this long to go the full stroke while E is held (it is a hydraulic ram, not quick)
  backSeconds: 2.2, // and this long to come back when you let go
  pressAt: 0.72, // how far out the ram's face meets the round (0 to 1 of the stroke)
  splitAt: 0.86, // and how far out it is when the round gives way
  toughness: 0.45, // how much longer a gnarled round takes to push through (a share of the press): 0 is none, 1 is double
  gnarlChance: 0.25, // the share of rounds with a knot in them that take that long
  idleLoad: 0.12, // the engine load of the pump turning with nothing in the way
  moveLoad: 0.3, // and while the ram is moving
  pressLoad: 0.9, // and while it is pushing a round through (the revs sag)
  pumpThrottle: 0.38, // the throttle the governor holds while the pump works, so the engine note rises (0 to 1)
  reach: 2.6, // metres from the beam that you can load and work it
  logsPerRound: 2, // a round splits into this many logs
  capacity: 48, // the stack takes this many logs
  logsNeeded: 8, // logs stacked for the job to count as done
  burnPerDay: 6, // logs from the stack that are burnt through the house between one day and the next
  roundsPerPile: 6, // rounds lying in each pile at the start of a load
};

export const SPLITTER_PARAM_RANGES = {
  outSeconds: [1, 15, 0.5],
  backSeconds: [0.5, 10, 0.1],
  pressAt: [0.3, 0.9, 0.01],
  splitAt: [0.4, 0.99, 0.01],
  toughness: [0, 1, 0.05],
  gnarlChance: [0, 1, 0.05],
  idleLoad: [0, 0.5, 0.01],
  moveLoad: [0, 0.8, 0.01],
  pressLoad: [0.2, 1, 0.01],
  pumpThrottle: [0, 1, 0.01],
  reach: [1, 5, 0.1],
  logsPerRound: [2, 4, 1],
  capacity: [12, 120, 4],
  logsNeeded: [2, 24, 1],
  burnPerDay: [0, 24, 1],
  roundsPerPile: [2, 12, 1],
};

/** The splitter's ram and the round on its beam. `ram` is 0 (back) to 1 (full stroke). */
export class LogSplitter {
  constructor(params = { ...DEFAULT_SPLITTER_PARAMS }) {
    this.p = params;
    this.ram = 0;
    this.round = null; // { gnarled } while a round is on the beam
    this.pressed = 0; // how far through the press the round is, 0..1 (it stays if you let go: it is still wedged)
    this.load = 0; // the engine load it asks for now, 0..1
    this.moving = false;
  }

  get loaded() {
    return !!this.round;
  }

  /** Whether a round could be put on the beam: it is empty and the ram is back out of the way. */
  canLoad() {
    return !this.round && this.ram <= 0.02;
  }

  /** Puts a round on the beam (`gnarled`: it has a knot and takes longer). Returns false if it could not go on. */
  putOn(gnarled = false) {
    if (!this.canLoad()) return false;
    this.round = { gnarled: !!gnarled };
    this.pressed = 0;
    return true;
  }

  /** Whether a round could be lifted off again: the ram is back and it has not been split. */
  canUnload() {
    return !!this.round && this.ram <= 0.02;
  }

  unload() {
    if (!this.canUnload()) return null;
    const r = this.round;
    this.round = null;
    return r;
  }

  /**
   * One step. `push` is E held at the splitter, `powered` the engine running and the tractor parked. Returns the events:
   * { type: 'split', gnarled } when the round gives way (the game drops the logs).
   */
  update(dt, { push = false, powered = true } = {}) {
    const p = this.p;
    const events = [];
    const before = this.ram;
    if (powered && push) {
      // Through the round the ram slows by how hard it is to push: a gnarled round takes longer.
      const inPress = this.round && this.ram >= p.pressAt - 0.02 && this.ram < p.splitAt;
      const slow = inPress && this.round.gnarled ? 1 / (1 + p.toughness) : 1;
      this.ram = Math.min(1, this.ram + (dt / p.outSeconds) * slow);
    } else if (powered || this.ram > 0) {
      // Let go and it comes back. A stalled engine leaves the ram where it is (no pressure), so it only returns when powered.
      if (powered) this.ram = Math.max(0, this.ram - dt / p.backSeconds);
    }
    this.moving = Math.abs(this.ram - before) > 1e-6;
    const pressing = !!this.round && this.moving && this.ram > before && this.ram >= p.pressAt && this.ram < p.splitAt;
    if (this.round) this.pressed = Math.max(this.pressed, Math.max(0, Math.min(1, (this.ram - p.pressAt) / Math.max(1e-6, p.splitAt - p.pressAt))));
    if (this.round && this.ram >= p.splitAt) {
      events.push({ type: 'split', gnarled: this.round.gnarled });
      this.round = null;
      this.pressed = 0;
    }
    this.load = !powered ? 0 : pressing ? p.pressLoad : this.moving ? p.moveLoad : push ? p.idleLoad : 0;
    return events;
  }

  reset() {
    this.ram = 0;
    this.round = null;
    this.pressed = 0;
    this.load = 0;
    this.moving = false;
  }
}

/** Whether the tractor can run the splitter: engine running, and held (parking brake on or in neutral), and not being driven off. */
export function splitterPowered({ running, parkBrake, gear, speed }) {
  return !!running && (!!parkBrake || gear === 0) && Math.abs(speed) < 0.3;
}

// The log stack: logs lying side by side along the stack's length, layer on layer, as a woodpile against a hedge.
export const STACK_SHAPE = { perLayer: 12, spacing: 0.29, layerHeight: 0.15, logLength: 0.34 };

/** Where the `index`th log lies in a stack, in the stack's own frame: x along its length from its middle, y above the ground, z across (0). Pure. */
export function stackSlot(index, shape = STACK_SHAPE) {
  const layer = Math.floor(index / shape.perLayer);
  const col = index % shape.perLayer;
  const stagger = layer % 2 ? shape.spacing / 2 : 0; // each layer sits in the gaps of the one below
  return { x: (col - (shape.perLayer - 1) / 2) * shape.spacing + stagger - shape.spacing / 4, y: layer * shape.layerHeight, z: 0 };
}

/** The stack of split logs and the job's tally. `count` is how many are stacked now. */
export class LogStack {
  constructor(params = { ...DEFAULT_SPLITTER_PARAMS }) {
    this.p = params;
    this.count = 0;
    this.jobFrom = null; // the count when today's job was put on the board, or null
  }

  get full() {
    return this.count >= this.p.capacity;
  }

  /** Stacks one log. Returns its slot index, or -1 if the stack is full. */
  add() {
    if (this.full) return -1;
    return this.count++;
  }

  /** Whether there is room for the job's logs on top of what is stacked. */
  roomForJob() {
    return this.count + this.p.logsNeeded <= this.p.capacity;
  }

  startJob() {
    this.jobFrom = this.count;
  }

  /** Logs stacked since the job went on the board. */
  get jobDone() {
    return this.jobFrom === null ? 0 : this.count - this.jobFrom;
  }

  get jobComplete() {
    return this.jobFrom !== null && this.jobDone >= this.p.logsNeeded;
  }

  toJSON(day) {
    return { count: this.count, day };
  }

  /** Puts back what was saved, less what has been burnt since: `day` is today and `saved.day` the day it was saved. */
  restore(saved, day) {
    const n = Math.max(0, Math.min(this.p.capacity, Math.floor(saved?.count ?? 0)));
    const gone = Math.max(0, day - (Number.isFinite(saved?.day) ? saved.day : day));
    this.count = Math.max(0, n - gone * this.p.burnPerDay);
  }

  reset() {
    this.count = 0;
    this.jobFrom = null;
  }
}
