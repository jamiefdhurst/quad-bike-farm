// Far is far (#690). On a farm this size a girl doesn't set off on a 400 m walk on her own choice: past `liftFrom` metres of the way to
// where she wants to be she asks for a lift, or takes a quad herself (what the chooser's `lift` offer does). Pure: the game says where
// each offer would take her and how to get there, and carries out what comes back. Tested in tests/farWalk.test.js.

export const DEFAULT_FAR_WALK_PARAMS = {
  liftFrom: 150, // metres of way (by the gateways and tracks) beyond which she asks for a lift or takes a quad instead of walking
  liftWeight: 0.9, // how keen she is to go the far way, as a share of the best of the offers that would have taken her there
  waitingRadius: 25, // metres: she is this close to a waiting point (the hill's foot) for her hut and flask ranges to count from it
  hearsYou: 16, // metres: you are this close and sat on a stopped quad with room on the back for her to ask you for the lift
  liftParkWithin: 10, // metres: on a quad of her own, she parks this close to the place and gets off there, rather than driving into it
  liftDropWithin: 30, // metres: on the back of yours, she gets off when you stop this close to the place she asked for
  liftGiveUp: 400, // seconds: a lift that hasn't got her there (never got on, or the drive went elsewhere) is forgotten after this
};

export const FAR_WALK_PARAM_RANGES = {
  liftFrom: [40, 400, 5],
  liftWeight: [0, 2, 0.05],
  waitingRadius: [5, 80, 1],
  hearsYou: [4, 60, 1],
  liftParkWithin: [3, 40, 1],
  liftDropWithin: [5, 80, 1],
  liftGiveUp: [60, 1200, 10],
};

/** Metres along a route of points from `from`. */
export function wayLength(from, route) {
  let total = 0;
  let prev = from;
  for (const pt of route) {
    total += Math.hypot(pt.x - prev.x, pt.z - prev.z);
    prev = pt;
  }
  return total;
}

/** Whether she is too far from you to follow you on foot: she stops and calls after you instead of trudging (companion.js, the walk to you). */
export const callsAfter = (metres, p = DEFAULT_FAR_WALK_PARAMS) => metres > p.liftFrom;

/** Whether the way to a place is too far to walk on her own choice. */
export const tooFar = (metres, p = DEFAULT_FAR_WALK_PARAMS) => metres > p.liftFrom;

/**
 * Splits her offers: `near` she walks to (or has no place to walk to) and `far` is the ones whose place is a long way off.
 * `placeOf(offer)` gives { x, z } or null (no place: it is never far), `wayTo(place)` the route points from where she is.
 */
export function splitFar(offers, from, placeOf, wayTo, p = DEFAULT_FAR_WALK_PARAMS) {
  const near = [];
  const far = [];
  for (const o of offers) {
    const place = placeOf(o);
    if (!place) near.push(o);
    else if (tooFar(wayLength(from, wayTo(place)), p)) far.push({ offer: o, place });
    else near.push(o);
  }
  return { near, far };
}

/**
 * The one offer that takes her the far way: the keenest of the far offers, with a share of its weight, going to its place. Null with
 * nothing far. `how` is 'ask' (you are sat on a stopped quad with room, close by), 'quad' (a quad she can take) or null (neither: she stays put).
 */
export function liftOffer(far, how, p = DEFAULT_FAR_WALK_PARAMS) {
  if (!far.length || !how) return null;
  const best = far.reduce((a, b) => ((b.offer.weight ?? 1) > (a.offer.weight ?? 1) ? b : a));
  return { key: 'lift', girl: best.offer.girl, weight: (best.offer.weight ?? 1) * p.liftWeight, place: best.place, how, for: best.offer.key };
}

/**
 * On the back of your quad for a lift (#1066), each frame: 'board' when she is first sat on it (she says where she wants to go), 'off' when
 * you have stopped within `liftDropWithin` of the place, 'gone' when she is off it some other way (or never got on in `liftGiveUp`), else null.
 */
export function liftDrop({ boarded, on, stopped, distance, since }, p = DEFAULT_FAR_WALK_PARAMS) {
  if (!boarded) return on ? 'board' : since > p.liftGiveUp ? 'gone' : null;
  if (!on) return 'gone';
  return stopped && distance <= p.liftDropWithin ? 'off' : null;
}

/**
 * Whether she is still on her way to the lift (#1066), from her state, its goal if walking, and whether her quad is the lift's: onto the
 * back of yours ('ask'), or to and off on a quad of her own ('quad'). Getting off another quad first counts. Re-tasked, the lift is dropped.
 */
export function onTheWay({ how, state, goal, sameQuad }) {
  if (state === 'dismounting') return true;
  if (!sameQuad) return false;
  if (how === 'ask') return state === 'seated' || state === 'mounting' || (state === 'walking' && goal === 'mount');
  return ['driving', 'starting', 'cranking', 'pushing', 'mounting', 'shuffling'].includes(state) || (state === 'walking' && ['drive', 'crank', 'push', 'start'].includes(goal));
}

/** A lift she is on, for the Girls tab and the console: what for, how, and how far off the place is from `from`; 'none' when she isn't on one. */
export function describeLift(lift, from, labelOf = (k) => k) {
  if (!lift) return 'none';
  const how = lift.how === 'ask' ? (lift.boarded ? 'on the back of your quad' : 'getting on the back of your quad') : 'on a quad of her own';
  return `to ${labelOf(lift.for)}, ${how}, ${Math.round(Math.hypot(lift.place.x - from.x, lift.place.z - from.z))} m off`;
}

/** How she gets there: ask you if you are close on a stopped quad with room on the back, else a free quad of her own, else not at all. */
export function howShePlans({ youDistance, youStopped, youRoom, quadFree }, p = DEFAULT_FAR_WALK_PARAMS) {
  if (youStopped && youRoom && youDistance <= p.hearsYou) return 'ask';
  return quadFree ? 'quad' : null;
}
