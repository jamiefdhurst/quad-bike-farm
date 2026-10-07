// What a trailer on the hook does to whatever is pulling it. Pure, so it's tested without the game (tests/towing.test.js).
// The trailer isn't a physics body (vehicle/trailer.js), so its weight is faked cheaply: it takes a share of the puller's drive and
// of its brakes, the more so the more is in it. The tractor barely notices.

export const DEFAULT_TOW_PARAMS = {
  emptyKg: 90, // the tub and its wheels
  girlKg: 55, // a girl riding in it
  itemKg: 18, // a jerry can or the toolbox
  driveLoss: 0.0016, // fraction of the puller's drive lost per kg behind it
  brakeLoss: 0.0009, // and of its brakes
  minDrive: 0.45, // it never loses more than half
  minBrake: 0.6,
  tractorFelt: 0.15, // the tractor feels this share of what a quad does
};

export const TOW_PARAM_RANGES = {
  emptyKg: [20, 300, 5],
  girlKg: [20, 120, 5],
  itemKg: [2, 60, 1],
  driveLoss: [0, 0.005, 0.0001],
  brakeLoss: [0, 0.005, 0.0001],
  minDrive: [0.1, 1, 0.05],
  minBrake: [0.1, 1, 0.05],
  tractorFelt: [0, 1, 0.05],
};

/** Kilograms behind the hook: the trailer, plus `girls` riding in it and `items` loaded. */
export function towLoad(girls, items, p = DEFAULT_TOW_PARAMS) {
  return p.emptyKg + girls * p.girlKg + items * p.itemKg;
}

/** How much of its drive and braking the puller keeps with `kg` behind it (1 for nothing hitched). */
export function towEffect(kg, heavy, p = DEFAULT_TOW_PARAMS) {
  if (kg <= 0) return { driveFactor: 1, brakeFactor: 1 };
  const felt = heavy ? p.tractorFelt : 1;
  return {
    driveFactor: Math.max(p.minDrive, 1 - kg * p.driveLoss * felt),
    brakeFactor: Math.max(p.minBrake, 1 - kg * p.brakeLoss * felt),
  };
}
