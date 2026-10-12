import { describe, it, expect } from 'vitest';
import { FrameStats } from '../src/core/frameStats.js';

describe('frame stats', () => {
  it('counts the frames of the last second and averages their work', () => {
    const s = new FrameStats();
    for (let i = 0; i < 120; i++) s.record(i / 60, i < 60 ? 20 : 4); // two seconds: a slow one, then a quick one
    const { fps, ms, worstMs } = s.summary();
    expect(fps).toBe(60);
    expect(ms).toBeCloseTo(4);
    expect(worstMs).toBe(4);
  });

  it('says nothing before any frame', () => {
    expect(new FrameStats().summary()).toEqual({ fps: 0, ms: 0, worstMs: 0 });
  });
});
