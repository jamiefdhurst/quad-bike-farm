import { describe, it, expect } from 'vitest';
import { MindsHost } from '../src/npc/mindsHost.js';
import { GO_KINDS } from '../src/npc/tractorGo.js';

// What a girl weighs, through a stand-in game, since game.js is never built in a test: every feature it asks offers nothing unless the test says so.
// `offersFor` is asked every time a girl thinks, so anything that throws in it stops the girls choosing at all (#263, #764).
const nothing = new Proxy(() => [], { get: (_, k) => (k === Symbol.iterator ? [][Symbol.iterator].bind([]) : nothing), apply: () => [] });
const standIn = (given) => new Proxy(given, { get: (t, k) => (k in t ? t[k] : nothing) });
const girl = { character: { id: 'jess' }, boredOffers: () => [{ key: 'wander' }], seatOffers: () => [] };
const goOffer = { girl: 'jess', key: 'tractorGo' };

function setup(goVehicle) {
  const taken = [];
  const game = standIn({
    goVehicle,
    tractorGo: { offers: () => [goOffer], take: (o) => o },
    tractorGoContext: () => ({}),
    handleGoEvent: (e) => taken.push(e),
    hayLoading: null,
  });
  return { host: new MindsHost(game), taken };
}

describe('what a girl weighs', () => {
  it('comes back without throwing, with her own choices in it', () => {
    const { host } = setup(() => null);
    expect(host.offersFor(girl, null).map((o) => o.key)).toContain('wander');
  });

  it('has a go on the big vehicles only when one of them is there, and taking it starts the go', () => {
    expect(setup(() => null).host.offersFor(girl, null).map((o) => o.key)).not.toContain('tractorGo');
    for (const kind of GO_KINDS) {
      const { host, taken } = setup((k) => (k === kind ? {} : null));
      const offer = host.offersFor(girl, null).find((o) => o.key === 'tractorGo');
      expect(offer, kind).toBeTruthy();
      offer.take();
      expect(taken).toEqual([goOffer]);
    }
  });
});
