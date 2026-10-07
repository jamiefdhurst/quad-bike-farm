// Amy won't ride a quad she knows is faulty. What she knows comes from her walk-round (walkRound.js) and from what she had written in
// her logbook before the game began; she forgets it the moment the fault is put right, so "until it's fixed" needs no bookkeeping in
// the bench or the yard. Jess rides it anyway. Pure logic, no Three.js. Her lines are in walkLines.js.

import { DEFAULT_WALK_PARAMS } from './walkRound.js';

export const DEFAULT_WONT_PARAMS = {
  amyWontRide: 1, // chance, each time she learns of a fault, that she refuses to ride that quad until it's fixed (0 switches it off)
};

export const WONT_PARAM_RANGES = {
  amyWontRide: [0, 1, 0.05],
};

/** A history fault kind (faults.js) as the walk-round finding that would have told her about it. */
export const FINDING_OF_FAULT = { puncture: 'walkPuncture', belt: 'walkBelt', cable: 'walkCable', carb: 'walkCarb' };

/** The line she says for each finding when she won't ride it (keys in AMY_WALK_LINES). */
export const WONT_LINE = { walkPuncture: 'wontPuncture', walkSoftTyre: 'wontSoftTyre', walkBelt: 'wontBelt', walkCable: 'wontCable', walkCarb: 'wontCarb' };

const FAULT_OF_FINDING = { walkBelt: 'belt', walkCable: 'cable', walkCarb: 'carb' };

/** Is the thing she knew about still wrong with this quad? `quad` is { tyres, faults, stockPsi? }. */
export function stillWrong(finding, { tyres, faults, stockPsi = 4 }, W = DEFAULT_WALK_PARAMS) {
  if (finding === 'walkPuncture') return faults.started.puncture && faults.levels.puncture >= W.punctureFrom;
  if (finding === 'walkSoftTyre') {
    const wheels = tyres.wheels ? tyres.wheels.map((w) => w.i) : tyres.psi.map((_, i) => i);
    return wheels.some((i) => tyres.psi[i] <= stockPsi - W.softPsi);
  }
  const kind = FAULT_OF_FINDING[finding];
  return !!kind && faults.started[kind] && faults.levels[kind] >= W.faultFrom;
}

/** What one girl has been told or found is wrong, by quad id. */
export class FaultKnowledge {
  constructor(random = Math.random, P = DEFAULT_WONT_PARAMS) {
    this.random = random;
    this.P = P;
    this.known = new Map(); // quad id -> Set of findings she won't ride it for
  }

  /** She's found out about these. Each is something she'll refuse over with probability `amyWontRide`. */
  learn(id, findings) {
    for (const f of findings) {
      if (!WONT_LINE[f] || this.random() >= this.P.amyWontRide) continue;
      if (!this.known.has(id)) this.known.set(id, new Set());
      this.known.get(id).add(f);
    }
  }

  /** The first thing she knows is wrong with this quad and still is, or null. What has been put right is forgotten. */
  blocking(id, quad, W = DEFAULT_WALK_PARAMS) {
    const set = this.known.get(id);
    if (!set) return null;
    let first = null;
    for (const f of [...set]) {
      if (stillWrong(f, quad, W)) first ??= f;
      else set.delete(f);
    }
    if (!set.size) this.known.delete(id);
    return first;
  }
}
