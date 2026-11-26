import { describe, it, expect } from 'vitest';
import { FIELD_CHUNK, fieldChunks, cellsByChunk, runsOf, chunkWorked } from '../src/world/fieldChunks.js';

// A grid 40 across and 20 down whose field is everything left of a line that leans, so the right-hand chunks are part field or none of it.
const COLS = 40;
const ROWS = 20;
const live = Uint8Array.from({ length: COLS * ROWS }, (_, i) => ((i % COLS) + Math.floor(i / COLS) < 45 ? 1 : 0));

describe('a job\'s field in chunks (#1072)', () => {
  const grid = fieldChunks(COLS, ROWS, live);

  it('cuts the grid into squares, the last of a row or column as wide as is left', () => {
    expect(FIELD_CHUNK).toBe(16);
    expect([grid.across, grid.down]).toEqual([3, 2]);
    expect(grid.chunks).toHaveLength(6);
    expect(grid.chunks[0]).toMatchObject({ k: 0, c0: 0, r0: 0, cols: 16, rows: 16 });
    expect(grid.chunks[2]).toMatchObject({ k: 2, c0: 32, r0: 0, cols: 8, rows: 16 });
    expect(grid.chunks[3]).toMatchObject({ k: 3, c0: 0, r0: 16, cols: 16, rows: 4 });
  });

  it('gives each chunk the field\'s own cells and no others, every one of them once', () => {
    const seen = new Set();
    for (const chunk of grid.chunks) {
      for (const cell of chunk?.cells ?? []) {
        expect(live[cell]).toBe(1);
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
        const c = cell % COLS;
        const r = Math.floor(cell / COLS);
        expect(c >= chunk.c0 && c < chunk.c0 + chunk.cols && r >= chunk.r0 && r < chunk.r0 + chunk.rows).toBe(true);
      }
    }
    expect(seen.size).toBe(live.reduce((n, v) => n + v, 0));
  });

  it('has no chunk where none of the square is the field', () => {
    expect(grid.chunks[5]).toBe(null); // columns 32 on, rows 16 on: all past the line
    expect(grid.chunks[2]).not.toBe(null);
  });

  it('says which chunk a cell is in and where in it, and neither for a cell that is not the field', () => {
    for (const chunk of grid.chunks) {
      chunk?.cells.forEach((cell, slot) => {
        expect(grid.chunkOf[cell]).toBe(chunk.k);
        expect(grid.slotOf[cell]).toBe(slot);
      });
    }
    const outside = 19 * COLS + 39;
    expect(live[outside]).toBe(0);
    expect(grid.chunkOf[outside]).toBe(-1);
    expect(grid.slotOf[outside]).toBe(-1);
  });

  it('sorts changed cells into their chunks, leaving out any that are not the field', () => {
    const by = cellsByChunk(grid, [0, 1, 16, 17 * COLS, 19 * COLS + 39, 99999]);
    expect([...by.keys()].sort()).toEqual([0, 1, 3]);
    expect(by.get(0)).toEqual([0, 1]);
    expect(by.get(1)).toEqual([16]);
    expect(by.get(3)).toEqual([17 * COLS]);
  });

  it('joins numbers that follow on into runs', () => {
    expect(runsOf([])).toEqual([]);
    expect(runsOf([5])).toEqual([[5, 1]]);
    expect(runsOf([7, 3, 4, 5, 9, 8, 4])).toEqual([[3, 3], [7, 3]]);
  });

  it('knows a chunk with something worked in it from one with nothing', () => {
    const state = new Uint8Array(COLS * ROWS);
    expect(chunkWorked(grid.chunks[1], state)).toBe(false);
    state[grid.chunks[1].cells[5]] = 2;
    expect(chunkWorked(grid.chunks[1], state)).toBe(true);
    expect(chunkWorked(grid.chunks[0], state)).toBe(false);
  });
});
