import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FarDetail, detailLevel, isSmallPart, VEHICLE_NAMES, BARN_PROP_NAMES, SET_PIECE_NAMES } from '../src/world/farDetail.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../src/core/graphics.js';
import { LAYOUT } from '../src/world/layout.js';

const params = { ...DEFAULT_GRAPHICS_PARAMS };
const box = (w, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, w, w), mat ?? new THREE.MeshStandardMaterial());

function vehicle(x, z = 0) {
  const g = new THREE.Group();
  g.name = 'quad';
  g.position.set(x, 0, z);
  const body = box(1);
  body.castShadow = true;
  const bolt = box(0.02);
  bolt.castShadow = true;
  const lens = box(0.05, new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 2 }));
  g.add(body, bolt, lens);
  g.updateMatrixWorld(true);
  return { g, body, bolt, lens };
}

function sceneWith(...children) {
  const scene = new THREE.Scene();
  scene.add(...children);
  return scene;
}

describe('detailLevel', () => {
  it('is 0 near, 1 past the detail distance and 2 past the shadow distance', () => {
    expect(detailLevel(10, params)).toBe(0);
    expect(detailLevel(70, params)).toBe(1);
    expect(detailLevel(100, params)).toBe(2);
  });
  it('holds a level until the vehicle is well back inside its distance', () => {
    expect(detailLevel(58, params, 1)).toBe(1);
    expect(detailLevel(50, params, 1)).toBe(0);
    expect(detailLevel(78, params, 2)).toBe(2);
  });
  it('is 0 whatever the distance when a distance is 0', () => {
    expect(detailLevel(500, { vehicleDetailDistance: 0, shadowDistance: 0 })).toBe(0);
    expect(detailLevel(500, { vehicleDetailDistance: 60, shadowDistance: 0 })).toBe(1);
  });
});

describe('isSmallPart', () => {
  it('is true for a bolt and false for a body, a light lens or a part marked to keep', () => {
    const { body, bolt, lens } = vehicle(0);
    expect(isSmallPart(bolt)).toBe(true);
    expect(isSmallPart(body)).toBe(false);
    expect(isSmallPart(lens)).toBe(false);
    const kept = box(0.02);
    kept.userData.keepFar = true;
    expect(isSmallPart(kept)).toBe(false);
  });
});

describe('FarDetail vehicles', () => {
  it('hides small parts past the detail distance, then the shadows, and puts both back near', () => {
    const v = vehicle(0);
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 70, z: 0 }, 1);
    expect(v.bolt.visible).toBe(false);
    expect(v.body.visible).toBe(true);
    expect(v.lens.visible).toBe(true);
    expect(v.body.castShadow).toBe(true);
    far.update({ x: 100, z: 0 }, 1);
    expect(v.body.castShadow).toBe(false);
    far.update({ x: 5, z: 0 }, 1);
    expect(v.bolt.visible).toBe(true);
    expect(v.body.castShadow).toBe(true);
  });
  it('never lets a small part cast a shadow, near or far', () => {
    const v = vehicle(0);
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 0, z: 0 }, 1);
    expect(v.bolt.castShadow).toBe(false);
    expect(v.body.castShadow).toBe(true);
    far.update({ x: 300, z: 0 }, 1, true);
    far.update({ x: 0, z: 0 }, 1, true);
    expect(v.bolt.castShadow).toBe(false);
    expect(v.body.castShadow).toBe(true);
  });
  it('goes straight to the far level from close', () => {
    const v = vehicle(0);
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 300, z: 0 }, 1);
    expect(v.bolt.visible).toBe(false);
    expect(v.body.castShadow).toBe(false);
  });
  it('leaves a part the game had hidden hidden when it comes back', () => {
    const v = vehicle(0);
    v.bolt.visible = false;
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 70, z: 0 }, 1);
    far.update({ x: 0, z: 0 }, 1);
    expect(v.bolt.visible).toBe(false);
  });
  it('looks only every quarter second unless told to', () => {
    const v = vehicle(0);
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 0, z: 0 }, 0.3);
    far.update({ x: 70, z: 0 }, 0.1);
    expect(v.bolt.visible).toBe(true);
    far.update({ x: 70, z: 0 }, 0.1, true);
    expect(v.bolt.visible).toBe(false);
  });
});

describe('FarDetail set pieces and props', () => {
  function piece(name, x, z) {
    const g = new THREE.Group();
    g.name = name;
    const m = box(10);
    m.position.set(x, 0, z);
    g.add(m);
    g.updateMatrixWorld(true);
    return g;
  }
  it('hides a set piece past its distance from its nearest edge and shows it again', () => {
    const farm = piece('neighbourFarm', 200, 0); // spans x 195 to 205
    const far = new FarDetail(sceneWith(farm), params);
    far.update({ x: 0, z: 0 }, 1, true);
    expect(farm.visible).toBe(false);
    far.update({ x: 40, z: 0 }, 1, true); // 155 from the edge
    expect(farm.visible).toBe(true);
  });
  it('swaps a set piece with a far version for it beyond fullDistance, with a margin either way', () => {
    const village = piece('village', 200, 0); // spans x 195 to 205
    const farVersion = new THREE.Group();
    village.userData.farVersion = farVersion;
    const far = new FarDetail(sceneWith(village, farVersion), params);
    far.update({ x: 0, z: 0 }, 1, true);
    expect([village.visible, farVersion.visible]).toEqual([false, true]);
    far.update({ x: 160, z: 0 }, 1, true); // 35 from the edge
    expect([village.visible, farVersion.visible]).toEqual([true, false]);
    far.update({ x: 143, z: 0 }, 1, true); // 52 from the edge: past the distance, inside the margin
    expect([village.visible, farVersion.visible]).toEqual([true, false]);
    far.update({ x: 130, z: 0 }, 1, true); // 65
    expect([village.visible, farVersion.visible]).toEqual([false, true]);
    far.update({ x: 150, z: 0 }, 1, true); // 45 from the edge: back inside the distance only just
    expect([village.visible, farVersion.visible]).toEqual([false, true]);
  });
  it('always draws the full one with a fullDistance of 0', () => {
    const village = piece('village', 500, 0);
    const farVersion = new THREE.Group();
    village.userData.farVersion = farVersion;
    const far = new FarDetail(sceneWith(village, farVersion), { ...params, fullDistance: 0 });
    far.update({ x: 0, z: 0 }, 1, true);
    expect([village.visible, farVersion.visible]).toEqual([true, false]);
  });
  it('hides the barn props past the short distance', () => {
    const rack = piece('tyreRack', 0, 0);
    const far = new FarDetail(sceneWith(rack), params);
    far.update({ x: 15, z: 0 }, 1, true); // 10 from the edge
    expect(rack.visible).toBe(true);
    far.update({ x: 30, z: 0 }, 1, true);
    expect(rack.visible).toBe(false);
  });
  it('shows nothing it did not hide, and everything with a distance of 0', () => {
    const logs = piece('logs', 500, 0);
    const other = piece('somethingElse', 500, 0);
    other.visible = false;
    const far = new FarDetail(sceneWith(logs, other), params);
    far.update({ x: 0, z: 0 }, 1, true);
    expect(logs.visible).toBe(false);
    far.params = { ...params, setPieceDistance: 0 };
    far.update({ x: 0, z: 0 }, 1, true);
    expect(logs.visible).toBe(true);
    expect(other.visible).toBe(false);
  });
  it('keeps the name lists apart', () => {
    const all = [...VEHICLE_NAMES, ...BARN_PROP_NAMES, ...SET_PIECE_NAMES];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the names FarDetail looks for', () => {
  it('are all still given to something in src, so a rename cannot quietly leave a set piece undrawn-never', async () => {
    const { execSync } = await import('node:child_process');
    for (const name of [...VEHICLE_NAMES, ...BARN_PROP_NAMES, ...SET_PIECE_NAMES]) {
      const found = execSync(`grep -rlE "name = '${name}'" src || true`, { encoding: 'utf8' });
      expect(found.trim(), name).not.toBe('');
    }
  });
});

describe('BARN_PROP_NAMES', () => {
  // Only what is inside the barn may be hidden at the barn's short distance: something in the yard would vanish as you walk off (#402).
  const b = LAYOUT.barn;
  const inside = ({ x, z }) => Math.abs(x - b.x) <= b.halfX && z >= b.z - b.halfZ && z <= b.z + b.halfZ + 2 * b.annex.halfZ;
  const placed = { helmetHooks: [LAYOUT.helmetHooks], 'trolley-jack': [LAYOUT.jack], 'axle-stand': LAYOUT.axleStands };

  it('holds only things that stand inside the barn or its annex', () => {
    for (const [name, spots] of Object.entries(placed)) {
      expect(BARN_PROP_NAMES).toContain(name);
      for (const s of spots) expect(inside(s), `${name} at ${s.x}, ${s.z}`).toBe(true);
    }
  });

  it('leaves out the fuel tanks and the generator, which stand outside', () => {
    for (const s of [LAYOUT.fuelTank, LAYOUT.dieselBowser, LAYOUT.generator]) expect(inside(s)).toBe(false);
    expect(BARN_PROP_NAMES).not.toContain('fuelTank');
    expect(BARN_PROP_NAMES).not.toContain('generator');
  });
});

describe('small things far away', () => {
  function bench() {
    const g = new THREE.Group();
    g.name = 'mugShelf';
    const mug = box(0.1);
    mug.castShadow = true;
    const shelf = box(1);
    shelf.castShadow = true;
    g.add(mug, shelf);
    return { g, mug, shelf };
  }

  it('stops a small thing casting past the distance and gives it back when you return, leaving big things alone', () => {
    const { g, mug, shelf } = bench();
    g.position.set(30, 0, 0);
    const scene = sceneWith(g);
    scene.updateMatrixWorld(true);
    const far = new FarDetail(scene, params);
    far.update(new THREE.Vector3(0, 0, 0), 0, true);
    expect(mug.castShadow).toBe(false);
    expect(shelf.castShadow).toBe(true);
    far.update(new THREE.Vector3(25, 0, 0), 0, true);
    expect(mug.castShadow).toBe(true);
  });

  it('does not flicker on the line, and a distance of 0 leaves everything casting', () => {
    const { g, mug } = bench();
    g.position.set(19, 0, 0);
    const scene = sceneWith(g);
    scene.updateMatrixWorld(true);
    const far = new FarDetail(scene, params);
    far.update(new THREE.Vector3(-2, 0, 0), 0, true); // 21 m
    expect(mug.castShadow).toBe(false);
    far.update(new THREE.Vector3(0, 0, 0), 0, true); // 19 m: inside, but not by the margin
    expect(mug.castShadow).toBe(false);
    far.update(new THREE.Vector3(10, 0, 0), 0, true);
    expect(mug.castShadow).toBe(true);
    const off = new FarDetail(scene, { ...params, smallShadowDistance: 0 });
    off.update(new THREE.Vector3(500, 0, 0), 0, true);
    expect(mug.castShadow).toBe(true);
  });

  it('finds things added later, and gives a shadow back to one taken out while off', () => {
    const scene = sceneWith();
    const far = new FarDetail(scene, params);
    far.update(new THREE.Vector3(), 0, true);
    const { g, mug } = bench();
    g.position.set(60, 0, 0);
    scene.add(g);
    scene.updateMatrixWorld(true);
    far.update(new THREE.Vector3(), 0, true);
    expect(mug.castShadow).toBe(false);
    scene.remove(g);
    far.update(new THREE.Vector3(), 0, true);
    expect(mug.castShadow).toBe(true);
    expect(far.small.length).toBe(0);
  });
});
