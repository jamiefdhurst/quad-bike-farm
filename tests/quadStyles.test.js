import { describe, it, expect } from 'vitest';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';

// A spec naming a style the model builder doesn't know stops the game loading.
describe('quad specs', () => {
  it('only name body and dash styles that exist', () => {
    for (const spec of QUAD_SPECS) {
      expect(BODY_STYLES, spec.name).toContain(spec.style);
      expect(DASH_STYLES, spec.name).toContain(spec.dashStyle);
    }
  });
});
