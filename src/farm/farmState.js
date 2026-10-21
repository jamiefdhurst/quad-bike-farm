// What the farm keeps from one day to the next, taken from the running game and put back into a freshly dealt one. A vehicle
// keeps its condition (hours, wear, faults left unfixed, the fuel and oil, its tyres, its tuning) but not where it was parked;
// overnight its battery runs down a little and its mud dries and drops off. The girls keep half their favour, what you taught
// them and a romance that got as far as the quad; a falling-out that wasn't made up leaves them cool in the morning.
// Pure: works on the game's objects through the fields named here, so a test can use stand-ins. See DECISIONS.md, TODO 15.

import { DEFAULT_FARM_PARAMS } from './farmSave.js';
import { TAP_POSITIONS } from '../vehicle/fuelSystem.js';

// Engine values that are its condition rather than its running state (rpm, heat, choke). Restored only when the save has them.
export const ENGINE_KEPT = ['wear', 'pistonWear', 'fouling', 'scuff', 'seized', 'silencerBlown', 'silencerOff', 'runIn', 'scar', 'coolant', 'coolantLeak', 'thermostat', 'boiled', 'dieselSoak', 'bore', 'boreFit', 'battery', 'batteryOut'];
const FUEL_KEPT = ['oil', 'diesel', 'water', 'sediment', 'additive', 'wax', 'antiGel', 'airLock'];
const FAULT_FIELDS = ['levels', 'started', 'caps', 'kept', 'wheelOf']; // kept: the chain's oil and whether it is off the sprocket; wheelOf: the shed faults' wheels

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const copyKnown = (to, from, keys) => {
  for (const k of keys) if (k in to && (num(from?.[k]) || typeof from?.[k] === 'boolean')) to[k] = from[k];
};

/** One vehicle's condition as plain data. `extra` carries what the game holds outside the unit (its tuning, the barn find's progress). */
export function captureVehicle(unit, extra = {}) {
  const e = unit.engine;
  const q = unit.quad;
  const out = {
    idle: unit.dealtIdle ?? null,
    roughness: e.params.baseRoughness,
    hours: q.usage.hours,
    odo: q.usage.odoMiles,
    engine: Object.fromEntries(ENGINE_KEPT.filter((k) => k in e).map((k) => [k, e[k]])),
    keyOn: !!e.ignitionOn,
    running: !!e.isRunning, // a running engine is taken as fine overnight: the key is only "left on" when the engine is not going
    filter: q.filter?.clog ?? 0,
    fuel: { litres: q.fuel.litres, tap: q.fuel.tap, ...Object.fromEntries(FUEL_KEPT.map((k) => [k, q.fuel[k] ?? 0])) },
    faults: { tyre: q.faults.tyre, rodWheel: q.faults.rodWheel, rimWheel: q.faults.rimWheel, ...Object.fromEntries(FAULT_FIELDS.map((k) => [k, { ...q.faults[k] }])) },
    tyres: q.tyres ? { psi: [...q.tyres.psi], brand: { ...q.tyres.brand }, tread: { ...q.tyres.tread } } : null,
    sump: q.sump ? q.sump.level : null,
    spotlamps: q.spotlamps?.fitted ? q.spotlamps.capture() : null,
    snorkel: q.snorkel?.fitted ? q.snorkel.capture() : null,
    tapStiff: q.quirks?.tapStiff ?? null,
    mud: unit.mud?.state ? { body: unit.mud.state.body, wheels: unit.mud.state.wheels } : null,
  };
  if (extra.settings) out.settings = { ...extra.settings };
  if (extra.barnFind) out.barnFind = extra.barnFind;
  return out;
}

/** The same vehicle the next morning: a little battery gone (all of it if the key was left on with the engine stopped; a running one is taken as fine), the mud half dried off. */
export function overnight(saved, P = DEFAULT_FARM_PARAMS) {
  const out = structuredClone(saved);
  // A battery lifted out of the quad keeps its charge (the game finishes a charge on the bench charger overnight, game.js restoreDay).
  if (out.engine && num(out.engine.battery) && !out.engine.batteryOut) {
    out.engine.battery = out.keyOn && !out.running ? Math.min(out.engine.battery, P.flatOvernight) : Math.max(0, out.engine.battery - P.overnightDrain);
  }
  out.keyOn = false;
  out.running = false;
  if (out.mud) {
    out.mud.body *= P.mudKept;
    out.mud.wheels *= P.mudKept;
  }
  return out;
}

/** Puts a saved condition back on a freshly dealt vehicle. Anything the save lacks keeps what was dealt. */
export function restoreVehicle(unit, s) {
  if (!s) return;
  const e = unit.engine;
  const q = unit.quad;
  if (num(s.roughness)) e.params.baseRoughness = s.roughness;
  if (num(s.hours)) q.usage.hours = s.hours;
  if (num(s.odo)) q.usage.odoMiles = s.odo;
  copyKnown(e, s.engine, ENGINE_KEPT);
  if (num(s.filter) && q.filter) e.clog = q.filter.clog = s.filter;
  if (s.fuel) {
    if (num(s.fuel.litres)) q.fuel.setLitres(s.fuel.litres);
    copyKnown(q.fuel, s.fuel, FUEL_KEPT);
    if ('bowlDiesel' in q.fuel) q.fuel.bowlDiesel = q.fuel.diesel;
    if ('bowlWater' in q.fuel) q.fuel.bowlWater = q.fuel.water;
    if (TAP_POSITIONS.includes(s.fuel.tap)) q.fuel.tap = s.fuel.tap;
    if (e.params.strokes === 2) e.oil = q.fuel.oil;
  }
  if (s.faults) {
    for (const k of FAULT_FIELDS) if (s.faults[k]) copyKnown(q.faults[k], s.faults[k], Object.keys(q.faults[k]));
    if (Number.isInteger(s.faults.tyre)) q.faults.tyre = s.faults.tyre;
    if (Number.isInteger(s.faults.rodWheel)) q.faults.rodWheel = s.faults.rodWheel; // which wheel took the knock
    if (Number.isInteger(s.faults.rimWheel)) q.faults.rimWheel = s.faults.rimWheel;
  }
  if (s.tyres && q.tyres) {
    if (Array.isArray(s.tyres.psi) && s.tyres.psi.length === q.tyres.psi.length && s.tyres.psi.every(num)) q.tyres.psi = [...s.tyres.psi];
    if (s.tyres.brand) Object.assign(q.tyres.brand, s.tyres.brand);
    if (s.tyres.tread) Object.assign(q.tyres.tread, s.tyres.tread);
  }
  if (num(s.sump) && q.sump) q.sump.level = s.sump;
  if (s.snorkel && q.snorkel) q.snorkel.restore(s.snorkel); // fitted at the bench, kept (only a Land Rover takes one)
  if (s.spotlamps && q.spotlamps) q.spotlamps.restore(s.spotlamps); // fitted at the bench, kept (a vehicle that can't have them ignores it)
  if (num(s.tapStiff) && q.quirks) q.quirks.tapStiff = s.tapStiff;
  if (s.mud && unit.mud?.state) {
    if (num(s.mud.body)) unit.mud.state.body = s.mud.body;
    if (num(s.mud.wheels)) unit.mud.state.wheels = s.mud.wheels;
  }
}

/** The faults a restored vehicle has, as history would list them ({ kind, level }), so the girls know of them as before. */
export function savedFaults(s) {
  if (!s?.faults?.started) return [];
  return Object.keys(s.faults.started)
    .filter((k) => s.faults.started[k])
    .map((kind) => ({ kind, level: s.faults.levels?.[kind] ?? 0.15 }));
}

/**
 * The girls as plain data: { favour: { id: score }, friction, fallenOut, skills: { id: { skill: level } }, memories: { id: { kind: weight } }, romance: { id: { locked, betrayed } } }.
 * Pranks, grudges and moods belong to the day and aren't kept.
 */
export function captureGirls({ favour, fallingOut, skills, romance, lessons, quadCare, companions = [] }) {
  return {
    care: quadCare?.capture(),
    favour: { ...favour.scores },
    friction: fallingOut.friction,
    fallenOut: !!fallingOut.active,
    skills: structuredClone(skills.levels),
    lessons: lessons?.capture(),
    memories: Object.fromEntries(companions.map((c) => [c.character.id, c.memory.capture()])),
    opinions: Object.fromEntries(companions.map((c) => [c.character.id, c.opinion?.capture()])), // what she has worked out about the quads (quadOpinion.js)
    romance: Object.fromEntries(Object.entries(romance.girls).map(([id, g]) => [id, { locked: !!g.locked, betrayed: !!g.betrayed }])),
  };
}

/** Puts the girls' saved state back the next morning (see captureGirls). */
export function restoreGirls({ favour, fallingOut, skills, romance, lessons, quadCare, companions = [] }, s, P = DEFAULT_FARM_PARAMS) {
  if (!s) return;
  for (const id of favour.ids) if (num(s.favour?.[id])) favour.scores[id] = s.favour[id] * P.favourKept;
  if (s.fallenOut) fallingOut.friction = P.frictionFallenOut;
  else if (num(s.friction)) fallingOut.friction = s.friction * P.frictionKept;
  lessons?.restore(s.lessons);
  quadCare?.restore(s.care);
  for (const c of companions) c.memory.restore(s.memories?.[c.character.id], P.memoryKept, c.params);
  for (const c of companions) c.opinion?.restore(s.opinions?.[c.character.id]);
  for (const id of skills.ids) if (s.skills?.[id]) copyKnown(skills.levels[id], s.skills[id], Object.keys(skills.levels[id]));
  for (const id of romance.ids) {
    const r = s.romance?.[id];
    const g = romance.girls[id];
    if (!r || !g) continue;
    if (r.locked) {
      g.locked = true;
      favour.lock(id, romance.p.lockScore);
    } else if (r.betrayed) {
      g.nextInvite = romance.clock + romance.p.betrayedCooldown; // still off you this morning; tomorrow it's forgotten
    }
  }
}
