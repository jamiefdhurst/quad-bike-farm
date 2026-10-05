import { describe, it, expect } from 'vitest';
import { tempGaugeFraction, coldZoneEnd, WARM_AT, HOT_FROM } from '../src/vehicle/tempGauge.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

describe('temperature gauge', () => {
  it('rests at C with the ignition off and rises with temperature', () => {
    expect(tempGaugeFraction(0.9, false)).toBe(0);
    expect(tempGaugeFraction(0, true)).toBe(0);
    expect(tempGaugeFraction(0.3)).toBeLessThan(tempGaugeFraction(0.6));
  });

  it('puts a fully warm engine in the normal band, short of the red zone', () => {
    expect(tempGaugeFraction(1)).toBe(WARM_AT);
    expect(WARM_AT).toBeLessThan(HOT_FROM);
  });

  it('clamps out-of-range temperatures', () => {
    expect(tempGaugeFraction(-1)).toBe(0);
    expect(tempGaugeFraction(5)).toBe(WARM_AT);
  });

  it('puts the end of the cold zone where the cold light goes out', () => {
    const t = DEFAULT_ENGINE_PARAMS.warmLightThreshold;
    expect(coldZoneEnd(t)).toBeCloseTo(t * WARM_AT);
  });
});
