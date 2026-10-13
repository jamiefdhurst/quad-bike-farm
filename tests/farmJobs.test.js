import { describe, it, expect } from 'vitest';
import { MuckLoad, DEFAULT_MUCK_PARAMS, MUCK_PARAM_RANGES, distanceToHeap, JobBoard, availableJobs, pickJobs, FARM_JOBS } from '../src/world/farmJobs.js';

const heap = { x: 0, z: 0, halfX: 3, halfZ: 2 };
const ride = (m, seconds, s, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) {
    s.x += s.speed * dt;
    events.push(...m.update(dt, s));
  }
  return events;
};

describe('muck load', () => {
  it('every tunable has a range', () => {
    expect(Object.keys(MUCK_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_MUCK_PARAMS).sort());
  });

  it('measures the distance to the heap from its edge', () => {
    expect(distanceToHeap(heap, 1, 1)).toBe(0);
    expect(distanceToHeap(heap, 8, 0)).toBe(5);
  });

  it('forks only with the tub down and the trailer close', () => {
    const m = new MuckLoad();
    expect(m.canFork(heap, 6, 0, 0)).toBe(true);
    expect(m.canFork(heap, 12, 0, 0)).toBe(false);
    expect(m.canFork(heap, 6, 0, 0.5)).toBe(false);
  });

  it('fills over forkSeconds, says start once and full once', () => {
    const m = new MuckLoad();
    const events = [];
    for (let i = 0; i < 200; i++) events.push(...m.fork(0.1));
    expect(events.map((e) => e.type)).toEqual(['start', 'full']);
    expect(m.full).toBe(true);
    expect(m.canFork(heap, 0, 0, 0)).toBe(false);
  });

  it('lays patches on stubble while driven slowly with the tub raised, then is done', () => {
    const m = new MuckLoad();
    m.fork(100);
    const s = { x: 0, z: 0, speed: 1.2, tip: 0.4, slideAt: 0.5, onStubble: true };
    const events = ride(m, 60, s);
    const types = events.map((e) => e.type);
    expect(types.filter((t) => t === 'patch').length).toBe(DEFAULT_MUCK_PARAMS.patchesPerLoad);
    expect(types).toContain('done');
    expect(m.empty).toBe(true);
    expect(m.done).toBe(true);
  });

  it('lays nothing with the tub down, too fast or too slow', () => {
    for (const change of [{ tip: 0.1 }, { speed: 3 }, { speed: 0.1 }]) {
      const m = new MuckLoad();
      m.fork(100);
      ride(m, 30, { x: 0, z: 0, speed: 1.2, tip: 0.4, slideAt: 0.5, onStubble: true, ...change });
      expect(m.full).toBe(true);
    }
  });

  it('wastes muck off the stubble without counting it', () => {
    const m = new MuckLoad();
    m.fork(100);
    const events = ride(m, 60, { x: 0, z: 0, speed: 1.2, tip: 0.4, slideAt: 0.5, onStubble: false });
    expect(events.some((e) => e.type === 'wrong')).toBe(true);
    expect(m.laid).toBe(0);
    expect(m.done).toBe(false);
  });

  it('slides it all out in a heap if the tub goes right up standing still', () => {
    const m = new MuckLoad();
    m.fork(100);
    const events = m.update(0.1, { x: 1, z: 2, speed: 0, tip: 0.8, slideAt: 0.5, onStubble: true });
    expect(events).toEqual([{ type: 'pile', x: 1, z: 2 }]);
    expect(m.empty).toBe(true);
    expect(m.laid).toBe(0);
  });

  it('a new job starts afresh', () => {
    const m = new MuckLoad();
    m.fork(100);
    ride(m, 60, { x: 0, z: 0, speed: 1.2, tip: 0.4, slideAt: 0.5, onStubble: true });
    expect(m.done).toBe(true);
    expect(m.fork(0.1)[0].type).toBe('start');
    expect(m.done).toBe(false);
    expect(m.laid).toBe(0);
  });
});

describe('job board', () => {
  it('leaves off jobs the farm cannot do', () => {
    expect(availableJobs({ muckHeap: {} })).toEqual(['muck']);
    expect(availableJobs({})).toEqual([]);
  });

  it('picks no more than there are, without repeats', () => {
    expect(pickJobs(['a', 'b', 'c'], 2, () => 0.5)).toHaveLength(2);
    expect(new Set(pickJobs(['a', 'b', 'c'], 3, Math.random)).size).toBe(3);
    expect(pickJobs(['a'], 2, Math.random)).toEqual(['a']);
  });

  it('ticks jobs off once and clears when all are done', () => {
    const b = new JobBoard({ ids: ['muck'], random: () => 0 });
    expect(b.cleared).toBe(false);
    expect(b.complete('muck')).toBe(true);
    expect(b.complete('muck')).toBe(false);
    expect(b.cleared).toBe(true);
    expect(b.lines()).toEqual([{ id: 'muck', text: FARM_JOBS.muck.chalk, hint: FARM_JOBS.muck.hint, done: true }]);
  });

  it('ignores jobs not on the board', () => {
    const b = new JobBoard({ ids: [], random: () => 0 });
    expect(b.complete('muck')).toBe(false);
    expect(b.cleared).toBe(false);
  });
});

describe('the silage job', () => {
  it('is on offer on a farm with a Dutch barn, and not without one', async () => {
    const { availableJobs } = await import('../src/world/farmJobs.js');
    expect(availableJobs({ muckHeap: {}, dutchBarn: {} })).toContain('silage');
    expect(availableJobs({ muckHeap: {} })).not.toContain('silage');
  });
});
