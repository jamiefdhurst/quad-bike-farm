// A job's field in chunks (#1072). The spraying and the harrowing each draw their field as a skin over the ground, and on the new farm's fields
// (Lane Field's middle is 255 by 128 m, Low Ley 245 by 140 m) one skin for the lot was 65,000 to 274,000 triangles drawn whenever the field was in
// view, with megabytes sent to the graphics card each time a cell changed. So the grid is cut into square chunks: a view builds a chunk only once
// something in it is worked, and a repaint marks only the chunks its cells are in. Pure, no Three.js: the views (sprayView.js, harrowView.js) draw
// what this says. Tested in tests/fieldChunks.test.js.

export const FIELD_CHUNK = 16; // cells a side of one chunk (fixed: the views are built from it)

/**
 * Cuts a job's grid (`cols` by `rows`, `live` 1 where a cell is the field) into chunks of `size` cells a side. Returns:
 * - `chunks`: one for each square of the grid, row by row, or null where none of the square is the field. Each is { k, c0, r0, cols, rows, cells },
 *   with `cells` the field's own cells in it (indices into the grid), row by row;
 * - `chunkOf`: for each cell of the grid, which chunk it is in (-1 for a cell that is not the field);
 * - `slotOf`: and where it comes in that chunk's `cells`.
 */
export function fieldChunks(cols, rows, live, size = FIELD_CHUNK) {
  const across = Math.ceil(cols / size);
  const down = Math.ceil(rows / size);
  const chunkOf = new Int32Array(cols * rows).fill(-1);
  const slotOf = new Int32Array(cols * rows).fill(-1);
  const chunks = [];
  for (let j = 0; j < down; j++) {
    for (let i = 0; i < across; i++) {
      const k = j * across + i;
      const c0 = i * size;
      const r0 = j * size;
      const w = Math.min(size, cols - c0);
      const h = Math.min(size, rows - r0);
      const cells = [];
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          const cell = r * cols + c;
          if (!live[cell]) continue;
          chunkOf[cell] = k;
          slotOf[cell] = cells.length;
          cells.push(cell);
        }
      }
      chunks.push(cells.length ? { k, c0, r0, cols: w, rows: h, cells: Int32Array.from(cells) } : null);
    }
  }
  return { size, cols, rows, across, down, chunks, chunkOf, slotOf };
}

/** The cells in `cells` sorted into the chunks they are in: a Map of chunk index to its cells, in the order given. A cell that is not the field is left out. */
export function cellsByChunk(grid, cells) {
  const by = new Map();
  for (const cell of cells) {
    const k = grid.chunkOf[cell];
    if (k === undefined || k < 0) continue;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(cell);
  }
  return by;
}

/** Runs of numbers that follow on from each other in `slots` (any order, repeats allowed), as [first, how many] pairs in order. */
export function runsOf(slots) {
  const sorted = [...new Set(slots)].sort((a, b) => a - b);
  const runs = [];
  for (const s of sorted) {
    const last = runs[runs.length - 1];
    if (last && s === last[0] + last[1]) last[1]++;
    else runs.push([s, 1]);
  }
  return runs;
}

/** Whether any of a chunk's cells has a state other than `empty`: whether there is anything of it to draw. */
export function chunkWorked(chunk, state, empty = 0) {
  for (const cell of chunk.cells) if (state[cell] !== empty) return true;
  return false;
}
