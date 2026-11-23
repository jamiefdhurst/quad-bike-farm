// The things in the wood through the north gate (world/woods.js): oaks and hazel between the trunks you steer round, fallen logs across the
// Hollow Run and branches in the leaf litter, and the pond. The farm's own models for the trees; the logs are procedural.

import * as THREE from 'three';
import { modelBounds } from './assets.js';
import { matrixAt, buildPond } from './hillProps.js';
import { woodsPlants } from './woods.js';
import { buildConkers } from './autumnView.js';
import { CONKERS_PER_TREE } from './autumn.js';
import { buildTrail } from './trailProps.js';
import { buildLogYardScenery } from './logYardProps.js';
import { buildVeteranOak } from './landmarkProps.js';
import { barkTexture, logEndTexture } from './neighbourTextures.js';
import { plantMaterial, brambleLeafTexture, brambleGeometry } from './woodPlants.js';
import { tiledInstances } from './tiledInstances.js';
import { polygonEdges } from './polygons.js';

/** Builds the wood's props and their colliders. `c` is the props context (props.js). */
export function buildWoods(c) {
  const { fields } = c;
  const woods = fields.woods;
  buildTrees(c, woods);
  buildLogs(c, woods);
  buildTrail(c, woods);
  if (woods.outline) buildEdgeScrub(c, woods);
  buildLogYardScenery(c); // the woodpile's lean-to and block, on every farm with the wood (the new farm's, #683)
  const oak = c.layout.woods.oak; // the new farm's wood has one oak over the rest (#683)
  if (oak) {
    const tree = buildVeteranOak(c, { at: [oak.x, oak.z] });
    c.scene.add(tree, tree.userData.body);
  }
  if (woods.pond) buildPond(c, woods, () => false);
  return {};
}

/**
 * Oaks of all sizes with trunks you can't ride through, and hazel and holly between them. The oaks are the wood's frame cost, so each tile of them is
 * drawn in full within `treeFullDistance` and as the far oak (treeFar.js) beyond, scattered with the farm's other oaks and bushes (scatter.js).
 */
function buildTrees(c, woods) {
  const { models, layout, heights, physics, RAPIER, random, anchors } = c;
  const { trees, bushes } = woodsPlants(woods, layout, random);
  woods.oaks = trees.map(([x, z, s]) => ({ x, z, s })); // dealt fresh each load, so the map (hud/farmMap.js) reads them from here
  const mats = [[], []];
  for (const [x, z, s] of trees) {
    const y = heights.heightAt(x, z);
    mats[random() < 0.5 ? 0 : 1].push(matrixAt(x, y - 0.15, z, random() * Math.PI * 2, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, y + 2.5 * s, z));
    anchors.push({ x, y, z, r: 0.32 * s });
  }
  c.scatter.oaks(models, mats); // with the farm's other oaks, the far oak beyond treeFullDistance (scatter.js)
  if (c.autumn) buildConkers(c, woods, trees, CONKERS_PER_TREE, random);
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const matrices = bushes.map(([x, z]) => matrixAt(x, heights.heightAt(x, z) - 0.2, z, random() * Math.PI * 2, (1.2 + random() * 1.4) / bushSize.y));
  c.scatter.bushes(models, matrices);
}

/** How far apart along the wood's hedges the edge scrub stands, how far in from the hedge's line it stands, and how far it keeps from a gate. */
const EDGE_EVERY = 2.2;
const EDGE_IN = [1.1, 3.4];
const EDGE_GATE_CLEAR = 5.5;

/**
 * Where the thorn and bramble edge goes along the wood's outline, as { x, z, bramble } (a clump of bramble, else a thorn bush): a spot every ~2 m along every
 * hedge, 1 to 3.4 m in from it, none within 5.5 m of a gate (the Wet Meadow's and Back Lane's) or 3 m of the lead-in, the Run or the Trail, or the pond. Pure.
 */
export function edgeScrubSpots(woods, gates, random) {
  const spots = [];
  const edges = polygonEdges(woods.outline);
  for (const e of edges) {
    // The way in: whichever side of the edge's own normal is inside the wood.
    const mx = (e.x1 + e.x2) / 2;
    const mz = (e.z1 + e.z2) / 2;
    const sign = woods.inWoods(mx - e.dz * 0.5, mz + e.dx * 0.5) ? 1 : -1;
    const nx = -e.dz * sign;
    const nz = e.dx * sign;
    for (let s = EDGE_EVERY / 2; s < e.length; s += EDGE_EVERY * (0.7 + random() * 0.6)) {
      const inward = EDGE_IN[0] + random() * (EDGE_IN[1] - EDGE_IN[0]);
      const x = e.x1 + e.dx * s + nx * inward;
      const z = e.z1 + e.dz * s + nz * inward;
      if (!woods.inWoods(x, z, 0.8)) continue;
      if (gates.some((g) => Math.hypot(g.x - x, g.z - z) < EDGE_GATE_CLEAR)) continue;
      if (woods.trackDistance(x, z) < woods.halfWidth + 3 || woods.waterAt(x, z) > 0) continue;
      spots.push({ x, z, bramble: random() < 0.6 });
    }
  }
  return spots;
}

/** The thorn and bramble edge (#683): against the hedges, the thorn and bramble that close a wood's edge so the middle stays open in glades. Brambles are the trail's, textured (woodPlants.js); thorns are the farm's bush, larger. */
function buildEdgeScrub(c, woods) {
  const { scene, models, heights, random, drawDistance, autumn } = c;
  const w = c.layout.woods;
  const spots = edgeScrubSpots(woods, [w.gate, w.backLane].filter(Boolean), random);
  const brambles = [];
  const thorns = [];
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  for (const { x, z, bramble } of spots) {
    const y = heights.heightAt(x, z);
    if (bramble) {
      const s = 1.3 + random() * 0.9;
      brambles.push(matrixAt(x, y - 0.04, z, random() * Math.PI * 2, s, s * (0.9 + random() * 0.5), s));
    } else thorns.push(matrixAt(x, y - 0.25, z, random() * Math.PI * 2, (1.6 + random() * 1.2) / bushSize.y));
  }
  c.scatter.bushes(models, thorns);
  const material = plantMaterial(brambleLeafTexture(random));
  for (const turn of autumn ? [0.3, 0.75] : [0, 0.2]) {
    const mine = brambles.filter((_, i) => (i % 2 === 0) === (turn < 0.5));
    if (mine.length) scene.add(drawDistance.add(tiledInstances(brambleGeometry(random, { autumn, turn }), material, mine, { name: 'edgeBrambles' }), 'roughDistance'));
  }
}

/** Fallen logs: the chicane across the circuit and the dead branches lying off it, each with a box you bump into. Few enough for a mesh apiece. */
function buildLogs({ scene, heights, fixedBox, random }, woods) {
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(random), roughness: 1 }); // the hop log's bark and sawn ends (trailProps.js), #738's part of the logs
  const cut = new THREE.MeshStandardMaterial({ map: logEndTexture(random), roughness: 0.9 });
  const group = new THREE.Group();
  group.name = 'logs';
  for (const l of [...woods.logs, ...woods.deadwood]) {
    const y = heights.heightAt(l.x, l.z);
    const log = new THREE.Group();
    log.position.set(l.x, y + l.r * 0.85, l.z);
    log.rotation.y = l.yaw;
    const trunkGeometry = new THREE.CylinderGeometry(l.r, l.r * 1.12, l.len, 8);
    const uv = trunkGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * Math.max(1, l.len / 1.1)); // the bark's grain runs along the log, repeated over its length
    const trunk = new THREE.Mesh(trunkGeometry, bark);
    trunk.rotation.z = Math.PI / 2;
    log.add(trunk);
    for (const end of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(l.r * (end < 0 ? 1.12 : 1) * 0.96, 8), cut);
      face.position.x = (end * l.len) / 2 + end * 0.002;
      face.rotation.y = end * (Math.PI / 2);
      log.add(face);
    }
    // A couple of snapped-off stubs where the branches were.
    for (const [at, ang] of [[-0.25, 0.9], [0.2, -1.1]]) {
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(l.r * 0.22, l.r * 0.3, l.r * 1.6, 5), bark);
      stub.position.set(at * l.len, l.r * 0.55, 0);
      stub.rotation.x = ang;
      log.add(stub);
    }
    group.add(log);
    fixedBox(l.x, y + l.r, l.z, l.len / 2, l.r, l.r, l.yaw);
  }
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  scene.add(group);
}
