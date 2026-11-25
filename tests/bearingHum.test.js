import { describe, it, expect } from 'vitest';
import { bearingHum, humSource } from '../src/audio/bearingHum.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';

const on = (speed, level) => bearingHum({ speed, level, started: true });

describe('the bearing hum', () => {
  it('rises in pitch with road speed, and stops climbing at its top', () => {
    expect(on(6, 0.5).freq).toBeGreaterThan(on(3, 0.5).freq);
    expect(on(3, 0.5).freq).toBeGreaterThan(on(1, 0.5).freq);
    expect(on(60, 0.5).freq).toBe(on(80, 0.5).freq);
  });

  it('is louder the worse the bearing', () => {
    expect(on(6, 1).gain).toBeGreaterThan(on(6, 0.6).gain);
    expect(on(6, 0.6).gain).toBeGreaterThan(on(6, 0.15).gain);
    expect(on(6, 0.15).gain).toBeGreaterThan(0);
  });

  it('is silent with no fault, a cleared one or the wheel stood still', () => {
    expect(bearingHum({ speed: 8, level: 0.8, started: false }).gain).toBe(0);
    expect(bearingHum({ speed: 8, level: 0, started: true }).gain).toBe(0);
    expect(on(0, 0.8).gain).toBe(0);
    expect(on(0.2, 0.8).gain).toBe(0);
  });

  it('hums as loud reversing, and scales with the volume tuning', () => {
    expect(on(-6, 0.7).gain).toBeCloseTo(on(6, 0.7).gain);
    expect(bearingHum({ speed: 6, level: 0.7, started: true }, 2).gain).toBeCloseTo(2 * on(6, 0.7).gain);
  });

  it('has its volume as a tunable with a range', () => {
    expect(DEFAULT_SOUND_PARAMS.bearingVolume).toBeGreaterThan(0);
    expect(SOUND_PARAM_RANGES.bearingVolume).toBeDefined();
  });
});

describe('where the hum comes from', () => {
  const at = { x: 10, y: 1, z: 20 };
  it('is the faulty wheel, on its side and at its end, facing +z', () => {
    expect(humSource({ x: 0.5, z: 0.7 }, at, 0)).toEqual({ x: 10.5, y: 1, z: 20.7 }); // front left
    const rr = humSource({ x: -0.5, z: -0.7 }, at, 0);
    expect(rr.x).toBeCloseTo(9.5);
    expect(rr.z).toBeCloseTo(19.3);
  });
  it('turns with the vehicle: facing +x, the left wheel is towards -z', () => {
    const p = humSource({ x: 0.5, z: 0.7 }, at, Math.PI / 2);
    expect(p.x).toBeCloseTo(10.7);
    expect(p.z).toBeCloseTo(19.5);
  });
});
