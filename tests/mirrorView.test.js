import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildAllModels } from './helpers/vehicleModels.js';
import { DEFAULT_MIRROR_PARAMS, MIRROR_PARAM_RANGES, MirrorView, insideFootprint, lookingForward, mirrorKind, mirrorPictureSize, mirrorTurn, mirrorYaw } from '../src/vehicle/mirrorView.js';

describe('mirror maths', () => {
  it('reads a glass in the middle as the rear-view mirror and the others by their side', () => {
    expect(mirrorKind(0.05)).toEqual({ kind: 'interior', side: 0 });
    expect(mirrorKind(0.9)).toEqual({ kind: 'side', side: 1 });
    expect(mirrorKind(-0.9)).toEqual({ kind: 'side', side: -1 });
  });

  it('turns a side mirror outwards: the +X one towards +X, the -X one towards -X, the rear-view one not at all', () => {
    const back = (yaw) => new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    expect(back(mirrorYaw('side', 1)).x).toBeGreaterThan(0);
    expect(back(mirrorYaw('side', -1)).x).toBeLessThan(0);
    expect(mirrorYaw('interior', 0)).toBe(0);
  });

  it('draws mirrors one at a time, in turn, every few frames', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((f) => mirrorTurn(f, 2, 3))).toEqual([0, null, 1, null, 2, null, 0]);
    expect(mirrorTurn(0, 1, 0)).toBeNull();
    expect(mirrorTurn(5, 1, 2)).toBe(1);
  });

  it('draws only while you look ahead', () => {
    expect(lookingForward({ x: 0, z: 1 }, { x: 0, z: 1 }, 75)).toBe(true);
    expect(lookingForward({ x: 1, z: 0.1 }, { x: 0, z: 1 }, 75)).toBe(false);
    expect(lookingForward({ x: 0, z: -1 }, { x: 0, z: 1 }, 75)).toBe(false);
    expect(lookingForward({ x: 0, z: 0 }, { x: 0, z: 1 }, 75)).toBe(false);
  });

  it('leaves out someone sat in the vehicle but not someone behind it', () => {
    const half = { x: 1.3, z: 2.6 };
    expect(insideFootprint({ x: 0.4, z: -0.5 }, half)).toBe(true);
    expect(insideFootprint({ x: 0, z: -6 }, half)).toBe(false);
  });

  it('keeps a picture to a sensible shape', () => {
    expect(mirrorPictureSize(0.13, 0.075, 160)).toEqual([160, 92]);
    expect(mirrorPictureSize(0.1, 5, 160)).toEqual([160, 320]);
  });

  it('has a range for every parameter', () => {
    expect(Object.keys(MIRROR_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_MIRROR_PARAMS).sort());
    for (const [k, [lo, hi]] of Object.entries(MIRROR_PARAM_RANGES)) {
      expect(DEFAULT_MIRROR_PARAMS[k], k).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_MIRROR_PARAMS[k], k).toBeLessThanOrEqual(hi);
    }
  });
});

describe('the vehicles with working mirrors', () => {
  let models;
  beforeAll(async () => {
    models = await buildAllModels();
  });
  const view = (id) => new MirrorView(models.find((m) => m.id === id).model);

  it('gives the Tor, the Crag and the cars two door or wing mirrors and a rear-view one', () => {
    const withMirrors = models.filter((m) => m.spec.landRover || m.spec.car);
    expect(withMirrors.length).toBeGreaterThanOrEqual(5);
    for (const m of withMirrors) {
      const v = new MirrorView(m.model);
      const kinds = v.glasses.map((g) => g.kind).sort();
      expect(kinds, m.id).toEqual(['interior', 'side', 'side']);
      expect(v.glasses.filter((g) => g.side === 1).length, m.id).toBe(1);
      expect(v.glasses.filter((g) => g.side === -1).length, m.id).toBe(1);
    }
  });

  it('gives the UTV its two', () => {
    const utv = models.find((m) => m.spec.utv);
    expect(new MirrorView(utv.model).count).toBe(2);
  });

  it('leaves the quads and the tractor alone', () => {
    for (const m of models.filter((m) => !m.spec.landRover && !m.spec.car && !m.spec.utv)) expect(new MirrorView(m.model).count, m.id).toBe(0);
  });

  it('lays each picture just behind its glass, facing back, hidden until a view is drawn', () => {
    const utv = models.find((m) => m.spec.utv);
    const v = new MirrorView(utv.model);
    for (const g of v.glasses) {
      expect(g.plane.parent).toBe(g.glass);
      expect(g.plane.visible).toBe(false);
      expect(g.plane.geometry.attributes.normal.getZ(0)).toBeLessThan(0);
      expect(g.plane.position.z).toBeLessThan(g.glass.geometry.boundingBox.min.z);
    }
    v.setLive(true);
    expect(v.glasses.every((g) => !g.plane.visible)).toBe(true); // nothing drawn yet: the dull glass stays
  });
});
