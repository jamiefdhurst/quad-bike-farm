import { describe, it, expect } from 'vitest';
import { nextPick, stepHold } from '../src/workshop/toolboxPick.js';

describe('nextPick', () => {
  const shown = (hidden) => (i) => !hidden.includes(i);
  it('steps down and up, skipping what is not on the panel', () => {
    expect(nextPick(6, 1, 1, shown([2, 3]))).toBe(4);
    expect(nextPick(6, 4, -1, shown([2, 3]))).toBe(1);
  });
  it('wraps round the ends', () => {
    expect(nextPick(5, 4, 1, shown([]))).toBe(0);
    expect(nextPick(5, 0, -1, shown([]))).toBe(4);
  });
  it('stays put when nothing else shows', () => {
    expect(nextPick(3, 1, 1, shown([0, 2]))).toBe(1);
  });
});

describe('stepHold', () => {
  const fresh = { held: 0, spent: false };
  it('fires once when the hold fills, then waits for E to be let go', () => {
    let s = fresh;
    let fires = 0;
    for (let i = 0; i < 120; i++) {
      const r = stepHold(s, true, 1 / 60, 1);
      s = r.state;
      if (r.fired) fires++;
    }
    expect(fires).toBe(1);
    s = stepHold(s, false, 1 / 60, 1).state;
    expect(s).toEqual(fresh);
  });
  it('starts again when let go early', () => {
    let s = stepHold(fresh, true, 0.5, 1).state;
    expect(s.held).toBe(0.5);
    s = stepHold(s, false, 0.1, 1).state;
    expect(s.held).toBe(0);
  });
});
