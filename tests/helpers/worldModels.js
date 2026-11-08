import * as THREE from 'three';
import { vi } from 'vitest';
import { fakeCanvas } from './vehicleModels.js';
import { LAYOUT } from '../../src/world/layout.js';
import { createTerrainHeight } from '../../src/world/terrainHeight.js';
import { createFields } from '../../src/world/fields.js';
import { Track } from '../../src/world/track.js';

// Every named set piece (SET_PIECE_NAMES, BARN_PROP_NAMES in world/farDetail.js) and every carried item's and fixture's model, built in node
// the way the game builds them, for the tests that look at them as a whole (bareBlocks.test.js). The textures draw on canvases, so a canvas that
// accepts every call stands in; the colliders, the physics world and the GLTF models the trees use are stubs, as nothing here reads them.

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
    models: new Proxy({}, { get: () => ({ scene: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), scenes: [], animations: [] }) }),
    laneTexture: () => fakeCanvas(),
  };
}

/** [{ name, kind, group }]: `kind` is 'setPiece' (a name in SET_PIECE_NAMES), 'barnProp' (BARN_PROP_NAMES) or 'item' (carried, or a fixture). Call from a beforeAll. */
export async function buildWorldModels() {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const out = [];
  const add = (kind, name, group) => {
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
  add('setPiece', 'village', buildVillage(c) && found('village') ? found('village') : buildVillage(c)?.root ?? found('village'));
  const { buildNeighbourFarm } = await import('../../src/world/neighbourFarmProps.js');
  buildNeighbourFarm(c);
  add('setPiece', 'neighbourFarm', found('neighbourFarm'));
  const { buildRiverside } = await import('../../src/world/riverProps.js');
  buildRiverside(c);
  add('setPiece', 'riverside', found('riverside'));
  const { buildWoods } = await import('../../src/world/woodsProps.js');
  buildWoods(c);
  add('setPiece', 'logs', found('logs'));
  add('setPiece', 'trailMarkers', found('trailMarkers'));
  const { buildQuarry } = await import('../../src/world/quarryProps.js');
  buildQuarry(c);
  add('setPiece', 'quarrySite', found('quarrySite'));
  const { buildHut } = await import('../../src/world/hutBuild.js');
  add('setPiece', 'shepherdsHut', buildHut(c).group);
  const { buildLineUpBays } = await import('../../src/world/lineUpBays.js');
  add('setPiece', 'lineUpSleepers', buildLineUpBays(c.scene, heightAt, LAYOUT.lineUp ?? { x: 0, z: 0, yaw: 0, length: 6, bays: 3 }).group);
  const { buildClimbCones, buildConeCourse } = await import('../../src/world/startLine.js');
  const gates = [0, 1, 2].map((i) => ({ x: i * 6, z: 0, tx: 1, tz: 0, half: 2 }));
  add('setPiece', 'climbCones', buildClimbCones(c.scene, heightAt, gates));
  add('setPiece', 'coneCourse', buildConeCourse(c.scene, heightAt, [0, 1, 2, 3].map((i) => ({ x: i * 4, z: 0 }))).group);
  const { buildRollingRoadModel } = await import('../../src/world/rollingRoadModel.js');
  add('setPiece', 'rolling-road-trailer', buildRollingRoadModel());
  const { buildBundle } = await import('../../src/items/brushwood.js');
  add('setPiece', 'brushwood', buildBundle(c.random));

  const { buildTyreRackModel } = await import('../../src/workshop/tyreRackModel.js');
  add('barnProp', 'tyreRack', buildTyreRackModel());
  const { buildSparesModel } = await import('../../src/workshop/sparesModel.js');
  add('barnProp', 'sparesRack', buildSparesModel());
  const { buildChargerModel } = await import('../../src/workshop/chargerModel.js');
  add('barnProp', 'batteryCharger', buildChargerModel().group);
  const { buildJack, buildAxleStand } = await import('../../src/workshop/jackModel.js');
  add('barnProp', 'trolley-jack', buildJack());
  add('barnProp', 'axle-stand', buildAxleStand());
  const { JumperRail } = await import('../../src/world/jumperRail.js');
  add('barnProp', 'jumperRack', new JumperRail(c.scene, LAYOUT, heightAt).group);
  const { HelmetHooks } = await import('../../src/world/helmetHooks.js');
  add('barnProp', 'helmetHooks', new HelmetHooks(c.scene, LAYOUT, heightAt).group);
  const { BiscuitTinView } = await import('../../src/world/biscuitTinView.js');
  new BiscuitTinView({ scene: c.scene, world: { layout: LAYOUT, heightAt } });
  add('barnProp', 'snackTin', found('snackTin'));

  // Carried items and the workshop's fixtures: the builders that need no scene or physics world.
  const { buildBoosterModel } = await import('../../src/items/boosterPack.js');
  add('item', 'boosterPack', buildBoosterModel());
  const { buildBatteryModel } = await import('../../src/items/battery.js');
  add('item', 'battery small', buildBatteryModel('small', 'Test'));
  add('item', 'battery big', buildBatteryModel('big', 'Test'));
  const { buildLunchBag } = await import('../../src/items/lunchBag.js');
  add('item', 'lunchBag', buildLunchBag());
  const { buildGeneratorModel } = await import('../../src/items/generatorModel.js');
  add('item', 'generator', buildGeneratorModel().group);
  const { buildRackStrap } = await import('../../src/items/rackStrap.js');
  add('item', 'rackStrap', buildRackStrap('can'));
  const { buildRound, buildLog } = await import('../../src/items/woodPieces.js');
  add('item', 'woodRound', buildRound(c.random));
  add('item', 'woodLog', buildLog());
  const { buildNotebookModel } = await import('../../src/workshop/notebookModel.js');
  add('item', 'notebook', buildNotebookModel());
  const shed = await import('../../src/workshop/shedModels.js');
  add('item', 'compressor', shed.buildCompressor().group);
  add('item', 'washer', shed.buildWasher().group);
  add('item', 'pit', shed.buildPit().group);
  add('item', 'catalogue', shed.buildCatalogue().group);

  return out;
}

/** The `build...` functions of src/items and src/workshop that buildWorldModels calls: a new one that is not listed here fails bareBlocks.test.js. */
export const CATALOGUED_BUILDERS = [
  'buildBundle', 'buildBoosterModel', 'buildBatteryModel', 'buildLunchBag', 'buildGeneratorModel', 'buildRackStrap', 'buildRound', 'buildLog',
  'buildNotebookModel', 'buildCompressor', 'buildWasher', 'buildPit', 'buildCatalogue', 'buildSparesModel', 'buildChargerModel', 'buildJack',
  'buildAxleStand', 'buildTyreRackModel',
];

/**
 * What a model is made of: meshes, triangles, whether every mesh is a box (one `BoxGeometry`, or a box's twelve triangles), and the share of its
 * surface (m2, as it stands in the world) that has a texture or vertex colours, against a plain colour.
 */
export function modelStats(group) {
  group.updateMatrixWorld(true);
  const s = { meshes: 0, triangles: 0, boxes: 0, area: 0, texturedArea: 0 };
  const [a, b, c, scale] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  group.traverse((o) => {
    if (!o.isMesh) return;
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
