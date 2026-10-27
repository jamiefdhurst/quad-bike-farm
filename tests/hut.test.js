import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createHill } from '../src/world/hill.js';
import { Track } from '../src/world/track.js';
import { hutShape, Stove, DEFAULT_HUT_PARAMS as P, HUT_PARAM_RANGES, HUT_INSIDE } from '../src/world/hut.js';
import { popRate } from '../src/audio/hutAudio.js';

const shape = hutShape(LAYOUT);
const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const hill = createHill(LAYOUT);

describe("the shepherd's hut: where it stands", () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) expect(HUT_PARAM_RANGES[k], k).toBeTruthy();
  });

  it('turns a point in its own frame into the world and back', () => {
    for (const [lx, lz] of [[0, 0], [0.62, 1.3], [-1, -2], [0.3, 2.6]]) {
      const w = shape.toWorld(lx, lz);
      const l = shape.toLocal(w.x, w.z);
      expect(l.x).toBeCloseTo(lx, 6);
      expect(l.z).toBeCloseTo(lz, 6);
    }
  });

  it('has its door end (local +z) facing the way the layout says, and its stove and seats inside the walls', () => {
    const door = shape.toWorld(0, shape.halfLength);
    expect(Math.hypot(door.x - shape.door.x, door.z - shape.door.z)).toBeLessThan(1e-9);
    expect(Math.atan2(door.x - shape.x, door.z - shape.z)).toBeCloseTo(Math.atan2(Math.sin(shape.yaw), Math.cos(shape.yaw)), 6);
    expect(shape.inside(shape.stove.x, shape.stove.z, 0.2)).toBe(true);
    for (const s of shape.seatPoints) expect(shape.inside(s.x, s.z, 0.2)).toBe(true);
    expect(shape.inside(shape.footOfSteps.x, shape.footOfSteps.z)).toBe(false);
    expect(shape.covered(shape.x, shape.z)).toBe(true);
    expect(shape.covered(shape.footOfSteps.x, shape.footOfSteps.z)).toBe(false);
  });

  it('gives the girls a way up: the steps, the door and the bunk, each a step or less higher', () => {
    let rise = 0;
    for (const p of shape.stepsWay) {
      expect(p.rise - rise).toBeLessThanOrEqual(0.3);
      rise = p.rise;
    }
    expect(rise).toBeCloseTo(shape.floor, 6);
    expect(HUT_INSIDE.stepTop).toBeLessThan(0.35); // the player's autostep
    expect(shape.floor - HUT_INSIDE.stepTop).toBeLessThan(0.35);
  });

  it('has a box for the girls to walk round that holds the whole hut and the drawbar', () => {
    const b = shape.box();
    for (const [lx, lz] of [[-1.2, -2], [1.2, 2], [0, -5.4], [0, 2.4]]) {
      const w = shape.toWorld(lx, lz);
      expect(w.x).toBeGreaterThanOrEqual(b.minX);
      expect(w.x).toBeLessThanOrEqual(b.maxX);
      expect(w.z).toBeGreaterThanOrEqual(b.minZ);
      expect(w.z).toBeLessThanOrEqual(b.maxZ);
    }
  });
});

describe('the hut on the hill', () => {
  const { pasture, fence, viewpoint, wood } = LAYOUT.hill;

  it('stands in the pasture, clear of its hedges, the fence, the wood and the flask rock', () => {
    const half = Math.max(shape.halfLength + 3.7, 6);
    expect(shape.x).toBeGreaterThan(pasture.minX + half);
    expect(shape.x).toBeLessThan(pasture.maxX - half);
    expect(shape.z).toBeGreaterThan(fence.z + 10);
    expect(shape.z + shape.halfLength + 1.6).toBeLessThan(pasture.maxZ - 1); // the drawbar's end
    expect(shape.x).toBeGreaterThan(wood.maxX + 3);
    expect(Math.hypot(shape.x - viewpoint.x, shape.z - viewpoint.z)).toBeGreaterThan(15);
  });

  it('is level under its walls and steps, so the floor meets the ground', () => {
    const at = (lx, lz) => {
      const w = shape.toWorld(lx, lz);
      return heights.heightAt(w.x, w.z);
    };
    const mid = at(0, 0);
    for (const [lx, lz] of [[-1.1, -2], [1.1, -2], [-1.1, 2], [1.1, 2], [0, 2.5], [0, -3.4]]) expect(Math.abs(at(lx, lz) - mid), `${lx},${lz}`).toBeLessThan(0.12);
  });

  it('keeps gorse, bracken and sheep off the ground round it', () => {
    for (const [dx, dz] of [[0, 0], [3, 3], [-4, 2], [0, -6]]) {
      expect(hill.gorseAt(shape.x + dx, shape.z + dz)).toBe(0);
      expect(hill.brackenAt(shape.x + dx, shape.z + dz)).toBe(0);
    }
    expect(hill.nearHut(shape.x + 2, shape.z)).toBe(true);
    expect(hill.nearHut(shape.x + 30, shape.z)).toBe(false);
  });

  it('is levelled only near itself', () => {
    expect(shape.levelK(shape.x, shape.z)).toBe(1);
    expect(shape.levelK(shape.x + 30, shape.z)).toBe(0);
  });
});

describe('the stove', () => {
  it('lights from cold, burns for its time, warms up and goes out', () => {
    const s = new Stove({ ...P });
    expect(s.action).toBe('light');
    expect(s.light()).toBe(true);
    expect(s.light()).toBe(false); // already going
    expect(s.lights).toBe(1);
    expect(s.warm).toBe(false);
    s.update(P.warmUp);
    expect(s.heat).toBeCloseTo(1, 6);
    expect(s.warm).toBe(true);
    const events = [];
    for (let t = 0; t < P.burnSeconds + 5; t++) events.push(...s.update(1));
    expect(events.filter((e) => e.type === 'out')).toHaveLength(1);
    expect(s.burning).toBe(false);
    expect(s.glowing).toBe(true); // still glowing
    s.update(P.coolDown);
    expect(s.glowing).toBe(false);
    expect(s.heat).toBe(0);
  });

  it('takes a log on a burning stove, up to its limit, and never on a cold one', () => {
    const s = new Stove({ ...P });
    expect(s.stoke()).toBe(false);
    s.light();
    expect(s.action).toBe('stoke');
    expect(s.stoke()).toBe(true);
    expect(s.fuel).toBeCloseTo(P.burnSeconds + P.logSeconds, 6);
    for (let i = 0; i < 20; i++) s.stoke();
    expect(s.fuel).toBeLessThanOrEqual(P.maxSeconds);
    expect(s.canStoke).toBe(false);
    expect(s.action).toBe(null);
  });

  it('warms a spot in the hut or by the door, but only once it is warm', () => {
    const s = new Stove({ ...P });
    expect(s.warms(true, 0)).toBe(false);
    s.light();
    s.update(P.warmUp);
    expect(s.warms(true, 20)).toBe(true);
    expect(s.warms(false, P.warmRadius - 0.1)).toBe(true);
    expect(s.warms(false, P.warmRadius + 5)).toBe(false);
  });

  it('boils the kettle only on a warm stove, and pours a mug in the time it takes', () => {
    const s = new Stove({ ...P });
    expect(s.pouring(1)).toBe(false); // cold
    s.light();
    const run = (seconds) => { for (let i = 0; i < seconds; i++) s.update(1); };
    run(P.warmUp * P.warmAt); // warm, but not for long
    expect(s.warm).toBe(true);
    expect(s.boiled).toBe(false);
    run(P.boilSeconds);
    expect(s.boiled).toBe(true);
    expect(s.pouring(P.pourSeconds / 2)).toBe(true);
    s.stopPouring(); // let go: it starts again from the top
    expect(s.pouring(P.pourSeconds * 0.9)).toBe(true);
    expect(s.pouring(P.pourSeconds * 0.2)).toBe('done');
    expect(s.boiled).toBe(false); // it needs a little to come back up
    run(P.boilSeconds);
    expect(s.boiled).toBe(true);
  });

  it('puts out and clears on reset, and smokes more the hotter it is', () => {
    const s = new Stove({ ...P });
    s.light();
    const early = s.smoke;
    s.update(P.warmUp);
    expect(s.smoke).toBeGreaterThan(early);
    s.reset();
    expect(s.burning).toBe(false);
    expect(s.heat).toBe(0);
    expect(s.kettle).toBe(0);
  });

  it('crackles faster the hotter it is, and not at all cold', () => {
    expect(popRate(0)).toBe(0);
    expect(popRate(1)).toBeGreaterThan(popRate(0.2));
  });
});
