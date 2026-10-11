// Driving somewhere. A girl's own drive used to be loops round where she started, a few metres across, until she had had enough. Now
// some of her drives are an outing: she picks a place on the farm, drives there by the gateways, pauses a moment, and drives back.
// Pure logic: the game lists the places and says how to get to one; HerDrive does the driving (opts.outing).

export const DEFAULT_OUTING_PARAMS = {
  chance: 0.6, // at the start of each of her drives (and each time she plans afresh), the chance she sets off somewhere instead of looping
  minDistance: 35, // metres: nearer than this isn't worth the trip
  maxDistance: 230, // metres: further than this and she'd be gone all day
  speedScale: 1.3, // how much quicker she goes on the way than on her loops (she is going somewhere)
  stopMin: 4, // seconds she stops at the place before turning back
  stopMax: 9,
  extraSeconds: 25, // added to the time a trip takes, so she isn't bored of it before she is back
};

export const OUTING_PARAM_RANGES = {
  chance: [0, 1, 0.05],
  minDistance: [10, 150, 5],
  maxDistance: [50, 400, 10],
  speedScale: [1, 3, 0.05],
  stopMin: [0, 30, 1],
  stopMax: [0, 60, 1],
  extraSeconds: [0, 120, 5],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Where she could go from `from`: { name, x, z } of a place within range, not one she is at, with the way there (the route's points, ending at
 * the place) all driveable (`isClear`, leg by leg). `spots` is [{ name, x, z }], `route(from, to)` the gateway points to pass then `to`.
 * Returns { name, spot, path } or null. A nearer place is likelier (weight 1 over distance), so she doesn't always go to the far end.
 */
export function pickOuting(from, spots, route, isClear, random = Math.random, p = DEFAULT_OUTING_PARAMS) {
  const options = [];
  for (const spot of spots) {
    const d = dist(from, spot);
    if (d < p.minDistance || d > p.maxDistance) continue;
    const path = route(from, spot);
    let prev = from;
    let ok = path.length > 0;
    for (const pt of path) {
      if (!isClear(prev, pt)) {
        ok = false;
        break;
      }
      prev = pt;
    }
    if (ok) options.push({ name: spot.name, spot, path, weight: 1 / Math.max(40, d) });
  }
  if (!options.length) return null;
  let roll = random() * options.reduce((sum, o) => sum + o.weight, 0);
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return options[options.length - 1];
}

/** Metres along a path of points from `from`. */
export function pathLength(from, path) {
  let total = 0;
  let prev = from;
  for (const pt of path) {
    total += dist(prev, pt);
    prev = pt;
  }
  return total;
}

/** The places on the farm worth driving to, as { name, x, z }, from the layout and the hill's meeting point. `stripPoint` finds a spot along the drag strip. */
export function outingSpots(layout, hillWait, stripPoint) {
  const spots = [];
  const add = (name, x, z) => spots.push({ name, x, z });
  if (layout.dragStrip) {
    const s = stripPoint(layout.dragStrip, -16, 0);
    add('the drag strip', s.x, s.z);
  }
  if (layout.road?.pad) add('the end of the road', layout.road.pad.x - 4, layout.road.z);
  if (layout.muckHeap) add('the muck heap', layout.muckHeap.x - 7, layout.muckHeap.z);
  if (layout.trough) add('the trough', layout.trough.x, layout.trough.z + 5);
  if (layout.jumpRamp) add('the jump', layout.jumpRamp.x + 9, layout.jumpRamp.z + 9);
  if (hillWait) add('the foot of the hill', hillWait.x, hillWait.z);
  if (layout.road?.gaps) {
    add('the barley field', layout.road.gaps.north[0], layout.road.z - 22);
    add('the wheat field', layout.road.gaps.south[0], layout.road.z + 22);
  }
  (layout.trackPoints ?? []).forEach(([x, z], i) => {
    if (i % 3 === 1) add('the track', x, z);
  });
  return spots;
}
