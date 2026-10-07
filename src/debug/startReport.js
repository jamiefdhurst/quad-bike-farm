// What was dealt out at the start of a game, one block per vehicle, for the console: where it stands, its engine, meters, history,
// leftover tinkering, quirks and anything else that's random per vehicle, so it can be checked at a glance. Pure: it reads a
// plain description, so it's tested without the game.

const n = (v, digits = 1) => Number(v).toFixed(digits);

/**
 * @param {object} v
 * @param {string} v.name
 * @param {string} [v.where]       where it starts
 * @param {number} [v.plate]       the front plate digit(s) it wears
 * @param {number} v.idle          warm idle rpm
 * @param {number} v.top           full-throttle rpm
 * @param {number} v.redline
 * @param {number} v.roughness
 * @param {number} v.litres
 * @param {string} v.tap           starting fuel tap position
 * @param {number} v.hours, v.odo, v.trip  the meters
 * @param {string|null} v.pod      'analogue' | 'digital' | null
 * @param {number} v.wear
 * @param {{kind: string, level: number}[]} v.faults
 * @param {{limiter: number, mixture: number}|null} v.tinker
 * @param {string|null} v.lastRider
 * @param {string[]} v.quirks
 * @param {{gear: number, wear: number}|null} v.wornGear
 * @param {number|null} v.hand    the tractor's hand throttle at the start
 * @param {boolean} [v.hasHistory] false for a vehicle that has no history dealt (the tractor)
 */
export function describeVehicle(v) {
  const lines = [`${v.name}${v.where ? ` (${v.where})` : ''}`];
  lines.push(`  engine:   idle ${v.idle} rpm, top ${v.top} rpm (redline ${v.redline}), roughness ${n(v.roughness, 2)}, ${n(v.litres)} L, tap ${v.tap}`);
  lines.push(`  meters:   ${n(v.hours)} h, ${n(v.odo)} mi, trip ${n(v.trip)}, pod: ${v.pod ?? 'none'}${v.plate ? `, plate ${v.plate}` : ''}`);
  if (v.hand != null) lines.push(`  hand throttle: ${n(v.hand, 2)}`);
  if (v.hasHistory === false) {
    lines.push(`  wear:     ${n(v.wear, 3)} (no history dealt)`);
  } else {
    lines.push(`  wear:     ${n(v.wear, 3)}`);
    lines.push(`  faults:   ${v.faults.length ? v.faults.map((f) => `${f.kind} ${n(f.level, 2)}`).join(', ') : 'none'}`);
    lines.push(`  tinkered: ${v.tinker ? [v.tinker.limiter ? `throttle stop out ${v.tinker.limiter} turn${v.tinker.limiter > 1 ? 's' : ''}` : '', v.tinker.mixture ? `mixture ${v.tinker.mixture} click${v.tinker.mixture > 1 ? 's' : ''} rich` : ''].filter(Boolean).join(', ') : 'no'}`);
    lines.push(`  last out: ${v.lastRider ?? 'nobody'}`);
  }
  lines.push(`  quirks:   ${v.quirks.length ? v.quirks.join(', ') : 'none'}`);
  if (v.wornGear) lines.push(`  gearbox:  jumps out of gear ${v.wornGear.gear} (worn ${n(v.wornGear.wear, 2)})`);
  return lines.join('\n');
}
