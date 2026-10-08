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

/** The patchwork's colour at (x, z), 0..1 per channel, blended `blend` of the way from the near grass. */
export function patchColor(x, z, blend = 1) {
  const { id, border } = patchAt(x, z);
  const col = border < 3 ? [0.17, 0.25, 0.11] : PATCH_COLORS[Math.floor(id * PATCH_COLORS.length)];
  return [0, 1, 2].map((k) => NEAR_GRASS[k] + (col[k] - NEAR_GRASS[k]) * blend);
}
