import { describe, it, expect } from 'vitest';
import { Daylight, DEFAULT_DAYLIGHT_PARAMS as P, sunAt, skyAt, temperatureAt, clockText, clockHands, mixHex } from '../src/world/daylight.js';
import { pickLit } from '../src/effects/vehicleLights.js';
import { thermoAngle, baroReading, baroAngle } from '../src/world/weatherStation.js';
import { Places } from '../src/npc/places.js';
import { frostAfter, DEFAULT_FROST_PARAMS as F } from '../src/vehicle/seatFrost.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const seq = (...v) => {
  let i = 0;
  return () => v[i++ % v.length];
};
const BASE = { horizonColor: '#cfd3d4', zenithColor: '#9aa3ab', cloudColor: '#e4e6e6', cloudShadowColor: '#8c949b', cloudCover: 0.22, sunIntensity: 2.6, hemiIntensity: 1.35, exposure: 1.05 };

describe('The day running on', () => {
  it('starts each game at its own time between the earliest and the latest, and the night falls by its own amount', () => {
    const early = new Daylight({ ...P }, { random: seq(0, 0) });
    const late = new Daylight({ ...P }, { random: seq(1, 1) });
    expect(early.hour).toBe(P.startEarliest);
    expect(late.hour).toBe(P.startLatest);
    expect(early.drop).toBe(P.coolMin);
    expect(late.drop).toBe(P.coolMax);
    expect(new Daylight({ ...P }, { start: 16.5 }).hour).toBe(16.5);
  });

  it('runs on faster than real time', () => {
    const d = new Daylight({ ...P }, { start: 12 });
    d.update(300); // five real minutes
    expect(d.hour).toBeCloseTo(12 + (300 * P.clockRate) / 3600);
  });

  it('has the sun up in the east in the morning, in the south at noon and setting in the west', () => {
    const morning = sunAt(9, P);
    const noon = sunAt((P.sunrise + P.sunset) / 2, P);
    const evening = sunAt(16.5, P);
    expect(morning.dir.x).toBeGreaterThan(0); // east is +x
    expect(noon.dir.z).toBeGreaterThan(0.8); // south is +z
    expect(evening.dir.x).toBeLessThan(0);
    expect(noon.elevation).toBeCloseTo(P.sunHigh);
    expect(noon.light).toBe(1);
  });

  it('goes golden as the sun gets low, then dark after sunset, and the night stays', () => {
    expect(sunAt(13, P).glow).toBe(0);
    expect(sunAt(P.sunset - 0.4, P).glow).toBeGreaterThan(0.5);
    expect(sunAt(P.sunset + 1, P).night).toBe(1);
    expect(sunAt(P.sunset + 9, P).night).toBe(1); // no second morning
    expect(sunAt(P.sunset + 9, P).elevation).toBeLessThan(0);
  });

  it('turns the sky orange at dusk and dark blue at night, with the sun gone and only a faint light from above', () => {
    const day = skyAt(BASE, sunAt(13, P), P);
    const dusk = skyAt(BASE, sunAt(P.sunset - 0.2, P), P);
    const night = skyAt(BASE, sunAt(P.sunset + 2, P), P);
    expect(day.horizonColor).toBe(BASE.horizonColor);
    const red = (hex) => parseInt(hex.slice(1, 3), 16);
    const blue = (hex) => parseInt(hex.slice(5, 7), 16);
    expect(red(dusk.horizonColor) - blue(dusk.horizonColor)).toBeGreaterThan(red(day.horizonColor) - blue(day.horizonColor));
    expect(red(night.horizonColor)).toBeLessThan(40);
    expect(night.sunIntensity).toBeCloseTo(P.moonLight);
    expect(night.hemiIntensity).toBeCloseTo(BASE.hemiIntensity * P.nightLight);
    expect(night.sunDir.y).toBeGreaterThan(0); // the night light comes from above, not from under the ground
  });

  it('is coldest at dawn, warmest mid-afternoon, and falls by the day\'s amount into the night', () => {
    expect(temperatureAt(P.sunrise, 10, 6, P)).toBe(4);
    expect(temperatureAt(P.peakHour, 10, 6, P)).toBe(10);
    expect(temperatureAt(11, 10, 6, P)).toBeGreaterThan(4);
    expect(temperatureAt(11, 10, 6, P)).toBeLessThan(10);
    expect(temperatureAt(P.peakHour + P.coolHours, 10, 6, P)).toBeCloseTo(4);
    expect(temperatureAt(19, 10, 6, P)).toBeLessThan(temperatureAt(17, 10, 6, P));
  });

  it('finds the day\'s warmest for a temperature now, so ?temp= sets it as it is at the start', () => {
    const d = new Daylight({ ...P }, { start: 9, random: seq(0.5) });
    expect(d.temperature(d.peakFor(-2))).toBeCloseTo(-2);
  });

  it('tells the time, past midnight too, and puts the clock\'s hands right', () => {
    expect(clockText(14.5)).toBe('14:30');
    expect(clockText(25.25)).toBe('01:15');
    const h = clockHands(15.5);
    expect(h.hour).toBeCloseTo((3.5 / 12) * Math.PI * 2);
    expect(h.minute).toBeCloseTo(Math.PI);
  });

  it('mixes colours', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('Real light from the vehicles', () => {
  it('lights yours first, then the one lighting for you, then the nearest, only lit ones, up to the pool', () => {
    const cands = [
      { id: 'far', level: 1, distance: 50 },
      { id: 'near', level: 1, distance: 5 },
      { id: 'off', level: 0, distance: 1 },
      { id: 'mine', level: 0.5, distance: 0, mine: true },
      { id: 'lamp', level: 1, distance: 30, lighting: true },
    ];
    expect(pickLit(cands, 3)).toEqual(['mine', 'lamp', 'near']);
    expect(pickLit(cands, 10)).not.toContain('off');
  });
});

describe('The weather station', () => {
  it('points the thermometer round from cold to hot', () => {
    expect(thermoAngle(-20)).toBeCloseTo(-0.75 * Math.PI);
    expect(thermoAngle(40)).toBeCloseTo(0.75 * Math.PI);
    expect(thermoAngle(0)).toBeLessThan(thermoAngle(10));
    expect(thermoAngle(99)).toBe(thermoAngle(40));
  });

  it('reads fair on a sunny day, low in the rain, and falls ahead of rain coming on', () => {
    expect(baroReading('sunny', 0, 0)).toBeGreaterThan(baroReading('rain', 0.8, 0.8));
    expect(baroReading('overcast', 0, 0.6)).toBeLessThan(baroReading('overcast', 0, 0));
    expect(baroAngle(0)).toBeLessThan(baroAngle(1));
  });
});

describe('Going in after dark', () => {
  const ctx = (o = {}) => ({ rain: 0, dark: 0, spots: [{ id: 'door', kind: 'shelter', x: 0, z: 0 }], girls: [{ id: 'amy', x: 10, z: 0, state: 'idle', spot: null }], ...o });

  it('offers going in once it is dark, and not by day', () => {
    const places = new Places();
    expect(places.offers(ctx())).toEqual([]);
    const out = places.offers(ctx({ dark: 1 }));
    expect(out.map((o) => o.key)).toEqual(['goIn']);
    expect(OFFER_KINDS.goIn).toBeTruthy();
    expect(places.take(out[0])).toMatchObject({ do: 'shelter', dark: true });
  });

  it('keeps her in while it stays dark, even when dry', () => {
    const places = new Places();
    const inside = ctx({ dark: 1, girls: [{ id: 'amy', x: 0, z: 0, state: 'resting', spot: { id: 'door', kind: 'shelter' } }] });
    let acts = [];
    for (let t = 0; t < 120; t++) acts = acts.concat(places.update(1, inside));
    expect(acts).toEqual([]);
  });
});

describe('Seat frost through the day', () => {
  it('forms on an empty seat as the night gets cold enough, and thaws as the day warms', () => {
    expect(frostAfter(0, false, F.formSeconds / 2, F, 1)).toBeCloseTo(0.5);
    expect(frostAfter(0, false, F.formSeconds * 2, F, 0.7)).toBe(0.7);
    expect(frostAfter(1, false, F.thawSeconds / 2, F, 0)).toBeCloseTo(0.5);
    expect(frostAfter(1, true, 100, F, 1)).toBe(0); // sat on, it clears whatever the night
    expect(frostAfter(0.4, false, 100)).toBe(0.4); // with no day given, it stays
  });
});
