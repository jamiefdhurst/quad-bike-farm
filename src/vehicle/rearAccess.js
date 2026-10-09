// Getting into the 200TDi's back bench: the front backrest on that side tips forward while someone climbs past it, and which of the
// back's seats you take. Pure, tested in tests/rearAccess.test.js; the model's backrests are posed by poseSeatTips (landRoverModel.js).

export const DEFAULT_REAR_ACCESS_PARAMS = {
  tipSpeed: 2.2, // of a full tip a second, forward or back up
  holdSeconds: 1.3, // a backrest stays tipped this long after you climb in or out yourself (you don't have a climb to wait on)
  backHalfZ: -0.55, // look at the car behind this (model frame, the B pillar) and B or E is for the back bench
};

export const REAR_ACCESS_PARAM_RANGES = {
  tipSpeed: [0.2, 8, 0.1],
  holdSeconds: [0, 5, 0.1],
  backHalfZ: [-1.5, 0.5, 0.05],
};

/**
 * Which front backrests want to be tipped: { left, driver }, 1 or 0. `moving` lists the doors (`left` or `driver`) someone is climbing
 * through into or out of the back right now, and `held` the ones you've just used; `occupied` is the front seats with someone sat in
 * them, which can't tip (whoever comes past squeezes by).
 */
export function seatTipTargets(moving, occupied) {
  const t = { left: 0, driver: 0 };
  const taken = new Set(occupied);
  for (const door of moving) if (door in t && !taken.has(door)) t[door] = 1;
  return t;
}

/** Moves each backrest toward its target at `speed` (of a full tip a second). Changes `tips` in place and returns it. */
export function easeSeatTips(tips, targets, dt, speed) {
  for (const k of Object.keys(tips)) {
    const d = (targets[k] ?? 0) - tips[k];
    tips[k] += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  }
  return tips;
}

/**
 * The back seat you get into: the one nearest the door you're at, then the middle, then the far one. `taken` is a Set (or array) of
 * seats with someone in them or on the way; `driverSide` is whether you're on the driver's side and can use that door (nobody at the
 * wheel). Null when the back is full.
 */
export function pickRearSeat(taken, driverSide) {
  const t = new Set(taken);
  const order = driverSide ? ['rearRight', 'rearMid', 'rearLeft'] : ['rearLeft', 'rearMid', 'rearRight'];
  return order.find((s) => !t.has(s)) ?? null;
}

/** The door a back seat is reached by: the right one by the driver's, unless somebody's at the wheel; the others by the passenger's. */
export function rearDoor(seat, wheelTaken) {
  return seat === 'rearRight' && !wheelTaken ? 'driver' : 'left';
}
