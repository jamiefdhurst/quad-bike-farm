import { describe, it, expect } from 'vitest';
import { StreamLevel, DEFAULT_STREAM_PARAMS, STREAM_PARAM_RANGES } from '../src/world/streamLevel.js';
import { LAYOUT } from '../src/world/layout.js';
import { createHill } from '../src/world/hill.js';

describe('the stream level', () => {
  it('rises in rain, calls "up" once, and falls back slowly when dry', () => {
    const s = new StreamLevel();
    const events = [];
    for (let t = 0; t < 600; t += 1) {
      const e = s.update(1, 0.85);
      if (e) events.push(e);
    }
    expect(events).toEqual(['up']);
    expect(s.level).toBeGreaterThan(0.9);
    for (let t = 0; t < 3000; t += 1) {
      const e = s.update(1, 0);
      if (e) events.push(e);
    }
    expect(events).toEqual(['up', 'down']);
    expect(s.level).toBe(0);
  });

  it('lags the rain and ignores a drizzle', () => {
    const s = new StreamLevel();
    s.update(10, 0.85);
    expect(s.level).toBeLessThan(0.1);
    const d = new StreamLevel();
    d.update(1000, DEFAULT_STREAM_PARAMS.rainFrom - 0.01);
    expect(d.level).toBe(0);
  });

  it('runs faster, stands higher and gulps more the fuller it is', () => {
    const s = new StreamLevel();
    const low = { rise: s.rise, flow: s.flow };
    expect(s.gulp).toBe(1);
    s.set(1);
    expect(s.rise).toBeCloseTo(DEFAULT_STREAM_PARAMS.floodRise);
    expect(s.rise).toBeGreaterThan(low.rise);
    expect(s.flow).toBeGreaterThan(low.flow);
    expect(s.gulp).toBeCloseTo(DEFAULT_STREAM_PARAMS.gulpHigh);
  });

  it('starts part-way up on wet ground, and not at all on dry', () => {
    const s = new StreamLevel();
    s.start(0);
    expect(s.level).toBe(0);
    s.start(1);
    expect(s.level).toBeCloseTo(DEFAULT_STREAM_PARAMS.startWet);
    expect(s.up).toBe(true);
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(STREAM_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_STREAM_PARAMS).sort());
  });
});

describe('the hill water with the stream up', () => {
  const hill = createHill(LAYOUT);
  const x = LAYOUT.hill.lane.x;
  const z = hill.streamZ(x);

  it('is deeper at the ford and no narrower when it is up, and back when it drops', () => {
    const depth = hill.waterDepthAt(x);
    const edge = z + hill.halfAt(x) * 0.8;
    const before = hill.waterAt(x, edge);
    hill.setRise(0.2);
    expect(hill.waterDepthAt(x)).toBeCloseTo(depth + 0.2);
    expect(hill.waterAt(x, edge)).toBeGreaterThanOrEqual(before);
    expect(hill.waterAt(x, z)).toBe(1);
    hill.setRise(0);
    expect(hill.waterDepthAt(x)).toBeCloseTo(depth);
  });

  it('keeps the highest water inside the ford channel', () => {
    const { stream } = LAYOUT.hill;
    expect(stream.water * (stream.ford.depth / stream.depth) + DEFAULT_STREAM_PARAMS.floodRise).toBeLessThan(stream.ford.depth);
  });
});
