// The neighbour's land across the lane (layout.neighbourLand, #569): her fields, their hedges and her cows, drawn at far-ground detail. Pure: no Three.js.
// Her hedges are leafy blocks near and plain strips far (the farm's own, hedgeFar.js), with a collider along each stretch (so you can't ride through
// them) and gaps where a way through will be; the ground's tones and the dark line along each hedge are patchwork.js `landColor`.

import { HEDGE_SOLID_HALF, HEDGE_WOBBLE } from './hedgeSolid.js';

/** The stretches of one line between its gaps: [{ from, to }] along its axis, in order, none shorter than a metre. */
export function stretchesOf(line) {
  const gaps = [...line.gaps].sort((a, b) => a[0] - b[0]);
  const out = [];
  let from = line.from;
  for (const [a, b] of gaps) {
    if (a - from >= 1) out.push({ from, to: a });
    from = Math.max(from, b);
  }
  if (line.to - from >= 1) out.push({ from, to: line.to });
  return out;
}

/**
 * Every hedge stretch of her land: { axis, at, from, to, x, z, hx, hz, hw, gapBefore, gapAfter, cornerBefore, cornerAfter }, the box that is its
 * collider (`hw` m either side of its line) as well as where it runs. At each end it stops at a gap, at a corner (its line's end inside another
 * stretch's box) or free (its line's end, with nothing beyond, as the lane's hedge at the village).
 */
export function hedgeStretches(land) {
  const hw = Math.max(land.hedge.width / 2, HEDGE_SOLID_HALF); // solid as far as its leaves reach (hedgeSolid.js, #829)
  const boxes = land.lines.flatMap((line) => stretchesOf(line).map(({ from, to }) => {
    const mid = (from + to) / 2;
    const half = (to - from) / 2;
    const ends = { gapBefore: from > line.from, gapAfter: to < line.to };
    return line.axis === 'x'
      ? { axis: 'x', at: line.at, from, to, x: line.at, z: mid, hx: hw, hz: half, hw, ...ends }
      : { axis: 'z', at: line.at, from, to, x: mid, z: line.at, hx: half, hz: hw, hw, ...ends };
  }));
  // How far another stretch's box goes on past this one's end at `t` (`dir` -1 at its start, 1 at its end): 0 where none holds the end.
  const beyond = (b, t, dir) => {
    const [x, z] = b.axis === 'x' ? [b.at, t] : [t, b.at];
    let most = 0;
    for (const o of boxes) {
      if (o.axis === b.axis || Math.abs(x - o.x) > o.hx + 1e-6 || Math.abs(z - o.z) > o.hz + 1e-6) continue;
      const [c, h] = b.axis === 'x' ? [o.z, o.hz] : [o.x, o.hx]; // the other box along this stretch's own direction
      most = Math.max(most, dir * (c + dir * h - t));
    }
    return most;
  };
  return boxes.map((b) => {
    const pastBefore = b.gapBefore ? 0 : beyond(b, b.from, -1);
    const pastAfter = b.gapAfter ? 0 : beyond(b, b.to, 1);
    return { ...b, cornerBefore: pastBefore > 0, cornerAfter: pastAfter > 0, pastBefore, pastAfter };
  });
}

const EDGE_BACK = 0.07; // m a block at a gap's edge is set back from touching it, as the farm's own (hedgeLay.js)

/**
 * Where a stretch's leafy blocks go, along it from its start (`t`): a block's leaves are kept out of a gap at either end, with a block set right at the
 * gap's edge so the box there ends in leaves (#1123), run on past the line's end at a corner so it closes (no further than the other box reaches),
 * and to the box's own end at a free end. `width(r, across)` is a block's width (blockWidth).
 * Draws from `random` in the order neighbourLandProps.js has always taken them: across and width for every step, its height and turn for a block kept.
 * @returns {{ t, across, width, tall, spin }[]}
 */
export function layLandStretch(s, { random, blockReach, width: widthOf }) {
  const length = s.to - s.from;
  const blocks = [];
  // How far the leaves may run at each end: to just short of a gap's edge, on into the other stretch's box at a corner (`pastBefore`, `pastAfter`),
  // and to the box's own end at a free one. The first step past a limit puts its block right at it, so every end finishes in leaves.
  const lo = s.gapBefore ? EDGE_BACK : -(s.pastBefore ?? 0);
  const hi = s.gapAfter ? length - EDGE_BACK : length + (s.pastAfter ?? 0);
  let startDone = false;
  let endDone = false;
  for (let t = 0; !endDone && t <= length + 3; t += 1.1 + random() * 0.5) {
    const across = (random() - 0.5) * HEDGE_WOBBLE;
    const width = widthOf(random(), across);
    const reach = blockReach * width;
    if (hi - lo < 2 * reach) continue; // too short a stretch for a block
    let at = t;
    if (at - reach < lo) {
      if (startDone) continue;
      startDone = true;
      at = lo + reach;
    }
    if (at + reach > hi) {
      endDone = true;
      at = hi - reach;
    }
    blocks.push({ t: at, across, width, tall: 0.8 + random() * 0.45, spin: random() * Math.PI * 2 });
    t = Math.max(t, at);
  }
  return blocks;
}

/** Which of her fields (x, z) is in, by name, or null. */
export function landFieldAt(land, x, z) {
  return land.fields.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)?.name ?? null;
}

/** Whether a line has a gap at `along` (a gateway or a way through), for the routes and the tests. */
export function gapAt(line, along) {
  return line.gaps.some(([a, b]) => along > a && along < b);
}

/** Her land's shape from a layout, or null on a farm without it. */
export function neighbourLandShape(layout) {
  const land = layout.neighbourLand;
  return land ? { ...land, stretches: hedgeStretches(land) } : null;
}
