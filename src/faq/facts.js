// What the FAQ page says about each vehicle that can be read straight off its spec, so it changes when the spec does: the engine,
// the gearbox, the tank and how it reverses. Pure.

import * as SPECS from '../vehicle/quadSpecs.js';
import { DEFAULT_FUEL_PARAMS } from '../vehicle/fuelSystem.js';
import { DEFAULT_GEARBOX_PARAMS } from '../vehicle/manualDrivetrain.js';

/**
 * Every vehicle that can be on the farm, in the order quadSpecs.js has them: every spec it exports, alone or in a list, so a new
 * vehicle is on the page (and tests/faq.test.js asks for its note) without anyone having to add it here.
 */
export const ALL_VEHICLE_SPECS = (() => {
  const isSpec = (s) => s && typeof s === 'object' && s.id && s.name && s.engine;
  // A module's exports come in alphabetical order, so put them in the page's: the five quads, the other small ones, then the big
  // machines, oldest first.
  const lists = [SPECS.QUAD_SPECS, SPECS.EXTRA_SPECS, ...Object.values(SPECS).filter((v) => Array.isArray(v) && v !== SPECS.QUAD_SPECS && v !== SPECS.EXTRA_SPECS)];
  const big = (s) => (s.tractor ? 0 : s.utv ? 1 : s.defender ? 3 : s.landRover ? 2 : s.car ? ({ fiesta: 5, corsa: 6 }[s.car] ?? 7) : 4); // the girls' cars last, Amy's first, then yours
  const singles = Object.values(SPECS).filter((v) => !Array.isArray(v) && isSpec(v)).sort((a, b) => big(a) - big(b));
  return [...lists.flat(), ...singles].filter(isSpec);
})();

const REVERSE = {
  none: 'None: get off and push it (hold V)',
  bars: 'B with the clutch in and the bars turned',
  button: 'Stopped, hold S and press B',
  knee: 'B with the clutch in, stopped',
  dashLever: 'Stopped, B flips the dash lever',
};

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

/** [label, value] pairs for one spec. */
export function vehicleFacts(spec) {
  const engine = spec.engine ?? {};
  const facts = [];
  if (engine.compressionIgnition || engine.runsOnDiesel) facts.push(['Engine', 'Diesel, on red diesel, with glow plugs']);
  else if (engine.strokes === 2) facts.push(['Engine', 'Two-stroke, on pre-mix']);
  else facts.push(['Engine', engine.injected ? 'Four-stroke, on petrol, fuel injected (no choke)' : 'Four-stroke, on petrol']);

  const manual = spec.manual || spec.tractor;
  if (manual) {
    const gears = { ...DEFAULT_GEARBOX_PARAMS, ...spec.gearbox }.gears;
    facts.push(['Gearbox', `Manual, ${NUMBERS[gears] ?? gears} gears and a clutch (Shift)`]);
  } else facts.push(['Gearbox', 'Automatic']);

  const reverse = manual && !spec.reverseStyle ? 'A reverse gear (B, with the clutch in)'
    : REVERSE[spec.reverseStyle] ?? (manual ? 'A reverse gear' : null);
  if (reverse) facts.push(['Reverse', reverse]);

  const start = [];
  if (engine.compressionIgnition) start.push('glow plugs and the key');
  else if (!engine.noStarter) start.push('the key and the starter');
  // The Land Rover's pullStart is its starting handle (a swing is the engine's pull).
  if (engine.crankHandle) start.push('a starting handle (P) for a flat battery');
  else if (spec.pullStart || engine.pullStart) start.push('a pull-start (P)');
  if (start.length) facts.push(['Starting', start.join(', ').replace(/^./, (c) => c.toUpperCase())]);

  const tank = { ...DEFAULT_FUEL_PARAMS, ...spec.fuel }.tankCapacity;
  facts.push(['Tank', `${tank} litres`]);
  if (spec.driveSwitch) facts.push(['4WD', spec.diffLock ? 'Switchable (G), with a diff lock (U)' : 'Switchable (G)']);
  if (spec.solo) facts.push(['Seats', 'One']);
  if (spec.car) facts.push(['Seats', 'Four, two in front and two in the back'], ['Drive', 'Front-wheel drive, on road tyres']);
  return facts;
}
