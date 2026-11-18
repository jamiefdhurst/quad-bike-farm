// The neighbour's land across the lane (layout.neighbourLand, #569): her fields, their hedges and her cows, drawn at far-ground detail. Pure: no Three.js.
// Her hedges are leafy blocks near and plain strips far (the farm's own, hedgeFar.js), with a collider along each stretch (so you can't ride through
// them) and gaps where a way through will be; the ground's tones and the dark line along each hedge are patchwork.js `landColor`.

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

/** Every hedge stretch of her land: { axis, at, from, to, x, z, hx, hz }, the box that is its collider (`width` m thick) as well as where it runs. */
export function hedgeStretches(land) {
  const hw = land.hedge.width / 2;
  return land.lines.flatMap((line) => stretchesOf(line).map(({ from, to }) => {
    const mid = (from + to) / 2;
    const half = (to - from) / 2;
    return line.axis === 'x'
      ? { axis: 'x', at: line.at, from, to, x: line.at, z: mid, hx: hw, hz: half }
      : { axis: 'z', at: line.at, from, to, x: mid, z: line.at, hx: half, hz: hw };
  }));
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
