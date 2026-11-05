// The things in and round the gravel pit (world/quarry.js): a tumbledown post-and-wire fence round the lip with its danger signs, the site's
// steel container, an old excavator left on the floor and a screening plant (a hopper and crusher on a pad, conveyors and a screen, delivering onto a heap), its cabin and generator, drums and
// tyres by the pond, hawthorn and gorse along the lip, boulders and flints fallen from the walls, dead trees, and the pond with its reeds.
// All procedural, with canvas textures; the big pieces have colliders. The ground itself (the walls, the heaps, the road) is the terrain's.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instanceModel, modelBounds, enableShadows } from './assets.js';
import { matrixAt, buildPond, gorseGeometry } from './hillProps.js';
import { woodTexture } from './neighbourTextures.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { quarryPlants } from './quarry.js';
import { Parts } from './parts.js';
import { rustTexture, signTexture } from './quarryTextures.js';
import { buildExcavator, excavatorMaterials } from './excavatorModel.js';
import { buildContainer, containerMaterials } from './containerModel.js';
import { buildCabin, cabinMaterials } from './siteCabinModel.js';
import { buildScreeningPlant, plantMaterials } from './screeningPlantModel.js';
import { plantSite, plantPoint, inPlantsWay, PLANT } from './plantSite.js';
import { buildSign, debrisMaterials, drumGeometry, scatterClear, tyreGeometry, DRUM, TYRE } from './quarryDebris.js';

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
  buildSite(c, quarry, site);
  c.scene.add(site);
  buildPond(c, quarry, () => false);
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

/** Everything standing in and round the pit that isn't a plant or a stone: the fence, the container, the excavator, the plant, the drums and the dead trees. */
function buildSite(c, quarry, site) {
  const { heights, random, fixedBox } = c;
  const things = new THREE.Group();
  const lit = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 98, 74]), roughness: 0.95 });
  const wire = lit({ color: 0x7d8286, metalness: 0.5, roughness: 0.5 });
  const rust = lit({ map: rustTexture(random), roughness: 0.9 });
  const rustDark = lit({ map: rustTexture(random, '#5b3a2a'), roughness: 0.9 });
  const dark = lit({ color: 0x252422, roughness: 0.9 });
  const groundY = (x, z) => heights.heightAt(x, z);
  const floorAt = (a, back) => quarry.frameAt(a, quarry.floorEdge(a) - back);

  buildFence(things, quarry, { wood, wire, groundY, random });

  // The steel container: the site's store, in the field a little off the gate, on sleepers, one door leaf ajar and the other padlocked.
  const gate = quarry.gate;
  const hut = findSpot(400, (p) => quarry.plantOk(p.x, p.z, 8) && Math.hypot(p.x - gate.x, p.z - quarry.rect.maxZ) > 14, () => ({ x: gate.x - 10 - random() * 24, z: quarry.rect.maxZ - 12 - random() * 14 })) ?? { x: gate.x - 18, z: quarry.rect.maxZ - 18 };
  const hutYaw = (random() - 0.5) * 0.7;
  {
    const { group, boxes } = buildContainer(containerMaterials(random), random);
    const y0 = settle(group, hut, hutYaw, 3, 1.2, groundY);
    things.add(group);
    placeBoxes(fixedBox, hut, y0, hutYaw, boxes);
  }

  // Whether (x, z) is flat floor off the water and clear of the roads, for the things that stand by the plant.
  const onFloor = (x, z) => {
    const p = quarry.polar(x, z);
    return p.s < quarry.floorEdge(p.a) - 1.5 && quarry.waterAt(x, z) === 0 && quarry.roadNear(x, z).d > quarry.roadHalf + 3 && quarry.heapRise(x, z) < 0.05;
  };

  // The screening plant on its pad, where the pit was dealt it, its conveyor ending over the heap it was dealt with.
  const plant = plantSite(quarry, groundY);
  if (plant) {
    const { group, boxes } = buildScreeningPlant(plantMaterials(random), {
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
      const { group: cabin, boxes: cabinBoxes } = buildCabin(cabinMaterials(random));
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
    const { group, boxes } = buildExcavator(excavatorMaterials(random));
    const y0 = settle(group, dig, turn, 1.9, 1.3, groundY) - 0.03;
    group.position.y = y0;
    things.add(group);
    placeBoxes(fixedBox, dig, y0, turn, boxes);
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
      const mat = debrisMaterials(random);
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
      }
      for (const d of deal(2, 0.5, 1.5, 4.5)) {
        const y = groundY(d.x, d.z);
        const yaw = random() * TAU;
        drums[(d.i + 2) % drums.length].push(at(d.x, y + DRUM.radius, d.z, 0, yaw, Math.PI / 2));
        fixedBox(d.x, y + DRUM.radius, d.z, DRUM.height / 2, DRUM.radius, DRUM.radius, yaw);
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
}

/** Posts every few metres round the lip, leaning, some gone, with two strands of wire between those that are left (some sagging to the ground), and the signs. */
function buildFence(site, quarry, { wood, wire, groundY, random }) {
  const parts = new Parts();
  const wires = new Parts();
  const posts = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + (random() - 0.5) * 0.04;
    const p = quarry.frameAt(a, quarry.rimAt(a) + 2.4);
    if (quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 6) continue; // open where the road comes in
    posts.push({ ...p, a, gone: random() < 0.16, lean: (random() - 0.5) * 0.45, lean2: (random() - 0.5) * 0.3, h: 1.15 + random() * 0.3 });
  }
  for (const po of posts) {
    if (po.gone) continue;
    const y = groundY(po.x, po.z);
    parts.add(wood, new THREE.BoxGeometry(0.11, po.h, 0.11), po.x, y + po.h / 2 - 0.05, po.z, po.lean2, po.a, po.lean);
  }
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i];
    const b = posts[(i + 1) % posts.length];
    if (a.gone || b.gone) continue;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > 9) continue;
    for (const k of [0.45, 0.85]) {
      const sag = random() < 0.12 ? 0.5 : 0.05;
      const ya = groundY(a.x, a.z) + a.h * k;
      const yb = groundY(b.x, b.z) + b.h * k;
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      wires.add(wire, new THREE.CylinderGeometry(0.008, 0.008, d, 4), (a.x + b.x) / 2, (ya + yb) / 2 - sag, (a.z + b.z) / 2, 0, heading - Math.PI / 2, Math.PI / 2);
    }
  }
  const fence = parts.build({ castShadow: false });
  const wireGroup = wires.build({ castShadow: false });
  fence.name = 'quarryFence';
  site.add(fence, wireGroup);

  // The signs: where the road comes in, over the pond, and one on the far side, each on a post of its own, leaning a little.
  const road = quarry.pit.road;
  const signs = [
    { a: road.from + road.dir * 0.35, back: 3.4, tex: signTexture('DANGER', ['UNSTABLE FACES', 'KEEP OUT']) },
    { a: Math.atan2(quarry.pond.z - quarry.pit.z, quarry.pond.x - quarry.pit.x) - quarry.pit.yaw, back: 3.4, tex: signTexture('DANGER', ['DEEP WATER', 'NO SWIMMING']) },
    { a: quarry.pit.climbAt + 1.25, back: 3.4, tex: signTexture('PRIVATE', ['GRAVEL PIT', 'NO TRESPASSING'], { bg: '#e9e5d6' }) },
  ];
  for (const sg of signs) {
    const p = quarry.frameAt(sg.a, quarry.rimAt(sg.a) + sg.back);
    const y = groundY(p.x, p.z);
    const g = buildSign(sg.tex, wood);
    g.position.set(p.x, y - 0.1, p.z);
    g.rotation.set(0, Math.atan2(quarry.pit.x - p.x, quarry.pit.z - p.z) + Math.PI + (random() - 0.5) * 0.4, (random() - 0.5) * 0.12); // facing out from the pit
    site.add(g);
  }
}
