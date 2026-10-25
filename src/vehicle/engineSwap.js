// Engine swaps. A quad's engine can come out at the bench (the barn find's, once it runs) and go into another quad of the same sort. The engine
// takes its character with it: every engine number (idle, top revs, roughness, power, heat), its sound, and the wear it has. The quad keeps its
// body, drivetrain, tank and dash. The engine it replaces goes back on the spares shelf (workshop/spares.js), so a swap trades two engines.
// Pure logic, no Three.js. A "unit" here is anything with { spec, label, engine, audio: { params }, quad: { params, faults } }.

import { applyIdle } from './quadVariation.js';
import { startRunningIn } from '../engine/runningIn.js';

/** Specs that are not the girls' sort of quad: their engines stay where they are. */
const NOT_QUADS = ['tractor', 'utv', 'landRover', 'car', 'miniMoto', 'classicBike', 'threeWheeler'];

/** The condition an engine carries with it (the rest of ENGINE_KEPT belongs to the quad's systems: its battery, coolant, silencer). */
export const CONDITION_KEYS = ['wear', 'pistonWear', 'scuff', 'scar', 'runIn', 'bore', 'boreFit', 'seized'];

/**
 * Which engines can go in which: engines with the same family are interchangeable. Two-strokes with two-strokes, four-strokes with four-strokes,
 * and a manual's engine only with another manual's, so the cord, the oil system and the clutch all stay right. Null for a vehicle that has no
 * engine to swap.
 */
export function engineFamily(spec, params) {
  if (NOT_QUADS.some((k) => spec[k]) || params.noStarter || params.crankHandle) return null;
  return [
    `${params.strokes}t`,
    params.pullStart && 'cord',
    params.waterCooled && 'wet',
    (params.compressionIgnition || params.runsOnDiesel) && 'diesel',
    spec.manual ? 'manual' : 'cvt',
  ]
    .filter(Boolean)
    .join('-');
}

/** The family of the engine in a unit (an empty body has the family of the engine it lost). */
export function unitFamily(unit) {
  return engineFamily(unit.spec, unit.engine.params);
}

/** Whether a unit can have an engine pulled out: its own is in, and it is a sort of quad that has swappable engines. */
export function canPull(unit) {
  return !unit.engineOut && !!unitFamily(unit);
}

/** The first engine on the shelf that would fit this unit, or -1. */
export function fitIndex(engines, unit) {
  const family = unitFamily(unit);
  return family ? engines.findIndex((p) => p.family === family) : -1;
}

/** A plain copy of the unit's engine, as the shelf holds it. */
export function snapshotEngine(unit) {
  const e = unit.engine;
  return {
    from: unit.engineOrigin?.from ?? unit.spec.id,
    label: unit.engineOrigin?.label ?? unit.label,
    family: unitFamily(unit),
    params: { ...e.params },
    audio: { ...unit.audio.params },
    condition: Object.fromEntries(CONDITION_KEYS.filter((k) => k in e && e[k] !== null).map((k) => [k, e[k]])),
  };
}

/** Takes the engine out of the unit and returns it. The unit can't run until another goes in. */
export function pullEngine(unit) {
  const pack = snapshotEngine(unit);
  unit.engineOut = true;
  return pack;
}

/** Puts a pack's numbers and sound on a unit's engine, in place (the panel and the sound hold on to the same objects). */
function applyPack(unit, pack) {
  Object.assign(unit.engine.params, pack.params);
  Object.assign(unit.audio.params, pack.audio);
  for (const [k, v] of Object.entries(pack.condition ?? {})) if (k in unit.engine) unit.engine[k] = v;
  unit.engineOrigin = { from: pack.from, label: pack.label };
  unit.topRpm = unit.engine.params.maxRpm;
  // A different idle needs the clutch to bite above it (a CVT's engages a margin over idle).
  unit.idleRpm = unit.dealtIdle = applyIdle(unit.engine.params, unit.quad.params, unit.engine.params.idleRpmWarm);
}

/**
 * Fits a pack into the unit. `fit` is 1 for a good job and less for a botched one, which leaves the engine rocking on its mounts and a bit rough.
 * Returns the engine that came out (null if the body had none), for the shelf. The new engine wants running in.
 */
export function fitEngine(unit, pack, fit, P) {
  const old = unit.engineOut ? null : snapshotEngine(unit);
  applyPack(unit, pack);
  unit.engineOut = false;
  const e = unit.engine;
  e.fouling = 0;
  startRunningIn(e);
  if (fit < 1) {
    e.params.baseRoughness += P.swapBotchedRoughness;
    unit.quad.faults.leave('mounts', P.botchedLevel);
  }
  return old;
}

/** What the farm keeps of a swapped engine, or null for a quad still on its own. */
export function captureSwap(unit) {
  if (!unit.engineOrigin) return null;
  return { from: unit.engineOrigin.from, label: unit.engineOrigin.label, params: { ...unit.engine.params }, audio: { ...unit.audio.params } };
}

/** Puts a saved swapped engine back on a freshly dealt unit (its condition comes separately, with the rest of the engine's). */
export function restoreSwap(unit, s) {
  if (!s?.params) return;
  Object.assign(unit.engine.params, s.params);
  if (s.audio) Object.assign(unit.audio.params, s.audio);
  unit.engineOrigin = { from: s.from, label: s.label };
  unit.idleRpm = unit.dealtIdle = applyIdle(unit.engine.params, unit.quad.params, unit.engine.params.idleRpmWarm);
}

/** The words for an engine on the shelf or in a job. */
export function engineName(pack) {
  return `the ${pack.label}'s engine`;
}

const FAMILY_WORDS = { '2t': 'two-stroke', '4t': 'four-stroke', cord: 'pull-cord', wet: 'water-cooled', diesel: 'diesel', manual: 'for a manual', cvt: 'for a twist-and-go' };

/** "two-stroke, pull-cord, for a twist-and-go": what sort of engine it is, for the shelf. */
export function familyWords(family) {
  return family.split('-').map((k) => FAMILY_WORDS[k] ?? k).join(', ');
}
