// Where a 16.5 m articulated lorry goes on the farm (#816): up the drive, round the yard and back to the sheep pens' loading ramp and the grain store. Pure: a lorry
// driven along a path in the plan's metres (x east, z south), the space it sweeps, and whether that space meets anything. The livestock wagon, the grain lorry, the
// feed lorry and the fuel tanker (#707, #699, #122) are all this size, so the farmstead is laid out for it and `tests/lorryPath.test.js` holds it to that.
//
// A lorry backing up is the same journey as one going forward played backwards (the tractor and trailer meet at a pin, so every position they take going
// forward is one they can take going back), so a reversing leg is swept as the forward drive away from where it ends up: that is the stable way to work one out.

/**
 * The lorry, in metres. The tractor unit's rear axle carries the trailer's pin, so it is the point the path is written for. `ahead` and `behind` are
 * from the rear axle (the cab's nose is `wheelbase` and a metre of overhang ahead of it); the trailer's are from the pin. Together 16.5 m, the longest a lorry
 * on the road may be (articulated, 16.5 m, with a plain trailer).
 */
export const LORRY = {
  width: 2.55,
  wheelbase: 3.5,
  tractor: { ahead: 4.5, behind: 0.9, width: 2.5 },
  trailer: { ahead: 1.6, behind: 12.0, axle: 10.2 }, // the axle at the back of the trailer is `axle` m behind the pin
};
export const LORRY_LENGTH = LORRY.tractor.ahead + LORRY.trailer.behind;

/** The steering lock the tractor has, which sets its tightest turn: the rear axle's path cannot curve tighter than this radius. */
export const MIN_RADIUS = LORRY.wheelbase / Math.tan((38 * Math.PI) / 180);

/**
 * The poses of a lorry driven forward along `segments` from `start` ({ x, z, heading }: the rear axle, heading in radians from +x towards +z, so west is PI and
 * north is -PI/2), a pose every `step` metres: { x, z, heading, trailer } where `trailer` is the trailer's heading. A segment is `{ line: metres }` or
 * `{ arc: { r, turn } }`: a circle of radius `r` turned through `turn` radians, positive to the right (towards +z from east). The trailer starts in line.
 */
export function drive(start, segments, step = 0.25) {
  const poses = [];
  let { x, z, heading } = start;
  let trailer = start.trailer ?? heading;
  const push = () => poses.push({ x, z, heading, trailer });
  push();
  for (const seg of segments) {
    const length = seg.line ?? Math.abs(seg.arc.turn) * seg.arc.r;
    const curve = seg.line === undefined ? Math.sign(seg.arc.turn) / seg.arc.r : 0;
    if (seg.arc && seg.arc.r < MIN_RADIUS - 1e-9) throw new Error(`a turn of ${seg.arc.r} m is tighter than the lorry's lock allows (${MIN_RADIUS.toFixed(1)} m)`);
    const n = Math.max(1, Math.ceil(length / step));
    const ds = length / n;
    for (let i = 0; i < n; i++) {
      // The pin is on the rear axle, so the trailer swings towards the tractor's heading as it is pulled: d(trailer) = sin(heading - trailer) ds / axle.
      const mid = heading + (curve * ds) / 2;
      x += Math.cos(mid) * ds;
      z += Math.sin(mid) * ds;
      heading += curve * ds;
      trailer += (Math.sin(heading - trailer) * ds) / LORRY.trailer.axle;
      push();
    }
  }
  return poses;
}

/** A pose's two bodies as polygons ([[x, z], ...]): the tractor unit and the trailer. */
export function bodies(pose) {
  const box = (x, z, heading, ahead, behind, width) => {
    const fx = Math.cos(heading);
    const fz = Math.sin(heading);
    const sx = -fz;
    const sz = fx;
    const w = width / 2;
    return [[ahead, w], [ahead, -w], [-behind, -w], [-behind, w]].map(([a, s]) => [x + fx * a + sx * s, z + fz * a + sz * s]);
  };
  return [
    box(pose.x, pose.z, pose.heading, LORRY.tractor.ahead, LORRY.tractor.behind, LORRY.tractor.width),
    box(pose.x, pose.z, pose.trailer, LORRY.trailer.ahead, LORRY.trailer.behind, LORRY.width),
  ];
}

/** Whether a convex polygon and an axis-aligned rectangle `[minX, minZ, maxX, maxZ]` overlap (the separating axis test), with `margin` m of room asked for round the rectangle. */
export function polygonHitsRect(polygon, rect, margin = 0) {
  const [x0, z0, x1, z1] = [rect[0] - margin, rect[1] - margin, rect[2] + margin, rect[3] + margin];
  if (Math.max(...polygon.map((p) => p[0])) <= x0 || Math.min(...polygon.map((p) => p[0])) >= x1) return false;
  if (Math.max(...polygon.map((p) => p[1])) <= z0 || Math.min(...polygon.map((p) => p[1])) >= z1) return false;
  const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const nx = -(b[1] - a[1]);
    const nz = b[0] - a[0];
    const side = (p) => nx * (p[0] - a[0]) + nz * (p[1] - a[1]);
    const mine = polygon.map(side);
    const theirs = corners.map(side);
    if (Math.max(...mine) <= Math.min(...theirs) || Math.min(...mine) >= Math.max(...theirs)) return false;
  }
  return true;
}

/** The names of the footprints (`{ name, rect: [minX, minZ, maxX, maxZ] }`) that any pose of `poses` meets, each once. */
export function sweepHits(poses, footprints, margin = 0) {
  const hit = new Set();
  for (const pose of poses) {
    const parts = bodies(pose);
    for (const f of footprints) if (!hit.has(f.name) && parts.some((p) => polygonHitsRect(p, f.rect, margin))) hit.add(f.name);
  }
  return [...hit];
}

/** Whether a circle (`{ at: [x, z], diameter }`) and an axis-aligned rectangle overlap. */
export function circleHitsRect(circle, rect) {
  const r = circle.diameter / 2;
  const x = Math.max(rect[0], Math.min(circle.at[0], rect[2]));
  const z = Math.max(rect[1], Math.min(circle.at[1], rect[3]));
  return Math.hypot(x - circle.at[0], z - circle.at[1]) < r;
}

const WEST = Math.PI;
const EAST = 0;
const NORTH = -Math.PI / 2;
const QUARTER = Math.PI / 2;
const right = (r, turn) => ({ arc: { r, turn } });
const left = (r, turn) => right(r, -turn);

/** The rear axle's circle that sweeps a 25 m-ish circle at its outer front corner: with the nose `tractor.ahead` ahead of the axle and half the cab's width out, the radius of the path. */
export function lockedRadius(diameter) {
  const outer = diameter / 2;
  return Math.sqrt(outer * outer - LORRY.tractor.ahead * LORRY.tractor.ahead) - LORRY.tractor.width / 2;
}

/** Two arcs of radius `r` that move a lorry sideways by `d` m (positive to the right, to the south when it heads east) without changing its heading: an S. */
function shift(r, d) {
  const turn = Math.acos(1 - Math.abs(d) / (2 * r));
  const [first, second] = d > 0 ? [right, left] : [left, right];
  return [first(r, turn), second(r, turn)];
}

/**
 * The lorry's journeys on the farmstead (plan metres), each a forward drive (a reversing leg is swept as the drive away from where it ends up, see the top of the
 * file). `plan` is `LORRY_PLAN` (layoutNew.js); `driveZ` the drive's line. In the order the lorry meets them:
 *   `turnIn`    from the south in the lane's west carriageway, left onto the drive
 *   `along`     west along the drive and across the yard to the turning circle
 *   `uTurn`     heading west on the drive's line, left round the circle to heading east
 *   `settle`    out of the turn, an S north to the line the sheep bay's drive meets and straight on, so the trailer lines up
 *   `sheepBay`  the reversing in to the sheep pens' ramp, as the drive out of it: north, right to east, then on east to where `settle` ends
 *   `grainBay`  the same for the grain store: west, an S round to the drive's line and on west to where the lorry stood to back in
 *   `grainOn`   from there west along the drive's line to the circle
 *   `leave`     from `settle`'s end, an S back up to the drive's line and east along it to the lane
 * Each of the bays' drives ends where another leg starts, which the tests check (`ends`).
 */
export function lorryJourneys(plan, driveZ) {
  const r = lockedRadius(plan.circle.diameter);
  const [cx] = plan.circle.at;
  const turnR = plan.turnIn;
  const bendR = plan.bend;
  const turnIn = drive({ x: plan.lane, z: driveZ + turnR + 40, heading: NORTH }, [{ line: 40 }, left(turnR, QUARTER)]);
  const mouthX = plan.lane - turnR;
  const along = drive({ x: mouthX, z: driveZ, heading: WEST }, [{ line: mouthX - cx }]);
  const uTurn = drive({ x: cx, z: driveZ, heading: WEST }, [left(r, Math.PI)]);
  const uEnd = { x: cx, z: driveZ + 2 * r, heading: EAST };
  // The sheep bay: the tail at the ramp's foot, the lorry facing north, its pin 12 m up the line; out of it right at the bend radius, then east.
  const meetZ = plan.sheep.tail[1] - LORRY.trailer.behind - bendR; // the line the lorry is on once it has turned east
  const settle = drive(uEnd, [...shift(plan.settle, meetZ - uEnd.z), { line: plan.straighten }]);
  const settled = settle.at(-1);
  const sheepBay = drive({ x: plan.sheep.tail[0], z: plan.sheep.tail[1] - LORRY.trailer.behind, heading: NORTH }, [right(bendR, QUARTER), { line: settled.x - (plan.sheep.tail[0] + bendR) }]);
  // The grain bay: the tail at the store's door, the lorry facing west; out of it right then left, an S that brings it onto the drive's line heading west.
  const grainBay = drive({ x: plan.grain.tail[0] - LORRY.trailer.behind, z: plan.grain.tail[1], heading: WEST }, [...shift(bendR, plan.grain.tail[1] - driveZ), { line: plan.grain.run }]);
  const stood = grainBay.at(-1);
  const grainOn = drive(stood, [{ line: stood.x - cx }]);
  const leave = drive(settled, [...shift(plan.leaveR, driveZ - meetZ), { line: plan.leaveRun }]);
  return { turnIn, along, uTurn, settle, sheepBay, grainBay, grainOn, leave, ends: { uEnd, settled, stood, mouthX, circleRadius: r } };
}
