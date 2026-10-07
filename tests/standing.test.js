import { describe, it, expect } from 'vitest';
import { standing, STILL_BELOW } from '../src/player/standing.js';

describe('standing', () => {
  it('holds you where you are when grounded, no key down and all but stopped, and does not press you into the ground', () => {
    expect(standing({ moving: false, speed: 0, grounded: true })).toEqual({ still: true, pressDown: 0 });
    expect(standing({ moving: false, speed: STILL_BELOW - 0.01, grounded: true })).toEqual({ still: true, pressDown: 0 });
  });

  it('lets you move: a key down, still going, in the air or stumbling', () => {
    expect(standing({ moving: true, speed: 0, grounded: true }).still).toBe(false);
    expect(standing({ moving: false, speed: 1, grounded: true }).still).toBe(false);
    expect(standing({ moving: false, speed: 0, grounded: false }).still).toBe(false);
    expect(standing({ moving: false, speed: 0, grounded: true, stumbling: true }).still).toBe(false);
  });

  it('keeps the usual downward push whenever you are not still', () => {
    expect(standing({ moving: true, speed: 2, grounded: true }).pressDown).toBe(-1);
  });
});
