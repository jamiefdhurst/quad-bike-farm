// The toolbox panel's picked row, pure: W and S walk the rows and buttons that are on the panel, and a hold on E fills over a short time.

/** The next index from `from` in `direction` (1 or -1) that `shown(i)` accepts, wrapping; `from` itself if nothing else shows. */
export function nextPick(count, from, direction, shown) {
  let i = from;
  for (let n = 0; n < count; n++) {
    i = (i + direction + count) % count;
    if (shown(i)) return i;
  }
  return from;
}

/**
 * One frame of a hold on E. `state` is `{ held, spent }`: seconds held so far and whether this hold has already done its job (so one
 * long hold does it once). Returns the new state and whether the job fires now. Letting go starts again.
 */
export function stepHold(state, down, dt, seconds) {
  if (!down) return { state: { held: 0, spent: false }, fired: false };
  if (state.spent) return { state, fired: false };
  const held = state.held + dt;
  if (held >= seconds) return { state: { held: 0, spent: true }, fired: true };
  return { state: { held, spent: false }, fired: false };
}
