import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { LAYOUT } from '../src/world/layout.js';
import { bayPlaces, buildBayKit, KERB, STOP } from '../src/world/bayKit.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The barn's working bays are marked with a wheel stop, corner kerbs, an oil stain and a drip tray, not paint (#404, #817).
const L = { ...LAYOUT, ...LAYOUT.barnLocal };
const bays = [L.bay, L.bay2];
const pit = L.shed.pit;
const inRect = (r, x, z, m = 0) => Math.abs(x - r.x) <= r.halfX + m && Math.abs(z - r.z) <= r.halfZ + m;

describe('the kit for each bay', () => {
  it('has a wheel stop across the back and four corner kerbs, all inside the bay', () => {
    for (const bay of bays) {
      const p = bayPlaces(bay);
      expect(p.back.x).toBeLessThan(bay.x - bay.halfX + 0.6); // at the west end, the end a quad nosing in from the door reaches
      expect(p.back.width).toBeLessThan(bay.halfZ * 2); // not wall to wall: a quad can be walked round
      expect(p.corners).toHaveLength(4);
      for (const c of p.corners) {
        expect(inRect(bay, c.x + c.sx * KERB.arm, c.z + c.sz * KERB.arm)).toBe(true);
        expect(KERB.h).toBeLessThan(0.1); // low enough to drive a quad over
      }
      expect(STOP.h).toBeLessThanOrEqual(0.12);
    }
  });
  it('keeps the oil stain and the drip tray clear of the pit in the big bay', () => {
    const p = bayPlaces(L.bay2);
    for (const spot of [p.stain, p.tray]) {
      const inPit = Math.abs(spot.x - pit.x) < pit.halfX + 0.5 && Math.abs(spot.z - pit.z) < pit.halfZ + 0.5;
      expect(inPit, JSON.stringify(spot)).toBe(false);
    }
  });
  it('puts the stain and the tray inside the bay', () => {
    for (const bay of bays) {
      const p = bayPlaces(bay);
      expect(inRect(bay, p.stain.x, p.stain.z)).toBe(true);
      expect(inRect(bay, p.tray.x, p.tray.z)).toBe(true);
    }
  });
});

describe('the built kit', () => {
  let group;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    group = buildBayKit({ bays, floorY: 0, random: () => 0.5 });
  });
  it('is a few merged meshes, none of them a collider, sitting on the floor', () => {
    let meshes = 0;
    group.traverse((o) => { if (o.isMesh) meshes++; });
    expect(meshes).toBeGreaterThan(3);
    expect(meshes).toBeLessThan(16);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeLessThan(0.14);
  });
  it('has no two faces on one plane', () => {
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });
});
