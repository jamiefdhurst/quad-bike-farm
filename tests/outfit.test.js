import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OUTFITS, withShirt, cullRays } from '../src/npc/outfit.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';

describe('withShirt', () => {
  it('recolours the shirt and the polo together and leaves the rest alone', () => {
    const out = withShirt(OUTFITS.farmPolo, 0xe9c21b);
    expect(out.colors.shirt).toBe('#e9c21b');
    expect(out.polo).toBe('#e9c21b');
    expect(out.colors.shoes).toBe(OUTFITS.farmPolo.colors.shoes);
    expect(out.shorts).toBe(OUTFITS.farmPolo.shorts);
  });

  it('pads short hex numbers and does not change the original', () => {
    expect(withShirt(OUTFITS.jessPolo, 0x2e6b30).colors.shirt).toBe('#2e6b30');
    expect(withShirt(OUTFITS.jessPolo, 0x0000ff).colors.shirt).toBe('#0000ff');
    expect(OUTFITS.jessPolo.colors.shirt).toBe('#8e2238');
  });

  it('works for every quad colour', () => {
    for (const spec of Object.values(QUAD_SPECS)) expect(withShirt(OUTFITS.farmPolo, spec.bodyColor).colors.shirt).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('cullRays', () => {
  const body = () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshBasicMaterial());
    mesh.position.set(0.4, 1.1, -0.2);
    mesh.rotation.set(0.3, 0.8, 0.1);
    mesh.scale.setScalar(1.5);
    mesh.updateMatrixWorld(true);
    return mesh;
  };

  it('finds the same hits as three does on its own, from every side', () => {
    const plain = body();
    const culled = cullRays(body());
    const caster = new THREE.Raycaster();
    let hit = 0;
    for (let i = 0; i < 200; i++) {
      const from = new THREE.Vector3().setFromSphericalCoords(0.9, Math.acos(1 - ((i * 0.618) % 1) * 2), i * 2.4).add(new THREE.Vector3(0.4, 1.1, -0.2));
      const to = new THREE.Vector3(0.4, 1.1, -0.2).add(new THREE.Vector3((i % 7) * 0.02 - 0.06, (i % 5) * 0.02 - 0.04, 0));
      caster.set(from, to.clone().sub(from).normalize());
      caster.far = from.distanceTo(to);
      const a = caster.intersectObject(plain, false).map((h) => h.distance);
      const b = caster.intersectObject(culled, false).map((h) => h.distance);
      expect(b).toEqual(a);
      hit += a.length;
    }
    expect(hit).toBeGreaterThan(150);
  });

  it('keeps every triangle for the next ray', () => {
    const culled = cullRays(body());
    const caster = new THREE.Raycaster(new THREE.Vector3(5, 5, 5), new THREE.Vector3(0, 1, 0), 0, 0.1);
    expect(caster.intersectObject(culled, false)).toHaveLength(0);
    caster.set(new THREE.Vector3(0.4, 3, -0.2), new THREE.Vector3(0, -1, 0));
    caster.far = 5;
    expect(caster.intersectObject(culled, false).length).toBeGreaterThan(0);
  });

  it('leaves the index it was given alone, as the real body shares it with the copy', () => {
    const mesh = body();
    const shared = mesh.geometry.index;
    const before = Array.from(shared.array);
    const culled = cullRays(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', mesh.geometry.attributes.position).setIndex(shared), mesh.material));
    const caster = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0), 0, 20);
    caster.intersectObject(culled, false);
    expect(Array.from(shared.array)).toEqual(before);
    expect(mesh.geometry.index).toBe(shared);
  });
});
