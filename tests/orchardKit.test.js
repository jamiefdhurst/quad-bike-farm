import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

// The orchard's hen house and pig ark (#682): no two faces on one plane (which flicker as alpha fighting), and their real sizes.
const build = async (name) => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const kit = await import('../src/world/orchardKit.js');
  return kit[name](() => 0.5);
};
const size = (g) => new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());

describe('the hen house', () => {
  it('has no two faces on one plane', async () => {
    const g = await build('buildHenHouse');
    const fights = coplanarOverlaps(g, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });
  it('is a hen house\'s size: about 1.5 by 1.4 m on the ground and under 2 m high, with a pop-hole, a ramp, a nest box, a perch and a feeder', async () => {
    const g = await build('buildHenHouse');
    const s = size(g);
    expect(s.y).toBeGreaterThan(1.2);
    expect(s.y).toBeLessThan(2);
    expect(s.x).toBeLessThan(2.6);
    let meshes = 0;
    g.traverse((o) => o.isMesh && meshes++);
    expect(meshes).toBeGreaterThan(40); // trim, cleats, hatch, hinges, vent and the rest: not a box
  });
});

describe('the pig ark', () => {
  it('has no two faces on one plane', async () => {
    const g = await build('buildPigArk');
    const fights = coplanarOverlaps(g, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });
  it('is an ark\'s size: about 2.4 m long and 1.5 m wide under a roof 1.2 to 1.5 m high, on skids', async () => {
    const g = await build('buildPigArk');
    const s = size(g);
    expect(s.x).toBeGreaterThan(2.4);
    expect(s.x).toBeLessThan(3.4);
    expect(s.z).toBeGreaterThan(1.4);
    expect(s.z).toBeLessThan(1.8);
    expect(s.y).toBeGreaterThan(1);
    expect(s.y).toBeLessThan(1.6);
  });
});
