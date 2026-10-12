// The jobs you do at the barn bench: change a plug, clean a carb, fix a tyre, top up the two-stroke oil.
// Each is a short run of steps, a press (one tap) or a hold (keep it down for a moment). Some holds
// have a window: let go too early and it's loose, hold on too long and it's over-done, and either leaves
// the job botched, so it works but not as well. Pure logic, no Three.js or DOM.

import { canFitBore, fitBore } from '../engine/bigBore.js';
import { canRebuildTopEnd, readScoring, rebuildTopEnd } from '../engine/topEnd.js';

export const DEFAULT_BENCH_PARAMS = {
  holdScale: 1, // multiplier on how long every hold takes, so the whole bench can be quicker or slower
  bayMargin: 0.35, // a quad counts as in the bay when its middle is this far inside the painted lines
  plugLeftFouling: 0.3, // a plug fitted badly: still fouled, as if it had never been changed
  plugWearRemoved: 0.15, // wear a new plug takes away
  botchedLevel: 0.2, // a carb, mount or tyre botched at the bench: the fault comes back at this level
  oilShort: 0.012, // oil fraction of the tank mix when the pour was too short (about 80:1, runs hot)
  oilGood: 0.02, // and when it was right (50:1)
  plugRichFouling: 0.3, // fouling at which the old plug looks sooty (rich running)
  plugLean: 0.15, // how lean it last ran (mixture below minus this) for the old plug to look white
  plugOilyWear: 0.35, // wear at which a two-stroke's old plug is wet with oil
  plugWornWear: 0.4, // wear at which a four-stroke's old plug has an electrode worn round
  sumpShort: 0.75, // sump level when the pour was too short (a bit under the top mark)
  oilOver: 0.05, // and when it was too much (about 20:1, smokes and fouls)
  coolantShort: 0.7, // coolant level left when the pour was too short
  coolantLeakLeft: 0.4, // share of its leak left after a badly tightened clip
  boreWearRemoved: 0.2, // wear a new piston and rings take away, with the big-bore kit
  boreBotchedFit: 0.55, // share of the kit's power left after a badly fitted one
  topEndScuffFrom: 0.05, // scuffing at which a two-stroke has a top end worth pulling down
  topEndDeepScuff: 0.5, // scuffing at which the bore looks deeply scored rather than lightly scuffed
  topEndSeizeWear: 0.15, // wear a seizure leaves, which the new piston and rings mostly take away (the toolbox strip down left 0.3)
  topEndWearRemoved: 0.2, // wear a new piston and rings take away
  topEndBotchedScuff: 0.3, // scuffing left after uneven head nuts or a forced barrel: it nips up again sooner
  crashBotched: 0.3, // a bent rod or rim not put quite true at the bench: it comes back at this level
  chainBotched: 0.35, // slack left in a chain adjusted badly (too loose, or pulled so tight it binds and wears)
  valvesBotchedLevel: 0.5, // how far out a valve clearance set badly is (too wide, or too tight if the screws were over-turned)
  chainOilShort: 0.5, // chain oil left after too little was put on
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
  chainBotched: [0, 1, 0.05],
  crashBotched: [0, 1, 0.05],
  chainOilShort: [0, 1, 0.05],
  valvesBotchedLevel: [0, 1, 0.05],
  topEndScuffFrom: [0, 0.5, 0.01],
  topEndDeepScuff: [0.1, 1, 0.05],
  topEndSeizeWear: [0, 1, 0.05],
  topEndWearRemoved: [0, 1, 0.05],
  topEndBotchedScuff: [0, 0.54, 0.02],
  boreWearRemoved: [0, 1, 0.05],
  boreBotchedFit: [0, 1, 0.05],
  coolantShort: [0.3, 1, 0.05],
  coolantLeakLeft: [0, 1, 0.05],
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
      { id: 'fit', text: 'Screw a new plug from the shelf in by hand', kind: 'press', part: 'plug' },
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
  mounts: {
    name: 'Renew the engine mounts',
    steps: [
      { id: 'brace', text: 'Put the jack under the sump to take the engine weight', kind: 'press' },
      { id: 'bolts', text: 'Undo the mount bolts with the spanner', kind: 'hold', need: 1 },
      { id: 'swap', text: 'Pull out the perished rubbers and drop the new ones in', kind: 'press' },
      { id: 'lower', text: 'Lower the engine back on to them', kind: 'press' },
      { id: 'tight', text: 'Do the bolts up: snug, not tight, or you crush the rubber', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
  tyre: {
    name: 'Fix a tyre',
    steps: [
      { id: 'jack', text: 'Jack the quad up', kind: 'press' },
      { id: 'off', text: 'Undo the nuts and take the wheel off', kind: 'hold', need: 1 },
      { id: 'patch', text: 'Find the hole and put a new inner tube in', kind: 'press', part: 'tube' },
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
  coolant: {
    name: 'Top up the coolant and mend the leak',
    steps: [
      { id: 'cool', text: 'Let it cool, then undo the radiator cap', kind: 'press' },
      { id: 'clip', text: 'Find the weeping hose joint and nip the clip up: snug, not tight', kind: 'hold', need: 0.7, limit: 1.5 },
      { id: 'pour', text: 'Pour in coolant: stop at the line', kind: 'hold', need: 0.9, limit: 1.8 },
      { id: 'bleed', text: 'Squeeze the top hose to bleed the air out, then cap on', kind: 'press' },
    ],
  },
  bore: {
    name: 'Fit the big-bore kit',
    steps: [
      { id: 'head', text: 'Undo the head nuts and lift the head off', kind: 'hold', need: 1 },
      { id: 'barrel', text: 'Slide the old barrel and piston off', kind: 'press' },
      { id: 'rings', text: 'Put the rings on the new piston and oil the bore', kind: 'press' },
      { id: 'fit', text: 'Fit the new barrel, easing it over the rings', kind: 'hold', need: 1.1 },
      { id: 'tight', text: 'Do the head nuts up evenly: snug, not tight', kind: 'hold', need: 0.8, limit: 1.6 },
    ],
  },
  chain: {
    name: 'Adjust and oil the chain',
    steps: [
      { id: 'guard', text: 'Take the chainguard off', kind: 'press' },
      { id: 'look', text: 'Pull the chain at the middle of its run and see how slack it is', kind: 'press', inspect: true },
      { id: 'axle', text: 'Slacken the rear axle nuts', kind: 'hold', need: 0.9 },
      { id: 'adjust', text: 'Draw the axle back to take the slack out: a finger of play, not bar tight', kind: 'hold', need: 0.7, limit: 1.5 },
      { id: 'oil', text: 'Oil the chain as you turn the wheel: a little, not a lot', kind: 'hold', need: 0.8, limit: 1.6 },
      { id: 'tight', text: 'Do the axle nuts up: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
      { id: 'on', text: 'Chainguard back on', kind: 'press' },
    ],
  },
  valves: {
    name: 'Set the valve clearances',
    steps: [
      { id: 'cover', text: 'Take the rocker cover off', kind: 'press' },
      { id: 'look', text: 'Slide the feeler gauge in under a rocker and feel how it sits', kind: 'press', inspect: true },
      { id: 'nut', text: 'Slacken the locknuts', kind: 'hold', need: 0.8 },
      { id: 'gap', text: 'Turn the screws until the gauge just drags: not too wide, not too tight', kind: 'hold', need: 0.8, limit: 1.6 },
      { id: 'lock', text: 'Hold the screws and do the locknuts up: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
      { id: 'on', text: 'Rocker cover back on', kind: 'press' },
    ],
  },
  crash: {
    name: 'Mend the crash damage',
    steps: [
      { id: 'jack', text: 'Jack the front of the quad up', kind: 'press' },
      { id: 'look', text: 'Spin each wheel and sight along the track rods', kind: 'press', inspect: true },
      { id: 'off', text: 'Undo the nuts and take the bent wheel and rod off', kind: 'hold', need: 1 },
      { id: 'true', text: 'Straighten the rod in the vice, or fit a straight rim: firm, not forced', kind: 'hold', need: 1.2, limit: 2.4 },
      { id: 'on', text: 'Bolt it all back on', kind: 'press' },
      { id: 'tight', text: 'Do the nuts up: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
  topEnd: {
    name: 'Rebuild the top end',
    steps: [
      { id: 'head', text: 'Undo the head nuts and lift the head off', kind: 'hold', need: 1 },
      { id: 'barrel', text: 'Ease the barrel up off the piston', kind: 'hold', need: 0.8 },
      { id: 'look', text: 'Look at the piston and the bore', kind: 'press', inspect: true },
      { id: 'piston', text: 'Take the new piston and rings off the shelf and fit them', kind: 'press', part: 'piston' },
      { id: 'refit', text: 'Ease the barrel down over the rings', kind: 'hold', need: 1.1 },
      { id: 'tight', text: 'Do the head nuts up evenly: snug, not tight', kind: 'hold', need: 0.8, limit: 1.6 },
    ],
  },
  // The barn find's own jobs (vehicle/barnFind.js): only the rusty quad has them.
  tarp: {
    name: 'Take the tarp off',
    steps: [
      { id: 'ropes', text: 'Untie the old ropes', kind: 'press' },
      { id: 'drag', text: 'Drag the tarp off, and mind the dust', kind: 'hold', need: 1.2 },
      { id: 'fold', text: 'Fold it up out of the way', kind: 'press' },
    ],
  },
  fuel: {
    name: 'Drain the varnished fuel',
    steps: [
      { id: 'tray', text: 'Put a tray under the tank', kind: 'press' },
      { id: 'drain', text: 'Open the drain: let the brown varnish run out', kind: 'hold', need: 1.5 },
      { id: 'flush', text: 'Flush it through: not too much', kind: 'hold', need: 0.6, limit: 1.4 },
      { id: 'shut', text: 'Close the drain and refit the pipe', kind: 'press' },
    ],
  },
  brake: {
    name: 'Free the seized brake',
    steps: [
      { id: 'soak', text: 'Soak the caliper in penetrating oil', kind: 'press' },
      { id: 'wait', text: 'Leave it to soak a minute, then tap it with the hammer', kind: 'press' },
      { id: 'work', text: 'Work the caliper free with the spanner: firm, not forced', kind: 'hold', need: 0.9, limit: 1.8 },
      { id: 'lever', text: 'Squeeze the lever: it moves', kind: 'press' },
    ],
  },
  battery: {
    name: 'Charge the battery',
    steps: [
      { id: 'lift', text: 'Lift the seat and the flat battery out', kind: 'press' },
      { id: 'clip', text: 'Clip on the charger and switch it on', kind: 'press' },
    ],
  },
};

export const JOB_KINDS = ['plug', 'carb', 'tyre', 'oil', 'sump', 'packing', 'coolant', 'bore', 'mounts', 'topEnd', 'chain', 'valves', 'crash'];

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

/** How slack the chain is, for the toast: you work out what it needs. */
export function chainLook(faults) {
  const level = faults.started.chain ? faults.levels.chain : 0;
  const dry = faults.chainDryness > 0.6 ? ' and bone dry' : '';
  if (level < 0.2) return `snug${dry}`;
  if (level < 0.5) return `a bit loose${dry}`;
  if (level < 0.8) return `hanging slack${dry}`;
  return `drooping nearly off the sprocket${dry}`;
}

/** What the feeler gauge says about the valve clearance, for the toast: you work out what it needs. */
export function valvesLook(faults) {
  if (faults.valveTight > 0.2) return 'a hard squeeze: the clearance is too tight';
  if (faults.valveLoose < 0.2) return 'a snug sliding fit: right';
  if (faults.valveLoose < 0.6) return 'a loose fit: a bit wide';
  return 'rattling about: the clearance is far too wide';
}

const WHEEL_WORDS = ['front left', 'front right', 'rear left', 'rear right'];

/** Which wheel, in words (the first four are the usual layout; anything else is just a number). */
export function wheelWords(faults, i) {
  if (!faults.wheelSides) return WHEEL_WORDS[i] ?? `wheel ${i + 1}`;
  const w = faults.wheelSides[i];
  return w ? `${w.front ? 'front' : 'rear'} ${w.side > 0 ? 'left' : 'right'}` : `wheel ${i + 1}`;
}

/** What spinning the wheels and sighting along the rods shows, for the toast: you work out what it needs. */
export function crashLook(faults) {
  const bits = [];
  if (faults.started.rod) bits.push(`the ${wheelWords(faults, faults.rodWheel)} track rod is bent`);
  if (faults.started.rim) bits.push(`the ${wheelWords(faults, faults.rimWheel)} rim runs out of true`);
  return bits.length ? bits.join(', and ') : 'everything runs true';
}

/** What the pulled-down barrel and piston look like, for the toast. */
export function scoringLook(engine, P = DEFAULT_BENCH_PARAMS) {
  return readScoring(engine, P).look;
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
  constructor(kind, params = DEFAULT_BENCH_PARAMS, spares = null) {
    this.spares = spares; // the shelf: a step with a `part` uses one up (spares.js)
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
    const part = this.step?.part;
    if (part && this.spares && !this.spares.take(part)) return [{ type: 'noPart', part }];
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
  if (job.kind === 'mounts') {
    faults.fix('mounts');
    if (botched) faults.leave('mounts', P.botchedLevel);
    return botched ? 'New mounts in, but one is crushed and the engine still rocks a bit' : 'New engine mounts in: it runs smoothly again';
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
  if (job.kind === 'coolant') {
    // The clip is the fix: nipped right the leak stops, too loose or too tight and some of it's left.
    const clip = job.outcome('clip') !== 'good';
    const short = job.outcome('pour') === 'short';
    if (clip) engine.coolantLeak *= P.coolantLeakLeft;
    else engine.coolantLeak = 0;
    engine.coolant = short ? P.coolantShort : 1;
    engine.coolantPuddle = Math.min(engine.coolantPuddle, 0.3);
    if (clip) return 'Topped up, though the clip is not right and it will weep a bit still';
    return short ? 'Mended, though the coolant is a touch under the line' : 'Hose joint mended and coolant up to the line';
  }
  if (job.kind === 'sump') {
    const short = job.outcome('pour') === 'short';
    if (target.sump && target.sump.level > 1) {
      target.sump.level = 1;
      return 'Drained back to the top mark';
    }
    if (target.sump) target.sump.level = short ? Math.max(target.sump.level, P.sumpShort) : 1;
    return short ? 'Oil topped up, though it is a touch under the top mark' : 'Oil up to the top mark';
  }
  if (job.kind === 'bore') {
    fitBore(engine, botched ? P.boreBotchedFit : 1, P);
    return botched ? 'Kit fitted, but the head is not torqued evenly: it will not pull as it should' : 'Big-bore kit fitted: it should pull much harder, and run hotter';
  }
  if (job.kind === 'topEnd') {
    rebuildTopEnd(engine, botched, P);
    return botched ? 'Back together on a new piston, but the head is uneven: it will nip up again sooner. Run it in gently' : 'New piston and rings in, and it turns freely. Run it in gently for a few minutes';
  }
  if (job.kind === 'chain') {
    // Adjusting it is the fix; the oil and the nuts only make it last. Done badly (or the nuts left loose) some of the slack comes back.
    const adjust = job.outcome('adjust') !== 'good' || job.outcome('tight') === 'short';
    faults.fix('chain');
    if (adjust) faults.leave('chain', P.chainBotched);
    faults.kept.chainLube = job.outcome('oil') === 'good' ? 1 : P.chainOilShort;
    if (adjust) return 'Chain back on, but the slack is not right and it will stretch again soon';
    return job.outcome('oil') === 'good' ? 'Chain adjusted and oiled: it runs quietly' : 'Chain adjusted, though it is a touch dry';
  }
  if (job.kind === 'valves') {
    // Setting the gap is the fix. Too little turn of the screws leaves it wide, too much leaves it tight; a locknut left slack lets it creep back wide.
    const gap = job.outcome('gap');
    faults.fix('valves');
    if (gap === 'over') {
      faults.leave('valves', P.valvesBotchedLevel);
      faults.kept.valveTight = true;
      return 'Cover back on, but the screws are turned too far: the valves are tight and it will start hard when it is hot and lack power';
    }
    if (gap !== 'good' || job.outcome('lock') === 'short') {
      faults.leave('valves', P.valvesBotchedLevel);
      return 'Cover back on, but the clearance is still a bit wide and it will keep ticking';
    }
    return 'Valve clearances set: the tick has gone';
  }
  if (job.kind === 'crash') {
    // Truing the metal is the fix. Too little work leaves it a bit out, too much (forced) leaves it that way too; loose nuts let it creep back.
    const bent = ['rod', 'rim'].filter((k) => faults.has(k));
    const wrong = job.outcome('true') !== 'good' || job.outcome('tight') === 'short';
    for (const k of bent) faults.fix(k);
    if (wrong) for (const k of bent) faults.leave(k, P.crashBotched);
    if (!bent.length) return 'Nothing was bent, but everything is checked and tight';
    return wrong ? 'Back together, but it is not quite true and still pulls a little' : 'Straight again: it steers true and the wheel runs without a wobble';
  }
  if (job.kind === 'tarp') return 'The tarp is off, and the dust is everywhere';
  if (job.kind === 'fuel') {
    engine.fouling = botched ? P.plugLeftFouling : 0;
    // The old fuel is gone, oil and all: it has to be filled again (petrol, or the pre-mix can for a two-stroke).
    if (fuel?.drain) {
      fuel.drain();
      fuel.oil = 0;
    }
    return botched ? 'Drained, though the tank still smells of varnish. It needs fuel' : 'Tank drained and flushed. It needs fuel now';
  }
  if (job.kind === 'brake') return botched ? 'The brake is free, but it is a bit stiff' : 'The brake is free and moves properly';
  if (job.kind === 'battery') return 'The charger is on: it will be about five minutes';
  const how = job.outcome('pour');
  fuel.oil = how === 'short' ? P.oilShort : how === 'over' ? P.oilOver : P.oilGood;
  return how === 'short' ? 'Oil topped up, though it looks a bit light' : how === 'over' ? 'Oil topped up, with a good glug too much' : 'Oil topped up to 50:1';
}

/** Which jobs a quad can have done: the pre-mix oil is for the two-strokes, the sump's for the petrol four-strokes, the chain's for the chain-driven. */
export function jobAvailable(kind, engine, P = DEFAULT_BENCH_PARAMS, chain = false, valves = engine.params.strokes !== 2) {
  if (kind === 'oil') return engine.params.strokes === 2;
  if (kind === 'packing') return engine.params.strokes === 2;
  if (kind === 'coolant') return !!engine.params.waterCooled;
  if (kind === 'bore') return canFitBore(engine);
  if (kind === 'topEnd') return canRebuildTopEnd(engine, P);
  if (kind === 'chain') return !!chain;
  if (kind === 'valves') return !!valves; // every four-stroke has them
  if (kind === 'tarp' || kind === 'fuel' || kind === 'brake' || kind === 'battery') return true;
  if (kind === 'sump') return engine.params.strokes !== 2 && !engine.params.runsOnDiesel;
  return true;
}

/** The part a job uses up, if it uses one (the step that has a `part`). */
export function jobPart(kind) {
  return JOBS[kind]?.steps.find((s) => s.part)?.part ?? null;
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
