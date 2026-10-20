// A quad's hidden strength (#27, was TODO 132): each of the five is a little better at one thing than the rest. It is not on any spec
// sheet; the girls work it out from riding (npc/quadOpinion.js). Pure: the spec names a strength, the quad asks what it does here.
//
//   hill   : more drive going up a slope, so it holds its speed and its gear a little better
//   mud    : more grip in mud, so it spins and bogs a little less
//   tarmac : more grip on tarmac, and a little more drive on the flat there

export const STRENGTH_KINDS = ['hill', 'mud', 'tarmac'];

export const DEFAULT_STRENGTH_PARAMS = {
  amount: 0.1, // how much better at its own thing (a share: 0.1 is 10% more drive or grip)
  hillGrade: 0.12, // sine of the slope at which the hill strength is felt in full (about 7 degrees); gentler is felt in proportion
  tarmacDrive: 0.5, // the share of the tarmac strength that also goes into drive on the flat
};

/** The live values (the Tune tab edits this object in place), shared by every quad. */
export const STRENGTH_PARAMS = { ...DEFAULT_STRENGTH_PARAMS };

export const STRENGTH_PARAM_RANGES = {
  amount: [0, 0.4, 0.01],
  hillGrade: [0.03, 0.4, 0.01],
  tarmacDrive: [0, 1, 0.05],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The strength a spec names, or null (the kids' quad, the cars and the rest have none). */
export function strengthOf(spec) {
  return STRENGTH_KINDS.includes(spec?.strength) ? spec.strength : null;
}

/** Whether this quad has `kind` as its strength, scaled by its own `strengthAmount` if the spec sets one (a share of the shared amount). */
export function bonusFor(spec, kind, p = STRENGTH_PARAMS) {
  return strengthOf(spec) === kind ? p.amount * (spec.strengthAmount ?? 1) : 0;
}

/**
 * What the strength does this instant: { drive, mudGrip, tarmacGrip } as multipliers (1 for none).
 * `c`: { climb (sine of the nose's slope, negative downhill), mud (0..1), tarmac (0..1) } under it now.
 */
export function strengthEffects(spec, c, p = STRENGTH_PARAMS) {
  const hill = bonusFor(spec, 'hill', p);
  const mud = bonusFor(spec, 'mud', p);
  const tarmac = bonusFor(spec, 'tarmac', p);
  return {
    drive: 1 + hill * clamp01(c.climb / p.hillGrade) + tarmac * p.tarmacDrive * clamp01(c.tarmac),
    mudGrip: 1 + mud * clamp01(c.mud),
    tarmacGrip: 1 + tarmac * clamp01(c.tarmac),
  };
}

/** The ground a quad is on, for the girls to judge it by: 'hill' going up a real slope, 'mud', 'tarmac', or null (plain grass). */
export function groundKind({ climb, mud, tarmac, speed }, p = STRENGTH_PARAMS) {
  if (speed < 1.5) return null;
  if (climb >= p.hillGrade * 0.8) return 'hill';
  if (mud >= 0.4) return 'mud';
  if (tarmac >= 0.6) return 'tarmac';
  return null;
}
