import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { createRandom } from '../src/core/random.js';
import { planDamage, applyDamage, DEFAULT_RUSTY_DAMAGE } from '../src/vehicle/rustyDamage.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The rusty quad's damage (TODO 97): the plan is seeded and pure; the look is laid on each donor's finished model, and the jobs change it.

const DONORS = ['red', 'blue', 'yellow', 'green', 'orange'];

describe('the damage plan', () => {
  it('is the same for the same seed and deals each donor its own: racks have bars to lose, the open engine a nest', () => {
    for (const id of DONORS) {
      const a = planDamage(createRandom(11), id);
      expect(planDamage(createRandom(11), id)).toEqual(a);
      expect(a.patches).toBeGreaterThanOrEqual(DEFAULT_RUSTY_DAMAGE.patches[0]);
      expect(a.patches).toBeLessThanOrEqual(DEFAULT_RUSTY_DAMAGE.patches[1]);
      expect(a.nest).toBe(id === 'yellow');
      expect(!!a.rack).toBe(['red', 'blue', 'green'].includes(id));
    }
  });

  it('loses a front rack slat and a rear one, never the rails, and does not both lose and hang the same one', () => {
    for (let seed = 1; seed < 40; seed++) {
      const p = planDamage(createRandom(seed), 'red');
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
    const spec = { red: 'utility', blue: 'grizzly', yellow: 'blaster', green: 'bayou', orange: 'racer' }[id];
    const model = buildQuadModel({ bodyColor: 0x6b4426, dashStyle: { red: 'foreman', blue: 'grizzly', yellow: 'blaster', green: 'bayou', orange: 'quadracer' }[id], style: spec, decay });
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
      expect(count('mouseNest')).toBe(plan.nest ? 1 : 0);
    });
  }

  it('takes bars off a rack: fewer triangles than the same donor with its rack whole', () => {
    const tri = (m) => { let n = 0; m.traverse((o) => { if (o.isMesh) n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; }); return n; };
    const plan = { rack: { front: { skip: [1, 3], hang: null }, rear: { skip: [1], hang: null } } };
    expect(tri(build('red', plan))).toBeLessThan(tri(build('red', null)));
    const hanging = { rack: { front: { skip: [], hang: 2 }, rear: { skip: [], hang: 1 } } };
    expect(tri(build('red', hanging))).not.toBe(tri(build('red', null))); // a hanging bar is half a bar and a broken end
  });

  it('shows what the jobs did: the tarp slides off and goes, the tyres get fresh black rubber, the nest goes with the carb job', () => {
    const plan = planDamage(createRandom(5), 'yellow');
    const model = build('yellow', plan);
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

  it('puts a loaded farm straight to where it was, with no tarp to drag', () => {
    const plan = planDamage(createRandom(5), 'red');
    const model = build('red', plan);
    const tarp = buildTarp();
    model.getObjectByName('bodyRoot').add(tarp);
    const look = applyDamage(model, plan, tarp);
    look.sync({ tarpOff: true, isDone: () => false }, { instant: true });
    expect(tarp.visible).toBe(false);
  });
});
