// Amy's walk-round: before she rides a quad she squeezes the tyres and looks it over (and checks the oil, in game.js), and
// sometimes finds a slow puncture or another fault before you do, and says so. Jess goes straight to the starter.
// Pure logic: what a walk-round turns up, given the quad's tyres and faults. Lines are in walkLines.js.

export const DEFAULT_WALK_PARAMS = {
  amyWalks: 0.85, // chance Amy walks round a quad before she rides it (Jess never does)
  tyreFindChance: 0.85, // chance she notices a tyre that's flat or soft when she squeezes it
  faultFindChance: 0.55, // chance she spots a belt, cable or carb fault by looking and giving the throttle a flick
  punctureFrom: 0.12, // puncture level (0..1) from which the tyre is noticeably down
  softPsi: 1.2, // psi under stock a tyre is before she calls it soft (a puncture is dealt with first)
  faultFrom: 0.3, // level a belt, cable or carb fault has to reach before she can tell
  maxSaid: 2, // the most she mentions after one walk-round
};

export const WALK_PARAM_RANGES = {
  amyWalks: [0, 1, 0.05],
  tyreFindChance: [0, 1, 0.05],
  faultFindChance: [0, 1, 0.05],
  punctureFrom: [0, 0.6, 0.01],
  softPsi: [0.3, 3, 0.1],
  faultFrom: [0, 1, 0.05],
  maxSaid: [1, 4, 1],
};

/** Line keys for each thing she can find. */
export const WALK_FINDINGS = ['walkPuncture', 'walkSoftTyre', 'walkBelt', 'walkCable', 'walkCarb'];

const FAULT_FINDING = { belt: 'walkBelt', cable: 'walkCable', carb: 'walkCarb' };

/**
 * What a walk-round finds on this quad, most important first.
 * @param {{ tyres: object, faults: object, stockPsi?: number, random?: () => number }} quad
 * @returns {string[]} keys from WALK_FINDINGS
 */
export function walkRound({ tyres, faults, stockPsi = 4, random = Math.random }, P = DEFAULT_WALK_PARAMS) {
  const found = [];
  const punctured = faults.started.puncture && faults.levels.puncture >= P.punctureFrom;
  if (punctured && random() < P.tyreFindChance) found.push('walkPuncture');
  else if (!punctured) {
    const wheels = tyres.wheels ? tyres.wheels.map((w) => w.i) : tyres.psi.map((_, i) => i);
    const soft = wheels.some((i) => tyres.psi[i] <= stockPsi - P.softPsi);
    if (soft && random() < P.tyreFindChance) found.push('walkSoftTyre');
  }
  for (const kind of ['belt', 'cable', 'carb']) {
    if (faults.started[kind] && faults.levels[kind] >= P.faultFrom && random() < P.faultFindChance) found.push(FAULT_FINDING[kind]);
  }
  return found.slice(0, P.maxSaid);
}
