import { describe, it, expect } from 'vitest';
import { dopplerFactor, TravelDelay, airCutoff, distanceLevel, SPEED_OF_SOUND } from '../src/audio/propagation.js';
import { RideEvents, createSurfaceSampler } from '../src/audio/rideEvents.js';
import { DEFAULT_SOUND_PARAMS } from '../src/audio/audioParams.js';

const c = SPEED_OF_SOUND;
const still = { x: 0, y: 0, z: 0 };

describe('Doppler factor', () => {
  it('raises the pitch of a source coming towards you and lowers it going away', () => {
    const at = { x: 50, y: 0, z: 0 };
    expect(dopplerFactor(still, still, at, { x: -10, y: 0, z: 0 })).toBeCloseTo(c / (c - 10), 6);
    expect(dopplerFactor(still, still, at, { x: 10, y: 0, z: 0 })).toBeCloseTo(c / (c + 10), 6);
  });

  it('is 1 for a source crossing in front of you and for one moving with you', () => {
    expect(dopplerFactor(still, still, { x: 0, y: 0, z: -20 }, { x: 10, y: 0, z: 0 })).toBeCloseTo(1, 6);
    const v = { x: 8, y: 0, z: 3 };
    expect(dopplerFactor(still, v, { x: 2, y: 0, z: 1 }, v)).toBeCloseTo(1, 6);
  });

  it('counts the listener moving towards the source', () => {
    expect(dopplerFactor(still, { x: 10, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, still)).toBeCloseTo((c + 10) / c, 6);
  });
});

describe('travel delay', () => {
  const p = { ...DEFAULT_SOUND_PARAMS };
  const dt = 1 / 60;

  function pass(speed, lateral = 3) {
    const t = new TravelDelay();
    const out = [];
    for (let k = 0; k <= 600; k++) {
      const x = -50 + speed * k * dt;
      out.push({ x, pitch: t.update(dt, Math.hypot(x, lateral), p) });
    }
    return out;
  }

  it('plays a quad passing at 10 m/s about 3% sharp, then about 3% flat', () => {
    const out = pass(10);
    const approaching = out.find((o) => o.x > -30).pitch;
    const receding = out.findLast((o) => o.x < 45).pitch;
    expect(approaching).toBeGreaterThan(1.027);
    expect(approaching).toBeLessThan(1.031);
    expect(receding).toBeGreaterThan(0.969);
    expect(receding).toBeLessThan(0.973);
  });

  it('spreads out a jump in distance (getting on or off) instead of squealing', () => {
    const t = new TravelDelay();
    t.update(dt, 0, p);
    let worst = 1;
    for (let k = 0; k < 60; k++) worst = Math.min(worst, t.update(dt, 5, p));
    expect(1 - worst).toBeLessThanOrEqual(p.dopplerMaxSpeed / p.speedOfSound + 1e-9);
    expect(t.delay).toBeCloseTo(5 / c, 4);
  });

  it('does nothing with Doppler turned down to 0', () => {
    const t = new TravelDelay();
    const q = { ...p, dopplerAmount: 0 };
    for (let k = 0; k < 100; k++) expect(t.update(dt, 50 - k * 0.2, q)).toBeCloseTo(1, 9);
    expect(t.delay).toBe(0);
  });
});

describe('air absorption', () => {
  it('loses treble with distance', () => {
    expect(airCutoff(0, 40)).toBe(20000);
    expect(airCutoff(40, 40)).toBe(10000);
    expect(airCutoff(200, 40)).toBeLessThan(airCutoff(50, 40));
    expect(airCutoff(100, 0)).toBe(20000);
  });
});

describe('surfaces', () => {
  // A track along the x axis with a puddle on it at the origin.
  const world = {
    layout: { puddleRadius: 1.7, yard: { x: 100, z: 100, radius: 20 } },
    heights: { puddles: [{ x: 0, z: 0 }] },
    mudAt: (x, z) => (Math.abs(z) < 2 ? 1 : 0),
  };
  const at = createSurfaceSampler(world);
  const sum = (s) => s.grass + s.dirt + s.mud + s.water;

  it('knows water, the mud round it, the track, the yard and grass', () => {
    expect(at(0, 0).water).toBeCloseTo(1);
    expect(at(1.7, 0).mud).toBeGreaterThan(0.5);
    expect(at(10, 0).dirt).toBeCloseTo(1);
    expect(at(10, 10).grass).toBeCloseTo(1);
    expect(at(100, 100).dirt).toBeCloseTo(1);
    for (const [x, z] of [[0, 0], [1.4, 0.3], [2, 1], [10, 0], [10, 10]]) expect(sum(at(x, z))).toBeCloseTo(1);
  });
});

describe('ride events', () => {
  const p = { ...DEFAULT_SOUND_PARAMS };
  const dt = 1 / 60;
  const grass = { grass: 1, dirt: 0, mud: 0, water: 0 };
  const wheels = (contact, suspension = 0.3, water = 0) => [0, 1, 2, 3].map(() => ({ contact, suspension, water }));
  const types = (ev) => ev.map((e) => e.type);

  it('thuds once on landing, and the suspension soaking it up stays quiet', () => {
    const r = new RideEvents(p, { random: () => 0.5 });
    for (let k = 0; k < 30; k++) r.step(dt, { wheels: wheels(false, 0.35), vy: -4, speed: 0, surface: grass, jolts: [] });
    expect(r.take()).toEqual([]);
    // Wheels coming down one after another, the springs compressing hard.
    const ws = wheels(false, 0.35);
    ws[0].contact = true;
    r.step(dt, { wheels: ws, vy: -4, speed: 0, surface: grass, jolts: [] });
    for (let k = 0; k < 5; k++) r.step(dt, { wheels: wheels(true, 0.3 - k * 0.03), vy: -1, speed: 0, surface: grass, jolts: [] });
    const ev = r.take();
    expect(types(ev)).toEqual(['land']);
    expect(ev[0].strength).toBeCloseTo(1, 1);
  });

  it('knocks when a wheel is pushed up hard over a bump', () => {
    const r = new RideEvents(p, { random: () => 0.5 });
    r.step(dt, { wheels: wheels(true, 0.3), vy: 0, speed: 0, surface: grass, jolts: [] });
    const ws = wheels(true, 0.3);
    ws[1].suspension = 0.25; // 3 m/s compression
    r.step(dt, { wheels: ws, vy: 0, speed: 0, surface: grass, jolts: [] });
    const ev = r.take();
    expect(types(ev)).toEqual(['knock']);
    expect(ev[0].wheel).toBe(1);
    // Gentle movement doesn't.
    ws[1].suspension = 0.249;
    r.step(dt, { wheels: ws, vy: 0, speed: 0, surface: grass, jolts: [] });
    expect(r.take()).toEqual([]);
  });

  it('splashes into a puddle at speed but not at a crawl', () => {
    const fast = new RideEvents(p);
    fast.step(dt, { wheels: wheels(true), vy: 0, speed: 6, surface: grass, jolts: [] });
    fast.step(dt, { wheels: wheels(true, 0.3, 0.9), vy: 0, speed: 6, surface: grass, jolts: [] });
    expect(types(fast.take()).filter((t) => t === 'splash').length).toBe(4);
    const slow = new RideEvents(p);
    slow.step(dt, { wheels: wheels(true), vy: 0, speed: 0.5, surface: grass, jolts: [] });
    slow.step(dt, { wheels: wheels(true, 0.3, 0.9), vy: 0, speed: 0.5, surface: grass, jolts: [] });
    expect(slow.take()).toEqual([]);
  });

  it('makes small bumps by the metre, more on the track than on grass', () => {
    const count = (surface) => {
      const r = new RideEvents(p);
      for (let k = 0; k < 600; k++) r.step(dt, { wheels: wheels(true), vy: 0, speed: 10, surface, jolts: null });
      return r.take().filter((e) => e.type === 'bump').length;
    };
    const onGrass = count(grass);
    const onTrack = count({ grass: 0, dirt: 1, mud: 0, water: 0 });
    // 100 m travelled.
    expect(onGrass).toBeGreaterThan(100 * p.bumpsPerMetreGrass * 0.6);
    expect(onGrass).toBeLessThan(100 * p.bumpsPerMetreGrass * 1.5);
    expect(onTrack).toBeGreaterThan(onGrass * 1.5);
  });

  it('leaves the small bumps to the vibration model when it gives them', () => {
    const r = new RideEvents(p);
    for (let k = 0; k < 120; k++) r.step(dt, { wheels: wheels(true), vy: 0, speed: 10, surface: grass, jolts: [] });
    expect(r.take()).toEqual([]);
  });
});

describe('distanceLevel', () => {
  it('is full up to the reference distance and fades beyond it, as the engines do', () => {
    expect(distanceLevel(0, 2.5, 1.1)).toBe(1);
    expect(distanceLevel(2.5, 2.5, 1.1)).toBe(1);
    expect(distanceLevel(10, 2.5, 1.1)).toBeLessThan(0.4);
    expect(distanceLevel(40, 2.5, 1.1)).toBeLessThan(0.1);
    expect(distanceLevel(40, 2.5, 1.1)).toBeLessThan(distanceLevel(10, 2.5, 1.1));
  });
});
