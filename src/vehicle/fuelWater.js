// Water in the fuel. A jerry can left out in the rain, or an old tank, gets water in it. Water is heavier than petrol, so on its way to the
// carb it settles in the sediment bowl on the fuel tap, which you can see fill. While the bowl has room it keeps most of the water back;
// once it is full the water goes on to the carb and the engine misfires and cuts out. Draining the bowl at the tap lets the water out of the
// tank's bottom too. Pure logic, no Three.js.

export const DEFAULT_FUEL_WATER_PARAMS = {
  canRainRate: 0.0004, // fraction of a can's contents that becomes water per second left out in full rain (about 5 minutes for 10%)
  canMaxWater: 0.12, // most water a can collects (its cap only lets so much in)
  canRainFrom: 0.25, // rain below this doesn't get in
  bowlLitres: 0.03, // litres of water the sediment bowl holds before it is full
  bowlCatch: 0.92, // share of the water passing the tap that settles in the bowl while it has room
  fullAt: 0.08, // fraction of the carb's fuel that is water for the engine to be at its worst
  drainLoss: 0.15, // litres of fuel that go with the water when the bowl is drained
};

export const FUEL_WATER_RANGES = {
  canRainRate: [0, 0.005, 0.0001],
  canMaxWater: [0, 0.5, 0.01],
  canRainFrom: [0, 1, 0.05],
  bowlLitres: [0.01, 0.5, 0.005],
  bowlCatch: [0, 1, 0.01],
  fullAt: [0.01, 0.5, 0.005],
  drainLoss: [0, 1, 0.05],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A can's new water fraction after dt seconds: it climbs while it stands out in the rain (not held, not under cover). */
export function stepCanWater(water, dt, { rain = 0, exposed = false }, P = DEFAULT_FUEL_WATER_PARAMS) {
  if (!exposed || rain <= P.canRainFrom) return water;
  return Math.min(P.canMaxWater, water + P.canRainRate * rain * dt);
}

/**
 * The tap's sediment bowl as fuel flows past it: `waterLitres` of water in this flow. Returns the bowl's new fill (0..1) and the litres of
 * water that got by to the carb.
 */
export function settleWater(sediment, waterLitres, P = DEFAULT_FUEL_WATER_PARAMS) {
  if (waterLitres <= 0) return { sediment, passed: 0 };
  const room = (1 - sediment) * P.bowlLitres;
  const caught = Math.min(room, waterLitres * P.bowlCatch);
  return { sediment: clamp01(sediment + caught / P.bowlLitres), passed: waterLitres - caught };
}

/** How wet the carb's fuel is for the engine, 0..1: the water fraction against the one that is worst. */
export function fuelWaterLevel(bowlWater, P = DEFAULT_FUEL_WATER_PARAMS) {
  return clamp01(bowlWater / P.fullAt);
}

/** What the sediment bowl shows, in words, for a toast or the panel. */
export function sedimentText(sediment) {
  if (sediment < 0.05) return 'clear';
  if (sediment < 0.5) return 'a little water in the bottom';
  if (sediment < 0.95) return 'half full of water';
  return 'full of water';
}
