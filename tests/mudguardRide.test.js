import { describe, it, expect } from 'vitest';
import { MudguardRide, DEFAULT_MUDGUARD_PARAMS as P } from '../src/npc/mudguardRide.js';

const girl = (id, over = {}) => ({ id, free: true, aboard: false, dist: 10, ...over });
const ctx = (over = {}) => ({ active: true, riding: true, trailer: false, speed: 0, girls: [girl('amy'), girl('jess')], ...over });
const make = (random = () => 0.1, over = {}) => new MudguardRide({ ...P, ...over }, random);

function run(m, seconds, c) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.1) events.push(...m.update(0.1, typeof c === 'function' ? c(t) : c));
  return events;
}

describe('getting up', () => {
  it('sends one girl over once you are stopped with it running, after a short wait', () => {
    const m = make();
    expect(run(m, 1, ctx()).filter((e) => e.type === 'board')).toEqual([]);
    const boards = run(m, 8, ctx()).filter((e) => e.type === 'board');
    expect(boards).toHaveLength(1);
  });

  it('rolls a stop once: a low chance roll means nobody comes, however long you wait', () => {
    expect(run(make(() => 0.99), 30, ctx())).toEqual([]);
  });

  it('rolls again after you have been moving', () => {
    const m = make(() => 0.99);
    run(m, 5, ctx());
    run(m, 1, ctx({ speed: 3 }));
    let n = 0;
    const r = make(() => (n++ === 0 ? 0.99 : 0.1)); // first stop says no, the second says yes
    run(r, 2, ctx());
    run(r, 1, ctx({ speed: 3 }));
    expect(run(r, 8, ctx()).filter((e) => e.type === 'board')).toHaveLength(1);
  });

  it('does nothing with the engine off, with a trailer on, while moving, or with nobody free and near', () => {
    expect(run(make(), 10, ctx({ active: false }))).toEqual([]);
    expect(run(make(), 10, ctx({ trailer: true }))).toEqual([]);
    expect(run(make(), 10, ctx({ speed: 2 }))).toEqual([]);
    expect(run(make(), 10, ctx({ girls: [girl('amy', { free: false }), girl('jess', { dist: P.boardRange + 5 })] }))).toEqual([]);
  });

  it('takes the only free girl whoever she is, and does not add a second above the limit', () => {
    const lone = run(make(), 8, ctx({ girls: [girl('amy', { free: false }), girl('jess')] })).filter((e) => e.type === 'board');
    expect(lone.map((e) => e.girl)).toEqual(['jess']);
    const full = run(make(), 8, ctx({ girls: [girl('amy', { aboard: true, free: false }), girl('jess')] }));
    expect(full.filter((e) => e.type === 'board')).toEqual([]);
  });
});

describe('up there', () => {
  const up = (over = {}) => ctx({ speed: 3, girls: [girl('amy', { aboard: true, free: false }), girl('jess')], ...over });

  it('shouts across at you now and then while it is moving', () => {
    const shouts = run(make(), 120, up()).filter((e) => e.type === 'shout');
    expect(shouts.length).toBeGreaterThanOrEqual(3);
    expect(shouts.every((e) => e.girl === 'amy')).toBe(true);
  });

  it('keeps quiet when it is standing still', () => {
    expect(run(make(), 120, up({ speed: 0 })).filter((e) => e.type === 'shout')).toEqual([]);
  });
});

describe('boredom', () => {
  it('gets bored and climbs down after her own stay, asked up or not', () => {
    for (const asked of [false, true]) {
      const m = make(() => 0.5);
      if (asked) m.ask('amy');
      const c = ctx({ speed: 3, girls: [girl('amy', { aboard: true, free: false })] });
      const stay = (P.stayMin + P.stayMax) / 2;
      expect(run(m, stay - 5, c).filter((e) => e.type === 'leave')).toEqual([]);
      const leaves = run(m, 10, c).filter((e) => e.type === 'leave');
      expect(leaves.length).toBeGreaterThan(0);
      expect(leaves[0].bored).toBe(true);
    }
  });

  it('gets bored with you off the tractor, if you asked her up', () => {
    const m = make(() => 0.5);
    m.ask('amy');
    const c = ctx({ riding: false, active: false, girls: [girl('amy', { aboard: true, free: false })] });
    expect(run(m, P.stayMax + 5, c).some((e) => e.type === 'leave' && e.bored)).toBe(true);
  });

  it('starts counting afresh the next time she goes up', () => {
    const m = make(() => 0.5);
    const up = ctx({ speed: 3, girls: [girl('amy', { aboard: true, free: false })] });
    run(m, 100, up);
    run(m, 1, ctx({ speed: 3 })); // she's down
    expect(run(m, 100, up).filter((e) => e.type === 'leave')).toEqual([]);
  });
});

describe('getting down', () => {
  it('climbs down after a short wait when you get off, or put a trailer on', () => {
    for (const over of [{ riding: false }, { trailer: true }]) {
      const m = make();
      const events = run(m, P.leaveDelayMax + 1, ctx({ ...over, girls: [girl('amy', { aboard: true, free: false })] }));
      expect([...new Set(events.filter((e) => e.type === 'leave').map((e) => e.girl))]).toEqual(['amy']); // repeats until the game takes her down
    }
  });

  it('keeps a girl you asked up there, with you off the tractor, until a trailer goes on', () => {
    const m = make();
    m.ask('amy');
    const c = { riding: false, active: false, girls: [girl('amy', { aboard: true, free: false })] };
    expect(run(m, 20, ctx(c)).filter((e) => e.type === 'leave')).toEqual([]);
    expect(run(m, 3, ctx({ ...c, trailer: true })).filter((e) => e.type === 'leave').length).toBeGreaterThan(0);
  });

  it('stays up with the engine off while you are still on it', () => {
    const events = run(make(), 20, ctx({ active: false, girls: [girl('amy', { aboard: true, free: false })] }));
    expect(events.filter((e) => e.type === 'leave')).toEqual([]);
  });
});

describe('a girl driving the tractor', () => {
  const driven = (over = {}) => ctx({ active: false, riding: false, drivenBy: 'jess', settingOff: true, ...over });

  it('may have her friend hop up on the arch as she gets going, quickly enough to beat her setting off', () => {
    const boards = run(make(), 4, driven()).filter((e) => e.type === 'board');
    expect(boards).toEqual([{ type: 'board', girl: 'amy', join: true }]);
  });

  it('never sends the driver up beside herself', () => {
    const c = driven({ girls: [girl('jess', { free: false })] });
    expect(run(make(), 10, c)).toEqual([]);
  });

  it('rolls once per go: a no means no, however long she takes', () => {
    expect(run(make(() => 0.99), 30, driven())).toEqual([]);
  });

  it('waits for the tractor to be stopped and for the driver to be getting going', () => {
    expect(run(make(), 6, driven({ speed: 2 }))).toEqual([]);
    expect(run(make(), 6, driven({ settingOff: false }))).toEqual([]);
  });

  it('does not send her with a trailer on or the arch taken', () => {
    expect(run(make(), 6, driven({ trailer: true }))).toEqual([]);
    expect(run(make(), 6, driven({ girls: [girl('jess'), girl('amy', { aboard: true })] })).filter((e) => e.type === 'board')).toEqual([]);
  });

  it('keeps her up there while the go lasts, and takes her down once it is over', () => {
    const m = make();
    const aboard = [girl('jess'), girl('amy', { aboard: true, free: false })];
    expect(run(m, 5, driven({ girls: aboard, settingOff: false, speed: 3 })).filter((e) => e.type === 'leave')).toEqual([]);
    const after = run(m, 3, ctx({ riding: false, active: false, drivenBy: null, girls: aboard })).filter((e) => e.type === 'leave');
    expect(new Set(after.map((e) => e.girl))).toEqual(new Set(['amy'])); // repeated until the game has her down
  });

  it('rolls again on the next go', () => {
    const m = make();
    expect(run(m, 4, driven()).filter((e) => e.type === 'board')).toHaveLength(1);
    run(m, 1, driven({ drivenBy: null }));
    expect(run(m, 4, driven()).filter((e) => e.type === 'board')).toHaveLength(1);
  });
});
