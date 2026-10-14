import { describe, it, expect } from 'vitest';
import { moonAt, moonIllumination, moonPhaseName, starLevel, moonDisc, moonlightFactor } from '../src/world/night.js';
import { Daylight, DEFAULT_DAYLIGHT_PARAMS as P, sunAt, skyAt } from '../src/world/daylight.js';

const BASE = { horizonColor: '#cfd3d4', zenithColor: '#9aa3ab', cloudColor: '#e4e6e6', cloudShadowColor: '#8c949b', cloudCover: 0.2, sunIntensity: 2.6, hemiIntensity: 1.35, exposure: 1.05 };
const night = (hour, p = P) => skyAt(BASE, sunAt(hour, p), p);

describe('The moon', () => {
  it('rises at sunset when full, crosses the south at midnight and sets at dawn', () => {
    expect(moonAt(18, 0.5).elevation).toBeCloseTo(0, 5);
    const mid = moonAt(24, 0.5);
    expect(mid.elevation).toBeCloseTo(0.75, 5);
    expect(mid.dir.z).toBeGreaterThan(0.6); // south
    expect(moonAt(21, 0.5).dir.x).toBeGreaterThan(0.3); // still in the east
    expect(moonAt(27, 0.5).dir.x).toBeLessThan(-0.3); // in the west
    expect(moonAt(36, 0.5).elevation).toBeLessThan(0); // the day after is down
  });

  it('is up in the day and unseen when new', () => {
    expect(moonAt(12, 0).elevation).toBeGreaterThan(0.5);
    expect(moonAt(21, 0).up).toBe(0);
  });

  it('is lit by phase, and has a name', () => {
    expect(moonIllumination(0)).toBeCloseTo(0);
    expect(moonIllumination(0.5)).toBeCloseTo(1);
    expect(moonIllumination(0.25)).toBeCloseTo(0.5);
    expect(moonPhaseName(0.5)).toBe('full');
    expect(moonPhaseName(0.02)).toBe('new');
  });

  it('lights the night more when full, high and clear', () => {
    const full = moonAt(24, 0.5);
    const crescent = moonAt(24, 0.9);
    const down = moonAt(21, 0.0);
    expect(moonlightFactor(full, 0.1)).toBeGreaterThan(moonlightFactor(crescent, 0.1));
    expect(moonlightFactor(full, 0.1)).toBeGreaterThan(moonlightFactor(full, 1));
    expect(moonlightFactor(down, 0.1)).toBeLessThan(1);
  });
});

describe('The stars', () => {
  const moon = moonAt(21, 0);
  it('come out in the dark and not by day', () => {
    expect(starLevel(0, 0.1, moon)).toBe(0);
    expect(starLevel(0.5, 0.1, moon)).toBe(0);
    expect(starLevel(1, 0.1, moon)).toBeCloseTo(1);
  });
  it('are hidden by cloud and dimmed by a bright moon', () => {
    expect(starLevel(1, 1, moon)).toBe(0);
    expect(starLevel(1, 0.1, moonAt(24, 0.5))).toBeLessThan(starLevel(1, 0.1, moon));
  });
  it('the moon disc only shows in the dark', () => {
    const m = moonAt(24, 0.5);
    expect(moonDisc(0, m)).toBe(0);
    expect(moonDisc(1, m)).toBeCloseTo(1);
  });
});

describe('The night sky from the day', () => {
  it('has no stars at noon and a sky full of them well after dark', () => {
    expect(night(12).starLevel).toBe(0);
    expect(night(12).moonLevel).toBe(0);
    expect(night(21, { ...P, moonPhase: 0 }).starLevel).toBeGreaterThan(0.9);
  });
  it('gives a full moon more light than a new one', () => {
    const full = night(24, { ...P, moonPhase: 0.5 }).sunIntensity;
    const dark = night(24, { ...P, moonPhase: 0 }).sunIntensity;
    expect(full).toBeGreaterThan(dark);
  });
  it('each game draws its own phase without moving its start or its fall', () => {
    const r = (...v) => { let i = 0; return () => v[i++ % v.length]; };
    const d = new Daylight({ ...P }, { random: r(0, 1, 0.3) });
    expect(d.hour).toBe(P.startEarliest);
    expect(d.drop).toBe(P.coolMax);
    expect(d.p.moonPhase).toBe(0.3);
  });
});
