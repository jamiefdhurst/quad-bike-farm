// How many triangles each vehicle's model may have (TODO 87), so the detail items (88 to 101) add detail where it shows rather
// than everywhere. tests/vehicleModels.test.js fails when a model goes over. Measured before the kit: quads 38k to 46k, the
// tractor 41k, the UTV 53k, the Series 57k, the Defender 70k, the Fiesta 45k, the Corsa 57k, the trailers 4k to 6k.

export const TRIANGLE_BUDGETS = {
  quad: 65000, // the five quads, the kids' quad and the loan
  small: 35000, // the mini moto and the three-wheeler
  tractor: 70000,
  utv: 80000,
  big: 100000, // the Land Rovers and the cars
  trailer: 15000, // each trailer
};

/** Which budget a vehicle spec comes under. */
export function budgetFor(spec) {
  if (spec.miniMoto || spec.threeWheeler) return TRIANGLE_BUDGETS.small;
  if (spec.tractor) return TRIANGLE_BUDGETS.tractor;
  if (spec.utv) return TRIANGLE_BUDGETS.utv;
  if (spec.landRover || spec.car) return TRIANGLE_BUDGETS.big;
  return TRIANGLE_BUDGETS.quad;
}
