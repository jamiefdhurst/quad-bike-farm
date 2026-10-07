// Jetting a two-stroke. Pure logic, no Three.js.
//
// The jet in a two-stroke's carb is sized for the air it breathes: cold air is dense, so it wants a bigger
// (richer) jet, and hot air thin, so a smaller (leaner) one. The jet kit in the toolbox changes the main jet
// in whole sizes either side of the one it came with. The right size for the day is a fraction, so a size
// is never quite perfect, but the closest one is near enough to be the cleanest power the engine makes.
// `error` is the jet size less the right size: negative is lean, positive rich.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The jet size (in sizes from stock, fractional) the day wants: 0 at the reference temperature, bigger in the cold, smaller in the heat. */
export function idealJet(celsius, p, bore = 0) {
  // A big-bore barrel breathes more, so it wants a richer jet again (see bigBore.js).
  return (p.jetRefCelsius - celsius) * p.jetPerDegree + bore * (p.boreJet ?? 0);
}

/** How far the fitted jet is from the right one for the day: negative lean, positive rich. */
export function jetError(jet, celsius, p, bore = 0) {
  return jet - idealJet(celsius, p, bore);
}

/** 0..1 how lean it is enough to hurt: nothing inside `jetLeanSafe` sizes, full at `jetLeanFull`. */
export function leanStarve(error, p) {
  return clamp01((-error - p.jetLeanSafe) / Math.max(0.01, p.jetLeanFull - p.jetLeanSafe));
}

/** 0..1 how well it's jetted: 1 on the nose (inside `jetTrueWithin`), fading to 0 at `jetTrueFade` sizes out either way. */
export function jetTrue(error, p) {
  const off = Math.abs(error);
  return clamp01(1 - (off - p.jetTrueWithin) / Math.max(0.01, p.jetTrueFade - p.jetTrueWithin));
}

/** The mixture a jet error adds: richer or leaner in proportion. */
export function jetMixture(error, p) {
  return error * p.jetMixture;
}

/** What the jet is called on the panel: "stock", "2 sizes bigger" and so on. */
export function jetText(jet) {
  if (jet === 0) return 'Stock jet';
  return `${Math.abs(jet)} size${Math.abs(jet) === 1 ? '' : 's'} ${jet > 0 ? 'bigger' : 'smaller'}`;
}

/** What it says it needs for the day, the way the box on the kit would: "leaner" or "richer". */
export function adviceText(celsius, p, bore = 0) {
  const ideal = idealJet(celsius, p, bore);
  if (Math.abs(ideal) < 0.5) return 'the stock jet suits this weather';
  const sizes = Math.round(Math.abs(ideal));
  return `${celsius} °C wants about ${sizes} size${sizes === 1 ? '' : 's'} ${ideal > 0 ? 'bigger' : 'smaller'}`;
}
