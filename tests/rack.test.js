import { describe, it, expect } from 'vitest';
import { canRideRack } from '../src/npc/rackSeat.js';

const ok = { hasRack: true, tipped: false, rackTaken: false, friendDriving: true };

describe('sitting on the front rack', () => {
  it('is allowed when her friend is driving and the back is taken', () => {
    expect(canRideRack(ok)).toBe(true);
  });
  it('needs a rack, an upright quad and a free spot', () => {
    expect(canRideRack({ ...ok, hasRack: false })).toBe(false);
    expect(canRideRack({ ...ok, tipped: true })).toBe(false);
    expect(canRideRack({ ...ok, rackTaken: true })).toBe(false);
  });
  it('needs her friend at the controls, and not off following you', () => {
    expect(canRideRack({ ...ok, friendDriving: false })).toBe(false);
    expect(canRideRack({ ...ok, friendBusy: true })).toBe(false);
  });
  it('is not needed while the back is free', () => {
    expect(canRideRack({ ...ok, pillionFree: true })).toBe(false);
  });
  it('can be asked for on a parked quad, whoever else could take the back', () => {
    const parked = { hasRack: true, tipped: false, rackTaken: false, friendDriving: false, pillionFree: true, parked: true };
    expect(canRideRack(parked)).toBe(true);
    expect(canRideRack({ ...parked, hasRack: false })).toBe(false);
    expect(canRideRack({ ...parked, tipped: true })).toBe(false);
    expect(canRideRack({ ...parked, rackTaken: true })).toBe(false);
    expect(canRideRack({ ...parked, parked: false })).toBe(false);
  });
});
