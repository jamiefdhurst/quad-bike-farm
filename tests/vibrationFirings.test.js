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
