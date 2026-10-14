import { describe, it, expect } from 'vitest';
import { cabinBox, cabinInside } from '../src/effects/cabinMud.js';

const box = { min: [-0.8, 0.2, -1.5], max: [0.8, 1.4, 0.7] };

describe('cabin mud', () => {
  it('keeps the inside faces of a cab clean and the outside faces muddy', () => {
    expect(cabinInside([0.78, 0.6, 0], [-1, 0, 0], box)).toBe(1); // a door's inner skin faces the middle
    expect(cabinInside([0.8, 0.6, 0], [1, 0, 0], box)).toBe(0); // the outer skin faces away
    expect(cabinInside([0, 1.3, 0], [0, -1, 0], box)).toBe(1); // the roof's underside
    expect(cabinInside([0, 1.33, 0], [0, 1, 0], box)).toBe(0); // the roof's top
  });

  it('leaves everything outside the box alone, whichever way it faces', () => {
    expect(cabinInside([0, 0.6, 1.2], [0, 0, -1], box)).toBe(0); // the bonnet
    expect(cabinInside([0, 0.1, 0], [0, -1, 0], box)).toBe(0); // under the sill
  });

  it('has a box nothing is inside when a model has no cab', () => {
    expect(cabinInside([0, 0, 0], [0, 1, 0], cabinBox(null))).toBe(0);
    expect(cabinBox(box)).toEqual(box);
  });
});
