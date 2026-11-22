import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { StaticMerge, MERGED_LAYER, mergeByMaterial, mergeCandidate, mergeShadows, shadowMergeable } from '../src/world/staticMerge.js';
import { FarDetail, MERGED_NAMES, STILL_FIXTURES, BARN_PROP_NAMES } from '../src/world/farDetail.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../src/core/graphics.js';

const steel = new THREE.MeshStandardMaterial({ color: 0x888888 });
const paint = new THREE.MeshStandardMaterial({ color: 0xaa2222 });
const box = (material, x, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
/** A stand-in vehicle: five steel boxes and three painted ones, one of the steel ones on a wheel group that turns. */
function stand() {
  const root = new THREE.Group();
  root.name = 'quad';
  const wheel = new THREE.Group();
  wheel.add(box(steel, 3));
  root.add(wheel, box(steel, 1), box(steel, 2), box(steel, 4), box(steel, 5), box(paint, 6), box(paint, 7), box(paint, 8));
  return { root, wheel };
}
/** What the renderer would draw from `root`: meshes on layer 0 under visible parents. */
const drawn = (root) => {
  const out = [];
  const seen = (m) => { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; };
  root.updateMatrixWorld(true);
  root.traverse((m) => { if (m.isMesh && seen(m) && m.layers.test(new THREE.Layers())) out.push(m); });
  return out;
};
/** A look the way the game's frames make it: matrices current first, as the renderer leaves them. */
let clock = 0;
const update = (sm, root, fresh = false) => { root.updateMatrixWorld(true); clock += 1; return sm.update(root, clock, fresh); }; // a look is a second after the last
const look = (sm, root, times, fresh = false) => { for (let i = 0; i < times; i++) update(sm, root, fresh); };

describe('merging what stands still (#816)', () => {
  it('draws the meshes that hold still as one mesh a material, after they have held still for a while', () => {
    const { root } = stand();
    const sm = new StaticMerge({ hold: 3 });
    expect(drawn(root)).toHaveLength(8);
    look(sm, root, 3);
    expect(drawn(root)).toHaveLength(8); // not yet: the first look only sees where they are
    look(sm, root, 1);
    const now = drawn(root);
    expect(now).toHaveLength(2);
    expect(now.every((m) => m.userData.mergedProxy)).toBe(true);
    expect(sm.counts(root)).toEqual({ merged: 8, proxies: 2 });
    expect(now.map((m) => m.geometry.attributes.position.count).sort((a, b) => a - b)).toEqual([72, 120]); // 5 and 3 boxes of 24 vertices
  });

  it('puts the originals on a layer nobody draws and leaves them in the root, found by name and in place', () => {
    const { root } = stand();
    root.children[1].name = 'tank';
    const sm = new StaticMerge({ hold: 1 });
    look(sm, root, 3);
    const tank = root.getObjectByName('tank');
    expect(tank.layers.mask).toBe(1 << MERGED_LAYER);
    expect(tank.visible).toBe(true);
    expect(tank.parent).toBe(root);
  });

  it('keeps the same picture: each proxy covers the same triangles in the same places as its sources', () => {
    const { root } = stand();
    root.position.set(10, 2, -5);
    root.rotation.y = 0.7;
    root.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(root);
    const sm = new StaticMerge({ hold: 1 });
    look(sm, root, 3);
    const proxies = drawn(root);
    const after = new THREE.Box3();
    for (const p of proxies) after.union(new THREE.Box3().setFromObject(p));
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-4);
    expect(proxies.reduce((n, p) => n + p.geometry.attributes.position.count, 0)).toBe(8 * 24);
  });

  it('leaves out a mesh that moves, and puts it back in when it holds still', () => {
    const { root, wheel } = stand();
    const sm = new StaticMerge({ hold: 2 });
    look(sm, root, 3);
    expect(sm.counts(root).merged).toBe(8);
    wheel.rotation.x += 0.3; // it turns: the next look sees it
    update(sm, root);
    const alone = drawn(root).filter((m) => !m.userData.mergedProxy);
    expect(alone).toHaveLength(1);
    expect(alone[0].parent).toBe(wheel);
    expect(sm.counts(root).merged).toBe(7); // the others stay merged, without it
    look(sm, root, 1);
    expect(sm.counts(root).merged).toBe(7); // it has held still for one look only
    look(sm, root, 4); // a root that changed waits twice as long the next time (4 s, not 2)
    expect(sm.counts(root).merged).toBe(8);
    expect(drawn(root).every((m) => m.userData.mergedProxy)).toBe(true);
  });

  it('stays merged when the whole root moves, since its meshes have not moved against it', () => {
    const { root } = stand();
    const sm = new StaticMerge({ hold: 2 });
    look(sm, root, 3);
    root.position.x += 5;
    root.rotation.y += 0.4;
    look(sm, root, 3);
    expect(sm.counts(root).merged).toBe(8);
  });

  it('takes a mesh out when it is hidden, loses its shadow or changes its material or geometry', () => {
    for (const change of [(m) => { m.visible = false; }, (m) => { m.castShadow = false; }, (m) => { m.material = paint; }, (m) => { m.geometry = new THREE.BoxGeometry(1, 1, 1); }]) {
      const { root } = stand();
      const sm = new StaticMerge({ hold: 2 });
      look(sm, root, 3);
      change(root.children[1]);
      update(sm, root);
      expect(root.children[1].layers.mask).not.toBe(1 << MERGED_LAYER);
      expect(drawn(root).filter((m) => m.userData.mergedProxy).length).toBeLessThanOrEqual(2);
    }
  });

  it('takes the whole of a hidden group out', () => {
    const { root, wheel } = stand();
    const sm = new StaticMerge({ hold: 2 });
    look(sm, root, 3);
    wheel.visible = false;
    look(sm, root, 3);
    expect(sm.counts(root).merged).toBe(7);
    expect(drawn(root).reduce((n, m) => n + m.geometry.attributes.position.count, 0)).toBe(7 * 24);
  });

  it('merges at once when it is judged from scratch, and puts everything back on release', () => {
    const { root } = stand();
    const sm = new StaticMerge({ hold: 8 });
    update(sm, root, true);
    expect(sm.counts(root).merged).toBe(8);
    sm.release(root);
    expect(drawn(root)).toHaveLength(8);
    expect(root.children.every((c) => !c.userData.mergedProxy)).toBe(true);
    expect(root.getObjectByProperty('isMesh', true).userData.mergedAway).toBeUndefined();
  });

  it('does not touch a lamp, a skin, an instanced batch, a mesh turned inside out or a lone mesh', () => {
    const root = new THREE.Group();
    const lens = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 1 }));
    const named = box(steel, 1);
    named.name = 'lens';
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), steel, 2);
    const mirrored = box(steel, 2);
    mirrored.scale.x = -1;
    const lone = box(paint, 5);
    root.add(lens, named, instanced, mirrored, lone, box(steel, 3), box(steel, 4));
    root.updateMatrixWorld(true);
    expect([lens, named, instanced].map(mergeCandidate)).toEqual([false, false, false]);
    const sm = new StaticMerge({ hold: 1 });
    look(sm, root, 3);
    expect(sm.counts(root)).toEqual({ merged: 2, proxies: 1 }); // the two plain steel boxes
    expect(lone.layers.mask).toBe(1);
    expect(mirrored.layers.mask).toBe(1);
    // and a lone mesh that stays left over does not make the root merge again on every look
    expect(update(sm, root)).toBe(false);
  });

  it('writes each mesh into the merged one where it stands, with its normals turned and its triangles numbered on', () => {
    const a = box(steel, 0);
    const b = box(steel, 0);
    const turn = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(5, 1, 2);
    const { proxies } = mergeByMaterial([{ mesh: a, matrix: new THREE.Matrix4() }, { mesh: b, matrix: turn }]);
    const geo = proxies[0].geometry;
    const n = a.geometry.attributes.position.count;
    expect(geo.attributes.position.count).toBe(2 * n);
    expect(geo.index.count).toBe(2 * a.geometry.index.count);
    expect(Math.max(...geo.index.array)).toBe(2 * n - 1);
    const expected = new THREE.Vector3().fromBufferAttribute(b.geometry.attributes.position, 3).applyMatrix4(turn);
    expect(new THREE.Vector3().fromBufferAttribute(geo.attributes.position, n + 3).distanceTo(expected)).toBeLessThan(1e-5);
    const normal = new THREE.Vector3().fromBufferAttribute(b.geometry.attributes.normal, 3).transformDirection(turn);
    expect(new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, n + 3).distanceTo(normal)).toBeLessThan(1e-5);
    expect(new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, 3).distanceTo(new THREE.Vector3().fromBufferAttribute(a.geometry.attributes.normal, 3))).toBeLessThan(1e-6);
    expect(Array.from(geo.attributes.uv.array.slice(2 * n))).toEqual(Array.from(b.geometry.attributes.uv.array));
  });

  it('merges a part with creases (un-indexed by the wear bake) with the smooth ones of its material (#1041)', () => {
    const a = box(steel, 0);
    const b = box(steel, 1);
    b.geometry = b.geometry.toNonIndexed();
    const c = box(steel, 2);
    const { proxies, merged } = mergeByMaterial([a, b, c].map((mesh) => ({ mesh, matrix: new THREE.Matrix4() })));
    expect(proxies).toHaveLength(1);
    expect(merged).toHaveLength(3);
    const geo = proxies[0].geometry;
    const n = a.geometry.attributes.position.count;
    const nb = b.geometry.attributes.position.count; // 36: a vertex for each corner of each triangle
    expect(geo.attributes.position.count).toBe(2 * n + nb);
    expect(geo.index.count).toBe(2 * a.geometry.index.count + nb);
    // b's triangles are numbered in order, after a's vertices: the first corner of its first triangle is its own first vertex
    const first = geo.index.array[a.geometry.index.count];
    expect(first).toBe(n);
    expect(new THREE.Vector3().fromBufferAttribute(geo.attributes.position, first).distanceTo(new THREE.Vector3().fromBufferAttribute(b.geometry.attributes.position, 0))).toBeLessThan(1e-6);
    // and c's after b's
    expect(geo.index.array[a.geometry.index.count + nb]).toBe(n + nb);
  });

  it('does not merge the same material over different attributes', () => {
    const a = box(steel, 0);
    const b = box(steel, 1);
    b.geometry.deleteAttribute('uv');
    const { proxies } = mergeByMaterial([a, b, box(steel, 2)].map((mesh) => ({ mesh, matrix: new THREE.Matrix4() })));
    expect(proxies).toHaveLength(1); // a and the third, with uvs; b is left
    expect(proxies[0].userData.sources).toHaveLength(2);
  });

  it('is switched off with the Tune tab\'s mergeStill, which puts everything back', () => {
    const { root } = stand();
    const scene = new THREE.Scene();
    scene.add(root);
    const far = new FarDetail(scene, { ...DEFAULT_GRAPHICS_PARAMS });
    const at = new THREE.Vector3(100, 0, 100);
    far.update(at, 0, true, true);
    expect(far.merge.counts(root).merged).toBe(8);
    far.params = { ...far.params, mergeStill: 0 };
    far.update(at, 0, true, true);
    expect(far.merge.counts(root).merged).toBe(0);
    expect(drawn(root)).toHaveLength(8);
  });

  it('looks at a vehicle near you every quarter second and one far off every couple of seconds', () => {
    const near = stand().root;
    const far = stand().root;
    far.position.set(100, 0, 0);
    const scene = new THREE.Scene();
    scene.add(near, far);
    scene.updateMatrixWorld(true);
    const fd = new FarDetail(scene, { ...DEFAULT_GRAPHICS_PARAMS });
    const at = new THREE.Vector3(0, 0, 5);
    fd.update(at, 0, true, true);
    expect(fd.merge.counts(near).merged).toBe(8);
    expect(fd.merge.counts(far).merged).toBe(8);
    for (const r of [near, far]) r.children[1].visible = false; // something changes
    fd.update(at, 0.3); // the next look at the scene
    expect(fd.merge.counts(near).merged).toBe(7);
    expect(fd.merge.counts(far).merged).toBe(8);
    for (let i = 0; i < 10; i++) fd.update(at, 0.3); // three seconds on
    expect(fd.merge.counts(far).merged).toBe(7);
  });

  it('puts a vehicle back as it was the moment it is woken, as when you get on it', () => {
    const { root } = stand();
    const scene = new THREE.Scene();
    scene.add(root);
    scene.updateMatrixWorld(true);
    const fd = new FarDetail(scene, { ...DEFAULT_GRAPHICS_PARAMS });
    fd.update(new THREE.Vector3(0, 0, 5), 0, true, true);
    expect(drawn(root).every((m) => m.userData.mergedProxy)).toBe(true);
    fd.wake(root);
    expect(drawn(root)).toHaveLength(8);
    expect(drawn(root).some((m) => m.userData.mergedProxy)).toBe(false);
  });

  it('is not fought over with the specks: a merged-away part is left alone by the leaving-out of small parts', () => {
    const { root } = stand();
    const scene = new THREE.Scene();
    scene.add(root);
    const far = new FarDetail(scene, { ...DEFAULT_GRAPHICS_PARAMS });
    far.pixelsPerRadian = 700;
    far.update(new THREE.Vector3(100, 0, 0), 0, true, true);
    expect(far.merge.counts(root).merged).toBe(8);
    for (let i = 0; i < 3; i++) far.update(new THREE.Vector3(4000, 0, 0), 0, true, true);
    for (const m of root.children.filter((c) => !c.userData.mergedProxy)) expect(m.layers.mask === (1 << MERGED_LAYER) || m.children.length > 0).toBe(true);
  });

  it('names the vehicles, the barn and the farm animals', () => {
    expect(MERGED_NAMES).toEqual(expect.arrayContaining(['quad', 'trailer', 'barn', 'farmAnimals']));
  });

  it('names the barn\'s and the yard\'s fixtures, each one a group the game builds, and nothing you carry (#1041)', () => {
    expect(MERGED_NAMES).toEqual(expect.arrayContaining(STILL_FIXTURES));
    expect(STILL_FIXTURES).toEqual(expect.arrayContaining(BARN_PROP_NAMES));
    for (const carried of ['jerryCan', 'notebook', 'toolbox']) expect(STILL_FIXTURES).not.toContain(carried);
    const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(`${dir}/${d.name}`) : d.name.endsWith('.js') ? [`${dir}/${d.name}`] : []));
    const source = files('src').map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const name of STILL_FIXTURES) expect(source, name).toMatch(new RegExp(`name\\s*[=:]\\s*'${name}'`));
  });
});

/** A stand-in for the renderer's shadow pass: what it would draw, from the meshes that cast under visible parents, on layer 0. */
const shadowCasters = (root) => {
  const out = [];
  const seen = (m) => { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; };
  root.traverse((m) => { if (m.isMesh && m.castShadow && seen(m) && m.layers.test(new THREE.Layers())) out.push(m); });
  return out;
};

describe('the still things\' shadows as one mesh (#1041)', () => {
  it('draws a merged root\'s shadows in one call, and the camera never sees it', () => {
    const { root } = stand();
    const lone = box(new THREE.MeshStandardMaterial({ color: 0x334455 }), 9); // a part with a material of its own: drawn alone, but its shadow goes in
    root.add(lone);
    const sm = new StaticMerge({ hold: 1, shadows: true });
    look(sm, root, 3);
    expect(sm.counts(root)).toEqual({ merged: 8, proxies: 2, shadowProxies: 1, shadowLone: 1 });
    // the camera: the two merged meshes and the lone part, none of them casting but the lone one, and no shadow mesh
    expect(drawn(root)).toHaveLength(3);
    expect(drawn(root).filter((m) => m.castShadow)).toEqual([lone]);
    expect(drawn(root).some((m) => m.userData.shadowProxy)).toBe(false);
    // the sun's pass: the one shadow mesh, the lone part's own shadow held back
    sm.shadowPass(true);
    const casting = shadowCasters(root);
    expect(casting).toHaveLength(1);
    expect(casting[0].userData.shadowProxy).toBe(true);
    expect(Object.keys(casting[0].geometry.attributes)).toEqual(['position']);
    expect(casting[0].geometry.attributes.position.count).toBe(9 * 24);
    sm.shadowPass(false);
    expect(lone.castShadow).toBe(true);
    expect(shadowCasters(root).filter((m) => m.userData.shadowProxy)).toHaveLength(0);
  });

  it('covers the same places as the casters it stands in for', () => {
    const { root } = stand();
    root.position.set(10, 2, -5);
    root.rotation.y = 0.7;
    root.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(root);
    const sm = new StaticMerge({ hold: 1, shadows: true });
    look(sm, root, 3);
    sm.shadowPass(true);
    const after = new THREE.Box3().setFromObject(shadowCasters(root)[0]);
    sm.shadowPass(false);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-4);
  });

  it('leaves a cut-out, a displaced surface or one turned the other way to its own shadow, or a shadow of its own way round', () => {
    const cutOut = new THREE.MeshStandardMaterial({ alphaTest: 0.5 });
    const both = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    expect(shadowMergeable(box(cutOut, 0))).toBe(false);
    expect(shadowMergeable(box(new THREE.MeshStandardMaterial({ displacementMap: new THREE.Texture() }), 0))).toBe(false);
    const own = box(steel, 0);
    own.customDepthMaterial = new THREE.MeshDepthMaterial();
    expect(shadowMergeable(own)).toBe(false);
    const quiet = box(steel, 0);
    quiet.castShadow = false;
    expect(shadowMergeable(quiet)).toBe(false);
    const list = [box(steel, 0), box(paint, 1), box(both, 2), box(both, 3)].map((mesh) => ({ mesh, matrix: new THREE.Matrix4() }));
    const { proxies, casters } = mergeShadows(list);
    expect(proxies).toHaveLength(2); // the front-faced pair and the two-sided pair
    expect(casters.size).toBe(4);
    expect(proxies.map((p) => p.material.side).sort()).toEqual([THREE.FrontSide, THREE.DoubleSide].sort());
    // and in a root, the cut-out ones keep their own merged mesh casting
    const root = new THREE.Group();
    root.add(box(steel, 0), box(steel, 1), box(cutOut, 2), box(cutOut, 3));
    const sm = new StaticMerge({ hold: 1, shadows: true });
    look(sm, root, 3);
    const casting = drawn(root).filter((m) => m.castShadow);
    expect(casting).toHaveLength(1);
    expect(casting[0].material).toBe(cutOut);
  });

  it('puts every shadow back when the root is taken apart', () => {
    const { root, wheel } = stand();
    const sm = new StaticMerge({ hold: 1, shadows: true });
    look(sm, root, 3);
    wheel.rotation.x += 0.3;
    update(sm, root); // the wheel's box drops out: it casts its own shadow and the shadow mesh is made again without it
    sm.shadowPass(true);
    const casting = shadowCasters(root);
    sm.shadowPass(false);
    expect(casting).toHaveLength(2);
    expect(casting.filter((m) => m.userData.shadowProxy)[0].geometry.attributes.position.count).toBe(7 * 24);
    sm.release(root);
    expect(shadowCasters(root)).toHaveLength(8);
    expect(root.children.some((c) => c.userData.mergedProxy)).toBe(false);
  });

  it('leaves a hidden root as it is, so it is still merged when it comes back into view', () => {
    const { root } = stand();
    const sm = new StaticMerge({ hold: 1, shadows: true });
    look(sm, root, 3);
    root.visible = false;
    expect(update(sm, root)).toBe(false);
    expect(sm.counts(root).merged).toBe(8);
    root.visible = true;
    expect(update(sm, root)).toBe(false);
    expect(drawn(root).every((m) => m.userData.mergedProxy)).toBe(true);
  });

  it('is drawn only inside the renderer\'s shadow pass once FarDetail wraps it, and mergeShadows 0 gives each mesh its shadow back', () => {
    const { root } = stand();
    const scene = new THREE.Scene();
    scene.add(root);
    const seen = [];
    const renderer = { shadowMap: { render() { seen.push(shadowCasters(root).map((m) => !!m.userData.shadowProxy)); } } };
    const far = new FarDetail(scene, { ...DEFAULT_GRAPHICS_PARAMS });
    far.drawShadowsWith(renderer);
    const at = new THREE.Vector3(0, 0, 5); // near: a vehicle past `shadowDistance` casts nothing at all
    far.update(at, 0, true, true);
    renderer.shadowMap.render();
    expect(seen[0]).toEqual([true]);
    expect(shadowCasters(root)).toHaveLength(0); // outside the pass the merged meshes cast nothing and the shadow mesh is hidden
    far.params = { ...far.params, mergeShadows: 0 };
    far.update(at, 0, true, true);
    expect(far.merge.counts(root)).toEqual({ merged: 8, proxies: 2 });
    expect(shadowCasters(root)).toHaveLength(2); // the two merged meshes cast their own again
    renderer.shadowMap.render();
    expect(seen[1]).toEqual([false, false]);
  });

  it('casts as before without a renderer to wrap (the merge alone, #816)', () => {
    const { root } = stand();
    const scene = new THREE.Scene();
    scene.add(root);
    const far = new FarDetail(scene, { ...DEFAULT_GRAPHICS_PARAMS });
    far.drawShadowsWith({}); // a stand-in renderer with no shadow map
    far.update(new THREE.Vector3(0, 0, 5), 0, true, true);
    expect(shadowCasters(root)).toHaveLength(2);
  });
});
