// One hedge line laid out as numbers (#829): its leafy blocks, the bushes in it and the boxes that are solid, so a test can check the boxes cover
// the leaves. props.js turns these into instances and colliders. `h` is a line from `fields.hedges`: { x1, z1, dx, dz, length, gaps, height?, coarse?, alongX }.
import { HEDGE_SOLID_HALF, HEDGE_WOBBLE, blockWidth, bushHeight } from './hedgeSolid.js';
import { sidePoint, hedgeOffset } from './laneHedges.js';

const EDGE_BACK = 0.07; // m a gateway's edge block is set back from touching its gap (#1123)

/**
 * @param {object} o  { T, H, heightAt, random, blockReach (leafReach of the hedge model), bushReach (leaf radius per metre of bush height), bushes: whether bushes grow here }
 * @returns {{ blocks, bushes, colliders }}  blocks { s, across, x, z, y, width, spin, tall }; bushes { x, z, y, height, yaw };
 *   colliders { s0, s1, across (half thickness), x, z, y, hx, hy, hz, turn } (a box, `turn` its yaw; its middle is x, y, z).
 */
export function layHedge(h, { T, H, heightAt, random, blockReach, bushReach, bushes: withBushes = true }) {
  const flip = h.dx - h.dz < 0 ? -1 : 1;
  const side = { x: -h.dz * flip, z: h.dx * flip };
  const pointAt = (s, across = 0) => ({ x: h.x1 + h.dx * s + side.x * across, z: h.z1 + h.dz * s + side.z * across });
  const blocks = [];
  const bushes = [];
  // A block's leaves stay out of a gateway: no nearer to its middle than the block reaches along the hedge (a gate's leaf needs room too).
  const clearOf = (g, width) => g.half + Math.max(blockReach * width, g.gate ? 0.9 : 0);
  // The gap edges with box beyond them inside the laid stretch, each to get a block right at it (#1123): `${i}-` before gap i, `${i}+` after it.
  const open = new Set(h.gaps.flatMap((g, i) => [...(g.at - g.half > -1 ? [`${i}-`] : []), ...(g.at + g.half < h.length + 1 ? [`${i}+`] : [])]));
  for (let s = -1; s <= h.length + 1; s += h.coarse ? 2.2 + random() * 0.6 : 1.1 + random() * 0.5) {
    const across = (random() - 0.5) * HEDGE_WOBBLE;
    const width = blockWidth(T, random(), blockReach, across, h.coarse ? 1.5 : 1);
    const i = h.gaps.findIndex((g) => Math.abs(s - g.at) < clearOf(g, width));
    if (i >= 0) {
      // A step into a gateway's clearance puts its block at the gap's edge instead, first the near one, then the far, so the box either side
      // ends in leaves rather than a bare stretch of up to a step and a half (#1123). The next step goes on from there.
      const key = open.has(`${i}-`) ? `${i}-` : open.has(`${i}+`) ? `${i}+` : null;
      if (!key) continue;
      open.delete(key);
      const g = h.gaps[i];
      // 0.1 m back from touching the gap: farmPlacement.js draws a block's leaves as an octagon round its reach, that much wider at its corners.
      const at = g.at + (key.endsWith('-') ? -1 : 1) * (clearOf(g, width) + EDGE_BACK);
      if (h.gaps.some((o) => o !== g && Math.abs(at - o.at) < clearOf(o, width))) continue; // two gateways too close for a block between
      s = at;
    }
    const { x, z } = pointAt(s, across);
    blocks.push({ s, across, x, z, y: heightAt(x, z) - 0.2, width, spin: random() * Math.PI * 2, tall: 0.8 + random() * 0.45 });
    if (withBushes && !h.coarse && random() < 0.3) {
      const off = (random() - 0.5) * T * 0.8;
      const bs = s + (random() - 0.5);
      const height = bushHeight(random(), bushReach, off);
      // Not within its own reach of a gateway either.
      if (h.gaps.some((g) => Math.abs(bs - g.at) < g.half + bushReach * height + 0.3)) continue;
      const b = pointAt(bs, off);
      bushes.push({ x: b.x, z: b.z, y: heightAt(b.x, b.z) - 0.3, height, yaw: random() * Math.PI * 2, s: bs, across: off });
    }
  }

  // Colliders: boxes between the gaps, at most 20 m long and shorter where the ground climbs (the hill's), so they follow it to within about half
  // a metre. They are `HEDGE_SOLID_HALF` either side of the line. A hedge along x or z gets a box square to the axes; a slanted one a turned box.
  const hy = H / 2 + 0.5;
  const cuts = [-2, ...h.gaps.flatMap((g) => [g.at - g.half, g.at + g.half]).sort((a, b) => a - b), h.length + 2];
  const groundAt = (s) => {
    const p = pointAt(s);
    return heightAt(p.x, p.z);
  };
  const colliders = [];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = cuts[i];
    const b = cuts[i + 1];
    let lowest = Infinity;
    let highest = -Infinity;
    for (let s = a; s <= b; s += 2) {
      lowest = Math.min(lowest, groundAt(s));
      highest = Math.max(highest, groundAt(s));
    }
    const pieces = Math.max(1, Math.ceil((b - a) / 20), Math.ceil((highest - lowest) / 0.5));
    for (let k = 0; k < pieces; k++) {
      const pa = a + ((b - a) * k) / pieces;
      const pb = a + ((b - a) * (k + 1)) / pieces;
      const mid = pointAt((pa + pb) / 2);
      colliders.push({
        s0: pa, s1: pb, across: HEDGE_SOLID_HALF, x: mid.x, z: mid.z, y: heightAt(mid.x, mid.z) + H / 2 - 0.3, hx: h.alongX === false ? HEDGE_SOLID_HALF : (pb - pa) / 2, hy, hz: h.alongX === false ? (pb - pa) / 2 : HEDGE_SOLID_HALF,
        turn: h.alongX === null ? Math.atan2(-h.dz, h.dx) : 0,
      });
    }
  }
  return { blocks, bushes, colliders, pointAt };
}

const LANE_CHUNK = 6; // m a lane hedge's collider is at longest

/**
 * One run of a road's hedge laid out as numbers (Back Lane's and the A-road's, `laneHedgeRuns` in laneHedges.js): its leafy blocks and its solid boxes,
 * the draws from `random` in the order backLaneProps.js has always taken them, so the farm's list of placed things (farmPlacement.js, #1187) sees what is drawn.
 * @returns {{ blocks, colliders, at }}  blocks { s, across, x, z, y, width, spin, tall }; colliders { s0, s1 (m along), x, z, y, hx, hy, hz, turn } (a box, `turn` its yaw);
 *   `at(s, across)` the point on the run's line.
 */
export function layLaneHedge(road, run, { T, H, heightAt, random, blockReach }) {
  const at = (s, across = 0) => sidePoint(road, s, run.side, hedgeOffset(road, s, run.side) + across);
  const blocks = [];
  for (let s = run.from; s <= run.to; s += 1.1 + random() * 0.5) {
    const across = (random() - 0.5) * HEDGE_WOBBLE;
    const { x, z } = at(s, across);
    const width = blockWidth(T, random(), blockReach, across); // leaves stay within the solid part (hedgeSolid.js, #829)
    const tall = 0.8 + random() * 0.45;
    const spin = random() * Math.PI * 2;
    // A block's leaves stay inside the run, so none hangs into the gate, stile or ford at its end, past the collider (#1122). Its draws are taken all the same.
    if (s - blockReach * width < run.from || s + blockReach * width > run.to) continue;
    blocks.push({ s, across, x, z, y: heightAt(x, z) - 0.2, width, tall, spin });
  }
  // Colliders: straight boxes of at most LANE_CHUNK m along the curve, each as high as the ground under it climbs, overlapping the next by 0.2 m
  // either side so the hedge has no seam, but ending at the run's own ends, not 0.2 m into the gap beyond (#1187).
  const colliders = [];
  for (let s = run.from; s < run.to; s += LANE_CHUNK) {
    const e = Math.min(run.to, s + LANE_CHUNK);
    if (e - s < 0.5) continue;
    const s0 = Math.max(run.from, s - 0.2);
    const s1 = Math.min(run.to, e + 0.2);
    const a = at(s0);
    const b = at(s1);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const lo = Math.min(heightAt(a.x, a.z), heightAt(mid.x, mid.z), heightAt(b.x, b.z));
    const hi = Math.max(heightAt(a.x, a.z), heightAt(mid.x, mid.z), heightAt(b.x, b.z));
    colliders.push({ s0, s1, x: mid.x, z: mid.z, y: (lo + hi) / 2 + H / 2 - 0.3, hx: len / 2, hy: (hi - lo) / 2 + H / 2, hz: HEDGE_SOLID_HALF, turn: Math.atan2(-(b.z - a.z), b.x - a.x) });
  }
  return { blocks, colliders, at };
}
