// The things in and round the gravel pit (world/quarry.js): a tumbledown post-and-wire fence round the lip with its danger signs, the site's
// steel container, an old excavator left on the floor and a screening plant (a hopper and crusher on a pad, conveyors and a screen, delivering onto a heap), its cabin and generator, drums and
// tyres by the pond, hawthorn and gorse along the lip, boulders and flints fallen from the walls, dead trees, and the pond with its reeds.
// All procedural, with canvas textures; the big pieces have colliders. The ground itself (the walls, the heaps, the road) is the terrain's.
// And the lane entrance on the new farm (#1002): the shut lane gate dressed, its bellmouth, blocks, barrier, signs, weeds, buddleia, hedge and litter.
// And the relics as years of standing have left them (#1003): weathered from their own stream (`pitRelicWear`), grass, birch and buddleia over the
// heaps, reeds and rushes round the pond, weeds through the tracks, the drums and the plant's footings, and the container on its hardstanding.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instanceModel, modelBounds, enableShadows } from './assets.js';
import { matrixAt, buildPond, gorseGeometry } from './hillProps.js';
import { woodTexture } from './neighbourTextures.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { quarryPlants } from './quarry.js';
import { Parts } from './parts.js';
import { rustTexture, signTexture, bellmouthTexture, bellmouthUv, tarmacTexture, hardstandingTexture } from './quarryTextures.js';
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
import { buildSign, debrisMaterials, drumGeometry, scatterClear, tyreGeometry, DRUM, TYRE } from './quarryDebris.js';
import { wireFenceMaterials, wireFenceRun, addPost, addSpan } from './wireFence.js';
import { streamFor } from './propStreams.js';
import { pitGrowth, excavatorGrowth, drumWeeds, containerDressing, framePoint } from './pitGrowth.js';
import { plantMaterial, reedModel, rushModel, sedgeModel, tussockModel, birchModel } from './riverPlants.js';

const TAU = Math.PI * 2;

/** Builds the pit's props and their colliders. `c` is the props context (props.js). */
export function buildQuarry(c) {
  const quarry = c.fields.quarry;
  const plants = quarryPlants(quarry, c.random);
  // One set piece (farDetail.js SET_PIECE_NAMES): everything in the pit's field is left out beyond the far-detail distance, so a view from the
  // yard or the village pays nothing for it.
  const site = new THREE.Group();
  site.name = 'quarrySite';
  buildScrub(c, quarry, plants, site);
  buildBoulders(c, quarry, plants, site);
  const relics = buildSite(c, quarry, site);
  buildPitGrowth(c, quarry, site, relics);
  c.scene.add(site);
  buildPond(c, quarry, () => false, { reeds: false }); // its reeds are the river's, round its edge (buildPitGrowth)
  buildPitBoundary(c);
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

/** Hawthorn and gorse along the lip and over the field, and a few oaks standing in the rough. */
function buildScrub(c, quarry, plants, site) {
  const { models, heights, physics, RAPIER, random, anchors } = c;
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const hawthorn = [];
  const gorse = [];
  for (const [x, z, s] of plants.bushes) {
    if (random() < 0.5) hawthorn.push(matrixAt(x, heights.heightAt(x, z) - 0.2, z, random() * TAU, (1.5 + s * 1.2) / bushSize.y));
    else gorse.push(matrixAt(x, heights.heightAt(x, z) - 0.1, z, random() * TAU, s * (1 + random() * 0.5), s, s * (1 + random() * 0.5)));
  }
  if (hawthorn.length) site.add(instanceModel(models.bush.scene, hawthorn, { castShadow: false })); // (instanceModel complains of an empty list)
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  site.add(tiledInstances(gorseGeometry(random), material, gorse, { tileSize: MODEL_TILE, castShadow: true, name: 'quarryGorse' }));
  const mats = [[], []];
  for (const [x, z, s] of plants.trees) {
    const y = heights.heightAt(x, z);
    mats[random() < 0.5 ? 0 : 1].push(matrixAt(x, y - 0.15, z, random() * TAU, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, y + 2.5 * s, z));
    anchors.push({ x, y, z, r: 0.32 * s });
  }
  if (mats[0].length) site.add(instanceModel(models.treeA.scene, mats[0]));
  if (mats[1].length) site.add(instanceModel(models.treeB.scene, mats[1]));
}

/** A smooth value-noise-ish wobble of a direction, 0..1: a few sines of the unit vector, so two vertices at one place always agree. */
const lump = (x, y, z, k) => 0.5 + 0.25 * Math.sin(x * 3.1 * k + y * 1.7 + z * 2.3) + 0.15 * Math.sin(y * 5.3 * k - x * 2.9 + z * 4.1) + 0.1 * Math.sin(z * 8.7 * k + x * 6.3 - y * 3.7);

/**
 * A rock: a closed, welded icosphere (its vertices shared, so no cracks) pushed about by a smooth lump, a few flat faces cut into it where a
 * quarried stone has split, its underside flattened, smooth normals and a tint that drifts across it. About 1 m across, base near y = 0.
 */
export function rockGeometry(random) {
  let geo = new THREE.IcosahedronGeometry(0.5, 3);
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
  const tint = [[0.46, 0.43, 0.38], [0.38, 0.37, 0.36], [0.52, 0.41, 0.3], [0.54, 0.51, 0.44]][Math.floor(random() * 4)];
  const squash = 0.7 + random() * 0.3;
  const colors = new Float32Array(p.count * 3);
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
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Boulders and flints fallen to the foot of the walls and strewn down the chutes, and a few big ones on the floor you ride round. */
function buildBoulders(c, quarry, plants, site) {
  const { heights, random, fixedBox } = c;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  // A stone sits in the ground, not on it: its middle at the ground's height, lower again on a slope, so the scree comes up round it.
  const sunk = (x, z, h) => {
    const y = heights.heightAt(x, z);
    const lean = Math.max(Math.abs(heights.heightAt(x + h, z) - y), Math.abs(heights.heightAt(x, z + h) - y));
    return y - h * 0.12 - Math.min(lean, h * 0.5) * 0.6;
  };
  const SHAPES = 4;
  const stones = [];
  for (const [x, z, size] of plants.boulders) {
    const h = size * (0.6 + random() * 0.5);
    stones.push(matrixAt(x, sunk(x, z, h), z, random() * TAU, size * (1.1 + random() * 0.5), h, size * (1 + random() * 0.4)));
  }
  for (let i = 0; i < SHAPES; i++) {
    const mine = stones.filter((_, k) => k % SHAPES === i);
    if (mine.length) site.add(tiledInstances(rockGeometry(random), material, mine, { castShadow: true, name: 'quarryStones' }));
  }
  const bigShapes = Array.from({ length: 3 }, () => []);
  plants.big.forEach(([x, z, size], k) => {
    const s = size * 1.7;
    const yaw = random() * TAU;
    const y = sunk(x, z, s * 0.8);
    fixedBox(x, y + s * 0.3, z, s * 0.4, s * 0.25, s * 0.4, yaw);
    bigShapes[k % 3].push(matrixAt(x, y, z, yaw, s * 1.15, s * 0.8, s));
  });
  for (const mine of bigShapes) {
    if (mine.length) site.add(tiledInstances(rockGeometry(random), material, mine, { tileSize: MODEL_TILE, castShadow: true, name: 'quarryBoulders' }));
  }
}

/**
 * Everything standing in and round the pit that isn't a plant or a stone: the fence, the container, the excavator, the plant, the drums and the dead
 * trees. Returns where the relics stand, for what grows round them (buildPitGrowth): `{ container, plant, excavator, drums }`.
 */
function buildSite(c, quarry, site) {
  const { heights, random, fixedBox } = c;
  const wear = streamFor('pitRelicWear'); // the years of standing (#1003), drawn apart from the pit's own stream so nothing it deals moves
  const relics = { container: null, plant: null, excavator: null, drums: [] };
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
        const g = new Parts();
        for (let i = 0; i < 5; i++) g.box(wood, 1.2, 0.025, 0.14, 0, 0.14, -0.4 + i * 0.2, 0, 1);
        for (const z of [-0.42, 0, 0.42]) g.box(wood, 1.2, 0.09, 0.1, 0, 0.06, z, 0, 1);
        const m = g.build();
        m.position.set(pal.x, groundY(pal.x, pal.z) - 0.02, pal.z);
        m.rotation.y = random() * TAU;
        group.add(m);
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

  // Dead trees leaning at the rim: a bare grey trunk with a couple of broken limbs.
  {
    const bark = lit({ color: 0x5d544a, roughness: 1 });
    const spots = [];
    for (let tries = 0; spots.length < 3 && tries < 200; tries++) {
      const a = random() * TAU;
      const p = quarry.frameAt(a, quarry.rimAt(a) + 4 + random() * 8);
      if (quarry.plantOk(p.x, p.z, 3) && !spots.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 14)) spots.push(p);
    }
    for (const p of spots) {
      const lean = (random() - 0.5) * 0.35;
      const h = 4 + random() * 2.5;
      const y = groundY(p.x, p.z);
      const local = new Parts();
      local.add(bark, new THREE.CylinderGeometry(0.1, 0.26, h, 7), 0, h / 2, 0, lean, 0, lean * 0.5);
      local.add(bark, new THREE.CylinderGeometry(0.04, 0.1, 1.8, 5), 0.5, h * 0.72, 0, 0, 0, -1.0);
      local.add(bark, new THREE.CylinderGeometry(0.03, 0.08, 1.4, 5), -0.4, h * 0.55, 0.2, 0.3, 0, 0.9);
      const g = local.build();
      g.position.set(p.x, y - 0.1, p.z);
      g.rotation.y = random() * TAU;
      things.add(g);
      fixedBox(p.x, y + 1.5, p.z, 0.25, 1.5, 0.25);
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
  for (const [k, list] of [['reeds', g.reeds], ['rushes', g.rushes], ['sedge', g.sedge]]) for (const p of list) put(k, p.x, ground(p.x, p.z) - 0.04, p.z, p.yaw, p.s, p.s * (0.85 + ((p.x * 7.3) % 0.3)));
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
