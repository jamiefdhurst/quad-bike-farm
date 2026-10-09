import { describe, it, expect } from 'vitest';
import { CabShelter, DEFAULT_CAB_SHELTER_PARAMS as P } from '../src/npc/cabShelter.js';
import { AMY_CAB_LINES, JESS_CAB_LINES } from '../src/npc/cabShelterLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

const girl = (id, o = {}) => ({ id, x: 0, z: 0, free: true, cab: null, ...o });
const cab = (o = {}) => ({ id: 'landy', x: 10, z: 0, open: true, seats: 2, running: false, warm: true, ...o });
const wet = { rain: 0.6, warmth: 0.05 };
const cold = { rain: 0, warmth: 0.2 };
const fine = { rain: 0, warmth: 0.9 };
const ctx = (w, o = {}) => ({ ...w, girls: [girl('amy')], cabs: [cab()], ...o });
const make = (params = {}, random = () => 0) => new CabShelter({ ...P, startAfter: 0, ...params }, random);
const run = (s, c, seconds, dt = 0.5) => {
  const all = [];
  for (let t = 0; t < seconds; t += dt) all.push(...s.update(dt, c));
  return all;
};

describe('sheltering in a cab', () => {
  it('in the rain a free girl may pick a cab over the barn, after a short delay', () => {
    const s = make();
    expect(s.update(0.5, ctx(wet))).toEqual([]);
    const events = run(s, ctx(wet), 3);
    expect(events).toEqual([{ type: 'go', girl: 'amy', cab: 'landy', reason: 'rain', start: true }]);
  });

  it('she only rolls once a spell, and not at all when the dice say barn', () => {
    expect(run(make({}, () => 0.9), ctx(wet), 30)).toEqual([]);
    const s = make();
    run(s, ctx(wet), 3);
    s.drop('amy', []);
    s.coolUntil.amy = 0;
    expect(run(s, ctx(wet), 30).filter((e) => e.type === 'go')).toEqual([]);
  });

  it('not to a cab that is busy, full or too far, not if she is busy herself', () => {
    expect(run(make(), ctx(wet, { cabs: [cab({ open: false })] }), 10)).toEqual([]);
    expect(run(make(), ctx(wet, { cabs: [cab({ seats: 0 })] }), 10)).toEqual([]);
    expect(run(make(), ctx(wet, { cabs: [cab({ x: 500 })] }), 10)).toEqual([]);
    expect(run(make(), ctx(wet, { girls: [girl('amy', { free: false })] }), 10)).toEqual([]);
  });

  it('the UTV is somewhere to sit out the rain, and it is not started or warmed up in', () => {
    const utv = cab({ id: 'utv', warm: false });
    const events = run(make(), ctx(wet, { cabs: [utv] }), 3);
    expect(events).toEqual([{ type: 'go', girl: 'amy', cab: 'utv', reason: 'rain', start: false }]);
    expect(run(make({ rainChance: 1 }, () => 0.99), ctx(wet, { cabs: [utv] }), 10).map((e) => e.start)).toEqual([false]);
    expect(run(make({ coldChance: 1 }), ctx(cold, { cabs: [utv] }), 10)).toEqual([]);
  });

  it('on a cold dry day she goes to a Land Rover and starts it', () => {
    const events = run(make(), ctx(cold), 4);
    expect(events).toEqual([{ type: 'go', girl: 'amy', cab: 'landy', reason: 'cold', start: true }]);
  });

  it('one that is already running she just gets into', () => {
    const events = run(make(), ctx(cold, { cabs: [cab({ running: true })] }), 4);
    expect(events[0]).toMatchObject({ type: 'go', start: false });
  });

  it('not on a fine day', () => {
    expect(run(make(), ctx(fine), 60)).toEqual([]);
  });

  it('two girls do not take more seats than there are', () => {
    const s = make({}, () => 0);
    const events = run(s, ctx(cold, { girls: [girl('amy'), girl('jess')], cabs: [cab({ seats: 1 })] }), 4);
    expect(events.filter((e) => e.type === 'go')).toHaveLength(1);
  });

  it('she is in once the game has her aboard, and out again after her stay once the cold has gone', () => {
    const s = make({ coldStayMin: 10, coldStayMax: 10 });
    run(s, ctx(cold), 4);
    const events = s.update(0.5, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] }));
    expect(events).toEqual([{ type: 'in', girl: 'amy', cab: 'landy', reason: 'cold' }]);
    expect(run(s, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] }), 9)).toEqual([]);
    const out = run(s, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] }), 3);
    expect(out[0]).toEqual({ type: 'out', girl: 'amy', cab: 'landy' });
  });

  it('a rain shelterer stays while it rains and gets out only after it has dried, past her stay', () => {
    const s = make({ rainStayMin: 5, rainStayMax: 5, dryDelayMin: 4, dryDelayMax: 4 });
    run(s, ctx(wet), 3);
    const aboard = (w) => ctx(w, { girls: [girl('amy', { cab: 'landy' })] });
    s.update(0.5, aboard(wet));
    expect(run(s, aboard(wet), 30)).toEqual([]);
    expect(run(s, aboard(fine), 3)).toEqual([]);
    expect(run(s, aboard(fine), 3).map((e) => e.type)).toContain('out');
  });

  it('an engine she started goes off when she has gone, one she did not start is left alone', () => {
    const s = make();
    run(s, ctx(cold), 4);
    expect(s.update(0.5, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] })).map((e) => e.type)).toEqual(['in']);
    const gone = s.update(0.5, ctx(cold));
    expect(gone).toEqual([{ type: 'switchOff', cab: 'landy' }]);
    const t = make();
    run(t, ctx(cold, { cabs: [cab({ running: true })] }), 4);
    t.update(0.5, ctx(cold, { cabs: [cab({ running: true })], girls: [girl('amy', { cab: 'landy' })] }));
    expect(t.update(0.5, ctx(cold, { cabs: [cab({ running: true })] }))).toEqual([]);
  });

  it('she gives up if she cannot get in, and does not try again for a while', () => {
    const s = make({ goTimeout: 10, cooldown: 100 });
    run(s, ctx(cold), 4);
    expect(s.of('amy')).not.toBeNull();
    const events = run(s, ctx(cold), 12);
    expect(events).toEqual([{ type: 'switchOff', cab: 'landy' }]);
    expect(s.of('amy')).toBeNull();
    expect(run(s, ctx(cold), 50)).toEqual([]);
  });

  it('force sends her at once, whatever the weather', () => {
    const s = make({}, () => 0.99);
    expect(s.force('amy', ctx(fine), 'rain')).toMatchObject({ type: 'go', cab: 'landy' });
    expect(s.force('amy', ctx(fine), 'rain')).toBeNull();
  });
});

describe('what they say', () => {
  it('both girls have every line, and they are in the voice sets', () => {
    for (const key of Object.keys(AMY_CAB_LINES)) {
      expect(JESS_CAB_LINES[key]?.length).toBeGreaterThan(0);
      expect(VOICE_LINES[key]).toBeDefined();
    }
  });
});
