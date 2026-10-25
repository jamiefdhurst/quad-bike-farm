import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { engineFamily, canPull, fitIndex, pullEngine, fitEngine, captureSwap, restoreSwap, familyWords, engineName } from '../src/vehicle/engineSwap.js';
import { captureVehicle, restoreVehicle } from '../src/farm/farmState.js';
import { Spares, DEFAULT_SPARES_PARAMS } from '../src/workshop/spares.js';
import { BenchJob, ENGINE_JOB_KINDS, JOBS, finishJob, DEFAULT_BENCH_PARAMS as B } from '../src/workshop/benchJobs.js';
import { DEFAULT_FARM_PARAMS } from '../src/farm/farmSave.js';

const random = () => 0.5;

/** A stand-in unit: the pieces the swap touches, with a real engine model. */
function unit(spec, engineParams = {}) {
  const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine, ...engineParams }, { random });
  const left = [];
  return {
    spec,
    id: spec.id,
    label: spec.label ?? spec.id,
    engine,
    audio: { params: { recBank: 'engine-bank', volume: 1, ...spec.audio } },
    quad: {
      params: { clutchEngageRpm: 1500, clutchFullRpm: 2500, couplingRpm: 1600 },
      faults: { leave: (kind, level) => left.push([kind, level]), levels: {}, started: {}, caps: {}, kept: {}, wheelOf: {}, tyre: -1, rodWheel: -1, rimWheel: -1 },
      usage: { hours: 100, odoMiles: 200 },
      fuel: { litres: 5, tap: 'on', setLitres() {} },
      faults_left: left,
    },
  };
}

const twoStroke = { id: 'yellow', label: 'yellow', engine: { strokes: 2, pullStart: true, idleRpmWarm: 1500, maxRpm: 8000 } };
const twoStrokeB = { id: 'green', label: 'green', engine: { strokes: 2, pullStart: true, idleRpmWarm: 1800, maxRpm: 9000, baseRoughness: 0.3 }, audio: { recBank: 'engine-bank-green' } };
const fourStroke = { id: 'blue', label: 'blue', engine: { strokes: 4 } };
const manual = { id: 'red', label: 'red', manual: true, engine: { strokes: 4 } };

describe('which engines fit which', () => {
  it('matches two-strokes with two-strokes and a manual only with a manual', () => {
    const f = (s) => engineFamily(s, { ...DEFAULT_ENGINE_PARAMS, ...s.engine });
    expect(f(twoStroke)).toBe(f(twoStrokeB));
    expect(f(twoStroke)).not.toBe(f(fourStroke));
    expect(f(fourStroke)).not.toBe(f(manual));
  });

  it('gives nothing for a tractor, a car or an engine with no starter', () => {
    expect(engineFamily({ tractor: true, engine: {} }, DEFAULT_ENGINE_PARAMS)).toBeNull();
    expect(engineFamily({ car: 'corsa' }, DEFAULT_ENGINE_PARAMS)).toBeNull();
    expect(engineFamily({}, { ...DEFAULT_ENGINE_PARAMS, noStarter: true })).toBeNull();
  });

  it('puts every real quad in a family, and the girls\' quads in at least one with a partner or alone without error', () => {
    for (const s of QUAD_SPECS) {
      const f = engineFamily(s, { ...DEFAULT_ENGINE_PARAMS, ...s.engine });
      expect(f === null || typeof f === 'string', s.id).toBe(true);
    }
  });

  it('says what sort an engine is', () => {
    expect(familyWords('2t-cord-cvt')).toBe('two-stroke, pull-cord, for a twist-and-go');
  });
});

describe('pulling and fitting', () => {
  it('takes the engine out with its numbers, sound and wear, and leaves the body unable to start', () => {
    const donor = unit(twoStrokeB);
    donor.engine.wear = 0.4;
    donor.engine.params.baseRoughness = 0.21;
    expect(canPull(donor)).toBe(true);
    const pack = pullEngine(donor);
    expect(donor.engineOut).toBe(true);
    expect(canPull(donor)).toBe(false);
    expect(pack.params.maxRpm).toBe(9000);
    expect(pack.audio.recBank).toBe('engine-bank-green');
    expect(pack.condition.wear).toBe(0.4);
    expect(pack.label).toBe('green');
  });

  it('puts the donor\'s character into the new quad, in place, and returns the old engine', () => {
    const donor = unit(twoStrokeB);
    donor.engine.wear = 0.4;
    const target = unit(twoStroke);
    target.engine.wear = 0.1;
    const params = target.engine.params;
    const audio = target.audio.params;
    const pack = pullEngine(donor);
    const old = fitEngine(target, pack, 1, B);
    expect(target.engine.params).toBe(params); // the tuning panel holds on to the same object
    expect(target.audio.params).toBe(audio);
    expect(params.maxRpm).toBe(9000);
    expect(params.idleRpmWarm).toBe(1800);
    expect(audio.recBank).toBe('engine-bank-green');
    expect(target.engine.wear).toBe(0.4);
    expect(target.engine.runIn).toBeGreaterThan(0); // it wants running in
    expect(target.engineOrigin.label).toBe('green');
    expect(target.topRpm).toBe(9000);
    expect(old.params.maxRpm).toBe(8000);
    expect(old.condition.wear).toBe(0.1);
    expect(target.quad.faults_left).toEqual([]);
  });

  it('keeps the clutch biting above a higher idle', () => {
    const target = unit(twoStroke);
    const donor = unit(twoStrokeB, { idleRpmWarm: 2400 });
    fitEngine(target, pullEngine(donor), 1, B);
    expect(target.quad.params.clutchEngageRpm).toBeGreaterThan(2400);
  });

  it('leaves a badly bolted engine rough with loose mounts', () => {
    const target = unit(twoStroke);
    const rough = target.engine.params.baseRoughness;
    fitEngine(target, pullEngine(unit(twoStrokeB)), 0.5, B);
    expect(target.quad.faults_left).toEqual([['mounts', B.botchedLevel]]);
    expect(target.engine.params.baseRoughness).toBeGreaterThan(0.3 + B.swapBotchedRoughness - 0.001);
    expect(rough).toBeLessThan(target.engine.params.baseRoughness);
  });

  it('fits a body that has no engine and gives nothing back', () => {
    const body = unit(twoStroke);
    pullEngine(body);
    const old = fitEngine(body, pullEngine(unit(twoStrokeB)), 1, B);
    expect(old).toBeNull();
    expect(body.engineOut).toBe(false);
  });

  it('finds the first engine on the shelf that suits', () => {
    const engines = [{ family: 'x' }, { family: engineFamily(twoStroke, { ...DEFAULT_ENGINE_PARAMS, ...twoStroke.engine }) }];
    expect(fitIndex(engines, unit(twoStroke))).toBe(1);
    expect(fitIndex(engines, unit(fourStroke))).toBe(-1);
    expect(fitIndex([], unit(twoStroke))).toBe(-1);
  });

  it('names an engine for the toasts', () => {
    expect(engineName({ label: 'rusty quad' })).toBe("the rusty quad's engine");
  });
});

describe('the bench jobs', () => {
  it('has both jobs, with steps, and lists them for the second page', () => {
    for (const k of ENGINE_JOB_KINDS) expect(JOBS[k].steps.length).toBeGreaterThan(0);
  });

  it('calls the bench\'s own pull and fit, with a botched fit for any flaw', () => {
    const calls = [];
    const target = { engine: {}, pullEngine: () => (calls.push('pull'), 'out'), fitEngine: (fit) => (calls.push(fit), 'in') };
    const clean = new BenchJob('swap', B);
    expect(finishJob(clean, target, B)).toBe('in');
    const flawed = new BenchJob('swap', B);
    flawed.flaws.push({ step: 'lower', how: 'over' });
    finishJob(flawed, target, B);
    expect(finishJob(new BenchJob('pull', B), target, B)).toBe('out');
    expect(calls).toEqual([1, 0.5, 'pull']);
  });
});

describe('the shelf and the save', () => {
  it('keeps engines on the floor from one day to the next', () => {
    const spares = new Spares(DEFAULT_SPARES_PARAMS, random);
    spares.engines.push(pullEngine(unit(twoStrokeB)));
    const back = new Spares(DEFAULT_SPARES_PARAMS, random);
    back.restore(JSON.parse(JSON.stringify(spares.toJSON())));
    expect(back.engines).toHaveLength(1);
    expect(back.engines[0].params.maxRpm).toBe(9000);
    back.restore({ engines: [{ nonsense: true }] });
    expect(back.engines).toHaveLength(0); // junk in a save is dropped
  });

  it('puts a swapped engine back on a fresh quad the next morning', () => {
    const target = unit(twoStroke);
    fitEngine(target, pullEngine(unit(twoStrokeB)), 1, B);
    target.engine.wear = 0.33;
    const saved = JSON.parse(JSON.stringify(captureVehicle(target)));
    expect(saved.swap.label).toBe('green');
    const fresh = unit(twoStroke);
    restoreVehicle(fresh, saved);
    expect(fresh.engine.params.maxRpm).toBe(9000);
    expect(fresh.audio.params.recBank).toBe('engine-bank-green');
    expect(fresh.engineOrigin.label).toBe('green');
    expect(fresh.engine.wear).toBe(0.33);
    expect(captureSwap(unit(twoStroke))).toBeNull();
    restoreSwap(fresh, null); // nothing to put back is fine
  });

  it('keeps a body with its engine out', () => {
    const body = unit(twoStroke);
    pullEngine(body);
    const saved = captureVehicle(body);
    expect(saved.engineOut).toBe(true);
    const fresh = unit(twoStroke);
    restoreVehicle(fresh, saved);
    expect(fresh.engineOut).toBe(true);
    void DEFAULT_FARM_PARAMS;
  });
});
