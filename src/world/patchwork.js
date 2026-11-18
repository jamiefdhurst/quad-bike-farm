// The patchwork of neighbouring farmland round the farm, with dark lines where the hedgerows between the fields would be. Pure; the outer
// terrain ring takes its colours from it as vertex colours and the ground texture paints it beyond the farm's hedges.

export const PATCH_COLORS = [
  [0.36, 0.48, 0.22],
  [0.42, 0.54, 0.26],
  [0.33, 0.44, 0.2],
  [0.52, 0.54, 0.28],
  [0.42, 0.35, 0.26],
  [0.6, 0.56, 0.36],
  [0.39, 0.5, 0.24],
];

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function patchAt(x, z) {
  const cell = 85;
  const wx = x + 14 * Math.sin(z * 0.017);
  const wz = z + 14 * Math.sin(x * 0.019);
  const cx = Math.floor(wx / cell);
  const cz = Math.floor(wz / cell);
  const fx = wx / cell - cx;
  const fz = wz / cell - cz;
  const border = Math.min(fx, 1 - fx, fz, 1 - fz) * cell;
  return { id: hash2(cx, cz), border };
}

/** The grass colour the patchwork fades from next to the farm, as the ground texture's grass reads from a distance. */
export const NEAR_GRASS = [0.37, 0.49, 0.23];

/** 0..1 how far the patchwork has taken over from the farm's grass, by metres outside the farm's hedges. */
export const patchBlend = (out) => Math.min(1, Math.max(0, (out - 6) / 40));

const HEDGE_LINE = [0.17, 0.25, 0.11];

/**
 * What a piece of land of its own (layout.neighbourLand, #569) makes of (x, z): its field's grass tone, and a dark line (half `edge` m either
 * side) along each hedge between its fields. Null when (x, z) is not on it, and the generic patchwork shows.
 */
export function landColor(land, x, z, edge = 1.4) {
  const f = land.fields.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  if (!f) return null;
  for (const l of land.lines) {
    const [across, along] = l.axis === 'x' ? [x, z] : [z, x];
    if (Math.abs(across - l.at) < edge && along >= l.from && along <= l.to && !l.gaps.some(([a, b]) => along > a && along < b)) return HEDGE_LINE;
  }
  return f.tone;
}

/** The patchwork's colour at (x, z), 0..1 per channel, blended `blend` of the way from the near grass. `land` is a piece of land with its own fields (landColor). */
export function patchColor(x, z, blend = 1, land = null) {
  const own = land && landColor(land, x, z);
  let col = own;
  if (!col) {
    const { id, border } = patchAt(x, z);
    col = border < 3 ? HEDGE_LINE : PATCH_COLORS[Math.floor(id * PATCH_COLORS.length)];
  }
  return [0, 1, 2].map((k) => NEAR_GRASS[k] + (col[k] - NEAR_GRASS[k]) * blend);
}
