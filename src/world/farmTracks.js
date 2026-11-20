// The farm's own ways round (#689), plan metres like layoutNew.js: the stone track north to the pit and south to the river, the grass track right round
// the inside of the boundary that closes the loop, and the grass headlands round every arable field. Pure: no Three.js. layoutNew.js turns these into
// roads of the network (roads.js), the gateways they need and `layout.headlands`; the ground painter, the wear and the girls' routes read those.

import { insetPolygon, edgeBetween } from './polygons.js';

/** The stone tracks' centrelines, plan metres: from the yard, through the gateways the plan has for them, to where each ends. */
export const STONE_TRACKS_PLAN = {
  halfWidth: 1.75, // about 3.5 m wide
  verge: 1.5,
  // North: out of the yard by its gateway at (546, 232), then along inside Top Field, 4 m off the hedge to Lane Field, to the pit's farm gate at (720, 150).
  north: [[546, 320], [546, 250], [546, 232], [550, 222], [580, 222], [618, 221], [668, 205], [714, 191], [716, 170], [717, 155], [720, 150], [724, 150]],
  // South: out of the yard by the gateway at (420, 440), down inside Hay Meadow past the sheep field's gate, through its gateway to Brook Meadow, over the
  // farm bridge at (424, 572) and on south to (424, 720). It keeps 4 m inside Brook Meadow, off the line it shares with Hill Pasture.
  south: [[456, 418], [436, 428], [421, 438], [420, 446], [419.5, 458], [421, 500], [424, 538], [424, 560], [424, 584], [424, 640], [424, 720]],
};

/** The farm bridge over the river's head (#565 put its place at (420, 572)), on the south track: the deck runs along the track, which crosses at plan x 424. */
export const FARM_BRIDGE_PLAN = { at: [424, 572], length: 7, width: 3.6, yaw: 0 };

/**
 * The grass boundary track (#689): the outline drawn in 14 m, all the way round. Two places it leaves that line, each a `detour`: the points of the way
 * between the inset's corners `after` and `before` (indexes into the inset), plan metres, which replace the corners between them.
 * - The Old Pit's field (north-east) is fenced and has only its two gates (#685), so the track goes round it outside the fence: down x 700 in Top Field,
 *   through a gateway in the hedge to Lane Field, and east at z 214 to rejoin the east side below the pit's south fence.
 * - Where the hill pasture's stream runs into the west side, 5 m south of Far Field, it is not waded there: the track goes east along the south of the
 *   hill pasture's top, crosses at the green lane's ford and comes back along Far Field's south side.
 */
export const BOUNDARY_TRACK_PLAN = {
  inset: 14,
  halfWidth: 1.5,
  verge: 1.2,
  detours: [
    { after: 6, before: 10, points: [[700, 38], [700, 150], [700, 190], [702, 201], [710, 214], [790, 214], [871, 214]] },
    { after: 21, before: 23, points: [[50, 600], [110, 592], [180, 592], [199.6, 584], [199.6, 520], [196, 502], [186, 500], [120, 500], [56, 500]] },
  ],
};

/** The width of the headland strip inside every arable field, metres: where the crop never grows. */
export const HEADLAND_WIDTH = 6;

/**
 * A run of points with a point every `step` m or less along each straight piece, so the smooth curve road.js draws through them keeps to the line
 * (a curve through two points 700 m apart bows out by metres at its ends). `closed` joins the last point to the first.
 */
export function densify(points, step = 30, closed = false) {
  const out = [];
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  if (!closed) out.push(points[points.length - 1]);
  return out;
}

/** The boundary track's points, plan metres, in order clockwise from the north-west; it is a closed loop (the last point joins the first). */
export function boundaryTrackPoints(outline, B = BOUNDARY_TRACK_PLAN) {
  const ring = insetPolygon(outline, B.inset);
  const out = [];
  ring.forEach((p, i) => {
    const d = B.detours.find((x) => i > x.after && i < x.before);
    if (d) return;
    out.push(p);
    const start = B.detours.find((x) => x.after === i);
    if (start) out.push(...start.points);
  });
  return densify(out, 30, true);
}

const crossAt = (p, q, a, b) => {
  const r = [q[0] - p[0], q[1] - p[1]];
  const s = [b[0] - a[0], b[1] - a[1]];
  const d = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(d) < 1e-9) return null;
  const t = ((a[0] - p[0]) * s[1] - (a[1] - p[1]) * s[0]) / d;
  const u = ((a[0] - p[0]) * r[1] - (a[1] - p[1]) * r[0]) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p[0] + r[0] * t, p[1] + r[1] * t] : null;
};

/**
 * The gateways a closed run of track points needs: one where it crosses each line between two fields (a line on the outline is never crossed), as
 * `{ a, b, at, why }` in the shape `GATEWAYS_PLAN` has. A place the line already has a gateway within `near` m is left to it.
 */
export function trackGateways(points, runs, existing = [], near = 3) {
  const out = [];
  const have = (r, x) => existing.some((g) => ((g.a === r.a && g.b === r.b) || (g.a === r.b && g.b === r.a)) && Math.hypot(g.at[0] - x[0], g.at[1] - x[1]) < near);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    for (const r of runs) {
      if (r.a === 'out' || r.b === 'out') continue;
      for (let k = 0; k + 1 < r.points.length; k++) {
        const x = crossAt(p, q, r.points[k], r.points[k + 1]);
        if (!x || have(r, x)) continue;
        out.push({ a: r.a, b: r.b, at: x, why: `the grass track round the boundary crosses ${r.a} and ${r.b} here (#689)` });
      }
    }
  }
  return out;
}

/** An arable field's headland as the ring that is its inner edge, plan metres: the field's points drawn in `HEADLAND_WIDTH` m. */
export const headlandRing = (points, width = HEADLAND_WIDTH) => insetPolygon(points, width);

/** Metres along a closed or open run of points, for the tests and for placing things on a track. */
export function runLength(points, closed = false) {
  let s = 0;
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += edgeBetween(a[0], a[1], b[0], b[1]).length;
  }
  return s;
}
