import * as THREE from 'three';
import fs from 'node:fs';
import { vi } from 'vitest';
import { fakeCanvas } from './vehicleModels.js';
import { LAYOUT } from '../../src/world/layout.js';
import { createTerrainHeight } from '../../src/world/terrainHeight.js';
import { createFields } from '../../src/world/fields.js';
import { Track } from '../../src/world/track.js';

// Every named set piece (SET_PIECE_NAMES, BARN_PROP_NAMES in world/farDetail.js) and every carried item's and fixture's model, built in node
// the way the game builds them, for the tests that look at them as a whole (bareBlocks.test.js). The textures draw on canvases, so a canvas that
// accepts every call stands in; the colliders, the physics world and the GLTF models the trees use are stubs, as nothing here reads them (a stand-in model is a small rock
// and not a box, which the bare-block check would take for a block).

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** The context buildProps gives the world builders (world/props.js), without a physics world or a GLTF model. */
export function headlessContext() {
  const scene = new THREE.Scene();
  const track = new Track(LAYOUT.trackPoints);
  const heights = createTerrainHeight(LAYOUT, track);
  const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
  return {
    scene,
    layout: LAYOUT,
    heights,
    fields: createFields(LAYOUT),
    random: seeded(1234),
    fixedBox: () => {},
    anchors: [],
    gateParams: {},
    drawDistance: stub,
    physics: stub,
    RAPIER: stub,
    models: new Proxy({}, { get: () => ({ scene: new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1)), scenes: [], animations: [] }) }),
    laneTexture: () => fakeCanvas(),
  };
}

/**
 * { models: [{ name, kind, group }], ran: Set of names }. `kind` is 'setPiece' (a name in SET_PIECE_NAMES), 'barnProp' (BARN_PROP_NAMES), 'world' (what
 * another world builder makes) or 'item' (carried, or a fixture). `ran` holds the name of every builder function and class that was actually called to make them, which
 * bareBlocks.test.js compares with what the source exports. Call from a beforeAll.
 */
export async function buildWorldModels() {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const out = [];
  const ran = new Set();
  /**
   * Builds one model. `builder` is the exported function or class itself and `call` makes the model with it, as `(b) => b()` (the default) or
   * `(Cls, scene) => new Cls({ scene, ... })`: the builder given to `call` records that it ran, so naming one here and never calling it leaves it
   * out of `ran`. A function or `.group` / `.mesh` / `.model` is the model; for a class that only adds to the scene it is given, that scene is.
   */
  const add = (kind, name, builder, call = (b) => b()) => {
    const scratch = new THREE.Scene();
    const traced = new Proxy(builder, {
      apply: (target, self, a) => (ran.add(builder.name), Reflect.apply(target, self, a)),
      construct: (target, a) => (ran.add(builder.name), Reflect.construct(target, a)),
    });
    const made = call(traced, scratch);
    const isObject = (o) => o && o.isObject3D;
    const group = isObject(made) ? made : [made?.group, made?.mesh, made?.model, made?.root].find(isObject) ?? (scratch.children.length ? scratch : null);
    if (!group) throw new Error(`${name} was not built`);
    group.updateMatrixWorld(true);
    out.push({ name, kind, group });
  };

  const c = headlessContext();
  // The stubs (the draw distance's instanced tiles) land in the scene as well, and answer any lookup, so walk it for real objects only.
  const found = (name) => {
    let hit = null;
    const walk = (o) => {
      if (hit || !o || typeof o.type !== 'string') return;
      if (o.name === name) hit = o;
      else o.children?.forEach(walk);
    };
    walk(c.scene);
    return hit;
  };
  const heightAt = c.heights.heightAt;

  const { buildVillage } = await import('../../src/world/villageProps.js');
  add('setPiece', 'village', buildVillage, (b) => {
    const built = b(c);
    return found('village') ?? built?.root;
  });
  const { buildNeighbourFarm } = await import('../../src/world/neighbourFarmProps.js');
  add('setPiece', 'neighbourFarm', buildNeighbourFarm, (b) => (b(c), found('neighbourFarm')));
  const { buildRiverside } = await import('../../src/world/riverProps.js');
  add('setPiece', 'riverside', buildRiverside, (b) => (b(c), found('riverside')));
  const { buildWoods } = await import('../../src/world/woodsProps.js');
  add('setPiece', 'logs', buildWoods, (b) => (b(c), found('logs')));
  add('setPiece', 'trailMarkers', buildWoods, () => found('trailMarkers')); // made by the same call
  const { buildQuarry } = await import('../../src/world/quarryProps.js');
  add('setPiece', 'quarrySite', buildQuarry, (b) => (b(c), found('quarrySite')));
  const { buildHut } = await import('../../src/world/hutBuild.js');
  add('setPiece', 'shepherdsHut', buildHut, (b) => b(c).group);
  const { buildLineUpBays } = await import('../../src/world/lineUpBays.js');
  add('setPiece', 'lineUpSleepers', buildLineUpBays, (b) => b(c.scene, heightAt, LAYOUT.lineUp ?? { x: 0, z: 0, yaw: 0, length: 6, bays: 3 }).group);
  const { buildClimbCones, buildConeCourse } = await import('../../src/world/startLine.js');
  const gates = [0, 1, 2].map((i) => ({ x: i * 6, z: 0, tx: 1, tz: 0, half: 2 }));
  add('setPiece', 'climbCones', buildClimbCones, (b) => b(c.scene, heightAt, gates));
  add('setPiece', 'coneCourse', buildConeCourse, (b) => b(c.scene, heightAt, [0, 1, 2, 3].map((i) => ({ x: i * 4, z: 0 }))).group);
  const { buildRollingRoadModel } = await import('../../src/world/rollingRoadModel.js');
  add('setPiece', 'rolling-road-trailer', buildRollingRoadModel);
  const { buildBundle } = await import('../../src/items/brushwood.js');
  add('setPiece', 'brushwood', buildBundle, (b) => b(c.random));

  const { buildTyreRackModel } = await import('../../src/workshop/tyreRackModel.js');
  add('barnProp', 'tyreRack', buildTyreRackModel);
  const { buildSparesModel } = await import('../../src/workshop/sparesModel.js');
  add('barnProp', 'sparesRack', buildSparesModel);
  const { buildChargerModel } = await import('../../src/workshop/chargerModel.js');
  add('barnProp', 'batteryCharger', buildChargerModel);
  const { buildJack, buildAxleStand } = await import('../../src/workshop/jackModel.js');
  add('barnProp', 'trolley-jack', buildJack);
  add('barnProp', 'axle-stand', buildAxleStand);
  const { JumperRail } = await import('../../src/world/jumperRail.js');
  add('barnProp', 'jumperRack', JumperRail, (Rail, scene) => new Rail(scene, LAYOUT, heightAt));
  const { HelmetHooks } = await import('../../src/world/helmetHooks.js');
  add('barnProp', 'helmetHooks', HelmetHooks, (Hooks, scene) => new Hooks(scene, LAYOUT, heightAt));
  const { BiscuitTinView } = await import('../../src/world/biscuitTinView.js');
  add('barnProp', 'snackTin', BiscuitTinView, (View, scene) => (new View({ scene, world: { layout: LAYOUT, heightAt } }), scene));

  // The rest of what the world's builders make, each into a scene of its own so the model is what it put there.
  const into = (b, scene, more = {}) => (b({ ...c, scene, ...more }), scene);
  const { buildBarnShed } = await import('../../src/world/barnBuild.js');
  add('world', 'barn', buildBarnShed, (b, scene) => into(b, scene));
  const { buildOutbuildings } = await import('../../src/world/outbuildingProps.js');
  const bale = { geo: new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12), straw: new THREE.MeshStandardMaterial({ color: 0xc8a850 }) };
  add('world', 'outbuildings', buildOutbuildings, (b, scene) => into(b, scene, { bale }));
  const { buildHill } = await import('../../src/world/hillProps.js');
  add('world', 'hill', buildHill, (b, scene) => into(b, scene));
  const { buildBrookCulvert } = await import('../../src/world/brookProps.js');
  add('world', 'brookCulvert', buildBrookCulvert, (b, scene) => into(b, scene));
  const { buildElectricFence } = await import('../../src/world/electricFenceBuild.js');
  add('world', 'electricFence', buildElectricFence, (b, scene) => into(b, scene));
  const { buildJumpRamp } = await import('../../src/world/jumpRamp.js');
  add('world', 'jumpRamp', buildJumpRamp, (b, scene) => into(b, scene));
  const { buildDragStrip } = await import('../../src/world/dragStrip.js');
  add('world', 'dragStrip', buildDragStrip, (b, scene) => (b(scene, heightAt, LAYOUT.dragStrip), scene));
  const { buildStartLine } = await import('../../src/world/startLine.js');
  add('world', 'startLine', buildStartLine, (b, scene) => b(scene, heightAt, c.track ?? new Track(LAYOUT.trackPoints), 0.5, 4));
  const { buildTin } = await import('../../src/world/moneyTin.js');
  add('world', 'moneyTin', buildTin);
  const { buildBiscuitTin, buildPlankShelf } = await import('../../src/world/biscuitTin.js');
  add('world', 'biscuitTin', buildBiscuitTin);
  add('world', 'biscuitShelf', buildPlankShelf);
  const { buildRosette } = await import('../../src/world/trophyShelf.js');
  add('world', 'rosette', buildRosette, (b) => b(0xc03030));

  // Carried items and the workshop's fixtures: the builders that need no scene or physics world, then the classes that put their own model in the scene.
  const { buildBoosterModel } = await import('../../src/items/boosterPack.js');
  add('item', 'boosterPack', buildBoosterModel);
  const { buildBatteryModel } = await import('../../src/items/battery.js');
  add('item', 'battery small', buildBatteryModel, (b) => b('small', 'Test'));
  add('item', 'battery big', buildBatteryModel, (b) => b('big', 'Test'));
  const { buildLunchBag } = await import('../../src/items/lunchBag.js');
  add('item', 'lunchBag', buildLunchBag);
  const { buildGeneratorModel } = await import('../../src/items/generatorModel.js');
  add('item', 'generator', buildGeneratorModel);
  const { buildRackStrap } = await import('../../src/items/rackStrap.js');
  add('item', 'rackStrap', buildRackStrap, (b) => b('can'));
  const { buildRound, buildLog } = await import('../../src/items/woodPieces.js');
  add('item', 'woodRound', buildRound, (b) => b(c.random));
  add('item', 'woodLog', buildLog);
  const { buildNotebookModel } = await import('../../src/workshop/notebookModel.js');
  add('item', 'notebook', buildNotebookModel);
  const shed = await import('../../src/workshop/shedModels.js');
  add('item', 'compressor', shed.buildCompressor);
  add('item', 'washer', shed.buildWasher);
  add('item', 'pit', shed.buildPit);
  add('item', 'catalogue', shed.buildCatalogue);
  await addItemClasses(add, c, heightAt);

  return { models: out, ran };
}

/** The classes of src/items that put a model of their own in the scene they are given, each built the way the game builds it (world/props.js, game.js). */
async function addItemClasses(add, c, heightAt) {
  const world = { layout: LAYOUT, heights: c.heights, heightAt, groundHeightAt: heightAt };
  const stub = c.physics;
  const here = { position: new THREE.Vector3(0, 0, 0), yaw: 0 };
  const placed = (scene, more = {}) => ({ scene, world, ...here, ...more });
  const from = (file) => import(`../../src/items/${file}.js`);

  const { AntiGelBottle } = await from('antiGelBottle');
  add('item', 'antiGelBottle', AntiGelBottle, (C, scene) => new C(placed(scene)));
  const { BatteryItem } = await from('battery');
  add('item', 'batteryItem', BatteryItem, (C, scene) => new C({ scene, world, unit: { id: 'test', name: 'Test', quad: { model: new THREE.Group() } } }));
  const { BoosterPack } = await from('boosterPack');
  add('item', 'boosterPackItem', BoosterPack, (C, scene) => new C({ scene, world }));
  const { BrushwoodHeap } = await from('brushwood');
  add('item', 'brushwoodHeap', BrushwoodHeap, (C, scene) => new C({ scene, world, x: 0, z: 0, random: c.random }));
  const { Chain } = await from('chain');
  add('item', 'chain', Chain, (C, scene) => {
    const chain = new C({ scene, tractor: { position: new THREE.Vector3(), model: new THREE.Group() }, anchor: () => new THREE.Vector3() });
    scene.add(chain.handHook); // the hook in your hand: the chain itself is a line
    return scene;
  });
  const { CoolantBottle } = await from('coolantBottle');
  add('item', 'coolantBottle', CoolantBottle, (C, scene) => new C(placed(scene)));
  const { FeedBucket, FeedBin } = await from('feedBucket');
  add('item', 'feedBucket', FeedBucket, (C, scene) => new C(placed(scene)));
  add('item', 'feedBin', FeedBin, (C, scene) => new C(placed(scene)));
  const { FuelTank } = await from('fuelTank');
  add('item', 'fuelTank', FuelTank, (C, scene) => new C(placed(scene, { physics: stub, RAPIER: stub })));
  const { Hose } = await from('hose');
  add('item', 'hose', Hose, (C, scene) => new C(placed(scene)));
  const { JerryCan } = await from('jerryCan');
  add('item', 'jerryCan', JerryCan, (C, scene) => new C(placed(scene)));
  const { JumpLeads } = await from('jumpLeads');
  add('item', 'jumpLeads', JumpLeads, (C, scene) => new C(placed(scene)));
  const { Mugs } = await from('mug');
  add('item', 'mug', Mugs, (C, scene) => new C(scene, heightAt).make(0xaa3333));
  add('item', 'flaskCup', Mugs, (C, scene) => new C(scene, heightAt).makeFlaskCup());
  const { OilBottle } = await from('oilBottle');
  add('item', 'oilBottle', OilBottle, (C, scene) => new C(placed(scene)));
  const { PlugAdditive } = await from('plugAdditive');
  add('item', 'plugAdditive', PlugAdditive, (C, scene) => new C(placed(scene)));
  const { Toolbox } = await from('toolbox');
  add('item', 'toolbox', Toolbox, (C, scene) => new C(placed(scene)));
  const { TowRope } = await from('towRope');
  add('item', 'towRope', TowRope, (C, scene) => {
    scene.add(new C({ scene }).handHook);
    return scene;
  });
  const { Winch } = await from('winch');
  add('item', 'winch', Winch, (C, scene) => {
    scene.add(new C({ scene, unit: { quad: { model: new THREE.Group() } } }).handHook);
    return scene;
  });
  const { WoodPiece, StackView } = await from('woodPieces');
  add('item', 'woodPiece', WoodPiece, (C, scene) => new C({ scene, world, kind: 'round', random: c.random }));
  add('item', 'woodStack', StackView, (C, scene) => {
    const stack = new C({ scene, heightAt, site: { x: 0, z: 0, yaw: 0 }, capacity: 24 });
    stack.set(24); // a full stack: it is built empty and the logs arrive as you split them
    return stack.group;
  });
}

/** A mesh nobody sees: every material invisible (the boxes the player looks at to use something). It is not part of the model. */
const isProxy = (o) => (Array.isArray(o.material) ? o.material : [o.material]).every((m) => m && m.visible === false);

/**
 * What a model is made of: meshes, triangles, whether every mesh is a box (one `BoxGeometry`, or a box's twelve triangles), and the share of its
 * surface (m2, as it stands in the world) that has a texture or vertex colours, against a plain colour.
 */
export function modelStats(group) {
  group.updateMatrixWorld(true);
  const s = { meshes: 0, triangles: 0, boxes: 0, area: 0, texturedArea: 0 };
  const [a, b, c, scale] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  group.traverse((o) => {
    if (!o.isMesh || isProxy(o)) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const n = g.index ? g.index.count : pos.count;
    const copies = o.isInstancedMesh ? o.count : 1;
    s.meshes++;
    s.triangles += (n / 3) * copies;
    if (g.type === 'BoxGeometry' || n / 3 <= 12) s.boxes++;
    o.matrixWorld.decompose(a, new THREE.Quaternion(), scale);
    const k = Math.cbrt(Math.abs(scale.x * scale.y * scale.z)) ** 2;
    let area = 0;
    for (let i = 0; i < n; i += 3) {
      const at = (j) => (g.index ? g.index.getX(i + j) : i + j);
      a.fromBufferAttribute(pos, at(0));
      b.fromBufferAttribute(pos, at(1));
      c.fromBufferAttribute(pos, at(2));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    area *= k * copies;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    s.area += area;
    if (m.map || m.vertexColors) s.texturedArea += area;
  });
  s.textured = s.area > 0 ? s.texturedArea / s.area : 1;
  return s;
}

// The checks. Each is one function from a model to what it found, which bareBlocks.test.js calls for the real models and for the stand-ins that
// show each check can fail, so the two cannot drift apart.

export const MIN_MESHES = 2;
export const BASE_TRIANGLES = 40; // a model of no surface at all still has this many triangles
export const TRIANGLES_PER_M2 = 1.7; // the most that every model now (bar those in KNOWN_THIN) passes: the drag strip, 1,212 triangles over 680 m2, is the lowest at 1.72
export const BLOCK_MESHES = 3; // this many meshes or fewer, all of them boxes, is a block with a lid
export const BLOCK_SIDE = 1.5; // m: a single solid box with all three sides at least this long is a block, whatever its texture
export const MIN_PLAIN_AREA = 1; // m2: a model with less surface than this, in one plain colour, is a small thing (a bolt, a strap) and not judged on its texture
export const MIN_TEXTURED = 0.1; // of the surface, which must have a texture or vertex colours (the kits' canvas textures) above MIN_PLAIN_AREA

const SNAP = 1e4; // positions are matched to a tenth of a millimetre to find which triangles share a corner
const tolerance = (a, b) => Math.abs(a - b) <= 0.02 * Math.max(a, b) + 1e-6;

const pieces = new WeakMap();
/** The connected pieces of a geometry (triangles that share a corner position), as { triangles, corners: [Vector3, ...] } with each corner once. */
function geometryPieces(g) {
  if (pieces.has(g)) return pieces.get(g);
  const pos = g.attributes.position;
  const n = g.index ? g.index.count : pos.count;
  const keyOf = new Map();
  const corners = [];
  const parent = [];
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const cornerAt = (i) => {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * SNAP)},${Math.round(y * SNAP)},${Math.round(z * SNAP)}`;
    let id = keyOf.get(key);
    if (id === undefined) {
      id = corners.length;
      keyOf.set(key, id);
      corners.push(new THREE.Vector3(x, y, z));
      parent.push(id);
    }
    return id;
  };
  const triangles = [];
  for (let i = 0; i < n; i += 3) {
    const t = [0, 1, 2].map((j) => cornerAt(g.index ? g.index.getX(i + j) : i + j));
    triangles.push(t);
    parent[find(t[1])] = find(t[0]);
    parent[find(t[2])] = find(t[0]);
  }
  const byRoot = new Map();
  for (const t of triangles) {
    const r = find(t[0]);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(t);
  }
  const out = [];
  for (const tris of byRoot.values()) {
    if (tris.length !== 12) {
      out.push({ triangles: tris.length, box: null });
      continue;
    }
    const ids = [...new Set(tris.flat())];
    // A box is twelve triangles on eight corners, every one a right triangle (a corner of a face cut along its diagonal).
    const right = tris.every((t) => {
      const d = [0, 1, 2].map((j) => corners[t[j]].distanceToSquared(corners[t[(j + 1) % 3]])).sort((a, b) => a - b);
      return tolerance(d[0] + d[1], d[2]);
    });
    out.push({ triangles: 12, box: ids.length === 8 && right ? { corners, tris } : null });
  }
  pieces.set(g, out);
  return out;
}

/** The three side lengths of a box piece after `matrix`, longest last. Each face's two triangles contribute their two shorter edges (the third is the diagonal). */
function boxSides({ corners, tris }, matrix) {
  const world = corners.map((v) => v.clone().applyMatrix4(matrix));
  const edges = [];
  for (const t of tris) {
    const e = [0, 1, 2].map((j) => world[t[j]].distanceTo(world[t[(j + 1) % 3]])).sort((a, b) => a - b);
    edges.push(e[0], e[1]);
  }
  edges.sort((a, b) => a - b);
  const clusters = [];
  for (const e of edges) {
    const last = clusters[clusters.length - 1];
    if (last && tolerance(last[last.length - 1], e)) last.push(e);
    else clusters.push([e]);
  }
  // Each of the three sides is eight of the twenty-four edges: a cluster with sixteen is two sides of the same length.
  const sides = clusters.flatMap((cl) => Array(Math.max(1, Math.round(cl.length / 8))).fill(cl[Math.floor(cl.length / 2)]));
  while (sides.length < 3) sides.push(sides[sides.length - 1]);
  return sides.slice(0, 3);
}

/** Every solid box in the model, however it is made (a box mesh, or twelve triangles of a merged mesh): [{ mesh: the mesh's name, sides: [a, b, c] }] in metres. */
export function solidBoxes(group) {
  group.updateMatrixWorld(true);
  const found = [];
  const matrix = new THREE.Matrix4();
  const instance = new THREE.Matrix4();
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (isProxy(o)) return;
    for (const p of geometryPieces(o.geometry)) {
      if (!p.box) continue;
      for (let i = 0; i < (o.isInstancedMesh ? Math.min(o.count, 100) : 1); i++) {
        matrix.copy(o.matrixWorld);
        if (o.isInstancedMesh) {
          o.getMatrixAt(i, instance);
          matrix.multiply(instance);
        }
        found.push({ mesh: o.name || o.geometry.type, sides: boxSides(p.box, matrix) });
      }
    }
  });
  return found;
}

/** The solid boxes of the model with all three sides at least BLOCK_SIDE: a block, plain or textured, hidden in a big group or not. */
export function bigBlocks(group) {
  return solidBoxes(group).filter((b) => b.sides[0] >= BLOCK_SIDE);
}

/** Is the whole model a few boxes (BLOCK_MESHES meshes or fewer, all of them box geometry)? */
export function isFewBoxes(group) {
  const s = modelStats(group);
  return s.meshes <= BLOCK_MESHES && s.boxes === s.meshes;
}

/** The triangles a model of this much surface (m2) must have at least. */
export const minTriangles = (area) => BASE_TRIANGLES + TRIANGLES_PER_M2 * area;

/** Does the model have too few parts, or too few triangles for how much surface it has? */
export function isThin(group) {
  const s = modelStats(group);
  return s.meshes < MIN_MESHES || s.triangles < minTriangles(s.area);
}

/** Is the model a large surface in one plain colour? */
export function isPlain(group) {
  const s = modelStats(group);
  return s.area >= MIN_PLAIN_AREA && s.textured < MIN_TEXTURED;
}

/** Every `export function build[A-Z]...` of src/items, src/workshop and src/world and every `export class` of src/items and src/workshop, as `dir/file.js: Name`. */
export function exportedMakers() {
  const functions = [];
  const classes = [];
  for (const dir of ['items', 'workshop', 'world']) {
    for (const f of fs.readdirSync(new URL(`../../src/${dir}/`, import.meta.url)).filter((n) => n.endsWith('.js'))) {
      const src = fs.readFileSync(new URL(`../../src/${dir}/${f}`, import.meta.url), 'utf8');
      for (const m of src.matchAll(/^export function (build[A-Z]\w*)/gm)) functions.push(`${dir}/${f}: ${m[1]}`);
      if (dir !== 'world') for (const m of src.matchAll(/^export class (\w+)/gm)) classes.push(`${dir}/${f}: ${m[1]}`);
    }
  }
  return { functions, classes };
}

/**
 * The exported makers (from exportedMakers) that no model was built with: not in `ran` (the names buildWorldModels recorded as called) and not
 * explained in `notModels`. A name in a list that nothing calls does not count, so naming a builder without building it fails.
 */
export function unbuilt(exported, ran, notModels) {
  return exported.filter((e) => !ran.has(e.split(': ')[1]) && !(e in notModels));
}
