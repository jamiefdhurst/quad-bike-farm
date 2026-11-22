import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';

describe("The girls' cars' parking", () => {
  const { cars, road, dutchBarn } = LAYOUT;


  it('has no hard-standing by the main barn any more', () => {
    expect(LAYOUT.carStanding).toBeUndefined();
  });
});
