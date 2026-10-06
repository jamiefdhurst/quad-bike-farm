import { describe, it, expect } from 'vitest';
import { TorqueRock, DEFAULT_TORQUE_PARAMS as P } from '../src/vibration/torqueRock.js';
import { VibrationModel } from '../src/vibration/vibrationModel.js';
import { DEFAULT_VIBRATION_PARAMS } from '../src/vibration/vibrationParams.js';
import { AMY_REVOFF_LINES, JESS_REVOFF_LINES } from '../src/npc/revOffLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

const run = (t, steps, throttleAt, active = true) => {
  let total = 0;
  for (let i = 0; i < steps; i++) total += t.update(1 / 60, throttleAt(i), active, P);
  return total;
};

describe('torque rock', () => {
  it('kicks the body one way on a sharp blip', () => {
    const kick = run(new TorqueRock(), 30, (i) => (i < 5 ? 0 : 1));
    expect(kick).toBeLessThan(-P.torqueGain * 0.5);
    expect(kick).toBeGreaterThanOrEqual(-P.torqueGain);
  });

  it('only counts it once for a throttle that stays open, and again after letting go', () => {
    const t = new TorqueRock();
    run(t, 10, (i) => (i < 2 ? 0 : 1));
    expect(run(t, 60, () => 1)).toBe(0);
    run(t, 60, () => 0);
    expect(run(t, 20, () => 1)).toBeLessThan(0);
  });

  it('ignores a gentle rise, a stopped engine and a quad that is moving off', () => {
    expect(run(new TorqueRock(), 120, (i) => i / 120)).toBe(0);
    expect(run(new TorqueRock(), 30, (i) => (i < 5 ? 0 : 1), false)).toBe(0);
  });

  it('shows up as a slow sway of the body and a little of it in the head', () => {
    const v = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS }, { random: () => 0.5 });
    const quiet = { rpm: 0, roughness: 0, pulses: [] };
    v.torqueKick(-P.torqueGain);
    let peak = 0;
    let cam = 0;
    for (let i = 0; i < 120; i++) {
      v.update(1 / 60, quiet);
      peak = Math.max(peak, Math.abs(v.body.roll));
      cam = Math.max(cam, Math.abs(v.camera.roll));
    }
    expect(peak).toBeGreaterThan(0.03); // about two degrees or more
    expect(peak).toBeLessThan(0.15);
    expect(cam).toBeGreaterThan(0);
    expect(Math.abs(v.body.roll)).toBeLessThan(peak * 0.3); // and it settles
  });

  it('has the lines the girls say for it', () => {
    for (const k of ['rockPrank', 'rockPrankAmy']) expect(VOICE_LINES[k]?.lines.length).toBeGreaterThan(0);
    expect(JESS_REVOFF_LINES.rockPrank.length).toBeGreaterThan(0);
    expect(AMY_REVOFF_LINES.rockPrankAmy.lines.length).toBeGreaterThan(0);
  });
});
