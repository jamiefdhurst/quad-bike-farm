import { describe, it, expect } from 'vitest';
import { VibrationModel } from '../src/vibration/vibrationModel.js';
import { DEFAULT_VIBRATION_PARAMS } from '../src/vibration/vibrationParams.js';
import { engineShare, passThrough, lurchKick, MountClonk, DEFAULT_MOUNT_PARAMS as M } from '../src/vibration/engineMounts.js';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { BenchJob, finishJob, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { QUAD_SPECS, LAND_ROVER_SPEC, TRACTOR_SPEC, UTV_SPEC } from '../src/vehicle/quadSpecs.js';

// A seeded random so runs compare.
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** Runs an idling engine and returns the RMS of the body's roll and pitch, and of the camera's roll. */
function idle(params, wear, seconds = 6) {
  const v = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS, ...params }, { random: seeded() });
  v.mountWear = wear;
  const dt = 1 / 60;
  const period = 120 / 800;
  let next = 0;
  let sum = { body: 0, cam: 0 };
  let n = 0;
  for (let now = 0; now < seconds; now += dt) {
    const pulses = [];
    while (next < now + dt) {
      pulses.push({ t: next - now, type: 'fire', strength: 1, period });
      next += period;
    }
    v.update(dt, { rpm: 800, roughness: 0.1, throttle: 0, isRunning: true, pulses });
    if (now > 1) {
      sum.body += v.body.roll ** 2 + v.body.pitch ** 2;
      sum.cam += v.camera.roll ** 2 + v.camera.pitch ** 2;
      n++;
    }
  }
  return { body: Math.sqrt(sum.body / n), cam: Math.sqrt(sum.cam / n) };
}

describe('engine mounts', () => {
  it('a bolted single with sound mounts is shaken exactly as before', () => {
    expect(engineShare(0, M)).toBe(0);
    const a = idle({}, 0);
    const b = idle({ mountGain: 0 }, 0);
    expect(a).toEqual(b);
  });

  it('worn mounts let much more through to the frame and your head', () => {
    const sound = idle({ mountGain: 0.7 }, 0);
    const worn = idle({ mountGain: 0.7 }, 1);
    expect(worn.body).toBeGreaterThan(sound.body * 1.5);
    expect(worn.cam).toBeGreaterThan(sound.cam * 1.5);
    const single = idle({}, 0);
    const wornSingle = idle({}, 1);
    expect(wornSingle.body).toBeGreaterThan(single.body);
  });

  it('a mounted engine changes the kind of shake, not just the size: it does not match the bolted one', () => {
    const bolted = idle({ mountGain: 0 }, 0);
    const mounted = idle({ mountGain: 0.7 }, 0);
    expect(mounted.body).not.toBeCloseTo(bolted.body, 4);
  });

  it('share and pass-through grow with wear', () => {
    expect(engineShare(1, { ...M, mountGain: 0.5 })).toBeGreaterThan(engineShare(0, { ...M, mountGain: 0.5 }));
    expect(passThrough(1, M)).toBeGreaterThan(passThrough(0, M));
    expect(passThrough(5, M)).toBe(passThrough(1, M)); // clamped
  });

  it('lurches as the engine stops, twice as hard as it catches, and only if it is on its mounts', () => {
    expect(lurchKick(0, false, { ...M, mountGain: 0 })).toBe(0);
    const stop = lurchKick(0, false, { ...M, mountGain: 0.7 });
    expect(stop).toBeGreaterThan(0);
    expect(lurchKick(0, true, { ...M, mountGain: 0.7 })).toBeCloseTo(stop / 2);

    const v = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS, mountGain: 0.7 }, { random: seeded() });
    const run = (isRunning) => v.update(1 / 60, { rpm: isRunning ? 800 : 0, roughness: 0, throttle: 0, isRunning, pulses: [] });
    run(true);
    const caught = Math.abs(v.osc.mountRoll.v);
    expect(caught).toBeGreaterThan(0); // the first firing catches it
    v.osc.mountRoll.v = 0;
    v.osc.mountRoll.x = 0;
    run(true);
    expect(v.osc.mountRoll.v).toBe(0);
    run(false);
    expect(Math.abs(v.osc.mountRoll.v)).toBeGreaterThan(0.1);

    const bolted = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS }, { random: seeded() });
    bolted.update(1 / 60, { rpm: 800, roughness: 0, throttle: 0, isRunning: true, pulses: [] });
    bolted.update(1 / 60, { rpm: 0, roughness: 0, throttle: 0, isRunning: false, pulses: [] });
    expect(bolted.osc.mountRoll.v).toBe(0);
  });

  it('only worn mounts clonk when the throttle goes on or off', () => {
    const run = (wear, throttles) => {
      const c = new MountClonk();
      return throttles.map((t) => c.update(1 / 60, t, wear, M));
    };
    const stab = [0, 0, 0, ...Array(40).fill(1), 0, 0, 0, 0];
    expect(run(0, stab).every((k) => k === 0)).toBe(true);
    const worn = run(1, stab);
    expect(worn.filter((k) => k > 0).length).toBe(1);
    expect(worn.filter((k) => k < 0).length).toBe(1);
    expect(Math.max(...worn)).toBeGreaterThan(Math.max(...run(0.4, stab)));
  });

  it('a slow roll of the throttle does not clonk', () => {
    const c = new MountClonk();
    let total = 0;
    for (let i = 0; i < 240; i++) total += Math.abs(c.update(1 / 60, Math.min(1, i / 240), 1, M));
    expect(total).toBe(0);
  });
});

describe('the mounts fault', () => {
  it('starts only with the engine running, slowly worsens, and a fix clears it', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0);
    f.update(1, { running: false, speed: 0, throttle: 0 });
    expect(f.has('mounts')).toBe(false);
    f.update(1, { running: true, speed: 0, throttle: 0 });
    expect(f.has('mounts')).toBe(true);
    const at = f.mountWear;
    f.update(60, { running: true, speed: 0, throttle: 0 });
    expect(f.mountWear).toBeGreaterThan(at);
    expect(f.fix('mounts')).toBe(true);
    expect(f.mountWear).toBe(0);
  });

  it('a rough fix leaves it mild but never put right', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0);
    f.begin('mounts');
    f.levels.mounts = 0.8;
    f.fix('mounts', { rough: true });
    expect(f.mountWear).toBeLessThanOrEqual(DEFAULT_FAULT_PARAMS.fieldFixLevel + 1e-9);
    expect(f.has('mounts')).toBe(true);
  });

  it('the bench job renews them, or leaves a little if botched', () => {
    const faults = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.3);
    faults.begin('mounts');
    const job = new BenchJob('mounts');
    expect(job.def.steps.length).toBeGreaterThanOrEqual(4);
    finishJob(job, { engine: { params: {} }, faults, fuel: {} }, P);
    expect(faults.has('mounts')).toBe(false);
    faults.begin('mounts');
    job.flaws.push({ step: 'tight', how: 'over' });
    finishJob(job, { engine: { params: {} }, faults, fuel: {} }, P);
    expect(faults.mountWear).toBeCloseTo(P.botchedLevel);
  });
});

describe('who is on soft mounts', () => {
  it('the diesels and the Land Rovers are, the quads are bolted', () => {
    for (const spec of [LAND_ROVER_SPEC, TRACTOR_SPEC, UTV_SPEC]) expect(spec.vibration.mountGain).toBeGreaterThan(0);
    for (const spec of QUAD_SPECS) expect(spec.vibration?.mountGain ?? 0).toBe(0);
  });
});
