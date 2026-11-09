import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';

// Every external model. Sources and licences are listed in ASSETS.md.
export const MODEL_FILES = {
  treeA: 'models/tree-oak-a.glb',
  treeB: 'models/tree-oak-b.glb',
  fence: 'models/fence.glb',
  hedge: 'models/hedge.glb',
  bush: 'models/bush.glb',
  companion: 'models/companion.glb',
};

/**
 * Leaf materials come in as alpha-blended (the hedge, bush and oak models are exported that way), which draws them without writing depth
 * and, instanced, unsorted: a block of hedge or a bush behind another shows through it. Their texture is cut-out leaves (alpha is all but
 * 0 or 1), so draw them as a cut-out instead, writing depth, with alpha-to-coverage softening the edges under the antialiasing. A cut-out
 * thins out in the distance, where the smaller mipmaps average the leaves' alpha down below the cut, so the alpha is scaled back up by a
 * quarter for each mip level down (Ben Golus's fix), or a tree on the horizon is bare branches.
 */
export function cutOutLeaves(material) {
  if (!material?.transparent || !material.map) return false;
  material.transparent = false;
  material.depthWrite = true;
  material.alphaTest = 0.5;
  material.alphaToCoverage = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      #ifdef USE_MAP
        vec2 leafTexel = vMapUv * vec2(textureSize(map, 0));
        vec2 leafDx = dFdx(leafTexel);
        vec2 leafDy = dFdy(leafTexel);
        float leafMip = max(0.0, 0.5 * log2(max(dot(leafDx, leafDx), dot(leafDy, leafDy))));
        diffuseColor.a *= 1.0 + leafMip * 0.25;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'cutOutLeaves';
  material.needsUpdate = true;
  return true;
}

export async function loadModels(onProgress = () => {}) {
  const loader = new GLTFLoader();
  const base = import.meta.env?.BASE_URL ?? '/';
  const entries = Object.entries(MODEL_FILES);
  let done = 0;
  const results = await Promise.all(
    entries.map(async ([name, file]) => {
      const gltf = await loader.loadAsync(base + file);
      gltf.scene.traverse((o) => {
        if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) cutOutLeaves(m);
      });
      onProgress(++done, entries.length);
      return [name, gltf];
    }),
  );
  return Object.fromEntries(results);
}

/** Enables shadows on every mesh under `root`. */
export function enableShadows(root, cast = true, receive = true) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

/**
 * Turns a static model into instanced meshes, one per sub-mesh and tile of ground (tiledInstances.js), placed by the given matrices. Far
 * cheaper than cloning for hedges and trees, and the tiles out of view are left out.
 */
export function instanceModel(modelRoot, matrices, { castShadow = true, receiveShadow = true } = {}) {
  const group = new THREE.Group();
  modelRoot.updateMatrixWorld(true);
  modelRoot.traverse((o) => {
    if (!o.isMesh) return;
    const placed = matrices.map((m) => new THREE.Matrix4().multiplyMatrices(m, o.matrixWorld));
    const tiles = tiledInstances(o.geometry, o.material, placed, { tileSize: MODEL_TILE, castShadow, receiveShadow });
    // `add()` with no arguments logs an error, which a model with nothing to place (a hedge-less layout) would trigger.
    if (tiles.children.length) group.add(...tiles.children);
  });
  return group;
}

/** Model-space bounding box. */
export function modelBounds(root) {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}
