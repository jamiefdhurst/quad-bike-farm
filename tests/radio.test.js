import { describe, it, expect } from 'vitest';
import { Radio, RADIO_PROFILES, RADIO_PARAMS, signalAt, heardAt, hasRadio, profileFor } from '../src/vehicle/radio.js';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC, DEFENDER_SPEC, FIESTA_SPEC, CORSA_SPEC, P309_SPEC } from '../src/vehicle/quadSpecs.js';

describe('the radio', () => {
  it('is on or off, and louder or quieter by a step, within 0 and 1', () => {
    const r = new Radio('fiesta');
    expect(r.on).toBe(false);
    expect(r.toggle()).toBe(true);
    for (let i = 0; i < 20; i++) r.louder();
    expect(r.volume).toBe(1);
    for (let i = 0; i < 20; i++) r.quieter();
    expect(r.volume).toBe(0);
  });

  it('needs power, and goes quiet while the starter turns', () => {
    const r = new Radio('landrover');
    r.set(true);
    r.update(1, { power: false });
    expect(r.playing).toBe(false);
    expect(r.level).toBe(0);
    r.update(1, { power: true });
    expect(r.playing).toBe(true);
    expect(r.level).toBeGreaterThan(0.3);
    r.update(1, { power: true, cranking: true });
    expect(r.playing).toBe(false);
    expect(r.level).toBe(0);
  });

  it('eases up rather than clicking on', () => {
    const r = new Radio('corsa');
    r.set(true);
    r.update(0.01, { power: true });
    expect(r.level).toBeGreaterThan(0);
    expect(r.level).toBeLessThan(r.volume * r.profile.loud);
  });

  it('counts the time since anyone touched it', () => {
    const r = new Radio('corsa');
    r.update(10, { power: true });
    expect(r.untouchedFor).toBeGreaterThan(9);
    r.louder();
    expect(r.untouchedFor).toBe(0);
  });

  it('each set has its own character: the Series is the tinniest and the crackliest, the Corsa the bassiest and cleanest', () => {
    const p = RADIO_PROFILES;
    expect(p.landrover.band[0]).toBeGreaterThan(p.corsa.band[0]);
    expect(p.landrover.band[1]).toBeLessThan(p.corsa.band[1]);
    expect(p.landrover.crackle).toBeGreaterThan(p.landrover200.crackle);
    expect(p.corsa.bass).toBeGreaterThan(p.fiesta.bass);
    expect(p.fiesta.warble).toBeGreaterThan(p.corsa.warble);
    expect(profileFor('nothing')).toBe(p.landrover);
  });

  it('is fitted to the Land Rovers and the cars, not the quads, the UTV or the tractor', () => {
    const fitted = [...QUAD_SPECS, ...EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC, DEFENDER_SPEC, FIESTA_SPEC, CORSA_SPEC, P309_SPEC].filter(hasRadio).map((s) => s.id).sort();
    expect(fitted).toEqual(['corsa', 'fiesta', 'landrover', 'landrover200', 'p309']);
    expect(Object.keys(RADIO_PROFILES).sort()).toEqual(fitted);
  });
});

describe('the station', () => {
  it('wanders but is never lost, and is worse on a set that picks up the engine when it is revved', () => {
    let low = 1;
    let high = 0;
    for (let t = 0; t < 200; t += 0.5) {
      const s = signalAt(t, 0.55, 0, 0.75);
      low = Math.min(low, s);
      high = Math.max(high, s);
    }
    expect(low).toBeGreaterThanOrEqual(0.15);
    expect(high - low).toBeGreaterThan(0.2);
    expect(signalAt(10, 0.1, 1, 0.75)).toBeLessThan(signalAt(10, 0.1, 0, 0.75));
    expect(signalAt(10, 0, 0, 0)).toBe(1);
  });
});

describe('how loud it is where you are', () => {
  it('is full inside, and falls away outside to nothing at the range, duller as it goes', () => {
    expect(heardAt(0.8, 50, true).gain).toBe(0.8);
    const near = heardAt(0.8, 3);
    const far = heardAt(0.8, 15);
    expect(near.gain).toBeLessThan(0.8 * RADIO_PARAMS.outsideLevel + 1e-9);
    expect(far.gain).toBeLessThan(near.gain);
    expect(far.dull).toBeGreaterThan(near.dull);
    expect(heardAt(0.8, RADIO_PARAMS.outsideRange + 1).gain).toBe(0);
  });
});
