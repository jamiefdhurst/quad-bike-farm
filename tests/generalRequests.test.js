import { describe, it, expect } from 'vitest';
import { generalRequests, HERE_DISTANCE } from '../src/npc/generalRequests.js';
import { availabilityOf } from '../src/npc/availability.js';

const ask = (state, extra = {}) => generalRequests({ state, avail: availabilityOf({ state, jobs: {}, holds: [] }, { asked: true, pull: true }), youDistance: 10, ...extra });

describe('general requests', () => {
  it('offers all three to a girl on her way somewhere', () => {
    expect(ask('walking')).toEqual(['come', 'stop', 'wait']);
  });
  it('offers come and wait to one who is stood about, unless she is already here', () => {
    expect(ask('idle')).toEqual(['come', 'wait']);
    expect(ask('idle', { youDistance: HERE_DISTANCE - 1 })).toEqual(['wait']);
  });
  it('lets a driving girl be called in or told to wait', () => {
    expect(ask('driving')).toEqual(['come', 'wait']);
  });
  it('lets a seated girl be called off her vehicle, nothing else', () => {
    expect(ask('seated')).toEqual(['come']);
  });
  it('offers nothing while something has her', () => {
    expect(ask('thrown')).toEqual([]);
    const held = availabilityOf({ state: 'idle', jobs: { carrying: true }, holds: [] }, { asked: true, pull: true });
    expect(generalRequests({ state: 'idle', avail: held, youDistance: 10 })).toEqual([]);
  });
  it('lets a soft job give way', () => {
    const warming = availabilityOf({ state: 'idle', jobs: { warmingAt: {} }, holds: [] }, { asked: true, pull: true });
    expect(generalRequests({ state: 'idle', avail: warming, youDistance: 10 })).toEqual(['come', 'wait']);
  });
});
