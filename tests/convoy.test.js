import { describe, it, expect } from 'vitest';
import { Convoy, DEFAULT_CONVOY_PARAMS as P } from '../src/npc/convoy.js';
import { AMY_CONVOY_LINES, JESS_CONVOY_LINES, CONVOY_BANTER } from '../src/npc/convoyLines.js';
import { BANTER_TIMING } from '../src/npc/banter.js';

const free = [{ id: 'amy', free: true }, { id: 'jess', free: true }];
const ctx = (o = {}) => ({ girls: free, busy: false, options: { amy: ['red', 'blue'], jess: ['red', 'yellow'] }, claims: { amy: 'red', jess: 'yellow' }, ...o });
const make = (params = {}, random = () => 0) => new Convoy({ ...P, startAfter: 0, freeFor: 0, chance: 1, ...params }, random);
const step = (c, seconds, x = ctx(), dt = 1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...c.update(dt, x));
  return events;
};
function running(params) {
  const c = make(params);
  const [invite] = c.update(1, ctx());
  c.ready('amy');
  c.ready('jess');
  expect(c.update(1, ctx())[0]).toEqual({ type: 'running' });
  return { c, invite };
}

describe('follow the leader', () => {
  it('starts when both are free and nothing else is on, with Jess usually in front', () => {
    expect(make({ startAfter: 100 }).update(1, ctx())).toEqual([]);
    expect(make().update(1, ctx({ busy: true }))).toEqual([]);
    expect(make().update(1, ctx({ girls: [{ id: 'amy', free: true }, { id: 'jess', free: false }] }))).toEqual([]);
    expect(make().update(1, ctx())[0]).toMatchObject({ type: 'invite', leader: 'jess', follower: 'amy', picks: { amy: 'red', jess: 'yellow' } });
    expect(make({ chance: 0.5 }, () => 0.99).update(1, ctx({}))).toEqual([]); // the dice say no
  });

  it('is called off if they have not both got going in time', () => {
    const c = make({ formTimeout: 30 });
    c.update(1, ctx());
    c.ready('amy');
    expect(step(c, 40).some((e) => e.type === 'cancel')).toBe(true);
    expect(c.active).toBe(false);
  });

  it('after a leg the follower is told to overtake, and once she has the order swaps', () => {
    const { c } = running({ swapMin: 30, swapMax: 30 });
    expect(step(c, 29)).toEqual([]);
    const swap = step(c, 2).find((e) => e.type === 'swap');
    expect(swap).toEqual({ type: 'swap', leader: 'jess', follower: 'amy' });
    expect(step(c, 5)).toEqual([]); // nothing more while she is passing
    expect(c.passed()).toEqual({ leader: 'amy', follower: 'jess' });
    expect(c.leader).toBe('amy');
  });

  it('stops after the set number of swaps and a last leg', () => {
    const { c } = running({ swapMin: 10, swapMax: 10, swaps: 2, lastLeg: 20 });
    const events = [];
    for (let i = 0; i < 400; i++) {
      for (const e of c.update(1, ctx())) {
        events.push(e.type);
        if (e.type === 'swap') c.passed();
      }
    }
    expect(events.filter((e) => e === 'swap').length).toBe(2);
    expect(events).toContain('end');
    expect(c.active).toBe(false);
  });

  it('a pass that comes to nothing is given up after a while and they carry on', () => {
    const { c } = running({ swapMin: 10, swapMax: 10, passTimeout: 20 });
    step(c, 11);
    expect(c.passing).toBe(true);
    step(c, 25);
    expect(c.passing).toBe(false);
    expect(c.leader).toBe('jess');
  });

  it('stand() ends it at once and keeps them from starting another straight away', () => {
    const { c } = running();
    c.stand();
    expect(c.active).toBe(false);
    expect(step(c, 5).some((e) => e.type === 'invite')).toBe(false);
  });

  it('has lines for the offer and the answer, and bicker for either order', () => {
    expect(AMY_CONVOY_LINES.convoyInvite.lines.length).toBeGreaterThan(0);
    expect(JESS_CONVOY_LINES.convoyAccept.length).toBeGreaterThan(0);
    for (const front of ['amy', 'jess']) expect(CONVOY_BANTER.filter((e) => e.roles.front === front).length).toBeGreaterThan(1);
    for (const e of CONVOY_BANTER) expect(BANTER_TIMING[e.when]).toBeTruthy();
  });
});
