import { describe, it, expect } from 'vitest';
import { wantsBank, startBanks, BANK_NEAR } from '../src/audio/bankWant.js';

describe('which engine banks are fetched', () => {
  it('fetches for a vehicle that is on, however far away', () => {
    expect(wantsBank('running', 500)).toBe(true);
    expect(wantsBank('cranking', 500)).toBe(true);
  });
  it('fetches for a stopped vehicle only when you are near it', () => {
    expect(wantsBank('off', BANK_NEAR - 1)).toBe(true);
    expect(wantsBank('off', BANK_NEAR + 1)).toBe(false);
  });
  it('fetches when the distance is not known yet', () => {
    expect(wantsBank('off', undefined)).toBe(true);
  });
  it('loads at the start only the banks of vehicles near it, each once', () => {
    const units = [
      { audioBank: 'a', at: { x: 0, z: 10 } },
      { audioBank: 'a', at: { x: 5, z: 5 } },
      { audioBank: 'b', at: { x: 300, z: 0 } },
      { audioBank: undefined, at: { x: 0, z: 0 } },
    ];
    expect(startBanks(units, { x: 0, z: 0 })).toEqual(['a']);
  });
});
