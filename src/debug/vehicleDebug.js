// Pure helpers behind the debug panel's Vehicles tab (no DOM, no Three.js), so what the buttons do is tested.
import { FAULT_KINDS } from '../vehicle/faults.js';

/** Quirks that can't be had together, as the game deals them. */
const EXCLUSIVE = { fuelHigh: 'fuelSticks', fuelSticks: 'fuelHigh' };

export function quirkLabel(kind) {
  return kind.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/** Gives a quad a quirk or takes it away. */
export function setQuirk(quirks, kind, on) {
  const has = quirks.kinds.includes(kind);
  if (on && !has) {
    if (EXCLUSIVE[kind]) quirks.kinds = quirks.kinds.filter((k) => k !== EXCLUSIVE[kind]);
    quirks.kinds.push(kind);
    if (kind === 'tapStiff') quirks.tapStiff = 1;
  } else if (!on && has) {
    quirks.kinds = quirks.kinds.filter((k) => k !== kind);
  }
}

/** Sets a fault's level: 0 or less clears it, otherwise it starts (if it hadn't) and holds that level. */
export function setFault(faults, kind, level) {
  if (level <= 0) return void faults.fix(kind);
  faults.begin(kind);
  faults.levels[kind] = Math.min(1, level);
  faults.caps[kind] = 1;
}

/** Every fault at once. */
export function clearFaults(faults) {
  for (const kind of FAULT_KINDS) faults.fix(kind);
}

/** Puts a quad right: faults, plug, filter, wear, scuffing, seizure, water, water in the fuel, diesel, wet or binding brakes, a frozen throttle cable and the stiff tap. Quirks and the engine's age stay. */
export function fixEverything(unit) {
  const e = unit.engine;
  clearFaults(unit.quad.faults);
  e.fouling = 0;
  e.clog = 0;
  e.wear = 0;
  e.scuff = 0;
  e.overheat = 0;
  e.seized = false;
  e.water = 0;
  e.dieselSoak = 0;
  unit.quad.fuel.clearWater();
  e.silencerBlown = 0;
  e.boiled = false;
  e.coolant = 1;
  e.coolantLeak = 0;
  if (unit.quad.sump) {
    unit.quad.sump.level = 1;
    unit.quad.sump.airbox = 0;
  }
  unit.quad.quirks.tapStiff = 0;
  unit.quad.startTrouble = 0;
  unit.quad.brakes.fix();
  unit.quad.iceCable.fix();
  unit.quad.faults.kept.chainLube = 1; // a fresh chain, as the bench leaves it
  unit.quad.faults.kept.chainOff = false;
}

/** Straight to running and warm with the fuel on, as if started and left a while (no cranking). */
export function startWarm(unit) {
  const e = unit.engine;
  const f = unit.quad.fuel;
  f.tap = 'on';
  if (f.litres > 0) f.bowl = f.params.bowlCapacity;
  e.setIgnition(true);
  e.setTemperature(1);
  if (!e.isRunning) {
    e.state = 'running';
    e.rpm = Math.max(e.rpm, e.params.catchRpm);
  }
}

/** Ignition off (and a diesel's stop knob out), fuel tap off. */
export function switchOff(unit) {
  unit.engine.setIgnition(false);
  unit.engine.stopKnob(); // a diesel runs on with the key off
  unit.quad.fuel.tap = 'off';
}

/** One line saying what is wrong with a quad, for the summary at the top of the Vehicles tab. */
export function problemSummary(unit) {
  const e = unit.engine;
  const bits = [];
  for (const kind of FAULT_KINDS) if (unit.quad.faults.started[kind]) bits.push(`${kind} ${unit.quad.faults.levels[kind].toFixed(2)}`);
  if (unit.quad.faults.kept.valveTight && unit.quad.faults.started.valves) bits.push('valves too tight');
  if (unit.quad.faults.chainOff) bits.push('chain off the sprocket');
  if (unit.quad.faults.chainDryness > 0.8) bits.push('chain dry');
  if (e.seized) bits.push('seized');
  if (e.scuff > 0.05) bits.push(`scuffed ${e.scuff.toFixed(2)}`);
  if (e.fouling > 0.1) bits.push(`plug fouled ${e.fouling.toFixed(2)}`);
  if (e.clog > 0.2) bits.push(`filter clogged ${e.clog.toFixed(2)}`);
  if (e.wear > 0.1) bits.push(`worn ${e.wear.toFixed(2)}`);
  if (e.water > 0.05) bits.push('water in it');
  if (e.dieselSoak > 0.05) bits.push('diesel-soaked');
  if (unit.quad.fuel.water > 0.005 || unit.quad.fuel.sediment > 0.05) bits.push(`water in the fuel ${unit.quad.fuel.water.toFixed(2)}, tap bowl ${unit.quad.fuel.sediment.toFixed(2)}`);
  if (e.battery < 0.25) bits.push('battery flat');
  if (unit.quad.brakes.wet > 0.1) bits.push(`brakes wet ${unit.quad.brakes.wet.toFixed(2)}`);
  if (unit.quad.brakes.binding) bits.push('brake binding');
  if (unit.quad.iceCable.frozen) bits.push(`throttle cable frozen ${unit.quad.iceCable.ice.toFixed(2)}`);
  if (e.boiled) bits.push('boiled over');
  if (unit.quad.fuel.litres <= 0.01) bits.push('out of fuel');
  return bits.length ? bits.join(', ') : 'nothing wrong';
}

/**
 * The engine numbers worth watching that are not set from the panel, for whichever engine this is: [{ key, label, get(engine) }], in
 * the order the Running folder shows them. Only what the engine can do is listed (an air-cooled petrol engine pinks; a diesel has glow plugs;
 * a two-stroke has a jet), so a quad never shows a number that is always zero. The Vehicles tab and the console both read this.
 */
export function engineReadouts(engine, { manual = false } = {}) {
  const p = engine.params;
  const diesel = !!p.compressionIgnition;
  const list = [
    { key: 'revsAimedAt', label: 'revs it is aiming for (after the load)', get: (e) => Math.round(e.targetRpm) },
    { key: 'revsFree', label: 'revs the throttle alone would give', get: (e) => Math.round(e.freeTargetRpm) },
    { key: 'idleAimedAt', label: 'idle it is aiming for (rpm)', get: (e) => Math.round(e.idleTarget) },
    { key: 'driveLoad', label: 'drive load / of it resisting', get: (e) => `${num(e.driveLoad)} / ${num(e.resistLoad)}` },
  ];
  if (manual) list.push({ key: 'gearRevs', label: 'revs the road speed turns it at / clutch lock', get: (e) => `${Math.round(e.gearRpm)} / ${num(e.gearLock)}` });
  list.push({ key: 'surge', label: 'surge at idle (rpm)', get: (e) => Math.round(e.surge) });
  list.push({ key: 'floatBowl', label: 'fuel in the float bowl', get: (e) => e.fuel });
  if (!diesel) list.push({ key: 'dieselInCarb', label: 'diesel in the carb', get: (e) => e.diesel });
  list.push({ key: 'waterGulp', label: 'water being swallowed (per second)', get: (e) => e.gulp });
  list.push({ key: 'starter', label: 'starter motor / last caught by', get: (e) => `${e.motorOn ? 'turning' : 'off'} / ${e.caughtBy ?? 'not yet'}` });
  list.push({ key: 'runOn', label: 'running on after switching off (firings left)', get: (e) => (e.keyOff || e.keyPulled ? e.runOnLeft : 0) });
  if (e0(engine).bore) list.push({ key: 'bigBore', label: 'big-bore kit fitted well (1 is right)', get: (e) => e.boreFit });
  if (p.strokes === 2) list.push({ key: 'silencerOff', label: 'silencer off (toolbox job)', get: (e) => (e.silencerOff ? 'yes' : 'no') });
  list.push({ key: 'overheating', label: 'overheating', get: (e) => e.heat });
  if (!p.waterCooled && !diesel) list.push({ key: 'pinking', label: 'pinking (heat too high, loses power)', get: (e) => e.pink });
  list.push({ key: 'heatSoak', label: 'heat soak (ticks as it cools, hot start rich)', get: (e) => e.soak });
  list.push({ key: 'lubeHeat', label: 'extra heat from poor lubrication', get: (e) => e.overheat });
  if (p.waterCooled) {
    list.push({ key: 'steam', label: 'steam off the radiator', get: (e) => e.steam });
    list.push({ key: 'boiled', label: 'boiled over since last topped up', get: (e) => (e.boiled ? 'yes' : 'no') });
    list.push({ key: 'coolantPuddle', label: 'coolant puddle under it', get: (e) => e.coolantPuddle });
  }
  if (diesel) list.push({ key: 'glow', label: 'glow plugs', get: (e) => e.glow });
  list.push({ key: 'nip', label: 'nipping up', get: (e) => e.nip });
  list.push({ key: 'tick', label: 'tappet tick (low oil)', get: (e) => e.tick });
  list.push({ key: 'oilBurn', label: 'burning oil (or too much of it)', get: (e) => e.oilBurn });
  if (p.strokes === 2) {
    list.push({ key: 'oilRich', label: 'too much oil in the mix', get: (e) => e.oilRich });
    list.push({ key: 'jetting', label: 'jetting spot on (1 is right)', get: (e) => e.jetOn });
    list.push({ key: 'jetError', label: 'jet size less the right one (negative is lean)', get: (e) => e.jetErr });
  } else {
    list.push({ key: 'valves', label: 'valve clearance (loose / too tight)', get: (e) => `${num(e.valveLoose)} / ${num(e.valveTight)}` });
  }
  list.push({ key: 'warmDay', label: 'how warm a day (0 to 1)', get: (e) => e.ambient });
  list.push({ key: 'chill', label: 'cold day (more choke, slower warm-up)', get: (e) => e.chill });
  list.push({ key: 'sheltered', label: 'under the barn roof', get: (e) => (e.sheltered ? 'yes' : 'no') });
  return list;
}

const e0 = (e) => e;
const num = (v) => Math.round((v ?? 0) * 100) / 100;
