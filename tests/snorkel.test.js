import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { Snorkel, DEFAULT_SNORKEL_PARAMS as S, SNORKEL_PARAM_RANGES } from '../src/vehicle/snorkel.js';
import { waterGulp, stepWater } from '../src/engine/water.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';
import { BenchJob, JOBS, JOB_KINDS, finishJob, jobAvailable, DEFAULT_BENCH_PARAMS as B } from '../src/workshop/benchJobs.js';
import { AMY_BENCH_LINES, JESS_BENCH_LINES } from '../src/npc/benchLines.js';
import { buildAllModels } from './helpers/vehicleModels.js';

function doJob(job, flawAt) {
  while (!job.done) {
    const s = job.step;
    if (s.kind === 'press') job.press();
    else {
      job.startHold();
      job.update(s.id === flawAt ? job.needSeconds * 0.3 : s.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01);
      job.releaseHold();
    }
  }
  return job;
}

describe('the snorkel', () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(S)) expect(SNORKEL_PARAM_RANGES[k], k).toBeTruthy();
  });

  it('can only be fitted to a vehicle that can have one, and changes nothing until it is', () => {
    expect(new Snorkel(false).fit()).toBe(false);
    const s = new Snorkel(true);
    expect(s.effect()).toBe(null);
    expect(s.fit()).toBe(true);
    expect(s.effect()).toMatchObject({ depthFrom: S.depthFrom, scale: S.gulpScale });
    s.remove();
    expect(s.effect()).toBe(null);
  });

  it('leaves the ford and shallow water alone, and a steady pace through the deep, but not a flat-out hit', () => {
    const s = new Snorkel(true);
    s.fit();
    const e = s.effect();
    expect(waterGulp(0.8, 12, P)).toBeGreaterThan(0); // it would drown an engine without one
    expect(waterGulp(0.8, 12, P, e)).toBe(0);
    expect(waterGulp(1, 12, P, e)).toBeGreaterThan(0); // the deepest water, flat out
    expect(waterGulp(1, 12, P, e)).toBeCloseTo(waterGulp(1, 12, P) * S.gulpScale, 6 - 3);
    expect(waterGulp(1, 4, P, e)).toBe(0);
  });

  it('takes the ford (7 m of full depth) at 10 m/s with a splutter where an unfitted engine drowns, and drowns in it when the stream is up', () => {
    const s = new Snorkel(true);
    s.fit();
    const crossing = (snorkel, boost) => {
      let w = 0;
      for (let t = 0; t < 0.7; t += 0.05) w = stepWater(w, 0.05, { gulp: waterGulp(1, 10, P, snorkel) * boost, running: true }, P);
      return w;
    };
    expect(crossing(null, 1)).toBeGreaterThan(P.waterStallAt);
    expect(crossing(s.effect(), 1)).toBeLessThan(P.waterStallAt);
    expect(crossing(s.effect(), 1)).toBeGreaterThan(0.2);
    expect(crossing(s.effect(), 2.2)).toBeGreaterThan(P.waterStallAt);
  });

  it('a badly sealed one lets more back in than a good one, and still less than none', () => {
    const good = new Snorkel(true);
    good.fit(1);
    const bad = new Snorkel(true);
    bad.fit(B.snorkelBotchedSeal);
    const a = waterGulp(1, 12, P, good.effect());
    const b = waterGulp(1, 12, P, bad.effect());
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(waterGulp(1, 12, P));
  });

  it('is kept, and ignored by a vehicle that cannot have one', () => {
    const a = new Snorkel(true);
    a.fit(0.5);
    const b = new Snorkel(true);
    b.restore(JSON.parse(JSON.stringify(a.capture())));
    expect(b).toMatchObject({ fitted: true, seal: 0.5 });
    const none = new Snorkel(true);
    none.restore({ fitted: false });
    expect(none.fitted).toBe(false);
    const tractor = new Snorkel(false);
    tractor.restore(a.capture());
    expect(tractor.fitted).toBe(false);
  });
});

describe('the bench job', () => {
  it('is on the bench list and has steps', () => {
    expect(JOB_KINDS).toContain('snorkel');
    expect(JOBS.snorkel.steps.length).toBeGreaterThanOrEqual(4);
    expect(B.snorkelBotchedSeal).toBeLessThan(1);
  });

  it('is only offered to a Land Rover without one', () => {
    const e = { params: { strokes: 4 } };
    const s = new Snorkel(true);
    expect(jobAvailable('snorkel', e, B, false, true, false, null, s)).toBe(true);
    s.fit();
    expect(jobAvailable('snorkel', e, B, false, true, false, null, s)).toBe(false);
    expect(jobAvailable('snorkel', e, B, false, true, false, null, new Snorkel(false))).toBe(false);
  });

  it('a good job seals it; a flawed seal or hose leaves it leaking', () => {
    const t = { engine: {}, faults: {}, fuel: {}, snorkel: new Snorkel(true) };
    finishJob(doJob(new BenchJob('snorkel')), t);
    expect(t.snorkel).toMatchObject({ fitted: true, seal: 1 });
    for (const flaw of ['seal', 'hose']) {
      const u = { engine: {}, faults: {}, fuel: {}, snorkel: new Snorkel(true) };
      finishJob(doJob(new BenchJob('snorkel'), flaw), u);
      expect(u.snorkel.seal).toBe(B.snorkelBotchedSeal);
    }
  });

  it('the girls have a line each for it done and botched, none saying he, she or they of you', () => {
    for (const k of ['snorkelDone', 'snorkelBotched']) {
      expect(AMY_BENCH_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_BENCH_LINES[k].length).toBeGreaterThan(0);
      for (const l of [...AMY_BENCH_LINES[k].lines, ...JESS_BENCH_LINES[k]]) expect(l).not.toMatch(/—|\b(he|she|they)\b/i);
    }
  });
});

describe('the snorkel models', () => {
  let models;
  let addSnorkel;
  beforeAll(async () => {
    models = await buildAllModels();
    ({ addSnorkel } = await import('../src/vehicle/snorkelModel.js'));
  });

  it('is only built on the Land Rovers, hidden until fitted', () => {
    for (const { id, spec, model } of models) {
      const g = addSnorkel(model);
      if (spec.landRover) {
        expect(g, id).toBeTruthy();
        expect(g.visible, id).toBe(false);
      } else expect(g, id).toBe(null);
    }
  });

  it('stands on the wing, a pipe from the wing top up past the screen with a scoop facing forward, inside the vehicle\'s width', () => {
    for (const { id, spec, model } of models) {
      if (!spec.landRover) continue;
      const g = model.userData.snorkelGroup;
      g.visible = true;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g);
      const body = new THREE.Box3().setFromObject(model);
      expect(box.max.x, id).toBeLessThan(body.max.x);
      expect(box.min.x, id).toBeGreaterThan(0.5); // up the nearside, not the middle
      // its foot is sunk into something: a ray down from above the foot hits the body's surface above the foot's bottom
      const meshes = [];
      model.traverse((o) => o.isMesh && !g.children.includes(o) && o.visible && meshes.push(o));
      const ray = new THREE.Raycaster(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + 0.25, (box.min.z + box.max.z) / 2 - 0.08), new THREE.Vector3(0, -1, 0), 0, 1);
      const hit = ray.intersectObjects(meshes, false)[0];
      expect(hit, id).toBeTruthy();
      expect(box.min.y, id).toBeLessThan(hit.point.y); // sunk into the wing's top
      expect(box.min.y, id).toBeGreaterThan(hit.point.y - 0.06);
      // the scoop is the front-most part, and the top is higher than the cab's windscreen sill
      expect(box.max.z - box.min.z, id).toBeGreaterThan(0.2);
      g.visible = false;
    }
  });
});
