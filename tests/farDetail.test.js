import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { FarDetail, detailLevel, isSmallPart, isSpeck, pointsAcross, pixelsPerRadian, SPECK_LAYER, VEHICLE_NAMES, BARN_PROP_NAMES, SET_PIECE_NAMES } from '../src/world/farDetail.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../src/core/graphics.js';
import { insideBarn } from '../src/world/barn.js';
import { LAYOUT } from '../src/world/layout.js';
import { BrushwoodHeap } from '../src/items/brushwood.js';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { distanceToTile } from '../src/world/tiles.js';
import { fromPlan, LANE_PLAN } from '../src/world/layoutNew.js';
import { approachSignSpecs } from '../src/world/village.js';

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

describe('the hedges and the wall', () => {
  it('runs every swap it is given, each judged by the same distance', () => {
    const seen = [];
    const far = new FarDetail(sceneWith(), params);
    far.hedgeSwaps = [{ update: (p, d, fresh) => seen.push(['hedges', p.x, d, fresh]) }, { update: (p, d, fresh) => seen.push(['wall', p.x, d, fresh]) }];
    far.update(new THREE.Vector3(5, 0, 0), 0, true, true);
    expect(seen).toEqual([['hedges', 5, params.hedgeFullDistance, true], ['wall', 5, params.hedgeFullDistance, true]]);
  });
});

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

describe('FarDetail looked at from scratch (#597)', () => {
  const near = { x: 0, y: 0, z: 0 };

  it('trims a vehicle by where you are, not by the margin it had on the way: the level it would be at first seen', () => {
    const v = vehicle(0);
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 70, z: 0 }, 1, true); // past the detail distance: small parts out
    far.update({ x: params.vehicleDetailDistance - 2, z: 0 }, 1, true); // inside the margin: it holds
    expect(v.bolt.visible).toBe(false);
    far.update({ x: params.vehicleDetailDistance - 2, z: 0 }, 1, true, true); // from scratch: it is within the distance, so the parts are back
    expect(v.bolt.visible).toBe(true);
  });

  it('hides the small parts it hid then and not those it would hide now, so wear fitted since is treated as the rest', () => {
    const v = vehicle(0);
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 70, z: 0 }, 1, true);
    const web = box(0.02); // fitted while it was hidden: not in what was hidden
    v.g.add(web);
    far.update({ x: 70, z: 0 }, 1, true, true);
    expect(v.bolt.visible).toBe(false);
    expect(web.visible).toBe(false);
  });

  it('marks what it hides, so the barn finds can tell it from what the game hid, and unmarks it when it is back', () => {
    const v = vehicle(0);
    const far = new FarDetail(sceneWith(v.g), params);
    far.update({ x: 70, z: 0 }, 1, true);
    expect(v.bolt.userData.farHidden).toBe(true);
    far.update(near, 1, true);
    expect(v.bolt.userData.farHidden).toBe(false);
  });

  it('leaves out a speck by where it is now, not by having been out already', () => {
    const g = new THREE.Group();
    g.name = 'quad';
    const m = box(0.02); // a sphere of 0.017 m: 1.1 points across at 10 m, 4.5 at 2.5 m, with 650 points to a radian
    m.position.set(10, 0, 0);
    g.add(m);
    g.updateMatrixWorld(true);
    const far = new FarDetail(sceneWith(g), { ...params, partPixels: 4 });
    far.pixelsPerRadian = 650;
    far.update({ x: 0, y: 0, z: 0 }, 1, true);
    expect(m.layers.isEnabled(0)).toBe(false);
    far.update({ x: 7.5, y: 0, z: 0 }, 1, true); // 2.5 m away: over 4 points, but a speck holds until 5
    expect(m.layers.isEnabled(0)).toBe(false);
    far.update({ x: 7.5, y: 0, z: 0 }, 1, true, true);
    expect(m.layers.isEnabled(0)).toBe(true);
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
  it('leaves a hidden set piece\'s matrices alone, asks for its world position all the same, and catches up when it is shown', () => {
    const farm = piece('neighbourFarm', 200, 0);
    const scene = sceneWith(farm);
    const far = new FarDetail(scene, params);
    far.update({ x: 0, z: 0 }, 1, true);
    expect(farm.visible).toBe(false);
    const m = farm.children[0];
    m.position.x = 300;
    scene.updateMatrixWorld();
    expect(m.matrixWorld.elements[12]).toBe(200); // not worked out while hidden
    expect(m.getWorldPosition(new THREE.Vector3()).x).toBe(300); // but asking for it is right
    m.position.x = 200;
    far.update({ x: 40, z: 0 }, 1, true);
    scene.updateMatrixWorld();
    expect(farm.visible).toBe(true);
    m.position.x = 250;
    scene.updateMatrixWorld();
    expect(m.matrixWorld.elements[12]).toBe(250);
  });
  it('measures a set piece that moves from where it stands at each look, not from where it was first seen (the rolling road trailer, #823)', () => {
    const trailer = new THREE.Group();
    trailer.name = 'rolling-road-trailer';
    trailer.userData.moves = true;
    trailer.add(box(4));
    trailer.position.set(0, -100, 0); // built out of sight, as the host does, before the tow places it
    const far = new FarDetail(sceneWith(trailer), params);
    far.update({ x: 400, z: 0 }, 1, true);
    expect(trailer.visible).toBe(false);
    trailer.position.set(390, 0, 5); // towed up to you
    trailer.rotation.y = 1;
    far.update({ x: 400, z: 0 }, 1, true);
    expect(trailer.visible).toBe(true);
    trailer.position.set(400 - params.setPieceDistance - 1, 0, 0); // its middle past the distance, its nearest edge (2 m and more out) inside it
    far.update({ x: 400, z: 0 }, 1, true);
    expect(trailer.visible).toBe(true);
    trailer.position.set(0, 0, 0); // and gone again
    far.update({ x: 400, z: 0 }, 1, true);
    expect(trailer.visible).toBe(false);
  });
  it('draws the brushwood bundle where it was put down, however far from where it lay (#823)', () => {
    const scene = new THREE.Scene();
    const heap = new BrushwoodHeap({ scene, world: { heightAt: () => 0 }, x: 0, z: 0 });
    const far = new FarDetail(scene, params);
    far.update({ x: 0, z: 0 }, 1, true);
    expect(heap.model.visible).toBe(true);
    heap.putDown({ x: 400, z: 0 }, 0);
    far.update({ x: 401, z: 0 }, 1, true);
    expect(heap.model.visible).toBe(true);
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
  it('swaps the neighbour\'s farm at its own, longer distance and the village at the usual one (#973)', () => {
    const make = (name, key) => {
      const o = piece(name, 200, 0); // spans x 195 to 205
      if (key) o.userData.fullDistanceKey = key;
      o.userData.farVersion = new THREE.Group();
      return o;
    };
    const village = make('village');
    const neighbour = make('neighbourFarm', 'neighbourFullDistance');
    const scene = new THREE.Scene();
    for (const o of [village, village.userData.farVersion, neighbour, neighbour.userData.farVersion]) scene.add(o);
    const far = new FarDetail(scene, { ...params, fullDistance: 45, neighbourFullDistance: 90 });
    far.update({ x: 120, z: 0 }, 1, true); // 75 from the edge: past the village's distance, inside hers
    expect([village.visible, neighbour.visible]).toEqual([false, true]);
    expect([village.userData.farVersion.visible, neighbour.userData.farVersion.visible]).toEqual([true, false]);
    far.update({ x: 60, z: 0 }, 1, true); // 135 from the edge: past both, the far version shows
    expect([village.visible, neighbour.visible]).toEqual([false, false]);
    expect(neighbour.userData.farVersion.visible).toBe(true);
    far.update({ x: 0, z: 0 }, 1, true);
    far.update({ x: 108, z: 0 }, 1, true); // 87 from the edge: back inside 90 only just, so full (the margin holds it past 90 once full, not before)
    expect(neighbour.visible).toBe(true);
    const zero = new FarDetail(scene, { ...params, neighbourFullDistance: 0 });
    zero.update({ x: 0, z: 0 }, 1, true);
    expect(neighbour.visible).toBe(true); // 0: always full
  });
  it('has her yard on the longer distance: neighbourFarm names its own key', async () => {
    const { DEFAULT_GRAPHICS_PARAMS: g, GRAPHICS_PARAM_RANGES: r } = await import('../src/core/graphics.js');
    expect(g.neighbourFullDistance).toBe(90);
    expect(g.neighbourFullDistance).toBeGreaterThan(g.fullDistance);
    expect(r.neighbourFullDistance).toEqual([0, 400, 5]);
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
    far.update({ x: 60, z: 0 }, 1, true);
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

describe('vehicles standing in a set piece (#399)', () => {
  const full = { ...params, fullDistance: 0 }; // the full village is always the one drawn
  function village() {
    const g = new THREE.Group();
    g.name = 'village';
    g.userData.farVersion = new THREE.Group();
    const { g: quad, bolt } = vehicle(0, 0);
    quad.position.set(60, 0, 0);
    g.add(quad);
    g.updateMatrixWorld(true);
    return { g, quad, bolt };
  }
  it('trims a parked quad in the village like one in the farm: small parts past the detail distance, and back near', () => {
    const { g, quad, bolt } = village();
    const far = new FarDetail(sceneWith(g, g.userData.farVersion), full);
    far.update({ x: 60 - (params.vehicleDetailDistance - 10), z: 0 }, 1, true); // in the village, quad 50 m away
    expect(bolt.visible).toBe(true);
    far.update({ x: 60 - (params.vehicleDetailDistance + 10), z: 0 }, 1, true);
    expect(g.visible).toBe(true); // within fullDistance of the village's edge
    expect(bolt.visible).toBe(false);
    far.update({ x: 60, z: 5 }, 1, true);
    expect(bolt.visible).toBe(true);
    expect(quad.visible).toBe(true);
  });
  it('uses where the quad stands in the world, not its place in the group', () => {
    const { g, bolt } = village();
    g.position.set(500, 0, 0); // the group is moved: the quad is at 560
    g.updateMatrixWorld(true);
    const far = new FarDetail(sceneWith(g, g.userData.farVersion), full);
    far.update({ x: 560 - (params.vehicleDetailDistance - 10), z: 0 }, 1, true);
    expect(bolt.visible).toBe(true);
  });
  it('leaves a piece it is not drawing alone', () => {
    const { g, bolt } = village();
    const far = new FarDetail(sceneWith(g, g.userData.farVersion), params);
    far.update({ x: 60 + 1000, z: 0 }, 1, true); // far off: the far version is drawn, the full one stays out
    expect(g.visible).toBe(false);
    expect(bolt.visible).toBe(true);
  });
  it('leaves out a speck in the village that is drawn, and not in one that is not', () => {
    const g = new THREE.Group();
    g.name = 'village';
    g.userData.farVersion = new THREE.Group();
    const m = box(0.02);
    m.position.set(100, 0, 0);
    g.add(m);
    g.updateMatrixWorld(true);
    const far = new FarDetail(sceneWith(g, g.userData.farVersion), full);
    far.pixelsPerRadian = 650;
    far.update({ x: 0, y: 0, z: 0 }, 1, true);
    expect(g.visible).toBe(true);
    expect(m.layers.isEnabled(0)).toBe(false);
    far.update({ x: 99, y: 0, z: 0 }, 1, true);
    expect(m.layers.isEnabled(0)).toBe(true);
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
  const inside = ({ x, z }) => insideBarn(LAYOUT, x, z, -0.3); // the barn stands turned: read in its own frame
  const placed = { helmetHooks: [LAYOUT.helmetHooks], 'trolley-jack': [LAYOUT.jack], 'axle-stand': LAYOUT.axleStands };

  it('holds only things that stand inside the barn', () => {
    for (const [name, spots] of Object.entries(placed)) {
      expect(BARN_PROP_NAMES).toContain(name);
      for (const s of spots) expect(inside(s), `${name} at ${s.x}, ${s.z}`).toBe(true);
    }
  });

  // From anywhere inside the barn, a prop at the far corner is still drawn (#379 testing: the racks at the other end vanished).
  it('is drawn from one corner of the barn to the opposite one', () => {
    const corner = Math.hypot(2 * b.halfX, 2 * b.halfZ);
    expect(DEFAULT_GRAPHICS_PARAMS.barnPropsDistance).toBeGreaterThan(corner);
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

describe('specks: parts too small on the screen to see', () => {
  const PPR = 650; // about a 1000-point-high window at 75 degrees
  const at = (x) => ({ x, y: 0, z: 0 });
  function farDetail(...children) {
    const far = new FarDetail(sceneWith(...children), params);
    far.pixelsPerRadian = PPR;
    return far;
  }

  it('works out how many points a sphere spans from the field of view and the window', () => {
    expect(pixelsPerRadian(75, 1000)).toBeCloseTo(651.6, 0);
    expect(pointsAcross(0.5, 100, 650)).toBeCloseTo(3.25);
    expect(pointsAcross(0.5, 0, 650)).toBe(Infinity);
  });
  it('is a speck under the threshold, and holds until it is clearly bigger, and never when the threshold is 0', () => {
    expect(isSpeck(0.9, 1)).toBe(true);
    expect(isSpeck(1.1, 1)).toBe(false);
    expect(isSpeck(1.1, 1, true)).toBe(true);
    expect(isSpeck(1.3, 1, true)).toBe(false);
    expect(isSpeck(0.01, 0)).toBe(false);
  });
  it('moves a small part to the undrawn layer once it is far enough off to be under a point, and back when you come near', () => {
    const v = vehicle(0);
    const far = farDetail(v.g);
    far.update(at(30), 1, true); // the body's sphere is 0.87 m: 19 points
    expect(v.body.layers.isEnabled(0)).toBe(true);
    expect(v.bolt.layers.isEnabled(0)).toBe(false); // 0.4 points
    expect(v.bolt.layers.isEnabled(SPECK_LAYER)).toBe(true);
    far.update(at(5), 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(true);
  });
  it('leaves a bigger part out only when it is further off', () => {
    const v = vehicle(0);
    const far = farDetail(v.g);
    far.update(at(800), 1, true); // the body's sphere is 0.87 m: 0.87 / 800 * 650 = 0.7 points
    expect(v.body.layers.isEnabled(0)).toBe(false);
    far.update(at(500), 1, true); // 1.1 points: past the threshold but inside the margin, so it stays out
    expect(v.body.layers.isEnabled(0)).toBe(false);
    far.update(at(300), 1, true);
    expect(v.body.layers.isEnabled(0)).toBe(true);
  });
  it('counts the height too, and the part\'s own position inside its parent', () => {
    const v = vehicle(0);
    const far = farDetail(v.g);
    v.bolt.position.set(0, 0, 0);
    v.g.position.y = 0;
    far.update({ x: 0, y: 30, z: 0 }, 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(false);
    v.bolt.position.set(0, 29.9, 0); // right at the camera
    v.g.updateMatrixWorld(true);
    far.update({ x: 0, y: 30, z: 0 }, 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(true);
  });
  it('keeps a light\'s lens, a part marked to keep and a skinned or instanced mesh', () => {
    const v = vehicle(0);
    const kept = box(0.02);
    kept.userData.keepFar = true;
    const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial(), 3);
    v.g.add(kept, batch);
    v.g.updateMatrixWorld(true);
    const far = farDetail(v.g);
    far.update(at(500), 1, true);
    expect(v.lens.layers.isEnabled(0)).toBe(true);
    expect(kept.layers.isEnabled(0)).toBe(true);
    expect(batch.layers.isEnabled(0)).toBe(true);
    expect(v.bolt.layers.isEnabled(0)).toBe(false);
  });
  it('does not touch visible, so what the game shows and hides is its own', () => {
    const v = vehicle(0);
    v.bolt.visible = false;
    const far = farDetail(v.g);
    far.update(at(500), 1, true);
    far.update(at(1), 1, true);
    expect(v.bolt.visible).toBe(false);
    expect(v.body.visible).toBe(true);
  });
  it('draws everything when the threshold is 0 or the view is not known', () => {
    const v = vehicle(0);
    const off = new FarDetail(sceneWith(v.g), { ...params, partPixels: 0 });
    off.pixelsPerRadian = PPR;
    off.update(at(500), 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(true);
    const blind = new FarDetail(sceneWith(v.g), params);
    blind.update(at(500), 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(true);
  });
  it('brings the parts back when the view stops being known (photo mode) or the threshold is turned to 0', () => {
    const v = vehicle(0);
    const far = farDetail(v.g);
    far.update(at(500), 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(false);
    far.pixelsPerRadian = 0;
    far.update(at(500), 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(true);
    far.pixelsPerRadian = PPR;
    far.update(at(500), 1, true);
    far.params = { ...params, partPixels: 0 };
    far.update(at(500), 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(true);
  });
  it('notices a part fitted since, and puts back one that is taken off', () => {
    const v = vehicle(0);
    const far = farDetail(v.g);
    far.update(at(500), 1, true);
    const fitted = box(0.02);
    v.g.add(fitted);
    v.g.updateMatrixWorld(true);
    for (let i = 0; i < 25; i++) far.update(at(500), 1, true);
    expect(fitted.layers.isEnabled(0)).toBe(false);
    v.g.remove(v.bolt);
    for (let i = 0; i < 25; i++) far.update(at(500), 1, true);
    expect(v.bolt.layers.isEnabled(0)).toBe(true);
  });
  it('leaves the set pieces, the barn\'s props and the camera to their own rules', () => {
    for (const name of [SET_PIECE_NAMES[0], BARN_PROP_NAMES[0]]) {
      const g = new THREE.Group();
      g.name = name;
      const m = box(0.02);
      g.add(m);
      g.updateMatrixWorld(true);
      const far = farDetail(g);
      far.update(at(500), 1, true);
      expect(m.layers.isEnabled(0)).toBe(true);
    }
  });
});

describe('the lane\'s approach to the village, a set piece of its own (#1087)', () => {
  let scene;
  let built;
  let APPROACH_SIGN_REACH;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const props = await import('../src/world/villageProps.js');
    const { buildVillage } = props;
    APPROACH_SIGN_REACH = props.APPROACH_SIGN_REACH;
    scene = new THREE.Scene();
    built = buildVillage({ ...headlessContext(), scene, layout: LAYOUT, heights: createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints)), fixedBox: () => {} });
    vi.unstubAllGlobals();
  });
  const named = (n) => scene.children.find((o) => o.name === n);
  const onLane = (z) => { const [x, gz] = fromPlan([LANE_PLAN.x, z]); return { x, z: gz }; };

  it('builds the approach into its own named group, with its own far version, apart from the street', () => {
    const approach = named('villageApproach');
    expect(SET_PIECE_NAMES).toContain('villageApproach');
    expect(approach).toBe(built.approach.group);
    expect(approach.userData.farVersion?.name).toBe('villageApproachFar');
    expect(named('village').userData.farVersion?.name).toBe('villageFar');
    // The lane's houses and the small farm are in it, and not in the street's.
    const ids = (o) => { const out = []; o.traverse((m) => /^village-(l\d|fh|fb)$/.test(m.name) && out.push(m.name)); return out; };
    expect(ids(approach).sort()).toEqual(['village-fb', 'village-fh', 'village-l1', 'village-l2', 'village-l3']);
    expect(ids(named('village'))).toEqual([]);
    // The lane's two 30 posts and its village sign go with it; the street's other two ends keep theirs.
    const near = approachSignSpecs(LAYOUT.village).filter((q) => built.shape.nearApproach(q.x, q.z, APPROACH_SIGN_REACH));
    expect(near.length).toBe(3);
    for (const q of near) expect(q.z).toBeLessThan(fromPlan([0, 490])[1]);
  });

  it('keeps the street, the pub and its car park in the far version up the lane until you are near the street', () => {
    const village = named('village');
    const approach = named('villageApproach');
    const far = new FarDetail(scene, params);
    const streetBox = far.box(village);
    // The street's bounds start at the street now, not 140 m up the lane at the small farm's yard (plan z 440).
    expect(streetBox.minZ).toBeGreaterThan(fromPlan([0, 540])[1]);
    expect(far.box(approach).minZ).toBeLessThan(fromPlan([0, 445])[1]);
    // At the budget spot, by the small farm's track, the approach is full and the street its far version (both were full before).
    const spot = LAYOUT.budgetSpots.laneApproach;
    far.update(spot, 1, true, true);
    expect([approach.visible, village.visible, village.userData.farVersion.visible]).toEqual([true, false, true]);
    // Up the lane past the small farm and the houses, the approach comes in full and the street holds off until it is within fullDistance.
    for (let z = 395; z <= 600; z += 5) {
      const at = onLane(z);
      far.update(at, 1, true, true);
      expect(village.visible, `plan z ${z}`).toBe(distanceToTile(streetBox, at.x, at.z) < params.fullDistance);
      if (z >= 430 && z <= 560) expect(approach.visible, `plan z ${z}`).toBe(true);
    }
    far.update(onLane(420), 1, true, true);
    expect([approach.visible, village.visible]).toEqual([true, false]);
  });
});
