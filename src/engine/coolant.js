// The orange's coolant. Pure logic, no Three.js.
//
// The water-cooled engine has a slow leak from a perished hose. The level (1 full, 0 dry) falls while it runs
// (the system is under pressure) and a little while it sits hot; a damp patch grows under it once it's down a
// bit. As the level drops the radiator does less, so the engine heats the way an air-cooled one does and the
// gauge shows more of it. Below `coolantSteamBelow` and hot it steams from the radiator, and past `boilHeat`
// with little left it boils over: a burst of steam, most of what's left gone, and the heat stays up until it
// cools. Topping it up (and nipping the clip) is the bench's job.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 0..1 how much of its cooling the radiator still does: full above `coolantOkAt`, none at `coolantEmptyAt`. */
export function coolingEffect(level, p) {
  return clamp01((level - p.coolantEmptyAt) / Math.max(0.01, p.coolantOkAt - p.coolantEmptyAt));
}

/** Coolant lost a second: running at the full rate, parked only while the metal's still hot (`soak` over `coolantWeepSoak`). `leak` is this game's multiplier, 0 for no leak. */
export function leakRate({ running, soak, leak }, p) {
  if (running) return p.coolantLeakRun * leak;
  return soak > p.coolantWeepSoak ? p.coolantLeakRun * p.coolantParkedLeak * leak : 0;
}

/** The damp patch under it, 0..1: grows while it's leaking and the level's below `coolantPuddleFrom`, and dries slowly. */
export function stepPuddle(puddle, h, { leaking, level }, p) {
  if (leaking && level < p.coolantPuddleFrom) return clamp01(puddle + p.coolantPuddleGrow * h);
  return clamp01(puddle - p.coolantPuddleFade * h);
}

/** 0..1 how much steam is coming off the radiator: low coolant and hot, plus whatever's left of a boil-over. */
export function steamLevel(level, heat, boil, p) {
  const low = clamp01((p.coolantSteamBelow - level) / Math.max(0.01, p.coolantSteamBelow));
  const hot = clamp01((heat - p.coolantSteamHeat) / Math.max(0.01, 1 - p.coolantSteamHeat));
  return Math.max(low * hot, clamp01(boil));
}

/** Whether it boils over now: hot, and what's left no longer does the job. Once per top-up (`boiled`): after that it just steams. */
export function boilsOver(level, heat, boiled, p) {
  return !boiled && heat > p.coolantBoilHeat && coolingEffect(level, p) < p.coolantBoilEffect;
}

/** What it says on the dash or the panel: "full", "a bit low", "low", "nearly dry". */
export function levelText(level) {
  return level > 0.85 ? 'full' : level > 0.55 ? 'a bit low' : level > 0.25 ? 'low' : 'nearly dry';
}

/** The leak this game, from a random stream so a seed repeats it: only some games have one (`coolantLeakChance`); the rest start full with no leak. */
export function pickLeak(random, p) {
  if (random() >= p.coolantLeakChance) return { leak: 0, level: 1 };
  return { leak: p.coolantLeakMin + random() * (p.coolantLeakMax - p.coolantLeakMin), level: p.coolantStartMin + random() * (p.coolantStartMax - p.coolantStartMin) };
}
