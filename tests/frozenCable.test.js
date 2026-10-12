import { describe, it, expect } from 'vitest';
import { FrozenCable, DEFAULT_FROZEN_CABLE_PARAMS, FROZEN_CABLE_PARAM_RANGES } from '../src/vehicle/frozenCable.js';

const make = (mode, ice) => Object.assign(new FrozenCable(DEFAULT_FROZEN_CABLE_PARAMS, () => 0.5), { mode, ice });

describe('frozen throttle cable', () => {
  it('has a range for every tunable', () => {
    expect(Object.keys(FROZEN_CABLE_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_FROZEN_CABLE_PARAMS).sort());
  });

  it('is only dealt on a frosty day, in the open', () => {
    const c = new FrozenCable(DEFAULT_FROZEN_CABLE_PARAMS);
    c.deal(() => 0, 0, false);
    expect(c.ice).toBe(0);
    c.deal(() => 0, 0.8, true);
    expect(c.ice).toBe(0);
    c.deal(() => 0, 0.8, false);
    expect(c.ice).toBeGreaterThanOrEqual(DEFAULT_FROZEN_CABLE_PARAMS.startIce);
    c.deal(() => 0.99, 0.8, false); // the dice say no
    expect(c.ice).toBe(0);
  });

  it('a free cable passes the throttle through', () => {
    const c = make('shut', 0);
    expect(c.throttle(0.8, true)).toBe(0.8);
  });

  it('frozen shut, it will not open past a crack', () => {
    const c = make('shut', 1);
    expect(c.throttle(1, true)).toBeCloseTo(0.1);
    expect(c.throttle(0, true)).toBe(0);
  });

  it('frozen shut opens more as it thaws', () => {
    const a = make('shut', 0.9).throttle(1, true);
    const b = make('shut', 0.4).throttle(1, true);
    expect(b).toBeGreaterThan(a);
  });

  it('frozen open, it stays where you left it, and the engine going off frees the hold', () => {
    const c = make('open', 0.8);
    expect(c.throttle(0.7, true)).toBe(0.7);
    expect(c.throttle(0, true)).toBe(0.7);
    expect(c.throttle(0.9, true)).toBe(0.9);
    c.throttle(0, false);
    expect(c.throttle(0, true)).toBe(0);
  });

  it('frozen open comes back as it thaws', () => {
    const c = make('open', 0.8);
    c.throttle(0.7, true);
    c.ice = 0.2;
    expect(c.throttle(0, true)).toBeLessThan(0.7);
    c.ice = 0.05;
    expect(c.throttle(0, true)).toBe(0);
  });

  it('freezes a stood quad out in a hard frost but not one under cover, running or on a mild day', () => {
    const frost = { frost: 1, temperature: -4, sun: 0 };
    const out = make('shut', 0);
    out.update(900, { ...frost });
    expect(out.ice).toBeGreaterThan(0.9);
    const under = make('shut', 0);
    under.update(900, { ...frost, covered: true });
    expect(under.ice).toBe(0);
    const going = make('shut', 0);
    going.update(900, { ...frost, running: true, engineTemp: 0.5 });
    expect(going.ice).toBe(0);
    const mild = make('shut', 0);
    mild.update(900, { frost: 0, temperature: 8 });
    expect(mild.ice).toBe(0);
  });

  it('engine heat thaws it in a couple of minutes, and a warm engine faster than a cold one', () => {
    const cold = make('shut', 1);
    const warm = make('shut', 1);
    for (let i = 0; i < 120; i++) {
      cold.update(1, { running: true, engineTemp: 0, frost: 1, temperature: -3 });
      warm.update(1, { running: true, engineTemp: 1, frost: 1, temperature: -3 });
    }
    expect(warm.ice).toBeLessThan(cold.ice);
    expect(warm.frozen).toBe(false);
  });

  it('a few minutes of sun frees a stood quad', () => {
    const c = make('shut', 1);
    for (let i = 0; i < 400; i++) c.update(1, { frost: 1, temperature: -1, sun: 1, covered: false });
    expect(c.frozen).toBe(false);
  });

  it('fix clears it', () => {
    const c = make('open', 1);
    c.throttle(1, true);
    c.fix();
    expect(c.ice).toBe(0);
    expect(c.throttle(0, true)).toBe(0);
  });
});
