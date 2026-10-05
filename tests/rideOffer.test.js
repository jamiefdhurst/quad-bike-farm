import { describe, it, expect } from 'vitest';
import { RideOffer, pickOfferer } from '../src/npc/rideOffer.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

const P = DEFAULT_COMPANION_PARAMS;

function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

/** Seconds of waiting until the offer fires, or Infinity. */
function waitFor(offer, limit = 600) {
  for (let t = 0; t < limit; t += 0.5) if (offer.update(0.5, true)) return t;
  return Infinity;
}

describe('a girl offering you a ride', () => {
  it('comes after a few seconds to under half a minute of sitting there', () => {
    for (let i = 1; i <= 50; i++) {
      const t = waitFor(new RideOffer(P, seeded(i)));
      expect(t).toBeGreaterThanOrEqual(P.offerRideWaitMin - 0.5);
      expect(t).toBeLessThanOrEqual(P.offerRideWaitMax + 0.5);
    }
  });

  it('starts counting again if you get off in between', () => {
    const offer = new RideOffer({ ...P, offerRideWaitMin: 10, offerRideWaitMax: 10 }, seeded());
    for (let t = 0; t < 8; t += 0.5) offer.update(0.5, true);
    offer.update(0.5, false);
    expect(waitFor(offer)).toBeGreaterThanOrEqual(9.5);
  });

  it('leaves a long rest after a ride before anyone offers again', () => {
    for (let i = 1; i <= 50; i++) {
      const offer = new RideOffer(P, seeded(i));
      offer.rest();
      const t = waitFor(offer);
      expect(t).toBeGreaterThanOrEqual(P.offerRideRestMin - 0.5);
      expect(t).toBeLessThanOrEqual(P.offerRideRestMax + P.offerRideWaitMax + 0.5);
    }
  });

  it('rests for as long as the girl who gave the ride says', () => {
    const offer = new RideOffer(P, seeded());
    offer.rest({ offerRideRestMin: 5, offerRideRestMax: 5 });
    expect(waitFor(offer)).toBeLessThan(P.offerRideRestMin);
  });

  it('keeps resting even while you are not waiting, e.g. while she climbs off', () => {
    const offer = new RideOffer({ ...P, offerRideRestMin: 30, offerRideRestMax: 30, offerRideWaitMin: 1, offerRideWaitMax: 1 }, seeded());
    offer.rest();
    for (let t = 0; t < 10; t += 0.5) offer.update(0.5, false);
    expect(waitFor(offer)).toBeGreaterThanOrEqual(19);
  });

  it('picks the nearer girl more often, but not always, and nobody if nobody is free', () => {
    expect(pickOfferer([])).toBeNull();
    const near = { distance: 3 };
    const far = { distance: 30 };
    const random = seeded(3);
    const picks = Array.from({ length: 1000 }, () => pickOfferer([near, far], random));
    const nearCount = picks.filter((g) => g === near).length;
    expect(nearCount).toBeGreaterThan(600);
    expect(nearCount).toBeLessThan(950);
  });
});
