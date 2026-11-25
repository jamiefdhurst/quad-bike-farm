import { describe, it, expect, beforeAll } from 'vitest';
import { createRandom } from '../src/core/random.js';
import { planDamage, applyDamage } from '../src/vehicle/rustyDamage.js';
import { loadDonors, buildDonor, landsTheSame } from './helpers/rustyDamage.js';

// The rusty quad's damage lands the same wherever and however the vehicle stands (#597), for the blue, the green and the orange, and
// is put on without moving the vehicle: the rest of rustyDamageSteady.test.js (#1183).

describe('the look on each donor', () => {
  beforeAll(loadDonors);

  describe('lands the same wherever and however the vehicle stands (#597)', () => {
    for (const id of ['bruin', 'rb300', 'adder']) {
      it(`for the ${id}: turned, tilted on its springs, with the bars steered, or with parts left out for being small`, () => landsTheSame(id));
    }

    it('puts a vehicle back as it was stood, steered and tilted', () => {
      const plan = planDamage(createRandom(7), 'farm300');
      const model = buildDonor('farm300', plan);
      model.position.set(3, 0.2, 4);
      model.rotation.y = 1;
      const bars = model.getObjectByName('handlebars');
      bars.rotation.y = 0.2;
      const before = [model.quaternion.clone(), bars.quaternion.clone(), model.getObjectByName('bodyRoot').quaternion.clone()];
      applyDamage(model, plan, null);
      expect(model.position.toArray()).toEqual([3, 0.2, 4]);
      expect(model.quaternion.angleTo(before[0])).toBeLessThan(1e-6);
      expect(bars.quaternion.angleTo(before[1])).toBeLessThan(1e-6);
      expect(model.getObjectByName('bodyRoot').quaternion.angleTo(before[2])).toBeLessThan(1e-6);
    });
  });
});
