import { STANDING, BALED } from './haymaking.js';
import { outsideBy } from './jobFields.js';

// The hay patch as a picture for the ground shader (terrain.js) and the blades (hayView.js): one texel every half metre over the patch and a margin
// round it, red where the grass is cut, green where it is baled, alpha how far in the patch the point is (a soft ramp over the edge, which the
// shader breaks up with noise so the meadow fades into the field). Pure; tested in tests/hayMask.test.js.

export const MASK_TEXEL = 0.5; // metres a texel
export const MASK_MARGIN = 4; // metres of picture round the patch, for the ragged edge and the tufts that run out past it
export const EDGE_RAMP = 4; // metres the alpha takes to go from fully in to fully out, centred on the patch's edge

/** Where the picture sits: its corner, size in metres and in texels. */
export function maskLayout(rect) {
  const minX = rect.minX - MASK_MARGIN;
  const minZ = rect.minZ - MASK_MARGIN;
  const sizeX = rect.maxX - rect.minX + MASK_MARGIN * 2;
  const sizeZ = rect.maxZ - rect.minZ + MASK_MARGIN * 2;
  return { minX, minZ, sizeX, sizeZ, cols: Math.ceil(sizeX / MASK_TEXEL), rows: Math.ceil(sizeZ / MASK_TEXEL) };
}

/** 0..1 how far inside the patch (x, z) is: 1 well in, 0.5 on the edge, 0 well outside. The patch is a polygon on the new farm, a rectangle on today's. */
export function presence(rect, x, z) {
  return Math.min(1, Math.max(0, 0.5 - outsideBy(rect, x, z) / EDGE_RAMP));
}

/** Writes the whole picture (RGBA bytes, `cols * rows * 4`) from the patch's cells. Outside the patch the nearest cell's state carries on. */
export function fillMask(data, layout, hay) {
  const { rect } = hay;
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const x = layout.minX + (col + 0.5) * MASK_TEXEL;
      const z = layout.minZ + (row + 0.5) * MASK_TEXEL;
      const i = hay.nearestCell(x, z);
      const s = hay.state[i];
      const o = (row * layout.cols + col) * 4;
      data[o] = s === STANDING ? 0 : 255;
      data[o + 1] = s === BALED ? 255 : 0;
      data[o + 2] = 0;
      data[o + 3] = Math.round(presence(rect, x, z) * 255);
    }
  }
}
