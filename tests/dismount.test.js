import { describe, it, expect } from 'vitest';
import { clearOfChassis } from '../src/vehicle/dismount.js';
import { TOR_LAYOUT } from '../src/vehicle/cabModel.js';
import { QUAD_LAYOUT } from '../src/vehicle/quadPhysics.js';
import { TOR_SPEC } from '../src/vehicle/quadSpecs.js';

describe('stepping off', () => {
  it('moves the side, front and back spots clear of the Tor or Crag at its size', () => {
    const c = TOR_LAYOUT.chassis;
    const k = TOR_SPEC.scale ?? 1;
    const [x, z] = clearOfChassis([1.0, -0.15], c, k, 0.3);
    expect(x - 0.3).toBeGreaterThan(c.hx * k);
    expect(z).toBe(-0.15);
    expect(clearOfChassis([-1.0, -0.15], c, k, 0.3)[0] + 0.3).toBeLessThan(-c.hx * k);
    expect(-clearOfChassis([0, -1.7], c, k, 0.3)[1] - 0.3).toBeGreaterThan(c.hz * k);
    expect(clearOfChassis([0, 1.8], c, k, 0.3)[1] - 0.3).toBeGreaterThan(c.hz * k);
  });

  it("leaves a quad's spots where they were: they already clear its box", () => {
    for (const s of [[1.0, -0.15], [-1.0, -0.15], [0, -1.7], [0, 1.8]]) expect(clearOfChassis(s, QUAD_LAYOUT.chassis, 1, 0.3)).toEqual(s);
  });
});
