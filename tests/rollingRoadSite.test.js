import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { Visit, DEFAULT_TRAFFIC_PARAMS, visitPlaces, Traffic, VISITOR_KINDS } from '../src/world/traffic.js';
import { RIG, rigSite, toWorld, trailerPose, onDeck } from '../src/world/rollingRoadSite.js';
import { onRollers } from '../src/farm/rollingRoad.js';

const places = visitPlaces(LAYOUT);
const P = { ...DEFAULT_TRAFFIC_PARAMS };
const fakeGate = (open = false) => ({ isOpen: open, set(v) { this.isOpen = v; return true; } });

describe('the rig site', () => {
  const vehicle = { x: 100, z: 50, yaw: -Math.PI / 2 };
  const site = rigSite(vehicle);
  it('puts the trailer straight behind the Land Rover, the hitch length away', () => {
    expect(site.trailer.x).toBeCloseTo(100 + RIG.hitch, 5);
    expect(site.trailer.z).toBeCloseTo(50, 5);
    expect(site.trailer.yaw).toBe(vehicle.yaw);
    expect(trailerPose({ x: 0, z: 0, yaw: 0 })).toMatchObject({ x: 0, z: -RIG.hitch });
  });
  it('turns the trailer frame into the world', () => {
    expect(toWorld({ x: 0, z: 0, yaw: 0 }, 1, 2)).toEqual({ x: 1, z: 2 });
    const w = toWorld({ x: 0, z: 0, yaw: Math.PI / 2 }, 0, 1);
    expect(w.x).toBeCloseTo(1, 5);
    expect(w.z).toBeCloseTo(0, 5);
  });
  it('has the cradle on the deck, towards the back, and a quad stood there is on the rollers', () => {
    expect(onDeck(site, site.cradle.x, site.cradle.z)).toBe(true);
    const r = onRollers({ x: site.cradle.x, z: site.cradle.z, yaw: site.cradle.yaw, speed: 0 }, site.cradle);
    expect(r).toMatchObject({ in: true, still: true, square: true });
    expect(onRollers({ x: site.vehicle.x, z: site.vehicle.z, yaw: site.cradle.yaw, speed: 0 }, site.cradle).in).toBe(false);
  });
  it('has the ramp foot beyond the deck and the screen and tuner beside it, off the deck', () => {
    expect(onDeck(site, site.rampFoot.x, site.rampFoot.z, 0.2)).toBe(true);
    expect(onDeck(site, site.post.x, site.post.z)).toBe(false);
    expect(onDeck(site, site.stand.x, site.stand.z)).toBe(false);
    expect(Math.hypot(site.post.x - site.stand.x, site.post.z - site.stand.z)).toBeLessThan(3);
  });
  it('has four corners that are the deck', () => {
    expect(site.corners).toHaveLength(4);
    for (const c of site.corners) expect(onDeck(site, c.x, c.z, 0.01)).toBe(true);
  });
  it('sits in the yard at the real farm, well clear of the barn and the hedge and apart from the quads', () => {
    const s = places.rig;
    const barn = LAYOUT.barn;
    for (const c of [...s.corners, s.rampFoot]) {
      expect(c.x).toBeGreaterThan(barn.x + barn.halfX + 3);
      expect(c.x).toBeLessThan(LAYOUT.farm?.maxX ?? 1e9);
    }
    // A parked quad can be nudged by the spawn jitter, and is a couple of metres long: keep the deck and ramp 3 m clear of every spot.
    for (const q of LAYOUT.spawn.quads) expect(onDeck(s, q.x, q.z, 3), `${q.x},${q.z}`).toBe(false);
    for (const q of LAYOUT.spawn.away) expect(onDeck(s, q.x, q.z, 3), q.where).toBe(false);
    expect(onDeck(s, LAYOUT.lineUp.x, LAYOUT.lineUp.z, 3)).toBe(false);
  });
});

describe('the tuner visit', () => {
  const make = () => new Visit({ kind: 'tuner', places, from: 1, to: -1, leaveOpen: false, params: P, colour: VISITOR_KINDS.tuner.colour });

  function run(visit, ctxFor, seconds) {
    const events = [];
    for (let t = 0; t < seconds && !visit.done; t += 0.1) events.push(...visit.update(0.1, { gate: fakeGate(), gates: undefined, blockers: [], swingSeconds: 1.8, ...ctxFor(t) }));
    return events;
  }

  it('is not dealt by the traffic', () => {
    const t = new Traffic({ places, params: P, random: () => 0.5 });
    expect(t.startVisit('tuner').kind).toBe('post');
  });
  it('arrives, gets out, goes to the rig and stays while she is not sent home', () => {
    const v = make();
    const events = run(v, () => ({ stayOver: false }), 900);
    expect(events.map((e) => e.type)).toContain('arrived');
    expect(events.map((e) => e.type)).toContain('setUp');
    expect(events.map((e) => e.type)).not.toContain('packUp');
    expect(v.done).toBe(false);
    expect(v.current.type).toBe('stay');
    expect(v.driver.mode).toBe('foot');
    expect(Math.hypot(v.driver.x - places.rig.stand.x, v.driver.z - places.rig.stand.z)).toBeLessThan(0.3);
  });
  it('stops where the site says the Land Rover is', () => {
    const v = make();
    run(v, () => ({ stayOver: false }), 900);
    expect(Math.hypot(v.drive.x - places.rig.vehicle.x, v.drive.z - places.rig.vehicle.z)).toBeLessThan(1);
    expect(Math.abs(v.drive.yaw - places.rig.vehicle.yaw)).toBeLessThan(0.15);
  });
  it('packs up and goes when sent home', () => {
    const v = make();
    const events = run(v, (t) => ({ stayOver: t > 450 }), 1800);
    const types = events.map((e) => e.type);
    expect(types.indexOf('setUp')).toBeLessThan(types.indexOf('packUp'));
    expect(types).toContain('done');
    expect(v.done).toBe(true);
  });
});
