// How many triangles each vehicle's model may have (TODO 87), so the detail items (88 to 101) add detail where it shows rather
// than everywhere. tests/vehicleModels.test.js fails when a model goes over. Measured before the kit: quads 38k to 46k, the
// tractor 41k, the UTV 53k, the Tor 57k, the Crag 70k, the Finch 45k, the Griffin 57k, the trailers 13k to 17k (4k to 6k before item 101).

export const TRIANGLE_BUDGETS = {
  quad: 65000, // the five quads, the kids' quad and the loan
  small: 38000, // the mini moto and the three-wheeler (was 35k; the toothed sprockets and link-by-link chain of #48 are 2k to 3k on each)
  clipper: 60000, // the ride-on mower: a deck, a box and a bonnet, but nothing small or fussy
  hartley: 70000,
  yak: 80000,
  big: 100000, // the Land Rovers and the cars
  trailer: 22000, // each trailer (the bale trailer 21k with its winch, the tipping trailer 13k, after item 101: kit tyres, bolts, lamps, springs, cables)
};

/** Which budget a vehicle spec comes under. */
export function budgetFor(spec) {
  if (spec.miniMoto || spec.threeWheeler || spec.classicBike || spec.farmBike) return TRIANGLE_BUDGETS.small;
  if (spec.mower) return TRIANGLE_BUDGETS.clipper;
  if (spec.tractor) return TRIANGLE_BUDGETS.hartley;
  if (spec.utv) return TRIANGLE_BUDGETS.yak;
  if (spec.landRover || spec.car) return TRIANGLE_BUDGETS.big;
  return TRIANGLE_BUDGETS.quad;
}
