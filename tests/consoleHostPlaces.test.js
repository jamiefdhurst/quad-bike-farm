import { describe, it, expect } from 'vitest';
import { createHost } from '../src/console/gameHost.js';

// `tp me to <place>` on the new farm (#949): one place per field by its key, but the wood and the pit go to the wood and the pit, not to the plan's empty
// fields of the same names (the wood is moved by #683, the pit is still where it was until #685).
const square = (x, z) => [[x, z], [x + 40, z], [x + 40, z + 40], [x, z + 40]];
const fields = [
  { name: 'wood', kind: 'wood', points: square(-300, -200) },
  { name: 'pit', kind: 'rough', points: square(200, -200) },
  { name: 'top', kind: 'arable', points: square(0, -200) },
];

const standIn = (extra = {}) => {
  const layout = {
    ...extra,
    spawn: { player: { x: 1, z: 2 } },
    woods: { gate: { x: 10, z: 11 }, leadIn: [[0, 0], [0, 30]], circuit: { points: [[12, 13]] }, ...extra.woods },
    fields,
  };
  const g = {
    units: [],
    companions: [],
    world: { heightAt: () => 0, layout, fields: { polygons: Object.fromEntries(fields.map((f) => [f.name, f.points])) } },
    trafficHost: { places: { rig: { stand: { x: 0, z: 0 } } } },
    villageHost: {},
  };
  return createHost(g);
};

describe('tp places on the new farm', () => {
  it('has a place for every field by its key, in the field', () => {
    const places = standIn().places();
    expect(places.top.x).toBeGreaterThan(0);
    expect(places.top.x).toBeLessThan(40);
    expect(places.top.z).toBeGreaterThan(-200);
    expect(places.top.z).toBeLessThan(-160);
  });
  it('keeps the wood\'s place at the wood\'s gate, not in the plan\'s empty wood field', () => {
    expect(standIn().places().wood).toEqual({ x: 10, z: 30 });
  });
  it('has no pit place while there is no pit built, rather than the plan\'s empty pit field', () => {
    expect(standIn().places().pit).toBeUndefined();
  });
});

describe('tp places in Hollow Wood on the new farm (#683)', () => {
  const wood = { woods: { oak: { x: -40, z: -60 } }, logYard: { park: { x: 5, z: 6 }, scenery: { block: { x: 1, z: 1 } } } };
  it('has a place at the woodpile, six metres south of where the tractor stands, and one south of the great oak', () => {
    const places = standIn(wood).places();
    expect(places.woodpile).toEqual({ x: 5, z: 12 });
    expect(places.veteranoak).toEqual({ x: -40, z: -48 });
  });
  it('has neither on today\'s farm, which has no scenery at its woodpile and no great oak', () => {
    const today = standIn({ logYard: { park: { x: 0, z: 0 } } }).places();
    expect(today.woodpile).toBeUndefined();
    expect(today.veteranoak).toBeUndefined();
  });
});

describe('tp places for the field landmarks (#815)', () => {
  const landmarks = [
    { field: 'hay', kind: 'loneAsh', at: [100, 50] },
    { field: 'north', kind: 'loneOak', at: [-20, -150] },
    { field: 'sheep', kind: 'fieldBarn', at: [30, 30], builtBy: '#624' },
  ];
  it('has a place for each landmark the game builds, by its kind in lower case, ten metres south of it', () => {
    const places = standIn({ fieldLandmarks: landmarks }).places();
    expect(places.loneash).toEqual({ x: 100, z: 60 });
    expect(places.loneoak).toEqual({ x: -20, z: -140 });
  });
  it('has none for a landmark another issue builds, and none on today\'s farm', () => {
    expect(standIn({ fieldLandmarks: landmarks }).places().fieldbarn).toBeUndefined();
    const today = standIn().places();
    for (const k of ['loneash', 'loneoak', 'oldgateposts', 'deadelm', 'farpond', 'castroller', 'brookalders', 'bigoaks']) expect(today[k], k).toBeUndefined();
  });
});


describe('tp me cattlegrid (#568)', () => {
  it('stands you eight metres west of the drive\'s grid on the new farm', () => {
    const places = standIn({ road: { z: -20, grid: { x: 361.7, length: 3.6 } } }).places();
    expect(places.cattlegrid).toEqual({ x: 353.7, z: -20 });
  });
  it('has no such place on a layout with no grid', () => {
    expect(standIn().places().cattlegrid).toBeUndefined();
  });
});

describe('tp me neighbour (#569)', () => {
  const yard = (side) => ({ neighbourFarm: { yard: { minX: 100, maxX: 195, minZ: -40, maxZ: 45, wall: 0.5, wallHeight: 1.3 }, gateway: { x: 100, z: 2, width: 8, side }, house: { x: 150, z: 30, halfX: 7, halfZ: 4.2, wallHeight: 5, ridge: 7, door: { x: 150, z: 25.8, halfWidth: 0.55, height: 2 } }, barn: { x: 120, z: -20, halfX: 13, halfZ: 8.5, wallHeight: 4.8, ridge: 7.6, door: { x: 133, z: -20, halfWidth: 2.6, height: 3.6 } }, parked: [], stand: { x: 148, z: 22, yaw: 3 } } });
  it('stands you three metres inside her gateway, whichever wall it is in', () => {
    expect(standIn(yard('west')).places().neighbour).toEqual({ x: 103.25, z: 2 });
    expect(standIn(yard('east')).places().neighbour).toEqual({ x: 191.75, z: 2 });
  });
  it('has no such place on a farm with no neighbour', () => {
    expect(standIn().places().neighbour).toBeUndefined();
  });
});

describe('tp places on the village\'s approach (#819)', () => {
  const approach = {
    publicLane: { x: 385, open: { minZ: 0 } },
    village: { approach: { signs: [{ x: 389.2, z: 121 }], farm: { gateway: { x: 412, z: 94.5 } } } },
  };
  it('has one on the lane 40 m before the north signs and one on the track in front of the small farm\'s gateway', () => {
    const places = standIn(approach).places();
    expect(places.approach).toEqual({ x: 385, z: 81 });
    expect(places.smallfarm).toEqual({ x: 403, z: 94.5 });
  });
  it('has neither on today\'s farm, which has no approach', () => {
    const today = standIn({ village: {} }).places();
    expect(today.approach).toBeUndefined();
    expect(today.smallfarm).toBeUndefined();
  });
});
