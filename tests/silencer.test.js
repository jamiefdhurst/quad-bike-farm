import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { popPropensity } from '../src/engine/runOn.js';

const P = DEFAULT_ENGINE_PARAMS;
const make = () => new EngineModel({}, { random: () => 0.5 });

function runUp(e) {
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  for (let t = 0; t < 2; t += 0.05) e.update(0.05, { throttle: 1 });
}

describe('silencer off', () => {
  it('starts fitted', () => {
    expect(make().silencerOff).toBe(false);
  });

  it('gives a bit more power, by the tuned amount', () => {
    const on = make();
    const off = make();
    off.silencerOff = true;
    runUp(on);
    runUp(off);
    expect(off.power / on.power).toBeCloseTo(1 + P.silencerPower, 2);
  });

  it('makes it more ready to crackle on the overrun', () => {
    const base = { lean: 0, wear: 0, heat: 0 };
    const diff = popPropensity({ ...base, silencerOff: true }, P) - popPropensity(base, P);
    expect(diff).toBeCloseTo(P.silencerPop, 5);
  });
});

describe('a blown silencer', () => {
  const run = (strokes, seconds, throttle) => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const e = new EngineModel({ initialTemperature: 1 }, { random });
    e.setIgnition(true);
    for (let i = 0; i < 600 && !e.isRunning; i++) e.update(1 / 60, { starter: true, choke: 0.3 });
    expect(e.isRunning).toBe(true);
    e.params.strokes = strokes;
    for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, { throttle });
    return e;
  };

  it('only a two-stroke blows its packing out, and faster with revs', () => {
    expect(run(4, 120, 1).silencerBlown).toBe(0);
    const idle = run(2, 120, 0).silencerBlown;
    const hard = run(2, 120, 1).silencerBlown;
    expect(idle).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(idle);
  });

  it('is louder the more it has gone, up to a share of a silencer taken off', () => {
    const e = make();
    expect(e.exhaustLoud).toBe(0);
    e.silencerBlown = 1;
    expect(e.exhaustLoud).toBeCloseTo(P.silencerBlownLoud);
    e.silencerOff = true;
    expect(e.exhaustLoud).toBe(1);
  });
});
