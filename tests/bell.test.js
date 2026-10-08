import { describe, it, expect } from 'vitest';
import { BellSwing, bellStrike, DEFAULT_BELL_PARAMS as P, BELL_PARAM_RANGES } from '../src/world/bell.js';
import { AMY_RECALL_LINES, JESS_RECALL_LINES } from '../src/npc/recallLines.js';
import { VOICE_LINES as AMY_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

const run = (bell, seconds, dt = 1 / 60) => {
  const strikes = [];
  for (let t = 0; t < seconds; t += dt) strikes.push(...bell.update(dt));
  return strikes;
};

describe('the bell swinging', () => {
  it('hangs still and silent until you pull the rope', () => {
    const bell = new BellSwing(P);
    expect(run(bell, 2)).toEqual([]);
    expect(bell.ringing).toBe(false);
  });

  it('strikes several times on one pull, each softer, then falls silent', () => {
    const bell = new BellSwing(P);
    bell.ring();
    const strikes = run(bell, 8);
    expect(strikes.length).toBeGreaterThanOrEqual(4);
    expect(strikes.length).toBeLessThanOrEqual(9);
    for (let i = 1; i < strikes.length; i++) expect(strikes[i]).toBeLessThan(strikes[i - 1]);
    expect(bell.ringing).toBe(false);
  });

  it('strikes about twice a swing', () => {
    const bell = new BellSwing(P);
    bell.ring();
    expect(run(bell, P.swingPeriod * 2 + 0.05).length).toBe(4);
  });

  it('keeps ringing longer if you pull again while it swings, but no wider than maxSwing', () => {
    const once = new BellSwing(P);
    once.ring();
    const twice = new BellSwing(P);
    twice.ring();
    run(twice, 0.6);
    twice.ring();
    expect(twice.amplitude).toBeGreaterThan(P.kick);
    for (let i = 0; i < 10; i++) twice.ring();
    expect(twice.amplitude).toBeLessThanOrEqual(P.maxSwing + 1e-9);
    const a = run(once, 10).length;
    const b = run(twice, 10).length;
    expect(b).toBeGreaterThan(a - 2); // twice has 0.6 s of strikes already taken off
  });

  it('is steady with long frames', () => {
    const bell = new BellSwing(P);
    bell.ring();
    run(bell, 6, 0.1);
    expect(Number.isFinite(bell.angle)).toBe(true);
    expect(bell.ringing).toBe(false);
  });
});

describe('the sound of a strike', () => {
  const seq = () => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  };
  const rms = (a, from, to) => Math.sqrt(a.slice(from, to).reduce((sum, v) => sum + v * v, 0) / (to - from));

  it('peaks at 1, is as long as ringSeconds and dies away', () => {
    const sr = 22050;
    const s = bellStrike(sr, P, seq());
    expect(s.length).toBe(Math.floor(sr * P.ringSeconds));
    expect(Math.max(...s.map(Math.abs))).toBeCloseTo(1, 5);
    expect(rms(s, sr * 2, sr * 2.5)).toBeLessThan(rms(s, 0, sr * 0.5) / 3) // the hum lingers longest;
    expect(Math.abs(s[s.length - 1])).toBeLessThan(1e-3);
  });

  it('skips partials above what the sample rate can hold', () => {
    const s = bellStrike(4000, { pitch: 900, ringSeconds: 0.5 }, seq());
    expect(s.every(Number.isFinite)).toBe(true);
  });
});

describe('tuning and lines', () => {
  it('has a range for every tunable, holding its default', () => {
    for (const [k, v] of Object.entries(P)) {
      const [min, max] = BELL_PARAM_RANGES[k];
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });

  it('gives both girls the bell lines', () => {
    for (const key of Object.keys(AMY_RECALL_LINES)) expect(AMY_LINES[key]).toBeTruthy();
    for (const key of Object.keys(JESS_RECALL_LINES)) expect(JESS_LINES[key]).toBeTruthy();
    expect(Object.keys(AMY_RECALL_LINES)).toEqual(Object.keys(JESS_RECALL_LINES));
  });
});
