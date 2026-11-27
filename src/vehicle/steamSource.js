// Where steam off a hot engine leaves the vehicle (#916). A water-cooled engine boils its coolant, so the steam comes out at the radiator:
// through the grille and from under the bonnet's front edge on a car, a tractor or a UTV, behind the front rack on a quad. An air-cooled
// quad's engine sits under the seat, so its hot metal steams from there. Pure: quadUnit.js turns the answer into a point in the world.

/** How far above the seat anchor an air-cooled engine's steam starts, in metres. */
export const SEAT_STEAM_RISE = 0.1;

/**
 * @param {object} spec a vehicle spec from quadSpecs.js
 * @param {boolean} [waterCooled] whether the engine in it has a radiator (the engine's own params, as a swapped engine brings its own)
 * @returns {{ from: 'radiator', at: { x: number, y: number, z: number } } | { from: 'seat', rise: number }} the radiator's point in the
 *   model's own space, or the seat anchor with how far above it
 */
export function steamSource(spec, waterCooled = !!spec.engine?.waterCooled) {
  if (waterCooled && spec.radiatorAt) return { from: 'radiator', at: spec.radiatorAt };
  return { from: 'seat', rise: SEAT_STEAM_RISE };
}
