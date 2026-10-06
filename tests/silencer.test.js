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
