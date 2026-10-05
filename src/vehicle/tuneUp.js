// Tinkering with a quad from the toolbox: the idle screw, the carb mixture, the
// throttle stop (the speed limiter), the clutch springs and the tyre pressures.
// Pure logic, no DOM or Three.js.
//
// A quad's settings are always applied from the stock values it had when you
// first opened the toolbox on it, so any combination can be undone exactly.
// The limits keep it safe: the warm idle can't go below the spec's safe minimum
// (its safeIdle, see quadSpecs.js), and the clutch always bites
// well clear of the idle, so it can't stall at a standstill or creep.

import { applyIdle, CLUTCH_MARGIN_RPM } from './quadVariation.js';

export const DEFAULT_TUNE_PARAMS = {
  // Idle screw
  idleStep: 50, // rpm per click
  idleHeadroom: 250, // rpm the warm idle can go above the top of the quad's idleRange

  // Carb mixture (needle clip and jet), in clicks either side of stock
  leanClicks: 2,
  richClicks: 3,
  leanTrim: 0.04, // mixture per click lean: lean running drops the idle a little, roughens it and costs some power...
  leanDrive: 0.07, // ...but each click lean gains this much drive, so the net is a bit more go
  leanFuel: 0.07, // fuel saved per click lean
  leanWarmUp: 0.1, // runs hotter: warms up this much quicker per click lean (and half this slower per click rich)
  richTrim: 0.09, // mixture per click rich: only past richTolerance (the third click) does it smoke, hunt and foul warm
  richDrive: 0.02, // drive lost per click rich
  richFuel: 0.08, // extra fuel per click rich
  richSmoke: 0.35, // extra warm exhaust smoke per click rich

  // Throttle stop screw (the speed limiter), in turns out from stock
  limiterTurns: 3, // all the way out is taking it off
  limiterSpeed: 0.075, // top speed gained per turn
  limiterRpm: 0.02, // full-throttle revs gained per turn
  limiterDrive: 0.03, // drive gained per turn, so it still pulls near the new top speed
  limiterFuel: 0.07, // extra fuel per turn (per revolution, so more again per hour at the higher revs)

  // Clutch springs, in clicks softer (negative) or stiffer
  clutchSoftClicks: 2,
  clutchStiffClicks: 3,
  clutchStep: 150, // rpm the clutch engagement moves per click

  // Tyre pressures
  stockPsi: 4,
  minPsi: 2.5,
  maxPsi: 6,
  psiStep: 0.5,
  psiGrip: 0.06, // grip lost per psi up (gained per psi down)
  psiMudGrip: 0.1, // the same in mud, where soft tyres help most
  psiRolling: 0.12, // rolling resistance lost per psi up
  psiStiffness: 0.07, // suspension stiffness gained per psi up (soft tyres bounce more)
};

export const TUNE_PARAM_RANGES = {
  idleStep: [10, 200, 10],
  idleHeadroom: [0, 800, 10],
  leanClicks: [0, 5, 1],
  richClicks: [0, 5, 1],
  leanTrim: [0, 0.2, 0.005],
  leanDrive: [0, 0.2, 0.005],
  leanFuel: [0, 0.2, 0.005],
  leanWarmUp: [0, 0.3, 0.01],
  richTrim: [0, 0.3, 0.005],
  richDrive: [0, 0.2, 0.005],
  richFuel: [0, 0.3, 0.005],
  richSmoke: [0, 1, 0.01],
  limiterTurns: [1, 6, 1],
  limiterSpeed: [0, 0.2, 0.005],
  limiterRpm: [0, 0.1, 0.005],
  limiterDrive: [0, 0.2, 0.005],
  limiterFuel: [0, 0.2, 0.005],
  clutchSoftClicks: [0, 5, 1],
  clutchStiffClicks: [0, 6, 1],
  clutchStep: [50, 400, 10],
  stockPsi: [1, 10, 0.5],
  minPsi: [1, 10, 0.5],
  maxPsi: [1, 12, 0.5],
  psiStep: [0.1, 2, 0.1],
  psiGrip: [0, 0.2, 0.005],
  psiMudGrip: [0, 0.3, 0.005],
  psiRolling: [0, 0.3, 0.005],
  psiStiffness: [0, 0.2, 0.005],
};

// What tinkering touches, so stock can be put back exactly.
const STOCK_KEYS = {
  engine: ['idleRpmWarm', 'stallRpm', 'loadDragRpm', 'mixtureTrim', 'maxRpm', 'warmUpSeconds'],
  vehicle: [
    'clutchEngageRpm',
    'clutchFullRpm',
    'couplingRpm',
    'maxSpeed',
    'maxDriveForce',
    'grassFrictionSlip',
    'mudFrictionSlip',
    'puddleFrictionSlip',
    'tyreGrip',
    'mudGrip',
    'rollingResistance',
    'suspensionStiffness',
  ],
  fuel: ['burnPerRev'],
  smoke: ['warmDensity'],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The params objects one quad's tinkering acts on:
 * { engine, vehicle, fuel, smoke } params, plus its spec for the safe idle.
 */
export function tuneTarget(unit) {
  return {
    engine: unit.engine.params,
    vehicle: unit.quad.params,
    fuel: unit.quad.fuel.params,
    smoke: unit.smoke.params,
    spec: unit.spec,
  };
}

/** Copies the values tinkering can change, as they are now. */
export function captureStock(target) {
  const stock = { safeIdle: target.spec?.safeIdle ?? target.spec?.idleRange?.[0], topIdle: target.spec?.idleRange?.[1] };
  for (const [group, keys] of Object.entries(STOCK_KEYS)) {
    stock[group] = {};
    for (const k of keys) stock[group][k] = target[group][k];
  }
  stock.safeIdle ??= stock.engine.idleRpmWarm;
  stock.topIdle ??= stock.engine.idleRpmWarm;
  return stock;
}

/** Settings that leave the quad as it was. */
export function stockSettings(stock, P = DEFAULT_TUNE_PARAMS) {
  return { idle: stock.engine.idleRpmWarm, mixture: 0, limiter: 0, clutch: 0, tyres: P.stockPsi };
}

export function isStock(settings, stock, P = DEFAULT_TUNE_PARAMS) {
  const s = stockSettings(stock, P);
  return Object.keys(s).every((k) => settings[k] === s[k]);
}

/** Rpm the warm idle loses to the mixture trim, beyond what it lost at stock. */
function leanIdleDrop(engine, stock) {
  const lean = (trim) => Math.max(0, -trim);
  return (lean(engine.mixtureTrim) - lean(stock.engine.mixtureTrim)) * engine.leanIdleDrop;
}

/**
 * [min, max, step] for one setting, given the others. The idle range depends
 * on the clutch springs' stiffest setting, and the clutch's softest setting on
 * the idle, so limits() and clampSettings() always agree.
 */
export function limits(key, settings, stock, P = DEFAULT_TUNE_PARAMS) {
  switch (key) {
    case 'idle': {
      // Never below the spec's safe minimum; never so high the stiffest clutch can't clear it.
      const clutchTop = stock.vehicle.clutchEngageRpm + P.clutchStiffClicks * P.clutchStep - CLUTCH_MARGIN_RPM;
      const top = Math.min(Math.max(stock.topIdle, stock.engine.idleRpmWarm) + P.idleHeadroom, clutchTop);
      const bottom = Math.min(stock.safeIdle, stock.engine.idleRpmWarm);
      return [bottom, Math.max(bottom, top), P.idleStep];
    }
    case 'mixture':
      return [-P.leanClicks, P.richClicks, 1];
    case 'limiter':
      return [0, P.limiterTurns, 1];
    case 'clutch': {
      // The clutch has to bite at least CLUTCH_MARGIN_RPM above the idle.
      const need = Math.ceil((settings.idle + CLUTCH_MARGIN_RPM - stock.vehicle.clutchEngageRpm) / P.clutchStep);
      return [clamp(Math.max(-P.clutchSoftClicks, need), -P.clutchSoftClicks, P.clutchStiffClicks), P.clutchStiffClicks, 1];
    }
    case 'tyres':
      return [P.minPsi, P.maxPsi, P.psiStep];
    default:
      throw new Error(`Unknown setting ${key}`);
  }
}

/** The settings with each one brought within its limits, in dependency order. */
export function clampSettings(settings, stock, P = DEFAULT_TUNE_PARAMS) {
  const s = { ...stockSettings(stock, P), ...settings };
  for (const key of ['mixture', 'limiter', 'tyres', 'idle', 'clutch']) {
    const [lo, hi] = limits(key, s, stock, P);
    s[key] = clamp(s[key], lo, hi);
  }
  return s;
}

/**
 * One click of a setting up (+1) or down (-1). Clicks count from the stock
 * value, so clicking back from a limit lands on the same values as on the way out.
 * Returns the new, clamped settings (unchanged at a limit).
 */
export function nudge(settings, key, direction, stock, P = DEFAULT_TUNE_PARAMS) {
  const [lo, hi, step] = limits(key, settings, stock, P);
  const base = stockSettings(stock, P)[key];
  // The next stock-based step beyond the current value in that direction.
  const x = (settings[key] - base) / step;
  const clicks = direction > 0 ? Math.floor(x + 1e-6) + 1 : Math.ceil(x - 1e-6) - 1;
  const value = Math.round((base + clicks * step) * 1000) / 1000;
  return clampSettings({ ...settings, [key]: clamp(value, lo, hi) }, stock, P);
}

/** Puts the stock values back. */
export function restoreStock(target, stock) {
  for (const group of Object.keys(STOCK_KEYS)) Object.assign(target[group], stock[group]);
}

/**
 * Sets the quad's params from stock plus these settings, clamped to the
 * limits. Returns the settings actually used.
 */
export function applyTune(target, stock, settings, P = DEFAULT_TUNE_PARAMS) {
  const s = clampSettings(settings, stock, P);
  restoreStock(target, stock);
  const e = target.engine;
  const v = target.vehicle;
  const se = stock.engine;
  const sv = stock.vehicle;

  // Clutch springs: the whole engagement moves up or down together.
  const clutch = s.clutch * P.clutchStep;
  v.clutchEngageRpm = sv.clutchEngageRpm + clutch;
  v.clutchFullRpm = sv.clutchFullRpm + clutch;
  v.couplingRpm = sv.couplingRpm + clutch;

  // The throttle stop: it opens further, so it revs a little higher and goes faster.
  let drive = 1 + P.limiterDrive * s.limiter;
  let fuel = 1 + P.limiterFuel * s.limiter;
  v.maxSpeed = sv.maxSpeed * (1 + P.limiterSpeed * s.limiter);
  e.maxRpm = Math.round(se.maxRpm * (1 + P.limiterRpm * s.limiter));

  // Mixture.
  const lean = Math.max(0, -s.mixture);
  const rich = Math.max(0, s.mixture);
  e.mixtureTrim = se.mixtureTrim - P.leanTrim * lean + P.richTrim * rich;
  drive *= 1 + P.leanDrive * lean - P.richDrive * rich;
  fuel *= 1 - P.leanFuel * lean + P.richFuel * rich;
  e.warmUpSeconds = se.warmUpSeconds * (1 - P.leanWarmUp * lean + 0.5 * P.leanWarmUp * rich);
  target.smoke.warmDensity = stock.smoke.warmDensity * (1 + P.richSmoke * rich);

  // Tyres.
  const psi = s.tyres - P.stockPsi;
  v.grassFrictionSlip = sv.grassFrictionSlip * (1 - P.psiGrip * psi);
  v.mudFrictionSlip = sv.mudFrictionSlip * (1 - P.psiMudGrip * psi);
  v.puddleFrictionSlip = sv.puddleFrictionSlip * (1 - P.psiMudGrip * psi);
  // The same for the engine load's fallback wheelspin estimate (see engineLoad.js).
  v.tyreGrip = sv.tyreGrip * (1 - P.psiGrip * psi);
  v.mudGrip = sv.mudGrip * (1 - P.psiMudGrip * psi);
  v.rollingResistance = sv.rollingResistance * Math.max(0, 1 - P.psiRolling * psi);
  v.suspensionStiffness = sv.suspensionStiffness * (1 + P.psiStiffness * psi);

  v.maxDriveForce = sv.maxDriveForce * drive;
  target.fuel.burnPerRev = stock.fuel.burnPerRev * fuel;

  // Idle last. The setting is the warm idle it actually runs at, so a lean
  // mixture's idle drop is wound back in on the screw. applyIdle scales the
  // stall point and braking drag from that, as for a quad that came that way,
  // and keeps the clutch clear of it.
  applyIdle(e, v, s.idle);
  e.idleRpmWarm = Math.round(s.idle + leanIdleDrop(e, stock));
  return s;
}
