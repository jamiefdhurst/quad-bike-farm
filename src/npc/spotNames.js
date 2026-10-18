// Names for places on the farm, so a girl who is stuck can shout where she is ("I am stuck by the ford!"). Pure: the nearest named spot to a
// point. Each has an `id` (the key of her line for it, see strandedLines.js) and a `name` that reads after "by", "in" or "at" as written.

export const SPOTS = [
  { id: 'yard', x: -54, z: 58, name: 'in the yard' },
  { id: 'ramp', x: 16, z: -8, name: 'by the jump' },
  { id: 'dragStrip', x: -30, z: 19, name: 'on the drag strip' },
  { id: 'lowBog', x: -30, z: -38, name: 'in the low bog' },
  { id: 'bottomTrack', x: -46, z: -30, name: 'by the bottom of the track' },
  { id: 'middleField', x: 4, z: -32, name: 'in the middle of the field' },
  { id: 'northHedge', x: 30, z: -70, name: 'by the north hedge' },
  { id: 'farCorner', x: -68, z: -50, name: 'in the far corner' },
  { id: 'westHedge', x: -72, z: -22, name: 'down the west hedge' },
  { id: 'lane', x: -30, z: 112, name: 'down the lane' },
  { id: 'ford', x: -30, z: 140, name: 'by the ford' },
  { id: 'hill', x: 8, z: 172, name: 'on the hill' },
  { id: 'pond', x: -66, z: 110, name: 'by the pond' },
  { id: 'wood', x: -30, z: -120, name: 'in the wood' },
  { id: 'cattleGrid', x: 78, z: 2, name: 'by the cattle grid' },
  { id: 'road', x: 130, z: 2, name: 'out on the farm road' },
  { id: 'trough', x: 147, z: -5.5, name: 'by the trough' },
  { id: 'barley', x: 112, z: -40, name: 'in the barley field' },
  { id: 'wheat', x: 150, z: 44, name: 'in the wheat field' },
  { id: 'fieldShed', x: 95, z: -65, name: 'by the field shed' },
  { id: 'dutchBarn', x: 186, z: -14, name: 'by the Dutch barn' },
];

/** The named spot nearest to (x, z), with how far off it is: { id, name, distance }. */
export function nearestNamedSpot(x, z, spots = SPOTS) {
  let best = null;
  for (const s of spots) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (!best || d < best.distance) best = { id: s.id, name: s.name, distance: d };
  }
  return best;
}
