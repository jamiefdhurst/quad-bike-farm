import { describe, it, expect } from 'vitest';
import { girlsLeftOut } from '../src/npc/leftOut.js';

describe('girlsLeftOut', () => {
  it('is on only for the exact switch', () => {
    expect(girlsLeftOut('?vx=2')).toBe(true);
    expect(girlsLeftOut('?seed=4&vx=2&weather=rain')).toBe(true);
  });

  it('is off without it, or with any other value', () => {
    expect(girlsLeftOut('')).toBe(false);
    expect(girlsLeftOut(undefined)).toBe(false);
    expect(girlsLeftOut('?vx')).toBe(false);
    expect(girlsLeftOut('?vx=1')).toBe(false);
    expect(girlsLeftOut('?seed=2')).toBe(false);
  });
});
