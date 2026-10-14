import { describe, it, expect } from 'vitest';
import { Dog, DEFAULT_DOG_PARAMS, DOG_PARAM_RANGES } from '../src/world/dog.js';
import { createRandom } from '../src/core/random.js';

const make = (over = {}) => new Dog({ allowed: (x, z) => Math.hypot(x, z) < 300, random: createRandom(5), params: { ...DEFAULT_DOG_PARAMS, ...over } });
const ctx = (over = {}) => ({ owner: { x: 0, z: 0, speed: 0, yaw: 0, riding: false }, rack: null, vehicles: [], girls: [], ...over });
const run = (dog, seconds, c, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...dog.update(dt, typeof c === 'function' ? c(t) : c));
  return events;
};
const rack = (over = {}) => ({ id: 'q1', x: 0, y: 0.95, z: 0, yaw: 0, ok: true, ...over });

describe('the farm dog', () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_DOG_PARAMS)) expect(DOG_PARAM_RANGES[k], k).toBeTruthy();
  });

  it('comes after you when you walk off and stays near you', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.place(0, 0);
    run(dog, 40, (t) => ctx({ owner: { x: 0, z: t * 1.5, speed: 1.5, yaw: 0, riding: false } }));
    expect(Math.hypot(dog.x - 0, dog.z - 60)).toBeLessThan(DEFAULT_DOG_PARAMS.followMax * 2);
  });

  it('runs flat out to catch up with a quad', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.place(0, 0);
    run(dog, 1, ctx({ owner: { x: 0, z: 40, speed: 10, yaw: 0, riding: true } }));
    expect(dog.speed).toBeGreaterThan(DEFAULT_DOG_PARAMS.runSpeed);
  });

  it('sits when you stop, then wanders and sniffs about without straying far', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.place(2, 0);
    dog.t = 20;
    run(dog, 5, ctx());
    expect(dog.pose).toBe('sit');
    const seen = new Set();
    for (let t = 0; t < 200; t += 0.1) {
      dog.update(0.1, ctx());
      seen.add(dog.mode);
      expect(Math.hypot(dog.x, dog.z)).toBeLessThan(DEFAULT_DOG_PARAMS.wanderMax + 3);
    }
    expect(seen.has('wander')).toBe(true);
    expect(seen.has('sniff')).toBe(true);
  });

  it('hops up on the rack when you stop on a quad, and rides with it', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.place(4, 0);
    const events = run(dog, 6, ctx({ rack: rack() }));
    expect(dog.mode).toBe('ride');
    expect(events.some((e) => e.kind === 'mounted' && e.id === 'q1')).toBe(true);
    expect(dog.y).toBeCloseTo(0.95);
    run(dog, 2, ctx({ owner: { x: 0, z: 30, speed: 12, yaw: 0, riding: true }, rack: rack({ z: 30, yaw: 1 }) }));
    expect(dog.z).toBeCloseTo(30);
    expect(dog.yaw).toBeCloseTo(1);
    expect(dog.riding).toBe(true);
  });

  it('does not get on while you are still moving, nor when something is sat on the rack', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.place(4, 0);
    run(dog, 10, ctx({ owner: { x: 0, z: 0, speed: 5, yaw: 0, riding: true }, rack: rack() }));
    expect(dog.riding).toBe(false);
    run(dog, 10, ctx({ rack: rack({ ok: false }) }));
    expect(dog.riding).toBe(false);
  });

  it('hops down when you get off, and keeps off the rack for a few seconds', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0, rideBan: 6 });
    dog.mount(rack());
    const events = run(dog, 2, ctx());
    expect(events.some((e) => e.kind === 'down')).toBe(true);
    expect(dog.riding).toBe(false);
    expect(dog.y).toBeCloseTo(0);
    run(dog, 2, ctx({ rack: rack() }));
    expect(dog.riding).toBe(false);
    run(dog, 15, ctx({ rack: rack() }));
    expect(dog.riding).toBe(true);
  });

  it('hops down if a girl sits on the back', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.mount(rack());
    run(dog, 2, ctx({ rack: rack({ ok: false }) }));
    expect(dog.riding).toBe(false);
  });

  it('chases a quad going by, barking, and gives up', () => {
    const dog = make({ chaseRate: 100, bootsRate: 0, chaseSeconds: 6 });
    dog.place(0, 0);
    const quad = (t) => ctx({ vehicles: [{ id: 'amy', x: 10, z: 5 + t * 5, speed: 5, yaw: 0, driver: 'amy' }] });
    const events = run(dog, 3, quad);
    expect(events.find((e) => e.kind === 'chase')).toMatchObject({ id: 'amy', girl: 'amy' });
    expect(events.filter((e) => e.kind === 'bark').length).toBeGreaterThan(0);
    expect(dog.mode).toBe('chase');
    run(dog, 10, (t) => quad(t + 3));
    expect(dog.mode).not.toBe('chase');
    // and not again at once
    run(dog, 2, quad(0));
    expect(dog.mode).not.toBe('chase');
  });

  it('runs to the side of what she chases, not under its wheels', () => {
    const dog = make({ chaseRate: 100, bootsRate: 0 });
    dog.place(0, 0);
    let hit = false;
    for (let t = 0; t < 8; t += 0.05) {
      const v = { id: 'q', x: 6, z: t * 6, speed: 6, yaw: 0, driver: null };
      dog.update(0.05, ctx({ vehicles: [v] }));
      if (t > 3 && Math.hypot(dog.x - v.x, dog.z - v.z) < 1) hit = true;
    }
    expect(hit).toBe(false);
  });

  it('nips at the heels of a walking girl', () => {
    const dog = make({ chaseRate: 0, bootsRate: 100, bootsSeconds: 5 });
    dog.place(0, 0);
    const events = run(dog, 3, (t) => ctx({ girls: [{ id: 'jess', x: 3, z: 2 + t * 1.4, yaw: 0, speed: 1.4 }] }));
    expect(events.find((e) => e.kind === 'nip')).toMatchObject({ id: 'jess' });
    expect(dog.mode).toBe('nip');
  });

  it('jumps clear of a vehicle coming at her', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.place(0, 20);
    const events = dog.update(0.05, ctx({ owner: { x: 0, z: 20, speed: 0, yaw: 0, riding: false }, vehicles: [{ id: 'q', x: 0, z: 14, speed: 8, yaw: 0, driver: null }] }));
    expect(events.some((e) => e.kind === 'yelp')).toBe(true);
    expect(dog.mode).toBe('dodge');
    run(dog, 1, ctx({ owner: { x: 0, z: 20, speed: 0, yaw: 0, riding: false } }));
    expect(Math.abs(dog.x)).toBeGreaterThan(2);
  });

  it('is put back beside you when she is lost a long way behind', () => {
    const dog = make({ chaseRate: 0, bootsRate: 0 });
    dog.place(0, 0);
    run(dog, 0.2, ctx({ owner: { x: 0, z: 250, speed: 10, yaw: 0, riding: true } }));
    expect(Math.hypot(dog.x, dog.z - 250)).toBeLessThan(15);
  });

  it('is put near you when a hedge holds her up and you are away', () => {
    const dog = new Dog({ allowed: (x) => x < 5, random: createRandom(3), params: { ...DEFAULT_DOG_PARAMS, chaseRate: 0, bootsRate: 0 } });
    dog.place(0, 0);
    run(dog, 10, ctx({ owner: { x: 40, z: 0, speed: 0, yaw: 0, riding: false } }));
    expect(dog.x).toBeLessThan(5);
    // the owner's side of the hedge is not reachable for her either, so she stays put without crashing
    expect(Number.isFinite(dog.x)).toBe(true);
  });
});
