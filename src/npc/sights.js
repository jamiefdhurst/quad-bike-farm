// Taking you to see something. With you on the back, a girl's drive can have a purpose: a gate left open, the view up the hill, a quad left
// running. She drives there by the gateways (outings.js does the picking), stops, looks, points, says why, and drives you back to where you
// got on. Pure: the game says what there is to see now, this stands her off it and picks one.
import { pickOuting } from './outings.js';

export const DEFAULT_SIGHT_PARAMS = {
  chance: 0.75, // with you on the back, the chance a drive goes to see something (when there is something to see) instead of looping
  minDistance: 15, // metres: nearer than this isn't worth the trip
  maxDistance: 230, // metres: further than this and she'd be gone all day
  standOff: 7, // metres short of a gate or a quad that she pulls up
  stopMin: 6, // seconds she stays at it, pointing and saying why
  stopMax: 9,
  pointSeconds: 3.5, // seconds her arm is out
};

export const SIGHT_PARAM_RANGES = {
  chance: [0, 1, 0.05],
  minDistance: [5, 100, 5],
  maxDistance: [50, 400, 10],
  standOff: [3, 15, 0.5],
  stopMin: [2, 30, 1],
  stopMax: [2, 60, 1],
  pointSeconds: [1, 10, 0.5],
};

/** The gates that are open and are usually shut (a visitor, or you, left them): the ones worth showing. */
export function gatesFoundOpen(gates, usuallyShut = ['road', 'grid']) {
  return gates.filter((g) => g.isOpen && usuallyShut.includes(g.id)).map((g) => ({ x: g.x, z: g.z }));
}

/** (x, z) `d` metres from `target` towards `from`: where she pulls up short of a thing. */
export function standOff(from, target, d) {
  const dx = from.x - target.x;
  const dz = from.z - target.z;
  const len = Math.hypot(dx, dz);
  if (len <= d) return { x: from.x, z: from.z };
  return { x: target.x + (dx / len) * d, z: target.z + (dz / len) * d };
}

/**
 * Everything there is to see from `from`, as { kind, name, x, z, look: { x, z }, line }: (x, z) is where she stops, `look` what she points
 * at, `line` the voice line she says there. `found` is { gates: [{ x, z }], view: { x, z, look } | null, running: [{ x, z, line }] }.
 */
export function sightsFrom(from, found, p = DEFAULT_SIGHT_PARAMS) {
  const sights = [];
  for (const g of found.gates ?? []) {
    const at = standOff(from, g, p.standOff);
    sights.push({ kind: 'gate', name: 'the open gate', x: at.x, z: at.z, look: { x: g.x, z: g.z }, line: 'sightGate' });
  }
  if (found.view) sights.push({ kind: 'view', name: 'the view', x: found.view.x, z: found.view.z, look: found.view.look, line: 'sightView' });
  for (const r of found.running ?? []) {
    const at = standOff(from, r, p.standOff);
    sights.push({ kind: 'running', name: 'a quad left running', x: at.x, z: at.z, look: { x: r.x, z: r.z }, line: r.line });
  }
  return sights;
}

/** Which sight she takes you to: { name, spot, path } as pickOuting gives (nearer ones likelier, only by a way she can drive), or null. */
export function pickSight(from, sights, route, isClear, random = Math.random, p = DEFAULT_SIGHT_PARAMS) {
  return pickOuting(from, sights, route, isClear, random, p);
}
