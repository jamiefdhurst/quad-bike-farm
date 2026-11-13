import { describe, it, expect } from 'vitest';
import { Radio, RadioKey, RADIO_PROFILES, RADIO_PARAMS, signalAt, heardAt, hasRadio, profileFor } from '../src/vehicle/radio.js';
import { STATIONS } from '../src/audio/radioStation.js';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } from '../src/vehicle/quadSpecs.js';

describe('the radio', () => {
  it('is on or off, and louder or quieter by a step, within 0 and 1', () => {
    const r = new Radio('finch');
    expect(r.on).toBe(false);
    expect(r.toggle()).toBe(true);
    for (let i = 0; i < 20; i++) r.louder();
    expect(r.volume).toBe(1);
    for (let i = 0; i < 20; i++) r.quieter();
    expect(r.volume).toBe(0);
  });

  it('needs power, and goes quiet while the starter turns', () => {
    const r = new Radio('tor');
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
    const r = new Radio('griffin');
    r.set(true);
    r.update(0.01, { power: true });
    expect(r.level).toBeGreaterThan(0);
    expect(r.level).toBeLessThan(r.volume * r.profile.loud);
  });

  it('counts the time since anyone touched it', () => {
    const r = new Radio('griffin');
    r.update(10, { power: true });
    expect(r.untouchedFor).toBeGreaterThan(9);
    r.louder();
    expect(r.untouchedFor).toBe(0);
  });

  it('each set has its own character: the Tor is the tinniest and the crackliest, the Griffin the bassiest and cleanest', () => {
    const p = RADIO_PROFILES;
    expect(p.tor.band[0]).toBeGreaterThan(p.griffin.band[0]);
    expect(p.tor.band[1]).toBeLessThan(p.griffin.band[1]);
    expect(p.tor.crackle).toBeGreaterThan(p.crag.crackle);
    expect(p.griffin.bass).toBeGreaterThan(p.finch.bass);
    expect(p.finch.warble).toBeGreaterThan(p.griffin.warble);
    expect(profileFor('nothing')).toBe(p.tor);
  });

  it('is fitted to the Land Rovers and the cars, not the quads, the UTV or the tractor', () => {
    const fitted = [...QUAD_SPECS, ...EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC].filter(hasRadio).map((s) => s.id).sort();
    expect(fitted).toEqual(['crag', 'finch', 'griffin', 'tor', 'vauclair']);
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

describe('which station a set is on', () => {
  it('starts on its own preset: Jess\'s aftermarket set on the rock station, the rest on the easy one', () => {
    expect(new Radio('griffin').station).toBe('quarry');
    for (const id of ['tor', 'crag', 'finch', 'vauclair']) expect(new Radio(id).station).toBe('dale');
  });

  it('steps round the stations and says which, and the static of changing is timed from then', () => {
    const r = new Radio('finch');
    r.update(5, {});
    expect(r.sinceRetune).toBeGreaterThan(1e6);
    expect(r.nextStation()).toBe('Quarry Rock');
    expect(r.station).toBe('quarry');
    expect(r.sinceRetune).toBe(0);
    r.update(0.3, {});
    expect(r.sinceRetune).toBeCloseTo(0.3);
    r.nextStation();
    expect(r.station).toBe(STATIONS[0].id);
  });

  it('says its station when it describes itself', () => {
    const r = new Radio('griffin');
    r.set(true);
    r.update(1, { power: true });
    expect(r.describe()).toContain('Quarry Rock');
  });

  it('sounds worse the older it is: the Tor buzzes and is tinny, the Griffin is clean and deepest', () => {
    const p = RADIO_PROFILES;
    expect(p.tor.distort).toBeGreaterThan(p.crag.distort);
    expect(p.crag.distort).toBeGreaterThan(p.griffin.distort);
    expect(p.griffin.distort).toBe(0);
    expect(p.tor.band[1] - p.tor.band[0]).toBeLessThan(p.griffin.band[1] - p.griffin.band[0]);
    expect(p.griffin.bass).toBeGreaterThan(Math.max(p.tor.bass, p.crag.bass, p.finch.bass, p.vauclair.bass));
    expect(p.finch.warble).toBeGreaterThan(p.griffin.warble);
    for (const prof of Object.values(p)) expect(STATIONS.map((s) => s.id)).toContain(prof.station);
  });
});

describe('the radio key', () => {
  const hold = 0.5;
  const frames = (key, { on, downFor, hz = 60 }) => {
    const out = [];
    const dt = 1 / hz;
    const n = Math.round(downFor * hz);
    for (let i = 0; i < n; i++) out.push(key.update(dt, i === 0, true, on, hold));
    out.push(key.update(dt, false, false, on, hold));
    return out.filter(Boolean);
  };

  it('switches a set that is off on, at once, and a long hold of that press does nothing more', () => {
    const k = new RadioKey();
    expect(frames(k, { on: false, downFor: 0.05 })).toEqual(['on']);
    const k2 = new RadioKey();
    expect(frames(k2, { on: false, downFor: 1.2 })).toEqual(['on']);
  });

  it('a short press on a set that is on changes station, when the key comes up', () => {
    expect(frames(new RadioKey(), { on: true, downFor: 0.15 })).toEqual(['station']);
  });

  it('holding it switches the set off once, and letting go does not change station', () => {
    expect(frames(new RadioKey(), { on: true, downFor: 0.9 })).toEqual(['off']);
  });

  it('does nothing without a press, and a reset press (louder or quieter) does nothing on release', () => {
    const k = new RadioKey();
    expect(k.update(0.016, false, false, true, hold)).toBeNull();
    k.update(0.016, true, true, true, hold);
    k.reset();
    expect(k.update(0.016, false, false, true, hold)).toBeNull();
  });
});
