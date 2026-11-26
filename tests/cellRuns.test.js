import { describe, it, expect } from 'vitest';
import { packCells, unpackCells } from '../src/world/cellRuns.js';

const read = (text, live) => {
  const out = new Array(live.length).fill(null);
  unpackCells(text, live, (i, v) => (out[i] = v));
  return out;
};

describe('a job\'s cells as the farm save keeps them (#1072)', () => {
  const live = Uint8Array.from([1, 1, 0, 1, 1, 1, 0, 0, 1, 1]);

  it('writes runs of the field\'s own cells, a letter for the value and how many when more than one', () => {
    const values = [0, 0, 9, 0, 2, 2, 9, 9, 2, 1];
    expect(packCells(live, (i) => values[i])).toBe('a3c3b'); // the cells that are not the field are passed over, so a run carries on across them
    expect(packCells(live, () => 0)).toBe('a7');
    expect(packCells(new Uint8Array(4), () => 1)).toBe('');
  });

  it('reads them back to the same cells', () => {
    const values = [0, 0, 9, 0, 2, 2, 9, 9, 2, 1];
    const back = read(packCells(live, (i) => values[i]), live);
    for (let i = 0; i < live.length; i++) expect(back[i], `cell ${i}`).toBe(live[i] ? values[i] : null);
  });

  it('is never longer than the field has cells, however the values fall', () => {
    const all = new Uint8Array(5000).fill(1);
    const worst = packCells(all, (i) => i % 2);
    expect(worst).toHaveLength(5000);
    for (const period of [2, 3, 7, 10, 11, 150, 999]) {
      const text = packCells(all, (i) => Math.floor(i / period) % 3);
      expect(text.length, `runs of ${period}`).toBeLessThanOrEqual(5000);
      expect(read(text, all)).toEqual(Array.from(all, (_, i) => Math.floor(i / period) % 3));
    }
  });

  it('still reads a save from before, a digit for every cell of the grid', () => {
    expect(read('0120000021', live)).toEqual([0, 1, 2, 0, 0, 0, 0, 0, 2, 1]);
    expect(read('012', live)).toEqual([0, 1, 2, null, null, null, null, null, null, null]);
  });

  it('stops at the end of the field and passes over what it cannot read', () => {
    expect(read('b99', live)).toEqual([1, 1, null, 1, 1, 1, null, null, 1, 1]);
    expect(read('', live)).toEqual(new Array(10).fill(null));
    expect(read('??b2!!c', live)).toEqual([1, 1, null, 2, null, null, null, null, null, null]);
  });
});
