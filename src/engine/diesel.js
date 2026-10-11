// Red diesel in a petrol engine. Fuel it with diesel by mistake and the engine takes it up slowly: it runs worse and worse,
// smokes thick grey, then dies and won't catch again. Turning the petrol back in doesn't cure it; the tank and carb have to
// be drained at the toolbox. `soak` is 0..1 and only goes up (the toolbox sets it back to 0). Pure logic.

import { ratioText } from './lubrication.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * What in the fuel soaks the engine, 0..1: red diesel in a petrol engine; in a diesel that is fussy (the UTV's) it's the petrol share
 * instead; the tractor shrugs off both.
 */
export function contaminant(p, diesel) {
  if (p.runsOnDiesel) return p.petrolFussy ? clamp01(1 - diesel) : 0;
  return clamp01(diesel);
}

/** The new soak after dt seconds: it climbs toward what the diesel in the fuel calls for, while running (not cranking or standing), and never falls. */
export function stepDieselSoak(soak, dt, { diesel = 0, active = false }, p) {
  if (!active) return soak;
  const target = clamp01(diesel * p.dieselPotency);
  return target > soak ? Math.min(target, soak + p.dieselSoakRate * dt) : soak;
}

/** How much of its usual chance of catching it keeps: full when clean, none once soaked past dieselNoStart. */
export function dieselCatchFactor(soak, p) {
  return clamp01(1 - (soak - p.dieselStartFrom) / Math.max(0.01, p.dieselNoStart - p.dieselStartFrom));
}

/** What's in a can or tank, in words: red diesel (or a share of it) when there is any, else its petrol or pre-mix ratio. */
export function fuelText(oil, diesel, water = 0) {
  if (diesel > 0.95) return 'red diesel';
  const base = diesel > 0.02 ? `petrol with ${Math.round(diesel * 100)}% red diesel in it` : ratioText(oil);
  return water > 0.01 ? `${base}, with ${Math.round(water * 100)}% water in it` : base;
}
