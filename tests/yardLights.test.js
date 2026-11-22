import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { barnFrame, barnShape } from '../src/world/barn.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { yardLightLevel, poleSpot, gableSpot, buildYardLights, FLOOD_CANDELA } from '../src/world/yardLights.js';
import { vaneHeading, turnBetween, buildWeatherVane } from '../src/world/weatherVane.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The yard's floodlights and the weather vane on the barn's ridge (#817, #171, #169).
const two = LAYOUT;
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const stream = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const inRect = (r, x, z, m = 0) => x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m;
const keepRects = two.farmstead.keptClear.map((k) => k.rect).filter(Boolean);

describe('when the floodlights burn', () => {
  it('is off in daylight, up in the dark and off when the generator is', () => {
    expect(yardLightLevel(0, true)).toBe(0);
    expect(yardLightLevel(0.2, true)).toBe(0);
    expect(yardLightLevel(1, true)).toBe(1);
    expect(yardLightLevel(1, false)).toBe(0);
  });
  it('comes up smoothly through dusk', () => {
    let last = 0;
    for (let d = 0.3; d <= 0.55; d += 0.025) {
      const l = yardLightLevel(d, true);
      expect(l).toBeGreaterThanOrEqual(last);
      last = l;
    }
    expect(yardLightLevel(0.4, true)).toBeGreaterThan(0);
    expect(yardLightLevel(0.4, true)).toBeLessThan(1);
  });
});

describe('where the floodlights are', () => {
  it('stands the pole behind the two tanks, between them along their length, out of everything kept clear', () => {
    const p = poleSpot(two);
    expect(p.x).toBeGreaterThan(Math.min(two.fuelTank.x, two.dieselBowser.x));
    expect(p.x).toBeLessThan(Math.max(two.fuelTank.x, two.dieselBowser.x));
    expect(p.z).toBeLessThan(Math.min(two.fuelTank.z, two.dieselBowser.z) - 1.5); // the tanks' labels face south, the pole stands on their back
    for (const r of keepRects) expect(inRect(r, p.x, p.z, 1), JSON.stringify(r)).toBe(false);
  });
  it('hangs the floodlight on the barn\'s doors\' wall under the eaves, past where the door leaves rest, facing out of it', () => {
    const floorY = heights.heightAt(two.barn.x, two.barn.z);
    const g = gableSpot(two, floorY);
    const s = barnShape({ ...two, ...two.barnLocal });
    const f = barnFrame(two);
    const out = f.vecToWorld(1, 0);
    const gate = f.toWorld(s.outer.maxX, s.z); // the doors' wall, at the doorway
    expect((g.x - gate.x) * out.x + (g.z - gate.z) * out.z).toBeGreaterThan(0.1); // outside the wall
    expect((g.x - gate.x) * out.x + (g.z - gate.z) * out.z).toBeLessThan(0.6); // and on it
    expect(g.y).toBeGreaterThan(floorY + s.door.height); // above the doorway's header
    expect(g.y).toBeLessThan(floorY + s.wallHeight); // under the eaves
    expect(Math.hypot(g.x - gate.x, g.z - gate.z)).toBeGreaterThan(s.door.maxZ - s.z + 3.5); // beyond the leaves parked either side of the doors
    expect(Math.sin(g.heading)).toBeCloseTo(out.x, 6);
    expect(Math.cos(g.heading)).toBeCloseTo(out.z, 6);
  });
});

describe('the built lights', () => {
  let group;
  const scene = new THREE.Scene();
  const boxes = [];
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    group = buildYardLights({ scene, layout: two, heights, fixedBox: (...a) => boxes.push(a), random: stream(5) });
  });
  it('are two floodlights with their lights off until set, and the lights live in the scene, not the group far detail hides', () => {
    const lights = [];
    scene.traverse((o) => { if (o.isSpotLight) lights.push(o); });
    expect(lights).toHaveLength(2);
    for (const l of lights) {
      expect(l.intensity).toBe(0);
      expect(group.getObjectById(l.id)).toBeUndefined();
    }
    group.userData.set(1);
    for (const l of lights) expect(l.intensity).toBe(FLOOD_CANDELA);
    group.userData.set(0);
    for (const l of lights) expect(l.intensity).toBe(0);
  });
  it('light the yard: each lamp aims at ground inside the slab, lower than the lamp', () => {
    const slab = two.farmstead.slab;
    for (const l of group.userData.lamps) expect(l.y).toBeGreaterThan(heights.heightAt(l.x, l.z) + 3);
    scene.traverse((o) => {
      if (!o.isSpotLight) return;
      const t = o.target.position;
      expect(t.y).toBeLessThan(o.position.y - 2);
      expect(inRect(slab, t.x, t.z)).toBe(true);
    });
  });
  it('has a collider for the pole, and a glass named lens for far detail to keep', () => {
    expect(boxes).toHaveLength(1);
    const lenses = [];
    group.traverse((o) => { if (o.name === 'lens') lenses.push(o); });
    expect(lenses).toHaveLength(2);
  });
});

describe('the weather vane', () => {
  it('comes round the short way to face into the wind', () => {
    expect(turnBetween(0.1, -0.1)).toBeCloseTo(-0.2, 9);
    expect(turnBetween(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6.0, 9); // across the half turn, the short way round
    let h = 0;
    for (let i = 0; i < 400; i++) h = vaneHeading(h, 1, 1, 0.05, 0);
    expect(Math.abs(turnBetween(h, 1 + Math.PI))).toBeLessThan(0.1); // wind blowing towards heading 1: it points back into it
  });
  it('turns faster in a stronger wind and barely flutters in a calm', () => {
    const slow = Math.abs(vaneHeading(0, Math.PI / 2, 0.3, 0.1, 0) - 0);
    const quick = Math.abs(vaneHeading(0, Math.PI / 2, 1.5, 0.1, 0) - 0);
    expect(quick).toBeGreaterThan(slow);
    const flutter = [0, 0.5, 1, 1.5].map((t) => vaneHeading(Math.PI, 0, 0, 0.02, t) - Math.PI);
    for (const f of flutter) expect(Math.abs(f)).toBeLessThan(0.01);
  });
  it('stands on the barn\'s ridge, points where it is told and has its N, S, E and W', () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const scene = new THREE.Scene();
    const vane = buildWeatherVane({ scene, layout: two, heights, random: stream(9) });
    const s = barnShape({ ...two, ...two.barnLocal });
    const floorY = heights.heightAt(s.x, s.z);
    expect(vane.position.y).toBeCloseTo(floorY + s.ridge + 0.12, 6);
    const f = barnFrame(two);
    // The new barn's ridge runs along the doors' wall (the barn's z), the vane near its east end; today's ran out of the doors.
    const ridgeEnds = s.wide ? [f.toWorld(s.x, s.outer.minZ), f.toWorld(s.x, s.outer.maxZ)] : [f.toWorld(s.outer.minX, s.z), f.toWorld(s.outer.maxX, s.z)];
    const along = new THREE.Vector2(ridgeEnds[1].x - ridgeEnds[0].x, ridgeEnds[1].z - ridgeEnds[0].z);
    const rel = new THREE.Vector2(vane.position.x - ridgeEnds[0].x, vane.position.z - ridgeEnds[0].z);
    const t = rel.dot(along) / along.lengthSq();
    expect(t).toBeGreaterThan(0.5);
    expect(t).toBeLessThan(1);
    expect(Math.abs(rel.x * along.y - rel.y * along.x) / along.length()).toBeLessThan(0.01); // on the ridge's line
    for (const h of [0, 1.2, -2.4]) {
      vane.userData.set(h);
      vane.updateMatrixWorld(true);
      const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(vane.userData.head.getWorldQuaternion(new THREE.Quaternion()));
      expect(fwd.x).toBeCloseTo(Math.sin(h), 6);
      expect(fwd.z).toBeCloseTo(Math.cos(h), 6);
    }
    expect(vane.userData.letters.sort()).toEqual(['E', 'N', 'S', 'W']);
  });
});
