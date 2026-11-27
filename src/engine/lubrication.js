// Two-stroke oil. Pure logic, no Three.js.
//
// A two-stroke is oiled by the oil in its petrol (pre-mix), so what it's lubricated
// with is whatever fraction of its tank is oil. About 2% (50:1) is right. Straight
// petrol runs it hot, then it scuffs, nips up and seizes. Far too much oil smokes
// and fouls the plug; a four-stroke given any pre-mix at all does the same.

/** Oil fraction of the mix when the two fills are poured together. */
export function mixOil(litresA, oilA, litresB, oilB) {
  const total = litresA + litresB;
  return total > 0 ? (litresA * oilA + litresB * oilB) / total : 0;
}

/** "50:1", or "straight petrol" when there's none to speak of. */
export function ratioText(oil) {
  if (oil < 0.002) return 'straight petrol';
  return `pre-mix ${Math.round(1 / oil)}:1`;
}

/** How well lubricated a two-stroke is, 0 (none) to 1 (as much as it needs). */
export function lubeFactor(oil, goodOil) {
  return Math.min(1, Math.max(0, oil / goodOil));
}

/** How much more oil than the engine can burn clean, 0..1 (smoke and a fouling plug). */
export function oilExcess(oil, strokes, p) {
  const from = strokes === 2 ? p.oilRichFrom : p.oilFourStrokeFrom;
  const full = strokes === 2 ? p.oilRichFull : p.oilFourStrokeFull;
  return Math.min(1, Math.max(0, (oil - from) / Math.max(1e-6, full - from)));
}

/**
 * One step of a two-stroke's lubrication. state is { overheat, scuff, seized }:
 * overheat 0..1 is how much extra heat poor oiling is making now (how starved it is times how hard it works), which the engine
 * puts into its metal (thermal.js), so the metal's °C, the gauge and pinking show it; scuff 0..1 is damage that
 * stays until it's stripped down. `lube` (0..1) is how well it's oiled where that isn't the fuel's oil: a four-stroke's sump.
 * Returns whether it seized on this step.
 */
export function stepLube(state, h, { oil, lube, running, work }, p) {
  const starved = 1 - (lube ?? lubeFactor(oil, p.oilGood));
  state.overheat = running ? starved * work : 0;
  if (running && !state.seized) state.scuff = Math.min(1, state.scuff + (h * starved * starved * work) / p.seizeSeconds);
  if (running && state.scuff >= 1) {
    state.seized = true;
    return true;
  }
  return false;
}

/** How well lubricated a four-stroke is from the oil in its sump: fine from `okLevel` of the way up, starved below it. */
export function sumpLube(level, okLevel) {
  return Math.min(1, Math.max(0, level / Math.max(0.01, okLevel)));
}

/** How far into nipping up it is, 0..1: it starts to tighten from nipFrom of the way to seizing. */
export function nipping(scuff, nipFrom) {
  return Math.min(1, Math.max(0, (scuff - nipFrom) / Math.max(0.01, 1 - nipFrom)));
}
