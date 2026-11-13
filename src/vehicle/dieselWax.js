// Diesel waxing in a hard frost. Below about -2 degrees the paraffin in red diesel comes out of solution and clogs the filter, so a diesel
// (the tractor, the UTV, the Tor and the Crag) left out on a hard frosty night or day starts to struggle and then cuts out and won't start.
// Kept in the barn it is fine. A running engine's warmth, a milder spell or a dose of anti-gel from the bottle at the petrol tank clears it.
// `wax` is 0 clear .. 1 solid, kept on the fuel system. Petrol never waxes. Pure logic, no Three.js: quad.js feeds it each step.

export const DEFAULT_DIESEL_WAX_PARAMS = {
  waxBelow: -2, // degrees C: the diesel starts to wax below this
  waxFull: -6, // degrees C at and below which it waxes at its fastest
  buildRate: 0.0014, // wax a second at the worst, on a vehicle stood outside with the engine off (about twelve minutes to solid)
  runBuild: 0.3, // the share of that which still builds with the engine running (the fuel going round is warm)
  startChance: 0.7, // chance a diesel left out on a hard frosty morning starts the game partly waxed
  meltEngine: 0.006, // wax a second melted by a warm running engine (a cold one does a third of this)
  meltWarm: 0.002, // wax a second melted per degree above the waxing point
  meltSun: 0.0006, // wax a second melted in full sun (out of the open only)
  meltBarn: 0.004, // wax a second melted stood under cover, where the frost doesn't reach it
  antiGelCut: 0.95, // share of the waxing that anti-gel in the tank stops, at full strength
  antiGelMelt: 0.03, // wax a second that anti-gel dissolves, at full strength
  antiGelEffect: 0.3, // the least treated share of the tank that does anything
};

export const DIESEL_WAX_PARAM_RANGES = {
  waxBelow: [-10, 5, 0.5],
  waxFull: [-20, 0, 0.5],
  buildRate: [0, 0.02, 0.0001],
  runBuild: [0, 1, 0.05],
  startChance: [0, 1, 0.05],
  meltEngine: [0, 0.05, 0.0005],
  meltWarm: [0, 0.02, 0.0002],
  meltSun: [0, 0.01, 0.0001],
  meltBarn: [0, 0.03, 0.0005],
  antiGelCut: [0, 1, 0.05],
  antiGelMelt: [0, 0.2, 0.005],
  antiGelEffect: [0, 1, 0.05],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 0..1 how well the cold suits waxing: nothing above `waxBelow`, everything from `waxFull` down. */
export function waxWeather(temperature, P = DEFAULT_DIESEL_WAX_PARAMS) {
  return clamp01((P.waxBelow - temperature) / Math.max(0.1, P.waxBelow - P.waxFull));
}

/** The wax a diesel starts the game with: a hard frost may have left one out in the open partly waxed. */
export function dealWax(random, temperature, covered, P = DEFAULT_DIESEL_WAX_PARAMS) {
  const cold = waxWeather(temperature, P);
  if (cold <= 0 || covered || random() >= P.startChance) return 0;
  return clamp01(cold * (0.5 + 0.5 * random()));
}

/**
 * The new wax after dt seconds. `antiGel` is the share of the tank treated (0..1); `covered` is stood under a roof; `sun` is 0..1.
 * A treated tank barely builds any and dissolves what is there.
 */
export function stepWax(wax, dt, { temperature = 12, running = false, engineTemp = 0, covered = false, sun = 0, antiGel = 0 } = {}, P = DEFAULT_DIESEL_WAX_PARAMS) {
  const treated = antiGel >= P.antiGelEffect ? antiGel : 0;
  let up = 0;
  if (!covered) up = P.buildRate * waxWeather(temperature, P) * (running ? P.runBuild : 1) * (1 - P.antiGelCut * treated);
  let down = P.meltWarm * Math.max(0, temperature - P.waxBelow) + P.meltSun * sun * (covered ? 0 : 1) + (covered ? P.meltBarn : 0);
  if (running) down += P.meltEngine * (0.3 + 0.7 * clamp01(engineTemp));
  down += P.antiGelMelt * treated;
  return clamp01(wax + dt * (up - down));
}

/** What a dose of anti-gel does to the tank's treated share: `litres` of the tank it covers, `pourRate` a second. */
export function pourAntiGel(antiGel, h, pourRate) {
  return clamp01(antiGel + pourRate * h);
}

/** The filter's state in words, for a toast or the panel. */
export function waxText(wax) {
  if (wax < 0.1) return 'clear';
  if (wax < 0.4) return 'a little cloudy';
  if (wax < 0.8) return 'waxing up';
  return 'waxed solid';
}
