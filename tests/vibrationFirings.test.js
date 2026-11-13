import { describe, it, expect } from 'vitest';
import { VibrationModel } from '../src/vibration/vibrationModel.js';
import { DEFAULT_VIBRATION_PARAMS } from '../src/vibration/vibrationParams.js';
import { TRACTOR_SPEC } from '../src/vehicle/quadSpecs.js';

// Feeds the model one pulse per engine cycle, as the engine model does, and records when the body is kicked.
function kicksAt(params, rpm, seconds) {
  const v = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS, ...params }, { random: () => 0.5 });
  const times = [];
  const kick = v.kick.bind(v);
  let now = 0;
  v.kick = (pulse, ...rest) => {
    times.push(now + pulse.t);
    return kick(pulse, ...rest);
  };
  const dt = 1 / 60;
  const period = 120 / rpm;
  let next = 0;
  for (; now < seconds; now += dt) {
    const pulses = [];
    while (next < now + dt) {
      pulses.push({ t: next - now, type: 'fire', strength: 1, period });
      next += period;
    }
    v.update(dt, { rpm, roughness: 0, pulses });
  }
  return times;
}

describe('a multi-cylinder engine shakes at its firing rate', () => {
  it('kicks once a cycle by default, as the quads always have', () => {
    const times = kicksAt({}, 1200, 2);
    expect(times.length).toBeGreaterThanOrEqual(19);
    expect(times.length).toBeLessThanOrEqual(21);
  });

  it('spreads each cycle into evenly spaced kicks for a four-cylinder, carrying the late ones into the next update', () => {
    const times = kicksAt({ firingsPerCycle: 4 }, 450, 2);
    // 450 rpm is 3.75 cycles a second: 15 firings a second, 1/15 s apart.
    expect(times.length).toBeGreaterThanOrEqual(29);
    expect(times.length).toBeLessThanOrEqual(31);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    for (const g of gaps) expect(g).toBeCloseTo(1 / 15, 4);
  });

  it('gives the tractor four cylinders', () => {
    expect(TRACTOR_SPEC.vibration.firingsPerCycle).toBe(4);
  });
});

describe('steadiness', () => {
  // Runs the model with a real random source and returns the spread of the body's roll over a steady run.
  function rollSpread(steadiness, seed) {
    let a = seed;
    const random = () => ((a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const v = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS, firingsPerCycle: 4, directionJitter: 0.6, steadiness }, { random });
    const dt = 1 / 60;
    const period = 120 / 490;
    let next = 0;
    const peaks = [];
    for (let now = 0; now < 20; now += dt) {
      const pulses = [];
      while (next < now + dt) {
        pulses.push({ t: next - now, type: 'fire', strength: 1, period });
        next += period;
      }
      v.update(dt, { rpm: 490, roughness: 0, pulses });
      if (now > 5) peaks.push(Math.abs(v.body.roll));
    }
    const mean = peaks.reduce((x, y) => x + y, 0) / peaks.length;
    return Math.sqrt(peaks.reduce((x, y) => x + (y - mean) ** 2, 0) / peaks.length) / mean;
  }

  it('makes the shake far more regular than the random default', () => {
    expect(rollSpread(0.85, 3)).toBeLessThan(rollSpread(0, 3) * 0.6);
  });

  it('is on for the Land Rover and off for the quads', async () => {
    const { TOR_SPEC, UTV_SPEC } = await import('../src/vehicle/quadSpecs.js');
    expect(TOR_SPEC.vibration.steadiness).toBeGreaterThan(0.5);
    expect(UTV_SPEC.vibration.steadiness).toBeGreaterThan(0.3);
    expect(UTV_SPEC.vibration.steadiness).toBeLessThan(TOR_SPEC.vibration.steadiness);
    expect(DEFAULT_VIBRATION_PARAMS.steadiness).toBe(0);
  });
});
