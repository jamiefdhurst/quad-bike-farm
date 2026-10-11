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

/** Puts a quad right: faults, plug, filter, wear, scuffing, seizure, water, diesel, wet or binding brakes and the stiff tap. Quirks and the engine's age stay. */
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
  e.silencerBlown = 0;
  e.boiled = false;
  e.coolant = 1;
  e.coolantLeak = 0;
  if (unit.quad.sump) unit.quad.sump.level = 1;
  unit.quad.quirks.tapStiff = 0;
  unit.quad.startTrouble = 0;
  unit.quad.brakes.fix();
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
  if (e.seized) bits.push('seized');
  if (e.scuff > 0.05) bits.push(`scuffed ${e.scuff.toFixed(2)}`);
  if (e.fouling > 0.1) bits.push(`plug fouled ${e.fouling.toFixed(2)}`);
  if (e.clog > 0.2) bits.push(`filter clogged ${e.clog.toFixed(2)}`);
  if (e.wear > 0.1) bits.push(`worn ${e.wear.toFixed(2)}`);
  if (e.water > 0.05) bits.push('water in it');
  if (e.dieselSoak > 0.05) bits.push('diesel-soaked');
  if (e.battery < 0.25) bits.push('battery flat');
  if (unit.quad.brakes.wet > 0.1) bits.push(`brakes wet ${unit.quad.brakes.wet.toFixed(2)}`);
  if (unit.quad.brakes.binding) bits.push('brake binding');
  if (e.boiled) bits.push('boiled over');
  if (unit.quad.fuel.litres <= 0.01) bits.push('out of fuel');
  return bits.length ? bits.join(', ') : 'nothing wrong';
}
