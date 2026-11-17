import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { headlessContext } from './helpers/worldModels.js';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { BUILT_KINDS, POND, landmarksOf, pondShape } from '../src/world/fieldLandmarks.js';
import { SET_PIECE_NAMES } from '../src/world/farDetail.js';

// The eight landmarks #815 builds (the line, the barn, the hut and rock and the pillar only have their place): each is built on the new farm's ground
// with its own place, and checked for what a look at one angle can't find, faces fighting on one plane, and for what stops you and what stays in sight.

const two = layoutNew(LAYOUT);
const spot = (kind) => landmarksOf(two, kind)[0];
let land;
let ctx;
let colliders;
const built = {};

/** A physics stand-in that records every collider asked for, as { kind: 'cylinder' | 'cuboid', at: [x, y, z] }. */
function recordingPhysics() {
  const made = [];
  const desc = (kind) => (...size) => {
    const d = { kind, size, at: [0, 0, 0], setTranslation(x, y, z) { d.at = [x, y, z]; return d; }, setRotation() { return d; } };
    return d;
  };
  return { made, physics: { createCollider: (d) => made.push(d) }, RAPIER: { ColliderDesc: { cylinder: desc('cylinder'), cuboid: desc('cuboid') } } };
}

beforeAll(async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  land = await import('../src/world/landmarkProps.js');
  const rec = recordingPhysics();
  colliders = rec.made;
  const heights = createTerrainHeight(two, new Track(two.trackPoints));
  const fixed = (x, y, z) => rec.made.push({ kind: 'cuboid', at: [x, y, z] });
  ctx = { ...headlessContext(), layout: two, heights, physics: rec.physics, RAPIER: rec.RAPIER, fixedBox: fixed, anchors: [] };
  const builders = {
    loneOak: land.buildLoneOak, oldGateposts: land.buildGateposts, deadElm: land.buildDeadElm, farPond: land.buildFarPond,
    castRoller: land.buildRoller, loneAsh: land.buildLoneAsh, brookAlders: land.buildAlders, bigOaks: land.buildBigOaks,
  };
  for (const kind of BUILT_KINDS) {
    const before = colliders.length;
    built[kind] = { group: builders[kind](ctx, spot(kind)), colliders: colliders.slice(before) };
  }
}, 60000);

describe('the eight landmarks', () => {
  it('are the ones the layout places and farDetail names', () => {
    expect(Object.keys(built).sort()).toEqual([...BUILT_KINDS].sort());
    for (const kind of BUILT_KINDS) {
      expect(SET_PIECE_NAMES, `${kind} named in farDetail.js`).toContain(kind);
      expect(built[kind].group.name).toBe(kind);
    }
  });

  it.each(BUILT_KINDS)('%s has no two faces on one plane, which flicker as alpha fighting', (kind) => {
    const { group } = built[kind];
    group.updateMatrixWorld(true);
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });

  it.each(BUILT_KINDS)('%s has only lit materials, so nothing glows at night', (kind) => {
    const unlit = [];
    built[kind].group.traverse((o) => {
      // (the oaks' own models are the game's, loaded in the game: a stand-in is in their place here)
      if (o.isInstancedMesh) return;
      for (const m of o.isMesh ? [].concat(o.material) : []) if (m.isMeshBasicMaterial) unlit.push(o.name);
    });
    expect(unlit).toEqual([]);
  });

  it('have a collider for every trunk, post and drum, where each stands', () => {
    const counts = Object.fromEntries(BUILT_KINDS.map((k) => [k, built[k].colliders.length]));
    expect(counts).toEqual({ loneOak: 1, oldGateposts: 2, deadElm: 1, farPond: 2, castRoller: 1, loneAsh: 1, brookAlders: spot('brookAlders').trees.length, bigOaks: spot('bigOaks').trees.length });
    const [ox, oz] = spot('loneOak').at;
    expect(built.loneOak.colliders[0].at[0]).toBeCloseTo(ox, 6);
    expect(built.loneOak.colliders[0].at[2]).toBeCloseTo(oz, 6);
    const posts = built.oldGateposts.colliders.map((c) => c.at[0]).sort((a, b) => a - b);
    expect(posts[1] - posts[0]).toBeCloseTo(spot('oldGateposts').gap, 5);
  });

  it('put the trunk colliders where the oaks\' are: a tree you cannot ride through, as tall as it', () => {
    const c = built.bigOaks.colliders[0];
    expect(c.kind).toBe('cylinder');
    expect(c.size[1]).toBeGreaterThan(0.4); // radius, at the oak's own 0.32 times its size
    expect(c.size[0]).toBeGreaterThan(2); // half its height
  });

  it('have a far version for each tree and the pond, and none for the gateposts and the roller', () => {
    for (const kind of ['loneOak', 'bigOaks', 'loneAsh', 'deadElm', 'brookAlders', 'farPond']) {
      const far = built[kind].group.userData.farVersion;
      expect(far?.children.length, `${kind} far version`).toBe(1);
      expect(far.visible).toBe(false);
    }
    for (const kind of ['oldGateposts', 'castRoller']) expect(built[kind].group.userData.farVersion).toBeUndefined();
  });

  it('keep each far version cheap: a few hundred triangles at most', () => {
    for (const kind of ['loneOak', 'bigOaks', 'loneAsh', 'deadElm', 'brookAlders', 'farPond']) {
      const geo = built[kind].group.userData.farVersion.children[0].geometry;
      expect(geo.attributes.position.count / 3, kind).toBeLessThan(400);
    }
  });

  it('stand on the ground: every mesh\'s lowest point is within a metre of the ground under the group\'s spot', () => {
    for (const kind of ['oldGateposts', 'castRoller']) {
      const [x, z] = spot(kind).at;
      const ground = ctx.heights.heightAt(x, z);
      const box = new THREE.Box3().setFromObject(built[kind].group);
      expect(box.min.y).toBeLessThan(ground + 0.1);
      expect(box.min.y).toBeGreaterThan(ground - 1);
    }
  });

  it('build the real sizes: gateposts about 1.9 m with a 3 m gap, the roller about 1.2 m wide and 2.2 m long, the ash and the elm well over 10 m, alders 6 to 9 m', () => {
    // The plants and the oak models are instanced, so only the made parts are measured.
    const size = (kind) => {
      const box = new THREE.Box3();
      built[kind].group.traverse((o) => o.isMesh && !o.isInstancedMesh && o.geometry.attributes.position && box.expandByObject(o));
      return box.getSize(new THREE.Vector3());
    };
    const posts = size('oldGateposts');
    expect(posts.y).toBeGreaterThan(1.8);
    expect(posts.y).toBeLessThan(2.3);
    const roller = size('castRoller');
    expect(roller.x).toBeGreaterThan(1.1);
    expect(Math.max(roller.x, roller.z)).toBeLessThan(3.2);
    expect(size('loneAsh').y).toBeGreaterThan(10);
    expect(size('deadElm').y).toBeGreaterThan(10);
    // The line of alders falls with the land over 150 m, so one alder is measured.
    const alders = new THREE.Box3().setFromObject(built.brookAlders.group.children[0]).getSize(new THREE.Vector3());
    expect(alders.y).toBeGreaterThan(5);
    expect(alders.y).toBeLessThan(11);
  });
});

describe('the worn ground under them', () => {
  it('lies under each landmark, not off to one side: every patch of earth is centred within 20 m of a tree, post, drum or willow of its landmark (a patch once stood twice as far out)', () => {
    for (const kind of ['loneOak', 'loneAsh', 'oldGateposts', 'farPond', 'brookAlders', 'bigOaks']) {
      const l = spot(kind);
      const points = [l.at, ...(l.trees ?? []), ...(l.willows ?? [])];
      let patches = 0;
      built[kind].group.traverse((o) => {
        if (!o.userData.noShadow || o.name === 'pondWater') return;
        patches++;
        const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
        const near = Math.min(...points.map(([x, z]) => Math.hypot(c.x - x, c.z - z)));
        expect(near, `${kind} patch at ${c.x.toFixed(0)}, ${c.z.toFixed(0)}`).toBeLessThan(20);
      });
      expect(patches, kind).toBeGreaterThan(0);
    }
  });
});

describe('Far Field\'s pond', () => {
  const pond = spot('farPond');
  const [cx, cz] = pond.at;
  const flat = createTerrainHeight({ ...two, fieldLandmarks: [] }, new Track(two.trackPoints));
  const dished = createTerrainHeight(two, new Track(two.trackPoints));

  it('is cut into the ground 0.9 m at its middle and not at all beyond the dish', () => {
    expect(flat.heightAt(cx, cz) - dished.heightAt(cx, cz)).toBeCloseTo(POND.depth, 2);
    const reach = pond.rx * POND.reach;
    expect(flat.heightAt(cx + reach + 1, cz)).toBe(dished.heightAt(cx + reach + 1, cz));
    expect(flat.heightAt(cx, cz + pond.rz * POND.reach + 1)).toBe(dished.heightAt(cx, cz + pond.rz * POND.reach + 1));
  });

  it('is flat across the bottom and eases up the banks, no step', () => {
    const shape = pondShape(pond);
    expect(shape.cut(cx, cz)).toBe(POND.depth);
    expect(shape.cut(cx + pond.rx * 0.3 * POND.reach - 0.01, cz)).toBeCloseTo(POND.depth, 2);
    let last = POND.depth;
    for (let r = 0.3; r <= 1; r += 0.05) {
      const cut = shape.cut(cx + pond.rx * POND.reach * r, cz);
      expect(cut).toBeLessThanOrEqual(last + 1e-9);
      expect(last - cut).toBeLessThan(0.2);
      last = cut;
    }
  });

  it('has water that stands 0.5 m deep at the middle: the surface is above the bottom and below the bank', () => {
    const water = built.farPond.group.getObjectByName('pondWater');
    const level = water.geometry.attributes.position.getY(0);
    expect(level - dished.heightAt(cx, cz)).toBeCloseTo(POND.water, 2);
    expect(level).toBeLessThan(flat.heightAt(cx, cz));
  });

  it('is about 14 m across, as the issue says', () => {
    expect(pond.rx * 2).toBeGreaterThanOrEqual(13);
    expect(pond.rx * 2).toBeLessThanOrEqual(15);
  });
});

describe('today\'s farm', () => {
  it('builds none of it: there is no landmark list in today\'s layout', () => {
    expect(LAYOUT.fieldLandmarks).toBeUndefined();
    expect(land.buildFieldLandmarks({ ...ctx, layout: LAYOUT, scene: new THREE.Scene() })).toBeNull();
  });

  it('builds them all on the new farm, into the scene with the far versions beside them', () => {
    const scene = new THREE.Scene();
    const made = land.buildFieldLandmarks({ ...ctx, scene, random: headlessContext().random });
    expect(Object.keys(made).sort()).toEqual([...BUILT_KINDS].sort());
    for (const kind of BUILT_KINDS) expect(scene.children).toContain(made[kind]);
    expect(scene.children.filter((o) => o.name.endsWith('Far')).length).toBe(6);
  });
});
