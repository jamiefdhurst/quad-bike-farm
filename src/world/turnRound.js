// Being turned round at the edge of the map (#687). Every way off the map is a road that carries on into the far landscape, and you are never let on to
// it: cross a junction's give-way line onto the A-road, or the lane's southern line, and the picture fades to black, puts you (and your vehicle, and
// anyone aboard) about 25 m back up the road you came along, facing home, stopped, and fades back in. On foot or in any vehicle, the same. Pure: no
// Three.js, no DOM. The game does the moving and the fade (game.js `updateTurnRound`); the girls' lines are npc/turnRoundLines.js.

import { KEEP_LEFT } from './roads.js';

export const DEFAULT_TURN_ROUND_PARAMS = {
  fadeOut: 0.6, // s: to black
  hold: 0.25, // s: black while you are moved
  fadeIn: 0.6, // s: back from black
  back: 25, // m: how far back up the road you are put
  jump: 30, // m: a step this long in one frame is a teleport (the console's tp), not a crossing
};

export const TURN_ROUND_PARAM_RANGES = {
  fadeOut: [0.2, 2, 0.05],
  hold: [0, 1, 0.05],
  fadeIn: [0.2, 2, 0.05],
  back: [5, 60, 1],
  jump: [10, 200, 5],
};

/** The way along (dx, dz) as a heading, the angle the game's vehicles and girls face by (0 is south, +z). */
export const headingOf = (dx, dz) => Math.atan2(dx, dz);

/**
 * The lines from the layout's plan (`layout.turnRound`) laid on the road network: each `{ id, road, a, b, home, s, sign, point }`, `a` to `b` the segment
 * across the road at `s` m from its `end`, `sign` which way along the road leads home (+1 towards its far end, -1 back). A `wide` line runs right across
 * `ground` ({ minX, maxX, minZ, maxZ }) so there is no way round it over open ground.
 */
export function turnRoundLines(net, plan, ground = null) {
  const lines = [];
  for (const spec of plan.lines) {
    const r = net.road(spec.road);
    if (!r) continue;
    const sLine = spec.end === 'start' ? spec.s : r.length - spec.s;
    const p = net.pointAt(spec.road, sLine);
    const sign = spec.end === 'start' ? 1 : -1;
    const reach = spec.wide && ground ? Math.hypot(ground.maxX - ground.minX, ground.maxZ - ground.minZ) : r.halfWidth + (r.verge ?? 1) + 1;
    lines.push({
      id: spec.id, road: spec.road, s: sLine, sign, wide: !!spec.wide,
      a: { x: p.x - p.tz * reach, z: p.z + p.tx * reach },
      b: { x: p.x + p.tz * reach, z: p.z - p.tx * reach },
      point: { x: p.x, z: p.z },
    });
  }
  return lines;
}

const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** Whether a move from `from` to `to` crosses the line's segment. Starting on it, or moving along it, is not crossing. */
export function crossed(line, from, to) {
  const d1 = cross(line.a, line.b, from);
  const d2 = cross(line.a, line.b, to);
  if (d1 === 0 || d1 * d2 >= 0) return false;
  const e1 = cross(from, to, line.a);
  const e2 = cross(from, to, line.b);
  return e1 * e2 < 0;
}

/** Back along the way you were going: `back` m from `to` towards `from`, facing the way you came. */
function backAlong(from, to, back) {
  const dx = from.x - to.x;
  const dz = from.z - to.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: to.x + (dx / len) * back, z: to.z + (dz / len) * back, yaw: headingOf(dx, dz), along: false };
}

/**
 * Where you are put and which way you face (a heading) when `line` turns you round: `back` m up the road you came along, on its left side as you face
 * home, or, if you were nowhere near that road (across open ground), `back` m back along the way you were going, facing the way you came.
 */
export function putBack(net, line, from, to, back = DEFAULT_TURN_ROUND_PARAMS.back) {
  const r = net.road(line.road);
  const reach = r.halfWidth + (r.verge ?? 1) + 2;
  const near = Math.hypot(to.x - line.point.x, to.z - line.point.z) < reach || net.onRoad(line.road, from.x, from.z);
  return near ? putBackAlong(net, line, back) : backAlong(from, to, back);
}

/** `back` m up the line's road from it, on the left as you face home, facing home (away from the edge of the map). */
export function putBackAlong(net, line, back = DEFAULT_TURN_ROUND_PARAMS.back) {
  const r = net.road(line.road);
  const sAt = Math.min(r.length, Math.max(0, line.s + line.sign * back));
  const p = net.pointAt(line.road, sAt);
  const hx = p.tx * line.sign;
  const hz = p.tz * line.sign;
  const off = r.halfWidth * KEEP_LEFT;
  return { x: p.x + hz * off, z: p.z - hx * off, yaw: headingOf(hx, hz), along: true };
}

/**
 * The state of a turn round: idle until you cross a line (or are on the A-road at all, from a way no line covers), then `out` (the fade to black), `hold`
 * (black: you are moved, once) and `in`. `update(dt, pos)` takes where you are now (your vehicle's if you are on one) and returns { fade, move, line }:
 * `fade` 0..1 for the black screen, `move` the { x, z, yaw } to put you at only on the frame it happens, `line` the line that did it (`{ id: 'road' }` for
 * the A-road itself), `started` on the frame it begins and `done` on the frame it ends.
 */
export class TurnRound {
  constructor({ net, lines, params = DEFAULT_TURN_ROUND_PARAMS, aRoad = 'aRoad' }) {
    this.net = net;
    this.lines = lines;
    this.p = params;
    this.aRoad = aRoad;
    this.phase = 'idle';
    this.t = 0;
    this.last = null;
    this.pending = null;
    this.line = null;
  }

  get busy() {
    return this.phase !== 'idle';
  }

  /** Whether `pos` is on the A-road or its verge (the road nearest to you is the A-road, within its half width and verge): the verge is the A-road too (#1025). */
  onARoad(pos) {
    const a = this.net.road(this.aRoad);
    if (!a) return false;
    const n = this.net.nearest(pos.x, pos.z, a.halfWidth + (a.verge ?? 0));
    return n?.road.id === this.aRoad;
  }

  /** Forgets where you were, so the next step is not counted as a crossing (you were put somewhere on purpose: a teleport, a new game). */
  reset() {
    this.last = null;
  }

  /**
   * Where you are put when you are on the A-road by no line (across open ground, or from the bus stop): back up the nearest junction's road, on the farm
   * side, on its left and facing home. With no junction line, back along your way.
   */
  fromRoad(pos) {
    const near = this.lines.filter((l) => !l.wide).sort((a, b) => Math.hypot(a.point.x - pos.x, a.point.z - pos.z) - Math.hypot(b.point.x - pos.x, b.point.z - pos.z))[0];
    return near ? putBackAlong(this.net, near, this.p.back) : backAlong(this.last ?? pos, pos, this.p.back);
  }

  /** Starts a turn round now, as if `line` had been crossed from `from` to `to` (the debug panel's way in): false if one is already under way. */
  force(line, from, to) {
    if (this.phase !== 'idle') return false;
    this.line = line;
    this.pending = line.road ? putBackAlong(this.net, line, this.p.back) : backAlong(from, to, this.p.back); // the road's way, wherever you stand
    this.phase = 'out';
    this.t = 0;
    return true;
  }

  update(dt, pos) {
    const p = this.p;
    if (this.phase === 'idle') {
      const from = this.last;
      this.last = { x: pos.x, z: pos.z };
      if (!from || Math.hypot(pos.x - from.x, pos.z - from.z) > p.jump) return { fade: 0, move: null, line: null };
      let hit = this.lines.find((l) => crossed(l, from, pos)) ?? null;
      if (!hit && this.onARoad(pos)) hit = { id: 'road', road: null };
      if (!hit) return { fade: 0, move: null, line: null };
      this.line = hit;
      this.pending = hit.road ? putBack(this.net, hit, from, pos, p.back) : this.fromRoad(pos);
      this.phase = 'out';
      this.t = 0;
      return { fade: 0, move: null, line: hit, started: true };
    }
    this.t += dt;
    if (this.phase === 'out') {
      if (this.t < p.fadeOut) return { fade: this.t / p.fadeOut, move: null, line: this.line };
      this.phase = 'hold';
      this.t = 0;
      const move = this.pending;
      this.pending = null;
      this.last = null;
      return { fade: 1, move, line: this.line };
    }
    if (this.phase === 'hold') {
      if (this.t < p.hold) return { fade: 1, move: null, line: this.line };
      this.phase = 'in';
      this.t = 0;
      return { fade: 1, move: null, line: this.line };
    }
    if (this.t < p.fadeIn) return { fade: 1 - this.t / p.fadeIn, move: null, line: this.line };
    this.phase = 'idle';
    const line = this.line;
    this.line = null;
    return { fade: 0, move: null, line, done: true };
  }
}
