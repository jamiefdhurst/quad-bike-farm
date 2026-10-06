import { describe, it, expect } from 'vitest';
import { HayRide, DEFAULT_HAYRIDE_PARAMS as P } from '../src/npc/hayRide.js';

const girl = (id, over = {}) => ({ id, free: true, aboard: false, dist: 10, seatX: id === 'amy' ? 0.5 : -0.5, ...over });
const ctx = (over = {}) => ({ active: true, speed: 0, omega: 0, jolt: 0, girls: [girl('amy'), girl('jess')], ...over });
const make = (random = () => 0.5, over = {}) => new HayRide({ ...P, ...over }, random);

function run(h, seconds, c) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.1) events.push(...h.update(0.1, typeof c === 'function' ? c(t) : c));
  return events;
}
const aboard = () => [girl('amy', { aboard: true, free: false }), girl('jess', { aboard: true, free: false })];

describe('getting on', () => {
  it('sends a free girl over once you are stopped, after her own short wait', () => {
    const h = make();
    expect(run(h, 0.5, ctx()).filter((e) => e.type === 'board')).toEqual([]);
    const events = run(h, 6, ctx()).filter((e) => e.type === 'board');
    expect([...new Set(events.map((e) => e.girl))].sort()).toEqual(['amy', 'jess']); // the game takes her off the list once she sets out
  });

  it('waits while you are moving, and when nobody is free or near', () => {
    expect(run(make(), 10, ctx({ speed: 2 }))).toEqual([]);
    expect(run(make(), 10, ctx({ girls: [girl('amy', { free: false }), girl('jess', { dist: P.boardRange + 5 })] }))).toEqual([]);
  });

  it('does nothing when the trailer is not hitched or you are not on the tractor', () => {
    expect(run(make(), 10, ctx({ active: false }))).toEqual([]);
  });

  it('restarts her wait if you move off before she sets out', () => {
    const h = make(() => 1); // the longest wait
    run(h, P.boardDelayMax - 0.5, ctx());
    run(h, 1, ctx({ speed: 3 }));
    expect(run(h, P.boardDelayMax - 0.5, ctx()).filter((e) => e.type === 'board')).toEqual([]);
  });
});

describe('getting off', () => {
  it('has everyone aboard climb down once you are off', () => {
    const events = run(make(), 3, ctx({ active: false, girls: aboard() })).filter((e) => e.type === 'leave');
    expect([...new Set(events.map((e) => e.girl))].sort()).toEqual(['amy', 'jess']); // the game takes her off the list once she sets out
  });
});

describe('bumps', () => {
  it('has one of them shriek over a hard bump, Jess more often, and not again for a while', () => {
    const jess = run(make(() => 0.1), 1, ctx({ speed: 3, jolt: 1, girls: aboard() })).filter((e) => e.type === 'bump');
    expect(jess).toHaveLength(1);
    expect(jess[0].girl).toBe('jess');
    const amy = run(make(() => 0.9), 1, ctx({ speed: 3, jolt: 1, girls: aboard() })).filter((e) => e.type === 'bump');
    expect(amy[0].girl).toBe('amy');
    const h = make();
    expect(run(h, 5, ctx({ speed: 3, jolt: 1, girls: aboard() })).filter((e) => e.type === 'bump')).toHaveLength(1);
  });

  it('ignores a gentle one', () => {
    expect(run(make(), 10, ctx({ speed: 3, jolt: P.bumpJolt - 0.1, girls: aboard() })).filter((e) => e.type === 'bump')).toEqual([]);
  });
});

describe('lying back', () => {
  const smooth = () => ctx({ speed: 3, girls: aboard() });
  it('has one lie back after a smooth straight stretch', () => {
    const events = run(make(() => 0.1), P.lieAfter + 2, smooth()).filter((e) => e.type === 'lie');
    expect(events).toHaveLength(1);
  });

  it('does not while it is bumpy, turning, or slow', () => {
    for (const bad of [{ jolt: 0.4 }, { omega: 0.3 }, { speed: 0.5 }]) {
      expect(run(make(() => 0, { bumpJolt: 5 }), P.lieAfter * 2, { ...smooth(), ...bad }).filter((e) => e.type === 'lie')).toEqual([]);
    }
  });

  it('sits her up on a hard bump', () => {
    const h = make(() => 0, { bumpJolt: 9 });
    run(h, P.lieAfter + 2, smooth());
    const events = run(h, 1, { ...smooth(), jolt: P.sitUpJolt + 0.2 });
    expect(events.map((e) => e.type)).toContain('sit');
  });
});

describe('sliding off', () => {
  // A left turn at speed: the girl sat on the right (seatX -0.5, Jess) is on the outside.
  const hard = () => ctx({ speed: 6, omega: 0.7, girls: aboard() });

  it('drops the girl on the outside of a hard bend, once the grace period is over', () => {
    const h = make(() => 0.5, { slackMin: 1, slackMax: 1 });
    run(h, P.slideGrace + 1, ctx({ speed: 0.1, girls: aboard() }));
    const events = run(h, 15, hard()).filter((e) => e.type === 'slide');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ girl: 'jess', side: -1 });
  });

  it('is the other girl on a right turn', () => {
    const h = make(() => 0.5, { slackMin: 1, slackMax: 1 });
    run(h, P.slideGrace + 1, ctx({ speed: 0.1, girls: aboard() }));
    const e = run(h, 15, ctx({ speed: 6, omega: -0.7, girls: aboard() })).find((x) => x.type === 'slide');
    expect(e).toMatchObject({ girl: 'amy', side: 1 });
  });

  it('does not in the first few seconds, or in a gentle bend', () => {
    expect(run(make(), P.slideGrace - 1, hard()).filter((e) => e.type === 'slide')).toEqual([]);
    const gentle = ctx({ speed: 3, omega: 0.3, girls: aboard() });
    expect(run(make(), 60, gentle).filter((e) => e.type === 'slide')).toEqual([]);
  });

  it('only once in a while, and sometimes she hangs on', () => {
    const h = make(() => 0.5, { slackMin: 1, slackMax: 1 });
    run(h, P.slideGrace + 1, ctx({ speed: 0.1, girls: aboard() }));
    expect(run(h, 60, hard()).filter((e) => e.type === 'slide')).toHaveLength(1);
    const lucky = make(() => 0.99, { slackMin: 1, slackMax: 1, slideChance: 0.5 });
    run(lucky, P.slideGrace + 1, ctx({ speed: 0.1, girls: aboard() }));
    expect(run(lucky, 30, hard()).filter((e) => e.type === 'slide')).toEqual([]);
  });

  it('is easier lying back', () => {
    const lying = (h) => {
      h.girl('jess').lying = true;
    };
    const turn = ctx({ speed: 4, omega: 0.45, girls: aboard() }); // 1.8 m/s2: fine sat up, too much lying down
    const sat = make(() => 0.5, { slackMin: 1, slackMax: 1, sitUpPush: 99 });
    run(sat, P.slideGrace + 1, ctx({ speed: 0.1, girls: aboard() }));
    expect(run(sat, 40, turn).filter((e) => e.type === 'slide')).toEqual([]);
    const flat = make(() => 0.5, { slackMin: 1, slackMax: 1, sitUpPush: 99 });
    run(flat, P.slideGrace + 1, ctx({ speed: 0.1, girls: aboard() }));
    lying(flat);
    expect(run(flat, 40, turn).filter((e) => e.type === 'slide')).toHaveLength(1);
  });
});
