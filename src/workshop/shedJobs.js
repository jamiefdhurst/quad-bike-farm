// The bench jobs that need the barn's shed kit (farm/shed.js): three for the compressor, four for the parts washer and four for the pit. They are
// listed on the bench's second page (R). Each puts right a fault nothing else can (vehicle/shedFaults.js). Same step format as benchJobs.js; pure.

export const SHED_JOBS = {
  // The compressor ---------------------------------------------------------
  pressures: {
    name: 'Set the tyre pressures',
    piece: 'compressor',
    steps: [
      { id: 'hose', text: 'Run the compressor hose out to the wheels', kind: 'press' },
      { id: 'gauge', text: 'Read the gauge on each wheel and let them down to the same', kind: 'press', inspect: true },
      { id: 'fill', text: 'Fill them from the compressor: stop at the right pressure', kind: 'hold', need: 1.1, limit: 2.3 },
      { id: 'caps', text: 'Valve caps back on', kind: 'press' },
    ],
  },
  bead: {
    name: 'Seal a leaking tyre bead',
    piece: 'compressor',
    steps: [
      { id: 'jack', text: 'Jack the vehicle up and take the wheels off', kind: 'press' },
      { id: 'soap', text: 'Brush soapy water round each bead and watch for bubbles', kind: 'press', inspect: true },
      { id: 'break', text: 'Break the leaking bead and clean the rim seat', kind: 'hold', need: 1 },
      { id: 'seat', text: 'Seat the bead with a blast of air: stop when it pops', kind: 'hold', need: 0.8, limit: 1.8 },
      { id: 'on', text: 'Wheels back on and the nuts done up', kind: 'press' },
    ],
  },
  valveCore: {
    name: 'Change the valve core',
    piece: 'compressor',
    steps: [
      { id: 'spit', text: 'Wet each valve and see which one blows bubbles', kind: 'press', inspect: true },
      { id: 'down', text: 'Let the tyre right down', kind: 'hold', need: 0.9 },
      { id: 'core', text: 'Wind the old core out with the tool and a new one in', kind: 'press' },
      { id: 'fill', text: 'Fill it from the compressor: stop at the right pressure', kind: 'hold', need: 1, limit: 2.1 },
    ],
  },
  // The parts washer -------------------------------------------------------
  degum: {
    name: 'Strip and dip the gummed carb',
    piece: 'washer',
    steps: [
      { id: 'off', text: 'Take the carb off its manifold', kind: 'hold', need: 1 },
      { id: 'look', text: 'Look at the jets: are they varnished?', kind: 'press', inspect: true },
      { id: 'dip', text: 'Strip it and soak the parts in the washer: until the varnish lifts', kind: 'hold', need: 1.2, limit: 2.6 },
      { id: 'blow', text: 'Blow every passage through and let it dry', kind: 'press' },
      { id: 'on', text: 'Bolt it back on and tighten the clamps: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
  tap: {
    name: 'Flush the fuel tap and filter',
    piece: 'washer',
    steps: [
      { id: 'tray', text: 'Turn the tap off and put a tray under it', kind: 'press' },
      { id: 'out', text: 'Unscrew the tap and the gauze filter', kind: 'hold', need: 0.9 },
      { id: 'look', text: 'Hold the gauze to the light: how much is blocked?', kind: 'press', inspect: true },
      { id: 'wash', text: 'Swill them in the washer: until the gauze is clear', kind: 'hold', need: 1, limit: 2.2 },
      { id: 'in', text: 'Refit them and turn the tap on', kind: 'press' },
    ],
  },
  chainWash: {
    name: 'Wash and oil the chain',
    piece: 'washer',
    steps: [
      { id: 'guard', text: 'Take the chainguard off and the chain off the sprockets', kind: 'press' },
      { id: 'look', text: 'Flex the links: how stiff with grit are they?', kind: 'press', inspect: true },
      { id: 'wash', text: 'Swill the chain in the washer: until it runs clean', kind: 'hold', need: 1.1, limit: 2.4 },
      { id: 'oil', text: 'Dry it and oil it link by link: a little, not a lot', kind: 'hold', need: 0.8, limit: 1.6 },
      { id: 'on', text: 'Refit the chain and the guard', kind: 'press' },
    ],
  },
  brakeWash: {
    name: 'Wash the caked brakes',
    piece: 'washer',
    steps: [
      { id: 'wheel', text: 'Take the wheels off to get at the calipers', kind: 'press' },
      { id: 'look', text: 'Look at the pads and the disc: how caked are they?', kind: 'press', inspect: true },
      { id: 'pads', text: 'Take the pads out and scrub them and the caliper in the washer', kind: 'hold', need: 1.1, limit: 2.4 },
      { id: 'refit', text: 'Refit the pads and the wheels', kind: 'press' },
      { id: 'bed', text: 'Do the wheel nuts up: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
  // The pit ------------------------------------------------------------------
  exhaust: {
    name: 'Patch the holed silencer',
    piece: 'pit',
    steps: [
      { id: 'under', text: 'Get down in the pit and look along the exhaust', kind: 'press', inspect: true },
      { id: 'clamps', text: 'Slacken the clamps and ease the silencer down', kind: 'hold', need: 0.9 },
      { id: 'patch', text: 'Wrap the hole with exhaust repair bandage: firm, not over-tight', kind: 'hold', need: 1, limit: 2 },
      { id: 'refit', text: 'Lift it back on and do the clamps up: snug, not tight', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
  gasket: {
    name: 'Renew the sump gasket',
    piece: 'pit',
    steps: [
      { id: 'under', text: 'Get down in the pit and look at the sump for weeping oil', kind: 'press', inspect: true },
      { id: 'drain', text: 'Drain the oil into a tray', kind: 'hold', need: 1.2 },
      { id: 'bolts', text: 'Undo the sump bolts and drop the pan', kind: 'hold', need: 1 },
      { id: 'gasket', text: 'Clean both faces and lay the new gasket', kind: 'press' },
      { id: 'tight', text: 'Do the bolts up evenly: snug, not tight, or you squash the gasket', kind: 'hold', need: 0.7, limit: 1.5 },
      { id: 'fill', text: 'Put the oil back in', kind: 'press' },
    ],
  },
  caliper: {
    name: 'Free the dragging caliper',
    piece: 'pit',
    steps: [
      { id: 'under', text: 'Get down in the pit and feel which wheel is hot', kind: 'press', inspect: true },
      { id: 'off', text: 'Undo the caliper bolts and slide it off the disc', kind: 'hold', need: 0.9 },
      { id: 'piston', text: 'Work the piston back with the clamp: firm, not forced', kind: 'hold', need: 0.9, limit: 1.8 },
      { id: 'slide', text: 'Grease the slide pins and refit the caliper', kind: 'press' },
    ],
  },
  bearing: {
    name: 'Replace the worn wheel bearing',
    piece: 'pit',
    steps: [
      { id: 'under', text: 'Spin each wheel from the pit and listen for the grumble', kind: 'press', inspect: true },
      { id: 'hub', text: 'Take the wheel and the hub off', kind: 'hold', need: 1 },
      { id: 'press', text: 'Press the old bearing out and the new one in: square, not forced', kind: 'hold', need: 1.1, limit: 2.3 },
      { id: 'pack', text: 'Pack it with grease and refit the hub', kind: 'press' },
      { id: 'nut', text: 'Do the axle nut up: snug, not tight, or it runs hot', kind: 'hold', need: 0.6, limit: 1.3 },
    ],
  },
};

/** The order they are listed in on the second page. */
export const SHED_JOB_KINDS = ['pressures', 'bead', 'valveCore', 'degum', 'tap', 'chainWash', 'brakeWash', 'exhaust', 'gasket', 'caliper', 'bearing'];

/** The fault each job is for (null: it works on whatever is wrong with the tyres). */
export const SHED_JOB_FAULT = {
  bead: 'tyreLeak',
  valveCore: 'valveCore',
  degum: 'carbGum',
  tap: 'tapClog',
  chainWash: 'chainGrit',
  brakeWash: 'brakeMud',
  exhaust: 'exhaustHole',
  gasket: 'gasket',
  caliper: 'caliper',
  bearing: 'bearing',
};

/**
 * Whether the vehicle can have this job, and if not why not. `have(piece)` says whether the piece is standing in the barn, `atPit` whether the vehicle is
 * in the bay the pit is under, `hasCarb`, `hasChain` and `hasSump` what it is built with.
 */
export function shedJobWhyNot(kind, { have, atPit = false, hasCarb = true, hasChain = false, hasSump = false }) {
  const def = SHED_JOBS[kind];
  if (!def) return 'No such job';
  if (!have(def.piece)) return def.piece === 'compressor' ? 'needs the compressor' : def.piece === 'washer' ? 'needs the parts washer' : 'needs the pit';
  if (def.piece === 'pit' && !atPit) return 'roll it into the big bay, over the pit';
  if (kind === 'degum' && !hasCarb) return 'it has no carb';
  if (kind === 'chainWash' && !hasChain) return 'it has no chain';
  if (kind === 'gasket' && !hasSump) return 'it has no sump gasket to weep';
  return null;
}

const WHEEL_WORDS = ['front left', 'front right', 'rear left', 'rear right'];
const wheelName = (faults, i) => {
  if (!faults.wheelSides) return WHEEL_WORDS[i] ?? `wheel ${i + 1}`;
  const w = faults.wheelSides[i];
  return w ? `${w.front ? 'front' : 'rear'} ${w.side > 0 ? 'left' : 'right'}` : `wheel ${i + 1}`;
};

/** What the inspect step tells you, for the toast: you work out what it needs. */
export function shedLook(kind, faults, tyres = null) {
  const level = (k) => (faults.started[k] ? faults.levels[k] : 0);
  const grade = (l, none, little, lot, bad) => (l < 0.1 ? none : l < 0.4 ? little : l < 0.75 ? lot : bad);
  switch (kind) {
    case 'pressures': {
      const gauge = tyres ? tyres.psi.map((v) => v.toFixed(1)).join(', ') : '?';
      const off = faults.started.tyreUneven ? `, and the ${wheelName(faults, faults.wheelOf.tyreUneven)} is well down on the rest` : '';
      const cold = faults.started.tyreCold ? ', and the cold has pulled them all down' : '';
      return `The gauge reads ${gauge} psi${off}${cold}`;
    }
    case 'bead':
      return grade(level('tyreLeak'), 'no bubbles anywhere: the beads are sound', 'a thin string of bubbles at one bead: a slow weep', 'a steady foam at the bead: it is leaking air', 'it fizzes all round the bead: the tyre is hardly sealing');
    case 'valveCore':
      return faults.started.valveCore ? `bubbles blow from the ${wheelName(faults, faults.wheelOf.valveCore)} valve: the core is not sealing` : 'every valve holds the spit still: the cores are sound';
    case 'degum':
      return grade(level('carbGum'), 'the jets are bright and clean', 'a faint amber film in the jets', 'the jets are crusted with brown varnish', 'the jets are blocked solid with varnish');
    case 'tap':
      return grade(level('tapClog'), 'the gauze is clear: light shows through', 'a dusting of sediment on the gauze', 'the gauze is half blocked with sediment', 'the gauze is plugged: no light comes through at all');
    case 'chainWash':
      return grade(level('chainGrit'), 'the links flex freely and the chain is clean', 'a little gritty paste in the rollers', 'the rollers are packed with grit and stiff', 'the chain is a solid rope of dried mud');
    case 'brakeWash':
      return grade(level('brakeMud'), 'the pads and disc are clean', 'a skin of dried mud on the pads', 'mud packed round the pads and glazing the disc', 'the caliper is caked solid and the pads are glazed');
    case 'exhaust':
      return grade(level('exhaustHole'), 'the silencer is sound apart from surface rust', 'a pinhole in the seam with a little black soot round it', 'a hole the size of a coin, blowing soot', 'the silencer is rusted through and flapping');
    case 'gasket':
      return grade(level('gasket'), 'the sump is dry', 'a damp patch along the gasket line', 'oil running down the sump and dripping', 'the sump is wet with oil and dripping steadily');
    case 'caliper':
      return faults.started.caliper ? `the ${wheelName(faults, faults.wheelOf.caliper)} disc is hot to touch and the wheel drags` : 'every disc is cool and spins freely';
    case 'bearing':
      return faults.started.bearing ? `the ${wheelName(faults, faults.wheelOf.bearing)} wheel grumbles and has play when you rock it` : 'every wheel spins quietly with no play';
    default:
      return 'nothing to see';
  }
}

/**
 * What a finished shed job does. `target` is { engine, faults, fuel, tyres, sump }; `P` the bench params (botchedLevel). Returns a line for the toast.
 * Done right it clears the fault; botched (a hold let go early or held on too long) it comes back at `botchedLevel`.
 */
export function finishShedJob(job, target, P) {
  const { faults, tyres } = target;
  const botched = job.botched;
  const stock = tyres?.tune?.stockPsi ?? 4;
  const kind = SHED_JOB_FAULT[job.kind];
  const clear = () => {
    faults.fix(kind);
    if (botched) faults.leave(kind, P.botchedLevel);
  };
  switch (job.kind) {
    case 'pressures': {
      // Right: all four at stock. Short: a touch under. Over: a touch over. Either way the cold and the odd tyre are dealt with.
      const how = job.outcome('fill');
      faults.fix('tyreCold');
      faults.fix('tyreUneven');
      tyres?.level(how === 'short' ? stock - P.pressureOff : how === 'over' ? stock + P.pressureOff : stock);
      return how === 'good' ? 'All four tyres to the same pressure' : how === 'short' ? 'Pumped up, though they are a touch under' : 'Pumped up, though they are a touch hard';
    }
    case 'bead':
      clear();
      tyres?.level(stock);
      return botched ? 'Bead reseated, but it is not quite sealing and will go soft again' : 'Bead sealed: the tyre holds its pressure';
    case 'valveCore':
      clear();
      tyres?.level(stock);
      return botched ? 'New core in, but it still weeps a little' : 'New core in: the tyre holds its pressure';
    case 'degum':
      clear();
      faults.fix('carb'); // the whole carb is stripped, so the ordinary dirt goes as well
      return botched ? 'Carb back on, but there is still some varnish in the jets' : 'Carb spotless, jets clear: it idles and pulls as it should';
    case 'tap':
      clear();
      return botched ? 'Tap refitted, but the gauze is not quite clear' : 'Tap and gauze clear: fuel flows freely again';
    case 'chainWash':
      clear();
      faults.kept.chainLube = job.outcome('oil') === 'good' ? 1 : P.chainOilShort;
      return botched ? 'Chain refitted, but it is still a little gritty' : 'Chain clean and oiled: it runs quietly';
    case 'brakeWash':
      clear();
      return botched ? 'Brakes back together, but they are not quite clean and still grab oddly' : 'Brakes scrubbed clean: they bite properly again';
    case 'exhaust':
      clear();
      return botched ? 'Silencer back on, but the patch is not sealing and it still blows' : 'Silencer patched: it is quiet again';
    case 'gasket':
      clear();
      return botched ? 'New gasket in, but it is not seating evenly and will weep again' : 'New gasket in: the sump stays dry';
    case 'caliper':
      clear();
      return botched ? 'Caliper back on, but it still drags a little' : 'Caliper free: the wheel spins and the disc stays cool';
    case 'bearing':
      clear();
      return botched ? 'New bearing in, but it is a little tight and will wear quickly' : 'New bearing in: the wheel is silent and runs true';
    default:
      return 'Done';
  }
}
