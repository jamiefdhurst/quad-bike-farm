import { describe, it, expect } from 'vitest';
import { FrameBreakdown } from '../src/core/frameBreakdown.js';

const frame = (b, t0, laps) => {
  b.begin(t0);
  let t = t0;
  for (const [name, ms] of laps) b.lap(name, (t += ms));
  b.end();
};

describe('the frame breakdown', () => {
  it('times each stage from the one before', () => {
    const b = new FrameBreakdown(0);
    frame(b, 100, [['physics', 2], ['girls', 3], ['render', 5]]);
    expect(b.summary().map((s) => [s.name, s.ms])).toEqual([['physics', 2], ['girls', 3], ['render', 5]]);
    expect(b.total).toBe(10);
    expect(b.biggest).toBe('render');
    expect(b.summary()[2].share).toBeCloseTo(0.5, 5);
  });

  it('adds up a stage lapped twice in a frame', () => {
    const b = new FrameBreakdown(0);
    frame(b, 0, [['a', 1], ['b', 1], ['a', 2]]);
    expect(b.ms.get('a')).toBe(3);
  });

  it('smooths a spike and keeps the worst', () => {
    const b = new FrameBreakdown(0.9);
    for (let i = 0; i < 50; i++) frame(b, 0, [['girls', 1]]);
    frame(b, 0, [['girls', 11]]);
    expect(b.ms.get('girls')).toBeCloseTo(2, 0);
    expect(b.worst.get('girls')).toBe(11);
  });

  it('is empty before any frame', () => {
    const b = new FrameBreakdown();
    expect(b.summary()).toEqual([]);
    expect(b.biggest).toBeNull();
  });
});

describe('the stage list', () => {
  it('has a name for every stage the game laps, and a readable line', async () => {
    const { FRAME_STAGES, stageText } = await import('../src/core/frameBreakdown.js');
    const fs = await import('node:fs');
    const game = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
    const lapped = [...game.matchAll(/fb\.lap\('([^']+)'/g)].map((m) => m[1]);
    expect(FRAME_STAGES.map((s) => s[0])).toEqual(lapped);
    expect(stageText({ ms: 2.314, share: 0.236, worst: 6.12 })).toBe('2.31 ms (24%), worst 6.1');
    expect(stageText(undefined)).toBe('-');
  });
});
