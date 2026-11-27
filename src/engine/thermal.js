// An engine's real temperatures, in degrees C. Pure logic, no Three.js.
//
// Every engine has its metal's temperature (`metalC`: the cylinder and head), and a water-cooled one has its coolant's as well
// (`coolantC`). The metal is heated by the fuel it burns (some at idle, more with revs and load) and by the sun, and sheds it to
// the air through its fins, which the flywheel's fan and the wind help. On a water-cooled engine the metal hands its heat to the
// coolant instead, which the thermostat holds in until it is warm and the radiator then sheds, with the wind and the fan.
// Switched off, both cool towards the air, slower sheltered in the barn.
//
// The 0 to 1 values the rest of the game reads are worked out from these: `warmth` (the choke, cold running, wear and the gauge's
// middle) from the metal, and `heatLevel` (pinking, running hot, steam) from the coolant, or from the metal on an air-cooled engine.

import { airflow } from './heat.js';
import { offTemperature } from '../world/barn.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 0 at the air's temperature, 1 at the engine's warm one: what `EngineModel.temperature` reads. */
export function warmth(metalC, air, p) {
  return clamp01((metalC - air) / Math.max(1, p.warmC - air));
}

/** The metal's °C for a warmth: the other way round. */
export function metalForWarmth(t, air, p) {
  return air + clamp01(t) * (p.warmC - air);
}

/** The temperature `heatLevel` counts from, and the span it counts over: the coolant's on a water-cooled engine, the metal's on an air-cooled one. */
export function heatScale(p) {
  return p.waterCooled ? { from: p.coolantWarmC, span: p.coolantSpanC } : { from: p.warmC, span: p.heatSpanC };
}

/** 0..1 how far over its warm temperature the engine is (what `EngineModel.heat` reads): 0 at warm, 1 at the top of the span. */
export function heatLevel(metalC, coolantC, p) {
  const { from, span } = heatScale(p);
  return clamp01(((p.waterCooled ? coolantC : metalC) - from) / Math.max(1, span));
}

/** The °C that gives a heat level, the other way round. */
export function celsiusForHeat(heat, p) {
  const { from, span } = heatScale(p);
  return from + clamp01(heat) * span;
}

/**
 * What the dash's temperature gauge reads, in °C, with its marks (tempGauge.js): the coolant on a water-cooled engine, cold at the air,
 * the middle at warm, the red where it runs too hot (`hotFromC`) and the top where it stalls (`hotStallC`); the metal on an air-cooled
 * one, its red where it starts to pink (`pinkFromC`) and its top where it pinks fully.
 */
export function gaugeReading(metalC, coolantC, air, p) {
  if (p.waterCooled) return { c: coolantC, air, warm: p.coolantWarmC, hot: p.hotFromC, top: p.hotStallC };
  return { c: metalC, air, warm: p.warmC, hot: p.pinkFromC, top: p.pinkFromC + p.pinkSpanC };
}

/** How much heat the fuel puts in: 1 idling, more with revs, pulling under load, a big bore and (manual timing) a retarded spark. */
export function fuelHeat({ rpmNorm, load, bore = 0, extra = 0 }, p) {
  return (1 + p.fuelRevBoost * clamp01(rpmNorm) + p.fuelLoadBoost * clamp01(load)) * (1 + p.boreHeat * bore) + extra;
}

/** How well the fins shed it (1 still, at idle): the flywheel's fan with the revs, and the wind of riding along. */
export function finCooling({ rpmNorm, speed }, p) {
  return 1 + p.finRevCooling * clamp01(rpmNorm) + p.windCooling * airflow(speed, p);
}

/** Where an air-cooled engine's metal is heading (°C): the air plus the heat it makes, over how well it is shed. */
export function metalTarget({ air, ambient, fuel, cooling }, p) {
  return air + (p.idleRiseC * fuel + p.sunRiseC * clamp01(ambient)) / Math.max(0.1, cooling);
}

/** 0..1 how far the thermostat is open at this coolant temperature: shut at `thermostatOpenC`, wide open `thermostatSpanC` above. */
export function thermostatOpen(coolantC, p) {
  return clamp01((coolantC - p.thermostatOpenC) / Math.max(1, p.thermostatSpanC));
}

/** The radiator fan's state: on above `fanOnC`, off below `fanOffC`, as it was between (the water-cooled engine only, and only running). */
export function fanState(fan, coolantC, running, p) {
  if (!p.waterCooled || !running) return false;
  if (coolantC > p.fanOnC) return true;
  if (coolantC < p.fanOffC) return false;
  return fan;
}

/**
 * One step of the temperatures. `s` is { metalC, coolantC, fan }; it is changed in place. `radiator` is 0..1 how much cooling the
 * radiator still does (the coolant level and a stuck thermostat: `radiatorEffect`). Running, a water-cooled engine's coolant is
 * heated by the fuel and cooled through the thermostat; its metal follows the coolant, a little above it, the more so working.
 */
export function stepThermal(s, h, { running, air, sheltered = false, ambient = 0, rpmNorm = 0, load = 0, speed = 0, bore = 0, extra = 0, radiator = 1 }, p) {
  const shelter = { warmFloor: air + p.barnWarmC, openFloor: air, coolFactor: p.barnCoolFactor };
  s.fan = fanState(s.fan, s.coolantC, running, p);
  if (!running) {
    s.metalC = cool(s.metalC, h, air, sheltered, p.warmC, shelter, p);
    s.coolantC = cool(s.coolantC, h, air, sheltered, p.waterCooled ? p.coolantWarmC : p.warmC, shelter, p);
    return;
  }
  const tau = Math.max(10, p.warmUpSeconds);
  const fuel = fuelHeat({ rpmNorm, load, bore, extra }, p);
  if (!p.waterCooled) {
    const cooling = finCooling({ rpmNorm, speed }, p);
    s.metalC += (metalTarget({ air, ambient, fuel, cooling }, p) - s.metalC) * Math.min(1, (h * cooling) / tau); // more cooling is also a quicker pull to the target
    s.metalC = Math.max(s.metalC, air);
    s.coolantC = s.metalC;
    return;
  }
  // Heat into the coolant (°C a second): the fuel, and a little of the sun on the engine bay.
  const into = ((p.warmRiseC * (1 + p.coolantWork * (fuel - 1))) / tau) * (1 + p.waterSun * clamp01(ambient));
  // Heat out: the radiator (through the thermostat), with the wind and the fan, and a little through the block and hoses.
  const flow = thermostatOpen(s.coolantC, p) * clamp01(radiator);
  const cap = p.radiatorLoss * (1 + p.radiatorWind * airflow(speed, p) + (s.fan ? p.radiatorFan : 0));
  const out = ((flow * cap + p.bodyLoss) * Math.max(0, s.coolantC - air)) / tau;
  s.coolantC = Math.max(air, s.coolantC + (into - out) * h);
  // The metal sits above the coolant by what it is making, easing on to it.
  const metalAim = s.coolantC + p.metalOverC * fuel;
  s.metalC += (metalAim - s.metalC) * Math.min(1, h / Math.max(1, p.metalFollowSeconds));
  s.metalC = Math.max(s.metalC, air);
}

/** A switched-off engine's part cooling in a step: towards the air (the barn's, sheltered), and quickly while it is over its warm temperature. */
function cool(c, h, air, sheltered, warmC, shelter, p) {
  let t = offTemperature(c, h, p.coolOffSeconds, sheltered, shelter);
  if (t > warmC) t -= ((t - warmC) * h) / Math.max(1, p.hotOffSeconds);
  return Math.max(air, t);
}
