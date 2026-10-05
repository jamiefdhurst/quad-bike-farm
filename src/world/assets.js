import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Every external model. Sources and licences are listed in ASSETS.md.
export const MODEL_FILES = {
  treeA: 'models/tree-oak-a.glb',
  treeB: 'models/tree-oak-b.glb',
  fence: 'models/fence.glb',
  hedge: 'models/hedge.glb',
  bush: 'models/bush.glb',
  companion: 'models/companion.glb',
};

export async function loadModels(onProgress = () => {}) {
  const loader = new GLTFLoader();
  const base = import.meta.env?.BASE_URL ?? '/';
  const entries = Object.entries(MODEL_FILES);
  let done = 0;
  const results = await Promise.all(
    entries.map(async ([name, file]) => {
      const gltf = await loader.loadAsync(base + file);
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
 * Turns a static model into instanced meshes, one per sub-mesh, placed by the
 * given matrices. Far cheaper than cloning for hedges and trees.
 */
export function instanceModel(modelRoot, matrices, { castShadow = true, receiveShadow = true } = {}) {
  const group = new THREE.Group();
  modelRoot.updateMatrixWorld(true);
  const tmp = new THREE.Matrix4();
  modelRoot.traverse((o) => {
    if (!o.isMesh) return;
    const inst = new THREE.InstancedMesh(o.geometry, o.material, matrices.length);
    matrices.forEach((m, i) => inst.setMatrixAt(i, tmp.multiplyMatrices(m, o.matrixWorld)));
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = castShadow;
    inst.receiveShadow = receiveShadow;
    inst.computeBoundingSphere();
    group.add(inst);
  });
  return group;
}

/** Model-space bounding box. */
export function modelBounds(root) {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}
