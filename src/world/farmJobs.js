// Farm jobs: the day's list on the chalkboard on the barn, and the muck job (fork muck from the heap into the tipping trailer, then spread
// it on the stubble from the raised tub as you drive slowly). Pure logic, no Three.js: the game feeds it where the trailer is and what the
// tub is doing, and draws what it says (world/muckView.js, world/jobBoard.js). Tested in tests/farmJobs.test.js.

import { SPRAY_JOB } from './spraying.js';

export const DEFAULT_MUCK_PARAMS = {
  forkSeconds: 12, // holding E at the heap fills an empty tub in this long
  forkReach: 5, // metres from the heap's edge to the trailer that you can still fork it in
  spreadTipTo: 0.4, // how far T tilts the tub when there is muck in it: past spreadTipAt, short of the slide, and it holds there
  spreadTipAt: 0.3, // how far up the tub must be before muck starts to run out of the back (it all comes out in a heap at the slide)
  spreadMinSpeed: 0.4, // m/s: slower than this it is just piling up behind you
  spreadMaxSpeed: 2.2, // m/s: faster than this the tub lowers itself, so muck stops
  patchSpacing: 1.8, // metres of travel between one patch of muck and the next
  patchesPerLoad: 22, // patches a full tub makes: about forty metres of strip
  patchesNeeded: 14, // patches laid on stubble for the job to count as done
  towWeight: 3, // a full tub drags like this many things in it (npc/towLoad)
};

export const MUCK_PARAM_RANGES = {
  forkSeconds: [2, 40, 0.5],
  forkReach: [1, 12, 0.5],
  spreadTipTo: [0.1, 0.49, 0.01],
  spreadTipAt: [0.05, 0.6, 0.01],
  spreadMinSpeed: [0.05, 2, 0.05],
  spreadMaxSpeed: [0.5, 5, 0.1],
  patchSpacing: [0.5, 5, 0.1],
  patchesPerLoad: [4, 60, 1],
  patchesNeeded: [2, 40, 1],
  towWeight: [0, 8, 0.5],
};

/** Metres from (x, z) to the heap's rectangle (0 on it). */
export function distanceToHeap(heap, x, z) {
  const dx = Math.max(Math.abs(x - heap.x) - heap.halfX, 0);
  const dz = Math.max(Math.abs(z - heap.z) - heap.halfZ, 0);
  return Math.hypot(dx, dz);
}

/**
 * The muck in the tub and the strip it lays. `load` is 0..1. `laid` counts patches dropped on stubble this job, `piled` the ones tipped
 * in a heap. Both are reset when a new job starts (the tub is empty again and a load is forked in).
 */
export class MuckLoad {
  constructor(params = { ...DEFAULT_MUCK_PARAMS }) {
    this.p = params;
    this.load = 0;
    this.laid = 0;
    this.done = false;
    this.travel = 0; // metres since the last patch
    this.last = null; // { x, z } where the trailer was
    this.started = false; // the job has begun (some muck forked in)
  }

  get full() {
    return this.load >= 0.999;
  }

  get empty() {
    return this.load <= 0.001;
  }

  /** Whether the trailer is near enough the heap, and the tub down, to fork muck in. */
  canFork(heap, x, z, tip) {
    return !!heap && tip <= 0.02 && !this.full && distanceToHeap(heap, x, z) <= this.p.forkReach;
  }

  /** One step of forking while E is held. Returns the events: 'start' the first time, 'full' when the tub fills. */
  fork(dt) {
    const events = [];
    if (this.full) return events;
    if (!this.started) {
      this.started = true;
      this.laid = 0;
      this.done = false;
      events.push({ type: 'start' });
    }
    this.load = Math.min(1, this.load + dt / this.p.forkSeconds);
    if (this.full) events.push({ type: 'full' });
    return events;
  }

  /**
   * One step as the trailer moves. `s`: x, z, speed (m/s along the trailer), tip (the tub, 0..1), onStubble. Returns events:
   * { type: 'patch', x, z } for each patch of muck dropped, { type: 'pile', x, z } if the tub went right up and slid the lot out, 'wrong'
   * once when it is dropping muck on something that isn't stubble, and 'done' when enough has been laid.
   */
  update(dt, s) {
    const p = this.p;
    const events = [];
    const last = this.last;
    this.last = { x: s.x, z: s.z };
    if (this.empty) {
      this.travel = 0;
      return events;
    }
    if (s.tip >= s.slideAt && s.speed < p.spreadMinSpeed) {
      // Tipped right up while standing about: it all slides out in one heap.
      this.load = 0;
      this.started = false;
      events.push({ type: 'pile', x: s.x, z: s.z });
      return events;
    }
    const flowing = s.tip >= p.spreadTipAt && s.speed >= p.spreadMinSpeed && s.speed <= p.spreadMaxSpeed;
    if (!flowing || !last) {
      if (!flowing) this.travel = 0;
      return events;
    }
    this.travel += Math.hypot(s.x - last.x, s.z - last.z);
    while (this.travel >= p.patchSpacing && !this.empty) {
      this.travel -= p.patchSpacing;
      this.load = Math.max(0, this.load - 1 / p.patchesPerLoad);
      if (s.onStubble) {
        this.laid += 1;
        events.push({ type: 'patch', x: s.x, z: s.z });
      } else events.push({ type: 'wrong', x: s.x, z: s.z });
    }
    if (!this.done && this.laid >= p.patchesNeeded) {
      this.done = true;
      events.push({ type: 'done' });
    }
    if (this.empty) this.started = false; // that load is spent: forking again is a new go
    return events;
  }

  /** Clears everything for a new go (the debug panel's reset). */
  reset() {
    this.load = 0;
    this.laid = 0;
    this.done = false;
    this.travel = 0;
    this.last = null;
    this.started = false;
  }
}

// The jobs there are. `needs` is a layout key the job can't happen without (so a farm without a muck heap leaves it off the board).
export const FARM_JOBS = {
  muck: {
    label: 'Muck out',
    chalk: 'Muck from the heap onto the stubble',
    hint: 'Fork it into the little trailer, tip the tub a bit and drive slowly over the stubble',
    needs: 'muckHeap',
  },
  silage: {
    label: 'Silage to the Dutch barn',
    chalk: 'Three silage bales into the Dutch barn',
    hint: 'Spike them with the tractor, carry them east and leave them on the floor of the open bay',
    needs: 'dutchBarn',
  },
  hay: {
    label: 'Make hay',
    chalk: 'Cut the hay patch, bale it and stack it in the Dutch barn',
    hint: 'Mow and bale the patch in the north field with the tractor, load the bales on the trailer and take them to the Dutch barn',
    needs: 'hayMeadow',
  },
  spray: SPRAY_JOB, // only on the board while the field wants it (the game leaves it off for the days a spray lasts)
};

export const DEFAULT_JOB_BOARD_PARAMS = {
  jobsPerDay: 2, // how many of the jobs that exist go on the board (all of them, while there are fewer)
};

export const JOB_BOARD_PARAM_RANGES = { jobsPerDay: [1, 6, 1] };

/** The ids of the jobs this farm can do (its layout has what they need). */
export function availableJobs(layout, jobs = FARM_JOBS) {
  return Object.keys(jobs).filter((id) => !jobs[id].needs || layout[jobs[id].needs]);
}

/** Picks `count` of `ids` with `random` (a function returning 0..1), in a repeatable order. */
export function pickJobs(ids, count, random) {
  const pool = [...ids];
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

/** Today's list: what is on the chalkboard and what has been ticked off. */
export class JobBoard {
  constructor({ ids, random, params = { ...DEFAULT_JOB_BOARD_PARAMS }, jobs = FARM_JOBS }) {
    this.p = params;
    this.jobs = jobs;
    this.today = pickJobs(ids, params.jobsPerDay, random);
    this.finished = new Set();
  }

  has(id) {
    return this.today.includes(id);
  }

  /** Adds a job of the day that isn't one of the fixed ones (a service for a quad that needs it): `def` is { chalk, hint }. It goes on top of `jobsPerDay`. */
  add(id, def) {
    if (this.today.includes(id)) return;
    this.jobs = { ...this.jobs, [id]: def };
    this.today.push(id);
  }

  /** Ticks a job off. Returns true the first time, and whether that cleared the board is `cleared`. */
  complete(id) {
    if (!this.has(id) || this.finished.has(id)) return false;
    this.finished.add(id);
    this.onComplete?.(id); // the game pays for it (farm/classifieds.js)
    return true;
  }

  get cleared() {
    return this.today.length > 0 && this.today.every((id) => this.finished.has(id));
  }

  /** The board's lines: { id, text, done }. */
  lines() {
    return this.today.map((id) => ({ id, text: this.jobs[id].chalk, hint: this.jobs[id].hint, done: this.finished.has(id) }));
  }
}
