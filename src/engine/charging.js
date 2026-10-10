// What a running engine does to its battery. The alternator gives only a share of its output at idle and all of it a little way up the
// revs; the ignition and anything lit off the battery draw from that. So a single at idle with the lights on barely holds even, revving it
// charges, and a weak battery can't keep the ignition going at idle at all. Pure logic; the engine model applies it each step.

export const DEFAULT_CHARGING_PARAMS = {
  batteryChargeIdle: 0.3, // share of the full charge rate the alternator gives at idle
  batteryChargeFullAt: 0.3, // how far up the rev range (0 idle, 1 flat out) it gives all of it
  batteryRunDraw: 0.0001, // battery (0..1) the running ignition draws each second
  batteryLightDraw: 0.0004, // and lamps run off the battery (with the light switch on), at full
  batteryRunBelow: 0.4, // below this charge the ignition can't keep it going at idle
  batteryRunRevs: 1.15, // ...unless the revs are held above this many times idle
  batteryStallRate: 0.25, // chance each second it dies when it can't, at a flat battery (less as it gets nearer the line)
};

export const CHARGING_PARAM_RANGES = {
  batteryChargeIdle: [0, 1, 0.05],
  batteryChargeFullAt: [0.05, 1, 0.05],
  batteryRunDraw: [0, 0.01, 0.0001],
  batteryLightDraw: [0, 0.01, 0.0001],
  batteryRunBelow: [0, 0.8, 0.01],
  batteryRunRevs: [1, 2, 0.01],
  batteryStallRate: [0, 2, 0.01],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** How much of the full charge rate the alternator gives at this rev, 0..1. */
export function alternatorOutput(rpm, idle, max, p = DEFAULT_CHARGING_PARAMS) {
  const t = clamp((rpm - idle) / Math.max(1, (max - idle) * p.batteryChargeFullAt), 0, 1);
  return p.batteryChargeIdle + (1 - p.batteryChargeIdle) * t;
}

/**
 * Battery (0..1) gained per second, negative when it is losing: the alternator's output at this rev less the ignition and the lamps.
 * `chargeRate` is the engine's full rate (batteryChargeRate); `lightLoad` is 0..1 of the lamps run off the battery.
 */
export function netCharge(rpm, idle, max, lightLoad, chargeRate, p = DEFAULT_CHARGING_PARAMS) {
  return chargeRate * alternatorOutput(rpm, idle, max, p) - p.batteryRunDraw - p.batteryLightDraw * clamp(lightLoad, 0, 1);
}

/** Whether a battery this low can't keep the ignition going at this rev. */
export function tooWeakToRun(battery, rpm, idle, p = DEFAULT_CHARGING_PARAMS) {
  return battery < p.batteryRunBelow && rpm < idle * p.batteryRunRevs;
}

/** The chance per second that it dies for want of battery (0 when it can run): worse the flatter the battery. */
export function lowBatteryStallRate(battery, rpm, idle, p = DEFAULT_CHARGING_PARAMS) {
  if (!tooWeakToRun(battery, rpm, idle, p)) return 0;
  return p.batteryStallRate * (0.3 + 0.7 * clamp(1 - battery / Math.max(1e-3, p.batteryRunBelow), 0, 1));
}

/** How much a lamp on the battery's supply dims: 1 is full. Weak battery and low revs dim it; revs or a good battery lift it. */
export function lampSupply(battery, rpm, idle, max, weakBelow = 0.6, depth = 0.65, p = DEFAULT_CHARGING_PARAMS) {
  const weak = clamp((weakBelow - battery) / Math.max(1e-3, weakBelow), 0, 1);
  const alt = alternatorOutput(rpm, idle, max, p);
  return 1 - depth * weak * (1 - alt);
}
