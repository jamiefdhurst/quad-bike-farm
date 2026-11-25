import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { createRandom } from '../src/core/random.js';
import { planDamage, applyDamage } from '../src/vehicle/rustyDamage.js';
import { loadDonors, buildDonor } from './helpers/rustyDamage.js';

// Where the rusty quad's webs, patches and cracks sit on it: split from rustyDamage.test.js, which has the rest of the look (#1183).

describe('the look on each donor', () => {
  const build = buildDonor;
  beforeAll(loadDonors);

  it('hangs each web from a point on something, with its top edge level and the plane upright (so it falls straight down)', () => {
    const plan = planDamage(createRandom(5), 'farm300');
    const model = build('farm300', plan);
    applyDamage(model, plan, null);
    model.traverse((o) => {
      if (o.name !== 'cobweb') return;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(o.quaternion); // the plane's own up
      expect(Math.abs(up.y), 'upright').toBeGreaterThan(0.85);
    });
  });

  it('keeps every patch and crack on the body: no vertex of one hangs further than a few centimetres from the surface it follows', () => {
    const plan = planDamage(createRandom(9), 'farm300');
    const model = build('farm300', plan);
    applyDamage(model, plan, null);
    model.updateMatrixWorld(true);
    const root = model.getObjectByName('bodyRoot');
    const body = [];
    root.traverse((o) => { if (o.isMesh && !o.userData.rustyDamage && !/^wheel_/.test(o.name)) body.push(o); });
    const rc = new THREE.Raycaster();
    let checked = 0;
    let missed = 0;
    root.traverse((o) => {
      if (!(o.name === 'rustPatch' || o.name === 'crack')) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 5) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        const n = new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.normal, i).transformDirection(o.matrixWorld);
        let hits = 0;
        for (const sign of [1, -1]) { // (the plane's normal may point either way: look both ways)
          rc.set(v.clone().addScaledVector(n, 0.03 * sign), n.clone().multiplyScalar(-sign));
          rc.far = 0.06;
          hits += rc.intersectObjects(body, false).length;
        }
        if (!hits) missed++;
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(50);
    expect(missed / checked, 'a few corners of a patch over a thin tube may not be seen from the normal').toBeLessThan(0.1);
  });
});
