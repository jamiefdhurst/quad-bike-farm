import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { runInThrash, runInWearFactor, startRunningIn, stepRunningIn, isThrashedRunningIn } from '../src/engine/runningIn.js';
import { fitBore } from '../src/engine/bigBore.js';
import { AMY_THRASH_LINES, JESS_THRASH_LINES } from '../src/npc/thrashLines.js';

const P = DEFAULT_ENGINE_PARAMS;

function running() {
  const e = new EngineModel({ initialTemperature: 1 }, { random: () => 0.5 });
  e.setIgnition(true);
  for (let i = 0; i < 600 && !e.isRunning; i++) e.update(1 / 60, { starter: true });
  return e;
}

// Hold the engine warm and at one throttle, and return what it wore and scarred.
function ride(throttle, seconds, fresh) {
  const e = running();
  if (fresh) startRunningIn(e);
  const w0 = e.wear;
  for (let i = 0; i < seconds * 20; i++) {
    e.update(1 / 20, { throttle });
    e.temperature = 1;
  }
  return { wear: e.wear - w0, scar: e.scar, runIn: e.runIn };
}

describe('running in', () => {
  it('counts gentle revs as gentle and flat out as thrashing', () => {
    expect(runInThrash(0.3, P)).toBe(0);
    expect(runInThrash(P.runInGentleRpm, P)).toBe(0);
    expect(runInThrash(1, P)).toBeCloseTo(1);
  });

  it('does nothing to an engine that is already run in', () => {
    expect(runInWearFactor(0, 1, P)).toBe(1);
    expect(runInWearFactor(1, 0.3, P)).toBe(1);
    expect(runInWearFactor(1, 1, P)).toBeCloseTo(1 + P.runInWearBoost);
  });

  it('is run in after enough gentle running, with no scar', () => {
    const e = { runIn: 1, scar: 0 };
    for (let i = 0; i < P.runInSeconds * 10 + 10; i++) stepRunningIn(e, 0.1, 0.3, P);
    expect(e.runIn).toBe(0);
    expect(e.scar).toBe(0);
  });

  it('ticks slower while it only idles', () => {
    const idle = { runIn: 1, scar: 0 };
    const gentle = { runIn: 1, scar: 0 };
    for (let i = 0; i < 100; i++) {
      stepRunningIn(idle, 0.1, 0, P);
      stepRunningIn(gentle, 0.1, 0.4, P);
    }
    expect(1 - idle.runIn).toBeCloseTo((1 - gentle.runIn) * P.runInIdleShare);
  });

  it('wears a new engine several times faster flat out than a run-in one, and scars it', () => {
    const fresh = ride(1, 60, true);
    const old = ride(1, 60, false);
    expect(fresh.wear).toBeGreaterThan(old.wear * 3);
    expect(fresh.scar).toBeGreaterThan(0.005);
    expect(old.scar).toBe(0);
  });

  it('wears a new engine no faster when it is run gently, and leaves no scar', () => {
    const gentle = ride(0.25, 60, true);
    const old = ride(0.25, 60, false);
    expect(gentle.wear).toBeCloseTo(old.wear, 4);
    expect(gentle.scar).toBe(0);
  });

  it('never scars past the cap', () => {
    const e = { runIn: 1, scar: 0 };
    for (let i = 0; i < 20000; i++) stepRunningIn(e, 0.1, 1, P);
    expect(e.scar).toBeLessThanOrEqual(P.runInScarMax);
  });

  it('runs a thrashed one rougher after a service has cleared its wear', () => {
    const a = running();
    const b = running();
    startRunningIn(a);
    for (let i = 0; i < 1200; i++) {
      a.update(1 / 20, { throttle: 1 });
      a.temperature = 1;
    }
    a.wear = 0;
    b.wear = 0;
    a.update(1 / 20, {});
    b.update(1 / 20, {});
    expect(a.roughness).toBeGreaterThan(b.roughness);
  });

  it('starts when a seized engine is freed and when the big-bore kit goes on', () => {
    const e = running();
    e.seized = true;
    e.freeSeized();
    expect(e.runIn).toBe(1);
    const f = running();
    fitBore(f, 1, { boreWearRemoved: 0.2 });
    expect(f.runIn).toBe(1);
  });

  it('only gets noticed while it is new, running and worked hard', () => {
    const e = { isRunning: true, runIn: 0.8, work: 0.9 };
    expect(isThrashedRunningIn(e, 0.6, P)).toBe(true);
    expect(isThrashedRunningIn({ ...e, runIn: 0.05 }, 0.6, P)).toBe(false);
    expect(isThrashedRunningIn({ ...e, work: 0.3 }, 0.6, P)).toBe(false);
    expect(isThrashedRunningIn({ ...e, isRunning: false }, 0.6, P)).toBe(false);
  });

  it('has lines for it', () => {
    expect(AMY_THRASH_LINES.thrashRunIn.lines.length).toBeGreaterThan(0);
    expect(AMY_THRASH_LINES.thrashRunInYou.lines.length).toBeGreaterThan(0);
    expect(JESS_THRASH_LINES.thrashRunInYou.length).toBeGreaterThan(0);
  });
});
