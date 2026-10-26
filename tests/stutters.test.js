import { describe, it, expect } from 'vitest';
import { HeapWatch, StutterLog, StutterWatch, causeOfLongFrame } from '../src/core/stutters.js';
import { FrameStats, LONG_FRAME_MS } from '../src/core/frameStats.js';

const MB = 1024 * 1024;
const stages = (o) => new Map(Object.entries(o));

describe('the 1% low and long frames', () => {
  it('counts frames over 33 ms and gives the 1% low over the longer window', () => {
    const s = new FrameStats();
    for (let i = 0; i < 300; i++) s.record(i / 60, i % 100 === 0 ? 45 : 5);
    const r = s.summary();
    expect(r.longFrames).toBe(3);
    expect(r.longTotal).toBe(3);
    expect(r.p99Ms).toBe(45);
    expect(r.ms).toBeLessThan(10); // the one-second average hides them
  });

  it('forgets long frames older than the window but keeps the running total', () => {
    const s = new FrameStats();
    s.record(0, 50);
    for (let i = 1; i < 800; i++) s.record(i / 60, 5);
    expect(s.summary().longFrames).toBe(0);
    expect(s.summary().longTotal).toBe(1);
    expect(LONG_FRAME_MS).toBe(33);
  });

  it('looks at only the frames since a time', () => {
    const s = new FrameStats();
    for (let i = 0; i < 100; i++) s.record(i / 100, i < 50 ? 60 : 4);
    expect(s.since(0.5)).toEqual({ p99Ms: 4, longFrames: 0 });
  });
});

describe('naming the cause of a long frame', () => {
  const base = { stages: stages({ physics: 2, drawing: 40 }), features: new Map(), shadersAdded: 0, heapFell: false };
  it('names the stage that took the time', () => expect(causeOfLongFrame(base)).toBe('drawing (40 ms)'));
  it('names the feature when the farm features took it', () => {
    const c = causeOfLongFrame({ ...base, stages: stages({ 'farm features': 38, drawing: 3 }), features: stages({ muck: 30, geese: 2 }) });
    expect(c).toBe('farm features: muck (30 ms)');
  });
  it('says so when no one part took it', () => {
    expect(causeOfLongFrame({ ...base, stages: stages({ a: 10, b: 10, c: 10, d: 10, e: 10 }) })).toMatch(/spread/);
  });
  it('puts a new shader before the stage', () => expect(causeOfLongFrame({ ...base, shadersAdded: 2 })).toMatch(/shader/));
  it('puts a heap drop before the stage', () => expect(causeOfLongFrame({ ...base, heapFell: true })).toBe('memory clean-up'));
});

describe('the heap', () => {
  it('reports falls and the rate of growth without the falls', () => {
    const h = new HeapWatch(5);
    expect(h.sample(0, 100 * MB)).toBe(0);
    expect(h.sample(1, 110 * MB)).toBe(0);
    expect(h.sample(2, 120 * MB)).toBe(0);
    const fell = h.sample(3, 70 * MB);
    expect(fell).toBe(50 * MB);
    expect(h.isCleanUp(fell)).toBe(true);
    expect(h.isCleanUp(0.5 * MB)).toBe(false);
    expect(h.allocMbPerSecond).toBeCloseTo(4); // 20 MB over 5 s
  });
});

describe('the stutter watch', () => {
  const frame = (w, over = {}) => w.frame({ at: 1, ms: 40, stages: stages({ drawing: 38, physics: 2 }), features: new Map(), shaders: 10, ...over });

  it('logs a long frame with its cause, newest first, and ignores a short one', () => {
    const w = new StutterWatch();
    frame(w, { ms: 5 });
    expect(w.log.lines()).toEqual([]);
    frame(w);
    frame(w, { ms: 50, heapBytes: 200 * MB });
    frame(w, { ms: 60, heapBytes: 100 * MB });
    expect(w.log.lines()).toEqual(['60 ms, memory clean-up', '50 ms, drawing (38 ms)', '40 ms, drawing (38 ms)']);
  });

  it('blames a shader when the renderer gained programs that frame, but not on the first frame', () => {
    const w = new StutterWatch();
    frame(w);
    frame(w, { shaders: 12 });
    expect(w.log.lines()[1]).toMatch(/drawing/);
    expect(w.log.lines()[0]).toMatch(/2 new/);
  });

  it('keeps only the last few', () => {
    const w = new StutterWatch();
    for (let i = 0; i < 9; i++) frame(w, { ms: 40 + i });
    expect(w.log.lines().length).toBe(5);
    expect(new StutterLog().lines()).toEqual([]);
  });
});
