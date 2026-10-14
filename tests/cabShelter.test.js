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
/** She takes the first cab she's offered, as the chooser would. */
const send = (s, c) => s.take(s.offers(c)[0], c);
const run = (s, c, seconds, dt = 0.5) => {
  const all = [];
  for (let t = 0; t < seconds; t += dt) all.push(...s.update(dt, c));
  return all;
};

describe('sheltering in a cab', () => {
  it('in the rain offers a free girl the nearest cab, and taking it sends her (starting a Land Rover now and then)', () => {
    const s = make();
    const offers = s.offers(ctx(wet));
    expect(offers).toEqual([{ key: 'shelterCab', girl: 'amy', cab: 'landy', reason: 'rain', weight: P.rainWeight }]);
    expect(s.take(offers[0], ctx(wet))).toEqual({ type: 'go', girl: 'amy', cab: 'landy', reason: 'rain', start: true });
    expect(make({}, () => 0.9).take(offers[0], ctx(wet)).start).toBe(false);
  });

  it('never sends her on its own: that is the chooser\'s', () => {
    expect(run(make(), ctx(wet), 30)).toEqual([]);
    expect(run(make(), ctx(cold), 30)).toEqual([]);
  });

  it('the rain gets her up off a seat; a cold day does not', () => {
    expect(make().offers(ctx(wet, { girls: [girl('amy', { free: false, interruptible: true })] }))).toHaveLength(1);
    expect(make().offers(ctx(cold, { girls: [girl('amy', { free: false, interruptible: true })] }))).toEqual([]);
  });

  it('offers no cab that is busy, full or too far, nor to a busy girl', () => {
    expect(make().offers(ctx(wet, { cabs: [cab({ open: false })] }))).toEqual([]);
    expect(make().offers(ctx(wet, { cabs: [cab({ seats: 0 })] }))).toEqual([]);
    expect(make().offers(ctx(wet, { cabs: [cab({ x: 500 })] }))).toEqual([]);
    expect(make().offers(ctx(wet, { girls: [girl('amy', { free: false })] }))).toEqual([]);
  });

  it('the UTV is somewhere to sit out the rain, and it is not started or warmed up in', () => {
    const utv = cab({ id: 'utv', warm: false });
    const s = make();
    expect(s.take(s.offers(ctx(wet, { cabs: [utv] }))[0], ctx(wet, { cabs: [utv] }))).toEqual({ type: 'go', girl: 'amy', cab: 'utv', reason: 'rain', start: false });
    expect(make().offers(ctx(cold, { cabs: [utv] }))).toEqual([]);
  });

  it('on a cold dry day offers a Land Rover to start and sit in, more keenly one already running (which she just gets into)', () => {
    const s = make();
    const offer = s.offers(ctx(cold))[0];
    expect(offer).toEqual({ key: 'warmCab', girl: 'amy', cab: 'landy', reason: 'cold', weight: P.coldWeight });
    expect(s.take(offer, ctx(cold))).toEqual({ type: 'go', girl: 'amy', cab: 'landy', reason: 'cold', start: true });
    const running = ctx(cold, { cabs: [cab({ running: true })] });
    const r = make();
    expect(r.offers(running)[0].weight).toBe(P.coldWeight * 2);
    expect(r.take(r.offers(running)[0], running).start).toBe(false);
  });

  it('nothing on a fine day', () => {
    expect(make().offers(ctx(fine))).toEqual([]);
  });

  it('two girls do not take more seats than there are', () => {
    const s = make();
    const c = ctx(cold, { girls: [girl('amy'), girl('jess')], cabs: [cab({ seats: 1 })] });
    s.take(s.offers(c)[0], c);
    expect(s.offers(c)).toEqual([]);
  });

  it('she is in once the game has her aboard, and out again after her stay once the cold has gone', () => {
    const s = make({ coldStayMin: 10, coldStayMax: 10 });
    send(s, ctx(cold));
    const events = s.update(0.5, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] }));
    expect(events).toEqual([{ type: 'in', girl: 'amy', cab: 'landy', reason: 'cold' }]);
    expect(run(s, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] }), 9)).toEqual([]);
    const out = run(s, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] }), 3);
    expect(out[0]).toEqual({ type: 'out', girl: 'amy', cab: 'landy' });
  });

  it('a rain shelterer stays while it rains and gets out only after it has dried, past her stay', () => {
    const s = make({ rainStayMin: 5, rainStayMax: 5, dryDelayMin: 4, dryDelayMax: 4 });
    send(s, ctx(wet));
    const aboard = (w) => ctx(w, { girls: [girl('amy', { cab: 'landy' })] });
    s.update(0.5, aboard(wet));
    expect(run(s, aboard(wet), 30)).toEqual([]);
    expect(run(s, aboard(fine), 3)).toEqual([]);
    expect(run(s, aboard(fine), 3).map((e) => e.type)).toContain('out');
  });

  it('an engine she started goes off when she has gone, one she did not start is left alone', () => {
    const s = make();
    send(s, ctx(cold));
    expect(s.update(0.5, ctx(cold, { girls: [girl('amy', { cab: 'landy' })] })).map((e) => e.type)).toEqual(['in']);
    const gone = s.update(0.5, ctx(cold));
    expect(gone).toEqual([{ type: 'switchOff', cab: 'landy' }]);
    const t = make();
    send(t, ctx(cold, { cabs: [cab({ running: true })] }));
    t.update(0.5, ctx(cold, { cabs: [cab({ running: true })], girls: [girl('amy', { cab: 'landy' })] }));
    expect(t.update(0.5, ctx(cold, { cabs: [cab({ running: true })] }))).toEqual([]);
  });

  it('she gives up if she cannot get in, and does not try again for a while', () => {
    const s = make({ goTimeout: 10, cooldown: 100 });
    send(s, ctx(cold));
    expect(s.of('amy')).not.toBeNull();
    const events = run(s, ctx(cold), 12);
    expect(events).toEqual([{ type: 'switchOff', cab: 'landy' }]);
    expect(s.of('amy')).toBeNull();
    expect(s.offers(ctx(cold))).toEqual([]);
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

describe('starting a cab from the seat', () => {
  it('a Land Rover with a battery that will turn over is started from inside; only a flat one needs the handle outside', async () => {
    const { needsStartingHandle } = await import('../src/npc/crankAttempt.js');
    const lr = (battery, running = false) => ({ crank: {}, engine: { isRunning: running, battery, params: { batteryDeadBelow: 0.1 } } });
    expect(needsStartingHandle(lr(0.8))).toBe(false);
    expect(needsStartingHandle(lr(0.05))).toBe(true);
    expect(needsStartingHandle(lr(0.05, true))).toBe(false);
    expect(needsStartingHandle({ engine: { isRunning: false, battery: 0, params: {} } })).toBe(false); // no handle on it
  });
});
