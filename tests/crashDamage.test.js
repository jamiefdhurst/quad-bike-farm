import { describe, it, expect } from 'vitest';
import { CrashWatch, damageFor, DEFAULT_CRASH_PARAMS as C } from '../src/vehicle/crashDamage.js';
import { Faults, DEFAULT_FAULT_PARAMS, FAULT_KINDS } from '../src/vehicle/faults.js';
import { BenchJob, JOBS, JOB_KINDS, finishJob, crashLook, wheelWords, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { pickHistory } from '../src/vehicle/history.js';
import { setFault, clearFaults } from '../src/debug/vehicleDebug.js';

const step = (w, vel, n = 1, dt = 1 / 60) => {
  let out = null;
  for (let i = 0; i < n; i++) out = w.update(dt, vel) ?? out;
  return out;
};
// wheels in the quad's own frame, front at negative z
const wheels = [
  { x: 0.5, z: -0.7, front: true, index: 0 },
  { x: -0.5, z: -0.7, front: true, index: 1 },
  { x: 0.5, z: 0.7, front: false, index: 2 },
  { x: -0.5, z: 0.7, front: false, index: 3 },
];
const always = () => 0;
const never = () => 0.999;

describe('spotting a crash', () => {
  it('braking hard is not a crash', () => {
    const w = new CrashWatch();
    let v = 12;
    for (let i = 0; i < 120; i++) {
      v = Math.max(0, v - 9.8 / 60);
      expect(w.update(1 / 60, { x: 0, y: 0, z: -v })).toBeNull();
    }
  });

  it('losing speed in a moment to a post is a hit, in the way it was shoved', () => {
    const w = new CrashWatch();
    step(w, { x: 0, y: 0, z: -8 }, 5);
    const hit = w.update(1 / 60, { x: 0, y: 0, z: 0 });
    expect(hit.type).toBe('hit');
    expect(hit.strength).toBeGreaterThan(0.5);
    expect(hit.dir.z).toBeCloseTo(1); // it was going -z, so it was knocked back +z
  });

  it('a slow bump into something does nothing', () => {
    const w = new CrashWatch();
    step(w, { x: 0, y: 0, z: -2 }, 5);
    expect(w.update(1 / 60, { x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('speeding up is not a crash', () => {
    const w = new CrashWatch();
    step(w, { x: 0, y: 0, z: -1 }, 3);
    expect(w.update(1 / 60, { x: 0, y: 0, z: -9 })).toBeNull();
  });

  it('a fall brought up short over a few steps is a landing', () => {
    const w = new CrashWatch();
    step(w, { x: 0, y: -9, z: -5 }, 3);
    let landing = null;
    for (const y of [-6, -3, 0]) landing = w.update(1 / 60, { x: 0, y: y, z: -5 }) ?? landing;
    expect(landing.type).toBe('landing');
  });

  it('a little hop is not', () => {
    const w = new CrashWatch();
    step(w, { x: 0, y: -2, z: -5 }, 3);
    expect(w.update(1 / 60, { x: 0, y: 0, z: -5 })).toBeNull();
  });

  it('one crash is counted once, not for every bounce', () => {
    const w = new CrashWatch();
    step(w, { x: 0, y: 0, z: -8 }, 5);
    expect(w.update(1 / 60, { x: 0, y: 0, z: 0 })).not.toBeNull();
    step(w, { x: 0, y: 0, z: -8 }, 2);
    expect(w.update(1 / 60, { x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('a long step or a reset is not a crash (a teleport, getting off)', () => {
    const w = new CrashWatch();
    step(w, { x: 0, y: 0, z: -9 }, 3);
    expect(w.update(0.5, { x: 0, y: 0, z: 0 })).toBeNull();
    step(w, { x: 0, y: 0, z: -9 }, 3);
    w.reset();
    expect(w.update(1 / 60, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});

describe('what a knock bends', () => {
  const hit = (strength, z = 1, x = 0) => ({ type: 'hit', strength, dir: { x, z } });

  it('a head-on hit takes a front wheel and can bend the rod and the rim', () => {
    const out = damageFor(hit(1), wheels, { x: 0.3, z: 1 }, C, always);
    expect(out.map((d) => d.kind).sort()).toEqual(['rim', 'rod']);
    expect(out.every((d) => d.wheel === 1 || d.wheel === 0)).toBe(true);
    expect(out[0].wheel).toBe(1); // pushed to +x, so the obstacle was at -x
  });

  it('a hit on the back takes a rear wheel and never a rod', () => {
    const out = damageFor(hit(1), wheels, { x: 0, z: -1 }, C, always);
    expect(out.every((d) => d.kind === 'rim' && d.wheel >= 2)).toBe(true);
  });

  it('a harder hit bends it more, and a light one may do nothing', () => {
    const light = damageFor(hit(0), wheels, { x: 0, z: 1 }, C, always);
    const hard = damageFor(hit(1), wheels, { x: 0, z: 1 }, C, always);
    expect(light[0].level).toBeCloseTo(C.levelLow);
    expect(hard[0].level).toBeCloseTo(C.levelHigh);
    expect(damageFor(hit(0), wheels, { x: 0, z: 1 }, C, never)).toEqual([]);
  });

  it('a landing can only bend a rim', () => {
    const out = damageFor({ type: 'landing', strength: 1, dir: { x: 0, z: 0 } }, wheels, { x: 0, z: 0 }, C, always);
    expect(out.map((d) => d.kind)).toEqual(['rim']);
    expect(damageFor({ type: 'landing', strength: 1, dir: { x: 0, z: 0 } }, wheels, { x: 0, z: 0 }, C, never)).toEqual([]);
  });

  it('a wheel that cannot be hurt is not offered, so nothing is bent with none', () => {
    expect(damageFor(hit(1), [], { x: 0, z: 1 }, C, always)).toEqual([]);
  });
});

describe('a bent rod and a bent rim', () => {
  const faults = (seed = 0.3) => new Faults({ ...DEFAULT_FAULT_PARAMS }, () => seed);

  it('they never start or worsen by themselves', () => {
    const f = faults();
    for (let t = 0; t < 20000; t += 1) f.update(1, { running: true, speed: 10, throttle: 1 });
    expect(f.has('rod')).toBe(false);
    expect(f.has('rim')).toBe(false);
  });

  it('a bent rod pulls the bars towards its side, more when more bent; the wheel toes out for show', () => {
    const f = faults();
    f.damage('rod', 0.5, 0);
    const half = f.rodPull;
    f.damage('rod', 1, 0);
    expect(Math.abs(f.rodPull)).toBeGreaterThan(Math.abs(half));
    expect(Math.sign(f.rodPull)).toBe(f.sideOf(0));
    expect(f.wheelToe(0)).not.toBe(0);
    expect(f.wheelToe(1)).toBe(0);
  });

  it('a bent rim wobbles its own wheel only and costs a little drive', () => {
    const f = faults();
    const before = f.driveFactor;
    f.damage('rim', 1, 3);
    expect(f.wheelWobble(3)).toBeCloseTo(DEFAULT_FAULT_PARAMS.rimWobble);
    expect(f.wheelWobble(0)).toBe(0);
    expect(f.driveFactor).toBeLessThan(before);
  });

  it('a second knock only makes it worse, never better', () => {
    const f = faults();
    f.damage('rim', 0.8, 2);
    f.damage('rim', 0.4, 1);
    expect(f.levels.rim).toBe(0.8);
    expect(f.rimWheel).toBe(2);
    f.damage('rim', 0.9, 1);
    expect(f.rimWheel).toBe(1);
  });

  it('the toolbox cannot mend them, only the bench', () => {
    const f = faults();
    f.damage('rod', 0.6, 0);
    expect(f.fix('rod', { rough: true })).toBe(false);
    expect(f.has('rod')).toBe(true);
    expect(f.fix('rod')).toBe(true);
    expect(f.rodWheel).toBe(-1);
    expect(f.rodPull).toBe(0);
  });

  it('the panel can set one without a knock, and gives it a wheel; Put it right clears both', () => {
    const f = faults();
    f.steerWheels = [0, 1];
    setFault(f, 'rod', 0.5);
    setFault(f, 'rim', 0.5);
    expect([0, 1]).toContain(f.rodWheel);
    expect(f.rimWheel).toBeGreaterThanOrEqual(0);
    clearFaults(f);
    expect(f.any).toBe(false);
    expect(f.rodWheel).toBe(-1);
    expect(f.rimWheel).toBe(-1);
  });

  it('a wheel layout with outriggers only bends the wheels it can', () => {
    const f = faults();
    f.steerWheels = [1];
    f.tyreWheels = [1, 2];
    f.begin('rod');
    expect(f.rodWheel).toBe(1);
  });

  it('they are fault kinds, so the save, the girls and the history have them', () => {
    expect(FAULT_KINDS).toEqual(expect.arrayContaining(['rod', 'rim']));
    let seen = 0;
    for (let seed = 1; seed < 400 && seen < 2; seed++) {
      let n = seed;
      const random = () => ((n = (n * 16807) % 2147483647) / 2147483647);
      const h = pickHistory({ engine: { strokes: 4 } }, random, { faultChance: 1 });
      if (h.faults.some((x) => x.kind === 'rod' || x.kind === 'rim')) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('mending it at the bench', () => {
  const bent = () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.3);
    f.damage('rod', 0.8, 0);
    f.damage('rim', 0.6, 3);
    return f;
  };
  const job = (flaws = []) => {
    const j = new BenchJob('crash');
    j.flaws.push(...flaws);
    return j;
  };
  const ctx = (faults) => ({ engine: { params: {} }, faults, fuel: {} });

  it('is a bench job with a look at the damage', () => {
    expect(JOB_KINDS).toContain('crash');
    expect(JOBS.crash.steps.some((s) => s.inspect)).toBe(true);
  });

  it('done right straightens both', () => {
    const f = bent();
    expect(finishJob(job(), ctx(f), P)).toMatch(/Straight/);
    expect(f.has('rod')).toBe(false);
    expect(f.has('rim')).toBe(false);
  });

  it('done badly leaves them both a little bent', () => {
    for (const flaw of [{ step: 'true', how: 'short' }, { step: 'true', how: 'over' }, { step: 'tight', how: 'short' }]) {
      const f = bent();
      finishJob(job([flaw]), ctx(f), P);
      expect(f.levels.rod).toBeCloseTo(P.crashBotched);
      expect(f.levels.rim).toBeCloseTo(P.crashBotched);
    }
  });

  it('with nothing bent a job leaves nothing bent', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.3);
    finishJob(job([{ step: 'true', how: 'short' }]), ctx(f), P);
    expect(f.any).toBe(false);
  });

  it('looking says which wheel, in words', () => {
    expect(crashLook(bent())).toBe('the front left track rod is bent, and the rear right rim runs out of true');
    expect(crashLook(new Faults())).toBe('everything runs true');
    expect(wheelWords({ wheelSides: [{ front: true, side: -1 }] }, 0)).toBe('front right');
  });
});
