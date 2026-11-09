import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  buildWorldModels, exportedMakers, unbuilt, modelStats, solidBoxes, bigBlocks, isFewBoxes, isThin, isPlain, minTriangles,
  TRIANGLES_PER_M2,
} from './helpers/worldModels.js';
import { SET_PIECE_NAMES, BARN_PROP_NAMES } from '../src/world/farDetail.js';

// Anything new you'll see has to look like more than a block. This builds every named set piece, barn prop, world builder, carried item and
// fixture, and fails one that is a block (a single solid box with every side 1.5 m or more, wherever it hides in a big group or a merged mesh),
// a few boxes, too few triangles for its size, or large and all one plain colour. The judging is in tests/helpers/worldModels.js, one function
// per check, and the cases at the foot of this file run those same functions on stand-ins to show each one can fail. The limits come from what is
// there now; a new thing that fails needs its detail, not a bigger allowance: read .claude/rules/looks.md.

/** Existing models with a solid box of 1.5 m or more on every side, with what it is; each is for a detail item to fix and then remove. Never add a new thing here. */
const KNOWN_BLOCKS = {
  village: 'the garden sheds behind three cottages (2.2 x 2.0 x 1.7 m weathered boxes) and the pub\'s rendered back extension (7 x 3.2 x 3 m)',
};

/** Existing models with too few parts or triangles for their size, with why; each is for a detail item to fix and then remove. Never add a new thing here. */
const KNOWN_THIN = {
  chain: 'the hook in your hand is a single torus, and the chain itself is a line',
  towRope: 'the hook in your hand is a single torus, and the rope itself is a line',
};

/** Existing models that are plain colour all over, with why; each is for a detail item to fix and then remove. Never add a new thing here. */
const KNOWN_PLAIN = {
  logs: 'bark in two flat browns, no grain or rings on the ends',
  coneCourse: 'moulded orange rubber cones, no texture',
  tyreRack: 'black tyres and a plain steel frame',
  helmetHooks: 'a painted board and plain hooks',
  sparesRack: 'a steel shelf and bins in flat colour',
  generator: 'a red painted housing in flat colour',
  compressor: 'a red painted tank in flat colour',
  washer: 'a white painted body in flat colour',
  brushwood: 'sticks in flat brown, no bark texture',
  'trolley-jack': 'painted steel in flat colour',
  pit: 'concrete and steel edging in flat colour',
  electricFence: 'plain posts, tape and a battery box in flat colour',
  jumpRamp: 'an earth ramp in flat colour',
  brushwoodHeap: 'sticks in flat brown, no bark texture (as brushwood)',
  feedBin: 'a plain plastic bin and lid in flat colour',
  fuelTank: 'a painted green tank and plain steel stands, with only the lettering textured',
  hose: 'plain green rubber and brass fittings in flat colour',
  toolbox: 'a painted steel box and plain tools in flat colour',
  woodStack: 'logs in flat bark brown with flat pale ends, no grain or rings',
};

/**
 * Exported builders and classes that are not a model of their own, with why, as `dir/file.js: Name`. A model is built in buildWorldModels
 * (tests/helpers/worldModels.js) instead; this is only for what has none, and a name here must still exist and must not be built there.
 */
const NOT_MODELS = {
  'world/roadMesh.js: buildRoadMesh': 'a road laid over the ground as a strip, the lane and the village street; no model of its own (its look is tests/roadMesh.test.js)',
  'world/autumnView.js: buildConkers': 'the conkers under the woods\' trees, made inside buildWoods (the "logs" and "trailMarkers" pieces)',
  'world/hillProps.js: buildPond': 'the hill\'s pond, made inside buildHill ("hill")',
  'world/trailProps.js: buildTrail': 'the trail markers, made inside buildWoods ("trailMarkers")',
  'world/quarryDebris.js: buildSign': 'the quarry\'s danger sign, made inside buildQuarry ("quarrySite")',
  'world/containerModel.js: buildContainer': 'the quarry\'s containers, made inside buildQuarry ("quarrySite")',
  'world/excavatorModel.js: buildExcavator': 'the quarry\'s excavator, made inside buildQuarry ("quarrySite")',
  'world/screeningPlantModel.js: buildScreeningPlant': 'the quarry\'s screening plant, made inside buildQuarry ("quarrySite")',
  'world/siteCabinModel.js: buildCabin': 'the quarry\'s site cabin, made inside buildQuarry ("quarrySite")',
  'world/villageBuildings.js: buildCottage': 'a cottage, made inside buildVillage ("village")',
  'world/villageBuildings.js: buildPub': 'the pub, made inside buildVillage ("village")',
  'world/villageBuildings.js: buildCarPark': 'the pub\'s car park, made inside buildVillage ("village")',
  'world/villageBuildings.js: buildShop': 'the shop, made inside buildVillage ("village")',
  'world/villageBuildings.js: buildGarage': 'the garage, made inside buildVillage ("village")',
  'world/trafficView.js: buildVehicleBody': 'a car or van body, made inside buildVillage and buildNeighbourFarm and by the traffic; vehicles have their own detail kit and tests (.claude/rules/vehicle-detail.md)',
  'world/hedgeFar.js: buildFarHedges': 'the hedges\' far strips: plain on purpose, drawn only beyond 150 m, where the leafy blocks of the near version (made inside buildProps) are left out',
  'world/farVersion.js: buildFarVersion': 'the far version of the village and the neighbour\'s farm: plain boxes on purpose, hung on `userData.farVersion` and never in the scene up close',
  'world/props.js: buildProps': 'calls every world builder above in turn; each of them is built on its own',
  'items/baleSpike.js: SpikeLift': 'logic only: where the spike\'s plate is (the spike is part of the tractor\'s model)',
  'items/baleSpike.js: BaleYard': 'logic only: where the bales are',
  'items/baleSpikeRig.js: BaleSpikeRig': 'moves the tractor\'s spike and the bales props.js made; no model of its own',
  'items/generator.js: Generator': 'logic only; its model is buildGeneratorModel ("generator")',
  'items/logSplitter.js: LogSplitter': 'logic only; the splitter is part of the tractor\'s model',
  'items/logSplitter.js: LogStack': 'logic only; the stack\'s model is StackView ("woodStack")',
  'items/lostThings.js: LostThings': 'logic only: which things turn up where',
  'items/powerHost.js: PowerHost': 'a host that wires the generator and the charger into game.js; no model',
  'items/rackHost.js: RackHost': 'a host that wires the racks into game.js; their models are in the catalogue',
  'items/toolsHost.js: ToolsHost': 'a host that wires the tools into game.js; no model',
  'items/towHost.js: TowHost': 'a host that wires the tow rope and chain into game.js; their models are in the catalogue',
  'items/tractorWorkHost.js: TractorWorkHost': 'a host that wires the tractor\'s work into game.js; no model',
  'workshop/bench.js: Bench': 'the bench\'s panel and an invisible box to look at; imports its stylesheet, so it cannot be built here. The bench itself is part of the barn',
  'workshop/benchJobs.js: BenchJob': 'logic only: the steps of a job',
  'workshop/charger.js: Charger': 'logic only; its model is buildChargerModel ("batteryCharger")',
  'workshop/logbook.js: Logbook': 'logic only: what Amy has written down',
  'workshop/notebook.js: Notebook': 'wires Amy\'s notebook into game.js; its model is buildNotebookModel ("notebook")',
  'workshop/service.js: ServiceJob': 'logic only: the steps of a service',
  'workshop/service.js: ServiceRun': 'logic only: a service under way',
  'workshop/shedView.js: ShedView': 'places the shed kit\'s models in the barn; each is built ("catalogue", "compressor", "washer", "pit") and the rest is an invisible box',
  'workshop/spares.js: Spares': 'logic only: what is in stock',
  'workshop/sparesShelf.js: SparesShelf': 'places the spares rack and the tyre rack in the barn; both are built ("sparesRack", "tyreRack") and the rest is invisible boxes',
  'workshop/workshop.js: Workshop': 'a host that wires the bench, the shelf and the notebook into game.js; no model',
};

const FIX = 'Read .claude/rules/looks.md: give it a shape (a frame, a lip, parts), a texture from the kits and small detail, then run this again. Do not add it to a KNOWN_ list.';

let models;
let ran;
beforeAll(async () => {
  ({ models, ran } = await buildWorldModels());
}, 120000);

const failing = (check) => models.filter(({ group }) => check(group)).map((m) => m.name);
const staleIn = (known, nowFailing) => Object.keys(known).filter((n) => !nowFailing.includes(n));

describe('the bare-block check on the real models', () => {
  it('has a model for every set piece and barn prop named in farDetail.js, and none that is not named there', () => {
    const built = (kind) => models.filter((m) => m.kind === kind).map((m) => m.name).sort();
    expect(built('setPiece'), 'SET_PIECE_NAMES: add the new one to buildWorldModels in tests/helpers/worldModels.js').toEqual([...SET_PIECE_NAMES].sort());
    expect(built('barnProp'), 'BARN_PROP_NAMES: add the new one to buildWorldModels in tests/helpers/worldModels.js').toEqual([...BARN_PROP_NAMES].sort());
  });

  it('builds every build function of the items, the workshop and the world, or says in NOT_MODELS why not', () => {
    const missing = unbuilt(exportedMakers().functions, ran, NOT_MODELS);
    expect(missing, `no model was built with these (add the call to buildWorldModels in tests/helpers/worldModels.js, or a line to NOT_MODELS in this file). ${FIX}`).toEqual([]);
  });

  it('builds every model class of the items and the workshop, or says in NOT_MODELS why not', () => {
    const missing = unbuilt(exportedMakers().classes, ran, NOT_MODELS);
    expect(missing, `no model was built with these (add the call to buildWorldModels, or a line to NOT_MODELS in this file). ${FIX}`).toEqual([]);
  });

  it('lists in NOT_MODELS only what is still exported and still not built', () => {
    const { functions, classes } = exportedMakers();
    const gone = Object.keys(NOT_MODELS).filter((e) => ![...functions, ...classes].includes(e));
    const built = Object.keys(NOT_MODELS).filter((e) => ran.has(e.split(': ')[1]));
    expect(gone, 'no longer exported: remove it from NOT_MODELS').toEqual([]);
    expect(built, 'now built in the catalogue: remove it from NOT_MODELS').toEqual([]);
  });

  it('has no solid box of 1.5 m or more on every side, apart from the known ones', () => {
    const blocks = models.filter(({ group }) => bigBlocks(group).length);
    const report = blocks.map((m) => `${m.name} (${bigBlocks(m.group).length}, e.g. ${bigBlocks(m.group)[0].sides.map((s) => s.toFixed(1)).join(' x ')} m)`);
    expect(report.filter((r) => !(r.split(' (')[0] in KNOWN_BLOCKS)), `blocks, textured or not. ${FIX}`).toEqual([]);
    expect(staleIn(KNOWN_BLOCKS, blocks.map((m) => m.name)), 'no longer has a block (or is gone): remove it from KNOWN_BLOCKS').toEqual([]);
  });

  it('has no model that is a block, or a few blocks', () => {
    expect(failing(isFewBoxes), `these are blocks. ${FIX}`).toEqual([]);
  });

  it('has no model of too few parts, or too few triangles for its size, apart from the known ones', () => {
    const thin = failing(isThin);
    const detail = (n) => `${n} (${modelStats(models.find((m) => m.name === n).group).meshes} meshes, ${Math.round(modelStats(models.find((m) => m.name === n).group).triangles)} triangles)`;
    expect(thin.filter((n) => !(n in KNOWN_THIN)).map(detail), `too little to look like the real thing. ${FIX}`).toEqual([]);
    expect(staleIn(KNOWN_THIN, thin), 'no longer thin (or is gone): remove it from KNOWN_THIN').toEqual([]);
  });

  it('has no large model in one plain colour, apart from the known ones', () => {
    const plain = failing(isPlain);
    expect(plain.filter((n) => !(n in KNOWN_PLAIN)), `plain colour all over. ${FIX}`).toEqual([]);
    expect(staleIn(KNOWN_PLAIN, plain), 'now textured (or gone): remove it from KNOWN_PLAIN').toEqual([]);
  });
});

// The same checks on stand-ins, so each is shown to fail. Sizes are width x height x depth in metres.
const plain = new THREE.MeshStandardMaterial({ color: 0x8a8a80 });
const textured = new THREE.MeshStandardMaterial({ color: 0xffffff, map: new THREE.Texture() });
const box = (w, h, d, material = plain, at = [0, 0, 0], turn = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(...at);
  m.rotation.y = turn;
  return m;
};
const group = (...meshes) => {
  const g = new THREE.Group();
  g.add(...meshes);
  g.updateMatrixWorld(true);
  return g;
};
/** Two boxes merged into one mesh of one material, the way neighbourFarmProps.js builds its parts, so their world shape is baked into the vertices. */
const merged = (a, b, material = plain) => {
  const geos = [a, b].map((m) => {
    m.updateMatrix();
    return m.geometry.clone().applyMatrix4(m.matrix);
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), material);
  return mesh;
};
describe('the checks can fail', () => {
  it('fails one plain box of 12 x 6 x 8 m', () => {
    const g = group(box(12, 6, 8));
    expect(bigBlocks(g)).toHaveLength(1);
    expect(isFewBoxes(g)).toBe(true);
  });

  it.each([
    ['village', 12, 6, 8],
    ['neighbourFarm', 20, 8, 10],
  ])('fails a plain block added to %s, which is more than a thousand meshes', (name, w, h, d) => {
    const real = models.find((m) => m.name === name).group;
    const before = bigBlocks(real).length;
    const block = box(w, h, d, plain, [500, 0, 500]);
    real.add(block);
    real.updateMatrixWorld(true);
    try {
      expect(bigBlocks(real)).toHaveLength(before + 1);
    } finally {
      real.remove(block);
    }
  });

  it('fails a textured box of 12 x 6 x 8 m as well as a plain one', () => {
    expect(bigBlocks(group(box(12, 6, 8, textured)))).toHaveLength(1);
  });

  it('fails a 12 x 6 x 8 m building of four textured boxes', () => {
    // Two storeys of two halves: each is a box of 6 x 3 x 8 m.
    const chunky = group(box(6, 3, 8, textured, [-3, 1.5, 0]), box(6, 3, 8, textured, [3, 1.5, 0]), box(6, 3, 8, textured, [-3, 4.5, 0]), box(6, 3, 8, textured, [3, 4.5, 0]));
    expect(bigBlocks(chunky)).toHaveLength(4);
    // Four thin walls round nothing: no box is a block, but 48 triangles cannot cover 500 m2 of building.
    const walls = group(box(12, 6, 0.3, textured, [0, 3, -4]), box(12, 6, 0.3, textured, [0, 3, 4]), box(0.3, 6, 8, textured, [-6, 3, 0]), box(0.3, 6, 8, textured, [6, 3, 0]));
    expect(bigBlocks(walls)).toHaveLength(0);
    expect(isFewBoxes(walls)).toBe(false);
    expect(isThin(walls)).toBe(true);
  });

  it('finds boxes merged into one mesh by material, however they are turned', () => {
    const g = group(merged(box(12, 6, 8, plain, [0, 0, 0], 0.4), box(20, 8, 10, plain, [100, 0, 0], 1.1)));
    const found = solidBoxes(g).map((b) => b.sides.map((s) => Math.round(s)));
    expect(found).toEqual([[6, 8, 12], [8, 10, 20]]);
    expect(bigBlocks(g)).toHaveLength(2);
    // Boxes of any size merged with a model's other parts are still found, and a merged thin plank is not a block.
    const plank = merged(box(2, 0.1, 0.1, plain, [0, 0, 0]), box(3, 0.1, 0.1, plain, [10, 0, 0]));
    expect(bigBlocks(group(plank))).toHaveLength(0);
    expect(solidBoxes(group(plank))).toHaveLength(2);
  });

  it('does not take a model that is not boxes for one', () => {
    const ball = group(new THREE.Mesh(new THREE.IcosahedronGeometry(4, 2), plain));
    expect(solidBoxes(ball)).toHaveLength(0);
  });

  it('does not count a box nobody sees', () => {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 8), new THREE.MeshBasicMaterial({ visible: false }));
    expect(bigBlocks(group(proxy))).toHaveLength(0);
  });

  it('asks for more triangles of a larger model, and more of a barn than of a small item', () => {
    expect(minTriangles(0)).toBe(40);
    expect(TRIANGLES_PER_M2).toBeGreaterThan(0);
    expect(minTriangles(500)).toBeGreaterThan(minTriangles(1) * 10);
    // A hose-sized thing and a barn-sized thing built from the same 300 triangles of sticks: only the small one has enough.
    const sticks = (size) => group(...[0, 1, 2, 3, 4].map((i) => new THREE.Mesh(new THREE.CylinderGeometry(size, size, size * 10, 16), plain)));
    expect(isThin(sticks(0.02))).toBe(false);
    expect(isThin(sticks(8))).toBe(true);
  });

  it('fails a plain model of any size, a barn included, and passes a textured one', () => {
    const wall = (material) => group(new THREE.Mesh(new THREE.SphereGeometry(5, 64, 48), material));
    expect(isPlain(wall(plain))).toBe(true);
    expect(isPlain(wall(textured))).toBe(false);
  });

  it('fails a builder that is named and never built', () => {
    const exported = ['items/zzCrate.js: buildZzCrate', 'items/lunchBag.js: buildLunchBag'];
    expect(unbuilt(exported, new Set(['buildLunchBag']), {})).toEqual(['items/zzCrate.js: buildZzCrate']);
    // Listing it in NOT_MODELS is the one way to leave it out, and it needs a reason.
    expect(unbuilt(exported, new Set(['buildLunchBag']), { 'items/zzCrate.js: buildZzCrate': 'a reason' })).toEqual([]);
    // The catalogue records only what ran, so a name that is merely written down is not enough.
    expect(ran.has('buildLunchBag')).toBe(true);
    expect(ran.has('buildZzCrate')).toBe(false);
  });
});
