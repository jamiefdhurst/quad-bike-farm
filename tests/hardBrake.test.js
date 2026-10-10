import { describe, it, expect } from 'vitest';
import { HardBrake } from '../src/npc/hardBrake.js';

const P = { voiceHardBrakeDecel: 6, voiceHardBrakeTime: 0.4, voiceHardBrakeShed: 2.5, voiceHardBrakeMinSpeed: 4 };
const dt = 1 / 60;

/** Slow at `decel` from `speed` for `seconds`; whether it counted as hard braking. */
function brake(hb, speed, decel, seconds) {
  let fired = false;
  for (let t = 0; t < seconds - 1e-9 && speed > 0; t += dt) {
    speed = Math.max(0, speed - decel * dt);
    fired = hb.update(dt, decel, speed, P) || fired;
  }
  return fired;
}

describe('HardBrake', () => {
  it('ignores a quick dab, however sharp', () => {
    expect(brake(new HardBrake(), 10, 9, 0.25)).toBe(false);
  });

  it('counts a long hard stop', () => {
    expect(brake(new HardBrake(), 10, 8, 1)).toBe(true);
  });

  it('ignores steady gentle braking', () => {
    expect(brake(new HardBrake(), 10, 4, 2)).toBe(false);
  });

  it('ignores hard braking from walking pace', () => {
    expect(brake(new HardBrake(), 3.5, 8, 1)).toBe(false);
  });

  it('wants the speed shed, not only the time', () => {
    expect(brake(new HardBrake(), 10, 6.5, 0.38)).toBe(false); // about 2.5 m/s off but not long enough
    expect(brake(new HardBrake(), 10, 6.5, 0.45)).toBe(true);
  });

  it('counts once per stop, and again after easing off', () => {
    const hb = new HardBrake();
    expect(brake(hb, 12, 8, 0.6)).toBe(true);
    expect(brake(hb, 7, 8, 0.4)).toBe(false); // the same stop carrying on
    hb.update(dt, 0, 7, P);
    expect(brake(hb, 12, 8, 0.6)).toBe(true);
  });
});
