import { describe, it, expect, vi } from 'vitest';
import { Game } from '../src/game.js';
import { normalisePrompt } from '../src/interaction/prompt.js';

// A stand-in host: just what the drawbar, the hitch and the bottle code reads.
const quad = (o = {}) => ({ rider: null, driver: null, speed: 0, mugAnchor: {}, ...o });
const host = (o = {}) => {
  const tractor = quad();
  const h = {
    tractorUnit: { quad: tractor },
    chain: { state: 'stowed' },
    baleRig: { held: false },
    towRope: { state: 'stowed', puller: null },
    achievements: { note: vi.fn() },
    hud: { toast: vi.fn(), setStatus: vi.fn() },
    units: [],
    trailer: { hitched: false },
    ...o,
  };
  h.hitchBlock = Game.prototype.hitchBlock.bind(h);
  h.tractor = tractor;
  return h;
};
const trailer = (o = {}) => ({ hitched: false, puller: null, canHitch: () => true, hitch: vi.fn(), unhitch: vi.fn(), ...o });
const action = (h, t, name = 'tipping trailer') => Game.prototype.drawbarAction.call(h, t, name);
const shown = (a) => normalisePrompt(a.prompt);

describe('E at a trailer\'s drawbar', () => {
  it('unhitches a trailer that is standing still', () => {
    const q = quad();
    const h = host();
    const t = trailer({ hitched: true, puller: q });
    const a = action(h, t);
    expect(shown(a)).toMatchObject({ action: 'Unhitch the tipping trailer' });
    a.run();
    expect(t.unhitch).toHaveBeenCalled();
  });

  it('leaves it to J while somebody is on the vehicle, and says when it is moving', () => {
    const h = host();
    expect(action(h, trailer({ hitched: true, puller: quad({ rider: {} }) }))).toBeNull();
    expect(shown(action(h, trailer({ hitched: true, puller: quad({ speed: 2 }) })))).toMatchObject({ info: 'The tipping trailer is moving' });
  });

  it('hooks on the vehicle that is backed up to the ring, not one that is ridden', () => {
    const q = quad();
    const h = host({ units: [{ quad: q }] });
    const t = trailer({ canHitch: (c) => c === q });
    const a = action(h, t);
    expect(shown(a)).toMatchObject({ action: 'Hook on the tipping trailer' });
    a.run();
    expect(t.hitch).toHaveBeenCalledWith(q);
    expect(h.achievements.note).toHaveBeenCalledWith('hitched');
    expect(action(host({ units: [{ quad: quad({ rider: {} }) }] }), t)).toBeNull();
  });

  it('does nothing when no vehicle is at the ring', () => {
    expect(action(host({ units: [{ quad: quad() }] }), trailer({ canHitch: () => false }))).toBeNull();
  });

  it('says why when the tractor\'s drawbar is taken by the chain or a bale', () => {
    const t = trailer();
    const h = host();
    h.units = [{ quad: h.tractor }];
    h.trailer = t;
    h.chain = { state: 'carried' };
    expect(shown(action(h, t, 'bale trailer'))).toMatchObject({ info: 'The tow chain is on the drawbar' });
    h.chain = { state: 'stowed' };
    h.baleRig = { held: true };
    expect(shown(action(h, t, 'bale trailer'))).toMatchObject({ info: expect.stringContaining('bale') });
  });

  it('only the tractor takes the bale trailer', () => {
    const other = quad();
    const h = host({ units: [{ quad: other }] });
    const bale = trailer();
    h.trailer = bale;
    expect(action(h, bale, 'bale trailer')).toBeNull();
  });
});

describe('the coolant bottle and anti-gel, held E', () => {
  const bottleHost = (engine, fuel) => {
    const h = host({ coolantBottle: { params: { pourRate: 0.5, capSafeHeat: 0.3 } }, antiGelBottle: { params: { pourRate: 0.5 } }, eHeld: 0 });
    return { h, unit: { engine, quad: { fuel } } };
  };

  it('tops the radiator up while E is held and reports that it is pouring', () => {
    const engine = { params: { waterCooled: true }, isRunning: false, heat: 0, soak: 0, coolant: 0.4, thermostat: 1 };
    const { h, unit } = bottleHost(engine, {});
    expect(Game.prototype.coolantTopUp.call(h, unit, 0.1)).toBe(true);
    expect(engine.coolant).toBeGreaterThan(0.4);
  });

  it('does not pour on an air-cooled engine and says why', () => {
    const { h, unit } = bottleHost({ params: { waterCooled: false } }, {});
    expect(Game.prototype.coolantTopUp.call(h, unit, 0.1)).toBe(false);
    expect(h.hud.toast).toHaveBeenCalledWith(expect.stringContaining('air-cooled'), 2.5);
  });
});
