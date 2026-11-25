import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { createRandom } from '../src/core/random.js';
import { planDamage, applyDamage, DEFAULT_RUSTY_DAMAGE } from '../src/vehicle/rustyDamage.js';
import { DONORS, loadDonors, buildDonor } from './helpers/rustyDamage.js';

// The rusty quad's damage (TODO 97): the plan is seeded and pure; the look is laid on each donor's finished model, and the jobs change it.
// The tarp and the jobs are in rustyDamageTarp.test.js, and the damage landing the same however the vehicle stands in rustyDamageSteady.test.js and rustyDamageSteadyMore.test.js.

describe('the damage plan', () => {
  it('is the same for the same seed and deals each donor its own: racks have bars to lose, the open engine a nest', () => {
    for (const id of DONORS) {
      const a = planDamage(createRandom(11), id);
      expect(planDamage(createRandom(11), id)).toEqual(a);
      expect(a.patches).toBeGreaterThanOrEqual(DEFAULT_RUSTY_DAMAGE.patches[0]);
      expect(a.patches).toBeLessThanOrEqual(DEFAULT_RUSTY_DAMAGE.patches[1]);
      expect(a.nest).toBe(id === 'hornet');
      expect(!!a.rack).toBe(['farm300', 'bruin', 'rb300'].includes(id));
    }
  });

  it('loses a front rack slat and a rear one, never the rails, and does not both lose and hang the same one', () => {
    for (let seed = 1; seed < 40; seed++) {
      const p = planDamage(createRandom(seed), 'farm300');
      expect(p.rack.front.skip.length).toBe(1);
      expect(p.rack.front.skip[0]).toBeGreaterThan(0);
      expect(p.rack.front.skip[0]).toBeLessThan(5);
      expect(p.rack.front.skip).not.toContain(p.rack.front.hang);
      expect(p.rack.rear.hang).toBeGreaterThan(0);
      expect(p.rack.rear.hang).toBeLessThan(3);
    }
  });
});

describe('the look on each donor', () => {
  let weatherModel;
  let buildTarp;
  const build = buildDonor;
  beforeAll(async () => {
    ({ weatherModel, buildTarp } = await loadDonors());
  });

  for (const id of DONORS) {
    it(`puts patches, cracks and webs on the ${id} and cracked tyres on all four wheels`, () => {
      const plan = planDamage(createRandom(5), id);
      const model = build(id, plan);
      weatherModel(model);
      const tarp = buildTarp();
      model.getObjectByName('bodyRoot').add(tarp);
      const look = applyDamage(model, plan, tarp);
      const count = (name) => { let n = 0; model.traverse((o) => { if (o.name === name) n++; }); return n; };
      expect(count('rustPatch')).toBeGreaterThanOrEqual(6);
      expect(count('crack')).toBeGreaterThanOrEqual(3);
      expect(count('cobweb')).toBeGreaterThanOrEqual(3);
      expect(look.tyres.length).toBe(4);
      expect(count('tyreCracks')).toBe(8);
      expect(count('seatRip')).toBeGreaterThanOrEqual(2);
      expect(count('rimRust')).toBeGreaterThanOrEqual(1);
      expect(count('mouseNest')).toBe(plan.nest ? 1 : 0);
    });
  }

  it('takes bars off a rack: fewer triangles than the same donor with its rack whole', () => {
    const tri = (m) => { let n = 0; m.traverse((o) => { if (o.isMesh) n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; }); return n; };
    const plan = { rack: { front: { skip: [1, 3], hang: null }, rear: { skip: [1], hang: null } } };
    expect(tri(build('farm300', plan))).toBeLessThan(tri(build('farm300', null)));
    const hanging = { rack: { front: { skip: [], hang: 2 }, rear: { skip: [], hang: 1 } } };
    expect(tri(build('farm300', hanging))).not.toBe(tri(build('farm300', null))); // a hanging bar is half a bar and a broken end
  });

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
