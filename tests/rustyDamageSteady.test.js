import { describe, it, expect, beforeAll } from 'vitest';
import { loadDonors, landsTheSame, plainSignature, signature, dressed } from './helpers/rustyDamage.js';

// The rusty quad's damage lands the same wherever and however the vehicle stands (#597), for the red and the blue: split from
// rustyDamage.test.js with rustyDamageSteadyMore.test.js, which has the other three, so the two run side by side (#1183).

describe('the look on each donor', () => {
  beforeAll(loadDonors);

  describe('lands the same wherever and however the vehicle stands (#597)', () => {
    for (const id of ['farm300', 'bruin']) {
      it(`for the ${id}: turned, tilted on its springs, with the bars steered, or with parts left out for being small`, () => landsTheSame(id));
    }

    it('counts a small part FarDetail has hidden for being far off as still there, and leaves out one the game hid', { timeout: 30000 }, () => {
      const plain = plainSignature('farm300');
      expect(signature(dressed('farm300', (m) => m.traverse((o) => { if (o.isMesh && o.name === 'seat') { o.visible = false; o.userData.farHidden = true; } })))).toBe(plain);
      expect(signature(dressed('farm300', (m) => m.traverse((o) => { if (o.isMesh && o.name === 'seat') o.visible = false; })))).not.toBe(plain);
    });
  });
});
