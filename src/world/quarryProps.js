// The things in and round the gravel pit (world/quarry.js): a tumbledown post-and-wire fence round the lip with its danger signs, the site's
// steel container, an old excavator left on the floor and a screening plant (a hopper and crusher on a pad, conveyors and a screen, delivering onto a heap), its cabin and generator, drums and
// tyres by the pond, hawthorn and gorse along the lip, boulders and flints fallen from the walls, dead trees, and the pond with its reeds.
// All procedural, with canvas textures; the big pieces have colliders. The ground itself (the walls, the heaps, the road) is the terrain's.
// And the lane entrance on the new farm (#1002): the shut lane gate dressed, its bellmouth, blocks, barrier, signs, weeds, buddleia, hedge and litter.
// And the relics as years of standing have left them (#1003): weathered from their own stream (`pitRelicWear`), grass, birch and buddleia over the
// heaps, reeds and rushes round the pond, weeds through the tracks, the drums and the plant's footings, and the container on its hardstanding.
// And the field gone to scrub (#1004): hawthorn, gorse, bramble and birch thick along the lip, rough grass and thistles over the rough with a ride
// kept open, a tree line of hawthorn with ash and oak standards on the sides that face arable, roots hanging from the lip's topsoil, scree at the
// walls' foot, textured stones, dead trees with real limbs, tyres with their liners and a pallet built as one is. Each new thing from a stream of its own.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instanceModel, modelBounds, enableShadows } from './assets.js';
import { matrixAt, buildPond } from './hillProps.js';
import { woodTexture, barkTexture } from './neighbourTextures.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { quarryPlants } from './quarry.js';
import { Parts } from './parts.js';
import { rustTexture, signTexture, bellmouthTexture, bellmouthUv, tarmacTexture, hardstandingTexture, pitStoneTexture } from './quarryTextures.js';
import { pitCover, pitLip, pitTreeLine, relicScrub, scrubOk } from './pitScrub.js';
import { hawthornModel, ashStandardModel, deadTreeGeometry } from './landmarkProps.js';
import { farKitTree, farTree, farSprayTree } from './treeFar.js';
import { gorseTexture, gorseBushGeometry, brambleLeafTexture, brambleGeometry, sprayTexture, plantMaterial as leafCardMaterial } from './woodPlants.js';
import { roadNetwork } from './roads.js';
import { crownAt } from './roadMesh.js';
import { leafReach } from './hedgeSolid.js';
import { leafParts, standingWater } from './yardKit.js';
import { vergeMakers } from './laneVerge.js';
import { buildFarHedges, HedgeSwap, leafTint, FAR_HEDGE_TOP, FAR_HEDGE_WIDTH, FAR_HEDGE_END } from './hedgeFar.js';
import { worksSignTexture, privatePlateTexture } from './villageTextures.js';
import { laneGateOf, laneReach, entrancePlan, entranceHedges, rutDip, tarmacAt, ENTRANCE, SIGN_WORDS } from './pitEntrance.js';
import {
  entranceMaterials, addGatePost, addHinges, addChainAndLock, addConcreteBlock, addHeightBarrier, addSignBoard, buddleiaMaterials, addBuddleia,
  litterMaterials, addLitter, drapeGeometry, tarmacChunkGeometry,
} from './entranceKit.js';
import { buildExcavator, excavatorMaterials } from './excavatorModel.js';
import { buildContainer, containerMaterials } from './containerModel.js';
import { buildCabin, cabinMaterials } from './siteCabinModel.js';
import { buildScreeningPlant, plantMaterials } from './screeningPlantModel.js';
import { plantSite, plantPoint, inPlantsWay, PLANT } from './plantSite.js';
import { buildSign, debrisMaterials, drumGeometry, scatterClear, tyreGeometry, addPallet, DRUM, TYRE } from './quarryDebris.js';
import { wireFenceMaterials, wireFenceRun, addPost, addSpan } from './wireFence.js';
import { streamFor } from './propStreams.js';
import { pitGrowth, excavatorGrowth, drumWeeds, containerDressing, framePoint } from './pitGrowth.js';
import { plantMaterial, reedModel, rushModel, sedgeModel, tussockModel, birchModel, thistleModel, rootTangleModel } from './riverPlants.js';

const TAU = Math.PI * 2;

/** Builds the pit's props and their colliders. `c` is the props context (props.js). Returns the set piece (`userData.treeSwap`: its scrub's near and far). */
export function buildQuarry(c) {
  const quarry = c.fields.quarry;
  takeOldPlantDraws(quarry, c.random); // so the relics, dealt from the pit's stream after them, stand where they did (#1004)
  const plants = quarryPlants(quarry); // from the plants' own stream
  // One set piece (farDetail.js SET_PIECE_NAMES): everything in the pit's field is left out beyond the far-detail distance, so a view from the
  // yard or the village pays nothing for it.
  const site = new THREE.Group();
  site.name = 'quarrySite';
  const kit = pitKit();
  buildScrub(c, quarry, plants, site, kit);
  buildBoulders(c, quarry, plants, site);
  const relics = buildSite(c, quarry, site);
  buildPitGrowth(c, quarry, site, relics);
  buildFieldCover(c, quarry, site, relics, kit);
  buildLip(c, quarry, plants, site);
  site.userData.relics = relics; // where each relic stands, for the console's places and the scenes
  c.scene.add(site);
  buildPond(c, quarry, () => false, { reeds: false }); // its reeds are the river's, round its edge (buildPitGrowth)
  buildPitBoundary(c);
  buildPitTreeLine(c, quarry, kit);
  return site;
}

/** The pit's own plant models and materials (#1004), made once a build from their own stream: the field's hawthorn, gorse, bramble and birch. */
function pitKit() {
  const random = streamFor('pitKit');
  const sprays = leafCardMaterial(sprayTexture(random));
  const hawthorn = hawthornModel(random, sprays, { height: 5 });
  const birch = birchScrubModel(random);
  return {
    hawthorn,
    hawthornFar: farSprayTree(hawthorn),
    ash: ashStandardModel(random, barkTexture(random, 'ash'), sprays),
    gorse: { geo: gorseBushGeometry(random), mat: leafCardMaterial(gorseTexture(random)) },
    bramble: { geo: brambleGeometry(random), mat: leafCardMaterial(brambleLeafTexture(random)) },
    birch,
    birchFar: farKitTree(birch),
  };
}

/** A birch of the scrub (#1004): the plant kit's young birch (riverPlants.js `birchModel`), a metre tall to be scaled up, in the atlas's material, as a model the scatter places. */
function birchScrubModel(random) {
  const mesh = new THREE.Mesh(birchModel(random, { height: 1, branches: 5 }), plantMaterial());
  mesh.name = 'birchScrub';
  const group = new THREE.Group();
  group.name = 'birch';
  group.add(mesh);
  return group;
}

/**
 * The draws the pit's plants took from its stream before #1004 (when `quarryPlants` dealt 90 bushes, 6 trees, 64 boulders and 9 big ones from it,
 * and the scrub and boulders drew their turns and shapes from it after), taken again in the same order and number, so everything dealt after them
 * from the pit's stream (the fence, the container, the cabin, the drums and tyres, the dead trees, the signs, the pond and the boundary) stands
 * exactly where it did. The plants now come from a stream of their own, so changing them never moves the relics again.
 */
function takeOldPlantDraws(quarry, random) {
  const { pit, rect } = quarry;
  const patch = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.07 + z * 0.05 + 0.7) + 0.25 * Math.sin(z * 0.1 - x * 0.045 + 2.1);
  let bushes = 0;
  for (let tries = 0; bushes < 90 && tries < 20000; tries++) {
    const a = random() * TAU;
    let x;
    let z;
    if (random() < 0.65) {
      const p = quarry.frameAt(a, quarry.rimAt(a) + 2 + random() * 9);
      x = p.x;
      z = p.z;
    } else {
      x = rect.minX + 3 + random() * (rect.maxX - rect.minX - 6);
      z = rect.minZ + 3 + random() * (rect.maxZ - rect.minZ - 6);
    }
    if (random() > 0.25 + 0.75 * patch(x, z)) continue;
    if (!quarry.plantOk(x, z)) continue;
    random();
    bushes++;
  }
  const trees = [];
  for (let tries = 0; trees.length < 6 && tries < 4000; tries++) {
    const x = rect.minX + 6 + random() * (rect.maxX - rect.minX - 12);
    const z = rect.minZ + 6 + random() * (rect.maxZ - rect.minZ - 12);
    if (!quarry.plantOk(x, z, 7)) continue;
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 12)) continue;
    random();
    trees.push([x, z]);
  }
  const start = quarry.climb.points[0];
  let boulders = 0;
  for (let tries = 0; boulders < 64 && tries < 5000; tries++) {
    const a = random() * TAU;
    const run = quarry.runAt(a);
    const p = quarry.frameAt(a, quarry.floorEdge(a) + (random() - 0.35) * run * 0.7);
    if (quarry.waterAt(p.x, p.z) > 0 || pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r)) continue;
    if (quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 1.2) continue;
    if (inPlantsWay(pit, p.x, p.z, 0.6)) continue;
    if (Math.hypot(p.x - start[0], p.z - start[1]) < 4) continue;
    random();
    random();
    boulders++;
  }
  const big = [];
  for (let tries = 0; big.length < 9 && tries < 3000; tries++) {
    const a = random() * TAU;
    const p = quarry.frameAt(a, quarry.floorEdge(a) - 2 - random() * 12);
    if (quarry.waterAt(p.x, p.z) > 0 || quarry.roadNear(p.x, p.z).d < 8) continue;
    if (pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + 1.5) || inPlantsWay(pit, p.x, p.z, 1.5)) continue;
    if (Math.hypot(p.x - start[0], p.z - start[1]) < 9) continue;
    if (big.some(([bx, bz]) => Math.hypot(bx - p.x, bz - p.z) < 6)) continue;
    random();
    big.push([p.x, p.z]);
  }
  // The scrub: each bush hawthorn (a turn) or gorse (a turn and two stretches), the gorse clump's seven lumps of 80 faces, and each tree's model and turn.
  for (let i = 0; i < bushes; i++) {
    if (random() < 0.5) random();
    else for (let k = 0; k < 3; k++) random();
  }
  for (let k = 0; k < 7; k++) {
    random();
    if (k) random();
    random();
    for (let f = 0; f < 80 * 5; f++) random();
  }
  for (let i = 0; i < trees.length * 2; i++) random();
  // The boulders: four draws each, a rock's shape for each of four lots, a turn for each big one and a shape for each of three lots.
  const rockDraws = () => {
    random();
    for (let i = 0; i < 3 + Math.floor(random() * 3); i++) for (let k = 0; k < 3; k++) random();
    random();
    random();
  };
  for (let i = 0; i < boulders * 4; i++) random();
  for (let i = 0; i < Math.min(4, boulders); i++) rockDraws();
  for (let i = 0; i < big.length; i++) random();
  for (let i = 0; i < Math.min(3, big.length); i++) rockDraws();
}

/**
 * The pit's field's own fence (#685): post and wire along every boundary of kind 'fence' (all four sides of the Old Pit), open at each gateway's gap, with
 * a collider along every span so it is as solid as the hedges it replaces (`hedgeDistance` and `hedgeAhead` count the line from the plan, this is what
 * stops the quad). A set piece for `farDetail.js` (`pitFence`). Null on today's farm, which has hedges.
 */
export function buildPitBoundary({ scene, layout, heights, fixedBox, random }) {
  const lines = (layout.boundaries ?? []).map((b, index) => ({ b, index })).filter(({ b }) => b.kind === 'fence');
  if (!lines.length) return null;
  const parts = new Parts();
  const mats = wireFenceMaterials(random);
  const count = { spans: 0, posts: 0, strainers: 0 };
  const standing = new Set(); // where a strainer already stands, so a corner shared by two sides has one
  for (const { b, index } of lines) {
    const gaps = (layout.gateways ?? []).filter((g) => g.boundary === index && g.half).map((g) => [g.at - g.half, g.at + g.half]);
    const done = wireFenceRun({ parts, mats, points: b.points, gaps, groundY: (x, z) => heights.heightAt(x, z), fixedBox, random, standing });
    for (const k of Object.keys(count)) count[k] += done[k];
  }
  const group = parts.build({ castShadow: false });
  group.name = 'pitFence';
  group.userData.count = count;
  scene.add(group);
  return group;
}

/** Puts a model's colliders ([x, y, z, half x, half y, half z] in its own frame) in the world where it stands: at `at`, on `y0`, turned `turn` about y. */
function placeBoxes(fixedBox, at, y0, turn, boxes) {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  for (const [bx, by, bz, hx, hy, hz] of boxes) fixedBox(at.x + cos * bx + sin * bz, y0 + by, at.z - sin * bx + cos * bz, hx, hy, hz, turn);
}

/**
 * Stands a model on the ground: its middle at the average height of the ground under four spots (`ax` along its x, `az` along its z), tipped to the
 * lie of the land by no more than a quarter of a radian, and turned `turn`. Returns the height of its middle, for the colliders.
 */
function settle(group, at, turn, ax, az, groundY) {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const h = (lx, lz) => groundY(at.x + cos * lx + sin * lz, at.z - sin * lx + cos * lz);
  const [f, b, r, l] = [h(ax, 0), h(-ax, 0), h(0, az), h(0, -az)];
  const lim = (v) => Math.max(-0.25, Math.min(0.25, v));
  group.position.set(at.x, (f + b + r + l) / 4, at.z);
  group.rotation.set(-lim(Math.atan2(r - l, 2 * az)), turn, lim(Math.atan2(f - b, 2 * ax)), 'YXZ');
  return group.position.y;
}

/** The pit's own deal of a random stream: a spot on the floor or the rim, found by trying. */
function findSpot(tries, ok, pick) {
  for (let i = 0; i < tries; i++) {
    const p = pick();
    if (ok(p)) return p;
  }
  return null;
}

/**
 * The field's scrub (#1004): hawthorn, gorse, bramble and birch where `quarryPlants` dealt them, thick along the lip, from the pit's own plant kit
 * (`pitKit`), none of it solid (you push through scrub, as the old bushes let you); and a few oaks standing in the rough, which are. Their turns and
 * sizes from a stream of their own.
 */
function buildScrub(c, quarry, plants, site, kit) {
  const { models, heights, physics, RAPIER, anchors } = c;
  const random = streamFor('pitScrub');
  const ground = (x, z) => heights.heightAt(x, z);
  const lists = { hawthorn: [], gorse: [], bramble: [], birch: [] };
  for (const [x, z, s, kind] of plants.bushes) {
    const yaw = random() * TAU;
    const v = random();
    if (kind === 'hawthorn') lists.hawthorn.push(matrixAt(x, ground(x, z) - 0.15, z, yaw, (0.5 + s * 0.35) * (0.9 + v * 0.2)));
    else if (kind === 'gorse') {
      const g = 0.75 + s * 0.35; // 1 to 1.5 m across
      lists.gorse.push(matrixAt(x, ground(x, z) - 0.06, z, yaw, g * (0.9 + v * 0.3), g * (0.85 + random() * 0.3), g * (0.9 + random() * 0.3)));
    }
    else if (kind === 'bramble') lists.bramble.push(matrixAt(x, ground(x, z) - 0.04, z, yaw, 0.8 + s * 0.45, 0.7 + s * 0.4 + v * 0.2, 0.8 + s * 0.45));
    else lists.birch.push(matrixAt(x, ground(x, z) - 0.04, z, yaw, 1.4 + s * 1.3 + v * 0.6)); // the birch kit is a metre tall: these are 2 to 4.5 m
  }
  const scrub = new THREE.Group();
  scrub.name = 'pitScrub';
  if (lists.gorse.length) scrub.add(tiledInstances(kit.gorse.geo, kit.gorse.mat, lists.gorse, { tileSize: MODEL_TILE, name: 'pit-gorse' }));
  if (lists.bramble.length) scrub.add(tiledInstances(kit.bramble.geo, kit.bramble.mat, lists.bramble, { tileSize: MODEL_TILE, name: 'pit-bramble' }));
  // The oaks in the rough: their trunks are solid.
  const oaks = [[], []];
  for (const [x, z, s] of plants.trees) {
    const y = ground(x, z);
    oaks[random() < 0.5 ? 0 : 1].push(matrixAt(x, y - 0.15, z, random() * TAU, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, y + 2.5 * s, z));
    anchors.push({ x, y, z, r: 0.32 * s });
  }
  // The hawthorns, the birch and the oaks, near and far (#1004: `treeFullDistance`, as the farm's trees), so from the lane gate most of the field's are
  // the far versions (an oak was its full 6,300 triangles at any distance in the set piece). Swapped tile by tile as the scattered trees are, but in the
  // set piece, so from across the farm they cost nothing at all.
  const near = new THREE.Group();
  const far = new THREE.Group();
  const sets = [[kit.hawthorn, kit.hawthornFar, lists.hawthorn, true], [kit.birch, kit.birchFar, lists.birch, false]];
  if (models.treeA?.scene && plants.trees.length) sets.push([models.treeA.scene, farTree(models.treeA.scene), oaks[0], true], [models.treeB.scene, farTree(models.treeB.scene), oaks[1], true]);
  for (const [model, farModel, list, castShadow] of sets) {
    if (!list.length) continue;
    near.add(...instanceModel(model, list, { castShadow }).children);
    far.add(...instanceModel(farModel, list, { castShadow }).children);
  }
  near.name = 'pitScrubNear';
  far.name = 'pitScrubFar';
  scrub.add(near, far);
  if (near.children.length) site.userData.treeSwap = new HedgeSwap(near, far);
  site.add(scrub);
}

/** A smooth value-noise-ish wobble of a direction, 0..1: a few sines of the unit vector, so two vertices at one place always agree. */
const lump = (x, y, z, k) => 0.5 + 0.25 * Math.sin(x * 3.1 * k + y * 1.7 + z * 2.3) + 0.15 * Math.sin(y * 5.3 * k - x * 2.9 + z * 4.1) + 0.1 * Math.sin(z * 8.7 * k + x * 6.3 - y * 3.7);

/**
 * A rock: a closed, welded icosphere (its vertices shared, so no cracks) pushed about by a smooth lump, a few flat faces cut into it where a
 * quarried stone has split, its underside flattened, smooth normals and a tint that drifts across it. About 1 m across, base near y = 0. Its uvs
 * (#1004) lay the stone texture on it a tile a metre from the side each part faces; the tint goes over the texture.
 */
export function rockGeometry(random, detail = 3) {
  let geo = new THREE.IcosahedronGeometry(0.5, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-4);
  const p = geo.attributes.position;
  const seed = random() * 20;
  const planes = [];
  for (let i = 0; i < 3 + Math.floor(random() * 3); i++) {
    const t = random() * TAU;
    const u = random() * 2 - 1;
    const r = Math.sqrt(1 - u * u);
    planes.push({ n: [r * Math.cos(t), u * 0.8, r * Math.sin(t)], d: 0.27 + random() * 0.1 });
  }
  // A tint over the texture: grey, darker grey, iron-stained and pale. (They were the stone's whole colour, in linear terms, which lit pale as chalk.)
  const tint = [[0.98, 0.94, 0.88], [0.8, 0.8, 0.82], [1.0, 0.84, 0.68], [1.06, 1.02, 0.94]][Math.floor(random() * 4)];
  const squash = 0.7 + random() * 0.3;
  const colors = new Float32Array(p.count * 3);
  const uvs = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) * 2;
    const ny = p.getY(i) * 2;
    const nz = p.getZ(i) * 2;
    const k = 0.78 + 0.5 * lump(nx + seed, ny, nz - seed, 1);
    let x = nx * 0.5 * k;
    let y = ny * 0.5 * k * squash;
    let z = nz * 0.5 * k;
    for (const { n, d } of planes) {
      const over = x * n[0] + y * n[1] + z * n[2] - d;
      if (over > 0) {
        x -= n[0] * over;
        y -= n[1] * over;
        z -= n[2] * over;
      }
    }
    y = Math.max(y, -0.2);
    p.setXYZ(i, x, y + 0.2, z);
    const v = 0.88 + 0.24 * lump(x * 2.3 + seed, y * 2.3, z * 2.3, 2.2);
    colors.set([tint[0] * v, tint[1] * v, tint[2] * v], i * 3);
    // Laid from whichever side it faces, as a box is mapped: no seam, and only the faces between two sides take it a little askew.
    const [ax, ay, az] = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
    uvs.set(ay >= ax && ay >= az ? [x + seed, z] : ax >= az ? [z + 0.37, y + seed] : [x + 0.71, y - seed], i * 2);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/** How the stones are drawn (#1004): shapes for the wall's stones and the field's flints, for the big boulders, and their icospheres' detail. */
export const PIT_STONES = { shapes: 2, bigShapes: 2, detail: 2, bigDetail: 3 };

/** The pit's stone material (#1004): the stone texture under each rock's own tint, lit like the world. One for every stone in the pit. */
export function pitStoneMaterial(random = streamFor('pitStoneTexture')) {
  return new THREE.MeshStandardMaterial({ map: pitStoneTexture(random), vertexColors: true, roughness: 0.95, metalness: 0 });
}

/**
 * Boulders and stones fallen to the foot of the walls and strewn down the chutes, flints turned up in the rough, and a few big ones on the floor you
 * ride round (#1004: textured, two shapes each in 60 m tiles where it was four in 30 m and three, the small ones at a lighter detail). Their shapes and
 * turns from a stream of their own.
 */
function buildBoulders(c, quarry, plants, site) {
  const { heights, fixedBox } = c;
  const random = streamFor('pitStones');
  const material = pitStoneMaterial();
  // A stone sits in the ground, not on it: its middle at the ground's height, lower again on a slope, so the scree comes up round it.
  const sunk = (x, z, h) => {
    const y = heights.heightAt(x, z);
    const lean = Math.max(Math.abs(heights.heightAt(x + h, z) - y), Math.abs(heights.heightAt(x, z + h) - y));
    return y - h * 0.12 - Math.min(lean, h * 0.5) * 0.6;
  };
  const S = PIT_STONES;
  const stones = [];
  for (const [x, z, size] of plants.boulders) {
    const h = size * (0.6 + random() * 0.5);
    stones.push(matrixAt(x, sunk(x, z, h), z, random() * TAU, size * (1.1 + random() * 0.5), h, size * (1 + random() * 0.4)));
  }
  for (let i = 0; i < S.shapes; i++) {
    const mine = stones.filter((_, k) => k % S.shapes === i);
    if (mine.length) site.add(tiledInstances(rockGeometry(random, S.detail), material, mine, { tileSize: MODEL_TILE, castShadow: true, name: 'quarryStones' }));
  }
  const bigShapes = Array.from({ length: S.bigShapes }, () => []);
  plants.big.forEach(([x, z, size], k) => {
    const s = size * 1.7;
    const yaw = random() * TAU;
    const y = sunk(x, z, s * 0.8);
    fixedBox(x, y + s * 0.3, z, s * 0.4, s * 0.25, s * 0.4, yaw);
    bigShapes[k % S.bigShapes].push(matrixAt(x, y, z, yaw, s * 1.15, s * 0.8, s));
  });
  for (const mine of bigShapes) {
    if (mine.length) site.add(tiledInstances(rockGeometry(random, S.bigDetail), material, mine, { tileSize: MODEL_TILE, castShadow: true, name: 'quarryBoulders' }));
  }
}

/**
 * Everything standing in and round the pit that isn't a plant or a stone: the fence, the container, the excavator, the plant, the drums and the dead
 * trees. Returns where the relics stand, for what grows round them (buildPitGrowth, buildFieldCover): `{ container, plant, excavator, drums,
 * pallet, deadTrees }`.
 */
function buildSite(c, quarry, site) {
  const { heights, random, fixedBox } = c;
  const wear = streamFor('pitRelicWear'); // the years of standing (#1003), drawn apart from the pit's own stream so nothing it deals moves
  const relics = { container: null, plant: null, excavator: null, drums: [], pallet: null, deadTrees: [] };
  const things = new THREE.Group();
  const lit = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 98, 74]), roughness: 0.95 });
  const wire = lit({ color: 0x7d8286, metalness: 0.5, roughness: 0.5 });
  const rust = lit({ map: rustTexture(random), roughness: 0.9 });
  const rustDark = lit({ map: rustTexture(random, '#5b3a2a'), roughness: 0.9 });
  const dark = lit({ color: 0x252422, roughness: 0.9 });
  const groundY = (x, z) => heights.heightAt(x, z);
  const floorAt = (a, back) => quarry.frameAt(a, quarry.floorEdge(a) - back);

  buildFence(things, quarry, { mats: wireFenceMaterials(random), groundY, random, fixedBox, wood });

  // The steel container: the site's store, in the field a little off the gate, on sleepers, one door leaf ajar and the other padlocked.
  const way = quarry.way;
  const [wx, wz] = way.inward;
  const offGate = (along, inward) => ({ x: way.x - wz * -along + wx * inward, z: way.z + wx * -along + wz * inward }); // `along` m to the gate's left, `inward` m into the field
  const hut = findSpot(400, (p) => quarry.plantOk(p.x, p.z, 8) && Math.hypot(p.x - way.x, p.z - way.z) > 14, () => offGate(10 + random() * 24, 12 + random() * 14)) ?? offGate(18, 18);
  const hutYaw = (random() - 0.5) * 0.7;
  {
    const { group, boxes, nearSide } = buildContainer(containerMaterials(random, wear), random);
    const y0 = settle(group, hut, hutYaw, 3, 1.2, groundY);
    things.add(group);
    placeBoxes(fixedBox, hut, y0, hutYaw, boxes);
    relics.container = { at: hut, turn: hutYaw, side: nearSide };
  }

  // Whether (x, z) is flat floor off the water and clear of the roads, for the things that stand by the plant.
  const onFloor = (x, z) => {
    const p = quarry.polar(x, z);
    return p.s < quarry.floorEdge(p.a) - 1.5 && quarry.waterAt(x, z) === 0 && quarry.roadNear(x, z).d > quarry.roadHalf + 3 && quarry.heapRise(x, z) < 0.05;
  };

  // The screening plant on its pad, where the pit was dealt it, its conveyor ending over the heap it was dealt with.
  const plant = plantSite(quarry, groundY);
  if (plant) {
    const materials = plantMaterials(random, wear);
    relics.plant = { site: plant, hardcore: materials.hardcore };
    const { group, boxes } = buildScreeningPlant(materials, {
      headX: plant.headX,
      headY: plant.headY,
      ground: (lx, lz) => {
        const p = plantPoint(plant, lx, lz);
        return groundY(p.x, p.z) - plant.padTop;
      },
      side: plant.dig ? plant.dig.side : -1,
    });
    group.position.set(plant.x, plant.padTop, plant.z);
    group.rotation.y = plant.turn;
    things.add(group);
    placeBoxes(fixedBox, plant, plant.padTop, plant.turn, boxes);
    // The site cabin on the pad's other side from the generator and the excavator, by the conveyor, its door and steps facing out; or, failing
    // that, behind the hopper facing the pad.
    const cabinSide = plant.dig ? -plant.dig.side : 1;
    const spots = [{ at: plantPoint(plant, 4.2, cabinSide * 2.6), turn: cabinSide > 0 ? plant.turn : plant.turn + Math.PI }];
    spots.push({ at: plantPoint(plant, PLANT.padX0 - 2.8, 0), turn: plant.turn + Math.PI / 2 });
    for (const { at, turn } of spots) {
      if (![[0, 0], [2.2, 2.2], [-2.2, 2.2], [2.2, -2.2], [-2.2, -2.2]].every(([ox, oz]) => onFloor(at.x + ox, at.z + oz))) continue;
      const { group: cabin, boxes: cabinBoxes } = buildCabin(cabinMaterials(random, wear));
      const y0 = settle(cabin, at, turn, 1.6, 1.0, groundY);
      things.add(cabin);
      placeBoxes(fixedBox, at, y0, turn, cabinBoxes);
      break;
    }
  }

  // The excavator: beside the plant's hopper with its bucket by the rim, if the plant has room for it, and if not on the floor where the first road
  // comes down (on its side away from the climb wall's foot), nose to the wall.
  {
    const road = quarry.pit.road;
    const endA = road.from + road.dir * road.sweep;
    const fallback = findSpot(300, (p) => !quarry.pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + 4) && quarry.waterAt(p.x, p.z) === 0 && quarry.roadNear(p.x, p.z).d > 7, () => floorAt(endA - road.dir * (0.3 + random() * 0.4), 10 + random() * 6)) ?? floorAt(endA - road.dir * 0.5, 12);
    const dig = plant?.dig ?? fallback;
    const turn = plant?.dig ? plant.dig.turn : Math.atan2(quarry.pit.x - dig.x, quarry.pit.z - dig.z) + Math.PI + (random() - 0.5) * 0.6 - Math.PI / 2; // else it looks out at the wall it has been digging
    const { group, boxes } = buildExcavator(excavatorMaterials(random, wear));
    const y0 = settle(group, dig, turn, 1.9, 1.3, groundY) - 0.03;
    group.position.y = y0;
    things.add(group);
    placeBoxes(fixedBox, dig, y0, turn, boxes);
    relics.excavator = { at: { x: dig.x, z: dig.z }, turn };
  }

  // Drums and tyres dumped by the pond with a pallet, none overlapping, and a drum and a tyre that have rolled off down the slope.
  {
    const pond = quarry.pond;
    const rim = (r) => ({ x: pond.x + Math.cos(r) * pond.rx * 1.25, z: pond.z + Math.sin(r) * pond.rz * 1.25 });
    const dirToCentre = Math.atan2(quarry.pit.z - pond.z, quarry.pit.x - pond.x);
    const dry = (x, z) => quarry.waterAt(x, z) === 0 && quarry.inPit(x, z) && !inPlantsWay(quarry.pit, x, z, 0.5);
    const centre = findSpot(60, (p) => dry(p.x, p.z), () => rim(dirToCentre + (random() - 0.5) * 1.4));
    if (centre) {
      const around = (near, far) => () => {
        const a = random() * TAU;
        const d = near + random() * (far - near);
        return { x: centre.x + Math.cos(a) * d, z: centre.z + Math.sin(a) * d };
      };
      const placed = [];
      const deal = (count, radius, near, far) => {
        const got = scatterClear(count, { pick: around(near, far), radius: () => radius, ok: dry, existing: placed });
        placed.push(...got);
        return got;
      };
      const mat = debrisMaterials(random, wear);
      const drums = mat.drums.map(() => []);
      const tyres = [];
      const at = (x, y, z, rx, ry, rz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
      const group = new THREE.Group();
      for (const pal of deal(1, 0.75, 1.5, 3)) {
        // The pallet (#1004): its deck boards across its bearers and resting on them, as one is built; which board is split, gone or sprung from
        // a stream of its own, so the pit's draws are as they were.
        const g = new Parts();
        addPallet(g, wood, streamFor('pitPallet'), dark);
        const m = g.build();
        m.name = 'pallet';
        m.position.set(pal.x, groundY(pal.x, pal.z) - 0.01, pal.z);
        m.rotation.y = random() * TAU;
        group.add(m);
        relics.pallet = { x: pal.x, z: pal.z, r: 0.75 };
      }
      for (const st of deal(1, 0.4, 1, 3)) {
        const y = groundY(st.x, st.z);
        const n = 3 + Math.floor(random() * 2);
        for (let i = 0; i < n; i++) tyres.push(at(st.x + (random() - 0.5) * 0.05, y + TYRE.width / 2 + i * TYRE.width, st.z + (random() - 0.5) * 0.05, 0, random() * TAU, 0));
        fixedBox(st.x, y + (n * TYRE.width) / 2, st.z, 0.33, (n * TYRE.width) / 2, 0.33);
      }
      for (const d of deal(5, DRUM.radius + 0.04, 0.8, 4)) {
        const y = groundY(d.x, d.z);
        drums[d.i % drums.length].push(at(d.x, y + DRUM.height / 2, d.z, 0, random() * TAU, 0));
        fixedBox(d.x, y + DRUM.height / 2, d.z, 0.28, DRUM.height / 2, 0.28);
        relics.drums.push({ x: d.x, z: d.z, r: DRUM.radius });
      }
      for (const d of deal(2, 0.5, 1.5, 4.5)) {
        const y = groundY(d.x, d.z);
        const yaw = random() * TAU;
        drums[(d.i + 2) % drums.length].push(at(d.x, y + DRUM.radius, d.z, 0, yaw, Math.PI / 2));
        fixedBox(d.x, y + DRUM.radius, d.z, DRUM.height / 2, DRUM.radius, DRUM.radius, yaw);
        relics.drums.push({ x: d.x, z: d.z, r: 0.45 }); // on its side: the weeds stand clear of its length
      }
      for (const t of deal(3, TYRE.radius + 0.04, 1, 4)) tyres.push(at(t.x, groundY(t.x, t.z) + TYRE.width / 2, t.z, (random() - 0.5) * 0.08, random() * TAU, 0));
      // Rolled off: a drum on its side and a tyre on its edge, well clear of the rest.
      for (const d of deal(1, 0.5, 6, 9)) {
        const yaw = random() * TAU;
        drums[3].push(at(d.x, groundY(d.x, d.z) + DRUM.radius, d.z, 0, yaw, Math.PI / 2));
        fixedBox(d.x, groundY(d.x, d.z) + DRUM.radius, d.z, DRUM.height / 2, DRUM.radius, DRUM.radius, yaw);
      }
      for (const t of deal(1, TYRE.radius + 0.04, 5, 8)) {
        const yaw = random() * TAU;
        tyres.push(at(t.x, groundY(t.x, t.z) + TYRE.radius - 0.01, t.z, Math.PI / 2, yaw, 0));
        fixedBox(t.x, groundY(t.x, t.z) + TYRE.radius, t.z, TYRE.radius, TYRE.radius, TYRE.width / 2, yaw + Math.PI / 2);
      }
      const drumGeo = drumGeometry();
      drums.forEach((list, k) => {
        if (list.length) group.add(tiledInstances(drumGeo, mat.drums[k], list, { castShadow: true, name: 'quarryDrums' }));
      });
      if (tyres.length) group.add(tiledInstances(tyreGeometry(), mat.tyre, tyres, { castShadow: true, name: 'quarryTyres' }));
      group.traverse((o) => {
        if (o.isMesh) o.receiveShadow = true;
      });
      things.add(group);
    }
  }

  // Dead trees leaning at the rim (#1004: rebuilt from the tree kit, landmarkProps.js `deadTreeGeometry`): a bleached trunk forking into bare limbs,
  // some snapped, a flared foot with roots, a fallen limb by it. Where each stands, how it leans, how tall and its turn are drawn as they were.
  {
    const shape = streamFor('pitDeadTrees');
    const bark = new THREE.MeshStandardMaterial({ map: barkTexture(shape, 'elm'), color: 0xcfc8bc, roughness: 1 });
    const spots = [];
    for (let tries = 0; spots.length < 3 && tries < 200; tries++) {
      const a = random() * TAU;
      const p = quarry.frameAt(a, quarry.rimAt(a) + 4 + random() * 8);
      if (quarry.plantOk(p.x, p.z, 3) && !spots.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 14)) spots.push(p);
    }
    const trees = new Parts();
    for (const p of spots) {
      const lean = (random() - 0.5) * 0.35;
      const h = 4 + random() * 2.5;
      const y = groundY(p.x, p.z);
      trees.add(bark, deadTreeGeometry(shape, { height: h, radius: 0.24, lean }), p.x, y - 0.05, p.z, 0, random() * TAU, 0);
      fixedBox(p.x, y + 1.5, p.z, 0.25, 1.5, 0.25);
      relics.deadTrees.push({ x: p.x, z: p.z });
    }
    if (spots.length) {
      const g = trees.build();
      g.name = 'deadTrees';
      things.add(g);
    }
  }

  enableShadows(things);
  site.add(things);
  return relics;
}

/**
 * What has grown over the pit since it was left (#1003), into the set piece: from the pit's own deal (pitGrowth.js `pitGrowth`, listed in
 * farmPlacement.js) the grass, birch seedlings and buddleia on the heaps, the reeds, rushes and sedge round the pond and the weeds and broken lumps
 * at the plant; from where buildSite stood each relic, the grass and weeds through the excavator's tracks and the drums, and the container's
 * hardstanding with the birch through its sleepers. The plants are the river's (riverPlants.js) and the verge's, drawn in tiles with the draw distance.
 */
function buildPitGrowth(c, quarry, site, relics) {
  const { heights, drawDistance } = c;
  const ground = (x, z) => heights.heightAt(x, z);
  const grow = streamFor('pitRelicGrowth');
  const g = pitGrowth(quarry);
  const group = new THREE.Group();
  group.name = 'pitGrowth';
  const material = plantMaterial();
  const tint = (h, s, l) => new THREE.Color().setHSL(h, s, l);
  const verge = vergeMakers(grow);
  const kinds = {
    grass: { geo: tussockModel(grow, { height: 0.42, blades: 26 }), mat: material, colour: () => tint(0.17 + grow() * 0.05, 0.15 + grow() * 0.2, 0.7 + grow() * 0.2), list: [] },
    reeds: { geo: reedModel(grow, { height: 1.55, blades: 14, seeds: 0.5, dead: 2 }), mat: material, colour: () => tint(0.2 + grow() * 0.05, 0.1 + grow() * 0.15, 0.78 + grow() * 0.17), list: [] },
    rushes: { geo: rushModel(grow), mat: material, colour: () => tint(0.22, 0.1 + grow() * 0.15, 0.75 + grow() * 0.2), list: [] },
    sedge: { geo: sedgeModel(grow), mat: material, colour: () => tint(0.17 + grow() * 0.04, 0.15 + grow() * 0.2, 0.78 + grow() * 0.17), list: [] },
    birch: { geo: birchModel(grow, { height: 1, branches: 4 }), mat: material, colour: () => tint(0.2, 0.05 + grow() * 0.1, 0.85 + grow() * 0.15), list: [] },
    nettle: { geo: verge.nettle[0], mat: verge.nettle[1], list: [] },
    dock: { geo: verge.dock[0], mat: verge.dock[1], list: [] },
    parsley: { geo: verge.parsley[0], mat: verge.parsley[1], list: [] },
  };
  const put = (kind, x, y, z, yaw, s, sy = s) => kinds[kind].list.push(matrixAt(x, y, z, yaw, s, sy, s));
  const plant = relics.plant?.site;
  const padY = (p) => (p.onPad && plant ? plant.padTop - 0.01 : ground(p.x, p.z) - 0.02);
  for (const t of g.tufts) put('grass', t.x, ground(t.x, t.z) - 0.03, t.z, t.yaw, t.s);
  for (const b of g.seedlings) put('birch', b.x, ground(b.x, b.z) - 0.03, b.z, b.yaw, b.h);
  // The reeds keep a gap where the drums were dumped; on a farm whose pile lies off that gap, none stands inside a drum.
  const clearOfDrums = (p) => relics.drums.every((d) => Math.hypot(p.x - d.x, p.z - d.z) > d.r + 0.3);
  for (const [k, list] of [['reeds', g.reeds], ['rushes', g.rushes], ['sedge', g.sedge]]) for (const p of list.filter(clearOfDrums)) put(k, p.x, ground(p.x, p.z) - 0.04, p.z, p.yaw, p.s, p.s * (0.85 + ((p.x * 7.3) % 0.3)));
  if (plant) for (const w of [...g.footings, ...g.padWeeds]) put(w.kind ?? 'grass', w.x, padY(w), w.z, w.yaw, w.s);
  if (relics.excavator) {
    const { at, turn } = relics.excavator;
    for (const w of excavatorGrowth(grow)) {
      const p = framePoint(at, turn, w.x, w.z);
      put(w.kind, p.x, ground(p.x, p.z) - 0.02, p.z, w.yaw, w.s);
    }
  }
  for (const w of drumWeeds(relics.drums, grow)) put(w.kind, w.x, ground(w.x, w.z) - 0.02, w.z, w.yaw, w.s);
  // The container's hardstanding: a drape of old concrete over the ground, broken back at its edges, a few lumps off it, weeds in its cracks, and the
  // birch come up between two of its sleepers, leaning out from the wall.
  const parts = new Parts();
  if (relics.container) {
    const { at, turn, side } = relics.container;
    const d = containerDressing(grow, side);
    const frame = {
      at: (u, v) => framePoint(at, turn, u, v),
      toFrame: (x, z) => {
        const dx = x - at.x;
        const dz = z - at.z;
        return { u: Math.cos(turn) * dx - Math.sin(turn) * dz, v: Math.sin(turn) * dx + Math.cos(turn) * dz };
      },
    };
    const slabMaterial = new THREE.MeshStandardMaterial({ map: hardstandingTexture(grow, grow), roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const slab = new THREE.Mesh(drapeGeometry(d.rows, { frame, groundY: ground, lift: 0.04, cols: 10, uvOf: (u, v) => [u / 4, v / 4], skirt: 0.1, endSkirt: true }), slabMaterial);
    slab.name = 'hardstanding';
    slab.receiveShadow = true;
    group.add(slab);
    for (const l of d.lumps) {
      const p = framePoint(at, turn, l.x, l.z);
      parts.add(slabMaterial, tarmacChunkGeometry(l.size, l.shape).scale(1, 2.5, 1), p.x, ground(p.x, p.z) - 0.02, p.z, 0.08, l.yaw, -0.06);
    }
    for (const w of d.weeds) {
      const p = framePoint(at, turn, w.x, w.z);
      put(w.kind, p.x, ground(p.x, p.z) + 0.02, p.z, w.yaw, w.s);
    }
    const s = d.sapling;
    const p = framePoint(at, turn, s.x, s.z);
    const sapling = new THREE.Mesh(birchModel(grow, { height: s.h, branches: 6, facing: side > 0 ? Math.PI / 2 : -Math.PI / 2 }), material);
    sapling.position.set(p.x, ground(p.x, p.z) - 0.04, p.z);
    sapling.rotation.y = turn;
    sapling.name = 'containerBirch';
    sapling.castShadow = true;
    group.add(sapling);
  }
  // The plant's pad: lumps of its hardcore broken off round its edge.
  if (plant) for (const l of g.padLumps) parts.add(relics.plant.hardcore, tarmacChunkGeometry(l.size, l.shape).scale(1, 2.2, 1), l.x, ground(l.x, l.z) - 0.015, l.z, l.tip, l.yaw, l.tip * 0.5);
  // Buddleia low on the heaps.
  {
    const bp = new Parts();
    const bm = buddleiaMaterials();
    for (const b of g.buddleia) addBuddleia(bp, bm, b.x, ground(b.x, b.z) - 0.05, b.z, b.h, grow);
    if (g.buddleia.length) {
      const bush = bp.build({ castShadow: true });
      bush.name = 'pitBuddleia';
      group.add(bush);
    }
  }
  const built = parts.build({ castShadow: true });
  built.name = 'pitGrowthParts';
  group.add(built);
  for (const [name, k] of Object.entries(kinds)) {
    if (!k.list.length) continue;
    const colors = k.colour ? k.list.map(() => k.colour()) : undefined;
    group.add(drawDistance.add(tiledInstances(k.geo, k.mat, k.list, { colors, name: `pit-${name}`, tileSize: MODEL_TILE }), 'roughDistance'));
  }
  site.add(group);
  return group;
}

/**
 * The rough's ground cover (#1004), into the set piece: rough grass tussocks and thistles over the field (pitScrub.js `pitCover`, listed in
 * farmPlacement.js), and, round the relics buildSite stood in the field, brambles, nettles, grass and thistles thick about the container's
 * hardstanding, the dead trees' feet and the pallet (`relicScrub`). None of it solid; in tiles with the rough ground's draw distance.
 */
function buildFieldCover(c, quarry, site, relics, kit) {
  const { heights, drawDistance } = c;
  const ground = (x, z) => heights.heightAt(x, z);
  const random = streamFor('pitCoverDraw');
  const cover = pitCover(quarry);
  const verge = vergeMakers(random);
  const leaves = plantMaterial();
  const kinds = {
    tussock: { geo: tussockModel(random, { height: 0.7, blades: 11 }), mat: leaves, list: [], tint: () => new THREE.Color().setHSL(0.13 + random() * 0.06, 0.25 + random() * 0.2, 0.6 + random() * 0.2) },
    thistle: { geo: thistleModel(random, { height: 0.9 }), mat: leaves, list: [], tint: () => new THREE.Color().setHSL(0.22, 0.1 + random() * 0.1, 0.8 + random() * 0.15) },
    bramble: { geo: kit.bramble.geo, mat: kit.bramble.mat, list: [] },
    nettle: { geo: verge.nettle[0], mat: verge.nettle[1], list: [] },
  };
  const put = (kind, p) => kinds[kind].list.push(matrixAt(p.x, ground(p.x, p.z) - 0.03, p.z, p.yaw, p.s, p.s * (0.85 + ((Math.abs(p.x) * 7.3) % 0.3)), p.s));
  for (const p of cover.tussocks) put('tussock', p);
  for (const p of cover.thistles) put('thistle', p);
  // In the field what the scrub may take; on the floor by the pallet, anywhere dry and off the roads.
  const clearOfDrums = (x, z) => relics.drums.every((d) => Math.hypot(x - d.x, z - d.z) > d.r + 0.15);
  const ok = (x, z) => (quarry.inPit(x, z) ? quarry.waterAt(x, z) === 0 && quarry.roadNear(x, z).d > quarry.roadHalf + 0.6 && clearOfDrums(x, z) : scrubOk(quarry, x, z, 0.5));
  const near = relicScrub({ container: relics.container, trees: relics.deadTrees, pallet: relics.pallet }, ok);
  for (const p of near) put(p.kind, p);
  const group = new THREE.Group();
  group.name = 'pitCover';
  for (const [name, k] of Object.entries(kinds)) {
    if (!k.list.length) continue;
    const colors = k.tint ? k.list.map(() => k.tint()) : undefined;
    group.add(drawDistance.add(tiledInstances(k.geo, k.mat, k.list, { colors, name: `pit-${name}`, tileSize: MODEL_TILE }), 'roughDistance'));
  }
  site.add(group);
  return group;
}

/**
 * The lip and the walls' foot (#1004), into the set piece: roots hanging out of the topsoil just under the lip and trailing down the face, each laid to
 * the face's slope there, and the scree skirt's loose stones at the foot (pitScrub.js `pitLip`). Nothing solid, so the climb and the roads ride as they did.
 */
function buildLip(c, quarry, plants, site) {
  const { heights, drawDistance } = c;
  const ground = (x, z) => heights.heightAt(x, z);
  const random = streamFor('pitLipDraw');
  const { roots, scree } = pitLip(quarry);
  const group = new THREE.Group();
  group.name = 'pitLip';
  const shapes = [rootTangleModel(random, { roots: 8, length: 1.1, steps: 2 })];
  const lists = [[]];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const r of roots) {
    const dx = Math.sin(r.yaw);
    const dz = Math.cos(r.yaw);
    const y = ground(r.x, r.z);
    const slope = Math.atan2(y - ground(r.x + dx * 0.8, r.z + dz * 0.8), 0.8); // how steeply the face falls away into the pit
    q.setFromEuler(e.set(slope, r.yaw, 0, 'YXZ'));
    lists[0].push(new THREE.Matrix4().compose(new THREE.Vector3(r.x, y + 0.012, r.z), q, new THREE.Vector3(r.s * (0.8 + random() * 0.4), r.s, r.s)));
  }
  const leaves = plantMaterial();
  lists.forEach((m, i) => m.length && group.add(drawDistance.add(tiledInstances(shapes[i], leaves, m, { tileSize: MODEL_TILE, name: 'pit-roots' }), 'roughDistance')));
  // The scree's loose stones, and with them the flints turned up in the rough (quarryPlants' `stones`): small, so a light shape and the rough's draw distance.
  const stones = scree.map((p) => matrixAt(p.x, ground(p.x, p.z) - p.s * 0.25, p.z, p.yaw, p.s * (1.1 + p.shape * 0.5), p.s * (0.6 + p.shape * 0.3), p.s));
  for (const [x, z, size] of plants.stones) stones.push(matrixAt(x, ground(x, z) - size * 0.3, z, random() * TAU, size * (1.1 + random() * 0.4), size * (0.55 + random() * 0.3), size));
  if (stones.length) group.add(drawDistance.add(tiledInstances(rockGeometry(random, 0), pitStoneMaterial(), stones, { tileSize: MODEL_TILE, name: 'pit-scree' }), 'roughDistance'));
  site.add(group);
  return group;
}

/**
 * The tree line between the arable and the pit (#1004, pitScrub.js `pitTreeLine`): hawthorns inside the fence along the sides that face arable, with
 * ash and oak standards among them. Handed to the farm's scatter (scatter.js) with the other builders' trees, so each tile is one batch a model and
 * the far ones are the far versions (treeFar.js `farTree`: the bark simplified, a quarter of the leaf cards grown to fill): the line is what you see of the pit from across the arable. The standards'
 * trunks are solid.
 */
function buildPitTreeLine(c, quarry, kit) {
  const { layout, fields, heights, physics, RAPIER, anchors, scatter, models } = c;
  if (!scatter) return [];
  const random = streamFor('pitTreeLineDraw');
  const line = pitTreeLine(quarry, layout.boundaries, fields.kinds);
  const haw = [];
  const ash = [];
  const oaks = [[], []];
  for (const t of line) {
    const y = heights.heightAt(t.x, t.z);
    if (t.kind === 'hawthorn') haw.push(matrixAt(t.x, y - 0.15, t.z, t.yaw, t.s));
    else if (t.kind === 'ash') ash.push(matrixAt(t.x, y - 0.1, t.z, t.yaw, t.s));
    else oaks[0].push(matrixAt(t.x, y - 0.15, t.z, t.yaw, t.s * 1.1)); // one oak model, so the line's tiles hold one more batch, not two, from across the farm
    if (t.kind === 'hawthorn') continue;
    const r = (t.kind === 'ash' ? 0.38 : 0.32 * 1.1) * t.s;
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5, r).setTranslation(t.x, y + 2.5, t.z));
    anchors.push({ x: t.x, y, z: t.z, r });
  }
  scatter.add(kit.hawthorn, haw, { far: farSprayTree });
  scatter.add(kit.ash, ash, { far: farTree });
  scatter.oaks(models, oaks);
  return line;
}

/**
 * Posts every few metres round the lip, leaning, some gone, with three strands of barbed wire between those that are left (some sagging to the ground), and
 * the signs. Made from the same posts and wire as the field's boundary (wireFence.js), and solid along every span that has its wire: a low collider, open
 * where the road comes in and the climb goes over the lip, as the fence is.
 */
function buildFence(site, quarry, { mats, wood, groundY, random, fixedBox }) {
  const parts = new Parts();
  const posts = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + (random() - 0.5) * 0.04;
    const p = quarry.frameAt(a, quarry.rimAt(a) + 2.4);
    if (quarry.fenceOpen(a, p.x, p.z)) continue; // open where the road comes in and where the climb goes over the lip
    posts.push({ ...p, a, gone: random() < 0.16, lean: (random() - 0.5) * 0.45, lean2: (random() - 0.5) * 0.3, h: 1.15 + random() * 0.3 });
  }
  for (const po of posts) {
    if (po.gone) continue;
    addPost(parts, mats, po.x, groundY(po.x, po.z), po.z, { height: po.h, lean: po.lean, lean2: po.lean2, yaw: po.a });
  }
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i];
    const b = posts[(i + 1) % posts.length];
    if (a.gone || b.gone) continue;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > 9) continue;
    const ya = groundY(a.x, a.z);
    const yb = groundY(b.x, b.z);
    addSpan(parts, mats, [a.x, ya, a.z], [b.x, yb, b.z], random, random() < 0.12 ? 0.4 : 0);
    fixedBox((a.x + b.x) / 2, (ya + yb) / 2 + 0.45, (a.z + b.z) / 2, d / 2, 0.45, 0.07, Math.atan2(-(b.z - a.z), b.x - a.x));
  }
  const fence = parts.build({ castShadow: false });
  fence.name = 'quarryFence';
  site.add(fence);

  // The signs: where the road comes in and over the pond, each on a post of its own, leaning a little. The third, a private sign in American wording on the
  // far side, went with the lane entrance's signs (#1002); its two draws are still taken, so everything dealt after it in the pit stands where it did.
  const road = quarry.pit.road;
  const signs = [
    { a: road.from + road.dir * 0.35, back: 3.4, tex: signTexture('DANGER', ['UNSTABLE FACES', 'KEEP OUT']) },
    { a: Math.atan2(quarry.pond.z - quarry.pit.z, quarry.pond.x - quarry.pit.x) - quarry.pit.yaw, back: 3.4, tex: signTexture('DANGER', ['DEEP WATER', 'NO SWIMMING']) },
  ];
  for (const sg of signs) {
    const p = quarry.frameAt(sg.a, quarry.rimAt(sg.a) + sg.back);
    const y = groundY(p.x, p.z);
    const g = buildSign(sg.tex, wood);
    g.position.set(p.x, y - 0.1, p.z);
    g.rotation.set(0, Math.atan2(quarry.pit.x - p.x, quarry.pit.z - p.z) + Math.PI + (random() - 0.5) * 0.4, (random() - 0.5) * 0.12); // facing out from the pit
    site.add(g);
  }
  random();
  random();
}

/**
 * The Old Pit's lane entrance on the new farm (#1002), the way the lorries came in, now shut for good: the lane gate dressed (two galvanised leaves gone
 * dull on precast concrete posts, chained and padlocked, with #685's collider as it was), the splayed bellmouth of broken tarmac into hardcore with its
 * ruts and puddles and the chippings washed onto the lane, two concrete blocks, a rusty height barrier with reflective bands, the faded operator's board
 * and a newer plate on the gate, weeds and buddleia along the fence, a remnant hedge either side with litter caught in it. Where each stands is
 * pitEntrance.js `entrancePlan`. One set piece, `pitEntrance` (farDetail.js), and the hedge on its own. Null on a farm with no lane gate.
 * Returns the group; `userData.setWet(wet)` fills the ruts' puddles with the ground's wetness, as the yard's.
 */
export function buildPitEntrance(c) {
  const { scene, layout, heights, fixedBox, random, models } = c;
  const gate = laneGateOf(layout.quarry?.gates);
  if (!gate) return null;
  const net = roadNetwork(layout);
  const reach = laneReach(gate, (x, z) => net.onRoad('lane', x, z));
  const plan = entrancePlan(gate, reach);
  const f = plan.frame;
  const ground = (x, z) => heights.heightAt(x, z);
  const mats = entranceMaterials(random);
  const parts = new Parts();
  const group = new THREE.Group();
  group.name = 'pitEntrance';
  /** A matrix that sets parts built in a local frame (x along the gate, z out to the lane) at (x, y, z), turned `turn` more. */
  const frameAt = (x, y, z, turn = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw + turn), new THREE.Vector3(1, 1, 1));

  // The gate: its leaves hung on the posts, the chain and padlock round the closing stiles, the newer plate wired to one leaf. Built in the gate's frame.
  const gy = ground(gate.x, gate.z);
  const gp = new Parts();
  const postFace = plan.postV - ENTRANCE.postW / 2;
  for (const lf of plan.leaves) {
    for (const geo of leafParts(lf.length)) gp.add(mats.galv, geo, lf.hinge, 0, 0, 0, lf.side > 0 ? Math.PI : 0, 0);
    addHinges(gp, mats, lf.side * postFace, lf.side * (plan.gateW / 2 - 0.03), [0.26, 1.1]);
  }
  addChainAndLock(gp, mats, 0.92, 2 * (plan.gateW / 2 - plan.leaves[0].length + 0.03));
  {
    const P = plan.plate;
    const py = P.y + P.h / 2;
    const face = new THREE.MeshStandardMaterial({ map: privatePlateTexture(random, SIGN_WORDS.plate), roughness: 0.6 });
    gp.add(mats.galv, new THREE.BoxGeometry(P.w, P.h, 0.005), P.v, py, 0.036);
    gp.add(face, new THREE.PlaneGeometry(P.w - 0.01, P.h - 0.01), P.v, py, 0.0425); // 4 mm proud of the board, so the two never fight
    for (const [dx, ry] of [[-P.w / 2 + 0.04, 0.57], [P.w / 2 - 0.04, 0.57], [-P.w / 2 + 0.04, 0.95], [P.w / 2 - 0.04, 0.95]]) {
      gp.add(mats.dark, new THREE.TorusGeometry(0.03, 0.0025, 4, 10), P.v + dx, ry, 0.012, 0, Math.PI / 2, 0); // a wire tie round the rail
    }
  }
  parts.merge(gp, frameAt(gate.x, gy, gate.z));
  for (const p of plan.posts) addGatePost(parts, mats, p.x, ground(p.x, p.z), p.z, f.yaw, { w: ENTRANCE.postW, h: ENTRANCE.postH, sink: ENTRANCE.postSink });
  // #685's collider, as it was: the gate shut and solid for good.
  fixedBox(gate.x, gy + 0.8, gate.z, 0.2, 0.9, plan.gateW / 2 + 0.3, f.yaw - Math.PI / 2);

  // The blocks, each on the lowest ground under it so neither end floats, and solid.
  for (const b of plan.blocks) {
    const turn = f.yaw + b.turn;
    const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [b.x + Math.cos(turn) * sx * 0.8 + Math.sin(turn) * sz * 0.4, b.z - Math.sin(turn) * sx * 0.8 + Math.cos(turn) * sz * 0.4]));
    const y = Math.min(...corners.map(([x, z]) => ground(x, z)));
    addConcreteBlock(parts, mats, b.x, y, b.z, turn, 0.02);
    fixedBox(b.x, y + 0.36, b.z, 0.8, 0.4, 0.4, turn);
  }

  // The height barrier across the way, its posts solid.
  {
    const B = plan.barrier;
    const mid = f.at(B.u, 0);
    const base = ground(mid.x, mid.z);
    const [l, r] = B.posts;
    const bp = new Parts();
    const { beamY } = addHeightBarrier(bp, mats, B.span, ground(l.x, l.z) - base, ground(r.x, r.z) - base, { clear: ENTRANCE.barrier.clear, post: ENTRANCE.barrier.post, beam: ENTRANCE.barrier.beam });
    parts.merge(bp, frameAt(mid.x, base, mid.z));
    for (const p of B.posts) fixedBox(p.x, ground(p.x, p.z) + 1.2, p.z, ENTRANCE.barrier.post / 2 + 0.01, 1.2, ENTRANCE.barrier.post / 2 + 0.01, f.yaw);
    // The beam is solid too, at its height, so nothing taller than the 2.1 m it allows drives under it.
    const front = f.at(B.u + ENTRANCE.barrier.post / 2 + 0.065, 0);
    fixedBox(front.x, base + beamY, front.z, B.span + 0.1, ENTRANCE.barrier.beam / 2, 0.06, f.yaw);
  }

  // The operator's board, faded, on its two posts facing the lane.
  {
    const S = plan.sign;
    const base = ground(S.x, S.z);
    const [a, b] = S.posts;
    const face = new THREE.MeshStandardMaterial({ map: worksSignTexture(random, SIGN_WORDS.operator, SIGN_WORDS.board), roughness: 0.75 });
    const sp = new Parts();
    addSignBoard(sp, mats, face, ENTRANCE.sign, ground(a.x, a.z) - base, ground(b.x, b.z) - base);
    parts.merge(sp, frameAt(S.x, base, S.z, S.turn));
    for (const p of S.posts) fixedBox(p.x, ground(p.x, p.z) + 1, p.z, 0.04, 1, 0.04, f.yaw);
  }

  // The bellmouth: a drape over the ground, its ruts lower, the painting from the plan; loose lumps of tarmac at its break; and the puddles in the ruts.
  // It is laid over the ground as drawn (a 1 m grid of the ground's heights, groundTiles.js), not between its samples, or the drawn ground's facets
  // would come up through it where the lane's shoulder curves: the higher of the two at each point.
  const drawn = (x, z) => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fz = z - z0;
    const a = ground(x0, z0) * (1 - fx) + ground(x0 + 1, z0) * fx;
    const b = ground(x0, z0 + 1) * (1 - fx) + ground(x0 + 1, z0 + 1) * fx;
    return Math.max(ground(x, z), a * (1 - fz) + b * fz);
  };
  const dip = (u, v) => rutDip(v) * (1 - 0.5 * tarmacAt(u, v, reach));
  const surface = (u, v) => {
    const p = f.at(u, v);
    return drawn(p.x, p.z) + 0.05 - dip(u, v);
  };
  {
    const geo = drapeGeometry(plan.bellmouth.rows, { frame: f, groundY: drawn, lift: 0.05, dip, cols: 28, uvOf: (u, v) => bellmouthUv(u, v, reach) });
    const material = new THREE.MeshStandardMaterial({ map: bellmouthTexture(random, plan), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); // drawn over the ground it lies on, a little way off
    const drape = new THREE.Mesh(geo, material);
    drape.name = 'bellmouth';
    drape.receiveShadow = true;
    group.add(drape);
    const tarmac = new THREE.MeshStandardMaterial({ map: tarmacTexture(random), roughness: 0.85 });
    for (const k of plan.chunks) parts.add(tarmac, tarmacChunkGeometry(k.size, k.shape), k.x, surface(k.u, k.v) - 0.012, k.z, k.tilt, k.yaw, k.tilt * 0.5);
  }
  const water = new THREE.MeshStandardMaterial({ color: 0x353a3f, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0, depthWrite: false });
  const puddles = (() => {
    const pos = [];
    for (const p of plan.puddles) {
      const n = 18;
      const ring = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const u = p.u + (Math.sin(a) * p.len) / 2;
        const v = p.v + (Math.cos(a) * p.w) / 2;
        const q = f.at(u, v);
        return [q.x, surface(u, v) + 0.012, q.z];
      });
      const mid = f.at(p.u, p.v);
      const c0 = [mid.x, surface(p.u, p.v) + 0.012, mid.z];
      for (let i = 0; i < n; i++) pos.push(...c0, ...ring[(i + 1) % n], ...ring[i]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, water);
    mesh.name = 'pitEntrancePuddles';
    mesh.visible = false;
    mesh.receiveShadow = true;
    mesh.userData.keepFar = true;
    return mesh;
  })();
  group.add(puddles);

  // Chippings washed out of the hardcore onto the lane's near half: on its tarmac (its lift and camber) or on the bellmouth. Nothing to ride into.
  {
    const lane = net.road('lane');
    const crown = lane?.camber ? { height: lane.camber, half: lane.halfWidth } : null;
    const matrices = plan.gravel.map((g) => {
      const y = g.onLane ? ground(g.x, g.z) + (lane?.lift ?? 0.076) + (crown ? crownAt(crown, lane.halfWidth - (g.u - reach)) : 0) : surface(g.u, g.v);
      return matrixAt(g.x, y + g.size * 0.2, g.z, g.yaw, g.size, g.size * 0.45, g.size * 0.8);
    });
    const chips = tiledInstances(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xa79f8c, roughness: 0.9 }), matrices, { name: 'pitEntranceChippings' });
    group.add(chips);
  }

  // Buddleia along the fence, and the weeds along it, round the posts, the blocks and the barrier, and at the hedge's foot.
  {
    const bp = new Parts();
    const bm = buddleiaMaterials();
    for (const b of plan.buddleia) addBuddleia(bp, bm, b.x, ground(b.x, b.z) - 0.05, b.z, b.h, random);
    const bush = bp.build({ castShadow: true });
    bush.name = 'buddleia';
    group.add(bush);
    const makers = vergeMakers(random);
    for (const kind of Object.keys(makers)) {
      const matrices = plan.weeds.filter((w) => w.kind === kind).map((w) => matrixAt(w.x, ground(w.x, w.z) - 0.02, w.z, w.yaw, w.scale));
      if (matrices.length) group.add(tiledInstances(makers[kind][0], makers[kind][1], matrices, { name: `pitEntrance-${kind}`, receiveShadow: false }));
    }
  }

  // Litter: in the hedge, at the fence's foot and on the verge.
  {
    const lp = new Parts();
    const lm = litterMaterials(random);
    for (const l of plan.litter) addLitter(lp, lm, l.kind, l.x, ground(l.x, l.z) + l.y, l.z, l.yaw, l.tip);
    const litter = lp.build({ castShadow: false });
    litter.name = 'litter';
    group.add(litter);
  }

  const built = parts.build({ castShadow: true });
  built.name = 'pitEntranceParts';
  group.add(built);
  group.userData.setWet = (wet) => {
    const o = standingWater(wet);
    water.opacity = o;
    puddles.visible = o > 0.01;
  };
  group.userData.plan = plan;
  scene.add(group);

  // The remnant hedge either side of the bellmouth, as the farm's hedges are drawn and as solid: leafy blocks near and plain strips far, swapped by
  // distance with the rest (`userData.hedgeSwap`, props.js `hedgeSwaps`), so it stays in the lane's view without costing its leaves from across the farm.
  if (models?.hedge) {
    const hedgeSize = modelBounds(models.hedge.scene).getSize(new THREE.Vector3());
    const blockReach = leafReach(models.hedge.scene, hedgeSize);
    const H = layout.hedgeHeight;
    const matrices = [];
    const farPieces = [];
    for (const lay of entranceHedges(plan, { T: layout.hedgeThickness, H, heightAt: ground, blockReach })) {
      const blocks = [];
      for (const b of lay.blocks) {
        matrices.push(matrixAt(b.x, b.y, b.z, b.spin, b.width / hedgeSize.x, (H / hedgeSize.y) * b.tall, b.width / hedgeSize.z));
        blocks.push({ s: b.s, x: b.x, z: b.z, top: b.y + H * b.tall * FAR_HEDGE_TOP, width: b.width * FAR_HEDGE_WIDTH });
      }
      blocks.forEach((b, i) => {
        const a = lay.pointAt(i ? (blocks[i - 1].s + b.s) / 2 : b.s - FAR_HEDGE_END);
        const e = lay.pointAt(i < blocks.length - 1 ? (blocks[i + 1].s + b.s) / 2 : b.s + FAR_HEDGE_END);
        const len = Math.hypot(e.x - a.x, e.z - a.z) || 1;
        farPieces.push({
          x: b.x, z: b.z, cx: (a.x + e.x) / 2, cz: (a.z + e.z) / 2, along: [(e.x - a.x) / len, (e.z - a.z) / len], length: len, width: b.width, top: b.top,
          gap: i === 0, kind: 'hedge', groundA: ground(a.x, a.z), groundB: ground(e.x, e.z),
        });
      });
      for (const k of lay.colliders) fixedBox(k.x, k.y, k.z, k.hx, k.hy, k.hz, k.turn);
    }
    if (matrices.length) {
      const hedge = instanceModel(models.hedge.scene, matrices, { castShadow: false });
      hedge.name = 'pitEntranceHedge';
      const far = buildFarHedges(farPieces, { tint: leafTint(models.hedge.scene), name: 'pitEntranceHedgeFar' });
      scene.add(hedge, far);
      group.userData.hedge = hedge;
      group.userData.hedgeSwap = new HedgeSwap(hedge, far);
    }
  }
  return group;
}
