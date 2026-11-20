import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { FuelTank, bowserStand, STAND } from '../src/items/fuelTank.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The fuel tank and the diesel bowser stand on a slab that follows the ground, and the nozzle hangs in its holster on the pump's post (#614, #817).
beforeAll(() => vi.stubGlobal('document', { createElement: () => fakeCanvas() }));
const chain = () => new Proxy(function () {}, { get: () => chain(), apply: () => chain() });
const stub = { createCollider: () => ({}), ColliderDesc: chain() };
const make = (heightAt, position, scale = 1, yaw = 0) => {
  const scene = new THREE.Scene();
  const tank = new FuelTank({ scene, physics: stub, RAPIER: stub, world: { heightAt }, position, yaw, scale });
  tank.model.updateMatrixWorld(true);
  return tank;
};

describe('the slab a bowser stands on', () => {
  const slope = (x) => 0.12 * x; // a steep bank, 12 cm in a metre
  it('is buried below the lowest ground under it and tops the highest, so a slope leaves no gap under the tank', () => {
    const s = bowserStand((x, z) => slope(x), 10, 4, 0);
    expect(s.hi).toBeCloseTo(slope(10 + STAND.x / 2), 6);
    expect(s.lo).toBeCloseTo(slope(10 - STAND.x / 2), 6);
    expect(s.bottom).toBeLessThan(s.lo);
    expect(s.top).toBeGreaterThan(s.hi);
    expect(s.top - s.hi).toBeCloseTo(STAND.rise, 6);
  });
  it('is measured under the slab turned with the tank, not under an unturned one', () => {
    const turned = bowserStand((x) => slope(x), 0, 0, Math.PI / 2); // the slab's long side now runs along z, so it spans only 1.7 m of x
    expect(turned.hi - turned.lo).toBeCloseTo(0.12 * STAND.z, 6);
  });
  it('puts the model on that top and a collider on it, at the new farm\'s two tanks on its real ground', () => {
    const two = layoutNew(LAYOUT, RAW_LAYOUT);
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    for (const [place, scale] of [[two.fuelTank, 1], [two.dieselBowser, 0.8]]) {
      const tank = make((x, z) => heights.heightAt(x, z), place, scale, place.yaw);
      const s = tank.stand;
      expect(tank.model.position.y).toBeCloseTo(s.top, 9);
      const lowest = s.bottom;
      const slab = tank.model.children[0];
      slab.geometry.computeBoundingBox();
      const bottom = tank.model.position.y + slab.position.y * scale + slab.geometry.boundingBox.min.y * scale;
      expect(bottom).toBeCloseTo(lowest, 6);
      expect(s.top - s.hi).toBeCloseTo(STAND.rise * scale, 6);
    }
  });
});

describe('the nozzle on the bowser', () => {
  it('hangs in its holster on the post, and the hose runs to it from the valve', () => {
    const tank = make(() => 0, { x: 0, z: 0 });
    const nozzle = tank.model.getObjectByName('nozzle');
    const holster = tank.model.getObjectByName('holster');
    const hose = tank.model.getObjectByName('hose');
    expect(nozzle.position.distanceTo(holster.position)).toBeLessThan(0.1); // the spout is down in the cup
    expect(nozzle.position.y).toBeGreaterThan(STAND.rise); // above the slab
    hose.geometry.computeBoundingBox();
    const box = hose.geometry.boundingBox;
    const swivel = nozzle.position.clone().setY(nozzle.position.y + 0.235);
    expect(box.expandByScalar(0.03).containsPoint(swivel)).toBe(true); // its far end reaches the swivel rather than ending in the air
  });
});
