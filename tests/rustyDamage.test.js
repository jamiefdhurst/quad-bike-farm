import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { createRandom } from '../src/core/random.js';
import { planDamage, applyDamage, DEFAULT_RUSTY_DAMAGE } from '../src/vehicle/rustyDamage.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The rusty quad's damage (TODO 97): the plan is seeded and pure; the look is laid on each donor's finished model, and the jobs change it.

const DONORS = ['farm300', 'bruin', 'hornet', 'rb300', 'adder'];

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
  let buildQuadModel;
  let weatherModel;
  let buildTarp;
  const build = (id, decay) => {
    const spec = { farm300: 'utility', bruin: 'bruin', hornet: 'hornet', rb300: 'rb300', adder: 'racer' }[id];
    const model = buildQuadModel({ bodyColor: 0x6b4426, dashStyle: { farm300: 'farm300', bruin: 'bruin', hornet: 'hornet', rb300: 'rb300', adder: 'adder' }[id], style: spec, decay });
    model.updateMatrixWorld(true);
    return model;
  };
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    ({ buildQuadModel } = await import('../src/vehicle/quadModel.js'));
    ({ weatherModel, buildTarp } = await import('../src/vehicle/rustyLook.js'));
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

  it('shows what the jobs did: the tarp slides off and goes, the tyres get fresh black rubber, the nest goes with the carb job', () => {
    const plan = planDamage(createRandom(5), 'hornet');
    const model = build('hornet', plan);
    weatherModel(model);
    const tarp = buildTarp();
    model.getObjectByName('bodyRoot').add(tarp);
    const look = applyDamage(model, plan, tarp);
    const find = { tarpOff: false, done: new Set(), isDone(k) { return this.done.has(k); } };
    look.sync(find);
    expect(tarp.visible).toBe(true);
    const pale = look.tyres[0].mesh.material.color.getHex();
    expect(look.nest.visible).toBe(true);
    // The tarp comes off.
    find.tarpOff = true;
    look.sync(find);
    look.step(0.5);
    expect(tarp.visible).toBe(true);
    expect(tarp.position.x).toBeGreaterThan(look.tarpHome.x + 0.1); // on its way
    look.step(1.5);
    expect(tarp.visible).toBe(false);
    // The tyre job and the carb job.
    find.done.add('tyre');
    find.done.add('carb');
    look.sync(find);
    expect(look.tyres[0].mesh.material.color.getHex()).not.toBe(pale);
    expect(look.tyres[0].mesh.material.color.r).toBeLessThan(0.1);
    expect(look.tyres[0].rings.every((r) => !r.visible)).toBe(true);
    expect(look.nest.visible).toBe(false);
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

  it('drapes the tarp over the quad’s own shape, down to the ground all round, with nothing of the quad through it', () => {
    const plan = planDamage(createRandom(5), 'farm300');
    const model = build('farm300', plan);
    const tarp = buildTarp(model);
    const root = model.getObjectByName('bodyRoot');
    root.add(tarp);
    model.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    const top = (x, z) => { rc.set(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0)); return rc.intersectObject(tarp)[0]?.point.y ?? 0; };
    expect(top(0.93, 0)).toBeLessThan(0.1); // down to the ground at the sides
    expect(top(0, -1.4)).toBeLessThan(0.1);
    expect(top(0, 0.46)).toBeGreaterThan(0.95); // up over the bars
    const lumpy = [0, 0.3, -0.3, 0.6].map((x) => top(x, 0.2));
    expect(Math.max(...lumpy) - Math.min(...lumpy)).toBeGreaterThan(0.02); // not a flat-topped box
    for (const [x, z] of [[0.41, 0.9], [-0.41, 0.9], [0.41, -0.95], [0, 0.46]]) { // the racks' rails and the bars stand under it
      rc.set(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0));
      const body = [];
      model.traverse((o) => { if (o.isMesh && o !== tarp && o.name !== 'proxy' && o.visible && !/beam|halo/i.test(o.name)) body.push(o); });
      const high = rc.intersectObjects(body, false)[0]?.point.y ?? 0;
      expect(top(x, z), `over ${x},${z}`).toBeGreaterThan(high - 0.015); // (a thin rail may show a centimetre between the grid's points)
    }
  });

  it('puts a loaded farm straight to where it was, with no tarp to drag', () => {
    const plan = planDamage(createRandom(5), 'farm300');
    const model = build('farm300', plan);
    const tarp = buildTarp();
    model.getObjectByName('bodyRoot').add(tarp);
    const look = applyDamage(model, plan, tarp);
    look.sync({ tarpOff: true, isDone: () => false }, { instant: true });
    expect(tarp.visible).toBe(false);
  });
  describe('lands the same wherever and however the vehicle stands (#597)', () => {
    // The geometry of each decal, as the sum of its vertices' distances from the origin in the body's own frame: the same placing gives the same figures.
    const signature = (model) => {
      const out = [];
      model.traverse((o) => {
        if (!o.userData.rustyDamage || !o.geometry) return;
        const p = o.geometry.attributes.position;
        let sum = 0;
        for (let i = 0; i < p.count; i++) sum += Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
        out.push(`${o.name}:${p.count}:${sum.toFixed(3)}`);
      });
      return out.join(' ');
    };
    const dressed = (id, setUp) => {
      const plan = planDamage(createRandom(7), id);
      const model = build(id, plan);
      setUp?.(model);
      model.updateMatrixWorld(true);
      applyDamage(model, plan, null);
      return model;
    };

    for (const id of DONORS) {
      it(`for the ${id}: turned, tilted on its springs, with the bars steered, or with parts left out for being small`, () => {
        const plain = signature(dressed(id));
        expect(plain.length).toBeGreaterThan(0);
        const moved = dressed(id, (m) => {
          m.position.set(30, 0.4, -12);
          m.rotation.y = 2.1;
          const body = m.getObjectByName('bodyRoot');
          body.rotation.x = 0.04;
          body.rotation.z = -0.03;
          const bars = m.getObjectByName('handlebars');
          if (bars) bars.rotation.y = 0.15;
          m.traverse((o) => { if (o.isMesh && o.name.length % 3 === 0) o.layers.set(1); }); // FarDetail's leaving out of specks
        });
        expect(signature(moved)).toBe(plain);
      });
    }

    it('puts a vehicle back as it was stood, steered and tilted', () => {
      const plan = planDamage(createRandom(7), 'farm300');
      const model = build('farm300', plan);
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

    it('counts a small part FarDetail has hidden for being far off as still there, and leaves out one the game hid', { timeout: 30000 }, () => {
      const plain = signature(dressed('farm300'));
      expect(signature(dressed('farm300', (m) => m.traverse((o) => { if (o.isMesh && o.name === 'seat') { o.visible = false; o.userData.farHidden = true; } })))).toBe(plain);
      expect(signature(dressed('farm300', (m) => m.traverse((o) => { if (o.isMesh && o.name === 'seat') o.visible = false; })))).not.toBe(plain);
    });
  });
});
