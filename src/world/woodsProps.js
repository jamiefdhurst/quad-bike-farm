// The things in the wood through the north gate (world/woods.js): oaks and hazel between the trunks you steer round, fallen logs across the
// Hollow Run and branches in the leaf litter, and the pond. The farm's own models for the trees; the logs are procedural.

import * as THREE from 'three';
import { instanceModel, modelBounds } from './assets.js';
import { matrixAt, buildPond } from './hillProps.js';
import { woodsPlants } from './woods.js';
import { buildConkers } from './autumnView.js';
import { CONKERS_PER_TREE } from './autumn.js';

/** Builds the wood's props and their colliders. `c` is the props context (props.js). */
export function buildWoods(c) {
  const { fields } = c;
  const woods = fields.woods;
  buildTrees(c, woods);
  buildLogs(c, woods);
  if (woods.pond) buildPond(c, woods, () => false);
}

/** Oaks of all sizes with trunks you can't ride through, and hazel and holly between them. */
function buildTrees(c, woods) {
  const { scene, models, layout, heights, physics, RAPIER, random } = c;
  const { trees, bushes } = woodsPlants(woods, layout, random);
  const mats = [[], []];
  for (const [x, z, s] of trees) {
    const y = heights.heightAt(x, z);
    mats[random() < 0.5 ? 0 : 1].push(matrixAt(x, y - 0.15, z, random() * Math.PI * 2, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, y + 2.5 * s, z));
  }
  scene.add(instanceModel(models.treeA.scene, mats[0]));
  scene.add(instanceModel(models.treeB.scene, mats[1]));
  if (c.autumn) buildConkers(c, woods, trees, CONKERS_PER_TREE, random);
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const matrices = bushes.map(([x, z]) => matrixAt(x, heights.heightAt(x, z) - 0.2, z, random() * Math.PI * 2, (1.2 + random() * 1.4) / bushSize.y));
  scene.add(instanceModel(models.bush.scene, matrices, { castShadow: false }));
}

/** Fallen logs: the chicane across the circuit and the dead branches lying off it, each with a box you bump into. Few enough for a mesh apiece. */
function buildLogs({ scene, heights, fixedBox }, woods) {
  const bark = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 });
  const cut = new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: 0.9 });
  const group = new THREE.Group();
  group.name = 'logs';
  for (const l of [...woods.logs, ...woods.deadwood]) {
    const y = heights.heightAt(l.x, l.z);
    const log = new THREE.Group();
    log.position.set(l.x, y + l.r * 0.85, l.z);
    log.rotation.y = l.yaw;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(l.r, l.r * 1.12, l.len, 8), bark);
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
