import { describe, it, expect } from 'vitest';
import { tempGaugeFraction, coldZoneEnd, WARM_AT, HOT_FROM } from '../src/vehicle/tempGauge.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const at = (c) => ({ c, air: 10, warm: 90, hot: 110, top: 125 });

describe('temperature gauge', () => {
  it('rests at C with the ignition off and rises with temperature', () => {
    expect(tempGaugeFraction(at(90), false)).toBe(0);
    expect(tempGaugeFraction(at(10))).toBe(0);
    expect(tempGaugeFraction(at(30))).toBeLessThan(tempGaugeFraction(at(60)));
    expect(tempGaugeFraction(undefined)).toBe(0);
  });

  it('puts a warm engine in the normal band, short of the red zone', () => {
    expect(tempGaugeFraction(at(90))).toBe(WARM_AT);
    expect(WARM_AT).toBeLessThan(HOT_FROM);
    expect(tempGaugeFraction(at(100))).toBeCloseTo((WARM_AT + HOT_FROM) / 2);
    expect(tempGaugeFraction(at(110))).toBeCloseTo(HOT_FROM);
  });

  it('clamps out-of-range temperatures', () => {
    expect(tempGaugeFraction(at(-5))).toBe(0);
    expect(tempGaugeFraction(at(200))).toBe(1);
  });

  it('puts the end of the cold zone where the cold light goes out', () => {
    const t = DEFAULT_ENGINE_PARAMS.warmLightThreshold;
    expect(coldZoneEnd(t)).toBeCloseTo(t * WARM_AT);
  });
});
