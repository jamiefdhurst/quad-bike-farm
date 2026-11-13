import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CargoHold, slideLimits } from '../src/vehicle/cargoHold.js';
import { BED_CARGO_SPOTS, BED_CARGO_YAWS, BED_CARGO_YAW } from '../src/vehicle/utvModel.js';
import { DEF_LOAD_SPOTS, DEF_LOAD_ROOM, DEF_LOAD_YAWS, DEF_LOAD_YAW } from '../src/vehicle/cragBody.js';
import { TOR_TUB_SPOTS, TOR_TUB_ROOM } from '../src/vehicle/torBody.js';
import { CARGO_FOOTPRINTS } from '../src/vehicle/tipTrailerModel.js';

// A stand-in for a jerry can: the bits of an item the hold touches.
function fakeItem(name, scene) {
  const model = new THREE.Group();
  model.name = name;
  scene.add(model);
  const item = { model, held: true, putDown: (pos, yaw) => { item.held = false; scene.add(model); model.position.copy(pos); model.rotation.set(0, yaw, 0); } };
  return item;
}

function setup() {
  const scene = new THREE.Scene();
  const bed = new THREE.Group();
  scene.add(bed);
  const anchors = BED_CARGO_SPOTS.map((s) => {
    const a = new THREE.Object3D();
    a.position.set(s.x, 0.085, s.z);
    bed.add(a);
    return a;
  });
  const hold = new CargoHold({ scene, ground: () => 0, anchors, yawFor: (i) => BED_CARGO_YAWS[i.model.name] ?? BED_CARGO_YAW });
  return { scene, bed, hold };
}

describe('what stands in the UTV bed', () => {
  it('fits between the wheel wells, the front wall and the tailgate', () => {
    const turned = ([name, { w, d }]) => (Math.abs(Math.sin(BED_CARGO_YAWS[name] ?? BED_CARGO_YAW)) > 0.5 ? { w: d, d: w, name } : { w, d, name });
    for (const spot of BED_CARGO_SPOTS) {
      for (const f of Object.entries(CARGO_FOOTPRINTS).map(turned)) {
        expect(Math.abs(spot.x) + f.w / 2).toBeLessThanOrEqual(f.name === 'jumpLeads' ? 0.5 : 0.45); // the leads are low and may overhang a well a little
        expect(spot.z + f.d / 2).toBeLessThanOrEqual(1.09); // the front wall's inner face, in the bed's frame
        expect(spot.z - f.d / 2).toBeGreaterThanOrEqual(0.02); // clear of the tailgate
      }
    }
  });

  it('takes an item in a free spot, turns it, and says when it is full', () => {
    const { scene, hold } = setup();
    const items = BED_CARGO_SPOTS.map(() => fakeItem('jerryCan', scene));
    items.forEach((i) => expect(hold.load(i)).toBe(true));
    expect(hold.items.length).toBe(BED_CARGO_SPOTS.length);
    expect(hold.freeSpot()).toBeNull();
    expect(hold.load(fakeItem('toolbox', scene))).toBe(false);
    expect(items[0].model.rotation.y).toBeCloseTo(BED_CARGO_YAW);
    expect(hold.holds(items[0])).toBe(true);
  });

  it('frees a spot when an item is picked up again', () => {
    const { scene, hold } = setup();
    const a = fakeItem('jerryCan', scene);
    hold.load(a);
    expect(hold.freeSpot()).toBe(1);
    scene.add(a.model); // what picking it up does: leaves the spot
    expect(hold.items).toEqual([]);
    expect(hold.holds(a)).toBe(false);
    expect(hold.freeSpot()).toBe(0);
  });

  it('slides everything out behind and sets it down on the ground', () => {
    const { scene, bed, hold } = setup();
    bed.position.set(0, 1, 0);
    bed.updateMatrixWorld(true);
    const a = fakeItem('jerryCan', scene);
    hold.load(a);
    hold.tipOut(new THREE.Vector3(0, 0, -1));
    expect(hold.items).toEqual([]);
    expect(hold.freeSpot()).toBe(0);
    for (let t = 0; t < 1.5; t += 0.1) hold.update(0.1);
    expect(a.held).toBe(false);
    expect(a.model.parent).toBe(scene);
    expect(a.model.position.y).toBe(0);
    expect(a.model.position.z).toBeLessThan(BED_CARGO_SPOTS[0].z - 1);
    expect(hold.flying.length).toBe(0);
  });
});

describe('what stands in the Tor and the Crag\' backs', () => {
  const NAMES = Object.keys(CARGO_FOOTPRINTS);
  const fits = (spots, room, yawFor) => {
    for (const spot of spots) {
      for (const name of NAMES) {
        const lim = slideLimits(room, spot, name, yawFor(name), false);
        const over = name === 'jumpLeads' ? 0.06 : 0; // the leads are low and may overhang a wheel hump a little
        expect(lim.minX, `${name} at ${spot.x}`).toBeLessThanOrEqual(over);
        expect(lim.maxX, `${name} at ${spot.x}`).toBeGreaterThanOrEqual(-over);
        expect(lim.minZ, `${name} at ${spot.z}`).toBeLessThanOrEqual(0);
        expect(lim.maxZ, `${name} at ${spot.z}`).toBeGreaterThanOrEqual(0);
      }
    }
  };

  it('has every spot in the Crag\'s load space big enough for each thing, the way it lies', () => {
    fits(DEF_LOAD_SPOTS, DEF_LOAD_ROOM, (n) => DEF_LOAD_YAWS[n] ?? DEF_LOAD_YAW);
  });

  it('has every spot in the Tor\'s tub big enough for each thing', () => {
    fits(TOR_TUB_SPOTS, TOR_TUB_ROOM, () => BED_CARGO_YAW);
  });

  it('lets a thing slide past the edge only with the back open', () => {
    const spot = DEF_LOAD_SPOTS[0];
    const shut = slideLimits(DEF_LOAD_ROOM, spot, 'jerryCan', DEF_LOAD_YAW, false);
    const open = slideLimits(DEF_LOAD_ROOM, spot, 'jerryCan', DEF_LOAD_YAW, true);
    expect(spot.z + shut.minZ).toBeGreaterThan(DEF_LOAD_ROOM.z0);
    expect(spot.z + open.minZ).toBeLessThan(DEF_LOAD_ROOM.z0);
  });

  it('takes an item to a chosen spot, lists what stands where, and drops one out behind', () => {
    const { scene, bed, hold } = setup();
    bed.position.set(0, 1, 0);
    bed.updateMatrixWorld(true);
    const a = fakeItem('jerryCan', scene);
    const b = fakeItem('toolbox', scene);
    expect(hold.load(a, 3)).toBe(true);
    expect(hold.load(b, 3)).toBe(true); // that spot is taken: the next free one
    expect(hold.contents().map((c) => c.spot)).toEqual([0, 3]);
    hold.dropOut(a, new THREE.Vector3(0, 0, -1), 0.7);
    expect(hold.items).toEqual([b]);
    for (let t = 0; t < 1.5; t += 0.1) hold.update(0.1);
    expect(a.held).toBe(false);
    expect(a.model.parent).toBe(scene);
  });
});
