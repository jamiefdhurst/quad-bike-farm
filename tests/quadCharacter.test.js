import { describe, it, expect } from 'vitest';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { idleTwoMinutes, neverStallsIdling } from './helpers/idleSweep.js';

describe('each quad has its own character', () => {
  it('idles in its own band, and no two quads share a roughness range', () => {
    const sorted = [...QUAD_SPECS].sort((a, b) => a.roughnessRange[0] - b.roughnessRange[0]);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].roughnessRange[0]).toBeGreaterThan(sorted[i - 1].roughnessRange[1]);
    for (const spec of QUAD_SPECS) expect(spec.idleRange[1] - spec.idleRange[0]).toBeLessThanOrEqual(300);
  });

  // The automatics' sweep, with hard stops, is in quadCharacterAuto.test.js.
  for (const spec of QUAD_SPECS.filter((q) => q.manual)) {
    it(`never stalls idling warm, new or worn right up to needing a service: the ${spec.name}`, () => neverStallsIdling(spec), 60000); // every idle, wear and seed: a few seconds a quad here, more on a CI runner
  }

  it('runs very erratically fully worn: stumbling, surging, and now and then dying, so it wants a service', () => {
    for (const spec of QUAD_SPECS) {
      const idle = (spec.idleRange[0] + spec.idleRange[1]) / 2;
      let stalls = 0;
      let lo = Infinity;
      let hi = 0;
      for (const seed of [1, 2, 3]) {
        const r = idleTwoMinutes(spec, idle, spec.roughnessRange[0], 1, seed, { restart: true });
        stalls += r.stalls;
        lo = Math.min(lo, r.lo);
        hi = Math.max(hi, r.hi);
      }
      // Six minutes in all: it dies now and then (about once every minute or two at most), and its idle is all over the place.
      expect(stalls, spec.name).toBeLessThan(9);
      expect(hi - lo, spec.name).toBeGreaterThan(idle * 0.9);
    }
  });

});
