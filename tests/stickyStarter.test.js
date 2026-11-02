import { describe, it, expect } from 'vitest';
import { StickyStarter, StuckHelp, TrickLearner, dealSticky, canStick, DEFAULT_STICKY_PARAMS } from '../src/vehicle/stickyStarter.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const P = DEFAULT_STICKY_PARAMS;
const always = () => 0;
const never = () => 0.99;

describe('a sticky starter', () => {
  it('sticks on the first cold press of the starter, and stays stuck until it is tapped', () => {
    const s = new StickyStarter(P, always);
    expect(s.step(true, false, 0.2)).toBe(true);
    expect(s.stuck).toBe(true);
    s.step(false, false, 0.2);
    expect(s.step(true, false, 0.2)).toBe(false); // pressed again: still stuck, not a new roll
    expect(s.stuck).toBe(true);
    expect(s.tap()).toBe(true);
    expect(s.stuck).toBe(false);
  });

  it('does not stick again once tapped free, until the engine has run', () => {
    const s = new StickyStarter(P, always);
    s.step(true, false, 0.2);
    s.tap();
    s.step(false, false, 0.2);
    s.step(true, false, 0.2);
    expect(s.stuck).toBe(false);
    s.step(false, true, 0.5); // it ran
    s.step(false, false, 0.3); // and stopped
    s.step(true, false, 0.3);
    expect(s.stuck).toBe(true);
  });

  it('only sticks when cold, and not when the dice say no', () => {
    const warm = new StickyStarter(P, always);
    warm.step(true, false, 0.9);
    expect(warm.stuck).toBe(false);
    const lucky = new StickyStarter(P, never);
    lucky.step(true, false, 0.1);
    expect(lucky.stuck).toBe(false);
  });

  it('a tap on a free starter does nothing', () => {
    expect(new StickyStarter(P, never).tap()).toBe(false);
  });

  it('makes the engine click and not turn while stuck, then turn once freed', () => {
    const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS });
    e.setIgnition(true);
    e.update(0.05, { starter: true, starterStuck: true });
    expect(e.state).not.toBe('cranking');
    expect(e.events.some((x) => x.type === 'starterClick')).toBe(true);
    e.update(0.05, { starter: true, starterStuck: false });
    expect(e.state).toBe('cranking');
  });
});

describe('dealing it', () => {
  it('gives a game none, or one of the vehicles with a petrol starter', () => {
    expect(dealSticky(['a', 'b'], () => 0.9, P)).toBe(null);
    expect(dealSticky([], () => 0, P)).toBe(null);
    const seq = [0.1, 0.6];
    expect(dealSticky(['a', 'b'], () => seq.shift(), P)).toBe('b');
  });

  it('only fits an electric-start petrol engine', () => {
    expect(canStick({})).toBe(true);
    expect(canStick({ noStarter: true })).toBe(false);
    expect(canStick({ compressionIgnition: true })).toBe(false);
  });
});

describe('learning the tap', () => {
  it('Jess learns it after seeing it enough times, from near enough', () => {
    const t = new TrickLearner(['jess'], P);
    expect(t.watch('jess', 40)).toBe(false); // too far
    expect(t.watch('jess', 5, false)).toBe(false); // looking elsewhere
    expect(t.watch('jess', 5)).toBe(false);
    expect(t.knows('jess')).toBe(false);
    expect(t.watch('jess', 5)).toBe(true);
    expect(t.knows('jess')).toBe(true);
    expect(t.watch('jess', 5)).toBe(false); // already knows
  });

  it('Amy never learns it', () => {
    const t = new TrickLearner(['jess'], P);
    for (let i = 0; i < 5; i++) t.watch('amy', 2);
    expect(t.knows('amy')).toBe(false);
  });

  it('is kept in the save', () => {
    const t = new TrickLearner(['jess'], P);
    t.watch('jess', 2);
    t.watch('jess', 2);
    const u = new TrickLearner(['jess'], P);
    u.restore(t.capture());
    expect(u.knows('jess')).toBe(true);
  });
});

describe('a girl starting a stuck one', () => {
  const run = (help, seconds, stuck, knows) => {
    const acts = [];
    for (let t = 0; t < seconds; t += 0.1) acts.push(help.step(0.1, stuck, knows));
    return acts.filter(Boolean);
  };

  it('says what is wrong once if she has not learnt the trick, and never taps', () => {
    const acts = run(new StuckHelp(P, always), 10, true, false);
    expect(acts).toEqual(['stuck']);
  });

  it('taps it if she has learnt it, after a moment', () => {
    const h = new StuckHelp(P, always);
    expect(run(h, 1, true, true)).toEqual([]);
    expect(run(h, 1, true, true)).toContain('tap');
  });

  it('does nothing when nobody is starting it or it is not stuck', () => {
    expect(run(new StuckHelp(P, always), 10, true, null)).toEqual([]);
    expect(run(new StuckHelp(P, always), 10, false, true)).toEqual([]);
  });

  it('says it again the next time it sticks', () => {
    const h = new StuckHelp(P, always);
    run(h, 3, true, false);
    run(h, 1, false, false);
    expect(run(h, 3, true, false)).toEqual(['stuck']);
  });
});

describe('what Jess has learnt overnight', () => {
  const girls = (trick) => ({
    favour: { ids: [], scores: {} },
    fallingOut: { friction: 0, active: false },
    skills: { ids: [], levels: {} },
    romance: { ids: [], girls: {} },
    trick,
    companions: [],
  });

  it('is kept in the girls\' save, and an older save without it loads', async () => {
    const { captureGirls, restoreGirls } = await import('../src/farm/farmState.js');
    const { DEFAULT_FARM_PARAMS } = await import('../src/farm/farmSave.js');
    const a = new TrickLearner(['jess'], P);
    a.watch('jess', 2);
    a.watch('jess', 2);
    const saved = JSON.parse(JSON.stringify(captureGirls(girls(a))));
    const b = new TrickLearner(['jess'], P);
    restoreGirls(girls(b), saved, DEFAULT_FARM_PARAMS);
    expect(b.knows('jess')).toBe(true);
    delete saved.trick;
    const c = new TrickLearner(['jess'], P);
    restoreGirls(girls(c), saved, DEFAULT_FARM_PARAMS);
    expect(c.knows('jess')).toBe(false);
  });
});
