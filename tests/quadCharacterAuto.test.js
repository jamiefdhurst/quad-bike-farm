import { describe, it } from 'vitest';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { neverStallsIdling } from './helpers/idleSweep.js';

// The automatic quads' idle sweep, with a hard stop every 10 s until halfway to needing a service: split from quadCharacter.test.js, which
// has the manual quads' and the rest (#1183).

describe('each quad has its own character', () => {
  for (const spec of QUAD_SPECS.filter((q) => !q.manual)) {
    it(`never stalls idling warm, new or worn right up to needing a service, nor on hard stops until halfway there: the ${spec.name}`, () => neverStallsIdling(spec), 60000); // every idle, wear and seed: a few seconds a quad here, more on a CI runner
  }
});
