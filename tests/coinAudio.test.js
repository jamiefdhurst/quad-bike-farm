import { describe, it, expect } from 'vitest';
import { chinkSamples } from '../src/audio/coinAudio.js';

describe('the coin chink', () => {
  const s = chinkSamples(44100);

  it('is about half a second of real, bounded sound', () => {
    expect(s.length).toBeGreaterThan(44100 * 0.4);
    expect(s.length).toBeLessThan(44100 * 0.7);
    expect(s.every(Number.isFinite)).toBe(true);
    expect(Math.max(...s.map(Math.abs))).toBeGreaterThan(0.1);
    expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('dies away by the end', () => {
    const tail = s.slice(-2000);
    expect(Math.max(...tail.map(Math.abs))).toBeLessThan(0.01);
  });

  it('is the same every time', () => {
    expect(Array.from(chinkSamples(44100).slice(0, 500))).toEqual(Array.from(s.slice(0, 500)));
  });
});
