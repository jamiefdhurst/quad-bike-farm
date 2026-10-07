// The jobs you do at the barn bench: change a plug, clean a carb, fix a tyre, top up the two-stroke oil.
// Each is a short run of steps, a press (one tap) or a hold (keep it down for a moment). Some holds
// have a window: let go too early and it's loose, hold on too long and it's over-done, and either leaves
// the job botched, so it works but not as well. Pure logic, no Three.js or DOM.

export const DEFAULT_BENCH_PARAMS = {
  holdScale: 1, // multiplier on how long every hold takes, so the whole bench can be quicker or slower
  bayMargin: 0.35, // a quad counts as in the bay when its middle is this far inside the painted lines
  plugLeftFouling: 0.3, // a plug fitted badly: still fouled, as if it had never been changed
  plugWearRemoved: 0.15, // wear a new plug takes away
  botchedLevel: 0.2, // a carb or tyre botched at the bench: the fault comes back at this level
  oilShort: 0.012, // oil fraction of the tank mix when the pour was too short (about 80:1, runs hot)
  oilGood: 0.02, // and when it was right (50:1)
  plugRichFouling: 0.3, // fouling at which the old plug looks sooty (rich running)
  plugLean: 0.15, // how lean it last ran (mixture below minus this) for the old plug to look white
  plugOilyWear: 0.35, // wear at which a two-stroke's old plug is wet with oil
  plugWornWear: 0.4, // wear at which a four-stroke's old plug has an electrode worn round
  sumpShort: 0.75, // sump level when the pour was too short (a bit under the top mark)
  oilOver: 0.05, // and when it was too much (about 20:1, smokes and fouls)
  packingBotched: 0.3, // silencer blown-out level left after a badly packed one (too loose or stuffed too tight)
};

export const BENCH_PARAM_RANGES = {
  holdScale: [0.3, 3, 0.1],
  bayMargin: [0, 1, 0.05],
  plugLeftFouling: [0, 1, 0.05],
  plugWearRemoved: [0, 1, 0.05],
  botchedLevel: [0, 1, 0.05],
  oilShort: [0, 0.1, 0.002],
  oilGood: [0, 0.1, 0.002],
  sumpShort: [0.3, 1, 0.01],
  oilOver: [0, 0.2, 0.002],
  packingBotched: [0, 1, 0.05],
  plugRichFouling: [0, 1, 0.05],
  plugLean: [0, 0.5, 0.01],
  plugOilyWear: [0, 1, 0.05],
  plugWornWear: [0, 1, 0.05],
};

// need: seconds to hold. limit: if set, it's a window (let go between need and limit), and
// holding to the limit overdoes it. 'inspect' steps tell you the state of the old part.
export const JOBS = {
  plug: {
    name: 'Change the spark plug',
    steps: [
      { id: 'lead', text: 'Pull the plug cap off', kind: 'press' },
      { id: 'out', text: 'Undo the old plug with the spanner', kind: 'hold', need: 0.9 },
      { id: 'look', text: 'Look at the old plug', kind: 'press', inspect: true },
      { id: 'fit', text: 'Screw the new plug in by hand', kind: 'press' },
      { id: 'tight', text: 'Nip it up with the spanner: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
  carb: {
    name: 'Clean the carb',
    steps: [
      { id: 'box', text: 'Take the airbox lid off', kind: 'press' },
      { id: 'bowl', text: 'Undo the float bowl', kind: 'hold', need: 1 },
      { id: 'jets', text: 'Blow through the jets', kind: 'hold', need: 1.2 },
      { id: 'refit', text: 'Put the bowl back', kind: 'press' },
      { id: 'tight', text: 'Do the bowl screws up: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
  tyre: {
    name: 'Fix a tyre',
    steps: [
      { id: 'jack', text: 'Jack the quad up', kind: 'press' },
      { id: 'off', text: 'Undo the nuts and take the wheel off', kind: 'hold', need: 1 },
      { id: 'patch', text: 'Find the hole and patch the tube', kind: 'press' },
      { id: 'on', text: 'Put the wheel back on', kind: 'press' },
      { id: 'pump', text: 'Pump it up: stop at the right pressure', kind: 'hold', need: 1.1, limit: 2.3 },
    ],
  },
  oil: {
    name: 'Top up the two-stroke oil',
    steps: [
      { id: 'cap', text: 'Take the tank cap off', kind: 'press' },
      { id: 'pour', text: 'Pour the oil in: stop at the line', kind: 'hold', need: 0.7, limit: 1.5 },
      { id: 'shake', text: 'Rock the quad to mix it', kind: 'press' },
      { id: 'close', text: 'Cap on', kind: 'press' },
    ],
  },
  packing: {
    name: 'Repack the silencer',
    steps: [
      { id: 'off', text: 'Undo the silencer and take it off', kind: 'hold', need: 1 },
      { id: 'old', text: 'Pull out the burnt packing', kind: 'press' },
      { id: 'wrap', text: 'Stuff in new packing: firm, not rammed', kind: 'hold', need: 1, limit: 2 },
      { id: 'refit', text: 'Bolt the silencer back on', kind: 'press' },
    ],
  },
  sump: {
    name: 'Top up the engine oil',
    steps: [
      { id: 'stick', text: 'Pull the dipstick and wipe it', kind: 'press' },
      { id: 'pour', text: 'Pour the oil in: stop at the top mark', kind: 'hold', need: 0.9, limit: 1.7 },
      { id: 'recheck', text: 'Wait a minute, then dip it again', kind: 'press' },
      { id: 'close', text: 'Filler cap on', kind: 'press' },
    ],
  },
};

export const JOB_KINDS = ['plug', 'carb', 'tyre', 'oil', 'sump', 'packing'];

/** What each reading means, the way Amy would say it. Order is the order Jess can be wrong in. */
export const PLUG_KINDS = ['healthy', 'rich', 'lean', 'oily', 'worn'];

const PLUG_LOOKS = {
  healthy: 'a pale tan, clean and dry',
  rich: 'black and sooty',
  lean: 'white and blistered',
  oily: 'wet and oily, black on the thread',
  worn: 'tan, but the electrode is worn round',
};

/**
 * Reads the old plug from how the engine has been running. `mixture` is where it last ran (it keeps
 * its last value switched off). An oil-wet plug is a worn or over-oiled two-stroke; black soot is rich;
 * white is lean; a worn four-stroke shows in the electrode. Returns { kind, look }.
 */
export function readPlug(engine, P = DEFAULT_BENCH_PARAMS) {
  const twoStroke = engine.params.strokes === 2;
  let kind = 'healthy';
  if (twoStroke && (engine.wear >= P.plugOilyWear || engine.oilRich >= 0.3)) kind = 'oily';
  else if (engine.fouling >= P.plugRichFouling || engine.rich >= 0.2) kind = 'rich';
  else if (engine.mixture <= -P.plugLean) kind = 'lean';
  else if (!twoStroke && engine.wear >= P.plugWornWear) kind = 'worn';
  return { kind, look: PLUG_LOOKS[kind] };
}

/** A girl's reading of it: right with probability `accuracy`, otherwise she names some other kind. */
export function guessPlug(truth, accuracy, random = Math.random) {
  if (random() < accuracy) return truth;
  const wrong = PLUG_KINDS.filter((k) => k !== truth);
  return wrong[Math.floor(random() * wrong.length)];
}

/** What the plug looks like, for the toast: just the colour, you work out what it means. */
export function plugCondition(engine, P = DEFAULT_BENCH_PARAMS) {
  return readPlug(engine, P).look;
}

/**
 * One job in progress. `press()` for a press step, `startHold()` and `releaseHold()`
 * (with `update(dt)` while held) for a hold. Each returns the events it caused:
 * { type: 'step', index }, { type: 'flaw', step, how: 'short' | 'over' } and { type: 'done' }.
 */
export class BenchJob {
  constructor(kind, params = DEFAULT_BENCH_PARAMS) {
    this.kind = kind;
    this.def = JOBS[kind];
    this.params = params;
    this.index = 0;
    this.holding = false;
    this.held = 0;
    this.flaws = []; // { step: id, how: 'short' | 'over' }
    this.done = false;
  }

  get step() {
    return this.done ? null : this.def.steps[this.index];
  }

  get needSeconds() {
    return this.step?.need ? this.step.need * this.params.holdScale : 0;
  }

  get limitSeconds() {
    return this.step?.limit ? this.step.limit * this.params.holdScale : 0;
  }

  /** 0..1 of the way to the end of a hold's window (or of the hold, with no window). */
  get progress() {
    if (!this.holding) return 0;
    const end = this.limitSeconds || this.needSeconds;
    return Math.min(1, this.held / end);
  }

  get botched() {
    return this.flaws.length > 0;
  }

  advance(events) {
    this.holding = false;
    this.held = 0;
    this.index++;
    if (this.index >= this.def.steps.length) {
      this.done = true;
      events.push({ type: 'done' });
    } else events.push({ type: 'step', index: this.index });
  }

  press() {
    const events = [];
    if (this.step?.kind === 'press') this.advance(events);
    return events;
  }

  startHold() {
    if (this.step?.kind === 'hold') {
      this.holding = true;
      this.held = 0;
    }
    return [];
  }

  update(dt) {
    const events = [];
    if (!this.holding) return events;
    this.held += dt;
    if (this.limitSeconds && this.held >= this.limitSeconds) {
      this.flaws.push({ step: this.step.id, how: 'over' });
      events.push({ type: 'flaw', step: this.step.id, how: 'over' });
      this.advance(events);
    } else if (!this.limitSeconds && this.held >= this.needSeconds) this.advance(events);
    return events;
  }

  releaseHold() {
    const events = [];
    if (!this.holding) return events;
    if (this.limitSeconds) {
      if (this.held < this.needSeconds) {
        this.flaws.push({ step: this.step.id, how: 'short' });
        events.push({ type: 'flaw', step: this.step.id, how: 'short' });
      }
      this.advance(events);
    } else {
      // No window: letting go early just means doing it again.
      this.holding = false;
      this.held = 0;
    }
    return events;
  }

  /** How the last hold with a window went: 'short', 'over' or 'good'. */
  outcome(stepId) {
    return this.flaws.find((f) => f.step === stepId)?.how ?? 'good';
  }
}

/**
 * What a finished job does to the quad. `target` is { engine, faults, fuel }. Returns a line for the toast.
 */
export function finishJob(job, target, P = DEFAULT_BENCH_PARAMS) {
  const { engine, faults, fuel } = target;
  const botched = job.botched;
  if (job.kind === 'plug') {
    engine.wear = Math.max(0, engine.wear - P.plugWearRemoved);
    engine.fouling = botched ? P.plugLeftFouling : 0;
    return botched ? 'New plug in, but it is not seated right' : 'New plug in, and it fires first time';
  }
  if (job.kind === 'carb') {
    faults.fix('carb');
    if (botched) faults.leave('carb', P.botchedLevel);
    return botched ? 'Carb back together, but it still is not quite right' : 'Carb is spotless';
  }
  if (job.kind === 'tyre') {
    faults.fix('puncture');
    target.tyres?.level(target.tyres.tune.stockPsi); // pumped up to the pressure it should be
    if (botched) faults.leave('puncture', P.botchedLevel);
    return botched ? 'Wheel is back on, but the tyre is not holding' : 'Tyre patched, pumped and holding';
  }
  if (job.kind === 'packing') {
    engine.silencerBlown = botched ? P.packingBotched : 0;
    return botched ? 'Silencer packed, though it is not quite right and still a bit loud' : 'Silencer repacked: quiet again';
  }
  if (job.kind === 'sump') {
    const short = job.outcome('pour') === 'short';
    if (target.sump) target.sump.level = short ? Math.max(target.sump.level, P.sumpShort) : 1;
    return short ? 'Oil topped up, though it is a touch under the top mark' : 'Oil up to the top mark';
  }
  const how = job.outcome('pour');
  fuel.oil = how === 'short' ? P.oilShort : how === 'over' ? P.oilOver : P.oilGood;
  return how === 'short' ? 'Oil topped up, though it looks a bit light' : how === 'over' ? 'Oil topped up, with a good glug too much' : 'Oil topped up to 50:1';
}

/** Which jobs a quad can have done: the pre-mix oil is for the two-strokes, the sump's for the petrol four-strokes. */
export function jobAvailable(kind, engine) {
  if (kind === 'oil') return engine.params.strokes === 2;
  if (kind === 'packing') return engine.params.strokes === 2;
  if (kind === 'sump') return engine.params.strokes !== 2 && !engine.params.runsOnDiesel;
  return true;
}

/** Is a quad's middle inside the bay painted on the floor? */
export function inBay(bay, x, z, margin = 0) {
  const c = Math.cos(bay.yaw ?? 0);
  const s = Math.sin(bay.yaw ?? 0);
  const dx = x - bay.x;
  const dz = z - bay.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= bay.halfX - margin && Math.abs(lz) <= bay.halfZ - margin;
}
