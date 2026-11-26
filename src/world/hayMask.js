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

/** A texel's colour from its cell's state: red where the grass is cut, green where it is baled. The alpha (the edge fade) is not touched. */
function paintTexel(data, o, s) {
  data[o] = s === STANDING ? 0 : 255;
  data[o + 1] = s === BALED ? 255 : 0;
  data[o + 2] = 0;
}

/**
 * Writes the whole picture (RGBA bytes, `cols * rows * 4`) from the patch's cells. Outside the patch the nearest cell's state carries on. The edge
 * fade is a distance to the field's edges for every texel, 10 ms of the 10.5 this takes on the new farm's meadow (107,000 texels), and it never
 * changes: so this runs once, when the view is built, and `fillState` and `paintCells` redraw the colours after it (#1071).
 */
export function fillMask(data, layout, hay) {
  const { rect } = hay;
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const x = layout.minX + (col + 0.5) * MASK_TEXEL;
      const z = layout.minZ + (row + 0.5) * MASK_TEXEL;
      const o = (row * layout.cols + col) * 4;
      paintTexel(data, o, hay.state[hay.nearestCell(x, z)]);
      data[o + 3] = Math.round(presence(rect, x, z) * 255);
    }
  }
}

/** Redraws every texel's colour from the cells and leaves the edge fade as `fillMask` wrote it: for a load or the panel, when any cell may have changed. */
export function fillState(data, layout, hay) {
  for (let row = 0; row < layout.rows; row++) {
    const z = layout.minZ + (row + 0.5) * MASK_TEXEL;
    for (let col = 0; col < layout.cols; col++) {
      paintTexel(data, (row * layout.cols + col) * 4, hay.state[hay.nearestCell(layout.minX + (col + 0.5) * MASK_TEXEL, z)]);
    }
  }
}

/** The first and last texel along one side that could read cell `c` of `count`: a texel either way to spare, and out to the picture's end for an edge cell. */
function texelSpan(c, count, cell, from, texels) {
  const lo = c === 0 ? 0 : Math.max(0, Math.floor((c * cell + from) / MASK_TEXEL) - 1);
  const hi = c === count - 1 ? texels - 1 : Math.min(texels - 1, Math.ceil(((c + 1) * cell + from) / MASK_TEXEL));
  return [lo, hi];
}

/**
 * Redraws the colour of only the texels that read the cells in `cells` (indices into `hay.state`): 16 for a cell in the middle of the patch, and
 * the margin beyond it too for one on the edge. Each texel is asked which cell it reads, as `fillMask` asks, so the two never disagree at a cell's
 * edge. Returns how many texels it wrote.
 */
export function paintCells(data, layout, hay, cells) {
  const { rect } = hay;
  let wrote = 0;
  for (const i of cells) {
    const [c0, c1] = texelSpan(i % hay.cols, hay.cols, hay.cell, rect.minX - layout.minX, layout.cols);
    const [r0, r1] = texelSpan(Math.floor(i / hay.cols), hay.rows, hay.cell, rect.minZ - layout.minZ, layout.rows);
    for (let row = r0; row <= r1; row++) {
      const z = layout.minZ + (row + 0.5) * MASK_TEXEL;
      for (let col = c0; col <= c1; col++) {
        if (hay.nearestCell(layout.minX + (col + 0.5) * MASK_TEXEL, z) !== i) continue;
        paintTexel(data, (row * layout.cols + col) * 4, hay.state[i]);
        wrote += 1;
      }
    }
  }
  return wrote;
}
