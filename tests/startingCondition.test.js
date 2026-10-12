import { describe, it, expect } from 'vitest';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { DEFAULT_ENGINE_PARAMS as D } from '../src/engine/engineParams.js';

const specs = [...QUAD_SPECS, ...EXTRA_SPECS];
const mid = ([a, b]) => (a + b) / 2;

describe('a quad is not dealt needing a service', () => {
  // Build roughness plus wear is what makes an engine erratic at idle (it stumbles and dies); the green and the three-wheeler were
  // dealt past the line, so they stalled within minutes of a fresh start.
  for (const id of ['green', 'atc']) {
    it(`the ${id} starts with an ordinary roughness and its worst wear below the erratic line`, () => {
      const s = specs.find((x) => x.id === id);
      const line = s.engine?.erraticFrom ?? D.erraticFrom;
      expect(mid(s.roughnessRange) + s.wearRange[1]).toBeLessThan(line);
    });
  }

  it('the green has enough choke to cover its cold need, or it dies on full choke before it warms a little', () => {
    const e = { ...D, ...specs.find((x) => x.id === 'green').engine };
    expect(e.chokeEnrichment).toBeGreaterThanOrEqual(e.coldEnrichmentNeed);
  });
});
