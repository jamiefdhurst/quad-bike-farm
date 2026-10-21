import { describe, it, expect } from 'vitest';
import { LogSplitter, LogStack, DEFAULT_SPLITTER_PARAMS as P, SPLITTER_PARAM_RANGES, splitterPowered, stackSlot, STACK_SHAPE } from '../src/items/logSplitter.js';
import { LAYOUT } from '../src/world/layout.js';
import { FARM_JOBS, availableJobs } from '../src/world/farmJobs.js';

function push(sp, seconds, opts = {}) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...sp.update(0.05, { push: true, powered: true, ...opts }));
  return events;
}

describe('the ram', () => {
  it('goes out while E is held and comes back when it is let go', () => {
    const sp = new LogSplitter({ ...P });
    push(sp, 2);
    const out = sp.ram;
    expect(out).toBeGreaterThan(0.3);
    for (let t = 0; t < 1; t += 0.05) sp.update(0.05, { push: false, powered: true });
    expect(sp.ram).toBeLessThan(out);
    for (let t = 0; t < 5; t += 0.05) sp.update(0.05, { push: false, powered: true });
    expect(sp.ram).toBe(0);
  });

  it('does nothing without power, and stays where it is if the engine dies', () => {
    const sp = new LogSplitter({ ...P });
    push(sp, 3, { powered: false });
    expect(sp.ram).toBe(0);
    push(sp, 2);
    const at = sp.ram;
    sp.update(1, { push: false, powered: false });
    expect(sp.ram).toBe(at);
    expect(sp.load).toBe(0);
  });

  it('splits a round that is on the beam, once, and tells the game', () => {
    const sp = new LogSplitter({ ...P });
    expect(sp.putOn(false)).toBe(true);
    const events = push(sp, P.outSeconds + 1);
    expect(events.filter((e) => e.type === 'split')).toHaveLength(1);
    expect(sp.loaded).toBe(false);
  });

  it('runs empty without splitting anything', () => {
    const sp = new LogSplitter({ ...P });
    expect(push(sp, P.outSeconds + 1)).toEqual([]);
  });

  it('takes a round only with the ram back and the beam empty', () => {
    const sp = new LogSplitter({ ...P });
    expect(sp.putOn()).toBe(true);
    expect(sp.putOn()).toBe(false);
    const other = new LogSplitter({ ...P });
    push(other, 1);
    expect(other.canLoad()).toBe(false);
  });

  it('takes longer through a gnarled round', () => {
    const time = (gnarled) => {
      const sp = new LogSplitter({ ...P });
      sp.putOn(gnarled);
      let t = 0;
      while (!sp.update(0.05, { push: true, powered: true }).length && t < 60) t += 0.05;
      return t;
    };
    expect(time(true)).toBeGreaterThan(time(false) + 0.2);
  });

  it('asks the engine for most when it is pushing through a round, and the pump alone otherwise', () => {
    const sp = new LogSplitter({ ...P });
    sp.putOn(false);
    let peak = 0;
    let early = 0;
    for (let t = 0; t < P.outSeconds; t += 0.05) {
      sp.update(0.05, { push: true, powered: true });
      if (sp.ram < P.pressAt - 0.05) early = Math.max(early, sp.load);
      peak = Math.max(peak, sp.load);
    }
    expect(early).toBe(P.moveLoad);
    expect(peak).toBe(P.pressLoad);
    expect(P.pressLoad).toBeGreaterThan(P.moveLoad);
  });

  it('has a press that starts before it splits, and every tunable has a range', () => {
    expect(P.pressAt).toBeLessThan(P.splitAt);
    for (const k of Object.keys(P)) {
      const [min, max] = SPLITTER_PARAM_RANGES[k];
      expect(P[k]).toBeGreaterThanOrEqual(min);
      expect(P[k]).toBeLessThanOrEqual(max);
    }
  });
});

describe('when the tractor can run it', () => {
  it('needs the engine running, held, and standing', () => {
    expect(splitterPowered({ running: true, parkBrake: true, gear: 2, speed: 0 })).toBe(true);
    expect(splitterPowered({ running: true, parkBrake: false, gear: 0, speed: 0 })).toBe(true);
    expect(splitterPowered({ running: true, parkBrake: false, gear: 2, speed: 0 })).toBe(false);
    expect(splitterPowered({ running: false, parkBrake: true, gear: 0, speed: 0 })).toBe(false);
    expect(splitterPowered({ running: true, parkBrake: true, gear: 0, speed: 1 })).toBe(false);
  });
});

describe('the stack', () => {
  it('fills to its capacity and no further', () => {
    const st = new LogStack({ ...P, capacity: 4 });
    for (let i = 0; i < 4; i++) expect(st.add()).toBe(i);
    expect(st.full).toBe(true);
    expect(st.add()).toBe(-1);
  });

  it('counts the job from where the stack stood when it went on the board', () => {
    const st = new LogStack({ ...P, logsNeeded: 3 });
    st.add();
    st.startJob();
    st.add();
    st.add();
    expect(st.jobComplete).toBe(false);
    st.add();
    expect(st.jobComplete).toBe(true);
  });

  it('is only on the board if the job fits', () => {
    const st = new LogStack({ ...P, capacity: 12, logsNeeded: 8 });
    expect(st.roomForJob()).toBe(true);
    for (let i = 0; i < 5; i++) st.add();
    expect(st.roomForJob()).toBe(false);
  });

  it('burns some between days, and keeps the rest', () => {
    const st = new LogStack({ ...P, burnPerDay: 6 });
    st.restore({ count: 20, day: 3 }, 3);
    expect(st.count).toBe(20);
    st.restore({ count: 20, day: 3 }, 5);
    expect(st.count).toBe(8);
    st.restore({ count: 5, day: 1 }, 9);
    expect(st.count).toBe(0);
    st.restore(undefined, 2);
    expect(st.count).toBe(0);
    st.restore({ count: 9999, day: 2 }, 2);
    expect(st.count).toBe(P.capacity);
  });

  it('lays logs side by side in layers that fit inside the stack, none on top of another', () => {
    const seen = new Set();
    for (let i = 0; i < P.capacity; i++) {
      const s = stackSlot(i);
      const key = `${s.x.toFixed(3)},${s.y.toFixed(3)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(Math.abs(s.x)).toBeLessThan((STACK_SHAPE.perLayer * STACK_SHAPE.spacing) / 2 + 0.2);
    }
    expect(stackSlot(STACK_SHAPE.perLayer).y).toBeGreaterThan(0);
  });
});

describe('the wood by the gate', () => {
  it('is on the grass field, clear of the track and of the wood\'s gate', () => {
    const y = LAYOUT.logYard;
    const pts = [...y.piles.map(([x, z]) => ({ x, z })), y.park, y.stack];
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThan(LAYOUT.fieldHalf - 4);
      expect(p.z).toBeGreaterThan(-LAYOUT.fieldHalf + 2);
      expect(Math.hypot(p.x - LAYOUT.woods.gate.x, p.z + 80)).toBeGreaterThan(6);
      for (const [tx, tz] of LAYOUT.trackPoints) expect(Math.hypot(p.x - tx, p.z - tz)).toBeGreaterThan(12);
    }
  });

  it('puts the log job on the board for a farm that has it, and not for one that has not', () => {
    expect(FARM_JOBS.logs.needs).toBe('logYard');
    expect(availableJobs(LAYOUT)).toContain('logs');
    const { logYard, ...without } = LAYOUT;
    expect(availableJobs(without)).not.toContain('logs');
  });
});
