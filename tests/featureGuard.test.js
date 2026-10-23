import { describe, it, expect } from 'vitest';
import { FeatureGuard } from '../src/core/featureGuard.js';

describe('FeatureGuard', () => {
  it('runs a clean feature and reports it', () => {
    const lines = [];
    const g = new FeatureGuard((l) => lines.push(l));
    let ran = 0;
    expect(g.run('a', () => ran++)).toBe(true);
    expect(ran).toBe(1);
    expect(g.total).toBe(0);
    expect(lines).toEqual([]);
  });

  it('catches an error, logs it once with the name, and counts the repeats', () => {
    const lines = [];
    const g = new FeatureGuard((l) => lines.push(l));
    for (let i = 0; i < 5; i++) expect(g.run('naps', () => { throw new Error(`bad ${i}`); })).toBe(false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('naps threw');
    expect(lines[0]).toContain('bad 0');
    expect(g.total).toBe(5);
    expect(g.summary()).toEqual([{ name: 'naps', count: 5, message: 'bad 4' }]);
  });

  it('logs each feature separately and lists the worst first', () => {
    const lines = [];
    const g = new FeatureGuard((l) => lines.push(l));
    g.run('a', () => { throw new Error('x'); });
    g.run('b', () => { throw new Error('y'); });
    g.run('b', () => { throw new Error('y'); });
    expect(lines).toHaveLength(2);
    expect(g.summary().map((s) => s.name)).toEqual(['b', 'a']);
  });

  it('lets later features run after an earlier one throws', () => {
    const g = new FeatureGuard(() => {});
    const order = [];
    g.run('one', () => { order.push(1); throw new Error('no'); });
    g.run('two', () => order.push(2));
    expect(order).toEqual([1, 2]);
  });

  it('copes with a thrown non-error and with clearing', () => {
    const g = new FeatureGuard(() => {});
    g.run('s', () => { throw 'oops'; });
    expect(g.summary()[0].message).toBe('oops');
    g.clear();
    expect(g.total).toBe(0);
  });
});

describe('FeatureGuard timing (#364)', () => {
  const clocked = () => {
    let now = 0;
    const g = new FeatureGuard(() => {}, () => now, 0);
    return { g, tick: (ms) => { now += ms; } };
  };

  it('times each feature, adds up one run twice in a frame, and lists the slowest first', () => {
    const { g, tick } = clocked();
    g.run('cheap', () => tick(0.5));
    g.run('dear', () => tick(3));
    g.run('dear', () => tick(2));
    g.endFrame();
    expect(g.slowest(5)).toEqual([{ name: 'dear', ms: 5 }, { name: 'cheap', ms: 0.5 }]);
    expect(g.slowest(1)).toHaveLength(1);
    expect(g.totalMs).toBeCloseTo(5.5, 5);
  });

  it('times a feature that throws, and still counts the error', () => {
    const { g, tick } = clocked();
    g.run('bad', () => { tick(4); throw new Error('no'); });
    g.endFrame();
    expect(g.slowest()[0]).toEqual({ name: 'bad', ms: 4 });
    expect(g.total).toBe(1);
  });

  it('smooths across frames, and a feature that stops running fades', () => {
    let now = 0;
    const g = new FeatureGuard(() => {}, () => now, 0.5);
    g.run('a', () => { now += 4; });
    g.endFrame();
    g.run('a', () => { now += 8; });
    g.endFrame();
    expect(g.ms.get('a')).toBeCloseTo(6, 5);
    g.endFrame();
    expect(g.ms.get('a')).toBeCloseTo(3, 5);
  });
});
