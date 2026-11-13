import { describe, it, expect } from 'vitest';
import { Headgear, DEFAULT_HEADGEAR_PARAMS } from '../src/npc/headgear.js';

const girl = (o = {}) => ({ id: 'amy', free: true, riding: false, vehicle: null, x: 0, z: 0, leave: 1, ground: 0, ...o });
const hooks = { x: 10, z: 0 };
const make = (p = {}, r = 0.5) => new Headgear({ ...DEFAULT_HEADGEAR_PARAMS, ...p }, () => r);
const step = (h, g, vehicles = {}, dt = 1) => h.update(dt, { girls: [g], vehicles, hooks });

describe('a girl and her helmet', () => {
  it('offers to fetch it from the hooks only after the start, when free and within range', () => {
    const h = make();
    expect(h.offers({ girls: [girl()], hooks })).toEqual([]);
    h.update(30, { girls: [girl()], vehicles: {}, hooks });
    expect(h.offers({ girls: [girl()], hooks })).toHaveLength(1);
    expect(h.offers({ girls: [girl({ free: false })], hooks })).toEqual([]);
    expect(h.offers({ girls: [girl({ x: 500 })], hooks })).toEqual([]);
    expect(h.offers({ girls: [girl({ riding: true })], hooks })).toEqual([]);
  });

  it('weighs the offer by her own keenness, and stops offering once she is on her way or has it', () => {
    const h = make();
    h.update(30, { girls: [girl()], vehicles: {}, hooks });
    expect(h.offers({ girls: [girl({ weight: 2 })], hooks })[0].weight).toBe(DEFAULT_HEADGEAR_PARAMS.weight * 2);
    h.take({ girl: 'amy' });
    expect(h.offers({ girls: [girl()], hooks })).toEqual([]);
    h.put('amy');
    expect(h.wearing('amy')).toBe(true);
    expect(h.offers({ girls: [girl()], hooks })).toEqual([]);
  });

  it('forgets a fetch she never got to', () => {
    const h = make({ timeout: 10 });
    h.take({ girl: 'amy' });
    h.update(11, { girls: [], vehicles: {}, hooks });
    expect(h.pending.amy).toBeUndefined();
  });

  it('takes it off on getting off, onto the seat or the ground', () => {
    const h = make();
    h.put('amy');
    step(h, girl({ riding: true, vehicle: 'farm300' }));
    const seat = step(h, girl({ riding: false, vehicle: 'farm300', x: 3, z: 4 }));
    expect(seat).toEqual([{ type: 'doff', girl: 'amy', place: 'seat', vehicle: 'farm300' }]);
    expect(h.girl('amy')).toMatchObject({ place: 'seat', vehicle: 'farm300' });

    const j = make();
    j.put('amy');
    step(j, girl({ riding: true, vehicle: 'farm300' }));
    const ground = step(j, girl({ riding: false, vehicle: 'farm300', x: 3, z: 4, ground: 1 }));
    expect(ground[0]).toMatchObject({ type: 'doff', place: 'ground' });
    expect(j.girl('amy')).toMatchObject({ place: 'ground', x: 3, z: 4 });
  });

  it('keeps it on when the roll says to', () => {
    const h = make({}, 0.9);
    h.put('amy');
    step(h, girl({ riding: true, vehicle: 'farm300', leave: 0.5 }));
    expect(step(h, girl({ riding: false, vehicle: 'farm300', leave: 0.5 }))).toEqual([]);
    expect(h.wearing('amy')).toBe(true);
  });

  it('takes it off on foot after a while', () => {
    const h = make({ footMax: 5 });
    h.put('amy');
    for (let i = 0; i < 5; i++) expect(step(h, girl())).toEqual([]);
    expect(step(h, girl({ x: 7, z: 8 }))[0]).toMatchObject({ type: 'doff', place: 'ground' });
    expect(h.girl('amy')).toMatchObject({ place: 'ground', x: 7, z: 8 });
  });

  it('picks up a helmet lying near as she gets on, and does not go for one far away or still on the hooks', () => {
    const h = make();
    h.leave('amy', 'ground', { x: 5, z: 0 });
    step(h, girl());
    const e = step(h, girl({ riding: true, vehicle: 'farm300' }));
    expect(e).toEqual([{ type: 'don', girl: 'amy', from: 'ground' }]);
    expect(h.wearing('amy')).toBe(true);

    const far = make();
    far.leave('amy', 'ground', { x: 500, z: 0 });
    step(far, girl());
    expect(step(far, girl({ riding: true, vehicle: 'farm300' }))).toEqual([]);
    expect(far.wearing('amy')).toBe(false);

    const rack = make();
    step(rack, girl({ x: 500 }));
    expect(step(rack, girl({ x: 500, riding: true, vehicle: 'farm300' }))).toEqual([]);

    // Near the hooks she takes it off them on her way rather than ride bare-headed.
    const grab = make();
    step(grab, girl());
    expect(step(grab, girl({ riding: true, vehicle: 'farm300' }))).toEqual([{ type: 'don', girl: 'amy', from: 'rack' }]);
    expect(grab.wearing('amy')).toBe(true);
  });

  it('puts on the helmet she left on the very seat she gets back on, however far the vehicle has gone', () => {
    const h = make();
    h.leave('amy', 'seat', { vehicle: 'farm300' });
    step(h, girl(), { farm300: { speed: 0, x: 400, z: 0 } });
    expect(step(h, girl({ riding: true, vehicle: 'farm300' }), { farm300: { speed: 0, x: 400, z: 0 } })).toHaveLength(1);
  });

  it('lets a helmet fall off a seat once the vehicle is moving', () => {
    const h = make();
    h.leave('amy', 'seat', { vehicle: 'farm300' });
    const e = step(h, girl(), { farm300: { speed: 6, x: 20, z: 3 } });
    expect(e).toEqual([{ type: 'drop', girl: 'amy', x: 20, z: 3 }]);
    expect(h.girl('amy')).toMatchObject({ place: 'ground', x: 20, z: 3 });
  });

  it('sends her to fetch or hang up on the debug panel, whatever the offers say', () => {
    const h = make();
    expect(h.toggle('amy')).toBe('fetch');
    expect(step(h, girl())).toEqual([{ type: 'fetch', girl: 'amy' }]);
    h.put('amy');
    expect(h.toggle('amy')).toBe('hang');
    expect(step(h, girl())).toEqual([{ type: 'hang', girl: 'amy' }]);
  });
});

describe('your helmet and goggles', () => {
  it('lists whose helmets are on the hooks', () => {
    const h = make();
    h.girl('amy');
    h.girl('jess');
    h.put('amy');
    expect(h.onHooks().sort()).toEqual(['goggles', 'jess', 'you']);
    h.toggleHelmet();
    h.toggleGoggles();
    expect(h.onHooks()).toEqual(['jess']);
  });

  it('goggles guard the lens, and only while on', () => {
    const h = make();
    expect(h.guard()).toBe(0);
    h.toggleGoggles();
    expect(h.guard()).toBe(DEFAULT_HEADGEAR_PARAMS.goggleGuard);
  });

  it('keeps them in the save', () => {
    const h = make();
    h.toggleHelmet();
    h.toggleGoggles();
    const b = make();
    b.restore(h.capture());
    expect(b.you).toEqual({ helmet: true, goggles: true });
    b.restore(undefined);
    expect(b.you).toEqual({ helmet: false, goggles: false });
  });
});

describe('Amy minding', () => {
  const ctx = (o = {}) => ({ riding: true, speed: 8, girls: [{ id: 'amy', nags: true, canRemark: true, dist: 5 }], ...o });

  it('nags after a few seconds of riding bare-headed, then not again for a while', () => {
    const h = make();
    let e = null;
    for (let i = 0; i < 6 && !e; i++) e = h.watch(1, ctx());
    expect(e).toEqual({ type: 'nag', girl: 'amy' });
    for (let i = 0; i < 30; i++) expect(h.watch(1, ctx())).toBeNull();
  });

  it('says nothing when you are slow, on foot, or she is far off, busy or not the nagging sort', () => {
    for (const c of [ctx({ speed: 0.5 }), ctx({ riding: false }), ctx({ girls: [{ id: 'amy', nags: true, canRemark: true, dist: 80 }] }),
      ctx({ girls: [{ id: 'amy', nags: true, canRemark: false, dist: 5 }] }), ctx({ girls: [{ id: 'jess', nags: false, canRemark: true, dist: 5 }] })]) {
      const h = make();
      for (let i = 0; i < 20; i++) expect(h.watch(1, c)).toBeNull();
    }
  });

  it('praises the helmet once, and does not nag with it on', () => {
    const h = make();
    h.toggleHelmet();
    expect(h.watch(1, ctx())).toEqual({ type: 'praise', girl: 'amy' });
    for (let i = 0; i < 300; i++) expect(h.watch(1, ctx())).toBeNull();
  });

  it('has nothing to praise in a helmet you wore before the load', () => {
    const h = make();
    h.restore({ helmet: true });
    expect(h.watch(1, ctx())).toBeNull();
  });
});

describe('what they say', () => {
  it('has the lines Amy and Jess use', async () => {
    const { AMY_HEADGEAR_LINES, JESS_HEADGEAR_LINES } = await import('../src/npc/headgearLines.js');
    for (const k of ['helmetOn', 'helmetNag', 'helmetPraise', 'helmetFell', 'gogglesOn']) expect(AMY_HEADGEAR_LINES[k].lines.length).toBeGreaterThan(1);
    for (const k of ['helmetOn', 'helmetFell', 'gogglesOn']) expect(JESS_HEADGEAR_LINES[k].length).toBeGreaterThan(1);
  });
});
