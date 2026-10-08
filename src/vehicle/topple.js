// The riders' weight toppling a quad on a slope. The chassis's mass already counts a rider, but its centre of mass is low (about 0.28 m
// off the ground), so a quad wouldn't go over until about 60 degrees. Raising it would roll quads in ordinary corners on the flat, because
// the tyres hold far more than a real quad's do. So the rider's height is added here instead, as the extra push over gravity gives a
// weight sat up on the seat once the quad leans or pitches: nothing level, growing with the sine of the tilt, the same whichever way it
// tilts and never from turning. Side-on to a steep bank it rolls; nose-up a steep one it flips backwards. Pure, no Rapier.

const G = 9.81;

/**
 * How much toppling weight is aboard, kg m (mass times its height above the centre of mass): the vehicle's `riderTopple` for someone at the
 * controls, `backTopple` times that again for someone on the back. Nothing with nobody on.
 */
export function toppleLoad(params, { front = false, back = false } = {}) {
  const k = params.riderTopple ?? 0;
  return (front ? k : 0) + (back ? k * (params.backTopple ?? 0) : 0);
}

/**
 * The torque (N m, world axes) from `load` kg m of weight carried up along the chassis's up vector `up` (a unit vector, world axes): the
 * cross product of that lever with gravity, which leans it further the way it's already leaning.
 */
export function toppleTorque(up, load) {
  return { x: load * G * up.z, y: 0, z: -load * G * up.x };
}

/**
 * The static tip angle, radians, for a vehicle of `mass` kg with its centre of mass `height` m up and `halfTrack` m from the middle to its
 * wheels (or half its wheelbase, for flipping backwards), with `load` kg m aboard: where the wheels' support stops holding it.
 */
export function tipAngle(mass, height, halfTrack, load) {
  return Math.atan2(mass * halfTrack, mass * height + load);
}
