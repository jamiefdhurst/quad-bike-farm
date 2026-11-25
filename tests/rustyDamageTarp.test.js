import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { createRandom } from '../src/core/random.js';
import { planDamage, applyDamage } from '../src/vehicle/rustyDamage.js';
import { loadDonors, buildDonor } from './helpers/rustyDamage.js';

// The rusty quad's tarp, and what the jobs change: split from rustyDamage.test.js, which has the rest of the look (#1183).

describe('the look on each donor', () => {
  let weatherModel;
  let buildTarp;
  const build = buildDonor;
  beforeAll(async () => {
    ({ weatherModel, buildTarp } = await loadDonors());
  });

  it('shows what the jobs did: the tarp slides off and lies on the floor, the tyres get fresh black rubber, the nest goes with the carb job', () => {
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
    expect(tarp.visible).toBe(true); // still there, for you and the girls to find
    expect(tarp.position.x).toBeGreaterThan(look.tarpHome.x + 1);
    // The tyre job and the carb job.
    find.done.add('tyre');
    find.done.add('carb');
    look.sync(find);
    expect(look.tyres[0].mesh.material.color.getHex()).not.toBe(pale);
    expect(look.tyres[0].mesh.material.color.r).toBeLessThan(0.1);
    expect(look.tyres[0].rings.every((r) => !r.visible)).toBe(true);
    expect(look.nest.visible).toBe(false);
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
    expect(tarp.visible).toBe(true); // it lies where it would have been left, not back on the vehicle and not gone
    expect(tarp.position.x).toBeGreaterThan(look.tarpHome.x + 1);
    expect(look.tarpFolded).toBe(true);
  });

  describe('a tarp that has come off (#808)', () => {
    const lay = (scene = true) => {
      const plan = planDamage(createRandom(5), 'farm300');
      const model = build('farm300', plan);
      weatherModel(model);
      const root = new THREE.Scene();
      const quad = new THREE.Group();
      quad.add(model);
      if (scene) root.add(quad);
      const tarp = buildTarp(model);
      model.getObjectByName('bodyRoot').add(tarp);
      const look = applyDamage(model, plan, tarp);
      const find = { tarpOff: false, isDone: () => false };
      look.sync(find);
      return { look, tarp, quad, model, find, root };
    };
    const box = (o) => new THREE.Box3().setFromObject(o);
    const vehicleBox = (model, tarp) => {
      const b = new THREE.Box3();
      model.traverse((o) => { if (o.isMesh && o !== tarp && o.visible && !o.userData.rustyDamage && !/proxy|beam|halo/i.test(o.name)) b.expandByObject(o); });
      return b;
    };

    it('is left on the floor beside the vehicle: in plain sight, clear of it, low and close enough to reach', () => {
      const { look, tarp, model, find, root } = lay();
      find.tarpOff = true;
      look.sync(find);
      look.step(2);
      root.updateMatrixWorld(true);
      expect(tarp.visible).toBe(true);
      const t = box(tarp);
      const v = vehicleBox(model, tarp);
      expect(t.max.y - t.min.y).toBeLessThan(0.35); // folded down, not a heap you could not step over
      expect(t.min.y).toBeGreaterThan(-0.001); // not through the floor
      expect(t.min.x).toBeGreaterThan(v.max.x - 0.05); // beside the vehicle (this one stands unturned), not over it
      expect(t.getCenter(new THREE.Vector3()).distanceTo(v.getCenter(new THREE.Vector3()))).toBeLessThan(3);
    });

    it('stays where it lay when the vehicle is driven away, not riding on it', () => {
      const { look, tarp, quad, find, root } = lay();
      find.tarpOff = true;
      look.sync(find);
      look.step(2);
      root.updateMatrixWorld(true);
      const before = tarp.getWorldPosition(new THREE.Vector3());
      quad.position.set(20, 0, -5);
      root.updateMatrixWorld(true);
      expect(tarp.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-6);
      expect(tarp.parent).toBe(root);
    });

    it('goes back over the vehicle if the job is undone', () => {
      const { look, tarp, quad, find, root } = lay();
      find.tarpOff = true;
      look.sync(find);
      look.step(2);
      find.tarpOff = false;
      look.sync(find);
      root.updateMatrixWorld(true);
      expect(tarp.visible).toBe(true);
      expect(tarp.scale.y).toBe(1);
      expect(tarp.position.distanceTo(look.tarpHome)).toBeLessThan(1e-6);
      expect(tarp.parent.parent).not.toBe(root); // on the vehicle's body again
      quad.position.set(5, 0, 0);
      look.sync({ tarpOff: true, isDone: () => false }, { instant: true });
      expect(look.tarpFolded).toBe(true);
    });
  });
});
