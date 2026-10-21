import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { Spotlamps, DEFAULT_SPOTLAMP_PARAMS as P, SPOTLAMP_PARAM_RANGES } from '../src/vehicle/spotlamps.js';
import { BenchJob, JOBS, JOB_KINDS, finishJob, jobAvailable, DEFAULT_BENCH_PARAMS as B } from '../src/workshop/benchJobs.js';
import { pickLit, VehicleLights } from '../src/effects/vehicleLights.js';
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

describe('the spotlamps', () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) expect(SPOTLAMP_PARAM_RANGES[k], k).toBeTruthy();
  });

  it('can only be fitted to a vehicle that can have them, and starts switched off', () => {
    expect(new Spotlamps(false).fit()).toBe(false);
    const s = new Spotlamps(true);
    expect(s.fitted).toBe(false);
    expect(s.fit()).toBe(true);
    expect(s.fitted).toBe(true);
    expect(s.on).toBe(false);
  });

  it('the switch does nothing until they are fitted', () => {
    const s = new Spotlamps(true);
    expect(s.toggle()).toBe(null);
    s.fit();
    expect(s.toggle()).toBe(true);
    expect(s.toggle()).toBe(false);
  });

  it('comes up with the switch on and the key and battery there, and goes out without them', () => {
    const s = new Spotlamps(true);
    s.fit();
    s.on = true;
    s.update(0.05, false);
    expect(s.level).toBe(0);
    for (let i = 0; i < 40; i++) s.update(0.05, true, 1);
    expect(s.level).toBe(1);
    expect(s.load).toBeCloseTo(P.load);
    for (let i = 0; i < 40; i++) s.update(0.05, false);
    expect(s.level).toBe(0);
    expect(s.load).toBe(0);
  });

  it('dims with a weak battery', () => {
    const s = new Spotlamps(true);
    s.fit();
    s.on = true;
    for (let i = 0; i < 60; i++) s.update(0.05, true, 0.4);
    expect(s.level).toBeCloseTo(0.4);
  });

  it('a badly aimed pair points lower and off to one side', () => {
    const good = new Spotlamps(true);
    good.fit(1);
    const bad = new Spotlamps(true);
    bad.fit(0.35);
    expect(good.aimAngles().yaw).toBe(0);
    expect(bad.aimAngles().pitch).toBeGreaterThan(good.aimAngles().pitch);
    expect(bad.aimAngles().yaw).toBeGreaterThan(0);
  });

  it('is kept: fitted, switched, aimed', () => {
    const a = new Spotlamps(true);
    a.fit(0.5);
    a.on = true;
    const b = new Spotlamps(true);
    b.restore(JSON.parse(JSON.stringify(a.capture())));
    expect(b).toMatchObject({ fitted: true, on: true, aim: 0.5 });
    const none = new Spotlamps(true);
    none.restore({ fitted: false });
    expect(none.fitted).toBe(false);
    const tractor = new Spotlamps(false);
    tractor.restore(a.capture());
    expect(tractor.fitted).toBe(false);
  });

})

describe('the bench job', () => {
  it('is on the bench list and has steps', () => {
    expect(JOB_KINDS).toContain('spotlamps');
    expect(JOBS.spotlamps.steps.length).toBeGreaterThan(2);
  });

  it('is only offered where they can be fitted and are not already', () => {
    const e = { params: { strokes: 4 } };
    const s = new Spotlamps(true);
    expect(jobAvailable('spotlamps', e, B, false, true, false, s)).toBe(true);
    s.fit();
    expect(jobAvailable('spotlamps', e, B, false, true, false, s)).toBe(false);
    expect(jobAvailable('spotlamps', e, B, false, true, false, new Spotlamps(false))).toBe(false);
  });

  it('a good job aims them true; a flawed aim or wiring leaves them off', () => {
    const t = { engine: {}, faults: {}, fuel: {}, spotlamps: new Spotlamps(true) };
    finishJob(doJob(new BenchJob('spotlamps')), t);
    expect(t.spotlamps.fitted).toBe(true);
    expect(t.spotlamps.aim).toBe(1);
    for (const flaw of ['aim', 'wire']) {
      const u = { engine: {}, faults: {}, fuel: {}, spotlamps: new Spotlamps(true) };
      finishJob(doJob(new BenchJob('spotlamps'), flaw), u);
      expect(u.spotlamps.aim).toBe(B.spotBotchedAim);
    }
  });
});

describe('the light pool', () => {
  it('gives a fitted pair its own light right after the same vehicle\'s headlamps', () => {
    const cands = [
      { id: 'a', level: 1, distance: 5, mine: false, lighting: false },
      { id: 'a:spot', level: 1, distance: 5, mine: false, lighting: false },
      { id: 'b', level: 1, distance: 9, mine: false, lighting: false },
    ];
    expect(pickLit(cands, 3)).toEqual(['a', 'a:spot', 'b']);
    expect(pickLit(cands, 2)).toEqual(['a', 'a:spot']);
  });

  it('has room for the headlamps and a few pairs', () => {
    expect(new VehicleLights({ add() {} }).pool.length).toBeGreaterThanOrEqual(8);
  });
});

describe('the spotlamp models', () => {
  let models;
  let addSpotlamps;
  let spotlampSpots;
  beforeAll(async () => {
    models = await buildAllModels();
    ({ addSpotlamps, spotlampSpots } = await import('../src/vehicle/spotlampModel.js'));
  });

  it('puts two lamps above the headlamps, in front of them, on stalks that reach into the lamp housing', () => {
    let checked = 0;
    for (const { id, spec, model } of models) {
      if (spec.tractor || spec.utv || spec.car || !model.userData.beams?.length) continue;
      const group = addSpotlamps(model);
      expect(group, id).toBeTruthy();
      model.updateMatrixWorld(true);
      const heads = model.userData.beams.filter((o) => !o.isSprite).map((b) => model.worldToLocal(b.getWorldPosition(new THREE.Vector3())));
      const lenses = model.userData.spotLamps;
      expect(lenses.length, id).toBeGreaterThanOrEqual(2);
      const topHead = Math.max(...heads.map((h) => h.y));
      for (const l of lenses) {
        const at = model.worldToLocal(l.getWorldPosition(new THREE.Vector3()));
        expect(at.y, id).toBeGreaterThan(topHead + 0.05);
        expect(at.z, id).toBeGreaterThan(Math.max(...heads.map((h) => h.z)) - 0.02);
        const box = new THREE.Box3().setFromObject(model);
        expect(Math.abs(at.x), id).toBeLessThan(box.max.x);
      }
      // each stalk's foot is below the headlamp's own height: embedded in its housing, not floating over it
      const stalks = group.children.filter((c) => c.isMesh && c.geometry.type === 'BoxGeometry');
      for (const st of stalks) {
        const foot = st.position.y - st.geometry.parameters.height / 2;
        expect(foot, id).toBeLessThan(topHead);
      }
      expect(group.visible, id).toBe(false);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('puts a pair either side of the middle when there is one headlamp in the middle', () => {
    const spots = spotlampSpots([{ x: 0, y: 0.8, z: 0.9 }]);
    expect(spots.map((s) => s.x)).toEqual([-0.12, 0.12]);
  });
});
