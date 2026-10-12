// Instanced meshes split into tiles of ground (tiles.js), and the draw distance that hides far tiles of small ground cover. Anything new
// scattered over the farm in numbers goes through `tiledInstances` (or `instanceModel` for a model), never one InstancedMesh for the lot.

import * as THREE from 'three';
import { tileInstances, inDrawDistance } from './tiles.js';

export const COVER_TILE = 30; // metres a side for ground cover: small enough that the draw distance cuts cleanly
export const MODEL_TILE = 60; // for hedges, trees and bushes, which have only frustum culling to gain

const at = (m) => ({ x: m.elements[12], z: m.elements[14] });

/**
 * One InstancedMesh per tile, sharing `geometry` and `material`, in a group. `colors` (optional) are per instance. Each tile mesh has its
 * bounds in `userData.tile` and its own bounding sphere, so the renderer leaves it out when it is out of view (and out of the sun's).
 */
export function tiledInstances(geometry, material, matrices, { colors, tileSize = COVER_TILE, castShadow = false, receiveShadow = true, name } = {}) {
  const group = new THREE.Group();
  if (name) group.name = name;
  for (const tile of tileInstances(matrices.map(at), tileSize)) {
    const mesh = new THREE.InstancedMesh(geometry, material, tile.indices.length);
    tile.indices.forEach((i, k) => {
      mesh.setMatrixAt(k, matrices[i]);
      if (colors) mesh.setColorAt(k, colors[i]);
    });
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.tile = tile;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

/** Hides the tiles of each registered group beyond its draw distance (a key into the graphics params) from where you are looking from. */
export class DrawDistance {
  constructor(params) {
    this.params = params;
    this.groups = [];
  }

  add(group, key) {
    this.groups.push({ group, key });
    return group;
  }

  update(position) {
    for (const { group, key } of this.groups) {
      const d = this.params[key];
      for (const mesh of group.children) mesh.visible = inDrawDistance(mesh.userData.tile, position.x, position.z, d);
    }
  }
}
