// Where you step off a vehicle: the game tries a few spots round it in turn (game.js findDismountSpot). Those are written for a
// quad; on something bigger (the Tor or Crag, built at 1.15 scale) they land inside its physics box and every one is refused, so
// each is pushed out until a body of `radius` stands clear of the box, never pulled in. Pure, tested (tests/dismount.test.js).

/**
 * A step-off spot [x, z] in chassis space, moved out past the chassis box ({ hx, hz } before `scale`) by `radius` plus `gap`.
 * A spot to one side moves sideways; one straight in front or behind moves along.
 */
export function clearOfChassis([x, z], chassis, scale = 1, radius = 0.3, gap = 0.08) {
  if (!chassis) return [x, z];
  const out = (v, half) => Math.sign(v) * Math.max(Math.abs(v), half * scale + radius + gap);
  return x !== 0 ? [out(x, chassis.hx), z] : [x, out(z, chassis.hz)];
}
