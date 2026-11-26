// A job's cells as the farm save keeps them (#1072): runs over the field's own cells, a letter for the value (a is 0, b is 1...) and then how
// many in a row when it is more than one, so "a30000c12a731" is 30,000 untouched cells, twelve at 2 and 731 untouched. The spraying and the
// harrowing kept a digit for every cell of their grid, 32,640 and 34,300 characters on the new farm's fields written every 30 s, nearly all of them
// 0. A run of n cells is never longer than n characters, so the string is never longer than the field has cells, and a day's work is a few dozen.
// Pure. Tested in tests/cellRuns.test.js.

const A = 97; // 'a'

/** The values (whole numbers, 0 to 25) of the field's own cells (`live` 1) as runs. `valueAt(i)` gives cell i's. */
export function packCells(live, valueAt) {
  let out = '';
  let value = -1;
  let count = 0;
  const flush = () => {
    if (count) out += String.fromCharCode(A + value) + (count > 1 ? count : '');
  };
  for (let i = 0; i < live.length; i++) {
    if (!live[i]) continue;
    const v = valueAt(i);
    if (v === value) count++;
    else {
      flush();
      value = v;
      count = 1;
    }
  }
  flush();
  return out;
}

/**
 * Reads a saved string back, calling `put(i, value)` for each cell of the grid it has a value for. Runs go to the field's own cells in order; a
 * string of digits is a save from before #1072, a digit for every cell of the grid, and is read as it always was, so that save keeps its lines.
 * Anything else in the string is passed over.
 */
export function unpackCells(text, live, put) {
  if (/^\d/.test(text)) {
    for (let i = 0; i < live.length && i < text.length; i++) put(i, Number(text[i]));
    return;
  }
  let i = 0;
  for (const [, letter, digits] of text.matchAll(/([a-z])(\d*)/g)) {
    const value = letter.charCodeAt(0) - A;
    for (let left = digits ? Number(digits) : 1; left > 0 && i < live.length; i++) {
      if (!live[i]) continue;
      put(i, value);
      left--;
    }
  }
}
