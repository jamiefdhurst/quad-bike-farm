// What makes the lane one other people use (#687): the pair of cottages on its east side with their gardens and front wall, one more field
// gateway in her hedge, a grit bin on the outside of the northern bend, and at the end of our drive a postbox on its post and a bin stand. Where each goes is
// `layout.laneFittings` (layoutNew.js `laneFittingsLayout`); the cottages are the village's (villageBuildings.js `buildCottage`, villageKit.js) turned to face the lane.

import * as THREE from 'three';
import { roadNetwork } from './roads.js';
import { bendBins } from './aRoadFittings.js';
import { makeVillageMaterials } from './villageMaterials.js';
import { buildCottage } from './villageBuildings.js';
import { gateLeaf } from './neighbourFarmProps.js';
import { woodTexture } from './neighbourTextures.js';
import { stoneTexture, worldBox } from './outbuildingProps.js';
import * as furniture from './roadFurniture.js';

export const COTTAGE_FRONT = -Math.PI / 2; // yaw: the village's buildings face +z, so this one looks west, to the lane
const SINK = 0.04; // m a post stands into the ground

/** The two cottages' plans in game metres: each as the village's cottage record, 10 m apart along the lane (a gap between them for a side path), their garden behind. */
export function cottagePlans(F) {
  const cx = F.minX + 10.2; // the house's middle, so its front wall is 6.8 m from the plot's front
  const mid = (F.minZ + F.maxZ) / 2;
  const base = { yaw: COTTAGE_FRONT, halfX: 3.5, halfZ: 3.2, wallHeight: 4.6, ridge: 7, x: cx };
  return [
    { ...base, id: 'lane1', z: mid - 5.2, wall: 'stone', door: '#2d4a3a' },
    { ...base, id: 'lane2', z: mid + 5.2, wall: 'render', paint: '#d8cfae', door: '#7a2a22' },
  ];
}

/** The colliders of a cottage turned to face west and its garden's hedges: [{ x, z, hx, hz, h }] (the village's own `solid` is only for a yaw of 0 or a half turn). */
export function cottageBoxes(b, depth) {
  const out = [{ x: b.x, z: b.z, hx: b.halfZ, hz: b.halfX, h: b.wallHeight + 0.6 }];
  for (const sz of [-1, 1]) out.push({ x: b.x + b.halfZ + (depth - 1) / 2, z: b.z + sz * (b.halfX + 0.9), hx: (depth + 1) / 2, hz: 0.4, h: 1.5 });
  out.push({ x: b.x + b.halfZ + depth, z: b.z, hx: 0.4, hz: b.halfX + 1.4, h: 1.5 });
  return out;
}

/** Builds the lane's fittings. `c` is the props context (props.js). Null on a farm without them. */
export function buildLaneFittings(c) {
  const { scene, layout, heights, fixedBox, random } = c;
  const F = layout.laneFittings;
  if (!F) return null;
  const group = new THREE.Group();
  group.name = 'laneCottages';
  const at = (obj, x, z, yaw, sink = SINK) => {
    obj.position.set(x, heights.heightAt(x, z) - sink, z);
    obj.rotation.y = yaw;
    group.add(obj);
    return obj;
  };

  // The cottages, built with the village's kit and materials, and one wall of drystone across the front of their plot with a gap at each path.
  const plans = cottagePlans(F.cottages);
  const M = makeVillageMaterials(random, { doorColours: plans.map((b) => b.door), renders: plans.filter((b) => b.paint).map((b) => b.paint) });
  const depth = F.cottages.gardenDepth;
  const ctx = { root: group, S: { gardenDepth: () => depth }, M, heights, fixedBox: () => {}, random, groups: [], night: [] }; // its colliders are cottageBoxes
  plans.forEach((b, i) => {
    buildCottage(ctx, b, i, { hollow: true });
    const y = heights.heightAt(b.x, b.z);
    for (const q of cottageBoxes(b, depth)) fixedBox(q.x, y + q.h / 2, q.z, q.hx, q.h / 2 + 0.3, q.hz);
  });
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 });
  const frontX = F.cottages.minX + 2.2;
  const paths = plans.map((b) => b.z);
  let z = F.cottages.minZ + 0.5;
  const wallRuns = [];
  for (const p of [...paths, F.cottages.maxZ - 0.5]) {
    const end = p === F.cottages.maxZ - 0.5 ? p : p - 0.7;
    if (end - z > 0.5) wallRuns.push([z, end]);
    z = p + 0.7;
  }
  for (const [z0, z1] of wallRuns) {
    const len = z1 - z0;
    const y = heights.heightAt(frontX, (z0 + z1) / 2);
    const wall = new THREE.Mesh(worldBox(0.45, 0.95, len, 1), stone);
    wall.position.set(frontX, y + 0.4, (z0 + z1) / 2);
    group.add(wall);
    const coping = new THREE.Mesh(worldBox(0.55, 0.1, len + 0.06, 1), stone);
    coping.position.set(frontX, y + 0.93, (z0 + z1) / 2);
    group.add(coping);
    fixedBox(frontX, y + 0.5, (z0 + z1) / 2, 0.25, 0.55, len / 2);
  }

  // One more field gateway in her hedge (none at the small farm's track, which is open, #1082): a timber post each side and a shut five-bar leaf between, the leaf hung from the south post.
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [128, 120, 108]), roughness: 0.95 });
  const postWood = new THREE.MeshStandardMaterial({ map: woodTexture(random), roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x24282a, metalness: 0.6, roughness: 0.5 });
  for (const g of F.gateways) {
    const y = heights.heightAt(g.x, g.z);
    const half = g.width / 2;
    for (const dz of [-half, half]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.9, 0.24), postWood);
      post.position.set(g.x, y + 0.7, g.z + dz);
      group.add(post);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), iron);
      cap.position.set(g.x, y + 1.68, g.z + dz);
      group.add(cap);
      fixedBox(g.x, y + 0.7, g.z + dz, 0.12, 0.95, 0.12);
    }
    const leaf = gateLeaf(wood, iron, g.width - 0.34);
    leaf.position.set(g.x, y + 0.02, g.z - half + 0.15);
    group.add(leaf);
    fixedBox(g.x, y + 0.9, g.z, 0.1, 0.9, half - 0.1);
  }

  // A grit bin on the outside of the northern bend, facing the road.
  const lane = roadNetwork(layout).road('lane');
  for (const b of bendBins(lane, F.gritBins.map((p) => [p.x, p.z]))) {
    at(furniture.buildGritBin(), b.x, b.z, b.yaw, 0);
    fixedBox(b.x, heights.heightAt(b.x, b.z) + 0.35, b.z, 0.5, 0.35, 0.32, b.yaw);
  }

  // The postbox on its post and the bin stand, at the end of our drive, facing the lane.
  const face = Math.PI / 2; // looking east, to the lane
  at(furniture.buildPostbox(random), F.postbox.x, F.postbox.z, face);
  fixedBox(F.postbox.x, heights.heightAt(F.postbox.x, F.postbox.z) + 1, F.postbox.z, 0.1, 1.1, 0.1);
  at(furniture.buildBinStand(random), F.binStand.x, F.binStand.z, face, 0);
  fixedBox(F.binStand.x, heights.heightAt(F.binStand.x, F.binStand.z) + 0.5, F.binStand.z, 0.4, 0.5, 0.9);
  scene.add(group);
  return { group };
}
