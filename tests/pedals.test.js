import { describe, expect, it } from 'vitest';
import { pedals } from '../src/vehicle/quad.js';

describe('pedals', () => {
  it('goes on W and brakes on S in a forward gear', () => {
    expect(pedals(true, false, false)).toEqual([1, 0]);
    expect(pedals(false, true, false)).toEqual([0, 1]);
  });
  it('goes on S and brakes on W in reverse gear', () => {
    expect(pedals(false, true, true)).toEqual([1, 0]);
    expect(pedals(true, false, true)).toEqual([0, 1]);
  });
  it('does nothing with neither key', () => {
    expect(pedals(false, false, true)).toEqual([0, 0]);
  });
});
