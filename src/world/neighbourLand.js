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
 * Every hedge stretch of her land: { axis, at, from, to, x, z, hx, hz, gapBefore, gapAfter }, the box that is its collider (`width` m thick) as well as
 * where it runs; `gapBefore` and `gapAfter` say whether it ends at a gap there rather than at its line's end (a corner).
 */
export function hedgeStretches(land) {
  const hw = Math.max(land.hedge.width / 2, HEDGE_SOLID_HALF); // solid as far as its leaves reach (hedgeSolid.js, #829)
  return land.lines.flatMap((line) => stretchesOf(line).map(({ from, to }) => {
    const mid = (from + to) / 2;
    const half = (to - from) / 2;
    const ends = { gapBefore: from > line.from, gapAfter: to < line.to };
    return line.axis === 'x'
      ? { axis: 'x', at: line.at, from, to, x: line.at, z: mid, hx: hw, hz: half, ...ends }
      : { axis: 'z', at: line.at, from, to, x: mid, z: line.at, hx: half, hz: hw, ...ends };
  }));
}

const EDGE_BACK = 0.07; // m a block at a gap's edge is set back from touching it, as the farm's own (hedgeLay.js)

/**
 * Where a stretch's leafy blocks go, along it from its start (`t`): a block's leaves are kept out of a gap at either end, with a block set right at the
 * gap's edge so the box there ends in leaves (#1123), and run on to the line's end at a corner so it closes. `width(r, across)` is a block's width (blockWidth).
 * Draws from `random` in the order neighbourLandProps.js has always taken them: across and width for every step, its height and turn for a block kept.
 * @returns {{ t, across, width, tall, spin }[]}
 */
export function layLandStretch(s, { random, blockReach, width: widthOf }) {
  const length = s.to - s.from;
  const blocks = [];
  let startDone = !s.gapBefore;
  let endDone = !s.gapAfter;
  // Half a metre past a corner, so it closes; at a gap, on until a step has put its block at the edge.
  for (let t = s.gapBefore ? 0 : -0.5; t <= length + (s.gapAfter ? 2 : 0.5); t += 1.1 + random() * 0.5) {
    const across = (random() - 0.5) * HEDGE_WOBBLE;
    const width = widthOf(random(), across);
    const reach = blockReach * width;
    let at = t;
    if (s.gapBefore && t - reach < EDGE_BACK) {
      if (startDone) continue;
      startDone = true;
      at = reach + EDGE_BACK;
    }
    if (s.gapAfter && at + reach > length - EDGE_BACK) {
      if (endDone || length - reach - EDGE_BACK < 0) continue;
      endDone = true;
      at = length - reach - EDGE_BACK;
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
