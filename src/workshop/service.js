// A proper service (TODO 129, issue 24): the bench jobs strung together in order for a quad, so a day at the bench ends with it running
// smoother, and the chalkboard's service jobs for a quad that is in a bad way. Pure logic, no Three.js or DOM: the bench feeds it the facts
// about a quad and runs the jobs themselves (benchJobs.js). Tested in tests/service.test.js.

export const DEFAULT_SERVICE_PARAMS = {
  serviceSmooth: 0.05, // build roughness a full service with nothing botched takes off (never below the quad's own best)
  bookWear: 0.5, // wear at which Amy says it is due a service, and a full one goes on the board
  dueWear: 0.3, // wear at which a new plug is due (a partial service)
  dueFouling: 0.25, // fouling at which a new plug is due
  dueClog: 0.3, // air filter clog at which a clean is due
  dueSump: 0.8, // sump level under which the oil is due
  dueOil: 0.015, // pre-mix oil fraction under which the two-stroke oil is due
  dueFault: 0.2, // chain or belt fault level at which an adjustment is due
  boardChance: 0.7, // chance a quad that is due a service gets it put on the board for the day
};

export const SERVICE_PARAM_RANGES = {
  serviceSmooth: [0, 0.3, 0.01],
  bookWear: [0.1, 1, 0.05],
  dueWear: [0.05, 1, 0.05],
  dueFouling: [0.05, 1, 0.05],
  dueClog: [0.05, 1, 0.05],
  dueSump: [0.3, 1, 0.05],
  dueOil: [0.005, 0.05, 0.001],
  dueFault: [0.05, 1, 0.05],
  boardChance: [0, 1, 0.05],
};

/** The order a service goes in, and what each is called on the board. */
export const SERVICE_ORDER = ['plug', 'filter', 'oil', 'sump', 'chain', 'belt'];
const SHORT = { plug: 'plug', filter: 'air filter', oil: 'oil', sump: 'oil', chain: 'chain', belt: 'belt' };

/**
 * The jobs a quad has in a full service. `facts`: { petrol (not a diesel), strokes, hasFilter, hasChain, hasBelt, runsOnDiesel }.
 * A diesel has no plug or sump on the bench; a two-stroke has pre-mix oil, not a sump; the chain-driven have a chain, the rest a belt.
 */
export function servicePlan(facts) {
  const out = [];
  if (!facts.compressionIgnition) out.push('plug');
  if (facts.hasFilter) out.push('filter');
  if (facts.strokes === 2) out.push('oil');
  else if (!facts.runsOnDiesel) out.push('sump');
  if (facts.hasChain) out.push('chain');
  else if (facts.hasBelt) out.push('belt');
  return out;
}

/** What is due on a quad now, from its state: { wear, fouling, clog, sump (level or null), oil (fraction or null), chain, belt } (levels 0..1). */
export function serviceDue(plan, s, P = DEFAULT_SERVICE_PARAMS) {
  const due = [];
  for (const kind of plan) {
    if (kind === 'plug' && (s.wear >= P.dueWear || s.fouling >= P.dueFouling)) due.push(kind);
    else if (kind === 'filter' && s.clog >= P.dueClog) due.push(kind);
    else if (kind === 'oil' && s.oil !== null && s.oil < P.dueOil) due.push(kind);
    else if (kind === 'sump' && s.sump !== null && s.sump < P.dueSump) due.push(kind);
    else if (kind === 'chain' && s.chain >= P.dueFault) due.push(kind);
    else if (kind === 'belt' && s.belt >= P.dueFault) due.push(kind);
  }
  return due;
}

/** Is it due a service by the book (Amy's nag, and the board's full service)? */
export function dueBook(s, P = DEFAULT_SERVICE_PARAMS) {
  return s.wear >= P.bookWear;
}

/**
 * The service job for the board, if one qualifies: the quad most in need. A quad past `bookWear` gets the full plan; otherwise one with
 * two or more things due gets just those (a partial service). `quads`: [{ id, name, plan, state }]. Returns { id, name, kinds, full } or null.
 * `random` (0..1) decides whether it goes up at all, so not every bad quad is on the board every time.
 */
export function pickServiceJob(quads, random, P = DEFAULT_SERVICE_PARAMS) {
  let best = null;
  for (const q of quads) {
    if (!q.plan.length) continue;
    const full = dueBook(q.state, P);
    const kinds = full ? q.plan : serviceDue(q.plan, q.state, P);
    if (!full && kinds.length < 2) continue;
    const score = full ? 10 + q.state.wear : kinds.length;
    if (!best || score > best.score) best = { id: q.id, name: q.name, kinds, full, score };
  }
  if (!best || random() >= P.boardChance) return null;
  const { score, ...job } = best;
  return job;
}

/** The chalk for a service job: "Service the blue" for a full one, "Blue: plug, air filter" for a part. */
export function serviceChalk(job) {
  return job.full ? `Full service on the ${job.name.toLowerCase()}` : `${job.name}: ${job.kinds.map((k) => SHORT[k]).join(', ')}`;
}

/** A service job on the board: done when each of its kinds has been done at the bench on that quad and not botched. */
export class ServiceJob {
  constructor({ id, name, kinds, full }) {
    this.id = id;
    this.name = name;
    this.kinds = [...kinds];
    this.full = full;
    this.left = new Set(kinds);
  }

  /** A bench job finished on a quad. Returns true when that was the last thing left. */
  note(unitId, kind, botched) {
    if (unitId !== this.id || botched || !this.left.has(kind)) return false;
    this.left.delete(kind);
    return this.left.size === 0;
  }
}

/** A full service in progress on one quad: the plan, and how each step went. */
export class ServiceRun {
  constructor(unitId, kinds) {
    this.unitId = unitId;
    this.kinds = [...kinds];
    this.results = []; // [{ kind, botched }]
  }

  get next() {
    return this.kinds[this.results.length] ?? null;
  }

  get finished() {
    return this.results.length >= this.kinds.length;
  }

  /** Nothing botched anywhere. */
  get clean() {
    return this.results.every((r) => !r.botched);
  }

  record(kind, botched) {
    if (kind === this.next) this.results.push({ kind, botched: !!botched });
  }
}

/**
 * A finished, clean full service takes `serviceSmooth` off the engine's build roughness, but never below the quad's own best (`best`, the low end of
 * its spec's roughnessRange). Returns how much it took off.
 */
export function applyServiceReward(engine, best, run, P = DEFAULT_SERVICE_PARAMS) {
  if (!run.finished || !run.clean) return 0;
  const floor = best ?? 0;
  const before = engine.params.baseRoughness;
  engine.params.baseRoughness = Math.max(Math.min(before, floor), before - P.serviceSmooth);
  return before - engine.params.baseRoughness;
}

/** The facts servicePlan wants, read off a vehicle unit ({ engine, quad }). */
export function factsOf(unit) {
  const ep = unit.engine.params;
  const f = unit.quad.faults;
  return {
    compressionIgnition: !!ep.compressionIgnition,
    runsOnDiesel: !!ep.runsOnDiesel,
    strokes: ep.strokes,
    hasFilter: !!unit.quad.filter,
    hasChain: !!f.hasChain,
    hasBelt: !f.hasChain && !f.hasClutch && !unit.quad.tractor && !unit.quad.landRover,
  };
}

/** The state serviceDue wants, read off a vehicle unit. */
export function stateOf(unit) {
  const q = unit.quad;
  return {
    wear: unit.engine.wear,
    fouling: unit.engine.fouling,
    clog: q.filter?.clog ?? 0,
    sump: q.sump ? q.sump.level : null,
    oil: unit.engine.params.strokes === 2 ? q.fuel?.oil ?? null : null,
    chain: q.faults.levels.chain,
    belt: q.faults.levels.belt,
  };
}
